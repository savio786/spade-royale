// Spade Royale multiplayer server: public tables, private tables with invite codes,
// table chat, bots filling empty seats, and turn timers. Run: npm run server
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname, normalize } from 'path';
import { TableRuntime } from '../shared/runtime';
import type { ClientMsg, PlayerHello, ServerMsg, TableSummary } from '../shared/protocol';
import { prizeFor, seatsOfSide, type Mode, type TableSettings } from '../shared/engine';
import { board, credit, initLeaderboard } from './leaderboard';
import { getRecord, putRecord, storageKind } from './storage';
import { createHash } from 'crypto';
import { createGuest, guestName, loadAccount, restoreByCode, saveProgress } from './accounts';
import { claim, createCheckout, handleWebhook, hasChatPass, initPayments, paymentsEnabled } from './payments';

const PORT = Number(process.env.PORT || 8787);
const DIST = join(process.cwd(), 'dist');
const PUBLIC_FILL_MS = Number(process.env.FILL_MS || 8000);
const TURN_MS = Number(process.env.TURN_MS || 12000);
const MAX_MISSED = Number(process.env.MAX_MISSED_TURNS || 3);

interface Room { id: string; code: string | null; hostId: string; rt: TableRuntime; clients: Set<Client>; createdAt: number }
interface Client { ws: WebSocket; player: PlayerHello | null; room: Room | null; unsub: (() => void) | null }

const rooms = new Map<string, Room>();
const clients = new Set<Client>();
let roomSeq = 0;

const send = (c: Client, m: ServerMsg) => { if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(m)); };

function onlineCounts(): Record<Mode, number> & { total: number } {
  // real people only: seated humans per mode, plus everyone connected
  const o = { solo: 0, partners: 0, total: 0 };
  for (const r of rooms.values()) o[r.rt.g.settings.mode] += r.rt.humanCount();
  for (const c of clients) if (c.player) o.total++;
  return o;
}

function summaries(): TableSummary[] {
  return [...rooms.values()]
    .filter((r) => !r.code)
    .map((r) => ({ id: r.id, settings: r.rt.g.settings, players: r.rt.g.seats.filter(Boolean).length, humans: r.rt.humanCount(), phase: r.rt.g.phase }));
}

function sanitize(s: TableSettings): TableSettings {
  const mode: Mode = s.mode === 'solo' ? 'solo' : 'partners';
  const bet = Math.max(100, Math.min(10_000_000, Math.round(Number(s.bet) || 100)));
  const maxPoints = [100, 150, 200, 250, 300, 350, 400, 500].includes(s.maxPoints) ? s.maxPoints : 100;
  const minPoints = [-100, -150, -200, -250, -300].includes(s.minPoints) ? s.minPoints : -100;
  return { mode, bet, maxPoints, minPoints, city: String(s.city || 'New York').slice(0, 24), isPrivate: !!s.isPrivate };
}

