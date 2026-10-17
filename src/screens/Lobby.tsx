import { useEffect, useState } from 'react';
import { Avatar, Coin, Icon, RingButton } from '../components/ui';
import { fmt, levelFromXp, suggestedBet, useProfile, profile } from '../lib/profile';
import type { OnlineCounts } from '../../shared/protocol';
import { net, NetStatus } from '../lib/net';
import { sfx } from '../lib/sound';
import { store } from '../lib/payments';
import {
  AdModal, FriendsModal, GiftsModal, LeaderboardModal, PrivateGameModal, RoomTypeModal, SettingsModal, SpinModal, StartRequest, TrophyModal, VipModal,
} from './modals';

type ModalKey = null | 'store' | 'vip' | 'ad' | 'spin' | 'leaders' | 'trophy' | 'gifts' | 'friends' | 'settings' | 'roomtype' | 'private';

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
  const spinReady = Date.now() - p.lastSpin > 4 * 3600e3;
  const giftReady = p.lastDaily !== new Date().toISOString().slice(0, 10);

  useEffect(() => net.onStatus(setStatus), []);
  useEffect(() => net.on((m) => { if (m.t === 'welcome' || m.t === 'tables') setOnline(m.online); }), []);
  useEffect(() => { const t = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 4500); return () => clearInterval(t); }, []);

  const close = () => setModal(null);
  const s = SLIDES[slide];

  return (
    <div className="screen lobby felt-bg">
      <header className="topbar">
        <button className="me-avatar" onClick={() => setModal('settings')} aria-label="Profile and settings"><Avatar k={p.avatar} size={84} vip={p.vip} name={p.name} /></button>
        <div className="coins-pill">
          <Coin size={36} /><span className="coins-num">{fmt(p.coins)}</span>
          <button className="plus-btn" aria-label="Get coins" onClick={() => { sfx.click(); store.open({ tab: 'coins' }); }}><Icon name="plus" size={20} /></button>
        </div>
        <button className="buy-coins" onClick={() => { sfx.click(); store.open({ tab: 'coins' }); }}>BUY COINS</button>
        <div className="level-pill"><span className="level-star"><Icon name="star" size={34} /></span> LEVEL {lvl}</div>
        <span className={`net-dot ${status}`} title={`Server ${status}`} aria-label={`Multiplayer ${status}`} />
        <button className="gear" onClick={() => { sfx.click(); setModal('settings'); }} aria-label="Settings"><Icon name="gear" size={34} /></button>
      </header>

      <main className="lobby-main">
        <div className="lobby-left">
          <button className="promo" onClick={() => { sfx.click(); setModal(s.k); }}>
            <span className="promo-crown"><Icon name="crown" size={30} /></span>
            <span className="promo-title gold-text">{s.title}</span>
            <span className="promo-sub">{s.sub}</span>
            <span className="dots" aria-hidden="true">{SLIDES.map((_, i) => <i key={i} className={i === slide ? 'on' : ''} />)}</span>
          </button>
          <div className="promo-row">
            <button className="ad-chip" onClick={() => { sfx.click(); setModal('ad'); }} aria-label="Watch an ad for 100 coins"><b>+100</b><small>COINS</small><span className="ad-tag">AD</span></button>
            <button className="vip-chip" onClick={() => { sfx.click(); setModal('vip'); }} aria-label="VIP Club"><span className="gold-text">VIP</span><small>CLUB</small></button>
          </div>
        </div>

        <div className="lobby-rings">
          <RingButton color="green" label="PLAY NOW" onClick={() => setModal('roomtype')}
            icon={<svg viewBox="0 0 60 60" width="64%" height="64%" aria-hidden="true"><path d="M8 10 L44 30 L8 50 Z" fill="none" stroke="#35f28a" strokeWidth="6" strokeLinejoin="round" /><path d="M20 10 L56 30 L20 50" fill="none" stroke="#1fd16f" strokeWidth="6" strokeLinejoin="round" opacity=".8" /></svg>} />
          <RingButton color="blue" label="ONLINE LOBBY" onClick={onOnlineLobby} icon={<Icon name="globe" size={84} style={{ color: '#4aa8ff' }} />} />
          <RingButton color="purple" label="PRIVATE GAME" onClick={() => setModal('private')} icon={<Icon name="lock" size={74} style={{ color: '#c08bff' }} />}
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
        <button className="chip-btn" onClick={() => { sfx.click(); setModal('spin'); }} aria-label="Daily bonus wheel">
          <span className="big-chip"><Icon name="spade" size={38} />{spinReady && <span className="badge">!</span>}</span>
        </button>
        <button onClick={() => { sfx.click(); setModal('gifts'); }}><Icon name="gift" size={40} /><span>GIFTS</span>{giftReady && <span className="badge">1</span>}</button>
        <button onClick={() => { sfx.click(); setModal('friends'); }}><Icon name="users" size={40} /><span>FRIENDS</span></button>
      </nav>

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
