// Invite friends: every player has a short invite code. A friend who joins with it and plays their first game
// earns coins for both of them. Rewards are held here until each device collects them (same idea as purchases).
// Limits (so it can't be farmed): one reward per new player, never your own code, at most MAX_INVITES rewards per
// inviter, at most IP_PER_DAY rewards per network per day, and the new player's account must be under a week old.
import { randomBytes } from 'crypto';
import { getRecord, loadJSON, saveJSON } from './storage';
import { Account, acctKey } from './accounts';

export const INVITER_COINS = 15_000;   // for the player who shared the link
export const FRIEND_COINS = 10_000;    // for the friend who joined
export const MAX_INVITES = 20;         // rewarded invites per player
const IP_PER_DAY = 5;
const NEW_PLAYER_MS = 7 * 24 * 3600e3;

interface Store {
  codes: Record<string, string>;                 // invite code -> player id
  byPlayer: Record<string, string>;              // player id -> invite code
  redeemed: Record<string, string>;              // friend id -> inviter id (each friend counts once)
  stats: Record<string, { count: number; earned: number }>;
  pending: Record<string, number>;               // coins waiting to be collected
  ips: Record<string, { day: string; n: number }>;
}
let store: Store = { codes: {}, byPlayer: {}, redeemed: {}, stats: {}, pending: {}, ips: {} };
export async function initReferrals() { store = { ...store, ...(await loadJSON('referrals', store)) }; }
const save = () => saveJSON('referrals', () => store);

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from(randomBytes(6), (b) => ALPHA[b % ALPHA.length]).join('');
export const validCode = (c: unknown): c is string => typeof c === 'string' && /^[A-Z0-9]{4,10}$/.test(c);

async function authed(id: unknown, key: unknown) {
  const pid = String(id || '').slice(0, 64), k = String(key || '').slice(0, 80);
  if (!pid || !k) return null;
  const a = await getRecord<Account>(acctKey(pid));
  return a && a.key === k ? a : null;
}

/** Your invite code (made the first time you ask), how many friends joined, and any coins waiting for you. */
export async function referralInfo(id: unknown, key: unknown) {
  const a = await authed(id, key);
  if (!a) return null;
  let code = store.byPlayer[a.id];
  if (!code) {
    do { code = newCode(); } while (store.codes[code]);
    store.codes[code] = a.id; store.byPlayer[a.id] = code; save();
  }
  const s = store.stats[a.id] ?? { count: 0, earned: 0 };
  return { code, count: s.count, earned: s.earned, pending: store.pending[a.id] ?? 0, max: MAX_INVITES, inviterCoins: INVITER_COINS, friendCoins: FRIEND_COINS };
}

export type RedeemResult =
  | { ok: true }
  | { ok: false; retry: boolean; reason: string };   // retry = try again later (e.g. hasn't played a game yet); otherwise give up

/** A new player used someone's invite link and has now played a game: reward both. */
export async function redeemInvite(id: unknown, key: unknown, code: unknown, ip: string): Promise<RedeemResult> {
  const a = await authed(id, key);
  if (!a) return { ok: false, retry: false, reason: 'auth' };
  if (store.redeemed[a.id]) return { ok: false, retry: false, reason: 'already' };
  const c = String(code || '').toUpperCase();
  const inviterId = validCode(c) ? store.codes[c] : undefined;
  if (!inviterId) return { ok: false, retry: false, reason: 'unknown-code' };
  if (inviterId === a.id) return { ok: false, retry: false, reason: 'own-code' };
  if (Date.now() - a.createdAt > NEW_PLAYER_MS) return { ok: false, retry: false, reason: 'not-new' };
  const played = Number((a.profile as { stats?: { played?: number } } | null)?.stats?.played) || 0;
  if (played < 1) return { ok: false, retry: true, reason: 'play-first' };
  const inviter = await getRecord<Account>(acctKey(inviterId));
  if (!inviter) return { ok: false, retry: false, reason: 'unknown-code' };
  const s = store.stats[inviterId] ?? { count: 0, earned: 0 };
  if (s.count >= MAX_INVITES) return { ok: false, retry: false, reason: 'inviter-full' };
  const day = new Date().toISOString().slice(0, 10);
  const slot = store.ips[ip] && store.ips[ip].day === day ? store.ips[ip] : { day, n: 0 };
  if (slot.n >= IP_PER_DAY) return { ok: false, retry: false, reason: 'too-many' };
  slot.n++; store.ips[ip] = slot;
  if (Object.keys(store.ips).length > 5000) for (const k of Object.keys(store.ips)) if (store.ips[k].day !== day) delete store.ips[k];

  store.redeemed[a.id] = inviterId;
  store.stats[inviterId] = { count: s.count + 1, earned: s.earned + INVITER_COINS };
  store.pending[inviterId] = (store.pending[inviterId] ?? 0) + INVITER_COINS;
  store.pending[a.id] = (store.pending[a.id] ?? 0) + FRIEND_COINS;
  save();
  return { ok: true };
}

/** Hands over (once) the coins waiting for this player. */
export async function collectReferralCoins(id: unknown, key: unknown) {
  const a = await authed(id, key);
  if (!a) return null;
  const coins = store.pending[a.id] ?? 0;
  if (coins > 0) { delete store.pending[a.id]; save(); }
  return { coins };
}
