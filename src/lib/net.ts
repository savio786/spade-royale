// WebSocket link to the multiplayer server. The app works fully offline (bots)
// and upgrades to live tables when the server is reachable.
import type { ClientMsg, ServerMsg } from '../../shared/protocol';
import { profile, levelFromXp } from './profile';

export type NetStatus = 'offline' | 'connecting' | 'online';

function serverUrl() {
  if (import.meta.env.VITE_OFFLINE === '1') return null; // static hosting without the multiplayer server
  const env = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (env) return env;
  const { protocol, host } = window.location;
  if (protocol !== 'http:' && protocol !== 'https:') return null; // native shell without a configured server
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}/ws`;
}

class Net {
  ws: WebSocket | null = null;
  status: NetStatus = 'offline';
  private subs = new Set<(m: ServerMsg) => void>();
  private statusSubs = new Set<(s: NetStatus) => void>();
  private retry = 0;
  private queue: ClientMsg[] = [];

  connect() {
    const url = serverUrl();
    if (!url || this.ws) return;
    this.setStatus('connecting');
    let ws: WebSocket;
    try { ws = new WebSocket(url); } catch { this.setStatus('offline'); return; }
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.setStatus('online');
      this.hello();
      this.queue.splice(0).forEach((m) => this.send(m));
    };
    ws.onmessage = (e) => {
      try { const m = JSON.parse(e.data) as ServerMsg; this.subs.forEach((f) => f(m)); } catch { /* ignore */ }
    };
    ws.onclose = () => {
      this.ws = null;
      this.setStatus('offline');
      const delay = Math.min(30000, 2000 * 2 ** this.retry++);
      setTimeout(() => this.connect(), delay);
    };
    ws.onerror = () => ws.close();
  }

  hello() {
    const p = profile.get();
    this.send({ t: 'hello', player: { id: p.id, name: p.name || 'Guest', avatar: p.avatar, level: levelFromXp(p.xp) } });
  }

  send(m: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
    else if (m.t !== 'hello' && m.t !== 'list') this.queue.push(m);
  }

  on(f: (m: ServerMsg) => void) { this.subs.add(f); return () => { this.subs.delete(f); }; }
  onStatus(f: (s: NetStatus) => void) { this.statusSubs.add(f); f(this.status); return () => { this.statusSubs.delete(f); }; }
  private setStatus(s: NetStatus) { this.status = s; this.statusSubs.forEach((f) => f(s)); }
}

export const net = new Net();
