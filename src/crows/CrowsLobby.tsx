// Crows Haven lobby and online lobby, built like Spade Haven's (same top bar, round buttons, bottom bar, pop-ups and
// table tiles — the shared classes in styles.css), with Crows Haven's own coins, levels, bets and game points.
// Spades' Lobby.tsx / OnlineLobby.tsx / modals.tsx are not used or changed.
import { useEffect, useState } from 'react';
import { Coin, Icon, Modal, Pill, RingButton } from '../components/ui';
import { TableShape } from '../components/TableShape';
import { CityRing, lookFor } from '../components/CityRing';
import { GlobeArt } from '../components/LobbyArt';
import { MegaWheel, WheelArt } from '../components/MegaWheel';
import { DAILY_REWARDS, dailyState, fmt, levelFromXp, profile, short, useProfile, xpForLevel } from '../lib/profile';
import { themeById, themeVars } from '../lib/themes';
import { sfx, vibrate } from '../lib/sound';
import { toast } from '../lib/toast';
import { CrowsAvatar } from './CrowsExtras';
import { CROWS_BETS, crowsCity, prizeOf, suggestedCrowsBet } from './wallet';
export type { LobbyTable };
import { listTables, onlineAvailable, type LobbyTable } from './online';

const Art = ({ n, c = 'lobby-img' }: { n: string; c?: string }) => <img className={c} src={`/ui/lobby/${n}.webp`} alt="" aria-hidden="true" draggable={false} />;
export const GAME_POINTS = [300, 400, 500];
const MEGA_MS = 4 * 3600e3;
const BONUS_COINS = 100, BONUS_EVERY_MS = 30 * 60 * 1000;
const bonusLeftMs = (last: number) => Math.max(0, last + BONUS_EVERY_MS - Date.now());
const clock = (ms: number) => { const t = Math.ceil(ms / 1000); return [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60].map((n) => String(n).padStart(2, '0')).join(':'); };

/** The Online Lobby icon: the spinning globe with cards orbiting it (as in Spade Haven). */
const GlobeOrbit = () => (
  <span className="globe-orbit" aria-hidden="true">
    <span className="orbit-ring back" />
    <span className="orbit-globe"><GlobeArt /></span>
    <span className="orbit-ring front" />
    <span className="orbit-cards">{[['♥', 'red', 0], ['♦', 'blue', 120], ['♠', 'dark', 240]].map(([g, c, a]) => <i key={String(a)} style={{ transform: `rotate(${a}deg) translateY(-84px) rotate(${-Number(a)}deg)` }}><b className={`oc ${c}`}>{g}</b></i>)}</span>
  </span>
);

const SLIDES = [
  { k: 'spin', title: 'BONUS', sub: 'Spin the wheel every 4 hours!' },
  { k: 'ranking', title: 'WEEKLY', sub: 'Climb this week’s ranking!' },
  { k: 'gifts', title: 'DAILY', sub: 'A bigger gift every day!' },
] as const;

export type LobbyAction =
  | { t: 'play'; bet: number; target: number; online: boolean }
  | { t: 'online' } | { t: 'private' } | { t: 'ranking' } | { t: 'rules' } | { t: 'picture' } | { t: 'name' } | { t: 'install' } | { t: 'exit' };

type ModalKey = null | 'play' | 'spin' | 'gifts' | 'bonus' | 'me' | 'settings';

