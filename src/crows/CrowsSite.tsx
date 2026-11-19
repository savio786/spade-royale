// The Crows Haven site (builds with VITE_CROWS=1): welcome page, start screen and home screen.
// Nothing here is used by the Spades site.
import { useEffect, useRef, useState } from 'react';
import './crows.css';
import { CrowCard, CrowArt } from './CrowCard';
import { Icon, Modal } from '../components/ui';
import { CrowsTable, CrowsRules, CrowsRulesBody, TableMode } from './CrowsTable';
import { quickMatch, createTable, createPrivate, findCode, rememberTable, forgetTable, currentTable } from './online';
import { toast } from '../lib/toast';
import { changeName, registerMyName, NAME_MAX } from './names';
import { CrowsRanking } from './CrowsRanking';
import { InstallHelp, InstallModal, PictureModal, randomPlayerPicture, useInstall } from './CrowsExtras';
import { CrowsLobby, CrowsOnlineLobby, GAME_POINTS, PlayModal, type LobbyAction } from './CrowsLobby';
import { crowsCity, notEnough } from './wallet';
import { profile, useProfile } from '../lib/profile';
import { continueAsGuest, finishNewGuest, notifyReturning } from '../lib/guest';
import { sfx } from '../lib/sound';

const HERO_CARDS = [{ s: 'R', r: 1 }, { s: 'crow', r: 0 }, { s: 'G', r: 14 }, { s: 'Y', r: 10 }] as const;

const FEATURES = [
  { t: 'Bid for the nest', d: 'Promise how many points your side will take. Win the bid and the five hidden nest cards are yours.' },
  { t: 'Name trump', d: 'Keep the best of the nest, put five cards back, and choose the colour that beats all others.' },
  { t: 'Capture the Crow', d: 'The Crow is the highest trump and worth 20 points. Play it on any trick — at the right moment.' },
  { t: 'Play with a partner', d: 'You and the player across the table are a team. Play free against computer players, any time.' },
];

/** Public welcome page (the site's front page). */
export function CrowsLanding({ onPlay, installPrompt: fromApp }: { onPlay: () => void; installPrompt: null | (() => void) }) {
  const { install, installed } = useInstall();
  const installPrompt = install ?? fromApp;
  const [showInstall, setShowInstall] = useState(false);
  return (
    <div className="crows-land">
      {showInstall && <InstallModal installPrompt={installPrompt} onClose={() => setShowInstall(false)} />}
      <header className="cl-top">
        <a className="cl-brand" href="#top"><CrowArt size={38} /> CROWS HAVEN</a>
        <nav>
          <a href="#how">How to play</a>
          <a href="#get-app">Get the app</a>
          <button className="cl-btn small" onClick={onPlay}>PLAY FREE</button>
        </nav>
      </header>

      <section className="cl-hero" id="top">
        <div className="cl-hero-text">
          <h1>CROWS<br />HAVEN</h1>
          <p>The partnership card game of bids, nests and trump. Win the auction, pick up the nest, name trump — and catch the Crow.</p>
          <div className="cl-actions">
            <button className="cl-btn" onClick={onPlay}>▶ PLAY IN YOUR BROWSER</button>
            {!installed && <button className="cl-btn ghost" onClick={() => { sfx.click(); if (installPrompt) void installPrompt(); else setShowInstall(true); }}>⤓ Install the app</button>}
          </div>
          <small>Free · no sign-up · you and a partner against two computer players</small>
        </div>
        <div className="cl-hero-cards" aria-hidden="true">
          {HERO_CARDS.map((c, i) => <CrowCard key={i} card={c as never} style={{ ['--i' as string]: i }} />)}
        </div>
      </section>

      <section className="cl-features">
        {FEATURES.map((f) => <div key={f.t} className="cl-feature"><h3>{f.t}</h3><p>{f.d}</p></div>)}
      </section>

      <section className="cl-how" id="how">
        <h2>How to play</h2>
        <CrowsRulesBody />
        <button className="cl-btn" onClick={onPlay}>▶ PLAY NOW</button>
      </section>

      <section className="cl-how" id="get-app">
        <h2>Get the app</h2>
        <InstallHelp installPrompt={installPrompt} />
      </section>

      <footer className="cl-foot">
        <span><CrowArt size={22} /> Crows Haven</span>
        <a href="#privacy">Privacy</a>
        <a href="#terms">Terms</a>
      </footer>
    </div>
  );
}

/** Exit: in the installed app, close it if the device allows; otherwise back to the welcome page. */
function exitGame(toWelcome: () => void) {
  const installed = window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches;
  if (installed) { window.close(); setTimeout(toWelcome, 300); return; }   // still open (phones don't allow closing): welcome page
  toWelcome();
}


