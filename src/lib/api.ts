// HTTP calls to the game server for the real leaderboard. Returns null when no server is reachable.
import type { Mode } from '../../shared/engine';
import { serverOrigin } from './config';

export interface BoardRow { name: string; avatar: string; earnings: number; me?: boolean }
export interface FameRow { week: string; name: string; avatar: string; earnings: number }
export interface Board {
  week: string;
  endsAt: number;
  rows: BoardRow[];
  me: { rank: number | null; earnings: number };
  lastWeek: { week: string; rank: number | null; rows?: BoardRow[] } | null;
  fame: FameRow[];
  allTime?: BoardRow[];
  meAllTime?: { rank: number | null; earnings: number };
}

const apiBase = serverOrigin;

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

export async function reportWin(p: { id: string; name: string; avatar: string; mode: Mode; bet: number; prize: number; lost?: boolean }) {
  const base = apiBase();
  if (!base) return;
  try {
    await fetch(`${base}/api/report`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p) });
  } catch { /* offline: the win still counts on this device */ }
}