function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  do { c = Array.from({ length: 5 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while ([...rooms.values()].some((r) => r.code === c));
  return c;
}

function createRoom(settings: TableSettings, hostId: string, isPrivate: boolean): Room {
  const id = `t${++roomSeq}`;
  const rt = new TableRuntime({ ...settings, isPrivate }, {
    fillBotsAfterMs: isPrivate ? null : PUBLIC_FILL_MS, turnTimeoutMs: TURN_MS, maxMissedTurns: MAX_MISSED,
    onInactive: (_seat, playerId) => {
      for (const c of room.clients) if (c.player?.id === playerId) {
        send(c, { t: 'kicked', reason: `You missed ${MAX_MISSED} turns this game, so you were disconnected from the table.` });
        leave(c, false);
      }
    },
  });
  const room: Room = { id, code: isPrivate ? makeCode() : null, hostId, rt, clients: new Set(), createdAt: Date.now() };
  rooms.set(id, room);
  rt.onGameOver = (g) => {
    // credit real winners on the weekly leaderboard (server-authoritative for online games)
    const prize = prizeFor(g.settings);
    for (const side of g.winners) for (const seat of seatsOfSide(g.settings.mode, side)) {
      const s = g.seats[seat];
      if (s && !s.bot) credit(s, prize);
    }
    setTimeout(() => { if (room.clients.size === 0) closeRoom(room); }, 60_000);
  };
  return room;
}

function closeRoom(r: Room) { r.rt.destroy(); rooms.delete(r.id); }

function seatClient(c: Client, room: Room) {
  if (!c.player) return send(c, { t: 'error', message: 'Say hello first' });
  leave(c, false);
  const seat = room.rt.addHuman(c.player);
  if (seat < 0) return send(c, { t: 'error', message: 'Table is full or already started' });
  c.room = room;
  room.clients.add(c);
  send(c, { t: 'joined', tableId: room.id, seat, code: room.code, host: room.hostId === c.player.id, settings: room.rt.g.settings });
  c.unsub = room.rt.subscribe(c.player.id, seat, (snap) => send(c, { t: 'snap', snap }));
}

function leave(c: Client, notify = true) {
  const r = c.room;
  if (!r) return;
  c.unsub?.(); c.unsub = null;
  r.clients.delete(c);
  if (c.player) r.rt.removeHuman(c.player.id);
  c.room = null;
  if (r.rt.humanCount() === 0) closeRoom(r);
  if (notify) send(c, { t: 'left' });
}

function handle(c: Client, m: ClientMsg) {
  switch (m.t) {
    case 'hello':
      c.player = { id: String(m.player.id).slice(0, 64), name: String(m.player.name || 'Player').slice(0, 20), avatar: cleanAvatar(m.player.avatar), level: Number(m.player.level) || 1, chat: !!m.player.chat };
      guestName(c.player.id).then((n) => { if (n && c.player) c.player.name = n; });
      return send(c, { t: 'welcome', online: onlineCounts() });
    case 'list':
      return send(c, { t: 'tables', tables: summaries(), online: onlineCounts() });
    case 'quick': {
      const s = sanitize(m.settings);
      const match = [...rooms.values()].find((r) => !r.code && r.rt.g.phase === 'waiting' && r.rt.g.seats.some((x) => !x) &&
        r.rt.g.settings.mode === s.mode && r.rt.g.settings.bet === s.bet && r.rt.g.settings.maxPoints === s.maxPoints && r.rt.g.settings.minPoints === s.minPoints);
      return seatClient(c, match ?? createRoom(s, c.player?.id ?? '', false));
    }
    case 'join': {
      const r = rooms.get(m.tableId);
      if (!r || r.code) return send(c, { t: 'error', message: 'Table not found' });
      return seatClient(c, r);
    }
    case 'createPrivate':
      if (!c.player) return;
      return seatClient(c, createRoom(sanitize({ ...m.settings, isPrivate: true }), c.player.id, true));
    case 'joinPrivate': {
      const r = [...rooms.values()].find((x) => x.code === String(m.code).toUpperCase().trim());
      if (!r) return send(c, { t: 'error', message: 'No table with that code' });
      return seatClient(c, r);
    }
    case 'fillBots':
      if (c.room && c.player && c.room.hostId === c.player.id) c.room.rt.fillWithBots(400);
      return;
    case 'act': {
      if (!c.room || !c.player) return;
      const seat = c.room.rt.g.seats.findIndex((s) => s?.id === c.player!.id);
      const err = c.room.rt.act(seat, m.action);
      if (err) send(c, { t: 'error', message: err });
      return;
    }
    case 'chat': {
      if (!c.room || !c.player) return;
      const isGift = String(m.text).startsWith('🎁:');
      // sending messages needs a Chat Pass (verified purchases when Stripe is on, otherwise the device's test-mode pass)
      const allowed = isGift || (paymentsEnabled() ? hasChatPass(c.player.id) : !!c.player.chat);
      if (!allowed) return send(c, { t: 'error', message: 'Get a Chat Pass to send messages' });
    }
      return c.room.rt.say(c.room.rt.g.seats.findIndex((s) => s?.id === c.player!.id), m.text);
    case 'leave':
      return leave(c);
  }
}

/** Only built-in avatar keys or uploaded photo ids are passed on to other players. */
function cleanAvatar(v: unknown) { const s = String(v ?? ''); return /^(a\d{1,2}|p\d{1,2}|u:[a-f0-9]{24})$/.test(s) ? s : 'a1'; }

// ---- profile photos ----
const photoCache = new Map<string, Buffer>();
const photoTries = new Map<string, { n: number; t: number }>();
async function photoApi(req: import('http').IncomingMessage, res: import('http').ServerResponse, url: URL) {
  try {
    if (req.method === 'POST' && url.pathname === '/api/photo') {
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      const t = photoTries.get(ip); const now = Date.now();
      if (t && now - t.t < 3_600_000 && t.n >= 10) return json(res, 429, { error: 'Too many uploads — try again later.' });
      photoTries.set(ip, t && now - t.t < 3_600_000 ? { n: t.n + 1, t: t.t } : { n: 1, t: now });
      const b = JSON.parse(await readBody(req, 60_000));
      const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.data || ''));
      if (!m) return json(res, 400, { error: 'Please choose a picture file.' });
      const buf = Buffer.from(m[1], 'base64');
      if (buf.length > 40_000 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return json(res, 400, { error: 'That picture could not be used.' });
      const id = createHash('sha256').update(buf).digest('hex').slice(0, 24);
      if (!photoCache.has(id)) { await putRecord(`photo-${id}`, m[1]); photoCache.set(id, buf); }
      return json(res, 200, { id });
    }
    const g = /^\/api\/photo\/([a-f0-9]{24})$/.exec(url.pathname);
    if (req.method === 'GET' && g) {
      let buf = photoCache.get(g[1]);
      if (!buf) { const b64 = await getRecord<string>(`photo-${g[1]}`); if (b64) { buf = Buffer.from(b64, 'base64'); if (photoCache.size > 800) photoCache.delete(photoCache.keys().next().value as string); photoCache.set(g[1], buf); } }
      if (!buf) return json(res, 404, { error: 'not found' });
      res.writeHead(200, { 'content-type': 'image/jpeg', 'content-length': buf.length, 'cache-control': 'public, max-age=31536000, immutable', 'access-control-allow-origin': '*', 'x-content-type-options': 'nosniff' });
      return res.end(buf);
    }
    return json(res, 404, { error: 'not found' });
  } catch (e) { console.error('photo', e); return json(res, 500, { error: 'Upload failed — please try again.' }); }
}

// ---- static hosting of the built app (optional, for one-box deployment) ----
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
// ---- leaderboard API ----
const lastReport = new Map<string, number>();
function json(res: import('http').ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}
function api(req: import('http').IncomingMessage, res: import('http').ServerResponse) {
  const url = new URL(req.url || '/', 'http://x');
  if (req.method === 'OPTIONS') return json(res, 204, null);
  if (url.pathname.startsWith('/api/guest')) return guestApi(req, res, url);
  if (url.pathname.startsWith('/api/photo')) return photoApi(req, res, url);
  if (req.method === 'GET' && url.pathname === '/api/payments') return json(res, 200, { enabled: paymentsEnabled() });
  if (req.method === 'GET' && url.pathname === '/api/purchases') return json(res, 200, claim(String(url.searchParams.get('id') || '').slice(0, 64)));
  if (req.method === 'POST' && (url.pathname === '/api/checkout' || url.pathname === '/api/stripe-webhook')) {
    let raw = '';
    req.on('data', (d) => { raw += d; if (raw.length > 200_000) req.destroy(); });
    req.on('end', async () => {
      if (url.pathname === '/api/stripe-webhook') { const code = handleWebhook(raw, req.headers['stripe-signature'] as string | undefined); return json(res, code, { received: code === 200 }); }
      if (!paymentsEnabled()) return json(res, 503, { error: 'Payments are not set up yet' });
      try {
        const b = JSON.parse(raw);
        const checkoutUrl = await createCheckout(String(b.productId), String(b.playerId).slice(0, 64), String(b.returnUrl || ''));
        return json(res, 200, { url: checkoutUrl });
      } catch (e) { return json(res, 400, { error: (e as Error).message }); }
    });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/leaderboard') return json(res, 200, board(url.searchParams.get('id') || undefined));
  if (req.method === 'POST' && url.pathname === '/api/report') {
    // results of games played against bots in the browser (online games are credited by the server itself)
    let raw = '';
    req.on('data', (d) => { raw += d; if (raw.length > 2000) req.destroy(); });
    req.on('end', () => {
      try {
        const b = JSON.parse(raw);
        const id = String(b.id || '').slice(0, 64);
        const bet = Number(b.bet), prize = Number(b.prize);
        const mode: Mode = b.mode === 'solo' ? 'solo' : 'partners';
        const max = prizeFor({ mode, bet }) * 1.1 + 1;
        const now = Date.now();
        if (!id || !(bet >= 100 && bet <= 5_000_000) || !(prize > 0 && prize <= max)) return json(res, 400, { error: 'invalid result' });
        if (now - (lastReport.get(id) ?? 0) < 30_000) return json(res, 429, { error: 'too many reports' });
        lastReport.set(id, now);
        guestName(id).then((gn) => credit({ id, name: gn || String(b.name || 'Player'), avatar: cleanAvatar(b.avatar) }, prize));
        return json(res, 200, { ok: true });
      } catch { return json(res, 400, { error: 'bad json' }); }
    });
    return;
  }
  return json(res, 404, { error: 'not found' });
}

// ---- guest accounts ----
const restoreTries = new Map<string, { n: number; t: number }>();
function readBody(req: import('http').IncomingMessage, max = 40_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (d) => { raw += d; if (raw.length > max) { req.destroy(); reject(new Error('too large')); } });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}
async function guestApi(req: import('http').IncomingMessage, res: import('http').ServerResponse, url: URL) {
  try {
    if (req.method === 'POST' && url.pathname === '/api/guest') {
      const b = JSON.parse((await readBody(req)) || '{}');
      const adopt = b.adoptId ? { id: String(b.adoptId).slice(0, 64), name: String(b.name || '') } : undefined;
      const a = await createGuest(adopt);
      return a ? json(res, 200, a) : json(res, 409, { error: 'This player is already registered' });
    }
    if (req.method === 'GET' && url.pathname === '/api/guest') {
      const a = await loadAccount(String(url.searchParams.get('id') || ''), String(url.searchParams.get('key') || ''));
      return a ? json(res, 200, a) : json(res, 404, { error: 'Guest account not found' });
    }
    if (req.method === 'PUT' && url.pathname === '/api/guest') {
      const b = JSON.parse(await readBody(req));
      const r = await saveProgress(String(b.id), String(b.key), b.profile || {}, Number(b.updatedAt) || 0);
      return json(res, r.status, r.ok ? { ok: true } : { error: r.status === 409 ? 'newer progress on server' : 'not allowed', account: 'account' in r ? r.account : undefined });
    }
    if (req.method === 'POST' && url.pathname === '/api/guest/restore') {
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0];
      const t = restoreTries.get(ip);
      const now = Date.now();
      if (t && now - t.t < 60_000 && t.n >= 10) return json(res, 429, { error: 'Too many tries. Wait a minute and try again.' });
      restoreTries.set(ip, t && now - t.t < 60_000 ? { n: t.n + 1, t: t.t } : { n: 1, t: now });
      const b = JSON.parse(await readBody(req));
      const a = await restoreByCode(String(b.code || ''));
      return a ? json(res, 200, a) : json(res, 404, { error: 'No guest account with that code' });
    }
    return json(res, 404, { error: 'not found' });
  } catch (e) {
    console.error('guest api', e);
    return json(res, 500, { error: 'Guest accounts are unavailable right now' });
  }
}

