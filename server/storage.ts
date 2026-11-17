// Where the server keeps the leaderboard and purchase records.
// - With UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set: a free Upstash Redis database
//   (survives restarts on Render's free plan).
// - Otherwise: JSON files in DATA_DIR (default ./data) — fine locally or with a Render disk.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';

// tolerate values pasted with quotes, spaces or a "Bearer " prefix
const clean = (v: string | undefined) => (v || '').trim().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '').trim();
// also tolerate "UPSTASH_REDIS_REST_URL=https://…" pasted whole, quotes inside, and an address without https://
const stripName = (v: string) => clean(v.replace(/^\s*(export\s+)?UPSTASH_REDIS_REST_(URL|TOKEN)\s*[=:]\s*/i, ''));
const fixUrl = (v: string) => { const u = stripName(v).replace(/\s+/g, '').replace(/\/+$/, ''); return !u ? '' : /^https?:\/\//i.test(u) ? u : `https://${u}`; };
const UP_URL = fixUrl(process.env.UPSTASH_REDIS_REST_URL || '');
const UP_TOKEN = stripName(process.env.UPSTASH_REDIS_REST_TOKEN || '').replace(/\s+/g, '');
const DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
export const storageKind = UP_URL && UP_TOKEN ? 'upstash' : 'files';
if (storageKind === 'upstash') {
  // masked fingerprint so a wrong value can be spotted without printing the secret
  let host = UP_URL; try { host = new URL(UP_URL).host; } catch { /* keep raw */ }
  console.log(`upstash: database ${host} · token ${UP_TOKEN.length} chars, ${UP_TOKEN.slice(0, 4)}…${UP_TOKEN.slice(-4)}`);
}

async function redis(cmd: unknown[]) {
  const r = await fetch(UP_URL, { method: 'POST', headers: { authorization: `Bearer ${UP_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = (await r.json()) as { result?: unknown; error?: string };
  if (!r.ok || j.error) throw new Error(j.error || `Upstash HTTP ${r.status}`);
  return j.result;
}

export async function loadJSON<T>(name: string, fallback: T): Promise<T> {
  try {
    if (storageKind === 'upstash') {
      const v = await redis(['GET', `spade-royale:${name}`]);
      return typeof v === 'string' ? { ...fallback, ...JSON.parse(v) } : fallback;
    }
    const f = join(DIR, `${name}.json`);
    return existsSync(f) ? { ...fallback, ...JSON.parse(readFileSync(f, 'utf8')) } : fallback;
  } catch (e) {
    console.error(`could not load ${name}, starting empty`, e);
    return fallback;
  }
}

/** Debounced save: many quick changes become one write. */
const timers = new Map<string, ReturnType<typeof setTimeout>>();
export function saveJSON(name: string, get: () => unknown) {
  if (timers.has(name)) return;
  timers.set(name, setTimeout(async () => {
    timers.delete(name);
    const data = JSON.stringify(get());
    try {
      if (storageKind === 'upstash') await redis(['SET', `spade-royale:${name}`, data]);
      else {
        mkdirSync(DIR, { recursive: true });
        const f = join(DIR, `${name}.json`);
        writeFileSync(f + '.tmp', data);
        renameSync(f + '.tmp', f);
      }
    } catch (e) { console.error(`could not save ${name}`, e); }
  }, 400));
}

/** Reads one record; null when it doesn't exist. Throws if storage is unreachable. */
export async function getRecord<T>(name: string): Promise<T | null> {
  if (storageKind === 'upstash') {
    const v = await redis(['GET', `spade-royale:${name}`]);
    return typeof v === 'string' ? (JSON.parse(v) as T) : null;
  }
  const f = join(DIR, `${name}.json`);
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as T) : null;
}

/** Writes one record immediately. */
export async function putRecord(name: string, data: unknown) {
  const s = JSON.stringify(data);
  if (storageKind === 'upstash') { await redis(['SET', `spade-royale:${name}`, s]); return; }
  mkdirSync(DIR, { recursive: true });
  const f = join(DIR, `${name}.json`);
  writeFileSync(f + '.tmp', s);
  renameSync(f + '.tmp', f);
}

/** Atomic counter (unique guest numbers). */
export async function nextNumber(name: string): Promise<number> {
  if (storageKind === 'upstash') return Number(await redis(['INCR', `spade-royale:${name}`]));
  const cur = (await getRecord<{ n: number }>(name))?.n ?? 0;
  await putRecord(name, { n: cur + 1 });
  return cur + 1;
}

/** Every record whose name starts with `prefix` (for example "acct-"). Used by the owner-only admin page. */
export async function listRecords<T>(prefix: string): Promise<T[]> {
  if (storageKind === 'upstash') {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const r = (await redis(['SCAN', cursor, 'MATCH', `spade-royale:${prefix}*`, 'COUNT', 500])) as [string, string[]];
      cursor = String(r[0]); keys.push(...r[1]);
    } while (cursor !== '0');
    const out: T[] = [];
    for (let i = 0; i < keys.length; i += 100) {
      const vals = (await redis(['MGET', ...keys.slice(i, i + 100)])) as (string | null)[];
      for (const v of vals) if (typeof v === 'string') { try { out.push(JSON.parse(v) as T); } catch { /* skip a broken record */ } }
    }
    return out;
  }
  const { readdirSync } = await import('fs');
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR).filter((f) => f.startsWith(prefix) && f.endsWith('.json')).flatMap((f) => { try { return [JSON.parse(readFileSync(join(DIR, f), 'utf8')) as T]; } catch { return []; } });
}

/** Removes one record (nothing happens if it is not there). */
export async function deleteRecord(name: string) {
  if (storageKind === 'upstash') { await redis(['DEL', `spade-royale:${name}`]); return; }
  const f = join(DIR, `${name}.json`);
  const { unlinkSync } = await import('fs');
  try { if (existsSync(f)) unlinkSync(f); } catch { /* already gone */ }
}

/** Every record in storage as { name: value }, for the owner's backup download. Profile photos are left out unless asked for. */
export async function exportAll(withPhotos = false): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const keep = (name: string) => withPhotos || !name.startsWith('photo-');
  if (storageKind === 'upstash') {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const r = (await redis(['SCAN', cursor, 'MATCH', 'spade-royale:*', 'COUNT', 500])) as [string, string[]];
      cursor = String(r[0]); keys.push(...r[1]);
    } while (cursor !== '0');
    const names = keys.map((k) => k.slice('spade-royale:'.length)).filter(keep);
    for (let i = 0; i < names.length; i += 100) {
      const part = names.slice(i, i + 100);
      const vals = (await redis(['MGET', ...part.map((n) => `spade-royale:${n}`)])) as (string | null)[];
      part.forEach((n, j) => { const v = vals[j]; if (typeof v === 'string') { try { out[n] = JSON.parse(v); } catch { out[n] = v; } } });
    }
    return out;
  }
  const { readdirSync } = await import('fs');
  if (!existsSync(DIR)) return out;
  for (const f of readdirSync(DIR)) {
    if (!f.endsWith('.json')) continue;
    const n = f.slice(0, -5);
    if (!keep(n)) continue;
    try { out[n] = JSON.parse(readFileSync(join(DIR, f), 'utf8')); } catch { /* skip a broken file */ }
  }
  return out;
}


// ---- coin balances: atomic, so two devices (or two requests) can never spend the same coins twice ----
// Upstash: INCRBY and one small Lua script. Local files (development): one process, so a promise chain is enough.
const WALLET_PREFIX = 'wbal-';
let chain: Promise<unknown> = Promise.resolve();
const serial = <T,>(fn: () => Promise<T>): Promise<T> => { const r = chain.then(fn, fn); chain = r.catch(() => undefined); return r; };
const wkey = (id: string) => `spade-royale:${WALLET_PREFIX}${id}`;
const TAKE = "local v=tonumber(redis.call('GET',KEYS[1]) or '0'); local n=tonumber(ARGV[1]); if v>=n then return redis.call('DECRBY',KEYS[1],n) else return -1 end";
const TAKE_UP_TO = "local v=tonumber(redis.call('GET',KEYS[1]) or '0'); local n=math.min(v,tonumber(ARGV[1])); if n>0 then return redis.call('DECRBY',KEYS[1],n) else return v end";
const fileBal = async (id: string) => (await getRecord<number>(`${WALLET_PREFIX}${id}`)) ?? null;

/** The stored balance, or null when this player has no wallet yet. */
export async function walletRead(id: string): Promise<number | null> {
  if (storageKind === 'upstash') { const v = await redis(['GET', wkey(id)]); return v === null || v === undefined ? null : Number(v); }
  return fileBal(id);
}
/** Creates the wallet with `start` coins only if there isn't one. Returns the balance either way. */
export async function walletCreate(id: string, start: number): Promise<number> {
  const n = Math.max(0, Math.round(start));
  if (storageKind === 'upstash') { await redis(['SETNX', wkey(id), n]); return Number(await redis(['GET', wkey(id)])); }
  return serial(async () => { const cur = await fileBal(id); if (cur !== null) return cur; await putRecord(`${WALLET_PREFIX}${id}`, n); return n; });
}
/** Adds (or removes, if negative) coins without any check. Returns the new balance. */
export async function walletAdd(id: string, n: number): Promise<number> {
  const d = Math.round(n);
  if (storageKind === 'upstash') return Number(await redis(['INCRBY', wkey(id), d]));
  return serial(async () => { const v = Math.max(0, (await fileBal(id) ?? 0) + d); await putRecord(`${WALLET_PREFIX}${id}`, v); return v; });
}
/** Takes exactly `n` coins if the player has them: the new balance, or -1 when they don't. */
export async function walletTake(id: string, n: number): Promise<number> {
  const d = Math.max(0, Math.round(n));
  if (storageKind === 'upstash') return Number(await redis(['EVAL', TAKE, 1, wkey(id), d]));
  return serial(async () => { const v = await fileBal(id) ?? 0; if (v < d) return -1; await putRecord(`${WALLET_PREFIX}${id}`, v - d); return v - d; });
}
/** Takes up to `n` coins (never below zero). Returns the new balance. */
export async function walletTakeUpTo(id: string, n: number): Promise<number> {
  const d = Math.max(0, Math.round(n));
  if (storageKind === 'upstash') return Number(await redis(['EVAL', TAKE_UP_TO, 1, wkey(id), d]));
  return serial(async () => { const v = await fileBal(id) ?? 0; const t = Math.min(v, d); if (t > 0) await putRecord(`${WALLET_PREFIX}${id}`, v - t); return v - t; });
}

/** Every wallet balance (for the owner's review before the switch is turned on, and for the count of coins in play). */
export async function walletList(): Promise<{ id: string; coins: number }[]> {
  if (storageKind === 'upstash') {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const r = (await redis(['SCAN', cursor, 'MATCH', `spade-royale:${WALLET_PREFIX}*`, 'COUNT', 500])) as [string, string[]];
      cursor = String(r[0]); keys.push(...r[1]);
    } while (cursor !== '0');
    const out: { id: string; coins: number }[] = [];
    for (let i = 0; i < keys.length; i += 100) {
      const vals = (await redis(['MGET', ...keys.slice(i, i + 100)])) as (string | null)[];
      vals.forEach((v, k) => { if (v !== null && v !== undefined) out.push({ id: keys[i + k].slice(`spade-royale:${WALLET_PREFIX}`.length), coins: Number(v) }); });
    }
    return out;
  }
  const { readdirSync } = await import('fs');
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR).filter((f) => f.startsWith(WALLET_PREFIX) && f.endsWith('.json')).flatMap((f) => { try { return [{ id: f.slice(WALLET_PREFIX.length, -5), coins: Number(JSON.parse(readFileSync(join(DIR, f), 'utf8'))) }]; } catch { return []; } });
}

/** Removes every wallet (used when the switch is turned on, so each player starts again from their saved account). */
export async function walletClearAll(): Promise<number> {
  const all = await walletList();
  if (storageKind === 'upstash') { for (let i = 0; i < all.length; i += 100) await redis(['DEL', ...all.slice(i, i + 100).map((w) => wkey(w.id))]); return all.length; }
  for (const w of all) await deleteRecord(`${WALLET_PREFIX}${w.id}`);
  return all.length;
}