/** Inside the game: start as a guest, then the home screen, then a table. */
export function CrowsApp({ onLeaveSite, installPrompt: fromApp }: { onLeaveSite: () => void; installPrompt: null | (() => void) }) {
  const { install, installed } = useInstall();
  const installPrompt = install ?? fromApp;
  const p = useProfile();
  // back from a reload in the middle of an online game: straight back to that table
  const resume = currentTable();
  const [screen, setScreen] = useState<'home' | 'online' | 'table' | 'ranking'>(resume ? 'table' : 'home');
  const [bet, setBet] = useState(0);
  const [tableKey, setTableKey] = useState(0);
  const [rules, setRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<null | 'picture' | 'install' | 'private' | 'name' | 'create'>(null);
  const [nameNote, setNameNote] = useState<string | null>(null);
  // make sure the game server knows this player's name (names are unique); ask for a new one if it's taken
  useEffect(() => {
    if (!p.provider) return;
    void registerMyName().then((msg) => { if (msg) { setNameNote(msg); setModal('name'); } });
  }, [p.provider]); // eslint-disable-line react-hooks/exhaustive-deps
  const [mode, setMode] = useState<TableMode>(resume ? { kind: 'online', tableId: resume } : { kind: 'local' });
  const [finding, setFinding] = useState(false);
  const fullTries = useRef(0);
  const [target, setTargetState] = useState<number>(() => { try { const v = Number(localStorage.getItem('crowsTarget')); return GAME_POINTS.includes(v) ? v : 500; } catch { return 500; } });
  const setTarget = (v: number) => { sfx.click(); setTargetState(v); try { localStorage.setItem('crowsTarget', String(v)); } catch { /* private mode */ } };
  useEffect(() => { document.body.classList.add('crows-site'); return () => document.body.classList.remove('crows-site'); }, []);

  if (!p.provider) {
    const start = async () => {
      sfx.click(); setBusy(true);
      const r = await continueAsGuest();
      if (r.returning) notifyReturning(r.name);
      else finishNewGuest(randomPlayerPicture());
      setBusy(false);
    };
    return (
      <div className="screen login felt-bg crows-login">
        <img className="hostess left" src="/brand/hostess-left.webp" alt="" aria-hidden="true" draggable={false} />
        <img className="hostess right" src="/brand/hostess-right.webp" alt="" aria-hidden="true" draggable={false} />
        <div className="login-inner">
          <CrowsLogo />
          <div className="login-glow" />
          <div className="login-buttons">
            <button className="social reg" onClick={start} disabled={busy}>
              <span className="social-ico"><Icon name="play" size={24} /></span><span>{busy ? 'One moment…' : 'Play free as a guest'}</span>
            </button>
          </div>
          <p className="crows-login-note">50,000 free coins to start · your name, coins and level stay on this device</p>
          <button className="guest-link" onClick={() => { sfx.click(); onLeaveSite(); }}>Back to the welcome page</button>
        </div>
      </div>
    );
  }

  const openTable = (m: TableMode) => { if (m.kind === 'online') rememberTable(m.tableId); else forgetTable(); setMode(m); setTableKey((k) => k + 1); setScreen('table'); };
  /** Online: the server seats you at a public table with the same game points and bet (or starts one). */
  const playOnline = async (b = bet) => {
    if (profile.get().coins < b) { notEnough(b); return; }
    setFinding(true);
    try { setBet(b); openTable({ kind: 'online', tableId: await quickMatch(target, b) }); }
    catch (e) { toast((e as Error).message); }
    finally { setFinding(false); }
  };
  /** "Create table": a public table with your bet and game points, listed in the online lobby for others to join. */
  const makeTable = async (b: number) => {
    if (profile.get().coins < b) { notEnough(b); return; }
    setFinding(true);
    try { setBet(b); openTable({ kind: 'online', tableId: await createTable(target, b) }); }
    catch (e) { toast((e as Error).message); }
    finally { setFinding(false); }
  };
  const playLocal = (b: number) => {
    if (profile.get().coins < b) { notEnough(b); return; }
    setBet(b); openTable({ kind: 'local' });
  };
  const toLobby = () => { fullTries.current = 0; forgetTable(); setScreen('home'); };
  if (screen === 'table') {
    return <CrowsTable key={tableKey} target={target} bet={bet} mode={mode} onExit={toLobby}
      onAgainOnline={() => { forgetTable(); void playOnline(); }}
      onFull={() => { if (++fullTries.current <= 3 && mode.kind === 'online') void playOnline(); else { toast('That table is full.'); setScreen('home'); } }} />;
  }
  if (screen === 'ranking') return <CrowsRanking onBack={() => setScreen('home')} />;

  const act = (a: LobbyAction) => {
    switch (a.t) {
      case 'play': if (a.online) void playOnline(a.bet); else playLocal(a.bet); break;
      case 'online': setScreen('online'); break;
      case 'private': setModal('private'); break;
      case 'ranking': setScreen('ranking'); break;
      case 'rules': setRules(true); break;
      case 'picture': setModal('picture'); break;
      case 'name': setModal('name'); break;
      case 'install': if (installPrompt) void installPrompt(); else setModal('install'); break;
      case 'exit': exitGame(onLeaveSite); break;
    }
  };

  return (
    <>
      {screen === 'online'
        ? <CrowsOnlineLobby onBack={() => setScreen('home')} onJoin={(t) => { if (profile.get().coins < t.bet) { notEnough(t.bet); return; } setBet(t.bet); setTarget(t.target); openTable({ kind: 'online', tableId: t.id }); }} onCreate={() => setModal('create')} />
        : <CrowsLobby onAction={act} installed={installed} target={target} setTarget={setTarget} />}
      {finding && <div className="modal-backdrop"><div className="modal kicked"><h2 className="modal-title">Finding a table…</h2><p className="center">Looking for players at the {crowsCity(bet)} table.</p></div></div>}
      {rules && <CrowsRules onClose={() => setRules(false)} />}
      {modal === 'picture' && <PictureModal onClose={() => setModal(null)} />}
      {modal === 'install' && <InstallModal installPrompt={installPrompt} onClose={() => setModal(null)} />}
      {modal === 'name' && <NameModal current={p.name} note={nameNote} onClose={() => { setModal(null); setNameNote(null); }} />}
      {modal === 'create' && <PlayModal create target={target} setTarget={setTarget} onClose={() => setModal(null)} onPlay={(b) => { setModal(null); void makeTable(b); }} />}
      {modal === 'private' && <PrivateModal target={target} onClose={() => setModal(null)} onOpen={(tableId) => { setModal(null); setBet(0); openTable({ kind: 'online', tableId }); }} />}
    </>
  );
}

/** The Crows Haven logo, laid out like Spade Haven's (emblem + two-line name). */
function CrowsLogo() {
  return (
    <div className="logo crows-logo" role="img" aria-label="Crows Haven">
      <span className="logo-emblem crows-emblem"><CrowArt size={200} /></span>
      <span className="logo-name" aria-hidden="true"><span>CROWS</span><span>HAVEN</span></span>
    </div>
  );
}

/** Private table: make one and share its code, or join a friend's with their code. */
function PrivateModal({ target, onClose, onOpen }: { target: number; onClose: () => void; onOpen: (tableId: string) => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (f: () => Promise<string>) => {
    setBusy(true); setErr(null);
    try { onOpen(await f()); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal title="Private table" onClose={onClose}>
      <div className="crows-private">
        <div>
          <h3>Make a table</h3>
          <p>You get a 5-letter code to send to friends. Computer players only sit down when you press Start. First to {target}.</p>
          <button className="cl-btn" disabled={busy} onClick={() => run(async () => (await createPrivate(target)).tableId)}>Create table</button>
        </div>
        <div>
          <h3>Join a friend</h3>
          <p>Type the code your friend sent you.</p>
          <form onSubmit={(e) => { e.preventDefault(); if (code.trim().length === 5) void run(() => findCode(code)); }}>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase())} placeholder="ABCDE" aria-label="Table code" autoCapitalize="characters" />
            <button className="cl-btn" type="submit" disabled={busy || code.length !== 5}>Join</button>
          </form>
        </div>
      </div>
      {err && <p className="ap-err center" role="alert">{err}</p>}
    </Modal>
  );
}

/** Change your name: anything you like within the name rules. */
function NameModal({ current, note, onClose }: { current: string; note?: string | null; onClose: () => void }) {
  const [name, setName] = useState(/^guest\d*$/i.test(current) || note ? '' : current);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (name.trim() === current) { onClose(); return; }
    setBusy(true);
    const r = await changeName(name);
    setBusy(false);
    if (!r.ok) { setErr(r.message); return; }
    sfx.click(); toast(`You're now ${r.name}`); onClose();
  };
  return (
    <Modal title="Your name" onClose={onClose}>
      <form className="crows-name" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        {note && <p className="ap-err" role="alert">{note}</p>}
        <p>This is the name other players see at the table and in the weekly ranking. Each name can only belong to one player.</p>
        <input autoFocus value={name} maxLength={NAME_MAX} placeholder={current} aria-label="Your name"
          onChange={(e) => { setName(e.target.value); setErr(null); }} />
        {err && <p className="ap-err" role="alert">{err}</p>}
        <div className="btn-row">
          <button type="submit" className="cl-btn" disabled={!name.trim() || busy}>{busy ? 'Checking…' : 'Save name'}</button>
          <button type="button" className="cl-btn ghost" onClick={onClose}>Cancel</button>
        </div>
        <p className="crows-small-note">3 to {NAME_MAX} characters: letters, numbers, spaces and _ - .</p>
      </form>
    </Modal>
  );
}
