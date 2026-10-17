// Real payments on the website through Stripe Checkout (no SDK needed).
// Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to switch them on; without them the store runs in test mode.
// Purchases are recorded here and handed to the player's device the next time it checks in.
import { createHmac, timingSafeEqual } from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';
import { productById } from '../shared/products';

const KEY = process.env.STRIPE_SECRET_KEY || '';
const WH_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
export const paymentsEnabled = () => !!KEY && !!WH_SECRET;

interface Grant { session: string; playerId: string; productId: string; at: number; claimed: boolean }
interface Store { grants: Grant[]; chatUntil: Record<string, number> } // chatUntil: ms epoch, -1 = lifetime

const DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const FILE = join(DIR, 'purchases.json');
let store: Store = { grants: [], chatUntil: {} };
try { if (existsSync(FILE)) store = { ...store, ...JSON.parse(readFileSync(FILE, 'utf8')) }; } catch { /* start empty */ }
function save() {
  try { mkdirSync(DIR, { recursive: true }); writeFileSync(FILE + '.tmp', JSON.stringify(store)); renameSync(FILE + '.tmp', FILE); }
  catch (e) { console.error('purchases save failed', e); }
}

/** Server-side truth for chat when real payments are on. */
export function hasChatPass(playerId: string) {
  const u = store.chatUntil[playerId];
  return u === -1 || (typeof u === 'number' && u > Date.now());
}

export async function createCheckout(productId: string, playerId: string, returnUrl: string): Promise<string> {
  const p = productById(productId);
  if (!p) throw new Error('Unknown product');
  const form = new URLSearchParams({
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(p.priceCents),
    'line_items[0][price_data][product_data][name]': `Spade Royale — ${p.name}`,
    client_reference_id: playerId,
    'metadata[playerId]': playerId,
    'metadata[productId]': p.id,
    success_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}purchase=success`,
    cancel_url: `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}purchase=cancel`,
  });
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
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
  if (!playerId || !p || store.grants.some((g) => g.session === s.id)) return 200;
  store.grants.push({ session: s.id, playerId, productId, at: Date.now(), claimed: false });
  if (p.kind === 'chat') {
    const cur = store.chatUntil[playerId] ?? 0;
    store.chatUntil[playerId] = p.chatDays === 0 || cur === -1 ? -1 : Math.max(cur, Date.now()) + p.chatDays! * 864e5;
  }
  save();
  return 200;
}

/** Hands over purchases the device hasn't received yet (each only once). */
export function claim(playerId: string) {
  const out = store.grants.filter((g) => g.playerId === playerId && !g.claimed);
  if (!out.length) return { grants: [], chatUntil: store.chatUntil[playerId] ?? 0 };
  out.forEach((g) => (g.claimed = true));
  save();
  return { grants: out.map((g) => ({ productId: g.productId, session: g.session })), chatUntil: store.chatUntil[playerId] ?? 0 };
}
