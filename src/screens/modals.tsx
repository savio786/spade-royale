import { PartnersArt, SoloArt } from '../components/ModeArt';
import { MegaWheel } from '../components/MegaWheel';
import { MusicPicker } from '../components/MusicPicker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, AVATAR_KEYS, AvatarPicker, Coin, Icon, Modal, Pill } from '../components/ui';
import { BET_STEPS, cityForBet, fmt, levelFromXp, MAX_STEPS, MIN_STEPS, profile, rewardForRank, short, useProfile, weekEndsAt, xpForLevel } from '../lib/profile';
import { Board, BoardRow, fetchBoard } from '../lib/api';
import { buy, CHAT_PASS_FOR_SALE, chatPassLabel, isTestMode, nativeStoreOff, paymentsReady, store } from '../lib/payments';
import { facebookSignIn, loadAuthConfig, mountGoogleButton, showFacebook, type AuthConfig } from '../lib/auth';
import { EmailModal } from './Login';
import { PRODUCTS, priceLabel } from '../../shared/products';
import { activeTheme, THEMES, themeVars } from '../lib/themes';
import type { OnlineCounts } from '../../shared/protocol';
import { sfx, vibrate } from '../lib/sound';
import { toast } from '../lib/toast';
import { net, NetStatus } from '../lib/net';
import { changeName, checkName } from '../lib/guest';
import { social, useSocial } from '../lib/social';
import { inviteLink, inviteText, loadReferral, useReferral, useReferralFailed } from '../lib/referral';
import { ShareIcon } from './Install';
import type { SocialPerson } from '../../shared/protocol';
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
  const soc = useSocial();
  const [tab, setTab] = useState<'global' | 'friends' | 'fame'>('global');
  const [last, setLast] = useState(false);   // false = this week, true = last week's final results
  const [data, setData] = useState<Board | null | 'loading'>('loading');
  useEffect(() => { let live = true; fetchBoard(p.id).then((b) => live && setData(b)); return () => { live = false; }; }, [p.id]);
  const b = data === 'loading' ? null : data;
  const ends = useCountdown(b?.endsAt ?? weekEndsAt());

  const rows: BoardRow[] = useMemo(() => {
    if (!b) return p.weekEarnings > 0 && !last ? [{ name: p.name, avatar: p.avatar, earnings: p.weekEarnings, me: true }] : [];
    const src = last ? (b.lastWeek?.rows ?? []) : b.rows;
    if (tab === 'friends') {
      const names = new Set(soc.friends.map((f) => f.name.toLowerCase()));
      return src.filter((r) => r.me || names.has(r.name.toLowerCase()));
    }
    return src;
  }, [b, tab, last, soc.friends, p.name, p.avatar, p.weekEarnings]);

  const lastRank = b?.lastWeek?.rank ?? null;
  const lastWeekKey = b?.lastWeek?.week ?? '';
  const claimed = !!lastWeekKey && p.claimedWeeks.includes(lastWeekKey);
  const empty = (text: string) => <div className="lb-empty"><Icon name="trophy" size={44} /><p>{text}</p></div>;

  return (
    <Modal onClose={onClose} wide className="lb-modal">
      <h2 className="lb-title">LEADERBOARD — {last ? 'LAST WEEK' : 'CURRENT WEEK'}</h2>
      <div className="lb-wrap">
        <div className="lb-main">
          <div className="tabs" role="tablist">
            {(['global', 'friends', 'fame'] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => { sfx.click(); setTab(t); }}>
                {t === 'global' ? 'Global' : t === 'friends' ? 'Friends' : 'Wall of Fame'}
              </button>
            ))}
          </div>
          {data === 'loading' ? empty('Loading results…') : tab !== 'fame' ? (
            rows.length === 0 ? empty(
              !b ? 'The leaderboard is shown when the game server is running. Your wins this week still count on this device.'
                : tab === 'friends' ? `None of your friends ${last ? 'finished in last week’s results' : 'have won a game this week yet'}. Add friends by their player name.`
                : last ? 'No results from last week. Win games this week to climb the board.'
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
            !b || (b.fame.length === 0 && !(b.allTime?.length)) ? empty('The best players of all time appear here. Win games to get on the Wall of Fame.') : (
              <>
              {!!b.allTime?.length && (
                <>
                  <div className="lb-head"><span>Rank</span><span>Player</span><span>Total won</span></div>
                  <ol className="lb-list">
                    {b.allTime.map((r, i) => (
                      <li key={r.name + i} className={`lb-row ${r.me ? 'me' : ''}`}>
                        <span className="lb-rank">{i < 3 ? <span className={`medal m${i + 1}`}>{['I', 'II', 'III'][i]}</span> : i + 1}</span>
                        <Avatar k={r.avatar} size={44} />
                        <span className="lb-name">{r.name}{r.me ? ' (you)' : ''}</span>
                        <span className="lb-earn"><Coin size={24} />{fmt(r.earnings)}</span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
              {b.fame.length > 0 && <div className="lb-head lb-head2"><span>Weekly champions</span></div>}
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
              </>
            )
          )}
          {tab === 'fame' && b?.meAllTime && <div className="lb-me">Your all-time rank: <b>{b.meAllTime.rank ? `#${b.meAllTime.rank}` : 'not ranked yet'}</b> · {fmt(b.meAllTime.earnings)} won in total</div>}
          {tab === 'global' && b && !last && <div className="lb-me">Your rank: <b>{b.me.rank ? `#${b.me.rank}` : 'not ranked yet'}</b> · {fmt(b.me.earnings)} won this week</div>}
          {tab !== 'fame' && b && last && (
            <div className="lb-me">
              {lastRank ? <>You finished <b>#{lastRank}</b>. </> : 'You were not ranked last week. '}
              {lastRank && rewardForRank(lastRank) > 0 && !claimed ? (
                <Pill color="gold" onClick={() => { profile.set((x) => ({ coins: x.coins + rewardForRank(lastRank), claimedWeeks: [...x.claimedWeeks, lastWeekKey].slice(-20) })); sfx.coins(); toast(`+${fmt(rewardForRank(lastRank))} coins`, 'coins'); }}>
                  Claim <Coin size={18} /> {fmt(rewardForRank(lastRank))}
                </Pill>
              ) : lastRank ? <span>{rewardForRank(lastRank) ? 'Reward claimed.' : 'Finish in the top 100 to earn a reward.'}</span> : null}
            </div>
          )}
        </div>
        <aside className="lb-side">
          <div className="rewards">
            <div className="rewards-title">Rank Rewards</div>
            {[['1st', 50000], ['2nd', 25000], ['3rd', 10000], ['4–10', 5000], ['11–50', 2500], ['51–100', 1000]].map(([k, v], i) => (
              <div key={k} className={`reward-row r${i}`}><span>{k}</span><span>{i < 3 && <Coin size={20} />}{fmt(v as number)}</span></div>
            ))}
          </div>
          {!last && <div className="ends">ENDS IN: <b>{ends}</b></div>}
          <Pill color="green" onClick={() => { sfx.click(); setLast(!last); }}>{last ? 'Current week results' : 'Last week results'}</Pill>
        </aside>
      </div>
    </Modal>
  );
}

// ---------------- Store (coins + Chat Pass) ----------------
export function StoreModal({ onClose, tab: initialTab = 'coins', need }: { onClose: () => void; tab?: 'coins' | 'chat'; need?: number }) {
  const p = useProfile();
  const [tab, setTab] = useState<'coins' | 'chat'>(CHAT_PASS_FOR_SALE ? initialTab : 'coins');
  const [busy, setBusy] = useState<string | null>(null);
  const shortBy = need && need > p.coins ? need - p.coins : 0;
  const pass = chatPassLabel(p);
  const purchase = async (id: string) => { setBusy(id); await buy(id); setBusy(null); };
  const items = PRODUCTS.filter((x) => x.kind === tab);
  const appOff = nativeStoreOff();
  return (
    <Modal title="Store" onClose={onClose} wide className="store-modal">
      {CHAT_PASS_FOR_SALE && (
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'coins'} className={`tab ${tab === 'coins' ? 'on' : ''}`} onClick={() => setTab('coins')}>Coins</button>
          <button role="tab" aria-selected={tab === 'chat'} className={`tab ${tab === 'chat' ? 'on' : ''}`} onClick={() => setTab('chat')}>Chat Pass</button>
        </div>
      )}
      {tab === 'coins' && shortBy > 0 && <p className="need-banner"><Coin size={22} /> You need <b>{fmt(shortBy)}</b> more coins for that table. Any pack below covers it{shortBy > 25_000 ? ' except the smallest' : ''}.</p>}
      {tab === 'chat' && <p className="need-banner chat"><Icon name="chat" size={22} /> {pass ? <>You have a <b>{pass}</b>. Buying more adds to it.</> : <>Quick phrases and emoji are free. A Chat Pass lets you type your own messages at the table.</>}</p>}
      {appOff && <p className="need-banner"><Icon name="star" size={22} /> Coin packs are coming soon to the app. Free coins: the daily gift, the Mega Bonus wheel and +100 coins every 30 minutes.</p>}
      <div className={`packs ${tab === 'chat' ? 'three' : ''}`}>
        {items.map((k) => {
          const bonus = k.kind === 'coins' && p.vip ? Math.round(k.coins! * 0.2) : 0;
          const covers = shortBy > 0 && k.kind === 'coins' && k.coins! + bonus >= shortBy;
          return (
            <div key={k.id} className={`pack ${covers ? 'covers' : ''}`}>
              {k.tag && <span className="pack-tag">{k.tag}</span>}
              <div className="pack-coins">{k.kind === 'coins' ? <Coin size={40} /> : <Icon name="chat" size={40} />}</div>
              <div className="pack-amt">{k.kind === 'coins' ? fmt(k.coins!) : k.chatDays === 0 ? 'Lifetime' : `${k.chatDays} day${k.chatDays === 1 ? '' : 's'}`}</div>
              {bonus > 0 && <div className="pack-bonus">+{fmt(bonus)} VIP bonus</div>}
              {k.kind === 'chat' && <div className="pack-bonus">{k.chatDays === 0 ? 'Chat forever' : 'Unlimited messages'}</div>}
              <Pill color="green" disabled={busy !== null || appOff} onClick={() => purchase(k.id)}>{appOff ? 'Soon' : busy === k.id ? 'Opening…' : priceLabel(k.priceCents)}</Pill>
            </div>
          );
        })}
      </div>
      <p className="muted small center store-foot">{appOff ? 'Purchases in the app are coming soon.' : isTestMode()
        ? 'Development build: purchases are free and instant here only.'
        : paymentsReady() ? 'Secure checkout by PayPal or card. Purchases are added to your account as soon as payment completes.'
        : 'Purchases are not available yet. Free coins: the daily gift, the Mega Bonus wheel and +100 coins every 30 minutes.'}</p>
    </Modal>
  );
}

// ---------------- VIP ----------------
export function VipModal({ onClose }: { onClose: () => void }) {
  const p = useProfile();
  const [busy, setBusy] = useState<string | null>(null);
  const perks = ['Gold avatar frame at every table', '+10% on every prize you win', '+20% more coins on every store pack', 'Double daily-spin rewards', ...(CHAT_PASS_FOR_SALE ? ['Chat included: type your own messages'] : [])];
  return (
    <Modal onClose={onClose} wide className="vip-modal">
      <div className="vm">
        <div className="vm-left">
          <div className="vm-badge" aria-hidden="true"><span className="vm-stars">★</span><b className="gold-text">VIP</b><small>★ CLUB ★</small></div>
          <h3 className="vm-h gold-text">BENEFITS</h3>
          <ul className="vm-perks">{perks.map((t) => <li key={t}><span className="vm-tick" aria-hidden="true">✔</span>{t}</li>)}</ul>
        </div>
        <div className="vm-right">
          {p.vip && <p className="vm-status gold-text">You're a VIP member{p.vipUntil > 0 ? ` until ${new Date(p.vipUntil).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}.{nativeStoreOff() ? '' : ' Buying more adds to it.'}</p>}
          {nativeStoreOff()
            ? (!p.vip && <Pill color="gold" className="wide-btn" disabled>VIP Club — coming soon to the app</Pill>)
            : PRODUCTS.filter((x) => x.kind === 'vip').map((k) => (
              <button key={k.id} className="vm-tier" disabled={busy !== null} aria-label={`VIP Club for ${k.vipDays} days, ${priceLabel(k.priceCents)}`}
                onClick={async () => { sfx.click(); setBusy(k.id); await buy(k.id); setBusy(null); }}>
                <span className="vm-t">{busy === k.id ? 'OPENING…' : `VIP CLUB FOR ${k.vipDays} DAYS`}</span>
                <span className="vm-p">{priceLabel(k.priceCents)}</span>
                {k.tag && <i className="vm-tag">{k.tag.toUpperCase()}</i>}
              </button>))}
          {!nativeStoreOff() && !paymentsReady() && !isTestMode() && <p className="muted small center">VIP purchases are not available yet.</p>}
        </div>
      </div>
    </Modal>
  );
}

// ---------------- Bonus coins (free top-up every 30 minutes) ----------------
export const BONUS_COINS = 100;
export const BONUS_EVERY_MS = 30 * 60 * 1000;
export function bonusLeftMs(last: number) { return Math.max(0, last + BONUS_EVERY_MS - Date.now()); }
export function AdModal({ onClose }: { onClose: () => void }) {
  const p = useProfile();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
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

// ---------------- Mega bonus wheel (every 4 hours) ----------------
export function SpinModal({ onClose }: { onClose: () => void }) {
  const p = useProfile();
  const ready = Date.now() - p.lastSpin > 4 * 3600e3;
  const next = useCountdown(p.lastSpin + 4 * 3600e3);
  return (
    <MegaWheel ready={ready} nextIn={next} mult={p.vip ? 2 : 1} onClose={onClose} tick={sfx.tick} jackpot={sfx.jackpot}
      onWin={(win) => { profile.set((x) => ({ coins: x.coins + win, lastSpin: Date.now() })); sfx.coins(); vibrate(40); }} />
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
type FrKind = 'request' | 'friend' | 'sent';
function FriendCard({ f, kind, onInvite }: { f: SocialPerson; kind: FrKind; onInvite: () => void }) {
  const [sure, setSure] = useState(false);
  useEffect(() => { if (!sure) return; const t = setTimeout(() => setSure(false), 3000); return () => clearTimeout(t); }, [sure]);
  return (
    <li className={`fr-card ${kind} ${f.online ? 'on' : ''}`}>
      <span className="fr-pic">
        <Avatar k={f.avatar} size={96} name={f.name} />
        {kind === 'request' && <button className="fr-x" onClick={() => { sfx.click(); social.reject(f.id); }} aria-label={`Decline ${f.name}'s request`}><Icon name="close" size={14} /></button>}
      </span>
      <b className={`fr-name ${f.online ? 'on' : ''}`} title={f.name}>{f.name}</b>
      <span className="fr-state">{f.online ? 'ONLINE' : 'OFFLINE'}</span>
      <span className="fr-coins"><Coin size={26} /><b>{short(f.coins)}</b></span>
      {kind === 'request' && <button className="fr-btn accept" onClick={() => { sfx.click(); social.accept(f.id); }}>ACCEPT</button>}
      {kind === 'friend' && (
        <>
          {f.online && <button className="fr-btn invite" onClick={() => { sfx.click(); onInvite(); }}>INVITE</button>}
          <button className="fr-btn remove" onClick={() => { sfx.click(); if (!sure) setSure(true); else social.remove(f.id); }}>{sure ? 'TAP AGAIN' : 'REMOVE'}</button>
        </>
      )}
      {kind === 'sent' && <button className="fr-btn cancel" onClick={() => { sfx.click(); social.cancel(f.id); }}>CANCEL</button>}
    </li>
  );
}

export function FriendsModal({ onClose, onInvite }: { onClose: () => void; onInvite: () => void }) {
  const s = useSocial();
  const [status, setStatus] = useState<NetStatus>(net.status);
  const [name, setName] = useState('');
  useEffect(() => net.onStatus(setStatus), []);
  const empty = !s.friends.length && !s.incoming.length && !s.outgoing.length;
  const section = (title: string, list: SocialPerson[], kind: FrKind) => list.length > 0 && (
    <section className="fr-sec">
      <h3>{title} <i>{list.length}</i></h3>
      <ul className="fr-grid">{list.map((f) => <FriendCard key={f.id} f={f} kind={kind} onInvite={onInvite} />)}</ul>
    </section>
  );
  return (
    <Modal title="FRIENDS" onClose={onClose} wide className="fr-modal">
      <form className="fr-add" onSubmit={(e) => { e.preventDefault(); const n = name.trim(); if (!n) return; social.addByName(n); setName(''); }}>
        <label className="sr-only" htmlFor="fr-name">Player name</label>
        <input id="fr-name" value={name} maxLength={20} autoComplete="off" onChange={(e) => setName(e.target.value)} placeholder="Send a friend request — type their player name" />
        <Pill type="submit" color="green"><Icon name="plus" size={16} /> Add</Pill>
      </form>
      {status !== 'online' && <p className="fr-note">Connecting to the game server… friends will appear in a moment.</p>}
      {status === 'online' && !s.loaded && <p className="fr-note">Loading your friends…</p>}
      {s.loaded && empty && <p className="fr-note">No friends yet. Type a player’s name above to send a request. They’ll see it here and can accept or decline. You can also tap a player at a table and add them from their profile.</p>}
      {section('FRIEND REQUESTS', s.incoming, 'request')}
      {section('MY FRIENDS', s.friends, 'friend')}
      {section('REQUESTS I SENT', s.outgoing, 'sent')}
    </Modal>
  );
}

// ---------------- Invite friends ----------------
export function InviteModal({ onClose }: { onClose: () => void }) {
  const r = useReferral();
  const failed = useReferralFailed();
  const [copied, setCopied] = useState(false);
  useEffect(() => { void loadReferral(); }, []);
  const link = r ? inviteLink(r.code) : window.location.origin;
  const text = r ? inviteText(r.code) : `Come play Spades with me on Spade Haven: ${link}`;
  const enc = encodeURIComponent;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2500); toast('Invite link copied'); }
    catch { window.prompt('Copy your invite link:', link); }
  };
  const nativeShare = () => { navigator.share?.({ title: 'Spade Haven', text, url: link }).catch(() => {}); };
  const left = r ? Math.max(0, r.max - r.count) : null;
  return (
    <Modal title="INVITE FRIENDS" onClose={onClose} className="inv-modal">
      <p className="inv-lead">Share your link. When a friend joins and plays their first game, <b>you both get coins</b>, and you get free chat too.</p>
      <div className="inv-rewards">
        <div><Coin size={34} /><b>{fmt(r?.inviterCoins ?? 15000)}</b><small>for you, plus <em>{r?.inviterChatDays ?? 7} days of free chat</em></small></div>
        <div><Coin size={34} /><b>{fmt(r?.friendCoins ?? 10000)}</b><small>for your friend</small></div>
      </div>
      <div className="inv-link"><input readOnly value={link} aria-label="Your invite link" onFocus={(e) => e.currentTarget.select()} /><Pill color="green" onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</Pill></div>
      <div className="inv-actions">
        {typeof navigator.share === 'function' && <button className="pill green" onClick={() => { sfx.click(); nativeShare(); }}><ShareIcon className="inv-ico" /> Share…</button>}
        <a className="pill green" href={`https://wa.me/?text=${enc(text)}`} target="_blank" rel="noopener noreferrer" onClick={() => sfx.click()}>WhatsApp</a>
        <a className="pill blue" href={`https://www.facebook.com/sharer/sharer.php?u=${enc(link)}&quote=${enc(text)}`} target="_blank" rel="noopener noreferrer" onClick={() => sfx.click()}>Facebook</a>
        <a className="pill purple" href={`sms:?&body=${enc(text)}`} onClick={() => sfx.click()}>Text message</a>
        <a className="pill gold" href={`mailto:?subject=${enc('Play Spades with me on Spade Haven')}&body=${enc(text)}`} onClick={() => sfx.click()}>Email</a>
      </div>
      {!r && failed && <p className="inv-stats">We couldn't load your personal invite link. <button className="linklike" onClick={() => { sfx.click(); void loadReferral(); }}>Try again</button></p>}
      {!(!r && failed) && <p className="inv-stats">{r ? <>Friends who joined: <b>{r.count}</b> of {r.max} · Coins earned: <b>{fmt(r.earned)}</b>{left === 0 && ' · You reached the invite limit, thank you!'}</> : 'Loading your invite link…'}</p>}
      <p className="inv-fine">A friend counts once they are a new player and finish a game. Coins are for play only and have no cash value. Free chat days are added to your Chat Pass.</p>
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

// ---------------- Table & card themes ----------------
export function ThemePicker() {
  const p = useProfile();
  const lvl = levelFromXp(p.xp);
  const current = activeTheme(p.theme, lvl);
  return (
    <div className="theme-grid" role="radiogroup" aria-label="Table and card theme">
      {THEMES.map((t) => {
        const open = lvl >= t.level;
        return (
          <button key={t.id} type="button" role="radio" aria-checked={current.id === t.id} disabled={!open}
            className={`theme-pick ${current.id === t.id ? 'on' : ''}`} style={themeVars(t)}
            onClick={() => { sfx.click(); profile.set({ theme: t.id }); }}
            aria-label={open ? `${t.name} theme` : `${t.name} theme, unlocks at level ${t.level}`}>
            <span className="tp-table"><span /></span>
            <span className="tp-cards" aria-hidden="true"><i style={{ color: t.suits.S }}>♠</i><i style={{ color: t.suits.H }}>♥</i><i style={{ color: t.suits.D }}>♦</i><i className="back" /></span>
            <small>{t.name}</small>
            <em>{open ? (t.fourColor ? 'Four-color deck' : 'Classic deck') : `Level ${t.level}`}</em>
            {!open && <span className="tp-lock"><Icon name="lock" size={14} /></span>}
          </button>
        );
      })}
    </div>
  );
}

export function ThemeModal({ onClose }: { onClose: () => void }) {
  const p = useProfile();
  return (
    <Modal title="Table & cards" onClose={onClose} wide>
      <p className="muted center small">You're level {levelFromXp(p.xp)}. New themes unlock as you level up: every game earns XP, and wins earn more.</p>
      <ThemePicker />
    </Modal>
  );
}

// ---------------- Edit name & picture ----------------
const NAME_MAX = 20;
const NAME_BAD = /[^\p{L}\p{N} _.-]/gu;
const WORDS_A = ['Apex', 'Royal', 'Lucky', 'Bold', 'Swift', 'Silent', 'Golden', 'Wild', 'Neon', 'Iron', 'Crimson', 'Mighty', 'Sly', 'Cosmic', 'Savage'];
const WORDS_B = ['Spade', 'Ace', 'Shark', 'Falcon', 'Wolf', 'King', 'Ninja', 'Dragon', 'Joker', 'Bandit', 'Tiger', 'Viper', 'Rebel', 'Hawk'];
const WORDS_C = ['Overlord', 'Master', 'Boss', 'Legend', 'Champ', 'Hunter', 'Baron', 'Wizard', 'Rider', 'Ghost'];
const randomName = () => {
  const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
  for (let i = 0; i < 20; i++) { const n = `${pick(WORDS_A)}${pick(WORDS_B)}${pick(WORDS_C)}`; if (n.length <= NAME_MAX) return n; }
  return `${pick(WORDS_A)}${pick(WORDS_B)}`;
};
type NameState = { kind: 'same' | 'checking' | 'ok' | 'bad' | 'offline'; msg?: string };

/** "Choose a gamer name and image": pick a name nobody else has, and a picture. Names are unique: it is yours until you change it. */
export function ProfileEditModal({ onClose }: { onClose: () => void }) {
  const p = useProfile();
  const [name, setName] = useState(p.name);
  const [avatar, setAvatar] = useState(p.avatar);
  const [st, setSt] = useState<NameState>({ kind: 'same' });
  const [saving, setSaving] = useState(false);
  const trimmed = name.trim().replace(/\s+/g, ' ');
  const nameChanged = trimmed !== p.name;
  const squash = (n: string) => n.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

  useEffect(() => {
    if (!nameChanged) { setSt({ kind: 'same' }); return; }
    if (squash(trimmed).length < 3) { setSt({ kind: 'bad', msg: 'Names need at least 3 letters or numbers.' }); return; }
    setSt({ kind: 'checking' });
    let stale = false;
    const t = setTimeout(async () => {
      const r = await checkName(trimmed);
      if (!stale) setSt(r.ok ? { kind: 'ok', msg: 'Available — it’s yours once you save.' } : { kind: r.offline ? 'offline' : 'bad', msg: r.message });
    }, 450);
    return () => { stale = true; clearTimeout(t); };
  }, [trimmed]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSave = !saving && (!nameChanged || st.kind === 'ok');
  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    if (nameChanged) {
      const r = await changeName(trimmed);
      if (!r.ok) { setSt({ kind: r.offline ? 'offline' : 'bad', msg: r.message }); setSaving(false); return; }
    }
    if (avatar !== p.avatar) profile.set({ avatar });
    net.hello(); // tables, friends and the leaderboard see the new name and picture
    sfx.coins(); toast(nameChanged ? `You’re now ${trimmed}` : 'Picture saved');
    onClose();
  };

  return (
    <Modal title="GAMER NAME & IMAGE" onClose={onClose} className="pe-modal">
      <form onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <label className="pe-label" htmlFor="pe-name">GAMER NAME</label>
        <div className={`pe-name ${st.kind}`}>
          <input id="pe-name" value={name} maxLength={NAME_MAX} autoComplete="off" spellCheck={false}
            onChange={(e) => setName(e.target.value.replace(NAME_BAD, ''))} placeholder="e.g. ApexSpadeOverlord" />
          <button type="button" className="pe-dice" aria-label="Suggest a name" title="Suggest a name" onClick={() => { sfx.click(); setName(randomName()); }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v5h-5" /></svg>
          </button>
        </div>
        <div className="pe-meta">
          <span className={`pe-status ${st.kind}`} role="status">
            {st.kind === 'checking' ? 'Checking…' : st.kind === 'ok' ? `✓ ${st.msg}` : st.msg ?? (nameChanged ? '' : 'This is your current name.')}
          </span>
          <span className="pe-count">{name.length}/{NAME_MAX}</span>
        </div>
        <p className="pe-hint">Every name is one of a kind. It’s yours until you change it, and then someone else can use it.</p>

        <label className="pe-label">IMAGE</label>
        <AvatarPicker value={avatar} onChange={setAvatar} />

        <div className="pe-actions">
          <button type="button" className="pe-btn cancel" onClick={() => { sfx.click(); onClose(); }}>Cancel</button>
          <button type="submit" className="pe-btn save" disabled={!canSave}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------- Settings ----------------


function BigSwitch({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <section className="tm-sec st-sec">
      <h3>{label}</h3>
      <label className="tm-switch">
        <input type="checkbox" checked={on} onChange={() => { onToggle(); sfx.click(); }} aria-label={label} />
        <span className="ct-switch" aria-hidden="true"><i>{on ? 'ON' : 'OFF'}</i></span>
      </label>
    </section>
  );
}

export function SettingsModal({ onClose, installPrompt }: { onClose: () => void; installPrompt: null | (() => void) }) {
  const p = useProfile();
  const [status, setStatus] = useState<NetStatus>(net.status);
  const [confirmOut, setConfirmOut] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cfg, setCfg] = useState<AuthConfig>({ google: null, facebook: null });
  const googleRef = useRef<HTMLDivElement>(null);
  useEffect(() => net.onStatus(setStatus), []);
  useEffect(() => { void loadAuthConfig().then(setCfg); }, []);
  const signedIn = !!p.provider && p.provider !== 'guest' && !!p.guestKey;
  useEffect(() => {
    if (!signedIn && cfg.google && googleRef.current) void mountGoogleButton(googleRef.current, cfg.google, (e) => { if (e) toast(e, 'error'); else { sfx.coins(); toast('Signed in with Google'); } }).catch(() => {});
  }, [cfg.google, signedIn]);
  const set = (k: 'sound' | 'music' | 'vibrate') => profile.set((x) => ({ settings: { ...x.settings, [k]: k === 'music' ? x.settings.music === false : !x.settings[k] } }));
  const fb = async () => {
    sfx.click();
    if (!cfg.facebook) { toast('Facebook sign-in is coming soon — use email for now'); return; }
    setBusy(true);
    try { await facebookSignIn(cfg.facebook); sfx.coins(); toast('Signed in with Facebook'); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  const logOut = () => { if (!confirmOut) { setConfirmOut(true); return; } profile.reset(); onClose(); };
  const via = p.provider === 'email' ? 'email' : p.provider === 'google' ? 'Google' : p.provider === 'facebook' ? 'Facebook' : '';
  return (
    <Modal title="Settings" onClose={onClose} className="settings-modal">
      <div className="st-me">
        <Avatar k={p.avatar} size={72} name={p.name} />
        <div className="st-me-text"><b>{p.name}</b><small>Your name and picture at the tables</small></div>
        <button className="st-edit" onClick={() => { sfx.click(); setEditOpen(true); }}>EDIT NAME &amp; PICTURE</button>
      </div>
      <div className="st-account">
        {signedIn ? (
          <>
            <div className="st-acc-text">
              <h3>CONNECTED</h3>
              <p>Signed in as <b>{p.name}</b> with {via}{p.email ? <> · {p.email}</> : null}. Your coins, level and stats are saved to your account.</p>
            </div>
            <button className="st-logout" onClick={logOut}>{confirmOut ? 'TAP TO LOG OUT' : 'LOG OUT'}</button>
          </>
        ) : (
          <>
            <div className="st-acc-text">
              <h3>LOGIN</h3>
              <p>Sign in or register and <b>save your progress!</b> Playing as <b>{p.name}</b>.</p>
              <button className="st-exit" onClick={() => { sfx.click(); profile.reset(); onClose(); }}>EXIT</button>
              <small className="st-exit-note">Back to the sign-in screen. {p.name} stays saved on this device.</small>
            </div>
            <div className="st-social">
              {showFacebook(cfg) && <button className="social fb" onClick={fb} disabled={busy}><span className="social-ico">f</span><span>Sign in with Facebook</span></button>}
              {cfg.google
                ? <div className="google-slot" ref={googleRef} />
                : <button className="social gp" onClick={() => { sfx.click(); toast('Google sign-in is coming soon — use email for now'); }}><span className="social-ico"><svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="6" fill="#fff" /><path d="M7 10v4M5 12h4" stroke="#1a7f37" strokeWidth="2" strokeLinecap="round" /><circle cx="16" cy="11" r="1.2" fill="#1a7f37" /><circle cx="18" cy="13" r="1.2" fill="#1a7f37" /></svg></span><span>Google Play Games</span></button>}
              <button className="social em" onClick={() => { sfx.click(); setEmailOpen(true); }}><span className="social-ico"><Icon name="chat" size={22} /></span><span>Email — sign in or register</span></button>
            </div>
          </>
        )}
      </div>

      <div className="st-switches">
        <BigSwitch label="SOUND" on={p.settings.sound} onToggle={() => set('sound')} />
        <BigSwitch label="MUSIC" on={p.settings.music !== false} onToggle={() => set('music')} />
        <BigSwitch label="VIBRATION" on={p.settings.vibrate} onToggle={() => set('vibrate')} />
      </div>
      <div className="st-music">
        <h3>BACKGROUND MUSIC <small>tap a track to hear it</small></h3>
        <MusicPicker />
      </div>

      <details className="st-more">
        <summary>Table & cards, guest code and more</summary>
        {p.provider === 'guest' && p.guestCode && (
          <div className="guest-code">
            <span>Your guest code</span>
            <button className="code" onClick={() => { navigator.clipboard?.writeText(p.guestCode!).then(() => toast('Guest code copied'), () => toast(`Guest code: ${p.guestCode}`)); }} aria-label={`Copy guest code ${p.guestCode}`}>{p.guestCode} <Icon name="copy" size={16} /></button>
            <small className="muted">Keep it private. Enter it on another phone or computer ("Have a guest code?") to continue as {p.name}.</small>
          </div>
        )}
        <div className="field"><span>Table & cards (unlock more by leveling up)</span><ThemePicker /></div>
        <div className="toggles">
          <label className="toggle"><input type="checkbox" checked={p.settings.fast} onChange={() => profile.set((x) => ({ settings: { ...x.settings, fast: !x.settings.fast } }))} /><span className="tg" /> Fast computer players</label>
        </div>
        {installPrompt ? <Pill color="blue" onClick={installPrompt}><Icon name="download" size={16} /> Install app</Pill> : <a className="linkish" href="/install">How to install the app on your phone</a>}
        <p className="muted small">Multiplayer server: <b className={status === 'online' ? 'online' : ''}>{status}</b></p>
      </details>

      <footer className="st-foot">
        <span>PLAYER: {p.name.toUpperCase()}</span>
        <span><a href="#privacy">PRIVACY POLICY</a> AND <a href="#terms">TERMS OF SERVICE</a></span>
      </footer>
      {emailOpen && <EmailModal onClose={() => setEmailOpen(false)} startMode="up" />}
      {editOpen && <ProfileEditModal onClose={() => setEditOpen(false)} />}
    </Modal>
  );
}

// ---------------- Room type (Solo / Partners) ----------------
export function RoomTypeModal({ onPick, onClose, online, title }: { onPick: (m: Mode) => void; onClose: () => void; online: OnlineCounts | null; title?: string }) {
  const [rules, setRules] = useState<Mode | null>(null);
  const count = (m: Mode) => { if (!online) return 'PLAY VS COMPUTER'; const n = online[m] + (online.lobby ?? 0); return `${n} PLAYER${n === 1 ? '' : 'S'}`; };
  const card = (m: Mode, name: string, sub: string, art: JSX.Element) => (
    <div className={`mode-card2 ${m}`}>
      <button className="mode-help" onClick={() => { sfx.click(); setRules(m); }} aria-label={`${name} rules`}>?</button>
      <button className="mode-pick" onClick={() => { sfx.click(); onPick(m); }}>
        <span className="mode-title2">{name}</span>
        <span className="mode-sub2">{sub}</span>
        <span className="mode-art2">{art}<span className="mode-count2"><Icon name="users" size={18} /> {count(m)}</span></span>
      </button>
    </div>
  );
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="roomtype2" role="dialog" aria-modal="true" aria-label="Choose room type">
        {title && <div className="roomtype2-title">{title}</div>}
        <div className="roomtype2-cards">
          {card('solo', 'SOLO', 'Every player for themselves', <SoloArt />)}
          {card('partners', 'PARTNERS', 'Classic team spades, 2 vs 2', <PartnersArt />)}
        </div>
        <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
      </div>
      {rules && <ModeRulesModal mode={rules} onClose={() => setRules(null)} />}
    </div>
  );
}

// ---------------- Rules for each room type ----------------
export function ModeRulesModal({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const solo = mode === 'solo';
  const sec = (h: string, body: JSX.Element) => <section><h3><i />{h}<i /></h3>{body}</section>;
  return (
    <Modal onClose={onClose} wide className="mode-rules">
      <h2 className="mode-rules-title">{solo ? 'SOLO' : 'PARTNERS'} RULES</h2>
      {sec('The basics', <p>{solo
        ? 'Four players, and nobody is on your side: every point you score is yours alone. '
        : 'Four players in two teams. Your partner sits across the table from you, and the two of you win or lose together. '}
        A normal 52-card deck is dealt out, 13 cards each. Spades always beat the other suits. Cards rank Ace (highest), King, Queen, Jack, 10 down to 2.</p>)}
      {sec('Bidding', <p>The player on the dealer's left bids first, then the bid goes around the table. Bid how many tricks you think you'll win, from 1 to 13.
        {solo ? ' Your bid is your own target, so count only on your own cards.' : ' Your bid and your partner\'s bid are added together into one team target.'}{' '}
        Bid <b>Nil</b> (0) if you're sure you won't win a single trick. Feeling brave? Bid <b>Blind Nil</b> before you even look at your cards.</p>)}
      {sec('Playing the cards', <p>The player on the dealer's left leads the first card. Everyone else must play the same suit if they have it. If you don't, you can play any card, including a spade to steal the trick.
        The highest spade wins the trick; if no spade was played, the highest card of the suit that was led wins. You can't lead spades until someone has played one on another suit
        (“breaking spades”), unless spades are all you have left. Whoever wins a trick leads the next one.</p>)}
      {sec('Scoring', <p>{solo
        ? 'Win at least as many tricks as you bid and you score 10 points for every trick you bid, plus 1 point for each extra trick. Fall short and you lose 10 points for every trick you bid. '
        : 'Your team adds up its tricks. Make your team bid and you score 10 points per trick bid, plus 1 point for each extra trick. Fall short and the team loses 10 points per trick bid. If a nil bidder gets caught, the tricks they took still count toward their partner\'s bid. '}
        A successful Nil is worth <b>+100</b> and a failed one <b>−100</b>. Blind Nil doubles that to <b>±200</b>.</p>)}
      {sec('Bags', <p>Every extra trick over your bid is a “bag”. {solo ? 'Your bags' : 'Your team\'s bags'} keep adding up from hand to hand, and every time they reach 10 you lose <b>100 points</b>, so don't win more than you need!</p>)}
      {sec('Winning', <p>The game ends when a {solo ? 'player' : 'team'} reaches the table's top score or drops to its lowest score. The highest score wins
        {solo ? <>, and the winner takes <b>3.6×</b> the bet.</> : <>, and <b>both partners</b> on the winning team take <b>1.8×</b> the bet.</>} If two {solo ? 'players' : 'teams'} are tied at the top, you play another hand.</p>)}
      <Pill color="green" className="wide-btn" onClick={onClose}>GOT IT</Pill>
    </Modal>
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
      {p.coins < bet ? <Pill color="gold" className="play-now-btn" onClick={() => store.open({ tab: 'coins', need: bet })}>BUY COINS</Pill> :
      <Pill color="green" className="play-now-btn" onClick={() => {
        const s = { bet, minPoints: MIN_STEPS[mi], maxPoints: MAX_STEPS[xi] };
        profile.set({ lastTable: s });
        onCreate(s);
      }}>PLAY NOW</Pill>}
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
