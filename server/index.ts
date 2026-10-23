// Spade Haven multiplayer server: public tables, private tables with invite codes,
// table chat, bots filling empty seats, and turn timers. Run: npm run server
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname, normalize } from 'path';
import { TableRuntime } from '../shared/runtime';
import { isFreeChat } from '../shared/chat';
import type { ClientMsg, PlayerHello, ServerMsg, TableSummary } from '../shared/protocol';
import { CITIES, prizeFor, seatsOfSide, type Mode, type PublicStats, type TableSettings } from '../shared/engine';
import { board, credit, initLeaderboard, touch } from './leaderboard';
import { getRecord, putRecord, storageKind } from './storage';
import { createHash } from 'crypto';
import { checkName, createGuest, guestName, loadAccount, renameAccount, restoreByCode, saveProgress, verifyKey } from './accounts';
import * as friends from './friends';
import { AuthError, authConfig, changePassword, facebookSignIn, googleSignIn, signIn, signUp } from './auth';
import { claim, createCheckout, handleWebhook, hasChatPass, initPayments, paymentProvider, paymentsEnabled, paypalCapture, stripeConfirm } from './payments';

const PORT = Number(process.env.PORT || 8787);
const DIST = join(process.cwd(), 'dist');
// Public tables wait this long for real people before computer players take the empty seats.
const PUBLIC_FILL_MS = Number(process.env.FILL_MS || 15_000);
const TURN_MS = Number(process.env.TURN_MS || 12000);
const MAX_MISSED = Number(process.env.MAX_MISSED_TURNS || 3);

interface Room { id: string; code: string | null; hostId: string; rt: TableRuntime; clients: Set<Client>; createdAt: number; away?: Map<string, ReturnType<typeof setTimeout>> }
/** A player whose connection drops mid-game keeps their seat this long (the turn timer plays for them meanwhile). */
const REJOIN_MS = 45_000;
/** verified = the connection proved it owns the account (key), which friends need; auth = that check in progress */
interface Client { ws: WebSocket; player: PlayerHello | null; room: Room | null; unsub: (() => void) | null; verified: boolean; auth: Promise<void> | null; fops: number[]; gifts: number[] }

const rooms = new Map<string, Room>();
const clients = new Set<Client>();
let roomSeq = 0;

const send = (c: Client, m: ServerMsg) => { if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(m)); };

// ---- friends: who is online, and keeping everyone's friends screen up to date ----
const isOnline = (id: string) => { for (const c of clients) if (c.verified && c.player?.id === id) return true; return false; };
async function pushSocial(id: string) {
  const targets = [...clients].filter((c) => c.verified && c.player?.id === id);
  if (!targets.length) return;
  try { const v = await friends.view(id, isOnline); for (const c of targets) send(c, { t: 'social', ...v }); } catch (e) { console.error('friends view', e); }
}
/** This player came online or went offline: their friends and people with open requests see it straight away. */
async function presenceChanged(id: string) {
  try { for (const r of await friends.relatives(id)) void pushSocial(r); } catch (e) { console.error('friends presence', e); }
}
async function friendOp(c: Client, m: ClientMsg) {
  try {
    await c.auth;
    const id = c.player?.id;
    if (!c.verified || !id) return send(c, { t: 'friendMsg', ok: false, message: 'Continue as a guest or sign in to use friends.' });
    const now = Date.now();
    c.fops = c.fops.filter((t) => now - t < 60_000);
    if (c.fops.length >= 15) return send(c, { t: 'friendMsg', ok: false, message: 'Slow down a little — try again in a minute.' });
    c.fops.push(now);
    let r: friends.Result;
    if (m.t === 'friendRequest') r = await friends.request(id, { name: m.name === undefined ? undefined : String(m.name).slice(0, 40), id: m.id === undefined ? undefined : String(m.id).slice(0, 64) });
    else if (m.t === 'friendRespond') r = await friends.respond(id, String(m.id).slice(0, 64), !!m.accept);
    else if (m.t === 'friendRemove') r = await friends.remove(id, String(m.id).slice(0, 64));
    else if (m.t === 'friendCancel') r = await friends.cancel(id, String(m.id).slice(0, 64));
    else return;
    send(c, { t: 'friendMsg', ok: r.ok, message: r.message });
    for (const n of r.notes) for (const x of clients) if (x.verified && x.player?.id === n.to) send(x, { t: 'friendMsg', ok: true, message: n.text });
    for (const t of new Set(r.touched)) void pushSocial(t);
  } catch (e) {
    console.error('friends', e);
    send(c, { t: 'friendMsg', ok: false, message: 'Friends are unavailable right now. Please try again.' });
  }
}

