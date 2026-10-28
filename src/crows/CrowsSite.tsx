// The Crows Haven site (builds with VITE_CROWS=1): welcome page, start screen and home screen.
// Nothing here is used by the Spades site.
import { useEffect, useState } from 'react';
import './crows.css';
import { CrowCard, CrowArt } from './CrowCard';
import { CrowsTable, CrowsRules, CrowsRulesBody } from './CrowsTable';
import { AVATAR_KEYS } from '../components/ui';
import { CrowsAvatar, InstallHelp, InstallModal, PictureModal } from './CrowsExtras';
import { alreadyInstalled } from '../lib/device';
import { profile, useProfile } from '../lib/profile';
import { continueAsGuest, finishNewGuest, notifyReturning } from '../lib/guest';
import { sfx } from '../lib/sound';

const HERO_CARDS = [{ s: 'ember', r: 1 }, { s: 'crow', r: 0 }, { s: 'sky', r: 14 }, { s: 'moss', r: 10 }] as const;

const FEATURES = [
  { t: 'Bid for the nest', d: 'Promise how many points your side will take. Win the bid and the five hidden nest cards are yours.' },
  { t: 'Name trump', d: 'Keep the best of the nest, put five cards back, and choose the colour that beats all others.' },
  { t: 'Capture the Crow', d: 'The Crow is the highest trump and worth 20 points. Play it on any trick — at the right moment.' },
  { t: 'Play with a partner', d: 'You and the player across the table are a team. Play free against computer players, any time.' },
];

/** Public welcome page (the site's front page). */
export function CrowsLanding({ onPlay, installPrompt }: { onPlay: () => void; installPrompt: null | (() => void) }) {
  return (
    <div className="crows-land">
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
            {!alreadyInstalled() && <a className="cl-btn ghost" href="#get-app" onClick={(e) => { if (installPrompt) { e.preventDefault(); installPrompt(); } }}>⤓ Install the app</a>}
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

/** Inside the game: start as a guest, then the home screen, then a table. */
export function CrowsApp({ onLeaveSite, installPrompt }: { onLeaveSite: () => void; installPrompt: null | (() => void) }) {
  const p = useProfile();
  const [screen, setScreen] = useState<'home' | 'table'>('home');
  const [tableKey, setTableKey] = useState(0);
  const [rules, setRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<null | 'picture' | 'install'>(null);
  useEffect(() => { document.body.classList.add('crows-site'); return () => document.body.classList.remove('crows-site'); }, []);

  if (!p.provider) {
    const start = async () => {
      sfx.click(); setBusy(true);
      const r = await continueAsGuest();
      if (r.returning) notifyReturning(r.name);
      else finishNewGuest(profile.get().avatar || AVATAR_KEYS[Math.floor(Math.random() * AVATAR_KEYS.length)]);
      setBusy(false);
    };
    return (
      <div className="screen crows-home felt-bg">
        <div className="ch-card">
          <CrowArt size={120} />
          <h1>CROWS HAVEN</h1>
          <p>Play free as a guest. Your name and progress stay on this device.</p>
          <button className="cl-btn" disabled={busy} onClick={start}>{busy ? 'Starting…' : '▶ PLAY AS GUEST'}</button>
          <button className="ch-link" onClick={onLeaveSite}>Back to the welcome page</button>
        </div>
      </div>
    );
  }

  if (screen === 'table') return <CrowsTable key={tableKey} onExit={() => setScreen('home')} />;


  return (
    <div className="screen crows-home felt-bg">
      <div className="ch-card">
        <CrowArt size={110} />
        <h1>CROWS HAVEN</h1>
        <button className="ch-me" onClick={() => { sfx.click(); setModal('picture'); }} aria-label="Change your picture">
          <CrowsAvatar k={p.avatar} size={64} name={p.name} /> <b>{p.name}</b> <span className="ch-edit">Change picture</span>
        </button>
        <button className="cl-btn big" onClick={() => { sfx.click(); setTableKey((k) => k + 1); setScreen('table'); }}>▶ PLAY</button>
        <div className="ch-row">
          <button className="cl-btn ghost" onClick={() => { sfx.click(); setRules(true); }}>How to play</button>
          {!alreadyInstalled() && <button className="cl-btn ghost" onClick={() => { sfx.click(); setModal('install'); }}>⤓ Install the app</button>}
          <button className="cl-btn ghost" onClick={onLeaveSite}>Welcome page</button>
        </div>
        <p className="ch-note">You and your partner (across the table) against two computer players. First side to 500 wins. Online tables with friends are coming.</p>
      </div>
      {rules && <CrowsRules onClose={() => setRules(false)} />}
      {modal === 'picture' && <PictureModal onClose={() => setModal(null)} />}
      {modal === 'install' && <InstallModal installPrompt={installPrompt} onClose={() => setModal(null)} />}
    </div>
  );
}
