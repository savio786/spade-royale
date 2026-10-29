// Crows Haven game server (Cloudflare Worker + Durable Objects). Spades doesn't use any of this.
//
//  Worker        HTTP: POST /quick, POST /private, GET /code/:CODE, GET /health · WebSocket: /ws/:tableId
//  Lobby (one)   finds an open public table for "Play online", makes private tables with invite codes
//  Table (each)  one table: seats, the game (shared/crows/engine), computer players (shared/crows/bot),
//                countdowns, turn timers, reconnects and the fixed chat
//
// Like Spades: on a public table each empty seat gets a 15-second countdown, then a computer player sits down
// (a person joining starts a fresh countdown); anyone seated can press "Start now". Private tables wait for the host.
import { DurableObject } from 'cloudflare:workers';
import {
  applyAction, createGame, startRound, viewFor, RuleError, sideOf, DEFAULT_TARGET,
  type CrowsAction, type CrowsState, type Seat,
} from '../../shared/crows/engine';
import { botAction } from '../../shared/crows/bot';
import { isCrowsChat, BOT_REPLY, BOT_GREET, BOT_MADE, BOT_SET } from '../../shared/crows/chat';
import type { ClientMsg, ServerMsg, TableInfo } from '../../shared/crows/protocol';
import { CROWS_PORTRAITS } from '../../src/crows/portraits';
import { BOT_PHOTOS } from '../../shared/botphotos';

export interface Env {
  LOBBY: DurableObjectNamespace<Lobby>;
  TABLE: DurableObjectNamespace<Table>;
  /** testing only: shorter countdowns, e.g. "0.1" */
  TIME_SCALE?: string;
}

const TARGETS = [300, 400, 500];
const normTarget = (t: unknown) => (TARGETS.includes(Number(t)) ? Number(t) : DEFAULT_TARGET);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS } });

// ---------------------------------------------------------------- Worker
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const lobby = () => env.LOBBY.get(env.LOBBY.idFromName('lobby'));
    try {
      if (url.pathname === '/health') return json({ ok: true, game: 'crows-haven' });
      if (url.pathname === '/quick' && req.method === 'POST') {
        const b = await req.json().catch(() => ({})) as { target?: number };
        return json({ tableId: await lobby().quick(normTarget(b.target)) });
      }
      if (url.pathname === '/private' && req.method === 'POST') {
        const b = await req.json().catch(() => ({})) as { target?: number };
        return json(await lobby().createPrivate(normTarget(b.target)));
      }
      const code = url.pathname.match(/^\/code\/([A-Za-z]{5})$/)?.[1];
      if (code) {
        const tableId = await lobby().byCode(code.toUpperCase());
        return tableId ? json({ tableId }) : json({ error: 'No table with that code' }, 404);
      }
      const ws = url.pathname.match(/^\/ws\/([\w-]{8,64})$/)?.[1];
      if (ws) {
        if (req.headers.get('upgrade') !== 'websocket') return json({ error: 'expected a websocket' }, 426);
        return env.TABLE.get(env.TABLE.idFromName(ws)).fetch(req);
      }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: (e as Error).message }, 500);
    }
  },
};

