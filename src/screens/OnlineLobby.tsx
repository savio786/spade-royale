import { useEffect, useMemo, useState } from 'react';
import { Avatar, Coin, Icon } from '../components/ui';
import { TableShape } from '../components/TableShape';
import { cityForBet, fmt, MAX_STEPS, MIN_STEPS, useProfile } from '../lib/profile';
import type { Mode } from '../../shared/engine';
import { net, NetStatus } from '../lib/net';
import type { TableSummary } from '../../shared/protocol';
import { sfx } from '../lib/sound';
import { store } from '../lib/payments';
import { themeById, themeVars } from '../lib/themes';
import { CreateTableModal, RoomTypeModal, StartRequest } from './modals';
import type { OnlineCounts } from '../../shared/protocol';
import { CityRing, lookFor } from '../components/CityRing';

/** Order joining players are seated in (matches the server): partners sit across from each other. */
const joinSeat = (t: TableSummary) => {
  const order = t.settings.mode === 'partners' ? [0, 2, 1, 3] : [0, 1, 2, 3];
  return order.find((i) => !t.seats[i]) ?? -1;
};

export function OnlineLobby({ onBack, onStart }: { onBack: () => void; onStart: (r: StartRequest) => void }) {
  const p = useProfile();
  const [mode, setMode] = useState<Mode>('partners');
  const [minF, setMinF] = useState<number | null>(null);
  const [maxF, setMaxF] = useState<number | null>(null);
  const [live, setLive] = useState<TableSummary[] | null>(null);
  const [status, setStatus] = useState<NetStatus>(net.status);
  const [creating, setCreating] = useState<null | 'pick' | Mode>(null);
  const [online, setOnline] = useState<OnlineCounts | null>(null);

  useEffect(() => net.onStatus(setStatus), []);
  useEffect(() => {
    const off = net.on((m) => { if (m.t === 'tables') { setLive(m.tables); setOnline(m.online); } if (m.t === 'welcome') setOnline(m.online); });
    net.send({ t: 'list' });
    const t = setInterval(() => net.send({ t: 'list' }), 3000);
    return () => { off(); clearInterval(t); };
  }, []);

  const tables = useMemo(() => (live ?? [])
    .filter((t) => t.settings.mode === mode && (minF === null || t.settings.minPoints === minF) && (maxF === null || t.settings.maxPoints === maxF))
    .sort((a, b) => Number(b.phase === 'waiting') - Number(a.phase === 'waiting') || a.settings.bet - b.settings.bet), [live, mode, minF, maxF]);

  const cycle = (arr: number[], v: number | null, dir: 1 | -1) => {
    const opts = [null, ...arr];
    return opts[(opts.indexOf(v) + dir + opts.length) % opts.length];
  };

  const join = (t: TableSummary) => {
    if (t.phase !== 'waiting' || joinSeat(t) < 0) return;
    if (p.coins < t.settings.bet) { store.open({ tab: 'coins', need: t.settings.bet }); return; }
    sfx.click();
    const s = t.settings;
    onStart({ mode: s.mode, bet: s.bet, minPoints: s.minPoints, maxPoints: s.maxPoints, via: 'table', tableId: t.id });
  };

  return (
    <div className="screen online-lobby city-bg">
      <header className="ol-head">
        <button className="back-btn" onClick={() => { sfx.click(); onBack(); }} aria-label="Back to lobby"><Icon name="left" size={28} /></button>
        <div className="ol-box">
          <span className="ol-label">ROOM TYPE</span>
          <div className="ol-ctl">
            <button aria-label="Previous room type" onClick={() => setMode(mode === 'solo' ? 'partners' : 'solo')}><Icon name="left" size={18} /></button>
            <b>{mode.toUpperCase()} {mode === 'partners' ? '♠♠' : '♠'}</b>
            <button aria-label="Next room type" onClick={() => setMode(mode === 'solo' ? 'partners' : 'solo')}><Icon name="right" size={18} /></button>
          </div>
        </div>
        <div className="ol-box wide">
          <span className="ol-label">GAME ENDING POINTS</span>
          <div className="ol-dual">
            <div className="ol-ctl"><em>MIN</em>
              <button aria-label="Previous minimum" onClick={() => setMinF(cycle(MIN_STEPS, minF, -1))}><Icon name="minus" size={16} /></button>
              <b>{minF ?? 'ANY'}</b>
              <button aria-label="Next minimum" onClick={() => setMinF(cycle(MIN_STEPS, minF, 1))}><Icon name="plus" size={16} /></button></div>
            <div className="ol-ctl"><em>MAX</em>
              <button aria-label="Previous maximum" onClick={() => setMaxF(cycle(MAX_STEPS, maxF, -1))}><Icon name="minus" size={16} /></button>
              <b>{maxF ?? 'ANY'}</b>
              <button aria-label="Next maximum" onClick={() => setMaxF(cycle(MAX_STEPS, maxF, 1))}><Icon name="plus" size={16} /></button></div>
          </div>
        </div>
        <div className="coins-pill small"><Coin size={26} /><span className="coins-num">{fmt(p.coins)}</span></div>
      </header>

      <div className="lt-row">
        <button className="lt-create" onClick={() => { sfx.click(); setCreating('pick'); }} aria-label="Create a table">
          <CreateTableArt />
          <span className="lt-create-txt">CREATE TABLE</span>
        </button>
        {tables.map((t) => <LobbyTable key={t.id} t={t} poor={p.coins < t.settings.bet} onJoin={() => join(t)} />)}
        {tables.length === 0 && (
          <div className="lt-empty" role="status">
            {status !== 'online' ? (
              <><b>Can’t reach the game server</b><p>Live tables appear here when you’re online. You can still play against the computer from PLAY NOW.</p></>
            ) : live === null ? (
              <b>Looking for tables…</b>
            ) : (
              <><b>No one is playing {mode === 'partners' ? 'Partners' : 'Solo'} right now</b>
                <p>Tables with real players show up here as soon as someone sits down. Create one and others can join you.</p></>
            )}
          </div>
        )}
      </div>

      {creating === 'pick' && (
        <RoomTypeModal title="CHOOSE YOUR TABLE" online={status === 'online' ? online : null} onClose={() => setCreating(null)} onPick={(m) => { setMode(m); setCreating(m); }} />
      )}
      {(creating === 'solo' || creating === 'partners') && (
        <CreateTableModal mode={creating} onClose={() => setCreating(null)}
          onCreate={(s) => { const m = creating; setCreating(null); onStart({ ...s, mode: m, via: status === 'online' ? 'quick' : 'local' }); }} />
      )}
    </div>
  );
}

