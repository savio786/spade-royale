// WebSocket link to the multiplayer server. The app works fully offline (bots)
// and upgrades to live tables when the server is reachable.
import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import { publicStats, profile, levelFromXp } from './profile';
import { canChat } from './payments';
import { socketUrl } from './config';

export type NetStatus = 'offline' | 'connecting' | 'online';

const serverUrl = socketUrl;

class Net {
  ws: WebSocket | null = null;
  status: NetStatus = 'offline';
  private subs = new Set<(m: ServerMsg) => void>();
  private statusSubs = new Set<(s: NetStatus) => void>();
  private retry = 0;
  private stopped = false;   // set when this account is suspended: no more reconnecting
  private queue: ClientMsg[] = [];
  private lastMsg = 0;
  private everOnline = false;   // only wake-up reconnects once the game has connected before (not on the landing page)
  private beat: ReturnType<typeof setInterval> | null = null;
  private wake: ReturnType<typeof setTimeout> | null = null;

  /** Phones can lose the connection without telling the page (signal drop, screen off). Ping now and then, and on wake-up; if nothing comes back, reconnect straight away. */
  private startBeat() {
    this.stopBeat();
    this.lastMsg = Date.now();
    this.beat = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      if (Date.now() - this.lastMsg > 30_000) { this.ws.close(); return; }   // silent for 30s: dead
      this.ws.send('{"t":"ping"}');
    }, 12_000);
  }
  private stopBeat() { if (this.beat) clearInterval(this.beat); this.beat = null; }
  /** The page came back to the front, or the phone got internet again. */
  checkNow() {
    if (this.stopped || !this.everOnline) return;
    if (!this.ws) { this.retry = 0; this.connect(); return; }
    if (this.ws.readyState !== WebSocket.OPEN) return;
    const ws = this.ws, mark = Date.now();
    ws.send('{"t":"ping"}');
    if (this.wake) clearTimeout(this.wake);
    this.wake = setTimeout(() => { if (this.ws === ws && this.lastMsg < mark) { this.retry = 0; ws.close(); } }, 3500);   // no answer in 3.5s: reconnect now
  }

  connect() {
    const url = serverUrl();
    if (!url || this.ws || this.stopped) return;
    this.setStatus('connecting');
    let ws: WebSocket;
    try { ws = new WebSocket(url); } catch { this.setStatus('offline'); return; }
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.everOnline = true;
      this.startBeat();
      // say who we are first, so anything that reacts to "online" (like rejoining a table) is recognised
      ws.send(JSON.stringify(this.helloMsg()));
      this.setStatus('online');
      this.queue.splice(0).filter((m) => m.t !== 'act').forEach((m) => this.send(m)); // stale moves are dropped
    };
    ws.onmessage = (e) => {
      this.lastMsg = Date.now();
      try { const m = JSON.parse(e.data) as ServerMsg; if (m.t === 'banned') this.stopped = true; this.subs.forEach((f) => f(m)); } catch { /* ignore */ }
    };
    ws.onclose = () => {
      this.stopBeat();
      this.ws = null;
      this.setStatus('offline');
      const delay = Math.min(15000, 1000 * 2 ** this.retry++); // quick retries: 1s, 2s, 4s…
      if (!this.stopped) setTimeout(() => this.connect(), delay);
    };
    ws.onerror = () => ws.close();
  }

  private helloMsg(): ClientMsg {
    const p = profile.get();
    return { t: 'hello', player: { id: p.id, name: p.name || 'Guest', avatar: p.avatar, level: levelFromXp(p.xp), chat: canChat(p), stats: publicStats(p) }, key: p.guestKey ?? undefined };
  }
  hello() { this.send(this.helloMsg()); }

  send(m: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
    else if (m.t !== 'hello' && m.t !== 'list') this.queue.push(m);
  }

  on(f: (m: ServerMsg) => void) { this.subs.add(f); return () => { this.subs.delete(f); }; }
  onStatus(f: (s: NetStatus) => void) { this.statusSubs.add(f); f(this.status); return () => { this.statusSubs.delete(f); }; }
  private setStatus(s: NetStatus) { this.status = s; this.statusSubs.forEach((f) => f(s)); }
}

export const net = new Net();
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') net.checkNow(); });
  window.addEventListener('online', () => net.checkNow());
  window.addEventListener('pageshow', () => net.checkNow());
}
