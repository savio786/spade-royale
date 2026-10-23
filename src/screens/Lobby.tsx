import { WheelArt } from '../components/MegaWheel';
import { useEffect, useState } from 'react';
import { Avatar, Coin, Icon, RingButton } from '../components/ui';
import { fmt, levelFromXp, suggestedBet, useProfile, profile, xpForLevel, publicStats } from '../lib/profile';
import { PlayerCard } from '../components/PlayerCard';
import { GlobeArt, PlayArt, PrivateArt } from '../components/LobbyArt';

const MEGA_MS = 4 * 3600e3;
const clock = (ms: number) => { const t = Math.ceil(ms / 1000); return [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60].map((n) => String(n).padStart(2, '0')).join(':'); };
import type { OnlineCounts } from '../../shared/protocol';
import { net, NetStatus } from '../lib/net';
import { useSocial } from '../lib/social';
import { sfx } from '../lib/sound';
import { store } from '../lib/payments';
import { helpBot } from '../lib/helpbot';
import {
  AdModal, bonusLeftMs, FriendsModal, GiftsModal, ProfileEditModal, LeaderboardModal, PrivateGameModal, RoomTypeModal, SettingsModal, SpinModal, StartRequest, TrophyModal, VipModal,
} from './modals';

type ModalKey = null | 'card' | 'store' | 'vip' | 'ad' | 'spin' | 'leaders' | 'trophy' | 'gifts' | 'friends' | 'settings' | 'roomtype' | 'private' | 'profile';

const SLIDES = [
  { k: 'vip', title: 'VIP', sub: 'Get special privileges!' },
  { k: 'spin', title: 'BONUS', sub: 'Spin the daily wheel!' },
  { k: 'leaders', title: 'WEEKLY', sub: 'Top 100 win coin rewards!' },
] as const;

