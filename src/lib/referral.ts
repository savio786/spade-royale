// Invite friends: your invite link, the share message, and collecting the coins you and your friends earn.
// A friend who opens your link (…/?ref=CODE) and plays their first game earns coins for both of you.
import { useSyncExternalStore } from 'react';
import { serverOrigin } from './config';
import { fmt, profile } from './profile';
import { toast } from './toast';
import { sfx } from './sound';
import { pullGuestProgress } from './guest';
import { syncPurchases } from './payments';

const REF_KEY = 'spade-haven-ref';
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

/** Remember the invite code from the link the player arrived with (…/?ref=CODE), then tidy the address bar. */
export function captureRef() {
  try {
    const url = new URL(window.location.href);
    const code = (url.searchParams.get('ref') || '').toUpperCase();
    if (!url.searchParams.has('ref')) return;
    if (/^[A-Z0-9]{4,10}$/.test(code) && !read(REF_KEY)) write(REF_KEY, code);
    url.searchParams.delete('ref');
    history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
  } catch { /* ignore */ }
}

/** True when this device arrived through a friend's invite link that hasn't been rewarded yet. */
export const hasInvite = () => !!read(REF_KEY);

export interface RefInfo { code: string; count: number; earned: number; pending: number; max: number; inviterCoins: number; friendCoins: number; inviterChatDays: number }
let info: RefInfo | null = null;
let failed = false;
const subs = new Set<() => void>();
const setInfo = (i: RefInfo | null, f = false) => { info = i; failed = f; subs.forEach((fn) => fn()); };
export const useReferral = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => info);
/** True when the invite link could not be loaded (the server is unreachable or asleep): the screen offers "Try again". */
export const useReferralFailed = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => failed);

async function call<T>(path: string, body: object): Promise<T | null> {
  const base = serverOrigin();
  if (!base) return null;
  try {
    const r = await fetch(`${base}/api/referral/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch { return null; }
}
const me = () => { const p = profile.get(); return p.guestKey ? { id: p.id, key: p.guestKey } : null; };

/** Loads your invite code and how many friends have joined. */
export async function loadReferral() {
  if (failed) setInfo(info, false);
  if (!me()) await pullGuestProgress();            // an older guest that was never registered with the server
  for (let i = 0; i < 3; i++) {                    // the free server can take a few seconds to wake up
    const a = me();
    const r = a && (await call<RefInfo>('info', a));
    if (r) { setInfo(r); return; }
    if (i < 2) await new Promise((res) => setTimeout(res, 2500));
  }
  if (!info) setInfo(null, true);
}

let retries = 0;
/** Redeems the invite this device arrived with (once the player has played a game) and collects any waiting coins. */
export async function syncReferral() {
  const a = me();
  if (!a) return;
  const code = read(REF_KEY);
  if (code && profile.get().stats.played >= 1) {
    const r = await call<{ ok: boolean; retry?: boolean; reason?: string }>('redeem', { ...a, code });
    if (r && (r.ok || !r.retry)) write(REF_KEY, null);
    else if (r?.retry && retries++ < 4) setTimeout(() => void syncReferral(), 20_000); // the game result is still being saved
  }
  const got = await call<{ coins: number; chatDays?: number }>('collect', a);
  if (got && (got.coins > 0 || (got.chatDays ?? 0) > 0)) {
    if (got.coins > 0) profile.addCoins(got.coins);
    if (got.chatDays) void syncPurchases();       // the server already extended the Chat Pass; this brings it to the device
    toast(`${got.coins > 0 ? `+${fmt(got.coins)} coins` : 'Invite reward'}${got.chatDays ? ` and ${got.chatDays} days of free chat` : ''} — invite reward!`, 'coins');
    sfx.coins();
    void loadReferral();
  }
}

export const inviteLink = (code: string) => `${window.location.origin}/?ref=${code}`;
export const inviteText = (code: string) =>
  `Come play Spades with me on Spade Haven — free online Spades with live tables, tournaments and chat. Use my link and we both get bonus coins: ${inviteLink(code)}`;
