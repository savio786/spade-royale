import { useEffect, useMemo, useState } from 'react';
import { Avatar, AVATAR_KEYS, Coin, Icon, Modal, Pill } from '../components/ui';
import { BET_STEPS, cityForBet, fmt, levelFromXp, MAX_STEPS, MIN_STEPS, profile, rewardForRank, short, useProfile, weekEndsAt, xpForLevel } from '../lib/profile';
import { Board, BoardRow, fetchBoard } from '../lib/api';
import type { OnlineCounts } from '../../shared/protocol';
import { sfx } from '../lib/sound';
import { toast } from '../lib/toast';
import { net, NetStatus } from '../lib/net';
import { Mode, prizeFor } from '../../shared/engine';

export interface StartRequest {
  mode: Mode; bet: number; minPoints: number; maxPoints: number;
  via: 'quick' | 'table' | 'createPrivate' | 'joinPrivate' | 'local';
  tableId?: string; code?: string;
}

function useCountdown(to: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((to - now) / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (d ? `${d}d ` : '') + `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

// ---------------- Leaderboard (real players only, from the game server) ----------------
export function LeaderboardModal({ onClose }: { onClose: () => void }) {
  const p = useProfile();
  const [tab, setTab] = useState<'global' | 'friends' | 'fame'>('global');
  const [showLast, setShowLast] = useState(false);
  const [data, setData] = useState<Board | null | 'loading'>('loading');
  useEffect(() => { let live = true; fetchBoard(p.id).then((b) => live && setData(b)); return () => { live = false; }; }, [p.id]);
  const b = data === 'loading' ? null : data;
  const ends = useCountdown(b?.endsAt ?? weekEndsAt());

  const rows: BoardRow[] = useMemo(() => {
    if (!b) return p.weekEarnings > 0 ? [{ name: p.name, avatar: p.avatar, earnings: p.weekEarnings, me: true }] : [];
    if (tab === 'friends') {
      const names = new Set(p.friends.map((f) => f.name.toLowerCase()));
      return b.rows.filter((r) => r.me || names.has(r.name.toLowerCase()));
    }
    return b.rows;
  }, [b, tab, p.friends, p.name, p.avatar, p.weekEarnings]);

  const lastRank = b?.lastWeek?.rank ?? null;
  const lastWeekKey = b?.lastWeek?.week ?? '';
  const claimed = !!lastWeekKey && p.claimedWeeks.includes(lastWeekKey);
  const empty = (text: string) => <div className="lb-empty"><Icon name="trophy" size={44} /><p>{text}</p></div>;

  return (
    <Modal onClose={onClose} wide className="lb-modal">
      <h2 className="lb-title">LEADERBOARD — CURRENT WEEK</h2>
      <div className="lb-wrap">
        <div className="lb-main">
          <div className="tabs" role="tablist">
            {(['global', 'friends', 'fame'] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => { sfx.click(); setTab(t); }}>
                {t === 'global' ? 'Global' : t === 'friends' ? 'Friends' : 'Wall of Fame'}
              </button>
            ))}
          </div>
          {data === 'loading' ? empty('Loading this week’s results…') : tab !== 'fame' ? (
            rows.length === 0 ? empty(
              !b ? 'The leaderboard is shown when the game server is running. Your wins this week still count on this device.'
                : tab === 'friends' ? 'None of your friends have won a game this week yet. Add friends by their player name.'
                : 'No wins yet this week. Win a game to take the #1 spot.'
            ) : (
              <>
                <div className="lb-head"><span>Rank</span><span>Player</span><span>Earnings</span></div>
                <ol className="lb-list">
                  {rows.slice(0, 100).map((r, i) => (
                    <li key={r.name + i} className={`lb-row ${r.me ? 'me' : ''}`}>
                      <span className="lb-rank">{i < 3 ? <span className={`medal m${i + 1}`}>{['I', 'II', 'III'][i]}</span> : i + 1}</span>
                      <Avatar k={r.avatar} size={44} />
                      <span className="lb-name">{r.name}{r.me ? ' (you)' : ''}</span>
                      <span className="lb-earn"><Coin size={24} />{fmt(r.earnings)}</span>
                    </li>
                  ))}
                </ol>
              </>
            )
          ) : (
            !b || b.fame.length === 0 ? empty('Each week’s champion is added here when the week ends. The first one is still to be decided.') : (
              <ol className="lb-list">
                {b.fame.map((f) => (
                  <li key={f.week} className="lb-row">
                    <span className="lb-rank"><span className="medal m1">I</span></span>
                    <span className="lb-week">Week of {new Date(f.week + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>
                    <Avatar k={f.avatar} size={44} />
                    <span className="lb-name">{f.name}</span>
                    <span className="lb-earn"><Coin size={24} />{fmt(f.earnings)}</span>
                  </li>
                ))}
              </ol>
            )
          )}
          {tab === 'global' && b && <div className="lb-me">Your rank: <b>{b.me.rank ? `#${b.me.rank}` : 'not ranked yet'}</b> · {fmt(b.me.earnings)} won this week</div>}
        </div>
        <aside className="lb-side">
          <div className="rewards">
            <div className="rewards-title">Rank Rewards</div>
            {[['1st', 50000], ['2nd', 25000], ['3rd', 10000], ['4–10', 5000], ['11–50', 2500], ['51–100', 1000]].map(([k, v], i) => (
              <div key={k} className={`reward-row r${i}`}><span>{k}</span><span>{i < 3 && <Coin size={20} />}{fmt(v as number)}</span></div>
            ))}
          </div>
          <div className="ends">ENDS IN: <b>{ends}</b></div>
          <Pill color="green" onClick={() => setShowLast(true)}>Last week results</Pill>
        </aside>
      </div>
      {showLast && (
        <Modal title="Last week" onClose={() => setShowLast(false)}>
          {lastRank ? (
            <div className="center-col">
              <p>You finished <b>#{lastRank}</b>.</p>
              {rewardForRank(lastRank) > 0 && !claimed ? (
                <Pill color="gold" onClick={() => { profile.set((x) => ({ coins: x.coins + rewardForRank(lastRank), claimedWeeks: [...x.claimedWeeks, lastWeekKey].slice(-20) })); sfx.coins(); toast(`+${fmt(rewardForRank(lastRank))} coins`, 'coins'); setShowLast(false); }}>
                  Claim <Coin size={18} /> {fmt(rewardForRank(lastRank))}
                </Pill>
              ) : <p className="muted">{rewardForRank(lastRank) ? 'Reward claimed.' : 'Finish in the top 100 to earn a reward.'}</p>}
            </div>
          ) : <p className="muted">No results from last week. Win games this week to climb the board.</p>}
        </Modal>
      )}
    </Modal>
  );
}

