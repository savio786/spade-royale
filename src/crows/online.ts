// Crows Haven online play: talks to the Crows Haven game server (crows-server/, on Cloudflare).
// The server address comes from VITE_CROWS_SERVER (set in the crows-haven Vercel project). Without it,
// online play is hidden and the game is played against computer players in the browser only.
import { useEffect, useRef, useState } from 'react';
import type { ClientMsg, ServerMsg, TableInfo } from '../../shared/crows/protocol';
import type { CrowsPublicState } from '../../shared/crows/engine';
import { profile } from '../lib/profile';
import { MY_PHOTO } from './CrowsExtras';

const SERVER = ((import.meta.env.VITE_CROWS_SERVER as string | undefined) ?? '').replace(/\/+$/, '');
export const onlineAvailable = () => !!SERVER;

async function call<T>(path: string, body?: object): Promise<T> {
  const r = await fetch(SERVER + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'The game server can’t be reached right now.');
  return j as T;
}
export const quickMatch = (target: number) => call<{ tableId: string }>('/quick', { target }).then((r) => r.tableId);
export const createPrivate = (target: number) => call<{ tableId: string; code: string }>('/private', { target });
export const findCode = (code: string) => call<{ tableId: string }>(`/code/${encodeURIComponent(code.trim().toUpperCase())}`).then((r) => r.tableId);

export interface ChatLine { id: number; seat: number; text: string; at: number }
export type ConnStatus = 'connecting' | 'ok' | 'lost' | 'closed' | 'full';

const tokKey = (tableId: string) => `crowsTok:${tableId}`;
const readTok = (tableId: string) => { try { return sessionStorage.getItem(tokKey(tableId)); } catch { return null; } };
const saveTok = (tableId: string, t: string) => { try { sessionStorage.setItem(tokKey(tableId), t); } catch { /* private mode */ } };

let chatSeq = 0;

/** One online table: connects, keeps the latest state, reconnects after a dropped connection. */
export function useOnlineTable(tableId: string) {
  const [view, setView] = useState<CrowsPublicState | null>(null);
  const [info, setInfo] = useState<TableInfo | null>(null);
  const [seat, setSeat] = useState(-1);
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [reason, setReason] = useState<string | null>(null);
  const [error, setError] = useState<{ text: string; at: number } | null>(null);
  const [chats, setChats] = useState<ChatLine[]>([]);
  const [skew, setSkew] = useState(0);
  const ws = useRef<WebSocket | null>(null);
  const done = useRef(false);

  useEffect(() => {
    done.current = false;
    let tries = 0, timer = 0, joinedOnce = false;
    const open = () => {
      const s = new WebSocket(`${SERVER.replace(/^http/, 'ws')}/ws/${tableId}`);
      ws.current = s;
      s.onopen = () => {
        const p = profile.get();
        s.send(JSON.stringify({ t: 'hello', pid: p.id, name: p.name, avatar: p.avatar === MY_PHOTO ? 'f2' : p.avatar, token: readTok(tableId) } satisfies ClientMsg));
      };
      s.onmessage = (e) => {
        const m = JSON.parse(String(e.data)) as ServerMsg;
        if (m.t === 'joined') { tries = 0; joinedOnce = true; setSeat(m.seat); saveTok(tableId, m.token); setInfo(m.info); setSkew(m.info.now - Date.now()); setStatus('ok'); }
        else if (m.t === 'state') { setView(m.view); setInfo(m.info); setSkew(m.info.now - Date.now()); }
        else if (m.t === 'chat') setChats((c) => [...c.slice(-60), { id: ++chatSeq, seat: m.seat, text: m.text, at: Date.now() }]);
        else if (m.t === 'error') { if (m.code === 'full') { done.current = true; setStatus('full'); } else setError({ text: m.message, at: Date.now() }); }
        else if (m.t === 'closed') { done.current = true; setReason(m.reason); setStatus('closed'); }
      };
      s.onclose = () => {
        if (done.current) return;
        setStatus('lost');
        tries++;
        if (!joinedOnce && tries >= 3) { setReason('This table no longer exists.'); setStatus('closed'); forgetTable(); return; }
        if (tries > 12) { setReason('Lost connection to the game server.'); setStatus('closed'); return; }
        timer = window.setTimeout(open, Math.min(8000, 600 * tries));
      };
    };
    open();
    return () => { done.current = true; clearTimeout(timer); ws.current?.close(); };
  }, [tableId]);

  const send = (m: ClientMsg) => { if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(m)); };
  const leave = () => { done.current = true; send({ t: 'leave' }); ws.current?.close(); };
  /** milliseconds left until a server time */
  const left = (at: number | null | undefined) => (at ? Math.max(0, at - skew - Date.now()) : null);
  return { view, info, seat, status, reason, error, chats, send, leave, left };
}

/** The online table you're at, remembered for this browser tab so a reload puts you back in your seat. */
const CUR = 'crowsCurrentTable';
export const rememberTable = (tableId: string) => { try { sessionStorage.setItem(CUR, tableId); } catch { /* private mode */ } };
export const forgetTable = () => { try { sessionStorage.removeItem(CUR); } catch { /* private mode */ } };
export const currentTable = () => { try { return onlineAvailable() ? sessionStorage.getItem(CUR) : null; } catch { return null; } };

/** Ask the game server for a name (or, with check, only whether it's free). */
export const nameOnServer = (pid: string, secret: string, name: string, check = false) =>
  fetch(SERVER + '/name', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pid, secret, name, check }) })
    .then((r) => r.json() as Promise<{ ok: boolean; name?: string; message?: string; taken?: boolean }>);
