// Crows Haven table. Two ways to play, same screen:
//  · against computer players in the browser (LocalTable — works offline)
//  · online with other people on the Crows Haven game server (OnlineTable — see ./online.ts and crows-server/)
// Spades' Table.tsx is not used or changed.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import './crows.css';
import {
  applyAction, createGame, startRound, legalCards, viewFor, sameCard, sideOf, partnerOf, minNextBid, canAskRedeal, sortHand,
  Card, Colour, COLOURS, COLOUR_NAME, CrowsAction, CrowsState, CrowsPublicState, RuleError, MAX_BID, MIN_BID, BID_STEP, NEST_SIZE, DEFAULT_TARGET, isCrow, suitOf, pointsOf,
} from '../../shared/crows/engine';
import type { TableInfo } from '../../shared/crows/protocol';
import { botAction, botNest, estimateBid } from '../../shared/crows/bot';
import { profile, levelFromXp, useProfile, fmt, short } from '../lib/profile';
import { Coin, Icon, Modal, Pill } from '../components/ui';
import { TableShape } from '../components/TableShape';
import { activeTheme, themeVars } from '../lib/themes';
import { chargeBet, settleGame, refundBet, prizeOf, crowsCity, notEnough } from './wallet';
import { toast } from '../lib/toast';
import { sfx } from '../lib/sound';
import { CrowCard, Emblem } from './CrowCard';
import { CrowsAvatar, PictureModal, randomPortrait, portraitName } from './CrowsExtras';
import { ChatPanel, useCrowsChat, ChatMsg } from './CrowsChat';
import { reportGame } from './CrowsRanking';
import { useOnlineTable } from './online';

const POS = ['bottom', 'left', 'top', 'right'] as const;
const BOT_DELAY = 800, TRICK_PAUSE = 1200;

function newTable(target: number = DEFAULT_TARGET, bet = 0): CrowsState {
  const p = profile.get();
  const me = { id: p.id, name: p.name || 'You', avatar: p.avatar, level: levelFromXp(p.xp), bot: false };
  // computer players always get one of the AI portraits (with the name that goes with it), never your picture
  const taken = [p.avatar];
  const bots = [0, 1, 2].map((i) => {
    const avatar = randomPortrait(taken); taken.push(avatar);
    return { id: `bot:${Date.now().toString(36)}${i}`, name: portraitName(avatar), avatar, level: 5 + Math.floor(Math.random() * 60), bot: true };
  });
  return startRound(createGame({ target, bet, city: crowsCity(bet) }, [me, bots[0], bots[1], bots[2]]));
}

/** Everything the table screen needs, from either the local game or the game server. */
interface Source {
  g: CrowsState;                 // online: the public state, with only your own hand filled in
  st: CrowsPublicState;
  me: number;
  act: (a: CrowsAction) => boolean;
  chat: { msgs: ChatMsg[]; say: (text: string) => void; bubble: (seat: number) => string | null };
  online?: {
    info: TableInfo;
    left: (at: number | null | undefined) => number | null;
    status: string;
    start: () => void;
    ready: () => void;
  };
  onAgain: () => void;
  onExit: () => void;
  /** this game, for taking the bet and paying the prize once */
  gameId: string;
}

