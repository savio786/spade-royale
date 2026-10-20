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
          <span className="lt-create-shape"><Icon name="plus" size={64} /></span>
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

