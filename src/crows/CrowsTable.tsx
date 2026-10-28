// Crows Haven table: you (seat 0) and your partner (seat 2) against two computer players.
// Version one runs in the browser only (no server, no coins). Spades' Table.tsx is not used or changed.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import './crows.css';
import {
  applyAction, createGame, startRound, legalCards, viewFor, sameCard, sideOf, partnerOf, minNextBid, canAskRedeal, sortHand,
  Card, Colour, COLOURS, COLOUR_NAME, CrowsAction, CrowsState, RuleError, MAX_BID, MIN_BID, BID_STEP, NEST_SIZE, DEFAULT_TARGET, isCrow, suitOf, pointsOf,
} from '../../shared/crows/engine';
import { botAction, bestTrump, estimateBid } from '../../shared/crows/bot';
import { profile, levelFromXp, useProfile } from '../lib/profile';
import { Avatar, Icon, Modal, Pill } from '../components/ui';
import { toast } from '../lib/toast';
import { sfx } from '../lib/sound';
import { CrowCard, Emblem } from './CrowCard';
import { CrowsAvatar, PictureModal, randomPortrait, portraitName } from './CrowsExtras';
import { ChatPanel, useCrowsChat } from './CrowsChat';
import { reportGame } from './CrowsRanking';

const ME = 0;
const POS = ['bottom', 'left', 'top', 'right'] as const;
const BOT_DELAY = 800, TRICK_PAUSE = 1200;

function newTable(): CrowsState {
  const p = profile.get();
  const me = { id: p.id, name: p.name || 'You', avatar: p.avatar, level: levelFromXp(p.xp), bot: false };
  // computer players always get one of the AI portraits (with the name that goes with it), never your picture
  const taken = [p.avatar];
  const bots = [0, 1, 2].map((i) => {
    const avatar = randomPortrait(taken); taken.push(avatar);
    return { id: `bot:${Date.now().toString(36)}${i}`, name: portraitName(avatar), avatar, level: 5 + Math.floor(Math.random() * 60), bot: true };
  });
  return startRound(createGame({ target: DEFAULT_TARGET, city: 'Crows Haven' }, [me, bots[0], bots[1], bots[2]]));
}

/** Runs one local game: applies your actions and lets the computer players act after a short pause. */
function useCrowsGame() {
  const [g, setGState] = useState<CrowsState>(newTable);
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
  return { g, act, restart: () => setG(newTable()) };
}

