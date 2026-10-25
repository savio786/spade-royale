// Real weekly leaderboard + Wall of Fame, stored on the server in data/leaderboard.json.
// Starts empty: only real players' winnings ever appear here.
import { loadJSON, saveJSON } from './storage';

export interface LbEntry { id: string; name: string; avatar: string; earnings: number }
export interface FameEntry { week: string; name: string; avatar: string; earnings: number }
interface Store {
  week: string;
  players: Record<string, LbEntry>;
  lastWeek: { week: string; rows: LbEntry[] } | null;
  fame: FameEntry[];
  allTime: Record<string, LbEntry>;   // everything each player has ever won: the Wall of Fame list
  seeded: boolean;
}

/** Weeks start Sunday 00:00 UTC. */
export function weekKey(d = new Date()) {
  const s = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  s.setUTCDate(s.getUTCDate() - s.getUTCDay());
  return s.toISOString().slice(0, 10);
}
export function weekEndsAt(d = new Date()) {
  return new Date(weekKey(d) + 'T00:00:00Z').getTime() + 7 * 864e5;
}

function empty(): Store { return { week: weekKey(), players: {}, lastWeek: null, fame: [], allTime: {}, seeded: true }; }

let store: Store = empty();
export async function initLeaderboard() {
  store = await loadJSON('leaderboard', { ...empty(), seeded: false });
  if (!store.allTime) store.allTime = {};
  if (!store.seeded) {
    // first start with the all-time list: start it from last week's results and this week so far (nothing is counted twice)
    for (const r of [...(store.lastWeek?.rows ?? []), ...Object.values(store.players)]) {
      const e = store.allTime[r.id] ?? { id: r.id, name: r.name, avatar: r.avatar, earnings: 0 };
      e.name = r.name; e.avatar = r.avatar; e.earnings += r.earnings;
      store.allTime[r.id] = e;
    }
    store.seeded = true;
    save();
  }
}
const save = () => saveJSON('leaderboard', () => store);

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

/** Picture keys the game can show: drawn avatars and portraits, or an uploaded photo (u: + 24 hex). */
const okAvatar = (v: unknown) => { const s = String(v ?? ''); return /^(a\d{1,2}|p\d{1,2}|u:[a-f0-9]{24})$/.test(s) ? s : null; };

/** Keeps a ranked player's name and picture up to date when they change them (not only when they next win). */
export function touch(p: { id: string; name: string; avatar: string }) {
  const e = store.players[p.id];
  const a = store.allTime[p.id];
  if (a) { a.name = String(p.name || a.name).slice(0, 20); a.avatar = okAvatar(p.avatar) ?? a.avatar; save(); }
  if (!e) return;
  const avatar = okAvatar(p.avatar) ?? e.avatar, name = String(p.name || e.name).slice(0, 20);
  let changed = false;
  if (e.avatar !== avatar) { e.avatar = avatar; changed = true; }
  if (e.name !== name) { e.name = name; changed = true; }
  for (const f of store.fame) if (f.name === e.name && f.avatar.startsWith('u:') && f.avatar.length < 26) { f.avatar = avatar; changed = true; }
  if (changed) save();
}

export function credit(p: { id: string; name: string; avatar: string }, amount: number) {
  if (!p.id || !(amount > 0)) return;
  rollover();
  const e = store.players[p.id] ?? { id: p.id, name: p.name, avatar: p.avatar, earnings: 0 };
  e.name = String(p.name).slice(0, 20);
  e.avatar = okAvatar(p.avatar) ?? e.avatar;
  e.earnings += Math.round(amount);
  store.players[p.id] = e;
  const t = store.allTime[p.id] ?? { id: p.id, name: p.name, avatar: p.avatar, earnings: 0 };
  t.name = e.name; t.avatar = e.avatar; t.earnings += Math.round(amount);
  store.allTime[p.id] = t;
  save();
}

export function board(id?: string) {
  rollover();
  const rows = sorted(Object.values(store.players));
  const all = sorted(Object.values(store.allTime));
  const rankOf = (list: LbEntry[]) => { const i = list.findIndex((r) => r.id === id); return i >= 0 ? i + 1 : null; };
  const strip = (r: LbEntry) => ({ name: r.name, avatar: r.avatar, earnings: r.earnings, me: r.id === id });
  return {
    week: store.week,
    endsAt: weekEndsAt(),
    rows: rows.slice(0, 100).map(strip),
    me: { rank: rankOf(rows), earnings: id ? store.players[id]?.earnings ?? 0 : 0 },
    lastWeek: store.lastWeek ? { week: store.lastWeek.week, rank: rankOf(store.lastWeek.rows), rows: store.lastWeek.rows.slice(0, 100).map(strip) } : null,
    fame: store.fame,
    allTime: all.slice(0, 100).map(strip),
    meAllTime: { rank: rankOf(all), earnings: id ? store.allTime[id]?.earnings ?? 0 : 0 },
  };
}

/** Wipes every leaderboard and Wall of Fame entry. */
export function resetAll() { store = empty(); save(); }
