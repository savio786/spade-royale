// A table controller hides whether the game runs locally (vs bots) or on the server.
import type { Action, TableSettings } from '../../shared/engine';
import { TableRuntime, Snapshot } from '../../shared/runtime';
import { net } from './net';
import { profile, levelFromXp, publicStats } from './profile';

export interface CtlView {
  snap: Snapshot | null;
  code: string | null;
  host: boolean;
  online: boolean;
  error: string | null;
  settings: TableSettings;
  kicked: string | null;          // set when removed from the table for inactivity
  conn: 'ok' | 'lost' | 'gone';   // online tables: connection to the server
}

export interface TableController {
  subscribe(f: (v: CtlView) => void): () => void;
  act(a: Action): void;
  chat(text: string): void;
  /** Buy a gift for one seat, or `'all'` for a round for the whole table. */
  gift(to: number | 'all', giftId: string): void;
  fillBots(): void;
  leave(): void;
}

export const TURN_MS = 12000;   // time to bid or play before the game does it for you
export const MAX_MISSED = 3;     // missed turns in one game before you're removed

function me() {
  const p = profile.get();
  return { id: p.id, name: p.name || 'Guest', avatar: p.avatar, level: levelFromXp(p.xp), stats: publicStats(p) };
}

export class LocalController implements TableController {
  rt: TableRuntime;
  private view: CtlView;
  private subs = new Set<(v: CtlView) => void>();
  private seat = 0;
  constructor(settings: TableSettings, opts: { code?: string } = {}) {
    this.view = { snap: null, code: opts.code ?? null, host: true, online: false, error: null, settings, kicked: null, conn: 'ok' };
    this.rt = new TableRuntime(settings, {
      hostId: me().id, fillBotsAfterMs: null, turnTimeoutMs: TURN_MS, maxMissedTurns: MAX_MISSED, botSpeed: profile.get().settings.fast ? 0.55 : 1,
      onInactive: () => { this.view = { ...this.view, kicked: `You missed ${MAX_MISSED} turns this game, so you were disconnected from the table.` }; this.subs.forEach((f) => f(this.view)); },
    });
    this.seat = this.rt.addHuman(me(), 0);
    this.rt.subscribe('me', this.seat, (snap) => { this.view = { ...this.view, snap }; this.subs.forEach((f) => f(this.view)); });
    setTimeout(() => this.rt.fillWithBots(settings.isPrivate ? 500 : 900), 700);
  }
  subscribe(f: (v: CtlView) => void) { this.subs.add(f); f(this.view); return () => { this.subs.delete(f); }; }
  act(a: Action) {
    const err = this.rt.act(this.seat, a);
    if (err) { this.view = { ...this.view, error: err }; this.subs.forEach((f) => f(this.view)); }
  }
  chat(text: string) { this.rt.say(this.seat, text); }
  gift(to: number | 'all', giftId: string) { this.rt.gift(this.seat, to, giftId); }
  fillBots() { this.rt.fillWithBots(300); }
  leave() { this.rt.destroy(); this.subs.clear(); }
}

export type RemoteJoin =
  | { kind: 'quick'; settings: TableSettings }
  | { kind: 'table'; tableId: string; settings: TableSettings }
  | { kind: 'createPrivate'; settings: TableSettings }
  | { kind: 'joinPrivate'; code: string; settings: TableSettings };

export class RemoteController implements TableController {
  private view: CtlView;
  private subs = new Set<(v: CtlView) => void>();
  private off: () => void;
  constructor(join: RemoteJoin) {
    this.view = { snap: null, code: null, host: false, online: true, error: null, settings: join.settings, kicked: null, conn: 'ok' };
    const offMsg = net.on((m) => {
      if (m.t === 'joined') { this.tableId = m.tableId; this.update({ code: m.code, host: m.host, settings: m.settings, error: null, conn: 'ok' }); }
      else if (m.t === 'snap') this.update({ snap: m.snap });
      else if (m.t === 'error') this.update({ error: m.message });
      else if (m.t === 'kicked') this.update({ kicked: m.reason });
      else if (m.t === 'tableGone') this.update({ conn: 'gone' });
    });
    // dropped connection: show it, and once reconnected ask for our seat back
    let wasOnline = net.status === 'online';
    const offStatus = net.onStatus((s) => {
      if (s !== 'online' && wasOnline && this.tableId) this.update({ conn: 'lost' });
      if (s === 'online' && !wasOnline && this.tableId) net.send({ t: 'rejoin', tableId: this.tableId });
      wasOnline = s === 'online';
    });
    this.off = () => { offMsg(); offStatus(); };
    net.hello();
    if (join.kind === 'quick') net.send({ t: 'quick', settings: join.settings });
    else if (join.kind === 'table') net.send({ t: 'join', tableId: join.tableId });
    else if (join.kind === 'createPrivate') net.send({ t: 'createPrivate', settings: join.settings });
    else net.send({ t: 'joinPrivate', code: join.code });
  }
  private tableId: string | null = null;
  private update(p: Partial<CtlView>) { this.view = { ...this.view, ...p }; this.subs.forEach((f) => f(this.view)); }
  subscribe(f: (v: CtlView) => void) { this.subs.add(f); f(this.view); return () => { this.subs.delete(f); }; }
  act(a: Action) { net.send({ t: 'act', action: a }); }
  chat(text: string) { net.send({ t: 'chat', text }); }
  gift(to: number | 'all', giftId: string) { net.send({ t: 'gift', to, gift: giftId }); }
  fillBots() { net.send({ t: 'fillBots' }); }
  leave() { net.send({ t: 'leave' }); this.off(); this.subs.clear(); }
}
