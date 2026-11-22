// Server-side coins. While the owner's switch is ON the server holds each player's real balance:
// the bet is taken when you sit down at an online table, the prize is paid when the game ends,
// and free coins (daily gift, spin, missions ...) are only paid out inside fixed limits.
// Nothing here is touched while a game is being played (bids and cards never go near the database).
import { savedCoins } from './accounts';
import { deleteRecord, getRecord, listRecords, putRecord, walletAdd, walletClearAll, walletList, walletCreate, walletRead, walletTake, walletTakeUpTo } from './storage';

const BOOT = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;   // tells this server run from an older one
let enabled = false;

export const walletOn = () => enabled;
export async function initWallet() {
  const cfg = await getRecord<{ enabled?: boolean }>('wallet-config').catch(() => null);
  enabled = !!cfg?.enabled;
  console.log(`wallet: ${enabled ? 'ON' : 'off'}`);
  // a server that was replaced during a game could not pay or refund: give those bets back once the old server is surely gone
  setTimeout(() => { void sweepEscrows().catch((e) => console.error('escrow sweep', e)); }, 150_000);
}
export async function setWalletOn(on: boolean) {
  // switching on starts everyone again from their saved account (what they won or lost while it was off is in there)
  if (on && !enabled) { const n = await walletClearAll(); console.log(`wallet: ${n} old balance(s) cleared; players start again from their saved accounts`); }
  enabled = on; await putRecord('wallet-config', { enabled: on, at: Date.now() }); console.log(`wallet: ${on ? 'ON' : 'off'}`); }

const MAX_SEED = 100_000;   // a player we have no saved account for starts from what their phone says, up to this much

/** The wallet for a player, created on first use from their saved account balance (the owner reviews the top ones before turning this on). */
export async function ensureWallet(id: string, saved: number | null, phone: number | null): Promise<number> {
  const have = await walletRead(id);
  if (have !== null) return have;
  const s = saved !== null && Number.isFinite(saved) ? Math.max(0, saved) : null;
  const p = phone !== null && Number.isFinite(phone) ? Math.max(0, phone) : null;
  // the phone's figure is freshest, but it can't run far ahead of the saved account (a little room for wins that had not synced yet, 50,000)
  const start = s !== null ? (p !== null ? Math.min(p, s + 50_000) : s) : Math.min(p ?? 50_000, MAX_SEED);
  return walletCreate(id, start);
}
export const balanceOf = (id: string) => walletRead(id);
/** Adds coins to a wallet, creating it from the saved account first if this is the player's first time. */
export async function addCoins(id: string, n: number) { await ensureWallet(id, await savedCoins(id).catch(() => null), null); return walletAdd(id, n); }
export const takeCoins = (id: string, n: number) => walletTake(id, n);
export const takeUpTo = (id: string, n: number) => walletTakeUpTo(id, n);

// one thing at a time per player, so two quick requests can't both pass the checks
const busy = new Map<string, Promise<unknown>>();
const alone = <T,>(id: string, fn: () => Promise<T>): Promise<T> => { const r = (busy.get(id) ?? Promise.resolve()).then(fn, fn); busy.set(id, r.catch(() => undefined)); return r; };
let closing = false;   // the server is shutting down: bets are being handed back, nothing else is paid
export const walletClosing = () => closing;

// ---- bets held while a game is on ----
interface Escrow { id: string; bet: number; tableId: string; ts: number; boot: string }
const checkedOld = new Set<string>();   // players whose old leftover bet was already looked for this run
const mine = new Map<string, number>();   // player id -> bet, for this server run (refunded on shutdown)