export function CrowsLobby({ onAction, installed, target, setTarget }: { onAction: (a: LobbyAction) => void; installed: boolean; target: number; setTarget: (v: number) => void }) {
  const p = useProfile();
  const [modal, setModal] = useState<ModalKey>(null);
  const [slide, setSlide] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 4500); return () => clearInterval(t); }, []);
  const lvl = levelFromXp(p.xp);
  const lvlPct = Math.min(100, Math.max(0, ((p.xp - xpForLevel(lvl)) / (xpForLevel(lvl + 1) - xpForLevel(lvl))) * 100));
  const megaLeft = Math.max(0, p.lastSpin + MEGA_MS - now);
  const spinReady = megaLeft === 0;
  const giftReady = dailyState(p).can;
  const s = SLIDES[slide];
  const close = () => setModal(null);
  const openSlide = (k: (typeof SLIDES)[number]['k']) => (k === 'ranking' ? onAction({ t: 'ranking' }) : setModal(k));

  return (
    <div className="screen lobby felt-bg crows-lobby">
      <div className="lobby-aurora" aria-hidden="true"><i className="au1" /><i className="au2" /><i className="au3" /><i className="au4" /><i className="au-curtain" /></div>
      <header className="topbar">
        <button className="me-avatar" onClick={() => { sfx.click(); setModal('me'); }} aria-label="Your profile"><CrowsAvatar k={p.avatar} size={104} name={p.name} /></button>
        <div className="coins-pill">
          <Coin size={36} /><span className="coins-num">{fmt(p.coins)}</span>
          <button className="plus-btn" aria-label="Free coins" onClick={() => { sfx.click(); setModal('bonus'); }}><Icon name="plus" size={20} /></button>
        </div>
        <button className="buy-coins" onClick={() => { sfx.click(); setModal('gifts'); }}>FREE COINS</button>
        <div className="level-pill" title={`${Math.round(lvlPct)}% to level ${lvl + 1}`}>
          <span className="level-fill" style={{ width: `${lvlPct}%` }} aria-hidden="true" />
          <span className="level-star gold"><GoldStar /></span><span className="level-txt">LEVEL {lvl}</span>
        </div>
        <span className="tb-sep" aria-hidden="true" />
        <button className="help-btn" onClick={() => { sfx.click(); onAction({ t: 'rules' }); }} aria-label="How to play"><span>?</span></button>
        <button className="gear" onClick={() => { sfx.click(); setModal('settings'); }} aria-label="Settings"><GoldGear /></button>
      </header>

      <main className="lobby-main">
        <div className="lobby-left">
          <button className="promo" onClick={() => { sfx.click(); openSlide(s.k); }}>
            <span className="promo-sparkles" aria-hidden="true">{[[14, 22], [82, 14], [22, 70], [88, 62], [52, 8], [70, 84]].map(([x, y], i) => <i key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.35}s` }}>✦</i>)}</span>
            <span className="promo-crown"><Art n={s.k === 'gifts' ? 'gift' : s.k === 'ranking' ? 'podium' : 'crown'} c="promo-crown-img" /></span>
            <span className="promo-title gold-text">{s.title}</span>
            <span className="promo-sub">{s.sub}</span>
            <span className="dots" aria-hidden="true">{SLIDES.map((_, i) => <i key={i} className={i === slide ? 'on' : ''} />)}</span>
          </button>
          <div className="promo-row">
            <button className="ad-chip" onClick={() => { sfx.click(); setModal('bonus'); }} aria-label="Bonus coins"><Art n="coins" c="chip-img" /><b>+{BONUS_COINS}</b><small>COINS</small><span className={`ad-tag ${bonusLeftMs(p.lastAd) === 0 ? 'ready' : ''}`}>{bonusLeftMs(p.lastAd) === 0 ? 'FREE' : 'SOON'}</span></button>
            <button className="vip-chip" onClick={() => { sfx.click(); onAction({ t: 'rules' }); }} aria-label="How to play"><Art n="crown" c="chip-img" /><span className="gold-text">RULES</span><small>HOW TO PLAY</small></button>
            <button className="inv-chip" onClick={() => { sfx.click(); void shareGame(); }} aria-label="Invite friends"><Art n="invite" c="chip-img" /><b>INVITE</b><small>FRIENDS</small></button>
          </div>
        </div>

        <div className="lobby-rings">
          <RingButton color="green" label="PLAY NOW" onClick={() => setModal('play')} icon={<Art n="play" c="ring-img" />} />
          <RingButton color="blue" label="ONLINE LOBBY" onClick={() => (onlineAvailable() ? onAction({ t: 'online' }) : toast('Online play isn’t available right now — PLAY NOW plays against the computer.'))} icon={<GlobeOrbit />} />
          <RingButton color="purple" label="PRIVATE GAME" onClick={() => (onlineAvailable() ? onAction({ t: 'private' }) : toast('Private tables need the game server, which can’t be reached right now.'))} icon={<Art n="lock" c="ring-img" />}
            badge={<span className="now-open">WITH FRIENDS</span>} />
        </div>
      </main>

      {p.coins < 1000 && (
        <div className="low-coins" role="status">
          <Coin size={26} /><span>Running low on coins — collect free coins to keep playing.</span>
          {giftReady && <button className="pill gold small-pill" onClick={() => { sfx.click(); setModal('gifts'); }}>Free daily gift</button>}
          <button className="pill green small-pill" onClick={() => { sfx.click(); setModal('bonus'); }}>Bonus coins</button>
        </div>
      )}
      <nav className="bottom-nav" aria-label="Main">
        <button onClick={() => { sfx.click(); onAction({ t: 'ranking' }); }}><Art n="podium" c="nav-img" /><span>RANKING</span></button>
        <button onClick={() => { sfx.click(); setModal('me'); }}><img className="nav-img" src="/ui/trophy.webp" alt="" aria-hidden="true" draggable={false} /><span>MY STATS</span></button>
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
        <button onClick={() => { sfx.click(); setModal('gifts'); }}><Art n="gift" c="nav-img" /><span>GIFTS</span>{giftReady && <span className="badge">1</span>}</button>
        {installed
          ? <button onClick={() => { sfx.click(); void shareGame(); }}><Art n="friends" c="nav-img" /><span>INVITE</span></button>
          : <button onClick={() => { sfx.click(); onAction({ t: 'install' }); }}><Art n="friends" c="nav-img" /><span>GET THE APP</span></button>}
      </nav>

      {modal === 'play' && <PlayModal target={target} setTarget={setTarget} onClose={close} onPlay={(bet, online) => { close(); onAction({ t: 'play', bet, target, online }); }} />}
      {modal === 'spin' && <SpinModal onClose={close} />}
      {modal === 'gifts' && <GiftsModal onClose={close} />}
      {modal === 'bonus' && <BonusModal onClose={close} />}
      {modal === 'me' && <MeModal onClose={close} onPicture={() => { close(); onAction({ t: 'picture' }); }} onName={() => { close(); onAction({ t: 'name' }); }} />}
      {modal === 'settings' && <SettingsModal installed={installed} onClose={close} onAction={(a) => { close(); onAction(a); }} />}
    </div>
  );
}

async function shareGame() {
  const url = 'https://crows-haven.vercel.app/';
  const text = 'Come play Crows Haven with me — bid for the nest, name trump and catch the Crow!';
  try {
    if (navigator.share) { await navigator.share({ title: 'Crows Haven', text, url }); return; }
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast('Invite link copied — paste it to your friends');
  } catch { /* cancelled */ }
}

// ---------------- Play now: choose the bet and the game points ----------------
export function PlayModal({ target, setTarget, onClose, onPlay, create }: { target: number; setTarget: (v: number) => void; onClose: () => void; onPlay: (bet: number, online: boolean) => void; create?: boolean }) {
  const title = create ? 'Create' : 'Play';
  const p = useProfile();
  const affordable = CROWS_BETS.filter((b) => b <= Math.max(CROWS_BETS[0], p.coins));
  const [bi, setBi] = useState(() => Math.max(0, affordable.indexOf(suggestedCrowsBet(p.coins))));
  const bet = affordable[Math.min(bi, affordable.length - 1)] ?? CROWS_BETS[0];
  const city = crowsCity(bet);
  const poor = p.coins < bet;
  return (
    <Modal onClose={onClose} className="create-modal">
      <div className="create-hero" style={{ backgroundImage: `url(/ui/city/${city.toLowerCase().replace(/\s+/g, '')}.webp)` }}>
        <div className="create-head">{title} <span className="mode-word">CROWS HAVEN</span> table</div>
        <div className="city-name" key={city}>{city}</div>
      </div>
      <div className="bet-box">
        <div className="bet-bubble"><img src="/ui/lobby/coins.webp" alt="" aria-hidden="true" /><span>BET {short(bet)}</span></div>
        <div className="slider-row">
          <button className="round-btn" aria-label="Lower bet" onClick={() => setBi(Math.max(0, bi - 1))}><Icon name="minus" /></button>
          <input type="range" min={0} max={affordable.length - 1} value={Math.min(bi, affordable.length - 1)} onChange={(e) => setBi(+e.target.value)} aria-label="Bet" />
          <button className="round-btn" aria-label="Raise bet" onClick={() => setBi(Math.min(affordable.length - 1, bi + 1))}><Icon name="plus" /></button>
        </div>
        <div className="prize-line">Prize for each winner: <Coin size={18} /> {fmt(prizeOf(bet))}</div>
      </div>
      <div className="points-box">
        <div className="points-title">GAME POINTS</div>
        <div className="points-row crows-points-row" role="radiogroup" aria-label="Game points">
          {GAME_POINTS.map((v) => <button key={v} role="radio" aria-checked={target === v} className={`crows-pts ${target === v ? 'on' : ''}`} onClick={() => { sfx.click(); setTarget(v); }}>{v}</button>)}
        </div>
      </div>
      {poor
        ? <Pill color="gold" className="play-now-btn" onClick={onClose}>Not enough coins — collect free coins</Pill>
        : create
          ? <Pill color="green" className="play-now-btn" onClick={() => onPlay(bet, true)}>CREATE TABLE</Pill>
        : onlineAvailable()
          ? <div className="crows-play-btns">
              <Pill color="green" className="play-now-btn" onClick={() => onPlay(bet, true)}>PLAY ONLINE</Pill>
              <Pill color="blue" className="play-now-btn" onClick={() => onPlay(bet, false)}>VS COMPUTER</Pill>
            </div>
          : <Pill color="green" className="play-now-btn" onClick={() => onPlay(bet, false)}>PLAY NOW</Pill>}
    </Modal>
  );
}

// ---------------- Online lobby: the tables people have made (like Spade Haven's) ----------------
const ANY = 0;
export function CrowsOnlineLobby({ onBack, onJoin, onCreate }: { onBack: () => void; onJoin: (t: LobbyTable) => void; onCreate: () => void }) {
  const p = useProfile();
  const [pts, setPts] = useState(ANY);
  const [live, setLive] = useState<LobbyTable[] | null | undefined>(undefined);
  useEffect(() => {
    let on = true;
    const load = () => void listTables().then((t) => { if (on) setLive(t); });
    load();
    const t = setInterval(load, 3000);
    return () => { on = false; clearInterval(t); };
  }, []);
  const opts = [ANY, ...GAME_POINTS];
  const cycle = (d: number) => { sfx.click(); setPts(opts[(opts.indexOf(pts) + d + opts.length) % opts.length]); };
  const tables = (live ?? []).filter((t) => pts === ANY || t.target === pts);
  return (
    <div className="screen online-lobby city-bg crows-ol">
      <header className="ol-head">
        <button className="back-btn" onClick={() => { sfx.click(); onBack(); }} aria-label="Back to lobby"><Icon name="left" size={28} /></button>
        <div className="ol-box">
          <span className="ol-label">GAME POINTS</span>
          <div className="ol-ctl">
            <button aria-label="Previous" onClick={() => cycle(-1)}><Icon name="left" size={18} /></button>
            <b>{pts === ANY ? 'ANY' : pts}</b>
            <button aria-label="Next" onClick={() => cycle(1)}><Icon name="right" size={18} /></button>
          </div>
        </div>
        <div className="coins-pill small"><Coin size={26} /><span className="coins-num">{fmt(p.coins)}</span></div>
      </header>

      <div className="lt-row">
        <button className="lt-create" onClick={() => { sfx.click(); onCreate(); }} aria-label="Create a table">
          <img className="lt-create-img" src="/ui/lobby/ol-create.webp" alt="" aria-hidden="true" draggable={false} />
          <span className="lt-create-txt">CREATE TABLE</span>
        </button>
        {tables.map((t) => <LiveTable key={t.id} t={t} poor={p.coins < t.bet} onJoin={() => onJoin(t)} />)}
        {tables.length === 0 && (
          <div className="lt-empty" role="status">
            <img className="lt-empty-img" src="/ui/lobby/ol-empty.webp" alt="" aria-hidden="true" draggable={false} />
            <div className="lt-empty-txt">
              {live === null ? <><b>Can’t reach the game server</b><p>Live tables appear here when you’re online. You can still play against the computer from PLAY NOW.</p></>
                : live === undefined ? <b>Looking for tables…</b>
                : <><b>No one has a table open right now</b><p>Create one — choose the bet and the game points — and other players can join you here. Computer players fill any seats still empty after 30 seconds.</p></>}
              {live !== null && live !== undefined && <button className="lt-empty-btn" onClick={() => { sfx.click(); onCreate(); }}>CREATE A TABLE</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LiveTable({ t, poor, onJoin }: { t: LobbyTable; poor: boolean; onJoin: () => void }) {
  const city = crowsCity(t.bet);
  const look = lookFor(city);
  const waiting = !t.started;
  const mine = waiting ? t.seats.findIndex((s) => !s) : -1;   // the seat you'd take (the server seats you in the first empty one)
  const base = mine >= 0 ? mine : 0;
  const pos = ['bottom', 'left', 'top', 'right'];
  const humans = t.seats.filter((s) => s && !s.bot).length;
  return (
    <div className={`lt ${poor ? 'poor' : ''} ${waiting ? '' : 'busy'}`} style={themeVars(themeById(look.theme))}>
      <TableShape scale={0.62} emblem={false} />
      <div className="lt-felt">
        <div className="lt-city"><span>{city}</span><CityRing gem={look.gem} /></div>
        <div className="lt-pills">
          <span className="lt-pill">{fmt(t.bet)} <Coin size={30} /></span>
          <span className="lt-pill">{t.target}</span>
        </div>
        <span className="lt-status">{waiting ? `${humans} player${humans === 1 ? '' : 's'} waiting` : 'GAME IN PROGRESS'}</span>
      </div>
      {[0, 1, 2, 3].map((seat) => {
        const rel = (seat - base + 4) % 4;
        if (rel === 0 && mine >= 0) return null;   // your seat = the PLAY button
        const s = t.seats[seat];
        return (
          <span key={seat} className={`lt-seat at-${pos[rel]} ${rel === 2 ? 'blue' : 'red'}`}>
            {s ? <><span className="bezel" /><CrowsAvatar k={s.avatar} size={78} name={s.name} /><small className="lt-name">{s.name}</small></> : <span className="lt-q">?</span>}
          </span>
        );
      })}
      {waiting && mine >= 0
        ? <button className="lt-play" onClick={() => { if (poor) { toast(`You need ${fmt(t.bet)} coins for this table`, 'error'); return; } sfx.click(); onJoin(); }} aria-label={`Play at the ${city} table, bet ${fmt(t.bet)}`}>
            <span className="lt-arrow">↑</span><b>PLAY</b>
          </button>
        : <span className="lt-live">PLAYING</span>}
    </div>
  );
}

// ---------------- free coins: bonus every 30 minutes, the mega wheel every 4 hours, the daily gift ----------------
function useCountdown(to: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((to - now) / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function BonusModal({ onClose }: { onClose: () => void }) {
  const p = useProfile();
  useCountdown(p.lastAd + BONUS_EVERY_MS);
  const left = bonusLeftMs(p.lastAd);
  const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
  return (
    <Modal title="Bonus coins" onClose={onClose}>
      <div className="bonus-box"><Coin size={64} /><p>{BONUS_COINS} free coins every 30 minutes</p><small>Come back any time to top up your balance.</small></div>
      <Pill color="green" className="wide-btn" disabled={left > 0} onClick={() => { if (bonusLeftMs(profile.get().lastAd) > 0) return; profile.set((x) => ({ coins: x.coins + BONUS_COINS, lastAd: Date.now() })); sfx.coins(); toast(`+${BONUS_COINS} coins`, 'coins'); onClose(); }}>
        {left > 0 ? `Next bonus in ${mm}:${String(ss).padStart(2, '0')}` : `Collect ${BONUS_COINS} coins`}
      </Pill>
    </Modal>
  );
}

function SpinModal({ onClose }: { onClose: () => void }) {
  const p = useProfile();
  const ready = Date.now() - p.lastSpin > MEGA_MS;
  const next = useCountdown(p.lastSpin + MEGA_MS);
  return (
    <MegaWheel ready={ready} nextIn={next} mult={1} onClose={onClose} tick={sfx.tick} jackpot={sfx.jackpot}
      onWin={(win) => { profile.set((x) => ({ coins: x.coins + win, lastSpin: Date.now() })); sfx.coins(); vibrate(40); }} />
  );
}

function GiftsModal({ onClose }: { onClose: () => void }) {
  const p = useProfile();
  const d = dailyState(p);
  const collect = () => {
    const x = dailyState(profile.get());
    if (!x.can) return;
    profile.set((q) => ({ coins: q.coins + x.reward, lastDaily: x.today, streak: x.next }));
    sfx.coins(); toast(`+${fmt(x.reward)} coins`, 'coins');
  };
  return (
    <Modal title="Daily gift" onClose={onClose} className="daily-modal">
      <p className="daily-lead">{d.can ? (d.current > 0 ? <>You're on a <b>{d.current}-day streak</b>. Collect today to keep it going!</> : <>Collect every day for a bigger gift each time.</>) : <>Come back tomorrow to keep your <b>{d.current}-day streak</b>.</>}</p>
      <ol className="daily-days">
        {DAILY_REWARDS.map((c, i) => {
          const done = d.can ? i < d.dayIdx : i <= d.dayIdx;
          const today = d.can && i === d.dayIdx;
          return (
            <li key={i} className={`dd ${done ? 'done' : ''} ${today ? 'today' : ''} ${i === DAILY_REWARDS.length - 1 ? 'big' : ''}`}>
              <small>DAY {i + 1}</small>
              <Coin size={i === DAILY_REWARDS.length - 1 ? 40 : 30} />
              <b>{fmt(c)}</b>
              {done && <span className="dd-tick" aria-label="collected">✓</span>}
            </li>
          );
        })}
      </ol>
      <Pill color="gold" disabled={!d.can} onClick={collect}>{d.can ? `Collect ${fmt(d.reward)}` : 'Collected today'}</Pill>
    </Modal>
  );
}

function MeModal({ onClose, onPicture, onName }: { onClose: () => void; onPicture: () => void; onName: () => void }) {
  const p = useProfile();
  const lvl = levelFromXp(p.xp);
  const pct = Math.round(((p.xp - xpForLevel(lvl)) / (xpForLevel(lvl + 1) - xpForLevel(lvl))) * 100);
  const rate = p.stats.played ? Math.round((p.stats.won / p.stats.played) * 100) : 0;
  return (
    <Modal title="Your profile" onClose={onClose} className="crows-me-modal">
      <div className="crows-me-head">
        <button className="crows-me-pic" onClick={onPicture} aria-label="Change your picture"><CrowsAvatar k={p.avatar} size={110} name={p.name} /><span>Change</span></button>
        <div>
          <h3>{p.name}</h3>
          <button className="pill blue small-pill" onClick={() => { sfx.click(); onName(); }}>Change name</button>
          <div className="crows-me-level"><b>LEVEL {lvl}</b><span className="crows-me-bar"><i style={{ width: `${pct}%` }} /></span><small>{pct}% to level {lvl + 1}</small></div>
        </div>
      </div>
      <div className="crows-stats">
        <div><b>{fmt(p.coins)}</b><small>COINS</small></div>
        <div><b>{p.stats.played}</b><small>GAMES</small></div>
        <div><b>{p.stats.won}</b><small>WINS</small></div>
        <div><b>{rate}%</b><small>WIN RATE</small></div>
        <div><b>{short(p.stats.biggestWin)}</b><small>BIGGEST WIN</small></div>
      </div>
    </Modal>
  );
}

function SettingsModal({ installed, onClose, onAction }: { installed: boolean; onClose: () => void; onAction: (a: LobbyAction) => void }) {
  const p = useProfile();
  const flip = (k: 'sound' | 'vibrate' | 'bigCards') => { sfx.click(); profile.set((x) => ({ settings: { ...x.settings, [k]: !x.settings[k] } })); };
  const row = (label: string, on: boolean, k: 'sound' | 'vibrate' | 'bigCards') => (
    <label className="crows-set-row"><span>{label}</span>
      <input type="checkbox" checked={on} onChange={() => flip(k)} aria-label={label} />
      <span className="ct-switch" aria-hidden="true"><i>{on ? 'ON' : 'OFF'}</i></span>
    </label>
  );
  return (
    <Modal title="Settings" onClose={onClose} className="crows-settings">
      {row('Sound', p.settings.sound, 'sound')}
      {row('Vibration', p.settings.vibrate, 'vibrate')}
      {row('Bigger cards', !!p.settings.bigCards, 'bigCards')}
      <div className="crows-set-btns">
        <Pill color="blue" onClick={() => onAction({ t: 'name' })}>Change name</Pill>
        <Pill color="purple" onClick={() => onAction({ t: 'picture' })}>Change picture</Pill>
        <Pill color="gold" onClick={() => onAction({ t: 'rules' })}>How to play</Pill>
        {!installed && <Pill color="green" onClick={() => onAction({ t: 'install' })}>Install the app</Pill>}
        <Pill color="red" onClick={() => onAction({ t: 'exit' })}>Exit</Pill>
      </div>
      <p className="crows-small-note">Crows Haven · free coins only, nothing to buy · your progress is saved on this device</p>
    </Modal>
  );
}

/** Golden 3D settings cog (same drawing as Spade Haven's). */
const COG = 'M40.0 17.5 L41.3 6.9 L58.7 6.9 L60.0 17.5 L65.9 19.9 L74.3 13.3 L86.7 25.7 L80.1 34.1 L82.5 40.0 L93.1 41.3 L93.1 58.7 L82.5 60.0 L80.1 65.9 L86.7 74.3 L74.3 86.7 L65.9 80.1 L60.0 82.5 L58.7 93.1 L41.3 93.1 L40.0 82.5 L34.1 80.1 L25.7 86.7 L13.3 74.3 L19.9 65.9 L17.5 60.0 L6.9 58.7 L6.9 41.3 L17.5 40.0 L19.9 34.1 L13.3 25.7 L25.7 13.3 L34.1 19.9Z';
function GoldGear() {
  return (
    <svg className="gold-gear" viewBox="0 0 100 100" width="64" height="64" aria-hidden="true">
      <defs>
        <linearGradient id="cg-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff4c2" /><stop offset=".3" stopColor="#f5c84a" /><stop offset=".65" stopColor="#b47a0c" /><stop offset="1" stopColor="#ffd970" /></linearGradient>
        <radialGradient id="cg-hub" cx=".4" cy=".35" r=".7"><stop offset="0" stopColor="#3a2a6a" /><stop offset="1" stopColor="#120a2e" /></radialGradient>
      </defs>
      <g className="gg-rot">
        <path d={COG} transform="translate(0 3)" fill="#5a3606" />
        <path d={COG} fill="url(#cg-gold)" stroke="#6b4306" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="50" cy="50" r="24" fill="none" stroke="#fff6cf" strokeOpacity=".55" strokeWidth="2" />
        <circle cx="50" cy="50" r="17" fill="#6b4306" />
        <circle cx="50" cy="50" r="14.5" fill="url(#cg-hub)" />
        <path d="M24 34 A30 30 0 0 1 50 20" fill="none" stroke="#fffbe6" strokeOpacity=".85" strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}
function GoldStar() {
  const pts = Array.from({ length: 10 }, (_, i) => { const a = (i * Math.PI) / 5 - Math.PI / 2, r = i % 2 ? 19 : 44; return `${(50 + r * Math.cos(a)).toFixed(1)} ${(52 + r * Math.sin(a)).toFixed(1)}`; }).join(' L');
  return (
    <svg viewBox="0 0 100 100" width="54" height="54" aria-hidden="true">
      <defs><linearGradient id="cs-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff4c2" /><stop offset=".35" stopColor="#f5c84a" /><stop offset=".7" stopColor="#b47a0c" /><stop offset="1" stopColor="#ffd970" /></linearGradient></defs>
      <path d={`M${pts}Z`} transform="translate(0 3)" fill="#5a3606" />
      <path d={`M${pts}Z`} fill="url(#cs-gold)" stroke="#6b4306" strokeWidth="3" strokeLinejoin="round" />
      <path d="M50 20 L42 40 L22 41" fill="none" stroke="#fffbe6" strokeOpacity=".8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
