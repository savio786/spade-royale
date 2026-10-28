// Crows Haven weekly ranking (Vercel function at /api/crows-rank). Spades doesn't use this file: Render runs server/.
// Storage: an Upstash Redis database connected to the crows-haven Vercel project
// (Vercel → Storage → Upstash for Redis). Vercel then sets KV_REST_API_URL / KV_REST_API_TOKEN
// (or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN). Without them the ranking reports "not set up yet".
//
// Weeks start Sunday 00:00 UTC (same as Spades). Ranking: games won this week, then points scored.
// Results come from the player's browser (there is no game server), so a determined cheater could fake them;
// each player id is tied to a secret kept on their device, and results are rate-limited and sanity-checked.

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const configured = () => !!(URL_ && TOKEN);

type Cmd = (string | number)[];
async function redis(cmds: Cmd[]): Promise<unknown[]> {
  const r = await fetch(`${URL_}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(cmds) });
  if (!r.ok) throw new Error(`storage ${r.status}`);
  const out = (await r.json()) as { result?: unknown; error?: string }[];
  return out.map((x) => { if (x.error) throw new Error(x.error); return x.result; });
}

export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() - t.getUTCDay());
  return t.toISOString().slice(0, 10);
}
const weekEndsAt = (d = new Date()) => new Date(weekKey(d) + 'T00:00:00Z').getTime() + 7 * 864e5;
const prevWeek = (d = new Date()) => weekKey(new Date(new Date(weekKey(d) + 'T00:00:00Z').getTime() - 864e5));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const clean = (s: unknown, max: number) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
const AVATAR_RE = /^(a|p|b|c|f|t)\d{1,3}$/;
const ID_RE = /^[\w-]{6,64}$/;
const WEEK_TTL = 60 * 864e2; // keep a week's data for 60 days

interface Row { id: string; name: string; avatar: string; wins: number; games: number; points: number }
const score = (wins: number, points: number) => wins * 1_000_000 + Math.max(0, Math.min(points, 999_999));

async function readWeek(week: string, top: number, me: string | null) {
  const [ids] = await redis([['ZREVRANGE', `crows:rank:${week}`, 0, top - 1]]) as [string[]];
  const cmds: Cmd[] = [];
  if (ids.length) cmds.push(['HMGET', `crows:players:${week}`, ...ids]);
  if (me) cmds.push(['ZREVRANK', `crows:rank:${week}`, me], ['HGET', `crows:players:${week}`, me]);
  const res = cmds.length ? await redis(cmds) : [];
  const rows: (Row & { rank: number })[] = ids.length
    ? (res[0] as (string | null)[]).map((v, i) => (v ? { rank: i + 1, ...(JSON.parse(v) as Row) } : null)).filter(Boolean) as (Row & { rank: number })[]
    : [];
  let mine: (Row & { rank: number }) | null = null;
  if (me) {
    const off = ids.length ? 1 : 0;
    const rank = res[off] as number | null, raw = res[off + 1] as string | null;
    if (rank !== null && raw) mine = { rank: rank + 1, ...(JSON.parse(raw) as Row) };
  }
  return { rows: rows.map(({ id: _id, ...r }) => r), me: mine ? (({ id: _id, ...r }) => r)(mine) : null };
}

/** GET /api/crows-rank?which=this|last&id=<player id> */
export async function GET(req: Request) {
  if (!configured()) return json({ configured: false });
  const u = new URL(req.url);
  const which = u.searchParams.get('which') === 'last' ? 'last' : 'this';
  const id = u.searchParams.get('id');
  const week = which === 'last' ? prevWeek() : weekKey();
  try {
    const data = await readWeek(week, 100, id && ID_RE.test(id) ? id : null);
    return json({ configured: true, week, endsAt: weekEndsAt(), ...data });
  } catch (e) { return json({ configured: true, error: (e as Error).message }, 502); }
}

/** POST /api/crows-rank  { id, secret, name, avatar, won, points } — one finished game. */
export async function POST(req: Request) {
  if (!configured()) return json({ configured: false });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: 'bad request' }, 400); }
  const id = clean(b.id, 64), secret = clean(b.secret, 128);
  if (!ID_RE.test(id) || secret.length < 16) return json({ error: 'bad player' }, 400);
  const name = clean(b.name, 24) || 'Player';
  const avatar = AVATAR_RE.test(String(b.avatar)) ? String(b.avatar) : '';
  const won = b.won === true;
  const points = Math.max(0, Math.min(2000, Math.round(Number(b.points) || 0))); // one game can't score more than this
  const week = weekKey();
  try {
    // the first result from an id claims it with this device's secret; later results must match
    const [claimed] = await redis([['SET', `crows:secret:${id}`, secret, 'NX']]);
    if (claimed === null) {
      const [stored] = await redis([['GET', `crows:secret:${id}`]]);
      if (stored !== secret) return json({ error: 'not your player' }, 403);
    }
    const [fresh] = await redis([['SET', `crows:limit:${id}`, '1', 'NX', 'EX', 120]]); // at most one game every 2 minutes per player
    if (fresh === null) return json({ ok: false, error: 'too soon' }, 429);
    const [raw] = await redis([['HGET', `crows:players:${week}`, id]]) as [string | null];
    const prev: Row = raw ? JSON.parse(raw) : { id, name, avatar, wins: 0, games: 0, points: 0 };
    const row: Row = { id, name, avatar, wins: prev.wins + (won ? 1 : 0), games: prev.games + 1, points: prev.points + points };
    await redis([
      ['HSET', `crows:players:${week}`, id, JSON.stringify(row)],
      ['ZADD', `crows:rank:${week}`, score(row.wins, row.points), id],
      ['EXPIRE', `crows:players:${week}`, WEEK_TTL],
      ['EXPIRE', `crows:rank:${week}`, WEEK_TTL],
    ]);
    const [rank] = await redis([['ZREVRANK', `crows:rank:${week}`, id]]) as [number];
    return json({ ok: true, rank: rank + 1, wins: row.wins, games: row.games, points: row.points });
  } catch (e) { return json({ error: (e as Error).message }, 502); }
}
