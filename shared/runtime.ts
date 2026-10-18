// A running table: game state + bot turns + timers + chat.
// Used in the browser for offline play (one human, three bots) and on the
// server for online/private tables (up to four humans, bots fill the gaps).
import { Action, applyAction, createGame, GameState, isFull, PublicState, RuleError, Seat, sideOf, startRound, TableSettings, viewFor } from './engine';
import { botBid, botPlay, BOT_LINES, BOT_NAMES, pick } from './bot';

export interface ChatMsg { id: number; seat: number; name: string; text: string; ts: number; system?: boolean }
export interface Snapshot {
  state: PublicState; chat: ChatMsg[];
  turnDeadline: number | null;   // when the current human turn auto-plays
  turnTotal: number | null;      // length of a turn (ms)
  missed: number[];              // turns each seat let run out during this game
  maxMissed: number;             // removed from the table when reached
}

export interface RuntimeOptions {
  /** auto-fill empty seats with bots after this many ms (null = never, host must start) */
  fillBotsAfterMs: number | null;
  /** auto-play for a human who doesn't act in time (null = wait forever) */
  turnTimeoutMs: number | null;
  /** timed-out turns during one game before a player is removed (default 3); acting in between does not reset it */
  maxMissedTurns?: number;
  /** called when a player is removed for inactivity, before their seat goes to a computer player */
  onInactive?: (seat: number, playerId: string) => void;
  botSpeed?: number; // 1 = normal
}

const AVATARS = Array.from({ length: 24 }, (_, i) => `a${i + 1}`);
let botCounter = 0;
export function makeBot(exclude: string[] = []): Seat {
  const names = BOT_NAMES.filter((n) => !exclude.includes(n));
  return { id: `bot:${++botCounter}`, name: pick(names.length ? names : BOT_NAMES), avatar: pick(AVATARS), level: 5 + Math.floor(Math.random() * 60), bot: true };
}

export class TableRuntime {
  g: GameState;
  chat: ChatMsg[] = [];
  private listeners = new Map<string, { seat: number; fn: (s: Snapshot) => void }>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private fillTimer: ReturnType<typeof setTimeout> | null = null;
  private deadline: number | null = null;
  private missed = [0, 0, 0, 0];
  private autoActing = false;
  private msgId = 0;
  private destroyed = false;
  onGameOver?: (g: GameState) => void;

  constructor(settings: TableSettings, private opts: RuntimeOptions) {
    this.g = createGame(settings);
  }

  // ---------- seats ----------
  addHuman(p: Omit<Seat, 'bot'>, preferredSeat?: number): number {
    const existing = this.g.seats.findIndex((s) => s?.id === p.id);
    if (existing >= 0) {
      const seats = this.g.seats.slice();
      seats[existing] = { ...p, bot: false };
      this.g = { ...this.g, seats };
      return existing;
    }
    if (this.g.phase !== 'waiting') return -1;
    // in Partners, the second person to join sits across from the first (as partner)
    const order = this.g.settings.mode === 'partners' ? [0, 2, 1, 3] : [0, 1, 2, 3];
    let seat = preferredSeat !== undefined && !this.g.seats[preferredSeat] ? preferredSeat : (order.find((i) => !this.g.seats[i]) ?? -1);
    if (seat < 0) return -1;
    const seats = this.g.seats.slice();
    seats[seat] = { ...p, bot: false };
    this.g = { ...this.g, seats };
    this.system(`${p.name} joined the table`);
    if (this.opts.fillBotsAfterMs !== null && !this.fillTimer) {
      this.fillTimer = setTimeout(() => this.fillWithBots(), this.opts.fillBotsAfterMs);
    }
    this.changed();
    return seat;
  }

  removeHuman(id: string) {
    const idx = this.g.seats.findIndex((s) => s?.id === id);
    if (idx < 0) return;
    for (const [k, l] of this.listeners) if (l.seat === idx) this.listeners.delete(k);
    const seats = this.g.seats.slice();
    const name = seats[idx]!.name;
    if (this.g.phase === 'waiting') seats[idx] = null;
    else seats[idx] = { ...makeBot(), name: `${name} (bot)` };
    this.missed[idx] = 0;
    this.g = { ...this.g, seats };
    this.system(`${name} left the table`);
    this.changed();
  }

  humanCount() { return this.g.seats.filter((s) => s && !s.bot).length; }

  /** Seat bots one by one with a small delay, like players arriving. */
  fillWithBots(stagger = 700) {
    if (this.fillTimer) { clearTimeout(this.fillTimer); this.fillTimer = null; }
    const addOne = () => {
      if (this.destroyed || this.g.phase !== 'waiting') return;
      const free = this.g.seats.findIndex((s) => !s);
      if (free < 0) return;
      const seats = this.g.seats.slice();
      const bot = makeBot(seats.filter(Boolean).map((s) => s!.name));
      seats[free] = bot;
      this.g = { ...this.g, seats };
      if (Math.random() < 0.5) setTimeout(() => this.say(free, pick(BOT_LINES.greet)), 600 + Math.random() * 1500);
      this.changed();
      if (seats.some((s) => !s)) setTimeout(addOne, stagger * (0.6 + Math.random() * 0.8));
    };
    addOne();
  }

