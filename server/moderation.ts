// Suspended accounts and player reports (kept in the same storage as the leaderboard).
import { loadJSON, saveJSON } from './storage';

export interface Ban { name: string; reason: string; at: number; email?: string }
export interface Report { n: number; at: number; byId: string; byName: string; targetId: string; targetName: string; reason: string; note: string }
export interface Mute { name: string; reason: string; at: number; auto?: boolean }
interface Store { bans: Record<string, Ban>; bannedEmails: Record<string, true>; reports: Report[]; nextReport: number; muted: Record<string, Mute>; devices: Record<string, string>; bannedDevices: Record<string, true> }

let store: Store = { bans: {}, bannedEmails: {}, reports: [], nextReport: 1, muted: {}, devices: {}, bannedDevices: {} };
export async function initModeration() { store = { ...store, ...(await loadJSON<Store>('moderation', store)) }; if (!store.muted) store.muted = {}; if (!store.devices) store.devices = {}; if (!store.bannedDevices) store.bannedDevices = {}; }
const save = () => saveJSON('moderation', () => store);

export const SUSPENDED_MESSAGE = 'This account has been suspended for breaking the game rules. If you think this is a mistake, contact support.';
const normEmail = (e: unknown) => String(e ?? '').trim().toLowerCase();

export const isBanned = (id: string | undefined | null) => !!id && !!store.bans[id];
export const isEmailBanned = (email: unknown) => { const e = normEmail(email); return !!e && !!store.bannedEmails[e]; };

export function ban(id: string, name: string, reason: string, email?: string | null) {
  const e = normEmail(email);
  store.bans[id] = { name, reason: String(reason || '').slice(0, 200), at: Date.now(), ...(e ? { email: e } : {}) };
  if (e) store.bannedEmails[e] = true;   // the same email can't be used for a new account
  if (store.devices[id]) store.bannedDevices[store.devices[id]] = true;   // nor a new account from the same browser
  save();
}
export function unban(id: string) {
  const b = store.bans[id];
  if (b?.email) delete store.bannedEmails[b.email];
  if (store.devices[id]) delete store.bannedDevices[store.devices[id]];
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

// ---- chat muting ----
export const MUTED_MESSAGE = 'Your chat has been turned off for breaking the game rules. You can still play.';
export const isMuted = (id: string | undefined | null) => !!id && !!store.muted[id];
export function mute(id: string, name: string, reason: string, auto = false) {
  store.muted[id] = { name, reason: String(reason || '').slice(0, 200), at: Date.now(), ...(auto ? { auto: true } : {}) };
  save();
}
export function unmute(id: string) { delete store.muted[id]; save(); strikes.delete(id); }
export const listMuted = () => Object.entries(store.muted).map(([id, m]) => ({ id, ...m })).sort((a, b) => b.at - a.at);

/** Foul language is starred out; three offences within 10 minutes turn the player's chat off and send the owner a report. */
const strikes = new Map<string, number[]>();
export function strike(id: string, name: string, said: string): boolean {
  const now = Date.now();
  const list = [...(strikes.get(id) ?? []).filter((t) => now - t < 600_000), now];
  strikes.set(id, list);
  if (list.length < 3) return false;
  mute(id, name, 'Automatic: repeated foul language', true);
  if (!store.reports.some((x) => x.byId === 'system' && x.targetId === id && now - x.at < 3600_000)) {
    store.reports.unshift({ n: store.nextReport++, at: now, byId: 'system', byName: 'Automatic filter', targetId: id, targetName: name, reason: 'Foul language', note: `Chat turned off after repeated foul language. Last message: ${said}`.slice(0, 300) });
    store.reports = store.reports.slice(0, 500);
  }
  save();
  return true;
}

// ---- devices: a suspended player can't just make a new account from the same browser ----
/** Remembers which browser (a random cookie the server hands out) an account was used from. */
export function noteDevice(id: string, dev: string) {
  if (!id || !dev || store.devices[id] === dev) return;
  store.devices[id] = dev;
  if (store.bans[id]) store.bannedDevices[dev] = true;
  save();
}
export const isDeviceBanned = (dev: string) => !!dev && !!store.bannedDevices[dev];

/** Account deletion: drop the chat mute and the device link. The suspension itself (name, email, reason) is kept so it cannot be dodged by deleting. */
export function forget(id: string) {
  delete store.muted[id];
  if (!store.bans[id]) delete store.devices[id];
  save();
}
