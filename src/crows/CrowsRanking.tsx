// Crows Haven leaderboard — the same as Spade Haven's (owner decision 2026-11-19): weekly ranking of coins won, last week's
// results with rank rewards to claim, and Crows' Fame (weekly champions + all-time winners). Kept on the Crows Haven game
// server (crows-server → Board). Uses Spade Haven's leaderboard look (lb-* classes in styles.css).
import { useEffect, useMemo, useState } from 'react';
import { Coin, Icon, Modal, Pill } from '../components/ui';
import { fmt, profile, rewardForRank, useProfile } from '../lib/profile';
import { sfx } from '../lib/sound';
import { toast } from '../lib/toast';
import { CrowsAvatar, MY_PHOTO } from './CrowsExtras';
import { crowsServer } from './online';

const SECRET_KEY = 'crowsRankSecret';

/** A random secret that proves which device owns a player (their name and their leaderboard entry). */
export function deviceSecret() {
  try {
    let s = localStorage.getItem(SECRET_KEY);
    if (!s) { s = Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem(SECRET_KEY, s); }
    return s;
  } catch { return null; }
}

/** Send one finished game played for coins to the weekly leaderboard. Returns this week's rank, or null. */
export async function reportGame(gameId: string, won: boolean, bet: number): Promise<{ rank?: number } | null> {
  const base = crowsServer();
  const secret = deviceSecret();
  if (!base || !secret || !bet) return null;
  const p = profile.get();
  try {
    const r = await fetch(`${base}/result`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pid: p.id, secret, gameId, won, bet, avatar: p.avatar === MY_PHOTO ? '' : p.avatar }),
    });
    const j = await r.json().catch(() => null);
    return j?.counted && j.rank ? { rank: j.rank } : null;
  } catch { return null; }
}

interface Row { name: string; avatar: string; earnings: number; me?: boolean }
interface Board {
  week: string; endsAt: number; rows: Row[]; me: { rank: number | null; earnings: number };
  lastWeek: { week: string; rank: number | null; rows: Row[] } | null;
  fame: { week: string; name: string; avatar: string; earnings: number }[];
  allTime: Row[]; meAllTime: { rank: number | null; earnings: number };
}
async function fetchBoard(): Promise<Board | null> {
  const base = crowsServer();
  if (!base) return null;
  try { const r = await fetch(`${base}/board?pid=${encodeURIComponent(profile.get().id)}`); return r.ok ? await r.json() : null; } catch { return null; }
}