function LobbyTable({ t, poor, onJoin }: { t: TableSummary; poor: boolean; onJoin: () => void }) {
  const city = t.settings.city || cityForBet(t.settings.bet);
  const look = lookFor(city);
  const waiting = t.phase === 'waiting';
  const mine = joinSeat(t);
  // show the table from the seat you'd take: that seat is the PLAY button at the bottom
  const base = mine >= 0 ? mine : 0;
  const pos = ['bottom', 'left', 'top', 'right'];
  const partners = t.settings.mode === 'partners';
  const humans = t.seats.filter((s) => s && !s.bot).length;
  return (
    <div className={`lt ${poor ? 'poor' : ''} ${waiting ? '' : 'busy'}`} style={themeVars(themeById(look.theme))}>
      <TableShape scale={0.62} emblem={false} />
      <div className="lt-felt">
        <div className="lt-city"><span>{city}</span><CityRing gem={look.gem} /></div>
        <div className="lt-pills">
          <span className="lt-pill">{fmt(t.settings.bet)} <Coin size={30} /></span>
          <span className="lt-pill">{t.settings.minPoints}/{t.settings.maxPoints}</span>
        </div>
        <span className="lt-status">{waiting ? `${humans} real player${humans === 1 ? '' : 's'} waiting` : 'GAME IN PROGRESS'}</span>
      </div>
      {[0, 1, 2, 3].map((seat) => {
        const rel = (seat - base + 4) % 4;
        const where = pos[rel];
        if (rel === 0 && mine >= 0) return null; // your seat = PLAY button
        const s = t.seats[seat];
        const friendly = partners ? rel === 2 : false;
        return (
          <span key={seat} className={`lt-seat at-${where} ${friendly ? 'blue' : 'red'}`}>
            {s ? <><span className="bezel" /><Avatar k={s.avatar} size={78} name={s.name} /><small className="lt-name">{s.name}</small></> : <span className="lt-q">?</span>}
          </span>
        );
      })}
      {waiting && mine >= 0 ? (
        <button className="lt-play" onClick={onJoin} aria-label={`Play at ${city} table, bet ${fmt(t.settings.bet)}`}>
          <span className="lt-arrow">↑</span><b>PLAY</b>
        </button>
      ) : (
        <span className="lt-live" aria-label="Game in progress">● LIVE</span>
      )}
    </div>
  );
}