function onlineCounts(): Record<Mode, number> & { total: number; lobby: number } {
  // real people only: seated humans per mode, people in the lobby (connected, not at a table), and everyone connected
  const o = { solo: 0, partners: 0, total: 0, lobby: 0 };
  for (const r of rooms.values()) o[r.rt.g.settings.mode] += r.rt.humanCount();
  const ids = new Set<string>(), lobby = new Set<string>();
  for (const c of clients) if (c.player) { ids.add(c.player.id); if (!c.room) lobby.add(c.player.id); }
  o.total = ids.size; o.lobby = lobby.size;
  return o;
}

function summaries(): TableSummary[] {
  return [...rooms.values()]
    .filter((r) => !r.code && r.rt.humanCount() > 0 && r.rt.g.phase !== 'gameOver') // only tables with real people
    .map((r) => ({
      id: r.id, settings: r.rt.g.settings, players: r.rt.g.seats.filter(Boolean).length, humans: r.rt.humanCount(), phase: r.rt.g.phase,
      seats: r.rt.g.seats.map((s) => (s ? { name: s.name, avatar: s.avatar, bot: !!s.bot, level: s.level } : null)),
    }));
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

function closeRoom(r: Room) { r.rt.destroy(); rooms.delete(r.id); for (const t of r.away?.values() ?? []) clearTimeout(t); }

/** Connection dropped: during a game hold the seat for a while so the player can come back. */
function dropped(c: Client) {
  const r = c.room, id = c.player?.id;
  const phase = r?.rt.g.phase;
  if (!r || !id || phase === 'waiting' || phase === 'gameOver') return leave(c, false);
  c.unsub?.(); c.unsub = null; r.clients.delete(c); c.room = null;
  r.away ??= new Map();
  clearTimeout(r.away.get(id));
  r.away.set(id, setTimeout(() => {
    r.away?.delete(id);
    if (![...r.clients].some((x) => x.player?.id === id)) { r.rt.removeHuman(id); if (r.rt.humanCount() === 0) closeRoom(r); }
  }, REJOIN_MS));
}

/** A returning player takes their seat back. */
function rejoin(c: Client, tableId: string) {
  const r = rooms.get(String(tableId)), id = c.player?.id;
  const seat = r && id ? r.rt.g.seats.findIndex((s) => s?.id === id && !s.bot) : -1;
  if (!r || !id || seat < 0) return send(c, { t: 'tableGone' });
  clearTimeout(r.away?.get(id)); r.away?.delete(id);
  for (const other of [...r.clients]) if (other !== c && other.player?.id === id) { other.unsub?.(); r.clients.delete(other); other.room = null; }
  c.room = r; r.clients.add(c);
  send(c, { t: 'joined', tableId: r.id, seat, code: r.code, host: r.hostId === id, settings: r.rt.g.settings });
  c.unsub = r.rt.subscribe(id, seat, (snap) => send(c, { t: 'snap', snap }));
}

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
    case 'hello': {
      const prevId = c.player?.id;
      const p: PlayerHello = { id: String(m.player.id).slice(0, 64), name: String(m.player.name || 'Player').slice(0, 20), avatar: cleanAvatar(m.player.avatar), level: Number(m.player.level) || 1, chat: !!m.player.chat, stats: cleanStats(m.player.stats) };
      c.player = p;
      c.verified = false;
      guestName(p.id).then((n) => { if (n && c.player === p) p.name = n; if (c.player === p) touch(p); });
      // friends need proof that this connection owns the account: its secret key (never shared with other players)
      const key = String(m.key ?? '').slice(0, 80);
      const auth = (async () => {
        const accountName = key ? await verifyKey(p.id, key) : null;
        if (!accountName || c.player !== p) return;
        p.name = accountName;
        await friends.registerPlayer(p.id, { name: p.name, avatar: p.avatar, level: p.level, coins: p.stats?.coins ?? 0 });
        if (c.player !== p) return;
        c.verified = true;
        void pushSocial(p.id);
        void presenceChanged(p.id);
      })().catch((e) => console.error('friends sign-in', e));
      c.auth = auth;
      if (prevId && prevId !== p.id) void presenceChanged(prevId); // this connection switched to another player
      return send(c, { t: 'welcome', online: onlineCounts() });
    }
    case 'friendRequest': case 'friendRespond': case 'friendRemove': case 'friendCancel':
      void friendOp(c, m);
      return;
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
      // private tables: only the host; public tables: anyone seated who doesn't want to wait
      if (c.room && c.player && (c.room.hostId === c.player.id || !c.room.rt.g.settings.isPrivate)) c.room.rt.fillWithBots(400);
      return;
    case 'act': {
      if (!c.room || !c.player) return;
      const seat = c.room.rt.g.seats.findIndex((s) => s?.id === c.player!.id);
      // players may only bid, play, look at their cards or press Continue; the table itself handles the rest
      if (!m.action || !['bid', 'play', 'reveal', 'ready'].includes(m.action.type)) return send(c, { t: 'error', message: 'Not allowed' });
      const err = c.room.rt.act(seat, m.action);
      if (err) send(c, { t: 'error', message: err });
      return;
    }
    case 'chat': {
      if (!c.room || !c.player) return;
      const isGift = String(m.text).startsWith('🎁:');
      // quick phrases and emoji are free; typed messages need a paid Chat Pass or VIP, checked against the server's purchase records
      const allowed = isGift || isFreeChat(String(m.text)) || hasChatPass(c.player.id) || (!paymentsEnabled() && process.env.ALLOW_TEST_PURCHASES === '1' && !!c.player.chat);
      if (!allowed) return send(c, { t: 'error', message: 'Get a Chat Pass to type your own messages — quick phrases and emoji are free' });
    }
      return c.room.rt.say(c.room.rt.g.seats.findIndex((s) => s?.id === c.player!.id), m.text);
    case 'gift': {
      if (!c.room || !c.player) return;
      const now = Date.now();
      c.gifts = c.gifts.filter((t) => now - t < 60_000);
      if (c.gifts.length >= 20) return send(c, { t: 'error', message: 'Slow down a little — too many gifts at once' });
      c.gifts.push(now);
      const from = c.room.rt.g.seats.findIndex((s) => s?.id === c.player!.id);
      if (from < 0) return;
      c.room.rt.gift(from, m.to === 'all' ? 'all' : Number(m.to), String(m.gift).slice(0, 30));
      return;
    }
    case 'leave':
      return leave(c);
    case 'rejoin':
      return rejoin(c, m.tableId);
  }
}