// ---------------- Store ----------------
const PACKS = [
  { coins: 25_000, price: '$0.99' }, { coins: 150_000, price: '$4.99', tag: 'Popular' }, { coins: 400_000, price: '$9.99' },
  { coins: 1_000_000, price: '$19.99', tag: 'Best value' }, { coins: 3_000_000, price: '$49.99' }, { coins: 8_000_000, price: '$99.99' },
];
export function StoreModal({ onClose }: { onClose: () => void }) {
  const p = useProfile();
  return (
    <Modal title="Buy coins" onClose={onClose} wide>
      <p className="note">Test store: purchases are simulated. Connect Google Play Billing / Apple In-App Purchase before release (README → “Payments”).</p>
      <div className="packs">
        {PACKS.map((k) => {
          const bonus = p.vip ? Math.round(k.coins * 0.2) : 0;
          return (
            <div key={k.coins} className="pack">
              {k.tag && <span className="pack-tag">{k.tag}</span>}
              <div className="pack-coins"><Coin size={40} /></div>
              <div className="pack-amt">{fmt(k.coins)}</div>
              {bonus > 0 && <div className="pack-bonus">+{fmt(bonus)} VIP bonus</div>}
              <Pill color="green" onClick={() => { profile.addCoins(k.coins + bonus); sfx.coins(); toast(`+${fmt(k.coins + bonus)} coins`, 'coins'); }}>{k.price}</Pill>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ---------------- VIP ----------------
export function VipModal({ onClose }: { onClose: () => void }) {
  const p = useProfile();
  return (
    <Modal title={<span className="gold-text">VIP CLUB</span>} onClose={onClose}>
      <ul className="perks">
        <li><Icon name="crown" /> Gold avatar frame at every table</li>
        <li><Icon name="star" /> +10% on every prize you win</li>
        <li><Icon name="gift" /> +20% coins on every store pack</li>
        <li><Icon name="bolt" /> Double daily-spin rewards</li>
      </ul>
      {p.vip ? <p className="center gold-text">You're a VIP member.</p> : (
        <Pill color="gold" className="wide-btn" onClick={() => { profile.set({ vip: true }); sfx.win(); toast('Welcome to the VIP Club!'); onClose(); }}>Join VIP — $4.99/week (test mode)</Pill>
      )}
    </Modal>
  );
}

// ---------------- Rewarded ad ----------------
export function AdModal({ onClose }: { onClose: () => void }) {
  const [left, setLeft] = useState(5);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <Modal title="Watch & earn" onClose={onClose}>
      <div className="ad-box"><Icon name="tv" size={64} /><p>Rewarded video placeholder</p><small>Plug in AdMob (Android/iOS) or your ad network here.</small></div>
      <Pill color="green" className="wide-btn" disabled={left > 0} onClick={() => { profile.set((x) => ({ coins: x.coins + 100, lastAd: Date.now() })); sfx.coins(); toast('+100 coins', 'coins'); onClose(); }}>
        {left > 0 ? `Reward in ${left}s` : 'Collect +100 coins'}
      </Pill>
    </Modal>
  );
}

// ---------------- Daily spin ----------------
const WHEEL = [500, 1000, 2500, 750, 5000, 1500, 10000, 2000];
export function SpinModal({ onClose }: { onClose: () => void }) {
  const p = useProfile();
  const ready = Date.now() - p.lastSpin > 4 * 3600e3;
  const next = useCountdown(p.lastSpin + 4 * 3600e3);
  const [angle, setAngle] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const spin = () => {
    if (!ready || spinning) return;
    const idx = Math.floor(Math.random() * WHEEL.length);
    const seg = 360 / WHEEL.length;
    setSpinning(true);
    setAngle(360 * 6 + (360 - idx * seg - seg / 2));
    setTimeout(() => {
      const win = WHEEL[idx] * (p.vip ? 2 : 1);
      setResult(win); setSpinning(false);
      profile.set((x) => ({ coins: x.coins + win, lastSpin: Date.now() }));
      sfx.coins(); toast(`+${fmt(win)} coins`, 'coins');
    }, 4200);
  };
  return (
    <Modal title="Daily bonus wheel" onClose={onClose}>
      <div className="wheel-wrap">
        <div className="wheel-pointer" aria-hidden="true" />
        <svg className="wheel" viewBox="-100 -100 200 200" style={{ transform: `rotate(${angle}deg)` }} role="img" aria-label="Prize wheel">
          {WHEEL.map((v, i) => {
            const a0 = (i * 2 * Math.PI) / WHEEL.length - Math.PI / 2, a1 = ((i + 1) * 2 * Math.PI) / WHEEL.length - Math.PI / 2;
            const mid = (a0 + a1) / 2;
            return (
              <g key={i}>
                <path d={`M0 0 L${95 * Math.cos(a0)} ${95 * Math.sin(a0)} A95 95 0 0 1 ${95 * Math.cos(a1)} ${95 * Math.sin(a1)}z`} fill={i % 2 ? '#3b1d8f' : '#7b2ff7'} stroke="#ffc83d" strokeWidth="1.5" />
                <text x={62 * Math.cos(mid)} y={62 * Math.sin(mid)} fill="#fff" fontSize="14" fontFamily="Bebas Neue, Impact, sans-serif" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${(mid * 180) / Math.PI + 90} ${62 * Math.cos(mid)} ${62 * Math.sin(mid)})`}>{short(v * (p.vip ? 2 : 1))}</text>
              </g>
            );
          })}
          <circle r="16" fill="#ffc83d" stroke="#8a4b00" strokeWidth="2" />
        </svg>
      </div>
      {result !== null ? <p className="center big-win"><Coin size={26} /> +{fmt(result)}</p> : null}
      <Pill color="gold" className="wide-btn" disabled={!ready || spinning} onClick={spin}>{ready ? (spinning ? 'Spinning…' : 'SPIN') : `Next spin in ${next}`}</Pill>
    </Modal>
  );
}

// ---------------- Gifts ----------------
export function GiftsModal({ onClose }: { onClose: () => void }) {
  const p = useProfile();
  const today = new Date().toISOString().slice(0, 10);
  const can = p.lastDaily !== today;
  return (
    <Modal title="Gifts" onClose={onClose}>
      <div className="gift-card">
        <Icon name="gift" size={52} />
        <div><b>Daily free gift</b><p className="muted">2,000 coins every day</p></div>
        <Pill color="gold" disabled={!can} onClick={() => { profile.set((x) => ({ coins: x.coins + 2000, lastDaily: today })); sfx.coins(); toast('+2,000 coins', 'coins'); }}>{can ? 'Collect' : 'Collected'}</Pill>
      </div>
    </Modal>
  );
}

// ---------------- Friends ----------------
export function FriendsModal({ onClose, onInvite }: { onClose: () => void; onInvite: () => void }) {
  const p = useProfile();
  const [name, setName] = useState('');
  return (
    <Modal title="Friends" onClose={onClose}>
      <form className="row-form" onSubmit={(e) => {
        e.preventDefault();
        const n = name.trim();
        if (!n) return;
        profile.set((x) => ({ friends: [...x.friends, { id: Math.random().toString(36).slice(2), name: n.slice(0, 18), avatar: AVATAR_KEYS[Math.floor(Math.random() * 12)], level: 0, online: false }] }));
        setName(''); toast(`${n} added to your friends`);
      }}>
        <label className="sr-only" htmlFor="fr-name">Player name</label>
        <input id="fr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Add friend by player name" />
        <Pill type="submit" color="green"><Icon name="plus" size={16} /> Add</Pill>
      </form>
      {p.friends.length === 0 && <p className="muted center">No friends yet. Add a player by their name, then invite them to a private table.</p>}
      <ul className="friend-list">
        {p.friends.map((f) => (
          <li key={f.id}>
            <Avatar k={f.avatar} size={44} />
            <span className="grow"><b>{f.name}</b><small className="muted">Invite them with a private-table code</small></span>
            <Pill color="purple" onClick={onInvite}>Invite</Pill>
            <button className="icon-btn" aria-label={`Remove ${f.name}`} onClick={() => profile.set((x) => ({ friends: x.friends.filter((y) => y.id !== f.id) }))}><Icon name="close" size={16} /></button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

// ---------------- Trophies ----------------
export const ACHIEVEMENTS = [
  { id: 'first', name: 'First Book', desc: 'Play your first game', goal: 1, stat: 'played', reward: 1000 },
  { id: 'win1', name: 'Winner', desc: 'Win a game', goal: 1, stat: 'won', reward: 2500 },
  { id: 'win10', name: 'Table Boss', desc: 'Win 10 games', goal: 10, stat: 'won', reward: 15000 },
  { id: 'partners5', name: 'Dynamic Duo', desc: 'Win 5 Partners games', goal: 5, stat: 'partnersWins', reward: 10000 },
  { id: 'solo5', name: 'Lone Wolf', desc: 'Win 5 Solo games', goal: 5, stat: 'soloWins', reward: 10000 },
  { id: 'nil3', name: 'Nil Ninja', desc: 'Make 3 nil bids', goal: 3, stat: 'nilsMade', reward: 7500 },
  { id: 'play50', name: 'Card Shark', desc: 'Play 50 games', goal: 50, stat: 'played', reward: 50000 },
] as const;
export function TrophyModal({ onClose }: { onClose: () => void }) {
  const p = useProfile();
  const lvl = levelFromXp(p.xp);
  const pct = ((p.xp - xpForLevel(lvl)) / (xpForLevel(lvl + 1) - xpForLevel(lvl))) * 100;
  return (
    <Modal title="Trophies" onClose={onClose} wide>
      <div className="stats-row">
        <div><b>{p.stats.played}</b><span>Played</span></div>
        <div><b>{p.stats.won}</b><span>Won</span></div>
        <div><b>{p.stats.played ? Math.round((100 * p.stats.won) / p.stats.played) : 0}%</b><span>Win rate</span></div>
        <div><b>{p.stats.nilsMade}</b><span>Nils made</span></div>
        <div><b>{short(p.stats.biggestWin)}</b><span>Biggest win</span></div>
      </div>
      <div className="xpbar" aria-label={`Level ${lvl} progress`}><span style={{ width: `${pct}%` }} /><em>Level {lvl} · {p.xp - xpForLevel(lvl)} / {xpForLevel(lvl + 1) - xpForLevel(lvl)} XP</em></div>
      <ul className="ach-list">
        {ACHIEVEMENTS.map((a) => {
          const v = p.stats[a.stat as keyof typeof p.stats] as number;
          const done = v >= a.goal, claimed = p.claimed.includes(a.id);
          return (
            <li key={a.id} className={done ? 'done' : ''}>
              <Icon name="trophy" size={34} />
              <span className="grow"><b>{a.name}</b><small>{a.desc} · {Math.min(v, a.goal)}/{a.goal}</small>
                <span className="mini-bar"><span style={{ width: `${Math.min(100, (100 * v) / a.goal)}%` }} /></span></span>
              <Pill color={claimed ? 'ghost' : 'gold'} disabled={!done || claimed} onClick={() => { profile.set((x) => ({ coins: x.coins + a.reward, claimed: [...x.claimed, a.id] })); sfx.coins(); toast(`+${fmt(a.reward)} coins`, 'coins'); }}>
                {claimed ? 'Claimed' : <><Coin size={16} /> {short(a.reward)}</>}
              </Pill>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

// ---------------- Settings ----------------
export function SettingsModal({ onClose, installPrompt }: { onClose: () => void; installPrompt: null | (() => void) }) {
  const p = useProfile();
  const [name, setName] = useState(p.name);
  const [status, setStatus] = useState<NetStatus>(net.status);
  const [confirmOut, setConfirmOut] = useState(false);
  useEffect(() => net.onStatus(setStatus), []);
  const toggle = (k: keyof typeof p.settings) => profile.set((x) => ({ settings: { ...x.settings, [k]: !x.settings[k] } }));
  return (
    <Modal title="Settings" onClose={onClose}>
      <label className="field"><span>Player name</span>
        <input value={name} maxLength={18} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && profile.set({ name: name.trim() })} /></label>
      <div className="field"><span>Avatar</span>
        <div className="avatar-grid">
          {AVATAR_KEYS.map((k) => (
            <button key={k} className={`avatar-pick ${k === p.avatar ? 'on' : ''}`} aria-pressed={k === p.avatar} aria-label={`Avatar ${k}`} onClick={() => profile.set({ avatar: k })}><Avatar k={k} size={44} /></button>
          ))}
        </div></div>
      <div className="toggles">
        {([['sound', 'Sound effects'], ['fast', 'Fast bots'], ['vibrate', 'Vibration']] as const).map(([k, l]) => (
          <label key={k} className="toggle"><input type="checkbox" checked={p.settings[k]} onChange={() => toggle(k)} /><span className="tg" /> {l}</label>
        ))}
      </div>
      <p className="muted small">Multiplayer server: <b className={status === 'online' ? 'online' : ''}>{status}</b> · Signed in: {p.provider}</p>
      <div className="btn-row">
        {installPrompt && <Pill color="blue" onClick={installPrompt}><Icon name="download" size={16} /> Install app</Pill>}
        <Pill color="red" onClick={() => { if (confirmOut) { profile.reset(); onClose(); } else setConfirmOut(true); }}><Icon name="exit" size={16} /> {confirmOut ? 'Tap again to reset profile' : 'Sign out'}</Pill>
      </div>
    </Modal>
  );
}

// ---------------- Room type (Solo / Partners) ----------------
export function RoomTypeModal({ onPick, onClose, online }: { onPick: (m: Mode) => void; onClose: () => void; online: OnlineCounts | null }) {
  const count = (m: Mode) => (online ? `${online[m]} playing now` : 'Play vs computer');
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="roomtype" role="dialog" aria-modal="true" aria-label="Choose room type">
        <button className="mode-card" onClick={() => { sfx.click(); onPick('solo'); }}>
          <span className="mode-title">SOLO</span>
          <span className="mode-sub">Play against all other players</span>
          <span className="mode-art solo"><Icon name="spade" size={84} /><span className="laurel" /></span>
          <span className="mode-count"><Icon name="users" size={16} /> {count('solo')}</span>
        </button>
        <button className="mode-card" onClick={() => { sfx.click(); onPick('partners'); }}>
          <span className="mode-title">PARTNERS</span>
          <span className="mode-sub">Play classic spades</span>
          <span className="mode-art partners"><Icon name="spade" size={70} /><Icon name="spade" size={70} /></span>
          <span className="mode-count"><Icon name="users" size={16} /> {count('partners')}</span>
        </button>
        <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
      </div>
    </div>
  );
}

// ---------------- Create table ----------------
export function CreateTableModal({ mode, onClose, onCreate, title = 'Create', privateTable }: {
  mode: Mode; onClose: () => void; onCreate: (s: { bet: number; minPoints: number; maxPoints: number }) => void; title?: string; privateTable?: boolean;
}) {
  const p = useProfile();
  const affordable = BET_STEPS.filter((b) => b <= Math.max(100, p.coins));
  const [bi, setBi] = useState(Math.max(0, affordable.indexOf(p.lastTable?.bet ?? 100)));
  const [mi, setMi] = useState(Math.max(0, MIN_STEPS.indexOf(p.lastTable?.minPoints ?? -100)));
  const [xi, setXi] = useState(Math.max(0, MAX_STEPS.indexOf(p.lastTable?.maxPoints ?? 100)));
  const bet = affordable[Math.min(bi, affordable.length - 1)] ?? 100;
  const city = cityForBet(bet);
  return (
    <Modal onClose={onClose} className="create-modal">
      <div className="create-head">{title} <span className="mode-word">{mode.toUpperCase()}</span> {privateTable ? 'private ' : ''}table</div>
      <div className="city-name">{city}</div>
      <div className="bet-box">
        <div className="bet-bubble">BET {short(bet)} <Coin size={26} /></div>
        <div className="slider-row">
          <button className="round-btn" aria-label="Lower bet" onClick={() => setBi(Math.max(0, bi - 1))}><Icon name="minus" /></button>
          <input type="range" min={0} max={affordable.length - 1} value={Math.min(bi, affordable.length - 1)} onChange={(e) => setBi(+e.target.value)} aria-label="Bet" />
          <button className="round-btn" aria-label="Raise bet" onClick={() => setBi(Math.min(affordable.length - 1, bi + 1))}><Icon name="plus" /></button>
        </div>
        <div className="prize-line">Prize per winner: <Coin size={18} /> {fmt(prizeFor({ mode, bet }))}</div>
      </div>
      <div className="points-box">
        <div className="points-title">GAME ENDING POINTS</div>
        <div className="points-row">
          <span className="stepper"><em>MIN</em>
            <button className="round-btn" aria-label="Lower minimum" onClick={() => setMi(Math.min(MIN_STEPS.length - 1, mi + 1))}><Icon name="minus" /></button>
            <b>{MIN_STEPS[mi]} pts.</b>
            <button className="round-btn" aria-label="Raise minimum" onClick={() => setMi(Math.max(0, mi - 1))}><Icon name="plus" /></button></span>
          <span className="stepper"><em>MAX</em>
            <button className="round-btn" aria-label="Lower maximum" onClick={() => setXi(Math.max(0, xi - 1))}><Icon name="minus" /></button>
            <b>{MAX_STEPS[xi]} pts.</b>
            <button className="round-btn" aria-label="Raise maximum" onClick={() => setXi(Math.min(MAX_STEPS.length - 1, xi + 1))}><Icon name="plus" /></button></span>
        </div>
      </div>
      <Pill color="green" className="play-now-btn" disabled={p.coins < bet} onClick={() => {
        const s = { bet, minPoints: MIN_STEPS[mi], maxPoints: MAX_STEPS[xi] };
        profile.set({ lastTable: s });
        onCreate(s);
      }}>{p.coins < bet ? 'Not enough coins' : 'PLAY NOW'}</Pill>
    </Modal>
  );
}

// ---------------- Private game ----------------
export function PrivateGameModal({ onClose, onStart, status }: { onClose: () => void; onStart: (r: StartRequest) => void; status: NetStatus }) {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [mode, setMode] = useState<Mode>('partners');
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const online = status === 'online';
  if (creating) return <CreateTableModal mode={mode} privateTable title="Create" onClose={() => setCreating(false)} onCreate={(s) => onStart({ ...s, mode, via: online ? 'createPrivate' : 'local' })} />;
  return (
    <Modal title="Private game" onClose={onClose}>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'create'} className={`tab ${tab === 'create' ? 'on' : ''}`} onClick={() => setTab('create')}>Create table</button>
        <button role="tab" aria-selected={tab === 'join'} className={`tab ${tab === 'join' ? 'on' : ''}`} onClick={() => setTab('join')}>Join with code</button>
      </div>
      {!online && <p className="note">The multiplayer server isn't reachable, so private tables will be filled with bots. Start the server (npm run server) to invite friends with a code.</p>}
      {tab === 'create' ? (
        <div className="center-col">
          <p>Create a table, share the invite code with friends, then start when everyone's seated (empty seats can be filled with bots).</p>
          <div className="seg">
            {(['partners', 'solo'] as Mode[]).map((m) => <button key={m} className={mode === m ? 'on' : ''} aria-pressed={mode === m} onClick={() => setMode(m)}>{m}</button>)}
          </div>
          <Pill color="purple" className="wide-btn" onClick={() => setCreating(true)}>Choose bet & points</Pill>
        </div>
      ) : (
        <form className="center-col" onSubmit={(e) => { e.preventDefault(); if (code.trim().length >= 4) onStart({ mode: 'partners', bet: 0, minPoints: -100, maxPoints: 100, via: 'joinPrivate', code: code.trim().toUpperCase() }); }}>
          <label className="field"><span>Invite code</span>
            <input className="code-input" value={code} maxLength={5} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCDE" disabled={!online} /></label>
          <Pill type="submit" color="green" className="wide-btn" disabled={!online || code.trim().length < 4}>Join table</Pill>
        </form>
      )}
    </Modal>
  );
}