/** Gold-rimmed, table-shaped tile (with the seat notch at the bottom) and a raised gold plus. */
const OUTER = 'M44 10 H276 Q310 10 310 44 V136 Q310 170 276 170 H222 C206 170 204 142 186 142 H134 C116 142 114 170 98 170 H44 Q10 170 10 136 V44 Q10 10 44 10 Z';
const INNER = 'M50 22 H270 Q298 22 298 50 V130 Q298 158 270 158 H226 C212 158 208 130 186 130 H134 C112 130 108 158 94 158 H50 Q22 158 22 130 V50 Q22 22 50 22 Z';
const PLUS = 'M148 44 H172 Q178 44 178 50 V72 H200 Q206 72 206 78 V100 Q206 106 200 106 H178 V128 Q178 134 172 134 H148 Q142 134 142 128 V106 H120 Q114 106 114 100 V78 Q114 72 120 72 H142 V50 Q142 44 148 44 Z';
function CreateTableArt() {
  return (
    <svg className="lt-create-art" viewBox="0 0 320 184" aria-hidden="true">
      <defs>
        <linearGradient id="ct-rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff4c2" /><stop offset=".22" stopColor="#f5c84a" /><stop offset=".55" stopColor="#a8700c" /><stop offset=".8" stopColor="#f0be45" /><stop offset="1" stopColor="#7a4e05" /></linearGradient>
        <radialGradient id="ct-felt" cx=".5" cy=".42" r=".7"><stop offset="0" stopColor="#5a4fd6" /><stop offset=".6" stopColor="#3a2f9e" /><stop offset="1" stopColor="#1f1863" /></radialGradient>
        <pattern id="ct-pat" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M13 5 C10 9 6 11 6 14 C6 16.5 8 17.6 10 17.4 C11 17.3 11.8 16.8 12.3 16.2 C12.1 17.7 11.4 18.8 10.2 19.6 H15.8 C14.6 18.8 13.9 17.7 13.7 16.2 C14.2 16.8 15 17.3 16 17.4 C18 17.6 20 16.5 20 14 C20 11 16 9 13 5 Z" fill="#fff" fillOpacity=".06" /></pattern>
        <linearGradient id="ct-plus" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff6c8" /><stop offset=".35" stopColor="#ffd04a" /><stop offset=".75" stopColor="#d18f12" /><stop offset="1" stopColor="#f6c84c" /></linearGradient>
        <filter id="ct-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7" /></filter>
      </defs>
      <path d={OUTER} transform="translate(0 6)" fill="#2a1a00" opacity=".55" />
      <path d={OUTER} fill="url(#ct-rim)" />
      <path d={OUTER} fill="none" stroke="#fff6cf" strokeOpacity=".7" strokeWidth="1.5" />
      <path d={INNER} fill="#4a2f04" transform="translate(0 -2)" />
      <path d={INNER} fill="url(#ct-felt)" />
      <path d={INNER} fill="url(#ct-pat)" />
      <path d={INNER} fill="none" stroke="#000" strokeOpacity=".45" strokeWidth="5" />
      <ellipse cx="160" cy="89" rx="46" ry="40" fill="#ffc83d" opacity=".45" filter="url(#ct-glow)" className="ct-glow" />
      <path d={PLUS} transform="translate(0 6)" fill="#6a4204" />
      <path d={PLUS} transform="translate(0 3)" fill="#a8700c" />
      <path d={PLUS} fill="url(#ct-plus)" stroke="#7a4e05" strokeWidth="1.5" />
      <path d="M146 50 H174 M120 78 H142 M178 78 H200" stroke="#fffbe6" strokeOpacity=".8" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
