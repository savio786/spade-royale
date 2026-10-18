import { TableShape } from '../components/TableShape';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, CardView, Coin, Icon, Modal, Pill } from '../components/ui';
import { Card, legalCards, prizeFor, sameCard, sideCount, sideOf, seatsOfSide, PublicState } from '../../shared/engine';
import { botBid } from '../../shared/bot';
import type { CtlView, TableController } from '../lib/controller';
import { fmt, levelFromXp, profile, short, useProfile } from '../lib/profile';
import { sfx, vibrate } from '../lib/sound';
import { toast } from '../lib/toast';
import { reportWin } from '../lib/api';
import { helpBot } from '../lib/helpbot';
import { ThemeModal, VipModal } from './modals';
import { activeTheme, newlyUnlocked, themeVars } from '../lib/themes';
import { canChat, chatPassLabel, store } from '../lib/payments';

const POS = ['bottom', 'left', 'top', 'right'] as const;
import { FREE_EMOJI, QUICK_PHRASES } from '../../shared/chat';
const GIFTS = [{ e: '🌹', cost: 100 }, { e: '☕', cost: 100 }, { e: '🍹', cost: 250 }, { e: '🍕', cost: 250 }, { e: '🏆', cost: 1000 }, { e: '💎', cost: 5000 }];

