// Suspended accounts and player reports (kept in the same storage as the leaderboard).
import { loadJSON, saveJSON } from './storage';

export interface Ban { name: string; reason: string; at: number; email?: string }
export interface Report { n: number; at: number; byId: string; byName: string; targetId: string; targetName: string; reason: string; note: string }
interface Store { bans: Record<string, Ban>; bannedEmails: Record<string, true>; reports: Report[]; nextReport: number }

let store: Store = { bans: {}, bannedEmails: {}, reports: [], nextReport: 1 };
export async function initModeration() { store = { ...store, ...(await loadJSON<Store>('moderation', store)) }; }
const save = () => saveJSON('moderation', () => store);

export const SUSPENDED_MESSAGE = 'This account has been suspended for breaking the game rules. If you think this is a mistake, contact support.';
const normEmail = (e: unknown) => String(e ?? '').trim().toLowerCase();

export const isBanned = (id: string | undefined | null) => !!id && !!store.bans[id];
export const isEmailBanned = (email: unknown) => { const e = normEmail(email); return !!e && !!store.bannedEmails[e]; };

export function ban(id: string, name: string, reason: string, email?: string | null) {
  const e = normEmail(email);
  store.bans[id] = { name, reason: String(reason || '').slice(0, 200), at: Date.now(), ...(e ? { email: e } : {}) };
  if (e) store.bannedEmails[e] = true;   // the same email can't be used for a new account
  save();
}
export function unban(id: string) {
  const b = store.bans[id];
  if (b?.email) delete store.bannedEmails[b.email];
  delete store.bans[id];
  save();
}
export const listBans = () => Object.entries(store.bans).map(([id, b]) => ({ id, ...b })).sort((a, b) => b.at - a.at);

// ---- reports from players ----
const last = new Map<string, number[]>();   // reporter id -> times of recent reports
/** Returns an error message, or null when the report was saved. */
export function addReport(r: { byId: string; byName: string; targetId: string; targetName: string; reason: string; note: string }): string | null {
  const now = Date.now();
  const mine = (last.get(r.byId) ?? []).filter((t) => now - t < 24 * 3600_000);
  if (mine.length && now - mine[mine.length - 1] < 20_000) return 'Please wait a moment before sending another report.';
  if (mine.length >= 10) return 'You have sent many reports today. Please try again tomorrow.';
  // the same person reporting the same player again within 10 minutes is not saved twice
  if (store.reports.some((x) => x.byId === r.byId && x.targetId === r.targetId && now - x.at < 600_000)) return null;
  last.set(r.byId, [...mine, now]);
  store.reports.unshift({ n: store.nextReport++, at: now, ...r, reason: r.reason.slice(0, 60), note: r.note.slice(0, 300) });
  store.reports = store.reports.slice(0, 500);
  save();
  return null;
}
export const listReports = () => store.reports;
export function dismissReport(n: number) { store.reports = store.reports.filter((r) => r.n !== n); save(); }