// ---------------------------------------------------------------- Lobby
interface Entry { id: string; target: number; isPrivate: boolean; code: string | null; seated: number; started: boolean; pending: number[]; updatedAt: number }
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export class Lobby extends DurableObject<Env> {
  private tables: Record<string, Entry> = {};
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => { this.tables = (await ctx.storage.get<Record<string, Entry>>('tables')) ?? {}; });
  }
  private async save() { await this.ctx.storage.put('tables', this.tables); }
  private prune(now = Date.now()) {
    for (const [id, e] of Object.entries(this.tables)) {
      e.pending = e.pending.filter((t) => now - t < 20_000);         // someone sent to a table who never arrived
      if (now - e.updatedAt > 6 * 3600e3) delete this.tables[id];
    }
  }
  private async open(target: number, isPrivate: boolean, code: string | null) {
    const id = crypto.randomUUID();
    await this.env.TABLE.get(this.env.TABLE.idFromName(id)).init(id, target, isPrivate, code);
    const e: Entry = { id, target, isPrivate, code, seated: 0, started: false, pending: [], updatedAt: Date.now() };
    this.tables[id] = e;
    return e;
  }
  /** "Play online": a public table with the same game points that's still filling up, or a new one. */
  async quick(target: number): Promise<string> {
    const now = Date.now();
    this.prune(now);
    let e = Object.values(this.tables)
      .filter((x) => !x.isPrivate && !x.started && x.target === target && x.seated + x.pending.length < 4 && now - x.updatedAt < 10 * 60e3)
      .sort((a, b) => b.seated - a.seated)[0];
    if (!e) e = await this.open(target, false, null);
    e.pending.push(now);
    await this.save();
    return e.id;
  }
  async createPrivate(target: number): Promise<{ tableId: string; code: string }> {
    this.prune();
    const used = new Set(Object.values(this.tables).map((x) => x.code));
    let code = '';
    do code = Array.from({ length: 5 }, () => pick([...CODE_LETTERS])).join(''); while (used.has(code));
    const e = await this.open(target, true, code);
    await this.save();
    return { tableId: e.id, code };
  }
  async byCode(code: string): Promise<string | null> {
    return Object.values(this.tables).find((x) => x.code === code)?.id ?? null;
  }
  /** a table reports how many seats are taken and whether the game has started */
  async update(id: string, seated: number, started: boolean, joined: boolean) {
    const e = this.tables[id];
    if (!e) return;
    e.seated = seated; e.started = started; e.updatedAt = Date.now();
    if (joined) e.pending.shift();
    await this.save();
  }
  async remove(id: string) { delete this.tables[id]; await this.save(); }
}

// ---------------------------------------------------------------- Table
interface Player { pid: string; name: string; avatar: string; token: string; human: boolean; away: boolean; goneAt: number | null; missed: number; level: number }
interface TableData {
  id: string; target: number; isPrivate: boolean; code: string | null;
  g: CrowsState; players: (Player | null)[];
  fillAt: number | null; startAt: number | null; turnAt: number | null; botAt: number | null;
  collectAt: number | null; nextAt: number | null; closeAt: number | null; emptySince: number | null;
  key: string; ready: boolean[]; createdAt: number;
  /** "Start now" was pressed: computer players are sitting down one by one */
  filling?: boolean;
}
interface Att { seat: number }

const BASE = { FILL: 15_000, FILL_GAP: 5_000, START: 4_000, TURN: 20_000, NEST: 40_000, BOT: 900, NEST_BOT: 1_500, COLLECT: 1_300, NEXT: 15_000, GRACE: 8_000, EMPTY_CLOSE: 90_000, OVER_CLOSE: 120_000 };
const AVATAR_RE = /^(a|p|b|c|f|t)\d{1,3}$/;
const ALL_PORTRAITS = [...CROWS_PORTRAITS, ...BOT_PHOTOS];

