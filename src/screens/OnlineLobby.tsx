import { useEffect, useMemo, useState } from 'react';
import { Avatar, Coin, Icon } from '../components/ui';
import { BET_STEPS, cityForBet, fmt, MAX_STEPS, MIN_STEPS, seeded, short, useProfile } from '../lib/profile';
import { Mode, prizeFor } from '../../shared/engine';
import { net, NetStatus } from '../lib/net';
import type { TableSummary } from '../../shared/protocol';
import { sfx } from '../lib/sound';
import { store } from '../lib/payments';
import { CreateTableModal, StartRequest } from './modals';

interface Row { id: string; live: boolean; mode: Mode; bet: number; minPoints: number; maxPoints: number; seated: number; avatars: string[] }

export function OnlineLobby({ onBack, onStart }: { onBack: () => void; onStart: (r: StartRequest) => void }) {
  const p = useProfile();
  const [mode, setMode] = useState<Mode>('partners');
  const [minF, setMinF] = useState<number | null>(null);
  const [maxF, setMaxF] = useState<number | null>(null);
  const [live, setLive] = useState<TableSummary[]>([]);
  const [status, setStatus] = useState<NetStatus>(net.status);
  const [creating, setCreating] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => net.onStatus(setStatus), []);
  useEffect(() => {
    const off = net.on((m) => { if (m.t === 'tables') setLive(m.tables); });
    net.send({ t: 'list' });
    const t = setInterval(() => { net.send({ t: 'list' }); setTick((x) => x + 1); }, 5000);
    return () => { off(); clearInterval(t); };
  }, []);

  const rows: Row[] = useMemo(() => {
    const r = seeded(`${mode}-${Math.floor(Date.now() / 60000)}`);
    const sim: Row[] = BET_STEPS.slice(0, 12).flatMap((bet, i) => Array.from({ length: i < 6 ? 2 : 1 }, (_, j) => ({
      id: `sim-${bet}-${j}`, live: false, mode, bet,
      minPoints: MIN_STEPS[Math.floor(r() * 3)], maxPoints: MAX_STEPS[Math.floor(r() * 5)],
      seated: 0, avatars: [],
    })));
    const liveRows: Row[] = live.filter((t) => t.phase === 'waiting' && t.settings.mode === mode).map((t) => ({
      id: t.id, live: true, mode: t.settings.mode, bet: t.settings.bet, minPoints: t.settings.minPoints, maxPoints: t.settings.maxPoints, seated: t.players, avatars: ['a2'],
    }));
    return [...liveRows, ...sim].filter((x) => (minF === null || x.minPoints === minF) && (maxF === null || x.maxPoints === maxF));
  }, [mode, live, minF, maxF, tick]);

  const cycle = (arr: number[], v: number | null, dir: 1 | -1) => {
    const opts = [null, ...arr];
    const i = opts.indexOf(v);
    return opts[(i + dir + opts.length) % opts.length];
  };

  const join = (row: Row) => {
    if (p.coins < row.bet) { store.open({ tab: 'coins', need: row.bet }); return; }
    sfx.click();
    const base = { mode: row.mode, bet: row.bet, minPoints: row.minPoints, maxPoints: row.maxPoints };
    if (row.live && status === 'online') onStart({ ...base, via: 'table', tableId: row.id });
    else onStart({ ...base, via: 'local' });
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

      <div className="tables-scroll">
        <button className="table-tile create" onClick={() => { sfx.click(); setCreating(true); }}>
          <span className="plus-big"><Icon name="plus" size={56} /></span><span>CREATE TABLE</span>
        </button>
        {rows.map((r) => {
          const poor = p.coins < r.bet;
          return (
            <button key={r.id} className={`table-tile ${poor ? 'poor' : ''}`} onClick={() => join(r)} aria-label={`${cityForBet(r.bet)} table, bet ${fmt(r.bet)}`}>
              {r.live && <span className="live-tag">LIVE</span>}
              <span className="tt-city">{cityForBet(r.bet)}</span>
              <span className="tt-felt">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={`tt-seat s${i}`}>{i < r.seated ? <Avatar k={r.avatars[i % r.avatars.length] ?? 'a1'} size={34} /> : <span className="tt-empty">+</span>}</span>
                ))}
                <span className="tt-bet"><Coin size={18} /> {short(r.bet)}</span>
              </span>
              <span className="tt-meta">{r.live ? `${r.seated}/4 seated` : 'vs computer'} · Prize {short(prizeFor({ mode: r.mode, bet: r.bet }))} · {r.minPoints}/{r.maxPoints}</span>
            </button>
          );
        })}
      </div>
      {status !== 'online' && <p className="ol-note">Offline mode — tables are filled with bots. Run the multiplayer server to see live tables.</p>}

      {creating && (
        <CreateTableModal mode={mode} onClose={() => setCreating(false)}
          onCreate={(s) => { setCreating(false); onStart({ ...s, mode, via: status === 'online' ? 'quick' : 'local' }); }} />
      )}
    </div>
  );
}
