// First-party, privacy-friendly usage counts: how many times each event happened per day, and which days each player was active
// (so day-1 / day-7 return can be worked out). No third party, no personal data: players are a short one-way hash of their random game id.
// Everything lives in one small record that is flushed at most once a minute, off the game path.
import { createHash } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { loadJSON, saveJSON } from './storage';

/** The only events accepted (anything else is ignored). */
export const EVENTS = [
  'app_open',            // someone opened the game (once per visit)
  'tutorial_shown', 'tutorial_start', 'tutorial_done', 'tutorial_skip',
  'game_start', 'game_online', 'game_end',
  'rematch_request', 'rematch_start',
  'table_invite_share', 'table_link_open', 'invite_link_open',
  'daily_gift', 'hand_review_open', 'mission_claim',
] as const;
const OK = new Set<string>(EVENTS);

interface Data {
  /** day (yyyy-mm-dd, UTC) → event → count */
  days: Record<string, Record<string, number>>;
  /** player hash → first day seen, and a bit per day since then on which they were active (bit 0 = first day) */
  players: Record<string, { f: string; a: number }>;
}

let data: Data = { days: {}, players: {} };
let loaded: Promise<void> | null = null;
let dirty = false;
const KEEP_DAYS = 60, KEEP_PLAYER_DAYS = 45, MAX_PLAYERS = 12_000;

const today = () => new Date().toISOString().slice(0, 10);
const dayNum = (d: string) => Math.floor(Date.parse(d) / 86_400_000);
const hash = (id: string) => createHash('sha256').update('spade-haven-analytics:' + id).digest('hex').slice(0, 12);

function load() {
  if (!loaded) loaded = loadJSON<Data>('analytics', { days: {}, players: {} }).then((d) => { data = { days: d.days ?? {}, players: d.players ?? {} }; setInterval(flush, 60_000).unref?.(); });
  return loaded;
}
function flush() {
  if (!dirty) return;
  dirty = false;
  // keep the record small: old days and long-gone players are dropped
  const cutoff = dayNum(today()) - KEEP_DAYS;
  for (const d of Object.keys(data.days)) if (dayNum(d) < cutoff) delete data.days[d];
  const pc = dayNum(today()) - KEEP_PLAYER_DAYS;
  const ids = Object.keys(data.players);
  for (const k of ids) if (dayNum(data.players[k].f) < pc) delete data.players[k];
  if (Object.keys(data.players).length > MAX_PLAYERS) for (const k of Object.keys(data.players).sort((a, b) => data.players[a].f.localeCompare(data.players[b].f)).slice(0, Object.keys(data.players).length - MAX_PLAYERS)) delete data.players[k];
  saveJSON('analytics', () => data);
}

const hits = new Map<string, { n: number; t: number }>();   // light per-address limit so nobody can flood the counters

/** POST /api/track  { id, ev: { event: count } }  from the game. Always answers quickly with 204. */
export async function trackApi(req: IncomingMessage, res: ServerResponse, ip: string) {
  const done = (code = 204) => { try { res.writeHead(code, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS', 'cache-control': 'no-store' }); res.end(); } catch { /* ignore */ } };
  if (req.method === 'OPTIONS') return done();
  if (req.method !== 'POST') return done(404);
  const now = Date.now(), h = hits.get(ip);
  if (h && now - h.t < 60_000) { if (++h.n > 30) return done(429); } else hits.set(ip, { n: 1, t: now });
  if (hits.size > 5000) hits.clear();
  let raw = '';
  req.on('data', (d) => { raw += d; if (raw.length > 2000) req.destroy(); });
  req.on('error', () => done(400));
  req.on('end', async () => {
    try {
      const b = JSON.parse(raw || '{}') as { id?: unknown; ev?: Record<string, unknown> };
      const id = String(b.id ?? '').slice(0, 64);
      if (!id || !b.ev || typeof b.ev !== 'object') return done(400);
      await load();
      const day = today(), p = hash(id);
      const row = (data.days[day] ??= {});
      let any = false;
      for (const [e, n] of Object.entries(b.ev)) {
        if (!OK.has(e)) continue;
        const c = Math.max(0, Math.min(20, Math.floor(Number(n) || 0)));
        if (c) { row[e] = (row[e] ?? 0) + c; any = true; }
      }
      if (any) {
        let pl = data.players[p];
        if (!pl) { pl = data.players[p] = { f: day, a: 1 }; row.new_player = (row.new_player ?? 0) + 1; }
        else { const off = dayNum(day) - dayNum(pl.f); if (off >= 0 && off < 31) pl.a |= 1 << off; }
        dirty = true;
      }
      done();
    } catch { done(400); }
  });
}

/** The numbers shown on the admin page: the last 14 days of counts, active players per day, and return rates per signup day. */
export async function analyticsReport() {
  await load();
  const t = dayNum(today());
  const active: Record<string, number> = {};
  const cohorts: Record<string, { size: number; d1: number; d7: number }> = {};
  for (const p of Object.values(data.players)) {
    const f = dayNum(p.f);
    const c = (cohorts[p.f] ??= { size: 0, d1: 0, d7: 0 });
    c.size++; if (p.a & 2) c.d1++; if (p.a & 128) c.d7++;
    for (let off = 0; off < 31; off++) if (p.a & (1 << off)) { const d = new Date((f + off) * 86_400_000).toISOString().slice(0, 10); active[d] = (active[d] ?? 0) + 1; }
  }
  const days = Array.from({ length: 14 }, (_, i) => new Date((t - i) * 86_400_000).toISOString().slice(0, 10)).map((day) => ({ day, active: active[day] ?? 0, events: data.days[day] ?? {} }));
  const cohort = days.map(({ day }) => {
    const c = cohorts[day] ?? { size: 0, d1: 0, d7: 0 };
    const age = t - dayNum(day);
    return { day, size: c.size, d1: age >= 1 && c.size ? c.d1 / c.size : null, d7: age >= 7 && c.size ? c.d7 / c.size : null };   // null = not old enough yet
  });
  return { days, cohort, events: EVENTS, note: 'Days are UTC. Players are counted by a one-way hash of their random game id.' };
}
