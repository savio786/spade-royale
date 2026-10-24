// Real payments on the website through PayPal Checkout or Stripe Checkout (no SDKs needed).
// PayPal: set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET (and PAYPAL_ENV=sandbox while testing).
// Stripe: set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET. If both are set, PayPal is used.
// Without either, nothing can be bought
// (ALLOW_TEST_PURCHASES=1 lets a local test server accept free chat passes).
// Purchases are recorded here and handed to the player's device the next time it checks in.
import { createHmac, timingSafeEqual } from 'crypto';
import { loadJSON, saveJSON } from './storage';
import { productById } from '../shared/products';

const KEY = (process.env.STRIPE_SECRET_KEY || '').trim();
const STRIPE_BASE = (process.env.STRIPE_API_BASE || 'https://api.stripe.com').replace(/\/+$/, '');
const WH_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const stripeOn = () => /^(sk|rk)_(live|test)_/.test(KEY); // the webhook secret is optional: payments are confirmed when the player returns
const PP_ID = process.env.PAYPAL_CLIENT_ID || '';
const PP_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PP_BASE = (process.env.PAYPAL_API_BASE || (process.env.PAYPAL_ENV === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com')).replace(/\/+$/, '');
const paypalOn = () => !!PP_ID && !!PP_SECRET;
export const paymentProvider = (): 'paypal' | 'stripe' | null => (stripeOn() ? 'stripe' : paypalOn() ? 'paypal' : null);
export const paymentsEnabled = () => paymentProvider() !== null;

interface Grant { session: string; playerId: string; productId: string; at: number; claimed: boolean }
interface Store { grants: Grant[]; chatUntil: Record<string, number>; vipUntil: Record<string, number> } // ms epoch, -1 = lifetime

let store: Store = { grants: [], chatUntil: {}, vipUntil: {} };
export async function initPayments() { store = { ...store, ...(await loadJSON('purchases', store)) }; store.vipUntil ??= {}; }
const save = () => saveJSON('purchases', () => store);

/** Server-side truth for chat when real payments are on. */
const active = (u: number | undefined) => u === -1 || (typeof u === 'number' && u > Date.now());
export const isVip = (playerId: string) => active(store.vipUntil[playerId]);
/** A paid Chat Pass, or VIP membership (which includes chat). */
export function hasChatPass(playerId: string) {
  return active(store.chatUntil[playerId]) || isVip(playerId);
}

/** Free Chat Pass days (invite rewards): adds to whatever the player already has. */
export function grantChatDays(playerId: string, days: number) {
  const cur = store.chatUntil[playerId] ?? 0;
  if (cur === -1) return;
  store.chatUntil[playerId] = Math.max(cur, Date.now()) + days * 864e5;
  save();
}

const backTo = (returnUrl: string, status: string) => `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}purchase=${status}`;

export async function createCheckout(productId: string, playerId: string, returnUrl: string): Promise<string> {
  const p = productById(productId);
  if (!p) throw new Error('Unknown product');
  if (!/^https?:\/\/[^\s]+$/.test(returnUrl) || !playerId) throw new Error('Bad request');
  if (paymentProvider() === 'paypal') return paypalCheckout(p.id, playerId, returnUrl);
  const form = new URLSearchParams({
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(p.priceCents),
    'line_items[0][price_data][product_data][name]': `Spade Haven — ${p.name}`,
    client_reference_id: playerId,
    'metadata[playerId]': playerId,
    'metadata[productId]': p.id,
    success_url: backTo(returnUrl, 'success') + '&session_id={CHECKOUT_SESSION_ID}',
    cancel_url: backTo(returnUrl, 'cancel'),
  });
  const r = await fetch(`${STRIPE_BASE}/v1/checkout/sessions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const j = (await r.json()) as { url?: string; error?: { message: string } };
  if (!r.ok || !j.url) throw new Error(j.error?.message || 'Stripe checkout failed');
  return j.url;
}

/** Verifies Stripe's signature, then records a paid checkout. Returns an HTTP status. */
export function handleWebhook(raw: string, sigHeader: string | undefined): number {
  if (!WH_SECRET || !sigHeader) return 400;
  const parts = Object.fromEntries(sigHeader.split(',').map((kv) => kv.split('=') as [string, string]));
  const t = parts.t, v1 = parts.v1;
  if (!t || !v1 || Math.abs(Date.now() / 1000 - Number(t)) > 300) return 400;
  const expected = createHmac('sha256', WH_SECRET).update(`${t}.${raw}`).digest('hex');
  if (expected.length !== v1.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(v1))) return 400;

  const event = JSON.parse(raw);
  if (event.type !== 'checkout.session.completed') return 200;
  const s = event.data.object;
  if (s.payment_status !== 'paid') return 200;
  const playerId = s.metadata?.playerId, productId = s.metadata?.productId;
  const p = productById(productId);
  if (!playerId || !p) return 200;
  record(s.id, playerId, p.id);
  return 200;
}

function record(session: string, playerId: string, productId: string) {
  const p = productById(productId);
  if (!p || store.grants.some((g) => g.session === session)) return;
  store.grants.push({ session, playerId, productId, at: Date.now(), claimed: false });
  if (p.kind === 'chat') {
    const cur = store.chatUntil[playerId] ?? 0;
    store.chatUntil[playerId] = p.chatDays === 0 || cur === -1 ? -1 : Math.max(cur, Date.now()) + p.chatDays! * 864e5;
  }
  if (p.kind === 'vip') {
    const cur = store.vipUntil[playerId] ?? 0;
    store.vipUntil[playerId] = cur === -1 ? -1 : Math.max(cur, Date.now()) + p.vipDays! * 864e5;
  }
  save();
}

/** After the player returns from Stripe Checkout: ask Stripe whether that session was paid, and record it once. */
export async function stripeConfirm(sessionId: string): Promise<{ ok: boolean; pending?: boolean; error?: string }> {
  if (!stripeOn() || !/^cs_(live|test)_[A-Za-z0-9]{10,200}$/.test(sessionId)) return { ok: false, error: 'Bad request' };
  if (store.grants.some((g) => g.session === sessionId)) return { ok: true };
  const r = await fetch(`${STRIPE_BASE}/v1/checkout/sessions/${sessionId}`, { headers: { authorization: `Bearer ${KEY}` } });
  const s = (await r.json().catch(() => ({}))) as any;
  if (!r.ok) { console.warn('stripe confirm', r.status, s.error?.message); return { ok: false, error: 'Could not check the payment with Stripe' }; }
  if (s.payment_status !== 'paid') return { ok: false, pending: s.status === 'complete', error: 'The payment has not completed' };
  const p = productById(s.metadata?.productId);
  const playerId = s.metadata?.playerId;
  if (!p || !playerId || s.currency !== 'usd' || s.amount_total !== p.priceCents) { console.warn('stripe: session did not match a product', sessionId); return { ok: false, error: 'The payment could not be matched to an item' }; }
  record(s.id, playerId, p.id);
  return { ok: true };
}

// ---------- PayPal ----------
let ppToken = { value: '', until: 0 };
async function paypalToken() {
  if (ppToken.value && ppToken.until > Date.now() + 60_000) return ppToken.value;
  const r = await fetch(`${PP_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { authorization: 'Basic ' + Buffer.from(`${PP_ID}:${PP_SECRET}`).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const j = (await r.json()) as { access_token?: string; expires_in?: number };
  if (!r.ok || !j.access_token) throw new Error('PayPal is unavailable right now');
  ppToken = { value: j.access_token, until: Date.now() + (j.expires_in ?? 300) * 1000 };
  return ppToken.value;
}
async function pp(path: string, init: { method: string; body?: unknown; requestId?: string }) {
  const headers: Record<string, string> = { authorization: `Bearer ${await paypalToken()}`, 'content-type': 'application/json' };
  if (init.requestId) headers['PayPal-Request-Id'] = init.requestId;
  const r = await fetch(`${PP_BASE}${path}`, { method: init.method, headers, body: init.body ? JSON.stringify(init.body) : undefined });
  return { ok: r.ok, status: r.status, j: (await r.json().catch(() => ({}))) as any };
}
const usd = (cents: number) => (cents / 100).toFixed(2);

async function paypalCheckout(productId: string, playerId: string, returnUrl: string) {
  const p = productById(productId)!;
  const { ok, j } = await pp('/v2/checkout/orders', {
    method: 'POST',
    body: {
      intent: 'CAPTURE',
      purchase_units: [{ reference_id: p.id, custom_id: `${playerId}|${p.id}`, description: `Spade Haven — ${p.name}`, amount: { currency_code: 'USD', value: usd(p.priceCents) } }],
      payment_source: { paypal: { experience_context: { brand_name: 'Spade Haven', shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW', return_url: backTo(returnUrl, 'paypal'), cancel_url: backTo(returnUrl, 'cancel') } } },
    },
  });
  const link = (j.links as { rel: string; href: string }[] | undefined)?.find((l) => l.rel === 'payer-action' || l.rel === 'approve');
  if (!ok || !link) throw new Error(j.message || 'PayPal checkout failed');
  return link.href;
}

/** After the player approves on PayPal: take the money (server side), check it, and record the purchase once. */
export async function paypalCapture(orderId: string): Promise<{ ok: boolean; error?: string }> {
  if (!paypalOn() || !/^[A-Z0-9-]{5,40}$/i.test(orderId)) return { ok: false, error: 'Bad request' };
  if (store.grants.some((g) => g.session === `pp:${orderId}`)) return { ok: true }; // already delivered
  let { ok, status, j } = await pp(`/v2/checkout/orders/${orderId}/capture`, { method: 'POST', requestId: `cap-${orderId}` });
  if (!ok && status === 422) ({ ok, j } = await pp(`/v2/checkout/orders/${orderId}`, { method: 'GET' })); // e.g. captured on an earlier try
  if (!ok || j.status !== 'COMPLETED') return { ok: false, error: 'The payment was not completed' };
  const unit = j.purchase_units?.[0];
  const cap = unit?.payments?.captures?.[0];
  const [playerId, productId] = String(cap?.custom_id || unit?.custom_id || '').split('|');
  const p = productById(productId);
  if (!p || !playerId || cap?.status !== 'COMPLETED' || cap.amount?.currency_code !== 'USD' || cap.amount?.value !== usd(p.priceCents)) {
    console.warn('paypal: capture did not match a product', orderId);
    return { ok: false, error: 'The payment could not be matched to an item' };
  }
  record(`pp:${orderId}`, playerId, p.id);
  return { ok: true };
}

/** Hands over purchases the device hasn't received yet (each only once). */
export function claim(playerId: string) {
  const out = store.grants.filter((g) => g.playerId === playerId && !g.claimed);
  const paid = { chatUntil: store.chatUntil[playerId] ?? 0, vipUntil: store.vipUntil[playerId] ?? 0 };
  if (!out.length) return { grants: [], ...paid };
  out.forEach((g) => (g.claimed = true));
  save();
  return { grants: out.map((g) => ({ productId: g.productId, session: g.session })), ...paid };
}