/** Against computer players, in the browser. */
function LocalTable({ target, bet, onExit }: { target: number; bet: number; onExit: () => void }) {
  const ME = 0;
  const [gameId, setGameId] = useState(() => `local-${Date.now().toString(36)}`);
  const [g, setGState] = useState<CrowsState>(() => newTable(target, bet));
  const cur = useRef(g);
  const setG = (next: CrowsState) => { cur.current = next; setGState(next); };
  const act = (a: CrowsAction): boolean => {
    try { setG(applyAction(cur.current, a)); return true; }
    catch (e) { if (e instanceof RuleError) { toast(e.message); return false; } throw e; }
  };
  useEffect(() => {
    let t = 0;
    const live = g.phase === 'bidding' || g.phase === 'nest' || g.phase === 'playing';
    if (live && g.turn !== ME) {
      t = window.setTimeout(() => {
        if (cur.current !== g) return;
        const a = botAction(g, g.turn);
        if (a.type === 'play') sfx.card();
        if (a.type === 'redeal') toast(`${g.seats[g.turn]?.name} had no point cards — new deal`);
        setG(applyAction(g, a));
      }, g.phase === 'nest' ? BOT_DELAY * 1.6 : BOT_DELAY);
    } else if (g.phase === 'trickEnd') {
      t = window.setTimeout(() => { if (cur.current !== g) return; sfx.trick(); setG(applyAction(g, { type: 'collect' })); }, TRICK_PAUSE);
    }
    return () => clearTimeout(t);
  }, [g]);
  const chat = useCrowsChat([1, 2, 3]);
  useEffect(() => { chat.greet(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (g.phase !== 'roundEnd') return;
    const r = g.history[g.history.length - 1];
    if (r) chat.handEnded(sideOf(r.bidder), r.made);
  }, [g.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  return <TableUI src={{
    g, st: viewFor(g, ME), me: ME, act,
    chat: { msgs: chat.msgs, bubble: chat.bubble, say: (t) => { chat.say(ME, t); chat.botMaybeReply(ME); } },
    onAgain: () => { if (profile.get().coins < bet) { notEnough(bet); onExit(); return; } setGameId(`local-${Date.now().toString(36)}`); setG(newTable(target, bet)); }, onExit, gameId,
  }} />;
}

/** Online, on the Crows Haven game server. */
function OnlineTable({ tableId, onExit, onAgain, onFull }: { tableId: string; onExit: () => void; onAgain: () => void; onFull: () => void }) {
  const o = useOnlineTable(tableId);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  useEffect(() => { if (o.status === 'full') onFull(); }, [o.status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (o.error) toast(o.error.text); }, [o.error]);
  const prevChats = useRef(0);
  useEffect(() => { if (o.chats.length > prevChats.current) sfx.chat(); prevChats.current = o.chats.length; }, [o.chats.length]);
  const leave = () => { o.leave(); onExit(); };
  if (o.status === 'closed') {
    return (
      <div className="screen lobby felt-bg crows-wait-screen"><div className="modal kicked"><h2 className="modal-title">Table closed</h2><p className="center">{o.reason ?? 'This table has closed.'}</p>
        <div className="btn-row"><Pill color="green" onClick={onExit}>Back to lobby</Pill></div></div></div>
    );
  }
  if (!o.view || !o.info || o.seat < 0) {
    return <div className="screen lobby felt-bg crows-wait-screen"><div className="modal kicked"><h2 className="modal-title">Connecting…</h2><p className="center">Finding your seat at the table.</p>
      <div className="btn-row"><Pill color="blue" onClick={leave}>Cancel</Pill></div></div></div>;
  }
  const v = o.view;
  const hands = [[], [], [], []] as Card[][]; hands[o.seat] = v.hand;
  const g = { ...v, hands } as unknown as CrowsState;
  const bubble = (seat: number) => {
    for (let i = o.chats.length - 1; i >= 0; i--) if (o.chats[i].seat === seat) return now - o.chats[i].at < 4000 ? o.chats[i].text : null;
    return null;
  };
  return <TableUI src={{
    g, st: v, me: o.seat,
    act: (a) => { o.send({ t: 'act', action: a }); return true; },
    chat: { msgs: o.chats, bubble, say: (t) => o.send({ t: 'chat', text: t }) },
    online: { info: o.info, left: o.left, status: o.status, start: () => o.send({ t: 'start' }), ready: () => o.send({ t: 'ready' }) },
    onAgain: () => { o.leave(); onAgain(); }, onExit: leave, gameId: `online-${tableId}`,
  }} />;
}

export type TableMode = { kind: 'local' } | { kind: 'online'; tableId: string };

export function CrowsTable({ onExit, target = DEFAULT_TARGET, bet = 0, mode = { kind: 'local' }, onAgainOnline, onFull }: {
  onExit: () => void; target?: number; bet?: number; mode?: TableMode; onAgainOnline?: () => void; onFull?: () => void;
}) {
  if (mode.kind === 'online') return <OnlineTable key={mode.tableId} tableId={mode.tableId} onExit={onExit} onAgain={onAgainOnline ?? onExit} onFull={onFull ?? onExit} />;
  return <LocalTable target={target} bet={bet} onExit={onExit} />;
}

const secs = (ms: number | null) => (ms === null ? null : Math.ceil(ms / 1000));

/** The table screen — built like Spade Haven's table (same rail, felt, seats, panels and pop-ups), with Crows Haven's rules. */
function TableUI({ src }: { src: Source }) {
  const { g, st, act, chat, online, onExit } = src;
  const ME = src.me;
  const p = useProfile();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!online) return; const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, [online ? 1 : 0]); // eslint-disable-line react-hooks/exhaustive-deps
  void now;
  const bet = st.settings.bet ?? 0;
  /** Is this card trump right now? (the Crow always is, once trump is named) */
  const isTrump = (c: Card) => !!st.trump && (isCrow(c) || c.s === st.trump);
  // big "RED IS TRUMP" for a moment when the bidder names trump
  const [announce, setAnnounce] = useState<Colour | null>(null);
  const prevPhase = useRef(g.phase);
  useEffect(() => {
    if (prevPhase.current === 'nest' && g.phase === 'playing' && g.trump) {
      setAnnounce(g.trump);
      const t = setTimeout(() => setAnnounce(null), 2300);
      prevPhase.current = g.phase;
      return () => clearTimeout(t);
    }
    prevPhase.current = g.phase;
  }, [g.phase, g.trump]);
  // the bet is taken when the first hand is dealt (like Spade Haven)
  const dealt = st.phase !== 'waiting';
  useEffect(() => {
    if (!dealt || !bet) return;
    if (!chargeBet(src.gameId, bet)) { notEnough(bet); }
  }, [dealt, src.gameId]); // eslint-disable-line react-hooks/exhaustive-deps
  // no penalty for leaving: leaving a game before it's over gives the bet back
  const idRef = useRef(src.gameId); idRef.current = src.gameId;
  useEffect(() => () => refundBet(idRef.current), []);
  // sounds for cards other people play (online), tricks taken
  const prevTrick = useRef(st.trick.length);
  useEffect(() => { if (online && st.trick.length > prevTrick.current) sfx.card(); prevTrick.current = st.trick.length; }, [st.trick.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [menu, setMenu] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const inGame = st.phase !== 'waiting' && st.phase !== 'gameOver';
  const [chatOpen, setChatOpen] = useState(false);
  const [seenMsgs, setSeenMsgs] = useState(0);
  const unread = chatOpen ? 0 : chat.msgs.filter((m) => m.seat !== ME).length - seenMsgs;
  const [rules, setRules] = useState(false);
  const [picture, setPicture] = useState(false);
  const [picked, setPicked] = useState<Card[]>([]);
  const [trump, setTrump] = useState<Colour | null>(null);
  const rel = (seat: number) => POS[(seat - ME + 4) % 4];
  const myTurn = st.turn === ME && st.phase !== 'waiting';
  const legal = useMemo(() => legalCards(g, ME), [g, ME]);
  const choosingNest = st.phase === 'nest' && st.highBidder === ME;

  // new nest: suggest the 5 cards to put down and the trump, so one tap on the green button plays (tap cards to change)
  useEffect(() => {
    if (!choosingNest) return;
    const s = botNest(g, ME);
    setPicked(s.discard); setTrump(s.trump);
  }, [choosingNest]); // eslint-disable-line react-hooks/exhaustive-deps
  const [weekRank, setWeekRank] = useState<number | null>(null);
  const [paid, setPaid] = useState<{ prize: number; xp: number } | null>(null);
  useEffect(() => {
    if (st.phase !== 'gameOver') return;
    const won = st.winners[0] === sideOf(ME);
    (won ? sfx.win : sfx.lose)();
    setPaid(settleGame(src.gameId, bet, won));
    void reportGame(src.gameId, won, bet).then((r) => { if (r?.rank) setWeekRank(r.rank); });
  }, [st.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastBid = (seat: number) => [...st.bidLog].reverse().find((b) => b.seat === seat);

  const clickCard = (c: Card) => {
    if (choosingNest) {
      setPicked((x) => (x.some((y) => sameCard(y, c)) ? x.filter((y) => !sameCard(y, c)) : x.length >= NEST_SIZE ? x : [...x, c]));
      return;
    }
    if (st.phase !== 'playing') return;
    if (!myTurn) return toast(`Wait for your turn — ${st.seats[st.turn]?.name ?? 'another player'} is playing`);
    if (legal.some((l) => sameCard(l, c))) { sfx.card(); act({ type: 'play', seat: ME, card: c }); return; }
    const led = suitOf(st.trick[0].card, st.trump);
    toast(`Follow suit: play ${led === 'crow' ? 'trump' : `a ${COLOUR_NAME[led as Colour].toLowerCase()} card`}${led === st.trump ? ' (trump)' : ''} — or the Crow`);
  };

  const hand = st.hand;
  const n = hand.length;
  const gap = Math.min(74, 900 / Math.max(1, n));
  const takenNow = [0, 1].map((s) => pointsOf(g.taken[s]));
  const info = online?.info;
  const turnLeft = online && myTurn && (st.phase === 'bidding' || st.phase === 'nest' || st.phase === 'playing') ? secs(online.left(info!.turnAt)) : null;
  const turnPct = online && info?.turnAt && info.turnTotal ? Math.max(0, online.left(info.turnAt) ?? 0) / info.turnTotal : null;

  const seatView = (seat: number) => {
    const s = st.seats[seat];
    const pos = rel(seat);
    const team = sideOf(seat) === sideOf(ME) ? 'blue' : 'red';
    if (!s) {
      return (
        <div key={seat} className={`seat seat-${pos} team-${team} is-waiting`}>
          <div className="seat-av"><span className="q-mark">?</span></div>
        </div>
      );
    }
    const lb = lastBid(seat);
    const active = st.turn === seat && (st.phase === 'bidding' || st.phase === 'nest' || st.phase === 'playing');
    const away = !!info?.away[seat];
    let pill: React.ReactNode = '-';
    if (st.phase === 'bidding') {
      if (st.passed[seat]) pill = 'PASS';
      else if (lb?.bid) pill = lb.bid;
    } else if (st.highBidder === seat) pill = <>BID {st.highBid}</>;
    else if (lb && !lb.bid) pill = 'PASS';
    else if (lb?.bid) pill = lb.bid;
    const remain = active && turnPct !== null ? turnPct : null;
    return (
      <div key={seat} className={`seat seat-${pos} team-${team} ${active ? 'active' : ''} ${st.phase === 'waiting' ? 'is-waiting' : 'in-play'} ${away ? 'crows-away' : ''} ${st.highBidder === seat && st.phase !== 'bidding' ? 'crows-bidder' : ''}`}>
        <div className="seat-av" style={remain !== null ? { ['--pct' as string]: `${remain * 100}%` } : undefined}>
          <span className="bezel" aria-hidden="true" />
          <span className="seat-pic"><CrowsAvatar k={seat === ME ? p.avatar : s.avatar} size={pos === 'bottom' ? 112 : 106} name={s.name} /></span>
          {remain !== null && <span className="timer-ring" aria-hidden="true" />}
          {st.dealer === seat && st.phase !== 'waiting' && <span className="dealer" title="Dealer">D</span>}
        </div>
        {seat !== ME && <div className="seat-name">{s.name} <small>Lv {seat === ME ? levelFromXp(p.xp) : s.level}</small></div>}
        {away && <div className="crows-away-tag">Away · computer playing</div>}
        {st.phase !== 'waiting' && <div className={`seat-pill ${st.highBidder === seat && st.phase !== 'bidding' ? 'crows-high' : ''}`}>{pill}</div>}
        {chat.bubble(seat) && <div className="bubble">{chat.bubble(seat)}</div>}
      </div>
    );
  };

  const fillLeft = info ? secs(online!.left(info.fillAt)) : null;
  const startLeft = info ? secs(online!.left(info.startAt)) : null;
  const seatedCount = st.seats.filter(Boolean).length;
  const us = sideOf(ME), them = 1 - us;
  const bidSide = st.highBidder === null ? null : sideOf(st.highBidder);

  return (
    <div className={`screen table-screen felt-bg crows-screen ${choosingNest ? 'crows-choosing' : ''} ${st.trump ? `trump-${st.trump}` : ''} ${p.settings.bigCards ? 'big-cards' : ''}`} style={themeVars(activeTheme(p.theme, levelFromXp(p.xp)))}>
      <div className="table-scene" style={{ backgroundImage: `url(/ui/city/${crowsCity(bet).toLowerCase().replace(/\s+/g, '')}.webp)` }} aria-hidden="true" />
      <div className="tbl-top-left">
        <button className="crows-exit-btn" onClick={() => { sfx.click(); if (inGame) setConfirmExit(true); else onExit(); }} aria-label="Exit the table"><Icon name="left" size={26} /></button>
        <div className="coins-pill crows-tbl-coins"><Coin size={30} /><span className="coins-num">{fmt(p.coins)}</span></div>
      </div>
      <div className="tbl-top-right">
        <button className="round-ui" onClick={() => { sfx.click(); setChatOpen(true); }} aria-label="Open chat"><Icon name="chat" size={26} />{unread > 0 && <span className="badge">{unread}</span>}</button>
        <button className="round-ui" onClick={() => { sfx.click(); setMenu(true); }} aria-label="Menu"><Icon name="menu" size={26} /></button>
      </div>

      <div className="felt-wrap">
        <TableShape />
        <div className="felt">
          <div className="info-panel">
            <div className="ip-city">{online?.info.isPrivate ? `TABLE ${online.info.code}` : crowsCity(bet)}</div>
            <div className="ip-row"><span>PRIZE:</span><img className="ip-coins" src="/ui/lobby/coins.webp" alt="" aria-hidden="true" /><b>{short(prizeOf(bet))}</b></div>
            <div className="ip-row"><span>BET:</span><b>{short(bet)}</b></div>
            <div className="ip-end">GAME POINTS:<b>{st.settings.target}</b></div>
          </div>
          <div className="score-panel crows-score">
            <div className="sp-title crows-sp-title"><i className="rc-R" /><i className="rc-Y" /><i className="rc-G" /><i className="rc-K" />CROWS</div>
            <div className="sp-grid">
              <span className="team red">THEM</span><span className="team blue">US</span>
              <b className={st.scores[them] > st.scores[us] ? 'sp-lead' : ''}>{st.scores[them]}</b><b className={st.scores[us] > st.scores[them] ? 'sp-lead' : ''}>{st.scores[us]}</b>
              <span className="sp-lbl">PTS.</span>
              {st.phase !== 'waiting' && <>
                <b className={bidSide === them ? 'sp-bid' : ''}>{takenNow[them]}{bidSide === them && <small>/{st.highBid}</small>}</b>
                <b className={bidSide === us ? 'sp-bid' : ''}>{takenNow[us]}{bidSide === us && <small>/{st.highBid}</small>}</b>
                <span className="sp-lbl">{bidSide === null ? 'THIS HAND' : 'THIS HAND / BID'}</span>
              </>}
            </div>
            <div className={`crows-sp-trump ${st.trump ? `rc-${st.trump} on` : ''}`} title={st.trump ? `${COLOUR_NAME[st.trump]} is trump` : 'No trump yet'}>
              {st.trump ? <><Emblem s={st.trump} size={30} /><span>TRUMP</span></> : <span>NEST {st.nestCount}</span>}
            </div>
          </div>
          <div className="felt-center">
            {st.phase === 'waiting' && info && startLeft !== null && (
              <div className="center-msg" role="timer"><b>GAME WILL START IN</b><span className="cm-big" key={startLeft}>{Math.max(1, startLeft)}</span></div>
            )}
            {st.phase === 'waiting' && info && startLeft === null && (
              <div className="waiting">
                <div className="waiting-text">WAITING FOR PLAYERS<span className="dots3"><i>.</i><i>.</i><i>.</i></span></div>
                <div className="waiting-actions">
                  {fillLeft !== null && (info.filling || !info.isPrivate)
                    ? <span className="fill-wait" role="timer">{info.filling ? 'Computer players are joining' : `Waiting for player ${seatedCount + 1}`} · next one sits down in {fillLeft}s</span>
                    : <span className="fill-wait">Waiting for friends to join · {seatedCount} of 4 seats taken</span>}
                  {!info.filling && <button className="fill-now" onClick={() => { sfx.click(); online!.start(); }}>{info.isPrivate ? 'Fill with bots' : 'Start now'}</button>}
                </div>
                {info.isPrivate && info.code && (
                  <div className="invite">
                    <button className="code" onClick={() => { navigator.clipboard?.writeText(info.code!).then(() => toast('Table code copied'), () => toast(`Table code: ${info.code}`)); }} aria-label={`Copy table code ${info.code}`}>Code {info.code} <Icon name="copy" size={18} /></button>
                  </div>
                )}
              </div>
            )}
            {st.phase === 'bidding' && !myTurn && <div className="center-msg"><b>CHOOSE YOUR BID</b><span className="cm-name">{st.seats[st.turn]?.name}</span></div>}
            {st.phase === 'nest' && !choosingNest && <div className="center-msg"><b>TAKING THE NEST</b><span className="cm-name">{st.seats[st.highBidder!]?.name} · {st.highBid}</span></div>}
            <div className="trick">
              {st.trick.map((t) => <CrowCard key={`${st.round}-${t.card.s}${t.card.r}`} card={t.card} trump={isTrump(t.card)} className={`tcard crows-tin at-${rel(t.seat)}`} />)}
            </div>
            {st.phase === 'trickEnd' && st.lastTrickWinner !== null && (() => {
              const pts = pointsOf(st.trick.map((t) => t.card));
              const ours = sideOf(st.lastTrickWinner!) === us;
              const who = st.lastTrickWinner === ME ? 'You' : st.seats[st.lastTrickWinner!]?.name ?? '';
              return <div className={`crows-pop ${ours ? 'us' : 'them'}`}>{pts > 0 ? `+${pts}` : '0'}<small>{who}</small></div>;
            })()}
            {st.phase === 'playing' && st.trick.length === 0 && myTurn && <div className="status-line you">Your lead</div>}
          </div>
          {announce && (
            <div className={`crows-announce rc-${announce}`} role="alert">
              <Emblem s={announce} size={72} />
              <b>{COLOUR_NAME[announce].toUpperCase()} IS TRUMP</b>
              <small>{st.highBidder === ME ? 'You' : st.seats[st.highBidder!]?.name} named trump · bid {st.highBid}</small>
            </div>
          )}
        </div>
        {[0, 1, 2, 3].map((k) => seatView((ME + k) % 4))}
      </div>

      <div className="fan crows-fan">
        {hand.map((c, i) => {
          const off = i - (n - 1) / 2;
          const pos = { ['--x' as string]: `${off * gap}px`, ['--y' as string]: `${off * off * 1.2}px`, ['--r' as string]: `${off * 2.2}deg`, ['--i' as string]: i, zIndex: i } as React.CSSProperties;
          const ok = myTurn && st.phase === 'playing' && legal.some((l) => sameCard(l, c));
          const isPicked = picked.some((x) => sameCard(x, c));
          const cls = choosingNest ? `pick ${isPicked ? 'picked' : ''}` : `${ok ? 'legal' : ''} ${myTurn && st.phase === 'playing' && !ok ? 'dim' : ''}`;
          return <CrowCard key={`${st.round}-${c.s}${c.r}`} card={c} style={pos} className={`hcard deal ${cls}`} trump={isTrump(c)} onClick={() => clickCard(c)} />;
        })}
      </div>
      {turnLeft !== null && <div className={`turn-clock ${turnLeft <= 5 ? 'hurry' : ''}`} role="timer">Your turn · {turnLeft}s</div>}
      {online && online.status === 'lost' && <div className="conn-banner" role="status"><span className="conn-spin" aria-hidden="true" /> Connection lost — reconnecting… a computer player keeps your seat warm</div>}

      {st.phase === 'bidding' && myTurn && <BidDialog g={g} me={ME} onAct={act} secsLeft={turnLeft} />}
      {choosingNest && (
        <NestDialog picked={picked} trump={trump} hand={g.hands[ME]} bid={st.highBid!} forced={st.forced}
          onTrump={setTrump} onConfirm={() => { if (trump && act({ type: 'nest', seat: ME, discard: picked, trump })) setPicked([]); }} />
      )}
      {st.phase === 'roundEnd' && <RoundSummary g={g} me={ME} avatar={p.avatar}
        online={online ? { waiting: !!info!.ready[ME], left: secs(online.left(info!.nextAt)) } : undefined}
        onNext={() => (online ? online.ready() : act({ type: 'nextRound' }))} />}
      {st.phase === 'gameOver' && <GameOver g={g} me={ME} bet={bet} paid={paid} weekRank={weekRank} onAgain={() => { setWeekRank(null); setPaid(null); src.onAgain(); }} onLobby={onExit} />}
      {menu && (
        <div className="tm-overlay" role="dialog" aria-modal="true" aria-label="Table menu">
          <div className="tm-dim" onClick={() => setMenu(false)} />
          <aside className="tm-panel">
            <button className="tm-close" onClick={() => { sfx.click(); setMenu(false); }} aria-label="Close menu"><Icon name="close" size={26} /></button>
            <div className="tm-scroll">
              <button className="tm-btn exit" onClick={() => { sfx.click(); setMenu(false); if (inGame) setConfirmExit(true); else onExit(); }}>
                <span className="tm-ico"><Icon name="exit" size={24} /></span>EXIT TABLE
              </button>
              <div className="tm-rule" />
              <button className="tm-btn blue" onClick={() => { sfx.click(); setMenu(false); setRules(true); }}><span className="tm-ico"><Icon name="book" size={22} /></span>HOW TO PLAY</button>
              <button className="tm-btn purple" onClick={() => { sfx.click(); setMenu(false); setPicture(true); }}><span className="tm-ico"><Icon name="users" size={22} /></span>MY PICTURE</button>
              <div className="tm-rule" />
              <TmSwitch label="SOUND" on={p.settings.sound} onToggle={() => profile.set((x) => ({ settings: { ...x.settings, sound: !x.settings.sound } }))} />
              <TmSwitch label="VIBRATION" on={p.settings.vibrate} onToggle={() => profile.set((x) => ({ settings: { ...x.settings, vibrate: !x.settings.vibrate } }))} />
              <TmSwitch label="BIGGER CARDS" on={!!p.settings.bigCards} onToggle={() => profile.set((x) => ({ settings: { ...x.settings, bigCards: !x.settings.bigCards } }))} />
            </div>
          </aside>
        </div>
      )}
      {confirmExit && (
        <Modal title="Leave this game?" onClose={() => setConfirmExit(false)}>
          <p className="center">{online ? 'A computer player will take your seat so the others can keep playing.' : 'This game will end.'}{bet > 0 && <> You get your {fmt(bet)} coin bet back.</>}</p>
          <div className="btn-row">
            <Pill color="red" onClick={onExit}>Yes, leave</Pill>
            <Pill color="green" onClick={() => setConfirmExit(false)}>Keep playing</Pill>
          </div>
        </Modal>
      )}
      {rules && <CrowsRules onClose={() => setRules(false)} />}
      {picture && <PictureModal onClose={() => setPicture(false)} />}
      {chatOpen && (
        <ChatPanel msgs={chat.msgs} me={ME} names={st.seats.map((x) => x?.name ?? '')}
          onSend={(t) => { chat.say(t); setChatOpen(false); setSeenMsgs(chat.msgs.filter((m) => m.seat !== ME).length); }}
          onClose={() => { setChatOpen(false); setSeenMsgs(chat.msgs.filter((m) => m.seat !== ME).length); }} />
      )}
    </div>
  );
}

function TmSwitch({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
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

function BidDialog({ g, me: ME, onAct, secsLeft }: { g: CrowsState; me: number; onAct: (a: CrowsAction) => boolean; secsLeft: number | null }) {
  const need = minNextBid(g);
  const sug = estimateBid(g.hands[ME]);
  const partnerHigh = g.highBidder === partnerOf(ME);
  const us = sideOf(ME);
  const tiles = [];
  for (let b = MIN_BID; b <= MAX_BID; b += BID_STEP) tiles.push(b);
  const sugTile = sug >= need ? Math.min(MAX_BID, Math.max(need, Math.floor(sug / BID_STEP) * BID_STEP)) : null;
  return (
    <div className="dlg bid-dlg crows-bid" role="dialog" aria-label="Select your bid">
      <div className="dlg-title">SELECT YOUR BID{secsLeft !== null && <span className={`bid-clock ${secsLeft <= 4 ? 'hurry' : ''}`}> {secsLeft}s</span>}</div>
      <div className="bd-pts">
        <span className="bd-box red"><em>THEM</em><b>{g.scores[1 - us]}</b></span>
        <span className="bd-box blue"><em>US</em><b>{g.scores[us]}</b></span>
      </div>
      <div className="bd-grid">
        {tiles.map((b) => <button key={b} disabled={b < need} className={`bd-tile ${b === sugTile ? 'sug' : ''}`} onClick={() => { sfx.click(); onAct({ type: 'bid', seat: ME, bid: b }); }} aria-label={`Bid ${b}`}>{b}</button>)}
        <button className="bd-tile crows-pass" onClick={() => { sfx.click(); onAct({ type: 'pass', seat: ME }); }}>PASS</button>
      </div>
      <div className="bd-hint">
        {g.highBid === null ? <>No bids yet — the opening bid is <b>{MIN_BID}</b></> : <>High bid <b>{g.highBid}</b> by {g.highBidder === ME ? 'you' : partnerHigh ? 'your partner' : g.seats[g.highBidder!]?.name}</>}
        {' '}· Your hand is good for about <b>{sug < MIN_BID ? 'a pass' : sug}</b>
        {canAskRedeal(g, ME) && <> · <button className="crows-link" onClick={() => onAct({ type: 'redeal', seat: ME })}>No point cards? Ask for a new deal</button></>}
      </div>
    </div>
  );
}

function NestDialog({ picked, trump, hand, bid, forced, onTrump, onConfirm }: {
  picked: Card[]; trump: Colour | null; hand: Card[]; bid: number; forced: boolean; onTrump: (c: Colour) => void; onConfirm: () => void;
}) {
  const ready = picked.length === NEST_SIZE && trump !== null;
  const lostPts = pointsOf(picked);
  const pickedTrump = picked.some((c) => isCrow(c) || c.s === trump);
  return (
    <div className="dlg crows-nest-dlg" role="dialog" aria-label="The nest">
      <div className="dlg-title">{forced ? `EVERYONE PASSED — YOU BID ${bid}` : `YOU WON THE BID AT ${bid}`}</div>
      <p className="crows-dlg-text">The 5 nest cards are in your hand. We lifted <b>5 cards to put down</b> ({picked.length}/5) — tap cards to swap them, pick trump, then press the green button.
        {lostPts > 0 && <> Put-down points ({lostPts}) go to whoever wins the last trick.</>}
        {pickedTrump && <> <b>Careful:</b> you're putting down trump.</>}</p>
      <div className="crows-suits">
        {COLOURS.map((c) => (
          <button key={c} className={`rc-${c} ${trump === c ? 'on' : ''}`} onClick={() => { sfx.click(); onTrump(c); }} aria-pressed={trump === c}>
            <Emblem s={c} size={34} /><span>{COLOUR_NAME[c]}</span><small>×{hand.filter((h) => h.s === c && !picked.some((x) => sameCard(x, h))).length}</small>
          </button>
        ))}
      </div>
      <div className="btn-row"><Pill color="green" disabled={!ready} onClick={onConfirm}>{trump ? `PLAY · ${COLOUR_NAME[trump].toUpperCase()} TRUMP` : 'PICK TRUMP'}</Pill></div>
    </div>
  );
}

function RoundSummary({ g, me: ME, avatar, onNext, online }: { g: CrowsState; me: number; avatar: string; onNext: () => void; online?: { waiting: boolean; left: number | null } }) {
  const r = g.history[g.history.length - 1];
  const us = sideOf(ME), them = 1 - us;
  const [localLeft, setLeft] = useState(20);
  const done = useRef(false);
  useEffect(() => { if (online) return; const t = setInterval(() => setLeft((s) => s - 1), 1000); return () => clearInterval(t); }, [online ? 1 : 0]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!online && localLeft <= 0 && !done.current) { done.current = true; onNext(); } }, [localLeft, onNext, online]);
  const left = online ? online.left ?? 0 : localLeft;
  const bidOf = (seat: number) => {
    if (r.bidder === seat) return r.bid;
    const b = [...g.bidLog].reverse().find((x) => x.seat === seat);
    return b?.bid ? b.bid : 'PASS';
  };
  const lead = g.scores[us] === g.scores[them] ? null : g.scores[us] > g.scores[them] ? 'blue' : 'red';
  const row = (side: number) => ({
    bid: sideOf(r.bidder) === side ? r.bid : '-',
    taken: r.points[side],
    nest: r.nestSide === side ? r.nestPoints : 0,
    round: `${r.delta[side] > 0 ? '+' : ''}${r.delta[side]}`,
    total: g.scores[side],
  });
  const R = row(them), B = row(us);
  const ROWS: [keyof ReturnType<typeof row>, string][] = [['bid', 'BID'], ['taken', 'POINTS TAKEN'], ['nest', 'NEST POINTS'], ['round', 'THIS HAND'], ['total', 'TOTAL POINTS']];
  const team = (side: number, color: 'red' | 'blue') => (
    <div className={`rs-team ${color}`}>
      <div className={`rs-team-head ${lead === color ? 'lead' : ''}`}>{lead === color && <span className="rs-crown" aria-hidden="true">★</span>}{color === 'blue' ? 'US' : 'THEM'}</div>
      <div className="rs-players">
        {[side, side + 2].map((s) => (
          <div key={s} className="rs-player">
            <span className="rs-pic"><CrowsAvatar k={s === ME ? avatar : g.seats[s]?.avatar ?? 'a1'} size={84} name={g.seats[s]?.name} /></span>
            <span className="rs-pname">{s === ME ? 'You' : g.seats[s]?.name}</span>
            <span className={`rs-cell ${r.bidder === s ? 'crows-rs-bidder' : ''}`}>{bidOf(s)}</span>
          </div>
        ))}
      </div>
      {color === 'blue' && (online?.waiting
        ? <button className="rs-continue" disabled>WAITING…</button>
        : <button className="rs-continue" onClick={() => { sfx.click(); onNext(); }}>CONTINUE</button>)}
    </div>
  );
  return (
    <div className="modal-backdrop soft">
      <div className="rs crows-rs" role="dialog" aria-label="Hand summary">
        {team(them, 'red')}
        <div className="rs-center">
          <div className="rs-title">HAND {g.round}</div>
          <div className="rs-vs">
            <div className="rs-sc red"><b>{g.scores[them]}</b></div>
            <span className="rs-vs-badge">VS</span>
            <div className="rs-sc blue"><b>{g.scores[us]}</b></div>
          </div>
          <div className={`rs-hand crows-verdict ${r.made ? 'made' : 'set'}`}>{sideOf(r.bidder) === us ? 'US' : 'THEM'} · BID {r.bid} · {r.made ? 'MADE IT' : 'SET'}</div>
          <table className="rs-table">
            <tbody>
              {ROWS.map(([k, l]) => (
                <tr key={k} className={k === 'round' || k === 'total' ? 'strong' : ''}>
                  <td className="v red">{R[k]}</td><td className="rs-lbl">{l}</td><td className="v blue">{B[k]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="crows-rs-nest" aria-label="The put-down cards">
            <span>{COLOUR_NAME[r.trump]} was trump · put-down cards:</span>
            <div>{sortHand(g.nest).map((c, i) => <CrowCard key={i} card={c} className="small" />)}</div>
          </div>
          <div className="rs-note">{online?.waiting ? `WAITING FOR THE OTHERS · ${Math.max(0, left)}s` : `PRESS "CONTINUE" — NEXT HAND IN ${Math.max(0, left)}s`}</div>
        </div>
        {team(us, 'blue')}
      </div>
    </div>
  );
}

const GAME_OVER_SECONDS = 15;
function GameOver({ g, me: ME, bet, paid, weekRank, onAgain, onLobby }: { g: CrowsState; me: number; bet: number; paid: { prize: number; xp: number } | null; weekRank: number | null; onAgain: () => void; onLobby: () => void }) {
  const won = g.winners[0] === sideOf(ME);
  const us = sideOf(ME);
  const [left, setLeft] = useState(GAME_OVER_SECONDS);
  const lobbyRef = useRef(onLobby); lobbyRef.current = onLobby;
  useEffect(() => { const t = window.setInterval(() => setLeft((x) => x - 1), 1000); return () => window.clearInterval(t); }, []);
  useEffect(() => { if (left === 0) lobbyRef.current(); }, [left]);
  const sides = [us, 1 - us].sort((a, b) => g.scores[b] - g.scores[a]);
  const names = (side: number) => [side, side + 2].map((s) => (s === ME ? 'You' : g.seats[s]?.name)).join(' & ');
  return (
    <div className="modal-backdrop">
      <div className={`modal gameover ${won ? 'win' : 'lose'}`} role="dialog" aria-label="Game over">
        <img className="go-art" src={won ? '/ui/go-win.webp' : '/ui/go-lose.webp'} alt="" aria-hidden="true" draggable={false} />
        <div className="go-title">{won ? 'VICTORY!' : 'DEFEAT'}</div>
        {paid && paid.prize > 0 && <div className="go-prize"><Coin size={44} /> +{fmt(paid.prize)}</div>}
        {!won && bet > 0 && <p className="center muted">Your {fmt(bet)} coin bet went to the winners.</p>}
        {weekRank !== null && <p className="center gold-text">You're #{weekRank} in this week's ranking</p>}
        <ol className="go-places">
          {sides.map((side, i) => (
            <li key={side} className={side === us ? 'me' : ''}><span>{i + 1}.</span><span className="grow">{names(side)}</span><b>{g.scores[side]}</b></li>
          ))}
        </ol>
        <p className="muted small">+{paid?.xp ?? 0} XP · Level {levelFromXp(profile.get().xp)} · {g.history.length} hands</p>
        <div className="btn-row">
          <Pill color="blue" onClick={onLobby}>Lobby</Pill>
          <Pill color="green" onClick={onAgain}>Play again</Pill>
        </div>
        {left > 0 && <p className="muted small go-count">Back to the lobby in {left}s</p>}
      </div>
    </div>
  );
}

export function CrowsRules({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How to play Crows Haven" onClose={onClose} wide>
      <CrowsRulesBody />
    </Modal>
  );
}

/** The rules text, shared by the table's rules window and the Crows Haven welcome page. */
export function CrowsRulesBody() {
  return (
    <div className="crows-rules">
        <h4>The deck</h4>
        <ul><li>45 cards: four coloured suits — Red, Yellow, Green and Black — each with 5 to 14 and a 1, plus the Crow.</li>
          <li>In each suit the 1 is the highest card, then 14, 13 and down to 5.</li>
          <li>Point cards: every 1 is worth 15, every 10 and 14 is worth 10, every 5 is worth 5, and the Crow is worth 20 — 180 in all.</li></ul>
        <h4>Bidding</h4>
        <ul><li>You and the player opposite are partners. Each player gets 10 cards; 5 go face down to the nest.</li>
          <li>The dealer bids first. Bids are 100 to 180 in steps of 5 — the points your side promises to take. Once you pass, you're out of the bidding.</li>
          <li>If everyone passes, the dealer must take it at 100. A hand with no point cards may ask for a new deal.</li></ul>
        <h4>The nest and trump</h4>
        <ul><li>The high bidder picks up the nest, puts any 5 cards back down, and names the trump suit.</li>
          <li>Whoever wins the last trick also wins the put-down cards and their points.</li></ul>
        <h4>Playing</h4>
        <ul><li>The bidder leads first. Follow the suit led if you can; if you can't, play anything.</li>
          <li>The highest trump wins the trick; otherwise the highest card of the suit led wins.</li>
          <li>The Crow is the highest trump. You may play it on any trick, even when you could follow. You must play it if trump is led and it's your only trump.</li></ul>
        <h4>Scoring</h4>
        <ul><li>If the bidding side takes at least its bid, it scores every point it took. If not, it loses the amount it bid.</li>
          <li>The other side always scores what it took. The first side to reach the game points wins — you choose 300, 400 or 500 before you play.</li></ul>
      </div>
  );
}
