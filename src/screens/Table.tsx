import { SpadesBroken } from '../components/SpadesBroken';
import { TableShape } from '../components/TableShape';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Avatar, CardView, Coin, Icon, Modal, Pill } from '../components/ui';
import { Card, legalCards, prizeFor, sameCard, sideCount, sideOf, seatsOfSide, PublicState } from '../../shared/engine';
import { botBid } from '../../shared/bot';
import type { CtlView, TableController } from '../lib/controller';
import { fmt, levelFromXp, profile, publicStats, short, useProfile, xpForLevel } from '../lib/profile';
import { PlayerCard } from '../components/PlayerCard';
import { music, sfx, vibrate } from '../lib/sound';
import { MusicPicker } from '../components/MusicPicker';
import { toast } from '../lib/toast';
import { reportWin } from '../lib/api';
import { helpBot } from '../lib/helpbot';
import { ThemeModal, VipModal } from './modals';
import { activeTheme, newlyUnlocked, themeVars } from '../lib/themes';
import { canChat, chatPassLabel, store } from '../lib/payments';

const POS = ['bottom', 'left', 'top', 'right'] as const;
import { FREE_EMOJI, QUICK_PHRASES } from '../../shared/chat';
import { GIFTS, GIFT_BY_ID, type Gift } from '../../shared/gifts';
import type { SeatGift } from '../../shared/runtime';

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
  const [cardSeat, setCardSeat] = useState<number | null>(null);
  const [flying, setFlying] = useState<{ id: number; e: string; to: string }[]>([]);
  const [unread, setUnread] = useState(0);
  const [now, setNow] = useState(Date.now());
  const charged = useRef(false);
  const settled = useRef(false);
  const lastChatId = useRef(0);
  // when each chat line first reached THIS device (a phone's clock can be minutes off the server's, so the server's time stamp can't decide how long a line stays up)
  const chatSeen = useRef<{ map: Map<number, number>; first: boolean }>({ map: new Map(), first: true });
  const lastTurn = useRef<string>('');

  useEffect(() => ctl.subscribe(setView), [ctl]);
  // countdowns use the server's clock: a device whose own clock is a few seconds off would otherwise show a wrong or frozen count
  const skew = useRef(0);
  skew.current = view?.snap?.skew ?? 0;
  useEffect(() => { const t = setInterval(() => setNow(Date.now() + skew.current), 500); return () => clearInterval(t); }, []);

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
      const myNils = st.history.filter((h) => h.bids[me] === 0);
      const blinds = myNils.filter((h) => h.blind?.[me]);
      const city = st.settings.city;
      profile.set((x) => ({
        card: {
          last5: ((x.card?.last5 ?? '') + (won ? 'W' : 'L')).slice(-5),
          nil: (x.card?.nil ?? 0) + myNils.length, nilMade: (x.card?.nilMade ?? 0) + myNils.filter((h) => h.nilResults[me]).length,
          blind: (x.card?.blind ?? 0) + blinds.length, blindMade: (x.card?.blindMade ?? 0) + blinds.filter((h) => h.nilResults[me]).length,
          rings: won ? { ...(x.card?.rings ?? {}), [city]: ((x.card?.rings ?? {})[city] ?? 0) + 1 } : (x.card?.rings ?? {}),
        },
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
      if (!view.online) { const me2 = profile.get(); reportWin({ id: me2.id, name: me2.name, avatar: me2.avatar, mode: st.settings.mode, bet: st.settings.bet, prize, lost: !won }); }   // a loss takes the bet off the boards
    }
    const msgs = view.snap?.chat ?? [];
    const newest = msgs[msgs.length - 1];
    if (newest && newest.id !== lastChatId.current) {
      const fresh = msgs.filter((m) => m.id > lastChatId.current && !m.system && m.seat !== me && !m.text.startsWith('🎁:'));
      lastChatId.current = newest.id;
      if (fresh.length && !profile.get().settings.chatOff) { sfx.chat(); if (!chatOpen) setUnread((u) => u + fresh.length); }
      // a gift announces itself with a hidden chat line "🎁:<seat>:<gift id>": make it fly to that player
      for (const m of msgs.filter((m) => m.text.startsWith('🎁:') && Date.now() - m.ts < 3000)) {
        const [, to, id] = m.text.split(':');
        const e = GIFT_BY_ID[id]?.e ?? id;
        setFlying((f) => f.some((x) => x.id === m.id) ? f : [...f, { id: m.id, e, to: rel(+to) }]);
        setTimeout(() => setFlying((f) => f.filter((x) => x.id !== m.id)), 1800);
      }
    }
    if (view.online && view.conn === 'gone' && charged.current && !settled.current && st.phase !== 'gameOver') {
      settled.current = true;
      if (!view.forfeited) profile.set((x) => ({ coins: x.coins + st.settings.bet }));   // a table that vanished (server update) refunds; leaving or being away too long does not
    }
    if (view.error) toast(view.error, 'error');
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (chatOpen) setUnread(0); }, [chatOpen]);
  // "SPADES BROKEN!" splash: once per round, the moment the first spade is played on another suit (not when joining a round that's already broken)
  const [brokenSplash, setBrokenSplash] = useState(0);
  const brokenSeen = useRef(!!st?.spadesBroken);
  useEffect(() => {
    const now = !!st?.spadesBroken;
    const was = brokenSeen.current;
    brokenSeen.current = now;
    if (!now || was || st?.phase === 'gameOver') return;
    setBrokenSplash((n) => n + 1);
    sfx.broken();
    vibrate(40);
    const t = setTimeout(() => setBrokenSplash(0), 2900);
    return () => clearTimeout(t);
  }, [st?.spadesBroken]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Time ran out…" notice: shown once each time a turn is missed, then it goes away on its own (not for the rest of the game)
  const missedNow = view?.snap?.missed?.[me] ?? 0;
  const [missedBanner, setMissedBanner] = useState(false);
  const missedSeen = useRef(0);
  useEffect(() => {
    const grew = missedNow > missedSeen.current;
    missedSeen.current = missedNow;
    if (!grew) return;
    setMissedBanner(true);
    const t = setTimeout(() => setMissedBanner(false), 6000);
    return () => clearTimeout(t);
  }, [missedNow]);
  // the card just tapped: hidden at once (so a slow connection doesn't leave it hanging in your hand) and further taps are ignored until the server confirms
  const [sent, setSent] = useState<string | null>(null);
  useEffect(() => {
    if (!sent) return;
    if (view?.error || !st?.hand.some((c) => c.s + c.r === sent)) { setSent(null); return; }
    const t = setTimeout(() => setSent(null), 2500);
    return () => clearTimeout(t);
  }, [sent, st?.hand, view?.error]);
  const [fall] = useState(() => 1 + Math.floor(Math.random() * 4));   // which of the four fall / Halloween rooms this table uses
  useEffect(() => { if (p.settings.music !== false) music.start(p.settings.track); else music.stop(); }, [p.settings.music, p.settings.track]);
  useEffect(() => { music.atTable = true; return () => { music.atTable = false; music.stop(); }; }, []);

  const leave = () => {
    // leaving a game against computers after it started forfeits the bet (and takes it off the boards)
    if (view && !view.online && st && charged.current && !settled.current && st.phase !== 'waiting' && st.phase !== 'gameOver') {
      settled.current = true;
      const me2 = profile.get();
      reportWin({ id: me2.id, name: me2.name, avatar: me2.avatar, mode: st.settings.mode, bet: st.settings.bet, prize: 0, lost: true });
    }
    ctl.leave();
    onExit();
  };

  if (!view || !st) {
    return <div className={`screen table-screen felt-bg fall-${fall}`}><div className="connecting">Connecting to table…</div>
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
    <div className={`screen table-screen felt-bg fall-${fall}`} style={themeVars(activeTheme(p.theme, levelFromXp(p.xp)))}>
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
            {st.phase === 'waiting' && view.snap!.startAt && (
              <div className="center-msg" role="timer">
                <b>GAME WILL START IN</b>
                <span className="cm-big" key={Math.max(1, Math.ceil((view.snap!.startAt - now) / 1000))}>{Math.max(1, Math.ceil((view.snap!.startAt - now) / 1000))}</span>
              </div>
            )}
            {st.phase === 'bidding' && st.turn !== me && (
              <div className="center-msg"><b>CHOOSE YOUR BID</b><span className="cm-name">{st.seats[st.turn]?.name}</span></div>
            )}
            {st.phase === 'waiting' && !view.snap!.startAt && (
              <div className="waiting">
                <div className="waiting-text">WAITING FOR PLAYERS<span className="dots3"><i>.</i><i>.</i><i>.</i></span></div>
                {(view.snap!.fillAt || (view.online && view.host && view.settings.isPrivate)) && (
                  <div className="waiting-actions">
                    {view.snap!.fillAt
                      ? <span className="fill-wait" role="timer">Waiting for player {st.seats.filter(Boolean).length + 1} · a computer player joins in <b>{Math.min(15, Math.max(0, Math.ceil((view.snap!.fillAt - Date.now()) / 1000)))}s</b></span>
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
            <TrickCards st={st} rel={rel} />
            {st.phase === 'playing' && st.trick.length === 0 && st.turn === me && <div className="status-line you">Your lead{!st.spadesBroken ? ' — spades not broken yet' : ''}</div>}
          </div>
        </div>

        {[0, 1, 2, 3].map((seat) => (
          <SeatView key={seat} st={st} seat={seat} pos={rel(seat)} me={me} deadline={view.snap!.turnDeadline} total={view.snap!.turnTotal} now={now}
            bubble={null}
            gifts={view.snap!.gifts?.[seat] ?? []}
            onGift={() => setGiftFor(seat)} onProfile={() => { sfx.click(); setCardSeat(seat); }} myVip={p.vip} />
        ))}
        {(() => {
          // chat shown on the table too (same lines as the chat box), each for 12 seconds, also while the chat box is open
          const cs = chatSeen.current, t0 = Date.now();
          for (const m of view.snap!.chat) if (!cs.map.has(m.id)) cs.map.set(m.id, cs.first ? 0 : t0);   // lines already there when the table opened are old news
          cs.first = false;
          const live = view.snap!.chat.filter((m) => !m.system && !m.text.startsWith('🎁:') && t0 - (cs.map.get(m.id) ?? 0) < 12000 && (!p.settings.chatOff || m.seat === me)).slice(-3);
          return live.length > 0 && (
            <div className="tbl-chat" aria-live="polite">
              {live.map((m) => (
                <div key={m.id} className={`tc-line ${m.seat === me ? 'mine' : ''} ${t0 - (cs.map.get(m.id) ?? 0) > 10800 ? 'out' : ''}`}>
                  <Avatar k={st.seats[m.seat]?.avatar ?? 'a1'} size={36} />
                  <span className="tc-name">{m.name}:</span> <span className="tc-text">{m.text}</span>
                </div>
              ))}
            </div>
          );
        })()}
        {flying.map((f) => <span key={f.id} className={`flying to-${f.to}`} aria-hidden="true">{f.e}</span>)}
      </div>

      {/* Hand: fanned in an arc; face down during bidding until you choose to look */}
      {(() => {
        const hidden = st.phase === 'bidding' && st.hand.length === 0 && st.handCounts[me] > 0;
        const cards: (Card | null)[] = hidden ? Array(st.handCounts[me]).fill(null) : st.hand;
        const n = cards.length;
        const gap = Math.min(74, 860 / Math.max(1, n));
        return (
          <div className={`fan ${hidden ? 'hidden' : ''}`}>
            {cards.map((c, i) => {
              const off = i - (n - 1) / 2;
              const pos = { ['--x' as string]: `${off * gap}px`, ['--y' as string]: `${off * off * 1.2}px`, ['--r' as string]: `${off * 2.2}deg`, ['--i' as string]: i, zIndex: i } as React.CSSProperties;
              if (!c) return <CardView key={`${st.round}-b${i}`} back className="hcard deal" style={pos} />;
              const ok = myTurn && st.phase === 'playing' && legal.some((l) => sameCard(l, c));
              return <CardView key={`${st.round}-${c.s}${c.r}`} card={c} style={pos} dataCard={`${c.s}${c.r}`} className={`hcard deal ${ok ? 'legal' : ''} ${myTurn && st.phase === 'playing' && !ok ? 'dim' : ''} ${sent === c.s + c.r ? 'sent' : ''}`}
                onClick={() => {
                  if (sent) return;
                  if (ok) { setSent(c.s + c.r); vibrate(10); { const h = document.querySelector(`.fan [data-card="${c.s}${c.r}"]`); if (h) Object.assign(playedFrom, screenCenter(h), { at: Date.now() }); } ctl.act({ type: 'play', seat: me, card: c }); return; }
                  // explain why this card can't be played right now
                  if (st.phase !== 'playing') return;
                  if (!myTurn) return toast(`Wait for your turn — ${st.seats[st.turn]?.name ?? 'another player'} is playing`);
                  if (st.trick.length) return toast(`Follow suit: play a ${({ S: '♠ spade', H: '♥ heart', D: '♦ diamond', C: '♣ club' })[st.trick[0].card.s]}`);
                  toast('Spades aren’t broken yet — lead a different suit');
                }} />;
            })}
          </div>
        );
      })()}

      {myTurn && secsLeft !== null && st.phase === 'playing' && <div className={`turn-clock ${secsLeft <= 4 ? 'hurry' : ''}`} role="timer">Your turn · {secsLeft}s</div>}
      {brokenSplash > 0 && <SpadesBroken key={brokenSplash} />}
      {missedBanner && missedMine > 0 && st.phase !== 'gameOver' && !view.kicked && (
        <div className="missed-warning" role="alert"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9 2h6" /></svg> Time ran out and the game played for you ({missedMine}/{maxMissed}). Miss {maxMissed} turns this game and you'll be disconnected.</div>
      )}
      {st.phase === 'bidding' && st.turn === me && st.bids[me] === null && (st.hand.length === 0
        ? <SeeCards secsLeft={secsLeft} onSee={() => { sfx.click(); ctl.act({ type: 'reveal', seat: me }); }} onBlind={() => { sfx.click(); ctl.act({ type: 'bid', seat: me, bid: 0, blind: true }); }} />
        : <BidPanel st={st} secsLeft={secsLeft} onBid={(b) => { sfx.click(); ctl.act({ type: 'bid', seat: me, bid: b }); }} />)}
      {view.online && view.conn === 'lost' && !view.kicked && (
        <div className="conn-banner" role="status"><span className="conn-spin" aria-hidden="true" /> Connection lost — reconnecting… your seat is held for 45 seconds</div>
      )}
      {view.online && view.conn === 'gone' && st.phase !== 'gameOver' && (
        <div className="modal-backdrop">
          <div className="modal kicked" role="alertdialog" aria-label="Game interrupted">
            <h2 className="modal-title">{view.forfeited ? 'You left the game' : 'Game interrupted'}</h2>
            {view.forfeited
              ? <p className="center">You were away from the table for too long, so a computer player took your seat. Your {fmt(st.settings.bet)} coin bet was forfeited.</p>
              : <p className="center">This table closed before the game finished — usually because the game server restarted for an update.</p>}
            {!view.forfeited && charged.current && <p className="center gold-text">Your {fmt(st.settings.bet)} coin bet has been refunded.</p>}
            <div className="btn-row"><Pill color="green" onClick={leave}>Back to lobby</Pill></div>
          </div>
        </div>
      )}
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
      {st.phase === 'roundEnd' && !view.snap!.ready?.[me] && <RoundSummary st={st} nextAt={view.snap!.startAt} now={now} onContinue={() => { sfx.click(); ctl.act({ type: 'ready', seat: me }); }} />}
      {st.phase === 'roundEnd' && view.snap!.ready?.[me] && view.snap!.startAt && <div className="center-toast">Next hand in {Math.max(0, Math.ceil((view.snap!.startAt - now) / 1000))}s · waiting for the other players</div>}
      {st.phase === 'gameOver' && <GameOver st={st} onLobby={leave} onAgain={() => { ctl.leave(); onPlayAgain(); }} />}

      {chatOpen && (
        <ChatPanel view={view} me={me} onClose={() => setChatOpen(false)} onSend={(t) => ctl.chat(t)} />
      )}
      {menuOpen && (
        <TableMenu
          onClose={() => { setMenuOpen(false); setConfirmLeave(false); }}
          onRules={() => { setRulesOpen(true); setMenuOpen(false); }}
          onBot={() => { setMenuOpen(false); helpBot.open(); }}
          onThemes={() => { setMenuOpen(false); setThemesOpen(true); }}
          confirmLeave={confirmLeave} bet={st.settings.bet}
          onExit={() => { if (st.phase === 'waiting' || st.phase === 'gameOver' || confirmLeave) leave(); else setConfirmLeave(true); }} />
      )}
      {rulesOpen && <RulesModal onClose={() => setRulesOpen(false)} />}
      {themesOpen && <ThemeModal onClose={() => setThemesOpen(false)} />}
      {vip && <VipModal onClose={() => setVip(false)} />}
      {cardSeat !== null && st.seats[cardSeat] && (() => {
        const s = st.seats[cardSeat]!;
        const mine = cardSeat === me;
        const lvl = mine ? levelFromXp(p.xp) : s.level;
        return <PlayerCard onClose={() => setCardSeat(null)} player={{ name: mine ? (p.name || s.name) : s.name, avatar: mine ? p.avatar : s.avatar, level: lvl, bot: s.bot, id: mine || s.bot ? undefined : s.id,
          stats: mine ? publicStats(p) : s.stats, levelPct: mine ? ((p.xp - xpForLevel(lvl)) / (xpForLevel(lvl + 1) - xpForLevel(lvl))) * 100 : undefined }} />;
      })()}
      {giftFor !== null && (
        <GiftShop toName={st.seats[giftFor]?.name ?? null} players={st.seats.filter(Boolean).length} coins={p.coins} onClose={() => setGiftFor(null)}
          onBuy={(g, round) => {
            const n = round ? st.seats.filter(Boolean).length : 1, cost = g.cost * n;
            if (p.coins < cost) { toast('Not enough coins for that gift', 'error'); return; }
            profile.addCoins(-cost); sfx.coins();
            ctl.gift(round ? 'all' : giftFor, g.id);
            setGiftFor(null);
            toast(round ? `${g.e} ${g.name} for everyone at the table!` : `${g.e} ${g.name} sent to ${st.seats[giftFor]?.name ?? 'the player'}`);
          }} />
      )}
    </div>
  );
}

// ---------------- gifts ----------------
/** The gift shop: one row per gift, "buy round" = everyone at the table, "buy one" = the player whose gift button you tapped. */
function GiftShop({ toName, players, coins, onBuy, onClose }: { toName: string | null; players: number; coins: number; onBuy: (g: Gift, round: boolean) => void; onClose: () => void }) {
  return (
    <Modal title="GIFTS" onClose={onClose} className="gs-modal">
      <p className="gs-sub">Your coins: <b><Coin size={18} /> {fmt(coins)}</b>{toName ? <> · Buy one is for <b>{toName}</b></> : null} · A round is for all {players} players</p>
      <ul className="gs-list">
        {GIFTS.map((g) => (
          <li key={g.id} className="gs-row">
            <span className="gs-pic" aria-hidden="true">{g.e}</span>
            <b className="gs-name">{g.name}</b>
            <span className="gs-cost"><Coin size={22} /> {fmt(g.cost)}</span>
            <button className="gs-btn round" disabled={coins < g.cost * players} onClick={() => { sfx.click(); onBuy(g, true); }} aria-label={`Buy a round of ${g.name} for everyone, ${fmt(g.cost * players)} coins`}>
              BUY ROUND<small>{fmt(g.cost * players)}</small>
            </button>
            <button className="gs-btn one" disabled={coins < g.cost || !toName} onClick={() => { sfx.click(); onBuy(g, false); }} aria-label={`Buy ${g.name} for ${toName ?? 'this seat'}, ${fmt(g.cost)} coins`}>
              BUY ONE<small>{fmt(g.cost)}</small>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

/** Gifts sitting on a player this game (same gift bought twice shows ×2). Hover or long-press to see who bought them. */
function SeatGifts({ gifts }: { gifts: SeatGift[] }) {
  if (!gifts.length) return null;
  const groups = new Map<string, { g: Gift; n: number; by: Set<string> }>();
  for (const x of gifts) {
    const g = GIFT_BY_ID[x.id]; if (!g) continue;
    const cur = groups.get(g.id) ?? { g, n: 0, by: new Set<string>() };
    cur.n++; cur.by.add(x.by); groups.set(g.id, cur);
  }
  const shown = [...groups.values()].slice(-4); // the 4 most recent kinds
  return (
    <div className="seat-gifts" aria-label={`Gifts: ${shown.map((s) => `${s.n} ${s.g.name}`).join(', ')}`}>
      {shown.map(({ g, n, by }) => (
        <span key={g.id} className="sg" title={`${g.name}${n > 1 ? ` ×${n}` : ''} — from ${[...by].join(', ')}`}>{g.e}{n > 1 && <i>{n}</i>}</span>
      ))}
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
              <td>{st.seats[s]?.name.split(' ')[0].slice(0, 9) ?? '—'}</td><td>{st.scores[s]}</td><td>{st.bags[s]}</td>
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

// ---------------- Cards in the middle of the table ----------------
/** Where on screen the hand card you just tapped was, so your card flies from exactly there. */
const playedFrom: { x: number; y: number; at: number } = { x: 0, y: 0, at: 0 };
const screenCenter = (el: Element) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
const seatEl = (pos: string) => document.querySelector<HTMLElement>(`.seat-${pos} .seat-av`);
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const translationOf = (el: HTMLElement) => { const t = getComputedStyle(el).transform; const m = t && t !== 'none' ? new DOMMatrixReadOnly(t) : new DOMMatrixReadOnly(); return { t: t && t !== 'none' ? t : 'none', x: m.e, y: m.f }; };

/** Converts a distance measured on screen into the table's own coordinates (the table is scaled, tilted, and turned sideways on phones). */
function screenToLocal(root: HTMLElement) {
  const probe = (x: number, y: number) => {
    const p = document.createElement('i');
    p.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:0;height:0`;
    root.appendChild(p); const r = p.getBoundingClientRect(); p.remove();
    return { x: r.left, y: r.top };
  };
  const o = probe(0, 0), ex = probe(100, 0), ey = probe(0, 100);
  const a = (ex.x - o.x) / 100, b = (ex.y - o.y) / 100, c = (ey.x - o.x) / 100, d = (ey.y - o.y) / 100;
  const det = a * d - b * c || 1;
  return (dx: number, dy: number) => ({ x: (d * dx - c * dy) / det, y: (-b * dx + a * dy) / det });
}

/** Each played card glides from the player who played it to the middle; the finished trick slides to its winner. */
function TrickCards({ st, rel }: { st: PublicState; rel: (seat: number) => string }) {
  const box = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<string>());
  const collected = useRef('');
  useLayoutEffect(() => {
    const root = box.current;
    if (!root || reduceMotion()) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(':scope > .tcard'));
    let toLocal: ReturnType<typeof screenToLocal> | null = null;
    const local = () => (toLocal ??= screenToLocal(root));
    st.trick.forEach((t, i) => {
      const id = `${st.round}-${t.card.s}${t.card.r}`;
      const el = els[i];
      if (!el || seen.current.has(id)) return;
      seen.current.add(id);
      const pos = rel(t.seat);
      const mine = pos === 'bottom' && Date.now() - playedFrom.at < 3000;
      const seat = seatEl(pos);
      const from = mine ? playedFrom : seat ? screenCenter(seat) : null;
      if (!from) return;
      const to = screenCenter(el), end = translationOf(el);
      const d = local()(from.x - to.x, from.y - to.y);
      const tilt = pos === 'left' ? -24 : pos === 'right' ? 24 : pos === 'top' ? 12 : 0;
      el.animate([
        { transform: `translate(${d.x + end.x}px, ${d.y + end.y}px) rotate(${tilt}deg) scale(${mine ? 1 : 0.5})`, boxShadow: '0 4px 8px rgba(0,0,0,.3)' },
        { offset: 0.7, boxShadow: '0 22px 34px rgba(0,0,0,.45)' },
        { transform: end.t, boxShadow: '0 6px 14px rgba(0,0,0,.35)' },
      ], { duration: mine ? 520 : 680, easing: 'cubic-bezier(.25,.8,.3,1)' });
      if (mine) playedFrom.at = 0;
    });
    // trick won: after a short look the four cards gather in the middle and fade, and the winner's picture glows
    const key = `${st.round}-${st.trick.map((t) => `${t.card.s}${t.card.r}`).join('')}`;
    if (st.phase === 'trickEnd' && st.lastTrickWinner !== null && collected.current !== key) {
      collected.current = key;
      const winner = seatEl(rel(st.lastTrickWinner));
      if (winner) { winner.classList.remove('won-trick'); void winner.offsetWidth; winner.classList.add('won-trick'); }
      els.forEach((el) => {
        const end = translationOf(el);
        el.animate([
          { transform: end.t, opacity: 1 },
          { transform: `translate(${end.x * 0.25}px, ${end.y * 0.25}px) scale(.82)`, opacity: 0 },
        ], { duration: 380, delay: 700, easing: 'ease-in', fill: 'forwards' });
      });
    }
  }, [st.trick, st.phase, st.round, st.lastTrickWinner, rel]);
  return (
    <div className="trick" ref={box}>
      {st.trick.map((t) => <CardView key={`${st.round}-${t.card.s}${t.card.r}`} card={t.card} className={`tcard at-${rel(t.seat)}`} />)}
    </div>
  );
}

function SeatView({ st, seat, pos, me, deadline, total, now, bubble, gifts, onGift, onProfile, myVip }: {
  st: PublicState; seat: number; pos: string; me: number; deadline: number | null; total: number | null; now: number; bubble: string | null; gifts: SeatGift[]; onGift: () => void; onProfile: () => void; myVip: boolean;
}) {
  const s = st.seats[seat];
  const mode = st.settings.mode;
  const team = mode === 'partners' ? (sideOf(mode, seat) === sideOf(mode, me) ? 'blue' : 'red') : ['blue', 'red', 'green', 'gold'][seat];
  const active = st.turn === seat && (st.phase === 'bidding' || st.phase === 'playing');
  const remain = active && deadline && total ? Math.max(0, deadline - now) / total : null;
  return (
    <div className={`seat seat-${pos} team-${team} ${active ? 'active' : ''} ${st.phase === 'waiting' ? 'is-waiting' : 'in-play'}`}>
      <div className="seat-av" style={remain !== null ? { ['--pct' as string]: `${remain * 100}%` } : undefined}>
        {s && <span className="bezel" aria-hidden="true" />}
        {s ? <button className="seat-pic" onClick={onProfile} aria-label={`View ${s.name}'s profile`}><Avatar k={s.avatar} size={pos === 'bottom' ? 112 : 106} vip={seat === me && myVip} name={s.name} /></button> : <span className="q-mark">?</span>}
        {remain !== null && <span className="timer-ring" aria-hidden="true" />}
        <button className="gift-mini" onClick={onGift} aria-label={`Send a gift to ${s?.name ?? 'seat'}`}><Icon name="gift" size={16} /></button>
        <SeatGifts gifts={gifts} />
        {st.dealer === seat && st.phase !== 'waiting' && <span className="dealer" title="Dealer">D</span>}
      </div>
      {s && <div className="seat-name" onClick={onProfile} role="button" tabIndex={-1}>{s.name} <small>Lv {s.level}</small></div>}
      {s && st.phase !== 'waiting' && (
        <div className="seat-pill" onClick={onProfile} role="button" aria-label={`${s.name}: ${st.bids[seat] === null ? 'no bid yet' : `${st.tricks[seat]} of ${st.bids[seat]} books`}`}>
          {st.bids[seat] === null ? '-/-' : st.bids[seat] === 0 ? <>{st.tricks[seat]}/<small>{st.blind?.[seat] ? 'BN' : 'NIL'}</small></> : `${st.tricks[seat]}/${st.bids[seat]}`}
        </div>
      )}
      {bubble && <div className="bubble">{bubble}</div>}
    </div>
  );
}

function SeeCards({ onSee, onBlind, secsLeft }: { onSee: () => void; onBlind: () => void; secsLeft: number | null }) {
  return (
    <div className="dlg see-cards" role="dialog" aria-label="See your cards">
      <div className="dlg-title">SEE YOUR CARDS?{secsLeft !== null && <span className={`bid-clock ${secsLeft <= 4 ? 'hurry' : ''}`}> {secsLeft}s</span>}</div>
      <div className="sc-row">
        <button className="sc-btn green" onClick={onSee}>SEE CARDS</button>
        <button className="sc-btn blue" onClick={onBlind} title="Bid nil without looking: +200 if you take no tricks, −200 if you take any">BID BLIND NIL<small>±200 points</small></button>
      </div>
    </div>
  );
}

function BidPanel({ st, onBid, secsLeft }: { st: PublicState; onBid: (b: number) => void; secsLeft: number | null }) {
  const me = st.mySeat;
  const mode = st.settings.mode;
  const suggestion = useMemo(() => botBid({ ...st, hands: Object.assign([[], [], [], []], { [me]: st.hand }) } as never, me), [st.round]); // eslint-disable-line react-hooks/exhaustive-deps
  const partnerBid = mode === 'partners' ? st.bids[(me + 2) % 4] : null;
  const mySide = sideOf(mode, me);
  const oppSide = mode === 'partners' ? 1 - mySide : null;
  return (
    <div className="dlg bid-dlg" role="dialog" aria-label="Select your bid">
      <div className="dlg-title">SELECT YOUR BID{secsLeft !== null && <span className={`bid-clock ${secsLeft <= 4 ? 'hurry' : ''}`}> {secsLeft}s</span>}</div>
      <div className="bd-pts">
        {oppSide !== null && <span className="bd-box red"><em>PTS.</em><b>{st.scores[oppSide]} / {st.bags[oppSide]}<i className="bag" aria-label="bags">💰</i></b></span>}
        <span className="bd-box blue"><em>PTS.</em><b>{st.scores[mySide]} / {st.bags[mySide]}<i className="bag" aria-label="bags">💰</i></b></span>
      </div>
      <div className="bd-grid">
        {Array.from({ length: 14 }, (_, n) => (
          <button key={n} className={`bd-tile ${n === suggestion ? 'sug' : ''}`} onClick={() => onBid(n)} aria-label={n === 0 ? 'Bid nil' : `Bid ${n}`}>{n}</button>
        ))}
      </div>
      <div className="bd-hint">0 = Nil · Suggested <b>{suggestion === 0 ? 'Nil' : suggestion}</b>{partnerBid !== null && <> · Partner bid <b>{partnerBid === 0 ? (st.blind?.[(me + 2) % 4] ? 'Blind nil' : 'Nil') : partnerBid}</b></>}</div>
    </div>
  );
}

function RoundSummary({ st, nextAt, now, onContinue }: { st: PublicState; nextAt: number | null; now: number; onContinue: () => void }) {
  const h = st.history[st.history.length - 1];
  const mode = st.settings.mode;
  const me = st.mySeat;
  const left = nextAt ? Math.max(0, Math.ceil((nextAt - now) / 1000)) : null;
  const nilPts = (s: number) => (h.nilResults[s] === null ? 0 : (h.blind?.[s] ? 200 : 100) * (h.nilResults[s] ? 1 : -1));
  const sides = mode === 'partners' ? [1 - sideOf(mode, me), sideOf(mode, me)] : [0, 1, 2, 3];
  const sideRow = (side: number) => {
    const seats = seatsOfSide(mode, side);
    return {
      bid: seats.reduce((a, s) => a + (h.bids[s] ?? 0), 0), made: seats.reduce((a, s) => a + h.tricks[s], 0),
      bags: h.bagsAdded[side], bonus: seats.reduce((a, s) => a + nilPts(s), 0), round: h.delta[side],
      pen: h.bagPenalty[side] ? -100 : 0, totalBags: st.bags[side], total: st.scores[side],
    };
  };
  const ROWS: [keyof ReturnType<typeof sideRow>, string][] = [['bid', 'BID'], ['made', 'MADE'], ['bags', 'ROUND BAGS'], ['bonus', 'BONUS'], ['round', 'ROUND POINTS'], ['pen', '10-BAGS PENALTY'], ['totalBags', 'TOTAL BAGS'], ['total', 'TOTAL POINTS']];
  const strong = new Set(['round', 'total']);

  if (mode !== 'partners') {
    return (
      <div className="modal-backdrop soft">
        <div className="rs rs-solo" role="dialog" aria-label="Round summary">
          <div className="rs-head">ROUND {st.round}</div>
          <table className="rs-grid">
            <thead><tr><th />{sides.map((s) => <th key={s} className={s === me ? 'me' : ''}><Avatar k={st.seats[s]?.avatar ?? 'a1'} size={54} /><span>{st.seats[s]?.name}</span></th>)}</tr></thead>
            <tbody>{ROWS.map(([k, l]) => <tr key={k} className={strong.has(k) ? 'strong' : ''}><td className="rs-lbl">{l}</td>{sides.map((s) => <td key={s}>{sideRow(s)[k]}</td>)}</tr>)}</tbody>
          </table>
          <div className="rs-foot"><button className="rs-continue" onClick={onContinue}>CONTINUE</button>{left !== null && <span>Next hand in {left}s</span>}</div>
        </div>
      </div>
    );
  }

  const [red, blue] = sides;
  const R = sideRow(red), B = sideRow(blue);
  const lead = R.total === B.total ? null : R.total > B.total ? 'red' : 'blue';
  const team = (side: number, color: 'red' | 'blue') => (
    <div className={`rs-team ${color}`}>
      <div className={`rs-team-head ${lead === color ? 'lead' : ''}`}>{lead === color && <span className="rs-crown" aria-hidden="true">★</span>}TEAM {color.toUpperCase()}</div>
      <div className="rs-players">
        {seatsOfSide(mode, side).map((s) => (
          <div key={s} className="rs-player">
            <span className="rs-pic"><Avatar k={st.seats[s]?.avatar ?? 'a1'} size={84} name={st.seats[s]?.name} /></span>
            <span className="rs-pname">{st.seats[s]?.name}</span>
            <span className="rs-cell">{h.bids[s] === 0 ? (h.blind?.[s] ? 'BN' : 'NIL') : h.bids[s]}</span>
            <span className="rs-cell">{h.tricks[s]}</span>
            <span className="rs-cell" />
            <span className="rs-cell">{nilPts(s)}</span>
          </div>
        ))}
      </div>
      {color === 'blue' && <button className="rs-continue" onClick={onContinue}>CONTINUE</button>}
    </div>
  );
  return (
    <div className="modal-backdrop soft">
      <div className="rs" role="dialog" aria-label="Round summary">
        {team(red, 'red')}
        <div className="rs-center">
          <div className="rs-title">ROUND</div>
          <div className="rs-vs">
            <div className="rs-sc red"><b>{R.total}</b><small>💰 {R.totalBags}</small></div>
            <span className="rs-vs-badge">VS</span>
            <div className="rs-sc blue"><b>{B.total}</b><small>💰 {B.totalBags}</small></div>
          </div>
          <div className="rs-hand">HAND {st.round}</div>
          <table className="rs-table">
            <tbody>
              {ROWS.map(([k, l]) => (
                <tr key={k} className={strong.has(k) ? 'strong' : ''}>
                  <td className="v red">{R[k]}</td><td className="rs-lbl">{l}</td><td className="v blue">{B[k]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="rs-note">{left !== null ? `PRESS "CONTINUE" — NEXT HAND IN ${left}s` : 'PRESS "CONTINUE" TO CONTINUE GAME'}</div>
        </div>
        {team(blue, 'blue')}
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
  const ownKeys = useOwnKeyboard();
  const msgs = (view.snap?.chat ?? []).filter((m) => !m.system && !m.text.startsWith('🎁:') && (chatOn || m.seat === me)).slice(-40);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs.length, ownKeys]);
  // the box stays open after sending so the player sees their message and the replies; BACK closes it
  const send = (t: string) => { if (t.trim()) { onSend(t); sfx.click(); } };
  return (
    <div className={`chat-overlay ${ownKeys ? 'own-keys' : ''}`} role="dialog" aria-label="Table chat">
      <div className="chat-dim" onClick={onClose} />
      <aside className="chat-phrases">
        <div className="chat-scroll">
          {QUICK_PHRASES.map((q) => <button key={q} className="speech" onClick={() => send(q)}>{q}</button>)}
        </div>
        <button className="chat-back" onClick={() => { sfx.click(); onClose(); }}>BACK</button>
      </aside>
      <div className="chat-mid">
      <div className="chat-log" ref={logRef} aria-live="polite" aria-label="Messages at this table">
        {msgs.length === 0 && <p className="cl-empty">No messages yet. Tap a phrase or an emoji to say something.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`cl-line ${m.seat === me ? 'mine' : ''}`}>
            <Avatar k={view.snap?.state.seats[m.seat]?.avatar ?? 'a1'} size={44} />
            <span className="cl-body"><b className="cl-name">{m.name}:</b> <span className="cl-text">{m.text}</span></span>
          </div>
        ))}
      </div>
      <div className="chat-custom">
        {unlocked && ownKeys ? (
          <div className="ck-wrap">
            <div className="ck-bar">
              <div className="ck-field" aria-label="Your message">{text ? <span>{text}</span> : <span className="ph">Type your own message…</span>}<i className="ck-caret" /></div>
              <button type="button" className="chat-send" onClick={() => { send(text); setText(''); }}>SEND</button>
            </div>
            <GameKeyboard onText={(fn) => setText((t) => fn(t).slice(0, 140))} onEnter={() => { send(text); setText(''); }} />
          </div>
        ) : unlocked ? (
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

/** On a phone or tablet the game draws its own keyboard inside the chat box: it turns with the game (no flipping the phone)
 *  and sits right under the text box. Computers keep using the real keyboard. */
function useOwnKeyboard() {
  return useMemo(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches && Math.min(window.screen.width, window.screen.height) <= 900, []);
}
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const NUM_ROWS = ['1234567890', '-/:;()$&@"', '.,?!\'#%+='];
function GameKeyboard({ onText, onEnter }: { onText: (fn: (t: string) => string) => void; onEnter: () => void }) {
  const [nums, setNums] = useState(false);
  const [shift, setShift] = useState(true);   // first letter capital
  const type = (ch: string) => { sfx.click(); onText((t) => t + ch); if (shift) setShift(false); };
  const rows = nums ? NUM_ROWS : KEY_ROWS;
  const show = (c: string) => (shift && !nums ? c.toUpperCase() : c);
  return (
    <div className="ck" role="group" aria-label="Keyboard">
      {rows.map((r, i) => (
        <div key={i} className={`ck-row r${i}`}>
          {i === 2 && !nums && <button type="button" className={`ck-key wide ${shift ? 'on' : ''}`} onClick={() => { sfx.click(); setShift((v) => !v); }} aria-label="Shift">⇧</button>}
          {r.split('').map((c) => <button type="button" key={c} className="ck-key" onClick={() => type(show(c))}>{show(c)}</button>)}
          {i === 2 && <button type="button" className="ck-key wide" onClick={() => { sfx.click(); onText((t) => t.slice(0, -1)); }} aria-label="Delete">⌫</button>}
        </div>
      ))}
      <div className="ck-row r3">
        <button type="button" className="ck-key wide2" onClick={() => { sfx.click(); setNums((v) => !v); }}>{nums ? 'ABC' : '123'}</button>
        <button type="button" className="ck-key space" onClick={() => type(' ')}>space</button>
        <button type="button" className="ck-key wide2 go" onClick={onEnter}>SEND</button>
      </div>
    </div>
  );
}

function Switch({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <section className="tm-sec">
      <h3>{label}</h3>
      <label className="tm-switch">
        <input type="checkbox" checked={on} onChange={() => { onToggle(); sfx.click(); }} aria-label={label} />
        <span className="ct-switch" aria-hidden="true"><i>{on ? 'ON' : 'OFF'}</i></span>
      </label>
    </section>
  );
}

function TableMenu({ onClose, onRules, onBot, onThemes, onExit, confirmLeave, bet }: {
  onClose: () => void; onRules: () => void; onBot: () => void; onThemes: () => void; onExit: () => void; confirmLeave: boolean; bet: number;
}) {
  const p = useProfile();
  const set = (k: 'sound' | 'music' | 'vibrate') => profile.set((x) => ({ settings: { ...x.settings, [k]: k === 'music' ? x.settings.music === false : !x.settings[k] } }));
  useEffect(() => { const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return (
    <div className="tm-overlay" role="dialog" aria-modal="true" aria-label="Table menu">
      <div className="tm-dim" onClick={onClose} />
      <aside className="tm-panel">
        <button className="tm-close" onClick={() => { sfx.click(); onClose(); }} aria-label="Close menu"><Icon name="close" size={26} /></button>
        <div className="tm-scroll">
          <button className="tm-btn exit" onClick={() => { sfx.click(); onExit(); }}>
            <span className="tm-ico"><Icon name="exit" size={24} /></span>{confirmLeave ? 'TAP TO CONFIRM' : 'EXIT TABLE'}
          </button>
          {confirmLeave && <p className="tm-warn">Leaving now forfeits your {fmt(bet)} coin bet.</p>}
          <div className="tm-rule" />
          <button className="tm-btn blue" onClick={() => { sfx.click(); onRules(); }}><span className="tm-ico"><Icon name="book" size={22} /></span>HOW TO PLAY</button>
          <button className="tm-btn purple" onClick={() => { sfx.click(); onBot(); }}><span className="tm-ico"><Icon name="chat" size={22} /></span>ASK SPADE BOT</button>
          <button className="tm-btn gold" onClick={() => { sfx.click(); onThemes(); }}><span className="tm-ico"><Icon name="star" size={22} /></span>TABLE & CARDS</button>
          <div className="tm-rule" />
          <Switch label="SOUND" on={p.settings.sound} onToggle={() => set('sound')} />
          <div className="tm-rule" />
          <Switch label="MUSIC" on={p.settings.music !== false} onToggle={() => set('music')} />
          <MusicPicker compact />
          <div className="tm-rule" />
          <Switch label="VIBRATION" on={p.settings.vibrate} onToggle={() => set('vibrate')} />
        </div>
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
        <p><b>Bidding.</b> Your cards are dealt face down: tap <b>See cards</b> on your turn, then bid 1–13 or <b>0 = Nil</b> (promising to win zero tricks). The game suggests a bid from your hand. Feeling brave? <b>Bid Blind Nil</b> before looking — worth ±200.</p>
        <p><b>Play.</b> Follow the suit that was led if you can. If you can't, you may play any card — a spade wins unless a higher spade is played. Spades can't be led until they've been “broken” (played on another suit), unless you have only spades.</p>
        <p><b>Scoring.</b> Make your bid: 10 × bid, plus 1 point per extra trick (a “bag”). Miss it: −10 × bid. Nil: +100 if you take no tricks, −100 if you take any (Blind Nil ±200). Every 10 bags costs 100 points.</p>
        <p><b>Winning.</b> The game ends when a side reaches the table's max points or drops to the min points. Highest score takes the prize.</p>
      </div>
    </Modal>
  );
}

export type { Card };