export class Table extends DurableObject<Env> {
  private t: TableData | null = null;
  private ms: typeof BASE;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const k = Number(env.TIME_SCALE) > 0 ? Number(env.TIME_SCALE) : 1;
    this.ms = Object.fromEntries(Object.entries(BASE).map(([n, v]) => [n, Math.round(v * k)])) as typeof BASE;
    ctx.blockConcurrencyWhile(async () => { this.t = (await ctx.storage.get<TableData>('t')) ?? null; });
  }

  async init(id: string, target: number, isPrivate: boolean, code: string | null) {
    if (this.t) return;
    this.t = {
      id, target, isPrivate, code,
      g: createGame({ target, city: 'Crows Haven', isPrivate }, [null, null, null, null]),
      players: [null, null, null, null],
      fillAt: null, startAt: null, turnAt: null, botAt: null, collectAt: null, nextAt: null, closeAt: null, emptySince: Date.now(),
      key: '', ready: [false, false, false, false], createdAt: Date.now(),
    };
    await this.save();
    await this.schedule();
  }

  async fetch(_req: Request): Promise<Response> {
    if (!this.t) return new Response('This table no longer exists', { status: 404 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ seat: -1 } satisfies Att);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ----- helpers
  private async save() { if (this.t) await this.ctx.storage.put('t', this.t); }
  private lobby() { return this.env.LOBBY.get(this.env.LOBBY.idFromName('lobby')); }
  private send(ws: WebSocket, m: ServerMsg) { try { ws.send(JSON.stringify(m)); } catch { /* closed */ } }
  private sockets(seat?: number) {
    return this.ctx.getWebSockets().filter((w) => seat === undefined || (w.deserializeAttachment() as Att | null)?.seat === seat);
  }
  private isAway(p: Player, now = Date.now()) { return p.away || (p.goneAt !== null && now - p.goneAt > this.ms.GRACE); }
  private seated() { return this.t!.players.filter(Boolean).length; }
  private info(): TableInfo {
    const t = this.t!, now = Date.now();
    const turnTotal = t.g.phase === 'nest' ? this.ms.NEST : this.ms.TURN;
    return {
      tableId: t.id, code: t.code, isPrivate: t.isPrivate, target: t.target,
      fillAt: t.fillAt, startAt: t.startAt, turnAt: t.turnAt, turnTotal, nextAt: t.nextAt,
      filling: !!t.filling,
      humans: t.players.map((p) => !!p?.human), away: t.players.map((p) => !!p && p.human && this.isAway(p, now)), ready: t.ready.slice(), now,
    };
  }
  private viewFor(seat: number) {
    const v = viewFor(this.t!.g, seat);
    // never send player ids to other players
    return { ...v, seats: v.seats.map((s, i) => (s ? { ...s, id: `seat${i}` } : null)) };
  }
  private broadcast() {
    if (!this.t) return;
    const info = this.info();
    for (const ws of this.sockets()) {
      const seat = (ws.deserializeAttachment() as Att | null)?.seat ?? -1;
      if (seat >= 0) this.send(ws, { t: 'state', view: this.viewFor(seat), info });
    }
  }
  private chat(seat: number, text: string) { for (const ws of this.sockets()) this.send(ws, { t: 'chat', seat, text }); }
  private botSays(seat: number, text: string, delay: number) { setTimeout(() => this.chat(seat, text), delay); }
  private seatFor(p: Player, i: number): Seat { return { id: `seat${i}`, name: p.name, avatar: p.avatar, level: p.level, bot: !p.human }; }
  private newBot(): Player {
    const used = new Set(this.t!.players.filter(Boolean).map((p) => p!.avatar));
    const free = ALL_PORTRAITS.filter((p) => !used.has(p.id));
    const b = pick(free.length ? free : ALL_PORTRAITS);
    return { pid: `bot:${crypto.randomUUID().slice(0, 8)}`, name: b.name, avatar: b.id, token: '', human: false, away: false, goneAt: null, missed: 0, level: 5 + Math.floor(Math.random() * 60) };
  }
  private putBot(i: number) {
    const t = this.t!;
    const b = this.newBot();
    t.players[i] = b;
    t.g = { ...t.g, seats: t.g.seats.map((s, j) => (j === i ? this.seatFor(b, i) : s)) };
  }
  private async report(joined = false) {
    try { await this.lobby().update(this.t!.id, this.seated(), this.t!.g.phase !== 'waiting', joined); } catch { /* lobby busy */ }
  }

  // ----- messages from players
  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer) {
    if (!this.t) { this.send(ws, { t: 'closed', reason: 'This table has closed.' }); ws.close(1000, 'closed'); return; }
    let m: ClientMsg;
    try { m = JSON.parse(typeof data === 'string' ? data : new TextDecoder().decode(data)); } catch { return; }
    const t = this.t;
    const att = (ws.deserializeAttachment() as Att | null) ?? { seat: -1 };
    const seat = att.seat;
    const me = seat >= 0 ? t.players[seat] : null;

    if (m.t === 'hello') {
      if (seat >= 0) return;
      // coming back: the token from when you sat down gets your seat back
      let i = m.token ? t.players.findIndex((p) => p?.human && p.token === m.token) : -1;
      let joined = false;
      if (i < 0) {
        i = t.g.phase === 'waiting' ? t.players.findIndex((p) => !p) : -1;
        if (i < 0) { this.send(ws, { t: 'error', code: 'full', message: 'This table is full.' }); ws.close(1000, 'full'); return; }
        const name = String(m.name ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24) || `Player ${i + 1}`;
        const avatar = AVATAR_RE.test(String(m.avatar)) ? String(m.avatar) : 'a1';
        const p: Player = { pid: String(m.pid ?? '').slice(0, 64), name, avatar, token: crypto.randomUUID(), human: true, away: false, goneAt: null, missed: 0, level: 1 };
        t.players[i] = p;
        t.g = { ...t.g, seats: t.g.seats.map((s, j) => (j === i ? this.seatFor(p, i) : s)) };
        if (!t.isPrivate) t.fillAt = null;             // a person joined: fresh countdown for the next seat
        joined = true;
      }
      const p = t.players[i]!;
      p.away = false; p.goneAt = null; p.missed = 0;
      ws.serializeAttachment({ seat: i } satisfies Att);
      this.send(ws, { t: 'joined', seat: i, token: p.token, info: this.info() });
      await this.tick(true);
      if (joined) await this.report(true);
      return;
    }
    if (!me || !me.human) return;
    me.away = false; me.goneAt = null;

    if (m.t === 'act') {
      const a = m.action as CrowsAction;
      if (!a || a.type === 'collect' || a.type === 'nextRound') return;   // the server does these
      if (t.g.turn !== seat && a.type !== 'redeal') { this.send(ws, { t: 'error', message: 'Not your turn' }); return; }
      try { t.g = applyAction(t.g, { ...a, seat } as CrowsAction); me.missed = 0; }
      catch (e) { this.send(ws, { t: 'error', message: e instanceof RuleError ? e.message : 'That move isn’t allowed' }); return; }
      await this.tick(true);
    } else if (m.t === 'chat') {
      if (!isCrowsChat(m.text)) return;
      this.chat(seat, m.text);
      const bots = t.players.map((p, i) => (p && !p.human ? i : -1)).filter((i) => i >= 0);
      if (bots.length && Math.random() < 0.45) this.botSays(pick(bots), pick(BOT_REPLY), 900 + Math.random() * 1400);
    } else if (m.t === 'start') {
      // computer players sit down one by one, 5 seconds apart (the first right away)
      if (t.g.phase !== 'waiting' || t.filling) return;
      t.filling = true;
      t.fillAt = Date.now();
      await this.tick(true);
    } else if (m.t === 'ready') {
      t.ready[seat] = true;
      await this.tick(true);
    } else if (m.t === 'leave') {
      if (t.g.phase === 'waiting') {
        t.players[seat] = null;
        t.g = { ...t.g, seats: t.g.seats.map((s, j) => (j === seat ? null : s)) };
      } else if (t.g.phase !== 'gameOver') {
        this.putBot(seat);                               // a computer player takes over the seat
      }
      ws.serializeAttachment({ seat: -1 } satisfies Att);
      ws.close(1000, 'left');
      await this.tick(true);
      await this.report();
    }
  }

  async webSocketClose(ws: WebSocket) {
    if (!this.t) return;
    const seat = (ws.deserializeAttachment() as Att | null)?.seat ?? -1;
    const p = seat >= 0 ? this.t.players[seat] : null;
    if (p?.human && this.sockets(seat).filter((w) => w !== ws).length === 0) p.goneAt = Date.now();
    await this.tick(true);
  }
  async webSocketError(ws: WebSocket) { await this.webSocketClose(ws); }
  async alarm() { await this.tick(false); }

  // ----- the clock: countdowns, computer players, timeouts
  private async tick(changed: boolean) {
    if (!this.t) return;
    for (let i = 0; i < 60; i++) {
      const r = this.step(Date.now());
      if (r === 'closed') return;
      if (!r) break;
      changed = true;
    }
    if (changed) { await this.save(); this.broadcast(); }
    await this.schedule();
  }

  private async schedule() {
    const t = this.t;
    if (!t) return;
    const times = [t.fillAt, t.startAt, t.turnAt, t.botAt, t.collectAt, t.nextAt, t.closeAt,
      t.emptySince !== null ? t.emptySince + this.ms.EMPTY_CLOSE : null,
      ...t.players.map((p) => (p?.goneAt ? p.goneAt + this.ms.GRACE + 50 : null))].filter((x): x is number => x !== null);
    if (times.length) await this.ctx.storage.setAlarm(Math.max(Date.now() + 20, Math.min(...times)));
  }

  private async close(reason: string) {
    for (const ws of this.sockets()) { this.send(ws, { t: 'closed', reason }); try { ws.close(1000, 'closed'); } catch { /* gone */ } }
    const id = this.t!.id;
    this.t = null;
    await this.ctx.storage.deleteAll();
    try { await this.lobby().remove(id); } catch { /* ignore */ }
  }

  /** Does at most one thing that is due. Returns true if something changed, 'closed' if the table closed. */
  private step(now: number): boolean | 'closed' {
    const t = this.t!;
    const ms = this.ms;
    const due = (x: number | null) => x !== null && x <= now;

    if (due(t.closeAt)) { void this.close('This table has closed.'); return 'closed'; }
    // nobody here any more: close after a while
    const present = t.players.some((p) => p?.human && !this.isAway(p, now)) || this.sockets().length > 0;
    if (present) t.emptySince = null; else if (t.emptySince === null) t.emptySince = now;
    if (t.emptySince !== null && now - t.emptySince > ms.EMPTY_CLOSE) { void this.close('Everyone left the table.'); return 'closed'; }

    const g = t.g;
    if (g.phase === 'waiting') {
      // someone who lost connection before the game started gives their seat back
      const gone = t.players.findIndex((p) => p?.human && p.goneAt !== null && now - p.goneAt > ms.GRACE);
      if (gone >= 0) { t.players[gone] = null; t.g = { ...g, seats: g.seats.map((s, j) => (j === gone ? null : s)) }; t.fillAt = null; void this.report(); return true; }
      if (t.players.every(Boolean)) {
        t.fillAt = null;
        if (t.startAt === null) { t.startAt = now + ms.START; return true; }
        if (due(t.startAt)) {
          t.startAt = null;
          t.g = startRound(g);
          void this.report();
          t.players.forEach((p, i) => { if (p && !p.human && Math.random() < 0.5) this.botSays(i, pick(BOT_GREET), 800 + Math.random() * 2500); });
          return true;
        }
        return false;
      }
      t.startAt = null;
      if (t.players.some((p) => p?.human) && (t.filling || !t.isPrivate)) {
        const gap = t.filling ? ms.FILL_GAP : ms.FILL;
        if (t.fillAt === null) { t.fillAt = now + gap; return true; }
        if (due(t.fillAt)) {
          this.putBot(t.players.findIndex((p) => !p));
          t.fillAt = t.players.every(Boolean) ? null : now + gap;
          void this.report();
          return true;
        }
      }
      return false;
    }

    const key = `${g.phase}|${g.round}|${g.turn}|${g.trick.length}|${g.bidLog.length}|${g.history.length}|${g.hands.reduce((n, h) => n + h.length, 0)}`;
    if (key !== t.key) {
      t.key = key;
      t.botAt = t.turnAt = t.collectAt = t.nextAt = null;
      t.ready = [false, false, false, false];
      if (g.phase === 'roundEnd' && Math.random() < 0.5) {
        const bots = t.players.map((p, i) => (p && !p.human ? i : -1)).filter((i) => i >= 0);
        const r = g.history[g.history.length - 1];
        if (bots.length && r) { const b = pick(bots); this.botSays(b, pick((sideOf(b) === sideOf(r.bidder)) === r.made ? BOT_MADE : BOT_SET), 700); }
      }
      return true;
    }

    if (g.phase === 'bidding' || g.phase === 'nest' || g.phase === 'playing') {
      const p = t.players[g.turn];
      const auto = !p || !p.human || this.isAway(p, now);
      if (auto) {
        if (t.botAt === null) { t.botAt = now + (g.phase === 'nest' ? ms.NEST_BOT : ms.BOT); t.turnAt = null; return true; }
        if (!due(t.botAt)) return false;
      } else {
        if (t.turnAt === null) { t.turnAt = now + (g.phase === 'nest' ? ms.NEST : ms.TURN); t.botAt = null; return true; }
        if (!due(t.turnAt)) return false;
        p.missed++;                                      // time ran out: the game plays for them
        if (p.missed >= 3) p.away = true;                // …and keeps playing for them until they come back
      }
      try { t.g = applyAction(g, botAction(g, g.turn)); } catch { t.g = applyAction(g, { type: 'pass', seat: g.turn }); }
      return true;
    }
    if (g.phase === 'trickEnd') {
      if (t.collectAt === null) { t.collectAt = now + ms.COLLECT; return true; }
      if (!due(t.collectAt)) return false;
      t.g = applyAction(g, { type: 'collect' });
      return true;
    }
    if (g.phase === 'roundEnd') {
      if (t.nextAt === null) { t.nextAt = now + ms.NEXT; return true; }
      const people = t.players.map((p, i) => (p?.human && !this.isAway(p, now) ? i : -1)).filter((i) => i >= 0);
      if (due(t.nextAt) || (people.length > 0 && people.every((i) => t.ready[i]))) { t.g = applyAction(g, { type: 'nextRound' }); return true; }
      return false;
    }
    if (g.phase === 'gameOver') {
      if (t.closeAt === null) { t.closeAt = now + ms.OVER_CLOSE; void this.report(); return true; }
    }
    return false;
  }
}