/** Takes the bet when the player sits down. Returns the new balance, -1 if they can't afford it, -2 if they already hold a seat at another table. */
export const escrowBet = (id: string, bet: number, tableId: string): Promise<number> => alone(id, async () => {
  if (closing) return -1;
  if (mine.has(id)) return -2;   // already holds a seat this server run
  // a leftover bet from a server that was replaced is looked for once per player per run (later sits skip the database read: anything held this run is in `mine`)
  if (!checkedOld.has(id)) {
    const old = await getRecord<Escrow>(`escrow-${id}`).catch(() => null);
    if (old && old.boot === BOOT && mine.has(id)) return -2;
    if (old) await walletAdd(id, old.bet);   // a leftover from a table that no longer exists
    checkedOld.add(id);
    if (checkedOld.size > 20_000) { checkedOld.clear(); checkedOld.add(id); }
  }
  const left = await walletTake(id, bet);
  if (left < 0) return -1;
  mine.set(id, bet);
  await putRecord(`escrow-${id}`, { id, bet, tableId, ts: Date.now(), boot: BOOT } satisfies Escrow);
  return left;
});
/** The player left before the game started (or the table vanished): the bet goes back. Returns the new balance, or null if nothing was held. */
export const refundEscrow = (id: string): Promise<number | null> => alone(id, async () => {
  const e = await getRecord<Escrow>(`escrow-${id}`).catch(() => null);
  mine.delete(id);
  if (!e) return null;
  await deleteRecord(`escrow-${id}`);
  return walletAdd(id, e.bet);
});
/** The game is over, or the player walked out of a game that had started: the bet is spent. */
export const settleEscrow = (id: string) => alone(id, async () => { mine.delete(id); await deleteRecord(`escrow-${id}`).catch(() => undefined); });
/** Server shutting down: give back every bet this run is holding, and pay nothing more. */
export async function refundAllMine(): Promise<string[]> {
  closing = true;
  const ids = [...mine.keys()];
  await Promise.allSettled(ids.map((id) => refundEscrow(id)));
  return ids;
}
async function sweepEscrows() {
  const old = (await listRecords<Escrow>('escrow-')).filter((e) => e && e.boot !== BOOT && Date.now() - e.ts > 120_000);
  for (const e of old) await refundEscrow(e.id);
  if (old.length) console.log(`wallet: refunded ${old.length} bet(s) from games that ended with a server restart`);
}

// ---- free coins: paid only inside these limits, so repeating a request earns nothing extra ----
const H = 3_600_000;
interface Rule { max: number; every?: number; once?: boolean; dated?: boolean }
const RULES: Record<string, Rule> = {
  daily: { max: 10_000, once: true, dated: true },        // the daily gift: once per calendar day
  bonus: { max: 200, every: 25 * 60_000 },                // the top-up every 30 minutes
  spin: { max: 10_000, every: 3.9 * H },                  // the wheel, every 4 hours
  mission: { max: 3_000, once: true, dated: true },       // each daily mission once per day
  achievement: { max: 50_000, once: true },               // each trophy once, ever
  weekly: { max: 50_000, once: true },                    // the weekly leaderboard prize, once per week
  tutorial: { max: 5_000, once: true },
};
interface Meta { last: Record<string, number>; keys: string[] }
const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);
/** A day name like 2026-11-15 is believable if it is yesterday, today or tomorrow somewhere on Earth. */
const plausibleDay = (key: string) => [-26 * H, 0, 26 * H].some((d) => key.startsWith(dayOf(Date.now() + d)));
/** Pays out free coins if the claim fits the rules. Returns the new balance, or a short reason it was refused. */
export function earn(id: string, kind: string, amount: number, key: string): Promise<{ coins: number } | { error: string }> {
  return alone(id, async () => {
    const r = RULES[kind];
    const n = Math.round(Number(amount));
    if (!r || !(n > 0) || n > r.max) return { error: 'That claim is not valid' };
    const k = `${kind}:${String(key)}`.slice(0, 60);
    if (r.dated && !plausibleDay(String(key))) return { error: 'That claim is not valid' };
    const name = `wmeta-${id}`;
    const m = (await getRecord<Meta>(name).catch(() => null)) ?? { last: {}, keys: [] };
    const now = Date.now();
    if (r.once && m.keys.includes(k)) return { error: 'Already claimed' };
    if (r.every && now - (m.last[kind] ?? 0) < r.every) return { error: 'Not ready yet' };
    if (r.once) m.keys = [...m.keys, k].slice(-300);
    m.last[kind] = now;
    await putRecord(name, m);
    return { coins: await walletAdd(id, n) };
  });
}

/** Spending coins on something the player picked (a gift for the table, an avatar part). Returns the new balance or null if they can't afford it. */
export async function spend(id: string, amount: number): Promise<number | null> {
  const n = Math.round(Number(amount));
  if (!(n > 0) || n > 5_000_000) return null;
  const left = await walletTake(id, n);
  return left < 0 ? null : left;
}

/** The biggest balances and the total, for the owner. Names come from saved accounts. */
export async function topBalances(limit = 25): Promise<{ total: number; players: number; top: { id: string; coins: number }[] }> {
  const all = await walletList();
  all.sort((a, b) => b.coins - a.coins);
  return { total: all.reduce((s, w) => s + w.coins, 0), players: all.length, top: all.slice(0, limit) };
}