  // ---------- listeners ----------
  subscribe(key: string, seat: number, fn: (s: Snapshot) => void) {
    this.listeners.set(key, { seat, fn });
    fn(this.snapshot(seat));
    return () => this.listeners.delete(key);
  }
  snapshot(seat: number): Snapshot {
    return { state: viewFor(this.g, seat), chat: this.chat.slice(-60), turnDeadline: this.deadline, turnTotal: this.opts.turnTimeoutMs, missed: this.missed.slice(), maxMissed: this.opts.maxMissedTurns ?? 3 };
  }
  private emit() {
    for (const l of this.listeners.values()) l.fn(this.snapshot(l.seat));
  }

  // ---------- chat ----------
  say(seat: number, text: string) {
    const s = this.g.seats[seat];
    if (!s) return;
    const clean = String(text).replace(/\s+/g, ' ').trim().slice(0, 140);
    if (!clean) return;
    this.chat.push({ id: ++this.msgId, seat, name: s.name, text: clean, ts: Date.now() });
    if (this.chat.length > 200) this.chat.splice(0, this.chat.length - 200);
    this.emit();
    if (!s.bot) {
      // a bot sometimes answers
      const bots = this.g.seats.map((x, i) => (x?.bot ? i : -1)).filter((i) => i >= 0);
      if (bots.length && Math.random() < 0.45) setTimeout(() => this.say(pick(bots), pick(BOT_LINES.reply)), 900 + Math.random() * 1800);
    }
  }
  private system(text: string) {
    this.chat.push({ id: ++this.msgId, seat: -1, name: '', text, ts: Date.now(), system: true });
  }

  // ---------- actions ----------
  act(seat: number, a: Action): string | null {
    if ('seat' in a && a.seat !== seat) return 'Not your seat';
    try {
      this.g = applyAction(this.g, a);
    } catch (e) {
      if (e instanceof RuleError) return e.message;
      throw e;
    }
    if (a.type === 'bid' && a.bid === 0 && this.g.seats[seat]?.bot && Math.random() < 0.6) this.say(seat, pick(BOT_LINES.nil));
    this.changed();
    return null;
  }

  private changed() {
    if (this.destroyed) return;
    this.schedule();
    this.emit();
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.deadline = null;
    const g = this.g;
    const speed = this.opts.botSpeed ?? 1;
    const later = (ms: number, fn: () => void) => { this.timer = setTimeout(() => { this.timer = null; if (!this.destroyed) fn(); }, ms * speed); };

    if (g.phase === 'waiting') {
      if (isFull(g)) later(900, () => { this.g = startRound(this.g); this.system('New game — good luck!'); this.changed(); });
      return;
    }
    if (g.phase === 'trickEnd') return later(1150, () => this.act(-1, { type: 'collect' }));
    if (g.phase === 'roundEnd') {
      this.roundChatter();
      return later(6500, () => this.act(-1, { type: 'nextRound' }));
    }
    if (g.phase === 'gameOver') {
      this.roundChatter();
      if (!this.gameOverFired) { this.gameOverFired = true; this.onGameOver?.(g); }
      return;
    }
    const seat = g.turn;
    const auto = () => {
      if (this.g.phase === 'bidding') this.act(seat, { type: 'bid', seat, bid: botBid(this.g, seat) });
      else if (this.g.phase === 'playing') this.act(seat, { type: 'play', seat, card: botPlay(this.g, seat) });
    };
    if (g.seats[seat]?.bot) {
      const base = g.phase === 'bidding' ? 900 : 650;
      later(base + Math.random() * 600, auto);
    } else if (this.opts.turnTimeoutMs) {
      this.deadline = Date.now() + this.opts.turnTimeoutMs;
      this.timer = setTimeout(() => { this.timer = null; if (!this.destroyed) this.timedOut(seat, auto); }, this.opts.turnTimeoutMs);
    }
  }

  /** A human let their turn run out: play for them from their cards, and remove them after too many in one game. */
  private timedOut(seat: number, auto: () => void) {
    const s = this.g.seats[seat];
    if (!s || s.bot) return auto();
    this.autoActing = true;
    try { auto(); } finally { this.autoActing = false; }
    const max = this.opts.maxMissedTurns ?? 3;
    const n = ++this.missed[seat];
    if (n >= max) {
      this.system(`${s.name} was disconnected after missing ${max} turns this game`);
      this.opts.onInactive?.(seat, s.id);
      this.removeHuman(s.id);
    } else {
      this.system(`${s.name} ran out of time, so the game played for them (${n}/${max})`);
      this.emit();
    }
  }

  private chatterRound = -1;
  private gameOverFired = false;
  private roundChatter() {
    if (this.chatterRound === this.g.round) return;
    this.chatterRound = this.g.round;
    const last = this.g.history[this.g.history.length - 1];
    if (!last) return;
    this.g.seats.forEach((s, i) => {
      if (!s?.bot || Math.random() > 0.25) return;
      const d = last.delta[sideOf(this.g.settings.mode, i)];
      setTimeout(() => this.say(i, pick(d > 0 ? BOT_LINES.win : BOT_LINES.lose)), 700 + Math.random() * 2500);
    });
  }

  destroy() {
    this.destroyed = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.fillTimer) clearTimeout(this.fillTimer);
    this.listeners.clear();
  }
}
