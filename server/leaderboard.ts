// Real weekly leaderboard + Wall of Fame, stored on the server in data/leaderboard.json.
// Starts empty: only real players' winnings ever appear here.
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { join } from 'path';

export interface LbEntry { id: string; name: string; avatar: string; earnings: number }
export interface FameEntry { week: string; name: string; avatar: string; earnings: number }
interface Store {
  week: string;
  players: Record<string, LbEntry>;
  lastWeek: { week: string; rows: LbEntry[] } | null;
  fame: FameEntry[];
}

const DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const FILE = join(DIR, 'leaderboard.json');

/** Weeks start Sunday 00:00 UTC. */
export function weekKey(d = new Date()) {
  const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  s.setUTCDate(s.getUTCDate() - s.getUTCDay());
  return s.toISOString().slice(0, 10);
}
export function weekEndsAt(d = new Date()) {
  return new Date(weekKey(d) + 'T00:00:00Z').getTime() + 7 * 864e5;
}

function empty(): Store { return { week: weekKey(), players: {}, lastWeek: null, fame: [] }; }

let store: Store = empty();
try { if (existsSync(FILE)) store = { ...empty(), ...JSON.parse(readFileSync(FILE, 'utf8')) }; } catch { store = empty(); }

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      mkdirSync(DIR, { recursive: true });
      writeFileSync(FILE + '.tmp', JSON.stringify(store));
      renameSync(FILE + '.tmp', FILE);
    } catch (e) { console.error('leaderboard save failed', e); }
  }, 500);
}

const sorted = (rows: LbEntry[]) => rows.filter((r) => r.earnings > 0).sort((a, b) => b.earnings - a.earnings);

function rollover() {
  const now = weekKey();
  if (store.week === now) return;
  const rows = sorted(Object.values(store.players));
  store.lastWeek = { week: store.week, rows: rows.slice(0, 100) };
  if (rows[0]) store.fame = [{ week: store.week, name: rows[0].name, avatar: rows[0].avatar, earnings: rows[0].earnings }, ...store.fame].slice(0, 52);
  store.players = {};
  store.week = now;
  save();
}

export function credit(p: { id: string; name: string; avatar: string }, amount: number) {
  if (!p.id || !(amount > 0)) return;
  rollover();
  const e = store.players[p.id] ?? { id: p.id, name: p.name, avatar: p.avatar, earnings: 0 };
  e.name = String(p.name).slice(0, 20);
  e.avatar = String(p.avatar).slice(0, 8);
  e.earnings += Math.round(amount);
  store.players[p.id] = e;
  save();
}

export function board(id?: string) {
  rollover();
  const rows = sorted(Object.values(store.players));
  const rankOf = (list: LbEntry[]) => { const i = list.findIndex((r) => r.id === id); return i >= 0 ? i + 1 : null; };
  const strip = (r: LbEntry) => ({ name: r.name, avatar: r.avatar, earnings: r.earnings, me: r.id === id });
  return {
    week: store.week,
    endsAt: weekEndsAt(),
    rows: rows.slice(0, 100).map(strip),
    me: { rank: rankOf(rows), earnings: id ? store.players[id]?.earnings ?? 0 : 0 },
    lastWeek: store.lastWeek ? { week: store.lastWeek.week, rank: rankOf(store.lastWeek.rows) } : null,
    fame: store.fame,
  };
}

/** Wipes every leaderboard and Wall of Fame entry. */
export function resetAll() { store = empty(); save(); }