const http = createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200); return res.end('ok'); }
  if (req.url?.startsWith('/api/')) return api(req, res);
  if (!existsSync(DIST)) { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('Spade Royale server running. Build the client (npm run build) to serve it here.'); }
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = normalize(join(DIST, urlPath));
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});

const wss = new WebSocketServer({ server: http, path: '/ws' });
wss.on('connection', (ws) => {
  const c: Client = { ws, player: null, room: null, unsub: null };
  clients.add(c);
  ws.on('message', (raw) => {
    try { handle(c, JSON.parse(String(raw))); } catch (e) { send(c, { t: 'error', message: 'Bad message' }); }
  });
  ws.on('close', () => { leave(c, false); clients.delete(c); });
});

Promise.all([initLeaderboard(), initPayments()]).then(() => {
  http.listen(PORT, () => console.log(`Spade Royale server on http://localhost:${PORT} (ws path /ws) · storage: ${storageKind}`));
});

// Render's free plan sleeps after 15 idle minutes; with KEEP_AWAKE=1 the server visits itself every 10 minutes.
const SELF_URL = process.env.RENDER_EXTERNAL_URL;
if (process.env.KEEP_AWAKE === '1' && SELF_URL) {
  setInterval(() => { fetch(`${SELF_URL}/health`).catch(() => {}); }, 10 * 60_000);
  console.log(`keep-awake on: pinging ${SELF_URL}/health every 10 minutes`);
}