/** Profile-card numbers a player shares with the table (bounded so nobody can send junk). */
function cleanStats(v: unknown): PublicStats | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const n = (x: unknown, max = 1e12) => Math.max(0, Math.min(max, Math.floor(Number(x) || 0)));
  const rings: Record<string, number> = {};
  if (o.rings && typeof o.rings === 'object') for (const c of CITIES) { const r = n((o.rings as Record<string, unknown>)[c], 1e6); if (r) rings[c] = r; }
  const played = n(o.played, 1e7);
  return { coins: n(o.coins), played, won: Math.min(played, n(o.won, 1e7)), last5: String(o.last5 ?? '').replace(/[^WL]/g, '').slice(-5),
    nil: n(o.nil, 1e7), nilMade: n(o.nilMade, 1e7), blind: n(o.blind, 1e7), blindMade: n(o.blindMade, 1e7), rings };
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
const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.txt': 'text/plain', '.woff': 'font/woff', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
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
  if (url.pathname.startsWith('/api/auth')) return authApi(req, res, url);
  if (req.method === 'GET' && url.pathname === '/api/payments') return json(res, 200, { enabled: paymentsEnabled(), provider: paymentProvider() });
  if (req.method === 'GET' && url.pathname === '/api/purchases') return json(res, 200, claim(String(url.searchParams.get('id') || '').slice(0, 64)));
  if (req.method === 'POST' && (url.pathname === '/api/checkout' || url.pathname === '/api/stripe-webhook' || url.pathname === '/api/paypal/capture' || url.pathname === '/api/stripe/confirm')) {
    let raw = '';
    req.on('data', (d) => { raw += d; if (raw.length > 200_000) req.destroy(); });
    req.on('end', async () => {
      if (url.pathname === '/api/stripe-webhook') { const code = handleWebhook(raw, req.headers['stripe-signature'] as string | undefined); return json(res, code, { received: code === 200 }); }
      if (!paymentsEnabled()) return json(res, 503, { error: 'Payments are not set up yet' });
      if (url.pathname === '/api/stripe/confirm') {
        try { const r = await stripeConfirm(String(JSON.parse(raw).sessionId || '')); return json(res, r.ok ? 200 : 400, r); }
        catch (e) { console.warn('stripe confirm', (e as Error).message); return json(res, 502, { ok: false, error: 'Stripe is unavailable right now' }); }
      }
      if (url.pathname === '/api/paypal/capture') {
        try { const r = await paypalCapture(String(JSON.parse(raw).orderId || '')); return json(res, r.ok ? 200 : 400, r); }
        catch (e) { console.warn('paypal capture', (e as Error).message); return json(res, 502, { ok: false, error: 'PayPal is unavailable right now' }); }
      }
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

// ---- sign-in: email, Google, Facebook ----
const authTries = new Map<string, { n: number; t: number }>();
async function authApi(req: import('http').IncomingMessage, res: import('http').ServerResponse, url: URL) {
  try {
    if (req.method === 'GET' && url.pathname === '/api/auth/config') return json(res, 200, authConfig());
    if (req.method !== 'POST') return json(res, 404, { error: 'not found' });
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const now = Date.now(), t = authTries.get(ip);
    if (t && now - t.t < 10 * 60_000 && t.n >= 20) return json(res, 429, { error: 'Too many attempts. Wait a few minutes and try again.' });
    authTries.set(ip, t && now - t.t < 10 * 60_000 ? { n: t.n + 1, t: t.t } : { n: 1, t: now });
    const b = JSON.parse((await readBody(req, 8000)) || '{}');
    const routes: Record<string, (b: Record<string, unknown>) => Promise<unknown>> = {
      '/api/auth/signup': signUp, '/api/auth/login': signIn, '/api/auth/password': changePassword,
      '/api/auth/google': googleSignIn, '/api/auth/facebook': facebookSignIn,
    };
    const fn = routes[url.pathname];
    if (!fn) return json(res, 404, { error: 'not found' });
    return json(res, 200, await fn(b));
  } catch (e) {
    if (e instanceof AuthError) return json(res, e.status, { error: e.message });
    console.error('auth', e);
    return json(res, 500, { error: 'Sign-in is unavailable right now. Please try again.' });
  }
}

// ---- guest accounts ----
const restoreTries = new Map<string, { n: number; t: number }>();
const nameTries = new Map<string, number[]>();    // "is this name free?" checks per account
const nameChanges = new Map<string, number[]>();  // actual name changes per account
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
    // choose or change the player's name: { id, key, name, check? } (check = only say whether it is free)
    if (req.method === 'POST' && url.pathname === '/api/guest/name') {
      const b = JSON.parse((await readBody(req, 2000)) || '{}');
      const id = String(b.id || '').slice(0, 64), key = String(b.key || '').slice(0, 80), now = Date.now();
      const log = (nameTries.get(id) ?? []).filter((t) => now - t < 3_600_000);
      const lastMinute = log.filter((t) => now - t < 60_000).length;
      if (lastMinute >= 40) return json(res, 429, { ok: false, message: 'Too many tries — wait a minute.' });
      if (!b.check) {
        const changes = (nameChanges.get(id) ?? []).filter((t) => now - t < 3_600_000);
        if (changes.length >= 10) return json(res, 429, { ok: false, message: 'You have changed your name a lot just now. Try again later.' });
        const r = await renameAccount(id, key, b.name);
        if (!r.ok) return json(res, r.status, { ok: false, message: r.message });
        nameChanges.set(id, [...changes, now]);
        touch({ id, name: r.name, avatar: r.avatar }); // ranked players show the new name on the leaderboard straight away
        return json(res, 200, { ok: true, name: r.name });
      }
      nameTries.set(id, [...log, now]);
      return json(res, 200, await checkName(id, key, b.name));
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
  // Old address: send everyone to the new one (set REDIRECT_TO on the old service)
  const REDIRECT_TO = (process.env.REDIRECT_TO || '').replace(/\/+$/, '');
  if (REDIRECT_TO) { res.writeHead(301, { location: REDIRECT_TO + (req.url || '/'), 'cache-control': 'no-store' }); return res.end(); }
  if (req.url?.startsWith('/api/')) return api(req, res);
  if (!existsSync(DIST)) { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('Spade Haven server running. Build the client (npm run build) to serve it here.'); }
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  // Google Play app (Trusted Web Activity) ↔ website link. Set ANDROID_PACKAGE and ANDROID_CERT_SHA256 (comma-separated if several) in Render.
  if (urlPath === '/.well-known/assetlinks.json' && process.env.ANDROID_PACKAGE && process.env.ANDROID_CERT_SHA256) {
    const fingerprints = process.env.ANDROID_CERT_SHA256.split(',').map((f) => f.trim().toUpperCase()).filter(Boolean);
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'max-age=300' });
    return res.end(JSON.stringify([{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: process.env.ANDROID_PACKAGE.trim(), sha256_cert_fingerprints: fingerprints } }]));
  }
  let file = normalize(join(DIST, urlPath));
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  const type = urlPath === '/.well-known/windows-app-web-link' ? 'application/json' : MIME[extname(file)] || 'application/octet-stream';
  const headers: Record<string, string> = { 'content-type': type };
  // ?download → save as the original file (e.g. store artwork as .png, not converted by the browser)
  if (/[?&]download\b/.test(req.url || '') && urlPath.startsWith('/brand/')) headers['content-disposition'] = `attachment; filename="${urlPath.split('/').pop()}"`;
  res.writeHead(200, headers);
  res.end(readFileSync(file));
});