export function Table({ ctl, onExit, onPlayAgain }: { ctl: TableController; onExit: () => void; onPlayAgain: () => void }) {
  const p = useProfile();
  const [view, setView] = useState<CtlView | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [themesOpen, setThemesOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [vip, setVip] = useState(false);
  const [giftFor, setGiftFor] = useState<number | null>(null);
  const [flying, setFlying] = useState<{ id: number; e: string; to: string }[]>([]);
  const [unread, setUnread] = useState(0);
  const [now, setNow] = useState(Date.now());
  const charged = useRef(false);
  const settled = useRef(false);
  const lastChatId = useRef(0);
  const lastTurn = useRef<string>('');

  useEffect(() => ctl.subscribe(setView), [ctl]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);

  const st = view?.snap?.state ?? null;
  const me = st?.mySeat ?? 0;
  const rel = (seat: number) => POS[(seat - me + 4) % 4];

  // --- side effects on state changes: coins, sounds, chat counter ---
  useEffect(() => {
    if (!st || !view) return;
    if (!charged.current && st.phase !== 'waiting') {
      charged.current = true;
      profile.set((x) => ({ coins: Math.max(0, x.coins - st.settings.bet) }));
      sfx.deal();
    }
    const turnKey = `${st.phase}-${st.turn}-${st.round}-${st.trick.length}`;
    if (turnKey !== lastTurn.current) {
      lastTurn.current = turnKey;
      if ((st.phase === 'bidding' || st.phase === 'playing') && st.turn === me) { sfx.turn(); vibrate(25); }
      if (st.phase === 'playing' || st.phase === 'trickEnd') if (st.trick.length) sfx.card();
    }
    if (st.phase === 'gameOver' && !settled.current && charged.current) {
      settled.current = true;
      const mySide = sideOf(st.settings.mode, me);
      const won = st.winners.includes(mySide);
      const prize = won ? Math.round(prizeFor(st.settings) * (profile.get().vip ? 1.1 : 1)) : 0;
      const nils = st.history.filter((h) => h.nilResults[me] === true).length;
      const pens = st.history.filter((h) => h.bagPenalty[mySide]).length;
      profile.set((x) => ({
        coins: x.coins + prize,
        xp: x.xp + 40 + (won ? 80 : 0),
        weekEarnings: x.weekEarnings + prize,
        stats: {
          ...x.stats, played: x.stats.played + 1, won: x.stats.won + (won ? 1 : 0),
          soloWins: x.stats.soloWins + (won && st.settings.mode === 'solo' ? 1 : 0),
          partnersWins: x.stats.partnersWins + (won && st.settings.mode === 'partners' ? 1 : 0),
          nilsMade: x.stats.nilsMade + nils, biggestWin: Math.max(x.stats.biggestWin, prize), bagsPenalties: x.stats.bagsPenalties + pens,
        },
      }));
      won ? (sfx.win(), sfx.coins()) : sfx.lose();
      { const before = levelFromXp(profile.get().xp - (40 + (won ? 80 : 0))), after = levelFromXp(profile.get().xp);
        for (const t of newlyUnlocked(before, after)) setTimeout(() => toast(`Level ${after}! New table & cards unlocked: ${t.name} (Menu → Table & cards)`), 1800); }
      // games vs computer are reported to the server leaderboard; online games are credited by the server itself
      if (won && !view.online) { const me2 = profile.get(); reportWin({ id: me2.id, name: me2.name, avatar: me2.avatar, mode: st.settings.mode, bet: st.settings.bet, prize }); }
    }
    const msgs = view.snap?.chat ?? [];
    const newest = msgs[msgs.length - 1];
    if (newest && newest.id !== lastChatId.current) {
      const fresh = msgs.filter((m) => m.id > lastChatId.current && !m.system && m.seat !== me);
      lastChatId.current = newest.id;
      if (fresh.length && !profile.get().settings.chatOff) { sfx.chat(); if (!chatOpen) setUnread((u) => u + fresh.length); }
      // gifts arrive via chat as "🎁:<seat>:<emoji>"
      for (const m of msgs.filter((m) => m.text.startsWith('🎁:') && Date.now() - m.ts < 3000)) {
        const [, to, e] = m.text.split(':');
        setFlying((f) => f.some((x) => x.id === m.id) ? f : [...f, { id: m.id, e, to: rel(+to) }]);
        setTimeout(() => setFlying((f) => f.filter((x) => x.id !== m.id)), 1800);
      }
    }
    if (view.error) toast(view.error, 'error');
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (chatOpen) setUnread(0); }, [chatOpen]);

  const leave = () => {
    ctl.leave();
    onExit();
  };

  if (!view || !st) {
    return <div className="screen table-screen felt-bg"><div className="connecting">Connecting to table…</div>
      <Pill color="ghost" onClick={leave}>Back</Pill></div>;
  }

  const mode = st.settings.mode;
  const deadline = view.snap!.turnDeadline;
  const secsLeft = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  const missedMine = view.snap!.missed?.[me] ?? 0;
  const maxMissed = view.snap!.maxMissed ?? 3;
  const myTurn = st.turn === me && (st.phase === 'bidding' || st.phase === 'playing');
  const legal = legalCards({ ...st, hands: Object.assign([[], [], [], []], { [me]: st.hand }) } as never, me);
  const lastBySeat = new Map<number, { text: string; ts: number }>();
  for (const m of view.snap!.chat) if (!m.system && !m.text.startsWith('🎁:') && (!p.settings.chatOff || m.seat === me)) lastBySeat.set(m.seat, m);

  return (
    <div className="screen table-screen felt-bg" style={themeVars(activeTheme(p.theme, levelFromXp(p.xp)))}>
      <div className="tbl-top-left">
        <button className="buy-coins small" onClick={() => store.open({ tab: 'coins' })}>BUY COINS</button>
        <button className="vip-mini" onClick={() => setVip(true)}><span className="gold-text">VIP</span><small>CLUB</small></button>
      </div>
      <div className="tbl-top-right">
        <button className="round-ui" onClick={() => { sfx.click(); setChatOpen(true); }} aria-label="Open chat"><Icon name="chat" size={26} />{unread > 0 && <span className="badge">{unread}</span>}</button>
        <button className="round-ui" onClick={() => { sfx.click(); setMenuOpen(true); }} aria-label="Menu"><Icon name="menu" size={26} /></button>
      </div>

      <div className="felt-wrap">
        <TableShape />
        <div className="felt">
          <InfoPanel st={st} />
          <ScorePanel st={st} />
          <div className="felt-center">
            {st.phase === 'waiting' && (
              <div className="waiting">
                <div className="waiting-text">WAITING FOR PLAYERS<span className="dots3"><i>.</i><i>.</i><i>.</i></span></div>
                {(view.snap!.fillAt || (view.online && view.host && view.settings.isPrivate)) && (
                  <div className="waiting-actions">
                    {view.snap!.fillAt
                      ? <span className="fill-wait" role="timer">Computer players join in <b>{fmtClock(Math.max(0, view.snap!.fillAt - now))}</b></span>
                      : <span className="fill-wait">Waiting for friends to join</span>}
                    {view.online && <button className="fill-now" onClick={() => ctl.fillBots()}>{view.settings.isPrivate ? 'Fill with bots' : 'Start now'}</button>}
                  </div>
                )}
                {view.code && (
                  <div className="invite">
                    <span>Invite code</span>
                    <button className="code" onClick={() => { navigator.clipboard?.writeText(view.code!).then(() => toast('Invite code copied'), () => toast(`Invite code: ${view.code}`)); }} aria-label={`Copy invite code ${view.code}`}>{view.code} <Icon name="copy" size={18} /></button>
                  </div>
                )}

              </div>
            )}
            <div className={`trick ${st.phase === 'trickEnd' ? `collect to-${rel(st.lastTrickWinner ?? 0)}` : ''}`}>
              {st.trick.map((t) => <CardView key={`${t.card.s}${t.card.r}`} card={t.card} className={`tcard at-${rel(t.seat)}`} />)}
            </div>
            {st.phase === 'bidding' && st.turn !== me && <div className="status-line">{st.seats[st.turn]?.name} is bidding…</div>}
            {st.phase === 'playing' && st.trick.length === 0 && st.turn === me && <div className="status-line you">Your lead{!st.spadesBroken ? ' — spades not broken yet' : ''}</div>}
          </div>
        </div>

        {[0, 1, 2, 3].map((seat) => (
          <SeatView key={seat} st={st} seat={seat} pos={rel(seat)} me={me} deadline={view.snap!.turnDeadline} total={view.snap!.turnTotal} now={now}
            bubble={(() => { const b = lastBySeat.get(seat); return b && now - b.ts < 4500 ? b.text : null; })()}
            onGift={() => setGiftFor(seat)} myVip={p.vip} />
        ))}
        {flying.map((f) => <span key={f.id} className={`flying to-${f.to}`} aria-hidden="true">{f.e}</span>)}
      </div>

      {/* Hand */}
      <div className="hand" style={{ ['--n' as string]: Math.max(1, st.hand.length) }}>
        {st.hand.map((c, i) => {
          const ok = myTurn && st.phase === 'playing' && legal.some((l) => sameCard(l, c));
          return <CardView key={`${st.round}-${c.s}${c.r}`} card={c} style={{ ['--i' as string]: i }} className={`hcard deal ${ok ? 'legal' : ''} ${myTurn && st.phase === 'playing' && !ok ? 'dim' : ''}`}
            onClick={() => { if (ok) { vibrate(10); ctl.act({ type: 'play', seat: me, card: c }); } }} disabled={!ok} />;
        })}
      </div>

      {myTurn && secsLeft !== null && st.phase === 'playing' && <div className={`turn-clock ${secsLeft <= 4 ? 'hurry' : ''}`} role="timer">Your turn · {secsLeft}s</div>}
      {missedMine > 0 && st.phase !== 'gameOver' && !view.kicked && (
        <div className="missed-warning" role="alert"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></svg> Time ran out and the game played for you ({missedMine}/{maxMissed}). Miss {maxMissed} turns this game and you'll be disconnected.</div>
      )}
      {st.phase === 'bidding' && st.turn === me && <BidPanel st={st} secsLeft={secsLeft} onBid={(b) => { sfx.click(); ctl.act({ type: 'bid', seat: me, bid: b }); }} />}
      {view.kicked && (
        <div className="modal-backdrop">
          <div className="modal kicked" role="alertdialog" aria-label="Disconnected for inactivity">
            <h2 className="modal-title">Disconnected</h2>
            <p className="center">{view.kicked}</p>
            <p className="center muted small">A computer player took your seat, and your bet for this table was lost. Bid and play within {Math.round((view.snap?.turnTotal ?? 12000) / 1000)} seconds to stay in the game.</p>
            <div className="btn-row"><Pill color="blue" onClick={leave}>Back to lobby</Pill></div>
          </div>
        </div>
      )}
      {st.phase === 'roundEnd' && <RoundSummary st={st} canContinue={!view.online} onContinue={() => ctl.act({ type: 'nextRound' })} />}
      {st.phase === 'gameOver' && <GameOver st={st} onLobby={leave} onAgain={() => { ctl.leave(); onPlayAgain(); }} />}

      {chatOpen && (
        <ChatPanel view={view} me={me} onClose={() => setChatOpen(false)} onSend={(t) => ctl.chat(t)} />
      )}
      {menuOpen && (
        <Modal title="Menu" onClose={() => { setMenuOpen(false); setConfirmLeave(false); }}>
          <div className="menu-list">
            <Pill color="blue" onClick={() => { setRulesOpen(true); setMenuOpen(false); }}><Icon name="book" size={18} /> How to play</Pill>
            <Pill color="purple" onClick={() => { setMenuOpen(false); helpBot.open(); }}><Icon name="chat" size={18} /> Ask Spade Bot</Pill>
            <Pill color="gold" onClick={() => { setMenuOpen(false); setThemesOpen(true); }}><Icon name="star" size={18} /> Table & cards</Pill>
            <Pill color="blue" onClick={() => profile.set((x) => ({ settings: { ...x.settings, sound: !x.settings.sound } }))}>
              <Icon name={p.settings.sound ? 'sound' : 'mute'} size={18} /> Sound: {p.settings.sound ? 'On' : 'Off'}</Pill>
            <Pill color="red" onClick={() => { if (st.phase === 'waiting' || st.phase === 'gameOver' || confirmLeave) leave(); else setConfirmLeave(true); }}>
              <Icon name="exit" size={18} /> {confirmLeave ? `Leave and forfeit ${fmt(st.settings.bet)} coins?` : 'Leave table'}</Pill>
          </div>
        </Modal>
      )}
      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
      {themesOpen && <ThemeModal onClose={() => setThemesOpen(false)} />}
      {vip && <VipModal onClose={() => setVip(false)} />}
      {giftFor !== null && (
        <Modal title={`Send a gift to ${st.seats[giftFor]?.name ?? 'the table'}`} onClose={() => setGiftFor(null)}>
          <div className="gift-grid">
            {GIFTS.map((g) => (
              <button key={g.e} className="gift-btn" disabled={p.coins < g.cost} onClick={() => {
                profile.addCoins(-g.cost); sfx.coins();
                ctl.chat(`🎁:${giftFor}:${g.e}`);
                setGiftFor(null);
              }}><span>{g.e}</span><small><Coin size={14} /> {short(g.cost)}</small></button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------- pieces ----------------
function InfoPanel({ st }: { st: PublicState }) {
  return (
    <div className="info-panel">
      <div className="ip-city">{st.settings.city}</div>
      <div className="ip-row"><span>PRIZE:</span><Coin size={22} /><b>{short(prizeFor(st.settings))}</b></div>
      <div className="ip-row"><span>BET:</span><b>{short(st.settings.bet)}</b></div>
      <div className="ip-end">ENDING POINTS:<b>{st.settings.minPoints}/{st.settings.maxPoints}</b></div>
    </div>
  );
}

function ScorePanel({ st }: { st: PublicState }) {
  const mode = st.settings.mode;
  const me = st.mySeat;
  if (mode === 'partners') {
    const mySide = sideOf(mode, me), opp = 1 - mySide;
    const bidOf = (side: number) => seatsOfSide(mode, side).reduce((s, i) => s + (st.bids[i] ?? 0), 0);
    const trOf = (side: number) => seatsOfSide(mode, side).reduce((s, i) => s + st.tricks[i], 0);
    const sides = [opp, mySide];
    return (
      <div className="score-panel">
        <div className="sp-title">PARTNERS ♠♠</div>
        <div className="sp-grid">
          <span className="team red">THEM</span><span className="team blue">US</span>
          {sides.map((s) => <b key={`p${s}`}>{st.scores[s]}</b>)}
          <span className="sp-lbl">PTS.</span>
          {sides.map((s) => <b key={`b${s}`}>{st.bags[s]}</b>)}
          <span className="sp-lbl">BAGS</span>
          {st.phase !== 'waiting' && sides.map((s) => <b key={`t${s}`} className="sp-bid">{trOf(s)}/{bidOf(s)}</b>)}
          {st.phase !== 'waiting' && <span className="sp-lbl">BOOKS/BID</span>}
        </div>
        <div className={`sp-spade ${st.spadesBroken ? 'broken' : ''}`} title={st.spadesBroken ? 'Spades broken' : 'Spades not broken'}>♠{'︎'}</div>
      </div>
    );
  }
  return (
    <div className="score-panel solo">
      <div className="sp-title">SOLO ♠</div>
      <table className="sp-table">
        <thead><tr><th>Player</th><th>Pts</th><th>Bags</th><th>Bk/Bid</th></tr></thead>
        <tbody>
          {[0, 1, 2, 3].map((s) => (
            <tr key={s} className={s === me ? 'me' : ''}>
              <td>{st.seats[s]?.name.slice(0, 9) ?? '—'}</td><td>{st.scores[s]}</td><td>{st.bags[s]}</td>
              <td>{st.phase === 'waiting' ? '-' : `${st.tricks[s]}/${st.bids[s] ?? '-'}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={`sp-spade ${st.spadesBroken ? 'broken' : ''}`}>♠{'︎'}</div>
    </div>
  );
}

const fmtClock = (ms: number) => { const t = Math.ceil(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

function SeatView({ st, seat, pos, me, deadline, total, now, bubble, onGift, myVip }: {
  st: PublicState; seat: number; pos: string; me: number; deadline: number | null; total: number | null; now: number; bubble: string | null; onGift: () => void; myVip: boolean;
}) {
  const s = st.seats[seat];
  const mode = st.settings.mode;
  const team = mode === 'partners' ? (sideOf(mode, seat) === sideOf(mode, me) ? 'blue' : 'red') : ['blue', 'red', 'green', 'gold'][seat];
  const active = st.turn === seat && (st.phase === 'bidding' || st.phase === 'playing');
  const remain = active && deadline && total ? Math.max(0, deadline - now) / total : null;
  return (
    <div className={`seat seat-${pos} team-${team} ${active ? 'active' : ''} ${st.phase === 'waiting' ? 'is-waiting' : ''}`}>
      <div className="seat-av" style={remain !== null ? { ['--pct' as string]: `${remain * 100}%` } : undefined}>
        {s && <span className="bezel" aria-hidden="true" />}
        {s ? <Avatar k={s.avatar} size={pos === 'bottom' ? 92 : 86} vip={seat === me && myVip} name={s.name} /> : <span className="q-mark">?</span>}
        {remain !== null && <span className="timer-ring" aria-hidden="true" />}
        <button className="gift-mini" onClick={onGift} aria-label={`Send a gift to ${s?.name ?? 'seat'}`}><Icon name="gift" size={16} /></button>
        {st.dealer === seat && st.phase !== 'waiting' && <span className="dealer" title="Dealer">D</span>}
      </div>
      {s && <div className="seat-name">{s.name} {s.bot ? <small className="cpu-tag">CPU</small> : <small>Lv {s.level}</small>}</div>}
      {s && st.phase !== 'waiting' && (
        <div className="seat-bid">{st.bids[seat] === null ? (active && st.phase === 'bidding' ? '…' : '–') : st.bids[seat] === 0 ? `NIL · ${st.tricks[seat]}` : `${st.tricks[seat]}/${st.bids[seat]}`}</div>
      )}
      {seat !== me && st.phase !== 'waiting' && st.phase !== 'gameOver' && <div className="seat-cards" aria-label={`${st.handCounts[seat]} cards`}>{st.handCounts[seat]}</div>}
      {bubble && <div className="bubble">{bubble}</div>}
    </div>
  );
}

function BidPanel({ st, onBid, secsLeft }: { st: PublicState; onBid: (b: number) => void; secsLeft: number | null }) {
  const me = st.mySeat;
  const suggestion = useMemo(() => botBid({ ...st, hands: Object.assign([[], [], [], []], { [me]: st.hand }) } as never, me), [st.round]); // eslint-disable-line react-hooks/exhaustive-deps
  const partnerBid = st.settings.mode === 'partners' ? st.bids[(me + 2) % 4] : null;
  return (
    <div className="bid-panel" role="dialog" aria-label="Place your bid">
      <div className="bid-title">YOUR BID{secsLeft !== null && <span className={`bid-clock ${secsLeft <= 4 ? 'hurry' : ''}`}> · {secsLeft}s</span>}</div>
      <div className="bid-hint">Suggested: <b>{suggestion === 0 ? 'Nil' : suggestion}</b>{partnerBid !== null && <> · Partner bid <b>{partnerBid === 0 ? 'Nil' : partnerBid}</b></>}</div>
      <div className="bid-grid">
        <button className="bid-btn nil" onClick={() => onBid(0)}>NIL</button>
        {Array.from({ length: 13 }, (_, i) => i + 1).map((n) => (
          <button key={n} className={`bid-btn ${n === suggestion ? 'sug' : ''}`} onClick={() => onBid(n)}>{n}</button>
        ))}
      </div>
    </div>
  );
}

function RoundSummary({ st, canContinue, onContinue }: { st: PublicState; canContinue: boolean; onContinue: () => void }) {
  const h = st.history[st.history.length - 1];
  const mode = st.settings.mode;
  const me = st.mySeat;
  const n = sideCount(mode);
  const label = (side: number) => mode === 'partners' ? (side === sideOf(mode, me) ? 'Us' : 'Them') : (st.seats[side]?.name ?? '');
  const [left, setLeft] = useState(6);
  useEffect(() => { const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000); return () => clearInterval(t); }, []);
  return (
    <div className="modal-backdrop soft">
      <div className="modal summary" role="dialog" aria-label="Round summary">
        <h2 className="modal-title">Round {st.round}</h2>
        <table className="sum-table">
          <thead><tr><th></th><th>Bid</th><th>Books</th><th>Round</th><th>Bags</th><th>Total</th></tr></thead>
          <tbody>
            {Array.from({ length: n }, (_, side) => {
              const seats = seatsOfSide(mode, side);
              const bid = seats.map((s) => (h.bids[s] === 0 ? 'Nil' : h.bids[s])).join(' + ');
              const tr = seats.reduce((a, s) => a + h.tricks[s], 0);
              return (
                <tr key={side} className={side === sideOf(mode, me) ? 'me' : ''}>
                  <td>{label(side)}</td><td>{bid}</td><td>{tr}</td>
                  <td className={h.delta[side] >= 0 ? 'pos' : 'neg'}>{h.delta[side] > 0 ? '+' : ''}{h.delta[side]}{h.bagPenalty[side] ? ' (bag −100)' : ''}</td>
                  <td>{st.bags[side]}</td><td><b>{st.scores[side]}</b></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {h.nilResults.some((x) => x !== null) && (
          <p className="center small">{h.nilResults.map((r, s) => (r === null ? null : `${st.seats[s]?.name}: nil ${r ? 'made (+100)' : 'failed (−100)'}`)).filter(Boolean).join(' · ')}</p>
        )}
        <div className="center">{canContinue ? <Pill color="green" onClick={onContinue}>Next round ({left})</Pill> : <span className="muted">Next round in {left}s…</span>}</div>
      </div>
    </div>
  );
}

function GameOver({ st, onLobby, onAgain }: { st: PublicState; onLobby: () => void; onAgain: () => void }) {
  const mode = st.settings.mode;
  const me = st.mySeat;
  const mySide = sideOf(mode, me);
  const won = st.winners.includes(mySide);
  const vip = profile.get().vip;
  const prize = won ? Math.round(prizeFor(st.settings) * (vip ? 1.1 : 1)) : 0;
  const place = st.placements.indexOf(mySide) + 1;
  return (
    <div className="modal-backdrop">
      <div className={`modal gameover ${won ? 'win' : 'lose'}`} role="dialog" aria-label="Game over">
        <div className="go-title">{won ? 'VICTORY!' : mode === 'solo' ? `${['', '1ST', '2ND', '3RD', '4TH'][place]} PLACE` : 'DEFEAT'}</div>
        {won && <div className="go-prize"><Coin size={44} /> +{fmt(prize)}{vip && <small> incl. VIP +10%</small>}</div>}
        <ol className="go-places">
          {st.placements.map((side, i) => (
            <li key={side} className={side === mySide ? 'me' : ''}>
              <span>{i + 1}.</span>
              <span className="grow">{seatsOfSide(mode, side).map((s) => st.seats[s]?.name).join(' & ')}</span>
              <b>{st.scores[side]}</b>
            </li>
          ))}
        </ol>
        <p className="muted small">+{40 + (won ? 80 : 0)} XP · Level {levelFromXp(profile.get().xp)}</p>
        <div className="btn-row">
          <Pill color="blue" onClick={onLobby}>Lobby</Pill>
          {profile.get().coins < st.settings.bet
            ? <Pill color="gold" onClick={() => store.open({ tab: 'coins', need: st.settings.bet })}>Buy coins to play again</Pill>
            : <Pill color="green" onClick={onAgain}>Play again</Pill>}
        </div>
      </div>
    </div>
  );
}

function ChatPanel({ view, me, onClose, onSend }: { view: CtlView; me: number; onClose: () => void; onSend: (t: string) => void }) {
  const [text, setText] = useState('');
  const p = useProfile();
  const unlocked = canChat(p);
  const pass = chatPassLabel(p);
  const chatOn = !p.settings.chatOff;
  const msgs = (view.snap?.chat ?? []).filter((m) => !m.system && !m.text.startsWith('🎁:') && (chatOn || m.seat === me)).slice(-4);
  const send = (t: string) => { if (t.trim()) { onSend(t); sfx.click(); onClose(); } };
  return (
    <div className="chat-overlay" role="dialog" aria-label="Table chat">
      <div className="chat-dim" onClick={onClose} />
      <aside className="chat-phrases">
        <div className="chat-scroll">
          {QUICK_PHRASES.map((q) => <button key={q} className="speech" onClick={() => send(q)}>{q}</button>)}
        </div>
        <button className="chat-back" onClick={() => { sfx.click(); onClose(); }}>BACK</button>
      </aside>
      {msgs.length > 0 && (
        <div className="chat-recent" aria-live="polite">
          {msgs.map((m) => <div key={m.id} className={m.seat === me ? 'mine' : ''}><b>{m.name}:</b> {m.text}</div>)}
        </div>
      )}
      <div className="chat-custom">
        {unlocked ? (
          <form onSubmit={(e) => { e.preventDefault(); send(text); setText(''); }}>
            <label className="sr-only" htmlFor="chat-in">Message</label>
            <input id="chat-in" value={text} maxLength={140} onChange={(e) => setText(e.target.value)} placeholder="Type your own message…" autoComplete="off" autoFocus />
            <button type="submit" className="chat-send">SEND</button>
            {pass && <small className="chat-pass-left">{pass}</small>}
          </form>
        ) : (
          <>
            <span className="cc-txt">GET A <b>CHAT PASS</b> TO TYPE YOUR OWN MESSAGES</span>
            <button className="cc-buy" onClick={() => { sfx.click(); store.open({ tab: 'chat' }); }}>BUY NOW</button>
          </>
        )}
      </div>
      <aside className="chat-emoji">
        <div className="chat-scroll emoji-grid">
          {FREE_EMOJI.map((e) => <button key={e} onClick={() => send(e)} aria-label={`Send ${e}`}>{e}</button>)}
        </div>
        <label className="chat-toggle">
          <span>CHAT</span>
          <input type="checkbox" checked={chatOn} onChange={() => { sfx.click(); profile.set((x) => ({ settings: { ...x.settings, chatOff: chatOn } })); }} />
          <span className="ct-switch" aria-hidden="true"><i>{chatOn ? 'ON' : 'OFF'}</i></span>
        </label>
      </aside>
    </div>
  );
}

export function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How to play Spades" onClose={onClose} wide>
      <div className="rules">
        <p><b>Goal.</b> Win the number of tricks (“books”) you bid. Spades are always trump.</p>
        <p><b>Partners</b>: you sit across from your partner and your bids are added together. <b>Solo</b>: every player is on their own.</p>
        <p><b>Bidding.</b> Each player bids 1–13 or <b>Nil</b> (promising to win zero tricks). The game suggests a bid from your hand.</p>
        <p><b>Play.</b> Follow the suit that was led if you can. If you can't, you may play any card — a spade wins unless a higher spade is played. Spades can't be led until they've been “broken” (played on another suit), unless you have only spades.</p>
        <p><b>Scoring.</b> Make your bid: 10 × bid, plus 1 point per extra trick (a “bag”). Miss it: −10 × bid. Nil: +100 if you take no tricks, −100 if you take any. Every 10 bags costs 100 points.</p>
        <p><b>Winning.</b> The game ends when a side reaches the table's max points or drops to the min points. Highest score takes the prize.</p>
      </div>
    </Modal>
  );
}

export type { Card };