function useCountdown(to: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((to - now) / 1000));
  const d = Math.floor(s / 86400), pad = (n: number) => String(n).padStart(2, '0');
  return `${d ? `${d}d ` : ''}${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
/** When the week ends if the server can't be reached (Sunday 00:00 UTC). */
const nextSundayUtc = () => { const d = new Date(); const s = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - d.getUTCDay()); return s + 7 * 864e5; };

const Medal = ({ i }: { i: number }) => <img className={`medal-img m${i + 1}`} src={`/ui/medal${i + 1}.webp`} alt={['1st', '2nd', '3rd'][i]} />;
function RowList({ rows }: { rows: Row[] }) {
  return (
    <ol className="lb-list">
      {rows.slice(0, 100).map((r, i) => (
        <li key={r.name + i} className={`lb-row ${r.me ? 'me' : ''} ${i < 3 ? `top t${i + 1}` : ''}`}>
          <span className="lb-rank">{i < 3 ? <Medal i={i} /> : i + 1}</span>
          <CrowsAvatar k={r.avatar} size={44} name={r.name} />
          <span className="lb-name">{r.name}{r.me ? ' (you)' : ''}</span>
          <span className="lb-earn"><Coin size={24} />{fmt(r.earnings)}</span>
        </li>
      ))}
    </ol>
  );
}

export function CrowsLeaderboard({ onClose }: { onClose: () => void }) {
  const p = useProfile();
  const [tab, setTab] = useState<'global' | 'fame'>('global');
  const [last, setLast] = useState(false);   // false = this week, true = last week's final results
  const [data, setData] = useState<Board | null | 'loading'>('loading');
  useEffect(() => { let live = true; fetchBoard().then((b) => live && setData(b)); return () => { live = false; }; }, []);
  const b = data === 'loading' ? null : data;
  const ends = useCountdown(b?.endsAt ?? nextSundayUtc());
  const rows = useMemo(() => (b ? (last ? b.lastWeek?.rows ?? [] : b.rows) : []), [b, last]);
  const lastRank = b?.lastWeek?.rank ?? null;
  const lastWeekKey = b?.lastWeek?.week ?? '';
  const claimed = !!lastWeekKey && p.claimedWeeks.includes(lastWeekKey);
  const empty = (text: string) => <div className="lb-empty"><Icon name="trophy" size={44} /><p>{text}</p></div>;
  const claim = () => {
    const reward = rewardForRank(lastRank);
    if (!reward || claimed) return;
    profile.set((x) => ({ coins: x.coins + reward, claimedWeeks: [...x.claimedWeeks, lastWeekKey].slice(-20) }));
    sfx.coins(); toast(`+${fmt(reward)} coins`, 'coins');
  };

  return (
    <Modal onClose={onClose} wide className="lb-modal crows-lb">
      <h2 className="lb-title"><img src="/ui/trophy.webp" alt="" aria-hidden="true" />LEADERBOARD — {last ? 'LAST WEEK' : 'CURRENT WEEK'}<img src="/ui/trophy.webp" alt="" aria-hidden="true" /></h2>
      <div className="lb-wrap">
        <div className="lb-main">
          <div className="tabs" role="tablist">
            {(['global', 'fame'] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => { sfx.click(); setTab(t); }}>
                {t === 'global' ? 'Weekly Rankings' : 'Crows’ Fame'}
              </button>
            ))}
          </div>
          {data === 'loading' ? empty('Loading results…') : !b ? empty('The leaderboard shows when the game server can be reached. Check your connection and try again.')
            : tab === 'global' ? (
              rows.length === 0 ? empty(last ? 'No results from last week. Win games this week to climb the board.' : 'No one has played for coins this week yet. Win a game to take the #1 spot.') : (
                <>
                  <div className="lb-head"><span>Rank</span><span>Player</span><span>Earnings</span></div>
                  <RowList rows={rows} />
                </>
              )
            ) : (
              b.fame.length === 0 && b.allTime.length === 0 ? empty('The best players of all time appear here. Win games to get into Crows’ Fame.') : (
                <div className="lb-fame">
                  {b.allTime.length > 0 && <><div className="lb-head"><span>Rank</span><span>Player</span><span>Total won</span></div><RowList rows={b.allTime} /></>}
                  {b.fame.length > 0 && <div className="lb-head lb-head2"><span>Weekly champions</span></div>}
                  <ol className="lb-list">
                    {b.fame.map((f) => (
                      <li key={f.week} className="lb-row">
                        <span className="lb-rank"><Medal i={0} /></span>
                        <span className="lb-week">Week of {new Date(f.week + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>
                        <CrowsAvatar k={f.avatar} size={44} name={f.name} />
                        <span className="lb-name">{f.name}</span>
                        <span className="lb-earn"><Coin size={24} />{fmt(f.earnings)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )
            )}
          {tab === 'fame' && b && <div className="lb-me">Your all-time rank: <b>{b.meAllTime.rank ? `#${b.meAllTime.rank}` : 'not ranked yet'}</b> · {fmt(b.meAllTime.earnings)} won in total</div>}
          {tab === 'global' && b && !last && <div className="lb-me">Your rank: <b>{b.me.rank ? `#${b.me.rank}` : 'not ranked yet'}</b> · {fmt(b.me.earnings)} won this week</div>}
          {tab === 'global' && b && last && (
            <div className="lb-me">
              {lastRank ? <>You finished <b>#{lastRank}</b>. </> : 'You were not ranked last week. '}
              {lastRank && rewardForRank(lastRank) > 0 && !claimed
                ? <Pill color="gold" onClick={claim}>Claim <Coin size={18} /> {fmt(rewardForRank(lastRank))}</Pill>
                : lastRank ? <span>{rewardForRank(lastRank) ? 'Reward claimed.' : 'Finish in the top 100 to earn a reward.'}</span> : null}
            </div>
          )}
        </div>
        <aside className="lb-side">
          {tab === 'fame' ? (
            <div className="fame-card">
              <div className="fame-title">Crows’<br />Fame</div>
              <img className="fame-cup-img" src="/ui/trophy.webp" alt="" aria-hidden="true" />
              <div className="fame-stars" aria-hidden="true">★ ★ ★</div>
              <p className="fame-sub">The biggest winners the nest has ever seen. Win big to join them.</p>
            </div>
          ) : (
            <div className="rewards">
              <div className="rewards-title">Rank Rewards</div>
              {[['1st', 50000], ['2nd', 25000], ['3rd', 10000], ['4–10', 5000], ['11–50', 2500], ['51–100', 1000]].map(([k, v], i) => (
                <div key={k} className={`reward-row r${i}`}><span>{k}</span><span>{i < 3 && <Coin size={20} />}{fmt(v as number)}</span></div>
              ))}
            </div>
          )}
          {!last && <div className="ends">ENDS IN: <b>{ends}</b></div>}
          <Pill color="green" onClick={() => { sfx.click(); setLast(!last); if (tab === 'fame') setTab('global'); }}>{last ? 'Current week results' : 'Last week results'}</Pill>
        </aside>
      </div>
    </Modal>
  );
}
