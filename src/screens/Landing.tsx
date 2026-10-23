import { useEffect, useState } from 'react';
import { Avatar, CardView, Coin, Icon, Logo } from '../components/ui';
import { RulesModal } from './Table';
import { fmt } from '../lib/profile';
import { BoardRow, fetchBoard } from '../lib/api';

const STORE_LINKS = {
  play: (import.meta.env.VITE_PLAY_STORE_URL as string) || '#download',
  apple: (import.meta.env.VITE_APP_STORE_URL as string) || '#download',
};

const FEATURES = [
  { icon: 'users', title: 'Partners & Solo', text: 'Classic 2-vs-2 Spades with your partner across the table, or every-player-for-themselves Solo.' },
  { icon: 'globe', title: 'Online lobby', text: 'Pick a city table by bet size and game-ending points, or hit Play Now for instant matchmaking.' },
  { icon: 'lock', title: 'Private tables', text: 'Create a table, share a 5-letter invite code, and play with friends. Bots fill any empty seat.' },
  { icon: 'chat', title: 'Table chat & gifts', text: 'Quick phrases, emoji and free text at every table — plus gifts you can send to other players.' },
  { icon: 'podium', title: 'Weekly leaderboard', text: 'Climb the global board, compete with friends and land on the Wall of Fame. Top 100 earn rewards.' },
  { icon: 'gift', title: 'Daily rewards', text: 'Daily gift, bonus wheel every 4 hours, trophies to unlock and a VIP Club with extra perks.' },
];

const PLATFORMS = [
  { icon: 'windows', name: 'Windows', how: 'Open in Edge or Chrome → Install app' },
  { icon: 'apple', name: 'MacBook', how: 'Chrome/Edge → Install, or Safari → Add to Dock' },
  { icon: 'ipad', name: 'iPad & iPhone', how: 'App Store, or Safari → Share → Add to Home Screen' },
  { icon: 'android', name: 'Android', how: 'Google Play, or Chrome → Install app' },
];

export function Landing({ onPlay, installPrompt }: { onPlay: () => void; installPrompt: null | (() => void) }) {
  const [rules, setRules] = useState(false);
  const [top, setTop] = useState<BoardRow[]>([]);
  useEffect(() => { fetchBoard().then((b) => b && setTop(b.rows.slice(0, 5))); }, []);
  return (
    <div className="landing">
      <nav className="land-nav">
        <a href="#top" className="land-brand"><img src="./brand/emblem.svg" alt="" width={34} height={36} /> SPADE HAVEN</a>
        <div className="land-links">
          <a href="#features">Features</a>
          <a href="#modes">Game modes</a>
          <a href="#download">Download</a>
          <button className="linklike" onClick={() => setRules(true)}>Rules</button>
        </div>
        <button className="pill green nav-cta" onClick={onPlay}>Play free</button>
      </nav>

      <header className="hero felt-bg" id="top">
        <div className="hero-copy">
          <Logo />
          <p className="hero-tag">Real-time Spades tournaments. Bid smart, cover your partner's nil, and take the table's prize.</p>
          <div className="hero-ctas">
            <button className="pill green big" onClick={onPlay}><Icon name="play" size={20} /> Play in your browser</button>
            {installPrompt && <button className="pill blue big" onClick={installPrompt}><Icon name="download" size={20} /> Install on this device</button>}
          </div>
          <div className="store-row">
            <a className="store-badge" href={STORE_LINKS.play}><Icon name="android" size={26} /><span><small>GET IT ON</small>Google Play</span></a>
            <a className="store-badge" href={STORE_LINKS.apple}><Icon name="apple" size={26} /><span><small>Download on the</small>App Store</span></a>
          </div>
          <p className="hero-fine">Free to play with virtual coins · 50,000 coins to start · <a href="/install" style={{ color: 'inherit' }}>Install on your phone</a></p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="device">
            <div className="device-screen">
              <div className="mini-felt">
                <span className="mini-seat t"><Avatar k="a2" size={38} /></span>
                <span className="mini-seat l"><Avatar k="a6" size={38} /></span>
                <span className="mini-seat r"><Avatar k="a9" size={38} /></span>
                <span className="mini-seat b"><Avatar k="a1" size={38} /></span>
                <div className="mini-trick">
                  <CardView small card={{ s: 'S', r: 14 }} className="mt1" />
                  <CardView small card={{ s: 'H', r: 13 }} className="mt2" />
                  <CardView small card={{ s: 'S', r: 9 }} className="mt3" />
                </div>
              </div>
            </div>
          </div>
          <div className="fan">
            {[{ s: 'S', r: 14 }, { s: 'S', r: 13 }, { s: 'H', r: 14 }, { s: 'D', r: 12 }, { s: 'C', r: 11 }].map((c, i) => (
              <CardView key={i} card={c as never} className={`fan-card f${i}`} />
            ))}
          </div>
        </div>
      </header>

      <section className="land-section" id="features">
        <h2 className="sec-title">Everything at the table</h2>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="feature">
              <span className="f-icon"><Icon name={f.icon} size={30} /></span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="land-section modes" id="modes">
        <h2 className="sec-title">Two ways to play</h2>
        <div className="mode-split">
          <div className="mode-card static">
            <span className="mode-title">PARTNERS</span>
            <span className="mode-sub">Play classic spades</span>
            <p>Team up with the player across from you. Combined bids, shared books, shared prize — 1.8× your bet each.</p>
          </div>
          <div className="mode-card static">
            <span className="mode-title">SOLO</span>
            <span className="mode-sub">Play against all other players</span>
            <p>Four players, no partners. Every book counts for you alone, and the winner takes 3.6× the bet.</p>
          </div>
        </div>
      </section>

      {top.length > 0 && <section className="land-section lb-teaser">
        <h2 className="sec-title">This week's leaders</h2>
        <ol className="teaser-list">
          {top.map((r, i) => (
            <li key={r.name}><span className="t-rank">{i + 1}</span><Avatar k={r.avatar} size={40} /><span className="grow">{r.name}</span><span className="t-earn"><Coin size={20} /> {fmt(r.earnings)}</span></li>
          ))}
        </ol>
      </section>}

      <section className="land-section" id="download">
        <h2 className="sec-title">Play on every screen</h2>
        <div className="platforms">
          {PLATFORMS.map((p) => (
            <div key={p.name} className="platform"><Icon name={p.icon} size={36} /><b>{p.name}</b><small>{p.how}</small></div>
          ))}
        </div>
        <div className="center-row">
          <button className="pill green big" onClick={onPlay}><Icon name="play" size={20} /> Start playing now</button>
        </div>
      </section>

      <footer className="land-foot">
        <span><Icon name="spade" size={18} /> Spade Haven</span>
        <span>Virtual coins only — they have no cash value.</span>
        <span className="land-legal"><a href="#privacy">Privacy</a> · <a href="#terms">Terms</a> · 18+</span>
        <span>© {new Date().getFullYear()}</span>
      </footer>
      {rules && <RulesModal onClose={() => setRules(false)} />}
    </div>
  );
}
