import React, { useCallback, useEffect, useState } from 'react';
import { Landing } from './screens/Landing';
import { Login } from './screens/Login';
import { Lobby } from './screens/Lobby';
import { OnlineLobby } from './screens/OnlineLobby';
import { Table } from './screens/Table';
import { StartRequest } from './screens/modals';
import { LocalController, RemoteController, TableController } from './lib/controller';
import { cityForBet, profile, useProfile } from './lib/profile';
import { net } from './lib/net';
import { useToasts, toast } from './lib/toast';
import { Coin } from './components/ui';
import { Capacitor } from '@capacitor/core';
import type { TableSettings } from '../shared/engine';

type Screen = 'lobby' | 'online' | 'table';

interface BIPEvent extends Event { prompt: () => Promise<void> }

const isAppShell = () => Capacitor.isNativePlatform() || window.matchMedia('(display-mode: standalone)').matches;

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => { const h = () => setHash(window.location.hash); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  return hash;
}

export default function App() {
  const p = useProfile();
  const hash = useHashRoute();
  const inApp = hash.startsWith('#/play') || hash === '#play' || isAppShell();
  const [screen, setScreen] = useState<Screen>('lobby');
  const [ctl, setCtl] = useState<TableController | null>(null);
  const [tableKey, setTableKey] = useState(0);
  const [lastReq, setLastReq] = useState<StartRequest | null>(null);
  const [bip, setBip] = useState<BIPEvent | null>(null);
  const toasts = useToasts();

  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setBip(e as BIPEvent); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  useEffect(() => { if (inApp && p.provider) net.connect(); }, [inApp, p.provider]);
  useEffect(() => { if (p.provider && net.status === 'online') net.hello(); }, [p.name, p.avatar, p.provider]);

  const installPrompt = bip ? () => { bip.prompt(); setBip(null); } : null;

  const start = useCallback((r: StartRequest) => {
    if (r.via !== 'joinPrivate' && profile.get().coins < r.bet) { toast('Not enough coins for that table', 'error'); return; }
    const settings: TableSettings = { mode: r.mode, bet: r.bet, minPoints: r.minPoints, maxPoints: r.maxPoints, city: cityForBet(r.bet), isPrivate: r.via === 'createPrivate' || (r.via === 'local' && !!r.code) };
    let c: TableController;
    const online = net.status === 'online';
    if (r.via === 'quick' && online) c = new RemoteController({ kind: 'quick', settings });
    else if (r.via === 'table' && online && r.tableId) c = new RemoteController({ kind: 'table', tableId: r.tableId, settings });
    else if (r.via === 'createPrivate' && online) c = new RemoteController({ kind: 'createPrivate', settings });
    else if (r.via === 'joinPrivate' && online && r.code) c = new RemoteController({ kind: 'joinPrivate', code: r.code, settings });
    else c = new LocalController(settings);
    setLastReq(r.via === 'joinPrivate' || r.via === 'createPrivate' ? null : r);
    setCtl(c);
    setTableKey((k) => k + 1);
    setScreen('table');
  }, []);

  let body;
  if (!inApp) body = <Landing onPlay={() => { window.location.hash = '#play'; }} installPrompt={installPrompt} />;
  else if (!p.provider) body = <Login />;
  else if (screen === 'table' && ctl) body = (
    <Table key={tableKey} ctl={ctl}
      onExit={() => { setCtl(null); setScreen('lobby'); }}
      onPlayAgain={() => { setCtl(null); if (lastReq) start(lastReq); else setScreen('lobby'); }} />
  );
  else if (screen === 'online') body = <OnlineLobby onBack={() => setScreen('lobby')} onStart={start} />;
  else body = <Lobby onStart={start} onOnlineLobby={() => setScreen('online')} installPrompt={installPrompt} />;

  return (
    <>
      {inApp ? <Stage>{body}</Stage> : body}
      {inApp && <RotateHint />}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.kind === 'coins' && <Coin size={18} />} {t.text}</div>)}
      </div>
    </>
  );
}

/** Game screens are laid out on a landscape stage that scales to any window, iPad or phone. */
function Stage({ children }: { children: React.ReactNode }) {
  const calc = () => {
    const vw = window.innerWidth, vh = window.innerHeight, ar = vw / vh;
    const W = Math.round(Math.min(1600, Math.max(1280, 720 * ar)));
    const H = Math.round(Math.min(1000, Math.max(720, 1280 / ar)));
    return { W, H, s: Math.min(vw / W, vh / H) };
  };
  const [d, setD] = useState(calc);
  useEffect(() => { const h = () => setD(calc()); window.addEventListener('resize', h); window.addEventListener('orientationchange', h); return () => { window.removeEventListener('resize', h); window.removeEventListener('orientationchange', h); }; }, []);
  return (
    <div className="stage-outer felt-bg">
      <div className="stage" style={{ width: d.W, height: d.H, transform: `translate(-50%, -50%) scale(${d.s})` }}>{children}</div>
    </div>
  );
}

function RotateHint() {
  return <div className="rotate-hint"><div>↻</div><p>Turn your device sideways for the best table view</p></div>;
}
