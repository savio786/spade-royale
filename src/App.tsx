import React, { useCallback, useEffect, useState } from 'react';
import { Landing } from './screens/Landing';
import { Login } from './screens/Login';
import { Lobby } from './screens/Lobby';
import { OnlineLobby } from './screens/OnlineLobby';
import { Table } from './screens/Table';
import { LegalPage } from './screens/Legal';
import { InstallPage } from './screens/Install';
import { StartRequest, StoreModal } from './screens/modals';
import { afterCheckoutReturn, loadPaymentConfig, store, syncPurchases, useStoreRequest } from './lib/payments';
import { LocalController, RemoteController, TableController } from './lib/controller';
import { cityForBet, profile, useProfile } from './lib/profile';
import { net } from './lib/net';
import { useToasts, toast } from './lib/toast';
import { Coin } from './components/ui';
import { HelpBot } from './components/HelpBot';
import { AddToHome } from './components/AddToHome';
import { helpBot } from './lib/helpbot';
import { pullGuestProgress, startGuestSync } from './lib/guest';

startGuestSync();
import { Capacitor } from '@capacitor/core';
import type { TableSettings } from '../shared/engine';

type Screen = 'lobby' | 'online' | 'table';

interface BIPEvent extends Event { prompt: () => Promise<void> }

// coming back from a PayPal/Stripe payment page (…/?purchase=…): open the game, not the welcome page
if (/[?&]purchase=/.test(window.location.search) && !window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search + '#play');

const isAppShell = () => Capacitor.isNativePlatform() || window.matchMedia('(display-mode: standalone)').matches;

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => { const h = () => setHash(window.location.hash); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  return hash;
}

export default function App() {
  const p = useProfile();
  const hash = useHashRoute();
  const resetToken = hash.match(/^#\/play\/reset\/([\w-]{20,60})$/)?.[1];
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
  useEffect(() => net.on((m) => { if (m.t === 'notice') toast(m.message); }), []);
  useEffect(() => { if (inApp) void pullGuestProgress(); }, [inApp]);
  useEffect(() => { if (p.provider && net.status === 'online') net.hello(); }, [p.name, p.avatar, p.provider, p.chatUntil, p.vip]);
  useEffect(() => {
    if (!inApp) return;
    loadPaymentConfig().then(() => { afterCheckoutReturn(); syncPurchases(); });
    const onFocus = () => syncPurchases();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [inApp]);
  const storeReq = useStoreRequest();
  useEffect(() => { helpBot.close(); }, [inApp]); // landing ↔ game: start with the help chat closed

  const installPrompt = bip ? () => { bip.prompt(); setBip(null); } : null;

  const start = useCallback((r: StartRequest) => {
    if (r.via !== 'joinPrivate' && profile.get().coins < r.bet) { store.open({ tab: 'coins', need: r.bet }); return; }
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

  // the install link: spade-haven.onrender.com/install (or #install)
  if (hash === '#install' || /^\/install\/?$/.test(window.location.pathname)) return <InstallPage installPrompt={installPrompt} />;
  const legal = hash === '#privacy' ? 'privacy' : hash === '#terms' ? 'terms' : null;
  if (legal) return <LegalPage page={legal} />;
  let body;
  if (!inApp) body = <Landing onPlay={() => { window.location.hash = '#play'; }} installPrompt={installPrompt} />;
  else if (resetToken) body = <Login resetToken={resetToken} />;
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
      {inApp ? <Stage>{body}{p.provider && screen === 'lobby' && !ctl && <AddToHome installPrompt={installPrompt} />}<HelpBot variant="stage" />{storeReq && <StoreModal key={storeReq.tab + (storeReq.need ?? '')} tab={storeReq.tab} need={storeReq.need} onClose={() => store.close()} />}</Stage> : <>{body}<HelpBot variant="page" /></>}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.kind === 'coins' && <Coin size={18} />} {t.text}</div>)}
      </div>
    </>
  );
}

/** Game screens are laid out on a landscape stage that scales to any window, iPad or phone. */
function Stage({ children }: { children: React.ReactNode }) {
  // Phones held upright: turn the whole game sideways so it fills the screen (works even with rotation lock
  // or in in-app browsers like Messenger that stay in portrait). Turn the phone and it reads the right way up.
  const calc = () => {
    const sw = window.innerWidth, sh = window.innerHeight;
    const rotated = sh > sw && Math.min(sw, sh) <= 820;
    const vw = rotated ? sh : sw, vh = rotated ? sw : sh, ar = vw / vh;
    const W = Math.round(Math.min(1360, Math.max(1280, 720 * ar)));  // keep the layout tight so everything stays big on wide screens
    const H = Math.round(Math.min(820, Math.max(720, 1280 / ar)));   // …and on tall screens like iPad
    return { W, H, s: Math.min(vw / W, vh / H), rotated };
  };
  const [d, setD] = useState(calc);
  useEffect(() => {
    // The on-screen keyboard shrinks the window while someone types. Re-fitting the game at that moment makes it jump
    // (or even turn sideways) under their finger, the field loses focus, the keyboard closes… and the form seems frozen.
    // So while a text field has focus the layout is left alone, and it is refitted once they are done.
    const typing = () => { const a = document.activeElement; return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); };
    let late = 0, pending = false;
    const h = () => { if (typing()) { pending = true; return; } pending = false; setD(calc()); };
    const turned = () => { clearTimeout(late); late = window.setTimeout(() => { pending = false; setD(calc()); }, 350); };   // rotating the device always refits
    const done = () => { if (!pending) return; clearTimeout(late); late = window.setTimeout(() => { if (!typing()) { pending = false; setD(calc()); } }, 300); };
    window.addEventListener('resize', h); window.addEventListener('orientationchange', turned); document.addEventListener('focusout', done);
    return () => { clearTimeout(late); window.removeEventListener('resize', h); window.removeEventListener('orientationchange', turned); document.removeEventListener('focusout', done); };
  }, []);
  useEffect(() => { document.body.classList.toggle('rotated', d.rotated); }, [d.rotated]);
  return (
    <div className="stage-outer felt-bg">
      <div className="stage" style={{ width: d.W, height: d.H, transform: `translate(-50%, -50%)${d.rotated ? ' rotate(90deg)' : ''} scale(${d.s})` }}>{children}</div>
    </div>
  );
}

