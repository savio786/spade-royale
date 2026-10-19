// Store purchases. On the website, buying goes through Stripe Checkout and the purchase is delivered when the
// player returns. If Stripe isn't configured on the server nothing can be bought (free test purchases only
// happen on a local development build).
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
  } else if (p.kind === 'vip') {
    profile.set((x) => { const vipUntil = Math.max(x.vipUntil, Date.now()) + p.vipDays! * 864e5; return { vipUntil, vip: true }; });
    toast('Welcome to the VIP Club!');
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
/** Free, instant purchases: only on a local development build, never on the live site or in the apps. */
const devTest = () => !!import.meta.env?.DEV && !Capacitor.isNativePlatform();
export async function loadPaymentConfig() {
  const base = apiBase();
  if (!base || Capacitor.isNativePlatform()) return; // native apps must use Google Play / Apple billing (see README)
  try {
    const r = await fetch(`${base}/api/payments`);
    if (!r.ok) return;
    realPayments = !!(await r.json()).enabled;
    // the server is sure nothing has ever been paid: remove anything handed out by the old free test store
    if (!realPayments && !devTest()) revokeUnpaid();
  } catch { /* offline: keep what we have until the server can confirm */ }
}
function revokeUnpaid() {
  const p = profile.get();
  if (p.chatUntil || p.vip || p.vipUntil) profile.set({ chatUntil: 0, vip: false, vipUntil: 0 });
}
export const isTestMode = () => !realPayments && devTest();
export const paymentsReady = () => realPayments;
/** The Android/iPhone apps may only sell through Google Play / Apple billing. Until that is connected, buying is switched off in the apps. */
export const nativeStoreOff = () => Capacitor.isNativePlatform() || import.meta.env?.VITE_NATIVE_STORE === 'play';

export async function buy(productId: string): Promise<void> {
  const p = productById(productId);
  if (!p) return;
  if (nativeStoreOff()) { toast('Purchases in the app are coming soon'); return; }
  if (!realPayments) {
    if (devTest()) { apply(p); return; } // local development only
    toast('Purchases are not available yet — check back soon', 'error');
    return;
  }
  const base = apiBase()!;
  try {
    const returnUrl = `${window.location.origin}${window.location.pathname}`; // no #hash: the payment page adds ?purchase=… (and PayPal ?token=…)
    const r = await fetch(`${base}/api/checkout`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productId, playerId: profile.get().id, returnUrl }) });
    const j = await r.json();
    if (!r.ok || !j.url) throw new Error(j.error || 'Checkout is unavailable');
    window.location.href = j.url; // PayPal or Stripe checkout page
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
    const j = (await r.json()) as { grants: { productId: string }[]; chatUntil: number; vipUntil?: number };
    for (const g of j.grants) { const p = productById(g.productId); if (p && p.kind === 'coins') apply(p); }
    // the server's record of what was paid is the truth for Chat Pass and VIP
    const vipUntil = j.vipUntil ?? 0, vip = vipUntil === -1 || vipUntil > Date.now(), cur = profile.get();
    if (cur.chatUntil !== j.chatUntil || cur.vipUntil !== vipUntil || cur.vip !== vip) profile.set({ chatUntil: j.chatUntil, vipUntil, vip });
    if (j.grants.some((g) => productById(g.productId)?.kind === 'chat')) toast('Chat unlocked');
    if (j.grants.some((g) => productById(g.productId)?.kind === 'vip')) toast('Welcome to the VIP Club!');
    return j.grants.length;
  } catch { return 0; }
}

/** After returning from Stripe, the webhook can take a few seconds: check a few times. */
export async function afterCheckoutReturn() {
  const q = new URLSearchParams(window.location.search);
  const status = q.get('purchase');
  if (!status) return;
  history.replaceState(null, '', window.location.pathname + (window.location.hash || '#play'));
  if (status === 'cancel') { toast('Purchase cancelled'); return; }
  if (status === 'paypal') {
    // the player approved on PayPal: the server now takes the payment and records it
    const orderId = q.get('token') || '';
    toast('Confirming your PayPal payment…');
    try {
      const r = await fetch(`${apiBase()}/api/paypal/capture`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { toast(j.error || 'The payment did not go through. You have not been charged.', 'error'); return; }
    } catch { toast('Could not reach the game server. If you were charged, your purchase will appear shortly.', 'error'); return; }
  } else toast('Payment received — adding it to your account…');
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
