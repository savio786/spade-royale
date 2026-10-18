// Where the server keeps the leaderboard and purchase records.
// - With UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set: a free Upstash Redis database
//   (survives restarts on Render's free plan).
// - Otherwise: JSON files in DATA_DIR (default ./data) — fine locally or with a Render disk.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';

// tolerate values pasted with quotes, spaces or a "Bearer " prefix
const clean = (v: string | undefined) => (v || '').trim().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '').trim();
const UP_URL = clean(process.env.UPSTASH_REDIS_REST_URL).replace(/\/$/, '');
const UP_TOKEN = clean(process.env.UPSTASH_REDIS_REST_TOKEN);
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