const wss = new WebSocketServer({ server: http, path: '/ws' });
wss.on('connection', (ws) => {
  const c: Client = { ws, player: null, room: null, unsub: null, verified: false, auth: null, fops: [], gifts: [] };
  clients.add(c);
  ws.on('message', (raw) => {
    try { handle(c, JSON.parse(String(raw))); } catch (e) { send(c, { t: 'error', message: 'Bad message' }); }
  });
  ws.on('close', () => {
    dropped(c); clients.delete(c);
    if (c.verified && c.player) void presenceChanged(c.player.id); // friends see them go offline
  });
});

// Render stops the old server when a new version goes live: warn everyone first.
process.on('SIGTERM', () => {
  for (const c of clients) send(c, { t: 'notice', message: c.room && c.room.rt.g.phase !== 'waiting' ? 'The game server is restarting for an update. This game will end and your bet will be refunded.' : 'The game server is restarting for an update — back in a moment.' });
  setTimeout(() => process.exit(0), 1500);
});

Promise.all([initLeaderboard(), initPayments()]).then(() => {
  http.listen(PORT, () => console.log(`Spade Haven server on http://localhost:${PORT} (ws path /ws) · storage: ${storageKind}`));
});

// Render's free plan sleeps after 15 idle minutes; with KEEP_AWAKE=1 the server visits itself every 10 minutes.
const SELF_URL = process.env.RENDER_EXTERNAL_URL;
if (process.env.KEEP_AWAKE === '1' && SELF_URL) {
  setInterval(() => { fetch(`${SELF_URL}/health`).catch(() => {}); }, 10 * 60_000);
  console.log(`keep-awake on: pinging ${SELF_URL}/health every 10 minutes`);
}
