// One-off: wipe ALL Spade Haven data (leaderboard, Wall of Fame, accounts, names, friends, photos, purchases) before going live.
// Usage (from the project folder):
//   UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... node scripts/reset-data.mjs          → dry run: lists what would be deleted
//   UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... node scripts/reset-data.mjs --wipe   → backs up to a file, asks you to type RESET, then deletes
// Without the Upstash variables it works on the JSON files in DATA_DIR (default ./data) instead.
// Only keys starting with "spade-royale:" are touched. STOP the server (or expect it to re-save) — see the note printed at the end.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline/promises';

const clean = v => (v || '').trim().replace(/^["']|["']$/g, '').replace(/^Bearer\s+/i, '').trim();
const URL_ = clean(process.env.UPSTASH_REDIS_REST_URL).replace(/\/$/, ''), TOKEN = clean(process.env.UPSTASH_REDIS_REST_TOKEN);
const upstash = !!(URL_ && TOKEN), DIR = process.env.DATA_DIR || join(process.cwd(), 'data'), PFX = 'spade-royale:';
const wipe = process.argv.includes('--wipe');

const redis = async cmd => {
  const r = await fetch(URL_, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`); return j.result;
};

async function listKeys() {
  if (!upstash) return existsSync(DIR) ? readdirSync(DIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)) : [];
  const keys = []; let cur = '0';
  do { const [next, batch] = await redis(['SCAN', cur, 'MATCH', `${PFX}*`, 'COUNT', '500']); cur = String(next); keys.push(...batch.map(k => k.slice(PFX.length))); } while (cur !== '0');
  return [...new Set(keys)];
}
const group = k => k.split(/[-:]/)[0];

const keys = await listKeys();
const counts = {}; for (const k of keys) counts[group(k)] = (counts[group(k)] || 0) + 1;
console.log(`Storage: ${upstash ? 'Upstash ' + new URL(URL_).host : 'files in ' + DIR}`);
console.log(`${keys.length} records found:`); for (const [g, n] of Object.entries(counts).sort()) console.log(`  ${String(n).padStart(6)}  ${g}`);
if (!wipe) { console.log('\nDry run only, nothing deleted. Add --wipe to delete.'); process.exit(0); }
if (!keys.length) { console.log('Nothing to delete.'); process.exit(0); }

// 1. backup first, so a mistake can be undone
const stamp = new Date().toISOString().replace(/[:.]/g, '-'), backup = `spade-haven-backup-${stamp}.json`, dump = {};
for (const k of keys) dump[k] = upstash ? await redis(['GET', PFX + k]) : readFileSync(join(DIR, k + '.json'), 'utf8');
writeFileSync(backup, JSON.stringify(dump)); console.log(`\nBackup saved: ${join(process.cwd(), backup)}`);

// 2. explicit confirmation
const rl = createInterface({ input: process.stdin, output: process.stdout });
const ans = await rl.question(`Type RESET to permanently delete these ${keys.length} records: `); rl.close();
if (ans.trim() !== 'RESET') { console.log('Cancelled, nothing deleted.'); process.exit(1); }

// 3. delete
if (upstash) { for (let i = 0; i < keys.length; i += 100) await redis(['DEL', ...keys.slice(i, i + 100).map(k => PFX + k)]); }
else for (const k of keys) rmSync(join(DIR, k + '.json'), { force: true });
const left = await listKeys();
console.log(left.length ? `⚠ ${left.length} records remain` : `✓ Deleted ${keys.length} records. Database is empty.`);
console.log('Now restart the Render service so it forgets anything held in memory (otherwise it can re-save old leaderboard/purchase data).');
