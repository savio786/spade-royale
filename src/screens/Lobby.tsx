import { useEffect, useState } from 'react';
import { Avatar, Coin, Icon, RingButton } from '../components/ui';
import { fmt, levelFromXp, suggestedBet, useProfile, profile, xpForLevel, publicStats } from '../lib/profile';
import { PlayerCard } from '../components/PlayerCard';
import { GlobeArt, PlayArt, PrivateArt } from '../components/LobbyArt';

const MEGA_MS = 4 * 3600e3;
const clock = (ms: number) => { const t = Math.ceil(ms / 1000); return [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60].map((n) => String(n).padStart(2, '0')).join(':'); };
import type { OnlineCounts } from '../../shared/protocol';
import { net, NetStatus } from '../lib/net';
import { sfx } from '../lib/sound';
import { store } from '../lib/payments';
import { helpBot } from '../lib/helpbot';
import {
  AdModal, bonusLeftMs, FriendsModal, GiftsModal, LeaderboardModal, PrivateGameModal, RoomTypeModal, SettingsModal, SpinModal, StartRequest, TrophyModal, VipModal,
} from './modals';

type ModalKey = null | 'card' | 'store' | 'vip' | 'ad' | 'spin' | 'leaders' | 'trophy' | 'gifts' | 'friends' | 'settings' | 'roomtype' | 'private';

const SLIDES = [
  { k: 'vip', title: 'VIP', sub: 'Get special privileges!' },
  { k: 'spin', title: 'BONUS', sub: 'Spin the daily wheel!' },
  { k: 'leaders', title: 'WEEKLY', sub: 'Top 100 win coin rewards!' },
] as const;

export function Lobby({ onStart, onOnlineLobby, installPrompt }: { onStart: (r: StartRequest) => void; onOnlineLobby: () => void; installPrompt: null | (() => void) }) {
  const p = useProfile();
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
      <header className="topbar">
        <button className="me-avatar" onClick={() => { sfx.click(); setModal('card'); }} aria-label="Your profile and stats"><Avatar k={p.avatar} size={84} vip={p.vip} name={p.name} /></button>
        <div className="coins-pill">
          <Coin size={36} /><span className="coins-num">{fmt(p.coins)}</span>
          <button className="plus-btn" aria-label="Get coins" onClick={() => { sfx.click(); store.open({ tab: 'coins' }); }}><Icon name="plus" size={20} /></button>
        </div>
        <button className="buy-coins" onClick={() => { sfx.click(); store.open({ tab: 'coins' }); }}>BUY COINS</button>
        <div className="level-pill" title={`${Math.round(lvlPct)}% to level ${lvl + 1}`}>
          <span className="level-fill" style={{ width: `${lvlPct}%` }} aria-hidden="true" />
          <span className="level-star"><Icon name="star" size={34} /></span><span className="level-txt">LEVEL {lvl}</span>
        </div>
        <span className="tb-sep" aria-hidden="true" />
        <span className={`net-dot ${status}`} title={`Server ${status}`} aria-label={`Multiplayer ${status}`} />
        <button className="help-btn" onClick={() => { sfx.click(); helpBot.open(); }} aria-label="Help: ask Spade Bot"><span>?</span></button>
        <button className="gear" onClick={() => { sfx.click(); setModal('settings'); }} aria-label="Settings"><Icon name="gear" size={34} /></button>
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
          <span className="mega-title">{spinReady ? 'MEGA BONUS READY!' : <>MEGA BONUS IN <b>{clock(megaLeft)}</b></>}</span>
          <span className="mega-bar" aria-hidden="true">
            <span className="mega-fill" style={{ width: `${(1 - megaLeft / MEGA_MS) * 100}%` }} />
            {[1, 2, 3, 4].map((i) => <i key={i} style={{ left: `${i * 20}%` }} />)}
          </span>
        </button>
        <button onClick={() => { sfx.click(); setModal('gifts'); }}><Icon name="gift" size={40} /><span>GIFTS</span>{giftReady && <span className="badge">1</span>}</button>
        <button onClick={() => { sfx.click(); setModal('friends'); }}><Icon name="users" size={40} /><span>FRIENDS</span></button>
      </nav>

      {modal === 'card' && <PlayerCard onClose={close} player={{ name: p.name, avatar: p.avatar, level: lvl, stats: publicStats(p), levelPct: lvlPct }} />}
      {modal === 'vip' && <VipModal onClose={close} />}
      {modal === 'ad' && <AdModal onClose={close} />}
      {modal === 'spin' && <SpinModal onClose={close} />}
      {modal === 'leaders' && <LeaderboardModal onClose={close} />}
      {modal === 'trophy' && <TrophyModal onClose={close} />}
      {modal === 'gifts' && <GiftsModal onClose={close} />}
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