export function Lobby({ onStart, onOnlineLobby, installPrompt }: { onStart: (r: StartRequest) => void; onOnlineLobby: () => void; installPrompt: null | (() => void) }) {
  const p = useProfile();
  const soc = useSocial();
  const [modal, setModal] = useState<ModalKey>(null);
  const [slide, setSlide] = useState(0);
  const [status, setStatus] = useState<NetStatus>(net.status);
  const [online, setOnline] = useState<OnlineCounts | null>(null);
  const lvl = levelFromXp(p.xp);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const megaLeft = Math.max(0, p.lastSpin + MEGA_MS - now);
  const spinReady = megaLeft === 0;
  const lvlPct = Math.min(100, Math.max(0, ((p.xp - xpForLevel(lvl)) / (xpForLevel(lvl + 1) - xpForLevel(lvl))) * 100));
  const giftReady = p.lastDaily !== new Date().toISOString().slice(0, 10);

  useEffect(() => net.onStatus(setStatus), []);
  useEffect(() => net.on((m) => { if (m.t === 'welcome' || m.t === 'tables') setOnline(m.online); }), []);
  useEffect(() => { const t = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 4500); return () => clearInterval(t); }, []);

  const close = () => setModal(null);
  const s = SLIDES[slide];

  return (
    <div className="screen lobby felt-bg">
      <div className="lobby-aurora" aria-hidden="true"><i className="au1" /><i className="au2" /><i className="au3" /><i className="au4" /><i className="au-curtain" /></div>
      <header className="topbar">
        <button className="me-avatar" onClick={() => { sfx.click(); setModal('card'); }} aria-label="Your profile and stats"><Avatar k={p.avatar} size={104} vip={p.vip} name={p.name} /></button>
        <div className="coins-pill">
          <Coin size={36} /><span className="coins-num">{fmt(p.coins)}</span>
          <button className="plus-btn" aria-label="Get coins" onClick={() => { sfx.click(); store.open({ tab: 'coins' }); }}><Icon name="plus" size={20} /></button>
        </div>
        <button className="buy-coins" onClick={() => { sfx.click(); store.open({ tab: 'coins' }); }}>BUY COINS</button>
        <div className="level-pill" title={`${Math.round(lvlPct)}% to level ${lvl + 1}`}>
          <span className="level-fill" style={{ width: `${lvlPct}%` }} aria-hidden="true" />
          <span className="level-star gold"><GoldStar /></span><span className="level-txt">LEVEL {lvl}</span>
        </div>
        <span className="tb-sep" aria-hidden="true" />
        <span className={`net-dot ${status}`} title={`Server ${status}`} aria-label={`Multiplayer ${status}`} />
        <button className="help-btn" onClick={() => { sfx.click(); helpBot.open(); }} aria-label="Help: ask Spade Bot"><span>?</span></button>
        <button className="gear" onClick={() => { sfx.click(); setModal('settings'); }} aria-label="Settings"><GoldGear /></button>
      </header>

      <main className="lobby-main">
        <div className="lobby-left">
          <button className="promo" onClick={() => { sfx.click(); setModal(s.k); }}>
            <span className="promo-sparkles" aria-hidden="true">{[[14, 22], [82, 14], [22, 70], [88, 62], [52, 8], [70, 84]].map(([x, y], i) => <i key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.35}s` }}>✦</i>)}</span>
            <span className="promo-crown"><Icon name="crown" size={30} /></span>
            <span className="promo-title gold-text">{s.title}</span>
            <span className="promo-sub">{s.sub}</span>
            <span className="dots" aria-hidden="true">{SLIDES.map((_, i) => <i key={i} className={i === slide ? 'on' : ''} />)}</span>
          </button>
          <div className="promo-row">
            <button className="ad-chip" onClick={() => { sfx.click(); setModal('ad'); }} aria-label="Bonus coins"><b>+100</b><small>COINS</small><span className={`ad-tag ${bonusLeftMs(p.lastAd) === 0 ? 'ready' : ''}`}>{bonusLeftMs(p.lastAd) === 0 ? 'FREE' : 'SOON'}</span></button>
            <button className="vip-chip" onClick={() => { sfx.click(); setModal('vip'); }} aria-label="VIP Club"><span className="vip-stars" aria-hidden="true">★</span><span className="gold-text">VIP</span><small>★ CLUB ★</small></button>
          </div>
        </div>

        <div className="lobby-rings">
          <RingButton color="green" label="PLAY NOW" onClick={() => setModal('roomtype')}
            icon={<PlayArt />} />
          <RingButton color="blue" label="ONLINE LOBBY" onClick={onOnlineLobby} icon={<GlobeArt />} />
          <RingButton color="purple" label="PRIVATE GAME" onClick={() => setModal('private')} icon={<PrivateArt />}
            badge={<span className="now-open">NOW OPEN</span>} />
        </div>
      </main>

      {p.coins < 1000 && (
        <div className="low-coins" role="status">
          <Coin size={26} /><span>Running low on coins — top up to keep playing.</span>
          {giftReady && <button className="pill gold small-pill" onClick={() => { sfx.click(); setModal('gifts'); }}>Free daily gift</button>}
          <button className="pill green small-pill" onClick={() => { sfx.click(); store.open({ tab: 'coins', need: 1000 }); }}>Buy coins</button>
        </div>
      )}
      <nav className="bottom-nav" aria-label="Main">
        <button onClick={() => { sfx.click(); setModal('leaders'); }}><Icon name="podium" size={40} /><span>LEADERS</span></button>
        <button onClick={() => { sfx.click(); setModal('trophy'); }}><Icon name="trophy" size={40} /><span>TROPHY</span></button>
        <button className={`mega ${spinReady ? 'ready' : ''}`} onClick={() => { sfx.click(); setModal('spin'); }} aria-label={spinReady ? 'Mega bonus ready: spin the wheel' : `Mega bonus in ${clock(megaLeft)}`}>
          {spinReady ? (
            <>
              <span className="mega-peek" aria-hidden="true"><WheelArt rotClass="mega-peek-rot" /></span>
              <span className="mega-tap">SPIN!</span>
            </>
          ) : (
            <>
              <span className="mega-title">MEGA BONUS IN <b>{clock(megaLeft)}</b></span>
              <span className="mega-bar" aria-hidden="true">
                <span className="mega-fill" style={{ width: `${(1 - megaLeft / MEGA_MS) * 100}%` }} />
                {[1, 2, 3, 4].map((i) => <i key={i} style={{ left: `${i * 20}%` }} />)}
              </span>
            </>
          )}
        </button>
        <button onClick={() => { sfx.click(); setModal('gifts'); }}><Icon name="gift" size={40} /><span>GIFTS</span>{giftReady && <span className="badge">1</span>}</button>
        <button onClick={() => { sfx.click(); setModal('friends'); }}><Icon name="users" size={40} /><span>FRIENDS</span>{soc.incoming.length > 0 && <span className="badge" aria-label={`${soc.incoming.length} friend request${soc.incoming.length === 1 ? '' : 's'}`}>{soc.incoming.length}</span>}</button>
      </nav>

      {modal === 'card' && <PlayerCard onClose={close} onEdit={() => setModal('profile')} player={{ name: p.name, avatar: p.avatar, level: lvl, stats: publicStats(p), levelPct: lvlPct }} />}
      {modal === 'vip' && <VipModal onClose={close} />}
      {modal === 'ad' && <AdModal onClose={close} />}
      {modal === 'spin' && <SpinModal onClose={close} />}
      {modal === 'leaders' && <LeaderboardModal onClose={close} />}
      {modal === 'trophy' && <TrophyModal onClose={close} />}
      {modal === 'gifts' && <GiftsModal onClose={close} />}
      {modal === 'profile' && <ProfileEditModal onClose={close} />}
      {modal === 'friends' && <FriendsModal onClose={close} onInvite={() => setModal('private')} />}
      {modal === 'settings' && <SettingsModal onClose={close} installPrompt={installPrompt} />}
      {modal === 'private' && <PrivateGameModal status={status} onClose={close} onStart={(r) => { close(); onStart(r); }} />}
      {modal === 'roomtype' && (
        <RoomTypeModal online={status === 'online' ? online : null} onClose={close} onPick={(mode) => {
          close();
          const last = profile.get().lastTable;
          const bet = Math.min(suggestedBet(p.coins), p.coins);
          if (p.coins < 100) { store.open({ tab: 'coins' }); return; }
          onStart({ mode, bet: Math.max(100, bet), minPoints: last?.minPoints ?? -100, maxPoints: last?.maxPoints ?? 100, via: status === 'online' ? 'quick' : 'local' });
        }} />
      )}
    </div>
  );
}

/** Golden 3D settings cog; it turns a little on hover. */
const COG = 'M40.0 17.5 L41.3 6.9 L58.7 6.9 L60.0 17.5 L65.9 19.9 L74.3 13.3 L86.7 25.7 L80.1 34.1 L82.5 40.0 L93.1 41.3 L93.1 58.7 L82.5 60.0 L80.1 65.9 L86.7 74.3 L74.3 86.7 L65.9 80.1 L60.0 82.5 L58.7 93.1 L41.3 93.1 L40.0 82.5 L34.1 80.1 L25.7 86.7 L13.3 74.3 L19.9 65.9 L17.5 60.0 L6.9 58.7 L6.9 41.3 L17.5 40.0 L19.9 34.1 L13.3 25.7 L25.7 13.3 L34.1 19.9Z';
function GoldGear() {
  return (
    <svg className="gold-gear" viewBox="0 0 100 100" width="64" height="64" aria-hidden="true">
      <defs>
        <linearGradient id="gg-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff4c2" /><stop offset=".3" stopColor="#f5c84a" /><stop offset=".65" stopColor="#b47a0c" /><stop offset="1" stopColor="#ffd970" /></linearGradient>
        <radialGradient id="gg-hub" cx=".4" cy=".35" r=".7"><stop offset="0" stopColor="#3a2a6a" /><stop offset="1" stopColor="#120a2e" /></radialGradient>
      </defs>
      <g className="gg-rot">
        <path d={COG} transform="translate(0 3)" fill="#5a3606" />
        <path d={COG} fill="url(#gg-gold)" stroke="#6b4306" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="50" cy="50" r="24" fill="none" stroke="#fff6cf" strokeOpacity=".55" strokeWidth="2" />
        <circle cx="50" cy="50" r="17" fill="#6b4306" />
        <circle cx="50" cy="50" r="14.5" fill="url(#gg-hub)" />
        <path d="M24 34 A30 30 0 0 1 50 20" fill="none" stroke="#fffbe6" strokeOpacity=".85" strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Golden 3D star for the level badge. */
function GoldStar() {
  const pts = Array.from({ length: 10 }, (_, i) => { const a = (i * Math.PI) / 5 - Math.PI / 2, r = i % 2 ? 19 : 44; return `${(50 + r * Math.cos(a)).toFixed(1)} ${(52 + r * Math.sin(a)).toFixed(1)}`; }).join(' L');
  return (
    <svg viewBox="0 0 100 100" width="54" height="54" aria-hidden="true">
      <defs>
        <linearGradient id="gs-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff4c2" /><stop offset=".35" stopColor="#f5c84a" /><stop offset=".7" stopColor="#b47a0c" /><stop offset="1" stopColor="#ffd970" /></linearGradient>
      </defs>
      <path d={`M${pts}Z`} transform="translate(0 3)" fill="#5a3606" />
      <path d={`M${pts}Z`} fill="url(#gs-gold)" stroke="#6b4306" strokeWidth="3" strokeLinejoin="round" />
      <path d="M50 20 L42 40 L22 41" fill="none" stroke="#fffbe6" strokeOpacity=".8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