export function CrowsTable({ onExit }: { onExit: () => void }) {
  const { g, act, restart } = useCrowsGame();
  const st = viewFor(g, ME);
  const myAvatar = useProfile().avatar;
  const [menu, setMenu] = useState(false);
  const chat = useCrowsChat([1, 2, 3]);
  const [chatOpen, setChatOpen] = useState(false);
  const [seenMsgs, setSeenMsgs] = useState(0);
  useEffect(() => { chat.greet(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (g.phase !== 'roundEnd') return;
    const r = g.history[g.history.length - 1];
    if (r) chat.handEnded(sideOf(r.bidder), r.made);
  }, [g.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  const unread = chatOpen ? 0 : chat.msgs.filter((m) => m.seat !== ME).length - seenMsgs;
  const [rules, setRules] = useState(false);
  const [picture, setPicture] = useState(false);
  const [picked, setPicked] = useState<Card[]>([]);
  const [trump, setTrump] = useState<Colour | null>(null);
  const rel = (seat: number) => POS[(seat - ME + 4) % 4];
  const myTurn = st.turn === ME;
  const legal = useMemo(() => legalCards(g, ME), [g]);
  const choosingNest = st.phase === 'nest' && st.highBidder === ME;

  // new nest: clear picks and suggest trump
  useEffect(() => { if (choosingNest) { setPicked([]); setTrump(bestTrump(g.hands[ME])); } }, [choosingNest]); // eslint-disable-line react-hooks/exhaustive-deps
  const [weekRank, setWeekRank] = useState<number | null>(null);
  useEffect(() => {
    if (st.phase !== 'gameOver') return;
    const won = st.winners[0] === sideOf(ME);
    (won ? sfx.win : sfx.lose)();
    void reportGame(won, st.scores[sideOf(ME)]).then((r) => { if (r?.rank) setWeekRank(r.rank); });
  }, [st.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastBid = (seat: number) => [...st.bidLog].reverse().find((b) => b.seat === seat);

  const clickCard = (c: Card) => {
    if (choosingNest) {
      setPicked((p) => (p.some((x) => sameCard(x, c)) ? p.filter((x) => !sameCard(x, c)) : p.length >= NEST_SIZE ? p : [...p, c]));
      return;
    }
    if (st.phase !== 'playing') return;
    if (!myTurn) return toast(`Wait for your turn — ${st.seats[st.turn]?.name ?? 'another player'} is playing`);
    if (legal.some((l) => sameCard(l, c))) { sfx.card(); act({ type: 'play', seat: ME, card: c }); return; }
    const led = suitOf(st.trick[0].card, st.trump);
    toast(`Follow ${led === 'crow' ? 'trump' : COLOUR_NAME[led as Colour]}${led === st.trump ? ' (trump)' : ''} — or play the Crow`);
  };

  const hand = st.hand;
  const n = hand.length;
  const gap = Math.min(78, 820 / Math.max(1, n));
  const bidSide = st.highBidder === null ? null : sideOf(st.highBidder);
  const takenNow = [0, 1].map((s) => pointsOf(g.taken[s]));

  const seatView = (seat: number) => {
            const s = st.seats[seat]; if (!s) return null;
            const pos = rel(seat);
            const lb = lastBid(seat);
            const active = st.turn === seat && (st.phase === 'bidding' || st.phase === 'nest' || st.phase === 'playing');
            const team = sideOf(seat) === sideOf(ME) ? 'blue' : 'red';
            let pill: React.ReactNode = null, pillCls = '';
            if (st.phase === 'bidding') {
              if (st.passed[seat]) { pill = 'PASS'; pillCls = 'pass'; }
              else if (lb?.bid) { pill = lb.bid; pillCls = st.highBidder === seat ? 'high' : ''; }
            } else if (st.highBidder === seat) { pill = `BID ${st.highBid}`; pillCls = 'high'; }
            return (
              <div key={seat} className={`seat seat-${pos} team-${team} ${active ? 'active' : ''} in-play`}>
                <div className="seat-av">
                  <span className="bezel" aria-hidden="true" />
                  <CrowsAvatar k={seat === ME ? myAvatar : s.avatar} size={pos === 'bottom' ? 108 : 104} name={s.name} />
                  {st.dealer === seat && <span className="dealer" title="Dealer">D</span>}
                </div>
                <div className="seat-name">{seat === ME ? 'You' : s.name}{seat === partnerOf(ME) && <small> · partner</small>}</div>
                {pill !== null && <div className={`crows-pill ${pillCls}`}>{pill}</div>}
                {chat.bubble(seat) && <div className="bubble">{chat.bubble(seat)}</div>}
              </div>
            );
  };

  return (
    <div className="screen table-screen crows-screen felt-bg">
      <div className="crows-title"><CrowMark /> CROWS HAVEN <span className="crows-practice">Practice · no coins</span></div>
      <div className="tbl-top-right">
        <button className="round-ui" onClick={() => { sfx.click(); setChatOpen(true); }} aria-label="Open chat"><Icon name="chat" size={26} />{unread > 0 && <span className="badge">{unread}</span>}</button>
        <button className="round-ui" onClick={() => { sfx.click(); setMenu(true); }} aria-label="Menu"><Icon name="menu" size={26} /></button>
      </div>

      <div className="felt-wrap">
        <div className="crows-oval" aria-hidden="true" />
        <div className="felt">
          {[1, 2, 3].map((seat) => seatView((ME + seat) % 4))}

          <div className="crows-panel left">
            <h3>THIS HAND</h3>
            <div className="crows-info-row"><span>BID</span><b>{st.highBid ?? '—'}{st.highBidder !== null && <small> · {st.highBidder === ME ? 'you' : sideOf(st.highBidder) === sideOf(ME) ? 'partner' : 'them'}</small>}</b></div>
            <div className="crows-info-row"><span>TRUMP</span>{st.trump ? <span className={`crows-trump c-${st.trump}`}><Emblem s={st.trump} size={18} /> {COLOUR_NAME[st.trump]}</span> : <b>—</b>}</div>
            <div className="crows-info-row"><span>NEST</span><b>{st.phase === 'bidding' ? `${st.nestCount} cards` : st.phase === 'nest' ? 'with bidder' : 'last trick'}</b></div>
          </div>
          <div className="crows-panel right">
            <h3>SCORE · TO {st.settings.target}</h3>
            <div className="crows-scores">
              <span className="us">US</span><span className="them">THEM</span>
              <b>{st.scores[sideOf(ME)]}</b><b>{st.scores[1 - sideOf(ME)]}</b>
            </div>
            {(st.phase === 'playing' || st.phase === 'trickEnd') && st.highBidder !== null && (() => {
              const us = sideOf(ME), them = 1 - us, bs = sideOf(st.highBidder!);
              const have = takenNow[bs], need = st.highBid!;
              const made = have >= need;
              return (
                <div className="crows-live" aria-live="polite">
                  <div className="cl-label">POINTS THIS HAND</div>
                  <div className="crows-scores live">
                    <b className={bs === us ? 'bidder' : ''}>{takenNow[us]}</b><b className={bs === them ? 'bidder' : ''}>{takenNow[them]}</b>
                  </div>
                  <div className={`cl-bar ${made ? 'made' : ''}`} title={`${bs === us ? 'Your side' : 'Their side'} bid ${need}`}>
                    <i style={{ width: `${Math.min(100, (have / need) * 100)}%` }} />
                    <span>{bs === us ? 'US' : 'THEM'} {have} / {need}{made ? ' ✓' : ''}</span>
                  </div>
                  <small>+ {st.nestCount} put-down cards go to the last trick</small>
                </div>
              );
            })()}
          </div>

          <div className="felt-center">
            {st.phase === 'bidding' && !myTurn && <div className="crows-msg">BIDDING<small>{st.seats[st.turn]?.name} is thinking…{st.highBid ? ` High bid ${st.highBid}.` : ''}</small></div>}
            {st.phase === 'nest' && !choosingNest && <div className="crows-msg">THE NEST<small>{st.seats[st.highBidder!]?.name} took the nest at {st.highBid} and is choosing trump…</small></div>}
            {st.phase === 'playing' && st.trick.length === 0 && myTurn && <div className="crows-msg">YOUR LEAD</div>}
          </div>
          <div className="crows-trick">
            {st.trick.map((t) => <CrowCard key={`${st.round}-${t.card.s}${t.card.r}`} card={t.card} className={`at-${rel(t.seat)}`} />)}
            {st.phase === 'trickEnd' && st.lastTrickWinner !== null && (() => {
              const pts = pointsOf(st.trick.map((t) => t.card));
              const ours = sideOf(st.lastTrickWinner!) === sideOf(ME);
              const who = st.lastTrickWinner === ME ? 'You' : st.seats[st.lastTrickWinner!]?.name ?? '';
              return <div className={`crows-pop ${ours ? 'us' : 'them'} to-${rel(st.lastTrickWinner!)}`}>{pts > 0 ? `+${pts}` : '0'}<small>{who}</small></div>;
            })()}
          </div>
        </div>
      </div>

      <div className="cfan">
        {hand.map((c, i) => {
          const off = i - (n - 1) / 2;
          const pos = { ['--x' as string]: `${off * gap}px`, ['--y' as string]: `${off * off * 1.1}px`, ['--r' as string]: `${off * 2}deg`, ['--i' as string]: i, zIndex: i } as React.CSSProperties;
          const ok = myTurn && st.phase === 'playing' && legal.some((l) => sameCard(l, c));
          const isPicked = picked.some((x) => sameCard(x, c));
          const cls = choosingNest ? `pick ${isPicked ? 'picked' : ''}` : `${ok ? 'legal' : ''} ${myTurn && st.phase === 'playing' && !ok ? 'dim' : ''}`;
          return <CrowCard key={`${st.round}-${c.s}${c.r}`} card={c} style={pos} className={cls} onClick={() => clickCard(c)} />;
        })}
      </div>
      <div className="crows-me">{seatView(ME)}</div>

      {st.phase === 'bidding' && myTurn && <BidDialog g={g} onAct={act} />}
      {choosingNest && (
        <NestDialog picked={picked} trump={trump} hand={g.hands[ME]} bid={st.highBid!} forced={st.forced}
          onTrump={setTrump} onConfirm={() => { if (trump && act({ type: 'nest', seat: ME, discard: picked, trump })) setPicked([]); }} />
      )}
      {st.phase === 'roundEnd' && <RoundSummary g={g} onNext={() => act({ type: 'nextRound' })} />}
      {st.phase === 'gameOver' && <GameOver g={g} weekRank={weekRank} onAgain={() => { setWeekRank(null); restart(); }} onLobby={onExit} />}
      {menu && (
        <Modal title="Menu" onClose={() => setMenu(false)}>
          <div className="btn-row" style={{ flexDirection: 'column', gap: 10 }}>
            <Pill color="blue" onClick={() => { setMenu(false); setRules(true); }}>How to play Crows Haven</Pill>
            <Pill color="purple" onClick={() => { setMenu(false); setPicture(true); }}>Change my picture</Pill>
            <Pill color="red" onClick={onExit}>Leave table</Pill>
          </div>
        </Modal>
      )}
      {rules && <CrowsRules onClose={() => setRules(false)} />}
      {picture && <PictureModal onClose={() => setPicture(false)} />}
      {chatOpen && (
        <ChatPanel msgs={chat.msgs} me={ME} names={st.seats.map((x) => x?.name ?? '')}
          onSend={(t) => { chat.say(ME, t); chat.botMaybeReply(ME); setChatOpen(false); setSeenMsgs(chat.msgs.filter((m) => m.seat !== ME).length); }}
          onClose={() => { setChatOpen(false); setSeenMsgs(chat.msgs.filter((m) => m.seat !== ME).length); }} />
      )}
    </div>
  );
}

function CrowMark() {
  return <svg width="34" height="34" viewBox="0 0 100 100" aria-hidden="true"><path fill="#f3e6c4" d="M70 30c-4-6-12-8-18-4-5 3-7 8-7 13-8 1-17 7-21 16l-7 2 8 3c1 5 6 9 13 10l-4 9h4l5-8h7l-2 8h4l3-9c9-2 15-9 15-18 0-5-2-9-5-12l10-3-10-1c0-2 1-4 0-6z" /></svg>;
}

function BidDialog({ g, onAct }: { g: CrowsState; onAct: (a: CrowsAction) => boolean }) {
  const need = minNextBid(g);
  const sug = estimateBid(g.hands[ME]);
  const partnerHigh = g.highBidder === partnerOf(ME);
  const tiles = [];
  for (let b = MIN_BID; b <= MAX_BID; b += BID_STEP) tiles.push(b);
  return (
    <div className="crows-dlg" role="dialog" aria-label="Your bid">
      <h2>YOUR BID</h2>
      <p>
        {g.highBid === null ? `No bids yet — opening bid is ${MIN_BID}.` : `High bid ${g.highBid} by ${g.highBidder === ME ? 'you' : partnerHigh ? 'your partner' : g.seats[g.highBidder!]?.name}.`}
        {' '}Your hand looks good for about <b>{sug < MIN_BID ? 'a pass' : sug}</b>.
      </p>
      <div className="crows-bids">
        {tiles.map((b) => <button key={b} disabled={b < need} className={b === need && sug >= need ? 'sug' : ''} onClick={() => { sfx.click(); onAct({ type: 'bid', seat: ME, bid: b }); }}>{b}</button>)}
      </div>
      <div className="crows-row">
        <Pill color="red" onClick={() => onAct({ type: 'pass', seat: ME })}>Pass</Pill>
        {canAskRedeal(g, ME) && <Pill color="gold" onClick={() => onAct({ type: 'redeal', seat: ME })}>No point cards — redeal</Pill>}
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
    <div className="crows-dlg" role="dialog" aria-label="The nest">
      <h2>{forced ? `EVERYONE PASSED — YOU BID ${bid}` : `YOU WON THE BID AT ${bid}`}</h2>
      <p>The 5 nest cards are now in your hand. Tap <b>5 cards to put down</b> ({picked.length}/5), then name trump.
        {lostPts > 0 && <> Put-down points ({lostPts}) go to whoever wins the last trick.</>}
        {pickedTrump && <> <b>Careful:</b> you're putting down trump.</>}</p>
      <div className="crows-colours">
        {COLOURS.map((c) => (
          <button key={c} className={`c-${c} ${trump === c ? 'on' : ''}`} onClick={() => { sfx.click(); onTrump(c); }}>
            <Emblem s={c} size={22} /> {COLOUR_NAME[c]} <small>×{hand.filter((h) => h.s === c && !picked.some((p) => sameCard(p, h))).length}</small>
          </button>
        ))}
      </div>
      <div className="crows-row"><Pill color="green" disabled={!ready} onClick={onConfirm}>Put down 5 · {trump ? `${COLOUR_NAME[trump]} is trump` : 'pick trump'}</Pill></div>
    </div>
  );
}

function RoundSummary({ g, onNext }: { g: CrowsState; onNext: () => void }) {
  const r = g.history[g.history.length - 1];
  const us = sideOf(ME), them = 1 - us;
  const bidderName = r.bidder === ME ? 'You' : r.bidder === partnerOf(ME) ? 'Your partner' : g.seats[r.bidder]?.name;
  const weBid = sideOf(r.bidder) === us;
  const [left, setLeft] = useState(20);
  const done = useRef(false);
  useEffect(() => { const t = setInterval(() => setLeft((s) => s - 1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (left <= 0 && !done.current) { done.current = true; onNext(); } }, [left, onNext]);
  return (
    <Modal title={`Hand ${g.round}`} onClose={onNext}>
      <div className={`crows-verdict ${r.made ? 'made' : 'set'}`}>{bidderName} bid {r.bid}{r.forced ? ' (everyone passed)' : ''} — {r.made ? 'MADE IT' : 'SET'}</div>
      <p className="center muted small">Trump was {COLOUR_NAME[r.trump]}. The put-down cards ({r.nestPoints} pts) went to {r.nestSide === us ? 'your side' : 'their side'} with the last trick:</p>
      <div className="crows-nest">{sortHand(g.nest).map((c, i) => <CrowCard key={i} card={c} />)}</div>
      <table className="crows-sum">
        <thead><tr><th /><th className="us">US</th><th className="them">THEM</th></tr></thead>
        <tbody>
          <tr><td>Points taken</td><td>{r.points[us]}</td><td>{r.points[them]}</td></tr>
          <tr><td>This hand</td><td>{r.delta[us] > 0 ? '+' : ''}{r.delta[us]}</td><td>{r.delta[them] > 0 ? '+' : ''}{r.delta[them]}</td></tr>
          <tr><td><b>Total</b></td><td><b>{g.scores[us]}</b></td><td><b>{g.scores[them]}</b></td></tr>
        </tbody>
      </table>
      {!r.made && <p className="center muted small">{weBid ? 'Your side' : 'Their side'} needed {r.bid} but took {r.points[sideOf(r.bidder)]}, so {weBid ? 'you lose' : 'they lose'} {r.bid}.</p>}
      <div className="btn-row"><Pill color="green" onClick={onNext}>Next hand ({Math.max(0, left)}s)</Pill></div>
    </Modal>
  );
}

function GameOver({ g, weekRank, onAgain, onLobby }: { g: CrowsState; weekRank: number | null; onAgain: () => void; onLobby: () => void }) {
  const won = g.winners[0] === sideOf(ME);
  const us = sideOf(ME);
  return (
    <Modal title={won ? 'Victory!' : 'Defeat'} onClose={onLobby}>
      <div className={`crows-verdict ${won ? 'made' : 'set'}`}>{won ? 'YOU AND YOUR PARTNER WIN' : 'THE OTHER SIDE WINS'}</div>
      {weekRank !== null && <p className="center gold-text cr-after">You're #{weekRank} in this week's ranking</p>}
      <table className="crows-sum">
        <thead><tr><th /><th className="us">US</th><th className="them">THEM</th></tr></thead>
        <tbody><tr><td>Final score</td><td><b>{g.scores[us]}</b></td><td><b>{g.scores[1 - us]}</b></td></tr>
          <tr><td>Hands played</td><td colSpan={2}>{g.history.length}</td></tr></tbody>
      </table>
      <div className="btn-row"><Pill color="green" onClick={onAgain}>Play again</Pill><Pill color="blue" onClick={onLobby}>Lobby</Pill></div>
    </Modal>
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
        <ul><li>45 cards: four colours (Sky, Ember, Moss, Plum), each with 5 to 14 and a 1, plus the Crow.</li>
          <li>In each colour the 1 is the highest card, then 14, 13 and down to 5.</li>
          <li>Point cards: every 1 is worth 15, every 10 and 14 is worth 10, every 5 is worth 5, and the Crow is worth 20 — 180 in all.</li></ul>
        <h4>Bidding</h4>
        <ul><li>You and the player opposite are partners. Each player gets 10 cards; 5 go face down to the nest.</li>
          <li>The dealer bids first. Bids are 100 to 180 in steps of 5 — the points your side promises to take. Once you pass, you're out of the bidding.</li>
          <li>If everyone passes, the dealer must take it at 100. A hand with no point cards may ask for a new deal.</li></ul>
        <h4>The nest and trump</h4>
        <ul><li>The high bidder picks up the nest, puts any 5 cards back down, and names the trump colour.</li>
          <li>Whoever wins the last trick also wins the put-down cards and their points.</li></ul>
        <h4>Playing</h4>
        <ul><li>The bidder leads first. Follow the colour led if you can; if you can't, play anything.</li>
          <li>The highest trump wins the trick; otherwise the highest card of the colour led wins.</li>
          <li>The Crow is the highest trump. You may play it on any trick, even when you could follow. You must play it if trump is led and it's your only trump.</li></ul>
        <h4>Scoring</h4>
        <ul><li>If the bidding side takes at least its bid, it scores every point it took. If not, it loses the amount it bid.</li>
          <li>The other side always scores what it took. First side to 500 wins.</li></ul>
      </div>
  );
}
