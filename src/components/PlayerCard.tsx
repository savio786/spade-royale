// Player profile card: coins, level, city rings and career statistics. Opens when you tap a player's picture.
import { useEffect } from 'react';
import { Avatar, Coin, Icon } from './ui';
import { CityRing, lookFor } from './CityRing';
import { CITIES, type PublicStats } from '../../shared/engine';
import { fmt } from '../lib/profile';
import { sfx } from '../lib/sound';
import { social, useSocial } from '../lib/social';

export interface CardPlayer { name: string; avatar: string; level: number; bot?: boolean; stats?: PublicStats; levelPct?: number; id?: string }

/** Add friend / request sent / accept / already friends: only for other real players. */
function FriendAction({ id }: { id: string }) {
  const s = useSocial();
  if (s.friends.some((f) => f.id === id)) return <span className="pcd-friend done">✓ FRIENDS</span>;
  if (s.outgoing.some((f) => f.id === id)) return <span className="pcd-friend done">REQUEST SENT</span>;
  if (s.incoming.some((f) => f.id === id)) return <button className="pcd-friend" onClick={() => { sfx.click(); social.accept(id); }}>ACCEPT FRIEND REQUEST</button>;
  return <button className="pcd-friend" onClick={() => { sfx.click(); social.addById(id); }}>+ ADD FRIEND</button>;
}

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 1000) / 10}%` : '0%');

export function PlayerCard({ player, onClose }: { player: CardPlayer; onClose: () => void }) {
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  const s = player.stats ?? { coins: 0, played: 0, won: 0, last5: '', nil: 0, nilMade: 0, blind: 0, blindMade: 0, rings: {} };
  const last5 = s.last5.padStart(5, '-').split('');
  const tiles: [string, string][] = [
    ['GAMES PLAYED', fmt(s.played)], ['GAMES WON', fmt(s.won)], ['SUCCESS RATE', pct(s.won, s.played)],
    ['NIL', fmt(s.nil)], ['NIL SUCCESS', pct(s.nilMade, s.nil)], ['BLIND NIL', fmt(s.blind)], ['BLIND NIL SUCCESS', pct(s.blindMade, s.blind)],
  ];
  return (
    <div className="pc-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pcd" role="dialog" aria-modal="true" aria-label={`${player.name}'s profile`}>
        <button className="tm-close pcd-close" onClick={() => { sfx.click(); onClose(); }} aria-label="Close"><Icon name="close" size={24} /></button>
        <header className="pcd-head">
          <div className="pcd-nums">
            <span className="pcd-coins"><Coin size={44} /><b>{fmt(s.coins)}</b></span>
            <span className="pcd-level"><span className="pcd-lvfill" style={{ width: `${player.levelPct ?? 55}%` }} /><span className="pcd-star">★</span><b>LEVEL {player.level}</b></span>
          </div>
          <div className="pcd-who">
            <span className="pcd-pic"><Avatar k={player.avatar} size={150} name={player.name} /></span>
            <h2 className="pcd-name">{player.name}</h2>
            {player.bot && <span className="pcd-cpu">COMPUTER PLAYER</span>}
            {player.id && !player.bot && <FriendAction id={player.id} />}
          </div>
        </header>
        <section className="pcd-sec">
          <h3>RINGS</h3>
          <div className="pcd-rings">
            {CITIES.map((c) => {
              const n = s.rings[c] ?? 0;
              return (
                <div key={c} className={`pcd-ring ${n ? '' : 'none'}`} title={n ? `${n} win${n === 1 ? '' : 's'} in ${c}` : `No wins in ${c} yet`}>
                  <small>{c.toUpperCase()}</small>
                  <CityRing gem={lookFor(c).gem} className="pcd-ring-art" />
                  {n > 0 && <i>×{n}</i>}
                </div>
              );
            })}
          </div>
        </section>
        <section className="pcd-sec">
          <h3>STATISTICS</h3>
          <div className="pcd-stats">
            <div className="pcd-tile last5">
              <span>LAST 5 GAMES</span>
              <div className="pcd-l5">{last5.map((r, i) => <em key={i} className={r === 'W' ? 'w' : r === 'L' ? 'l' : ''}><i>{r === 'W' ? '▲' : r === 'L' ? '▼' : ''}</i>{r === '-' ? '' : r}</em>)}</div>
            </div>
            {tiles.map(([l, v]) => <div key={l} className="pcd-tile"><span>{l}</span><b>{v}</b></div>)}
          </div>
        </section>
      </div>
    </div>
  );
}
