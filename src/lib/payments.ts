// Store purchases. On the website with Stripe configured on the server, buying goes through Stripe Checkout
// and the purchase is delivered when the player returns. Otherwise the store runs in test mode (instant, free).
import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { serverOrigin } from './config';
import { Product, productById } from '../../shared/products';
import { profile, Profile, fmt } from './profile';
import { toast } from './toast';
import { sfx } from './sound';

const apiBase = serverOrigin;

// ---------- chat pass ----------
export const canChat = (p: Profile) => p.vip || p.chatUntil === -1 || p.chatUntil > Date.now();
export function chatPassLabel(p: Profile) {
  if (p.chatUntil === -1) return 'Lifetime Chat Pass';
  if (p.chatUntil > Date.now()) return `Chat Pass until ${new Date(p.chatUntil).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
  if (p.vip) return 'Chat included with VIP';
  return null;
}

function apply(p: Product) {
  if (p.kind === 'coins') {
    const bonus = profile.get().vip ? Math.round(p.coins! * 0.2) : 0;
    profile.addCoins(p.coins! + bonus);
    toast(`+${fmt(p.coins! + bonus)} coins`, 'coins');
  } else {
    profile.set((x) => ({
      chatUntil: p.chatDays === 0 || x.chatUntil === -1 ? -1 : Math.max(x.chatUntil, Date.now()) + p.chatDays! * 864e5,
    }));
    toast(p.chatDays === 0 ? 'Chat unlocked for life' : `Chat unlocked for ${p.chatDays} day${p.chatDays === 1 ? '' : 's'}`);
  }
  sfx.coins();
}

// ---------- mode ----------
let realPayments = false;
export async function loadPaymentConfig() {
  const base = apiBase();
  if (!base || Capacitor.isNativePlatform()) return; // native apps must use Google Play / Apple billing (see README)
  try { const r = await fetch(`${base}/api/payments`); realPayments = r.ok && !!(await r.json()).enabled; } catch { /* test mode */ }
}
export const isTestMode = () => !realPayments;

export async function buy(productId: string): Promise<void> {
  const p = productById(productId);
  if (!p) return;
  if (!realPayments) { apply(p); return; } // test mode
  const base = apiBase()!;
  try {
    const returnUrl = `${window.location.origin}${window.location.pathname}#play`;
    const r = await fetch(`${base}/api/checkout`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productId, playerId: profile.get().id, returnUrl }) });
    const j = await r.json();
    if (!r.ok || !j.url) throw new Error(j.error || 'Checkout is unavailable');
    window.location.href = j.url; // Stripe Checkout
  } catch (e) {
    toast((e as Error).message || 'Checkout is unavailable right now', 'error');
  }
}

/** Collects purchases paid on Stripe and applies them to this device. */
export async function syncPurchases() {
  const base = apiBase();
  if (!base || !realPayments) return 0;
  try {
    const r = await fetch(`${base}/api/purchases?id=${encodeURIComponent(profile.get().id)}`);
    if (!r.ok) return 0;
    const j = (await r.json()) as { grants: { productId: string }[]; chatUntil: number };
    for (const g of j.grants) { const p = productById(g.productId); if (p && p.kind === 'coins') apply(p); }
    if (j.chatUntil) profile.set({ chatUntil: j.chatUntil });
    if (j.grants.some((g) => productById(g.productId)?.kind === 'chat')) toast('Chat unlocked');
    return j.grants.length;
  } catch { return 0; }
}

/** After returning from Stripe, the webhook can take a few seconds: check a few times. */
export async function afterCheckoutReturn() {
  const q = new URLSearchParams(window.location.search);
  const status = q.get('purchase');
  if (!status) return;
  history.replaceState(null, '', window.location.pathname + window.location.hash);
  if (status === 'cancel') { toast('Purchase cancelled'); return; }
  toast('Payment received — adding it to your account…');
  for (let i = 0; i < 6; i++) {
    if ((await syncPurchases()) > 0) return;
    await new Promise((r) => setTimeout(r, 2500));
  }
  toast('Your purchase is still processing. It will appear the next time you open the game.');
}

// ---------- store opener (any screen can ask for the store) ----------
export interface StoreRequest { tab: 'coins' | 'chat'; need?: number }
let req: StoreRequest | null = null;
const subs = new Set<() => void>();
export const store = {
  open(r: StoreRequest = { tab: 'coins' }) { req = r; subs.forEach((f) => f()); },
  close() { req = null; subs.forEach((f) => f()); },
};
export function useStoreRequest() {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => req);
}
