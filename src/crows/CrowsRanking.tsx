// Crows Haven weekly ranking: sends each finished game to /api/crows-rank and shows the week's top players.
import { useEffect, useState } from 'react';
import { profile } from '../lib/profile';
import { CrowsAvatar, MY_PHOTO } from './CrowsExtras';
import { sfx } from '../lib/sound';

const API = '/api/crows-rank';
const SECRET_KEY = 'crowsRankSecret';

/** A random secret that ties this player's ranking entry to this device. */
/** Also proves which device owns a player name (see ./names.ts). */
export function deviceSecret() {
  try {
    let s = localStorage.getItem(SECRET_KEY);
    if (!s) { s = Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem(SECRET_KEY, s); }
    return s;
  } catch { return null; }
}

/** Record one finished game for the weekly ranking (quietly does nothing if the ranking isn't set up). */
export async function reportGame(won: boolean, points: number): Promise<{ rank?: number } | null> {
  const p = profile.get();
  const secret = deviceSecret();
  if (!secret) return null;
  try {
    const r = await fetch(API, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: p.id, secret, name: p.name, avatar: p.avatar === MY_PHOTO ? '' : p.avatar, won, points: Math.max(0, points) }),
    });
    const j = await r.json().catch(() => null);
    return j?.ok ? { rank: j.rank } : null;
  } catch { return null; }
}

interface Row { rank: number; name: string; avatar: string; wins: number; games: number; points: number }
interface Board { configured: boolean; week?: string; endsAt?: number; rows?: Row[]; me?: Row | null; error?: string }

const left = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
};

export function CrowsRanking({ onBack }: { onBack: () => void }) {
  const [which, setWhich] = useState<'this' | 'last'>('this');
  const [board, setBoard] = useState<Board | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  useEffect(() => {
    setBoard(null); setFailed(false);
    fetch(`${API}?which=${which}&id=${encodeURIComponent(profile.get().id)}`)
      .then((r) => r.json()).then((j: Board) => setBoard(j)).catch(() => setFailed(true));
  }, [which]);
  const me = profile.get();
  return (
    <div className="screen crows-home felt-bg">
      <div className="ch-card crows-rank">
        <div className="cr-head">
          <button className="cl-btn ghost" onClick={() => { sfx.click(); onBack(); }}>← Back</button>
          <h1>WEEKLY RANKING</h1>
          <span />
        </div>
        <div className="cr-tabs" role="tablist">
          <button role="tab" aria-selected={which === 'this'} className={which === 'this' ? 'on' : ''} onClick={() => setWhich('this')}>This week</button>
          <button role="tab" aria-selected={which === 'last'} className={which === 'last' ? 'on' : ''} onClick={() => setWhich('last')}>Last week</button>
        </div>
        {failed || board?.error ? (
          <p>The ranking can't be reached right now. Please try again in a moment.</p>
        ) : !board ? (
          <p>Loading…</p>
        ) : !board.configured ? (
          <p>The weekly ranking is almost ready. Once it's switched on, every game you finish counts: most wins this week takes the top spot.</p>
        ) : (
          <>
            {which === 'this' && board.endsAt && <p className="cr-sub">Ranked by games won, then points. New week in <b>{left(board.endsAt - now)}</b> (Sunday, 00:00 UTC).</p>}
            {board.me
              ? <p className="cr-sub">You're <b>#{board.me.rank}</b> · {board.me.wins} won of {board.me.games} · {board.me.points} pts</p>
              : which === 'this' && <p className="cr-sub">Finish a game to get on this week's ranking.</p>}
            {board.rows && board.rows.length > 0 ? (
              <div className="cr-table" role="table" aria-label="Weekly ranking">
                <div className="cr-row cr-th" role="row"><span>#</span><span>Player</span><span>Won</span><span>Games</span><span>Points</span></div>
                {board.rows.map((r) => {
                  const mine = board.me && r.rank === board.me.rank;
                  return (
                    <div key={r.rank} className={`cr-row ${mine ? 'me' : ''} ${r.rank <= 3 ? `top${r.rank}` : ''}`} role="row">
                      <span className="cr-rank">{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</span>
                      <span className="cr-name">
                        {mine ? <CrowsAvatar k={me.avatar} size={34} /> : r.avatar ? <CrowsAvatar k={r.avatar} size={34} /> : <span className="cr-initial">{r.name.slice(0, 1).toUpperCase()}</span>}
                        {r.name}{mine && <small> (you)</small>}
                      </span>
                      <span>{r.wins}</span><span>{r.games}</span><span>{r.points}</span>
                    </div>
                  );
                })}
              </div>
            ) : <p>No games recorded {which === 'this' ? 'yet this week — be the first!' : 'last week.'}</p>}
          </>
        )}
      </div>
    </div>
  );
}
