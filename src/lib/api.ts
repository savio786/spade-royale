// HTTP calls to the game server for the real leaderboard. Returns null when no server is reachable.
import type { Mode } from '../../shared/engine';

export interface BoardRow { name: string; avatar: string; earnings: number; me?: boolean }
export interface FameRow { week: string; name: string; avatar: string; earnings: number }
export interface Board {
  week: string;
  endsAt: number;
  rows: BoardRow[];
  me: { rank: number | null; earnings: number };
  lastWeek: { week: string; rank: number | null } | null;
  fame: FameRow[];
}

function apiBase(): string | null {
  if (import.meta.env.VITE_OFFLINE === '1') return null;
  const ws = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (ws) return ws.replace(/^ws/, 'http').replace(/\/ws\/?$/, '');
  const { protocol, origin } = window.location;
  return protocol === 'http:' || protocol === 'https:' ? origin : null;
}

export async function fetchBoard(id?: string): Promise<Board | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const r = await fetch(`${base}/api/leaderboard${id ? `?id=${encodeURIComponent(id)}` : ''}`);
    if (!r.ok) return null;
    const b = await r.json();
    return b && Array.isArray(b.rows) ? (b as Board) : null;
  } catch { return null; }
}

export async function reportWin(p: { id: string; name: string; avatar: string; mode: Mode; bet: number; prize: number }) {
  const base = apiBase();
  if (!base) return;
  try {
    await fetch(`${base}/api/report`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p) });
  } catch { /* offline: the win still counts on this device */ }
}
