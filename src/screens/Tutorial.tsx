// "Learn Spades in 60 seconds": a scripted hand for new players. It runs entirely on the device (a fixed deal, fixed opponent cards),
// so there is no waiting, nothing can go wrong, and nothing is charged or counted on the boards. Loaded only when needed (own code chunk).
import { useEffect, useMemo, useRef, useState } from 'react';
import { CardView, Coin } from '../components/ui';
import { sortHand, type Card } from '../../shared/engine';
import { decodeCard } from '../lib/handlog';
import { fmt, profile } from '../lib/profile';
import { sfx, vibrate } from '../lib/sound';

export const TUTORIAL_REWARD = 5_000;

const HAND = sortHand('2D 6D JD QD 4H 7H 9H AH 2S 3S 7S KS AS'.split(' ').map(decodeCard));
type Played = { seat: number; id: string };
// seats: 0 = you (bottom), 1 = left, 2 = your partner (top), 3 = right
const NAMES = ['You', 'Maya', 'Partner', 'Alex'];

type Beat =
  | { k: 'intro' }
  | { k: 'say'; text: string }
  | { k: 'bid' }
  | { k: 'play'; need: string; hint: string; pre: Played[]; after: Played[]; winner: number; won: string }
  | { k: 'nil' }
  | { k: 'done' };

const P = (seat: number, id: string): Played => ({ seat, id });
const BEATS: Beat[] = [
  { k: 'intro' },
  { k: 'say', text: 'You and your partner at the top are a team. Spades ♠ are trump: they beat every other suit.' },
  { k: 'bid' },
  { k: 'play', need: 'QD', hint: 'Follow suit: play a diamond. The highest card wins the trick.', pre: [P(1, '6D'), P(2, '9D'), P(3, '4D')], after: [], winner: 0, won: 'Your Q♦ is the highest diamond. You win the trick!' },
  { k: 'play', need: 'AH', hint: 'You won, so you lead. Play your Ace of hearts.', pre: [], after: [P(1, '5H'), P(2, 'KH'), P(3, '5S')], winner: 3, won: 'Alex has no hearts, so his 5♠ is trump. Trump beats even an Ace!' },
  { k: 'play', need: 'KS', hint: 'You have no clubs. Play a spade to trump in!', pre: [P(3, '8C')], after: [P(1, '10C'), P(2, 'AC')], winner: 0, won: 'Your K♠ is trump, so it wins. Spades rule!' },
  { k: 'nil' },
  { k: 'done' },
];
const STEPS = BEATS.filter((b) => b.k === 'say' || b.k === 'bid' || b.k === 'play' || b.k === 'nil').length;

export default function Tutorial({ onClose }: { onClose: (playNow: boolean) => void }) {
  const [i, setI] = useState(0);
  const [bid, setBid] = useState<number | null>(null);
  const [table, setTable] = useState<Played[]>([]);
  const [phase, setPhase] = useState<'pre' | 'ready' | 'after' | 'result'>('pre');
  const [gone, setGone] = useState<string[]>([]);   // cards you have already played
  const timers = useRef<number[]>([]);
  const beat = BEATS[i];
  const later = (ms: number, f: () => void) => { timers.current.push(window.setTimeout(f, ms)); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const step = BEATS.slice(0, i + 1).filter((b) => b.k === 'say' || b.k === 'bid' || b.k === 'play' || b.k === 'nil').length;
  const winnerSeat = beat.k === 'play' && phase === 'result' ? beat.winner : null;

  // a trick starts: the players before you put their cards down, one by one
  useEffect(() => {
    if (beat.k !== 'play') return;
    setTable([]); setPhase('pre');
    beat.pre.forEach((p, n) => later(500 + n * 650, () => { setTable((t) => [...t, p]); sfx.card(); }));
    later(500 + beat.pre.length * 650 + 150, () => setPhase('ready'));
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => { sfx.click(); setI((n) => Math.min(BEATS.length - 1, n + 1)); };
  const playMine = (id: string) => {
    if (beat.k !== 'play' || phase !== 'ready' || id !== beat.need) return;
    sfx.card(); vibrate(10);
    setGone((g) => [...g, id]); setPhase('after');
    setTable((t) => [...t, P(0, id)]);
    beat.after.forEach((p, n) => later(650 + n * 650, () => { setTable((t) => [...t, p]); sfx.card(); }));
    later(650 + beat.after.length * 650 + 350, () => { setPhase('result'); if (beat.winner === 0) { sfx.trickWon(); vibrate([30, 40, 30]); } else sfx.trick(); });
  };

  const finish = (playNow: boolean, skipped = false) => {
    if (skipped) { if (profile.get().tutorial !== 'done') profile.set(() => ({ tutorial: 'skipped' as const })); }
    else if (profile.get().tutorial !== 'done') { profile.set((x) => ({ coins: x.coins + TUTORIAL_REWARD, tutorial: 'done' as const })); sfx.coins(); }
    onClose(playNow);
  };

  const hand = useMemo(() => HAND, []);
  const say = beat.k === 'say' ? beat.text
    : beat.k === 'bid' ? (bid === null ? 'How many tricks will you win? Count your sure winners: A♠, K♠ and A♥ make 3.' : `You bid ${bid}. Your team needs ${bid} tricks or more, and your partner's tricks count too.`)
    : beat.k === 'play' ? (phase === 'result' ? beat.won : phase === 'ready' ? beat.hint : '')
    : '';

  return (
    <div className="tu" role="dialog" aria-label="Learn Spades in 60 seconds">
      <button className="tu-skip" onClick={() => finish(false, true)}>Skip</button>
      {beat.k !== 'intro' && beat.k !== 'done' && <div className="tu-dots" aria-label={`Step ${step} of ${STEPS}`}>{Array.from({ length: STEPS }, (_, n) => <i key={n} className={n < step ? 'on' : ''} />)}</div>}

      {beat.k === 'intro' && (
        <div className="tu-card">
          <div className="tu-big">♠</div>
          <h2>Learn Spades in 60 seconds</h2>
          <p>Play one quick practice hand with us. You can't make a mistake.</p>
          <button className="tu-go" onClick={next}>Start</button>
          <button className="tu-later" onClick={() => finish(false, true)}>Skip, I know how to play</button>
        </div>
      )}

      {beat.k === 'nil' && (
        <div className="tu-card">
          <div className="tu-big nil">NIL</div>
          <h2>One bold bid: Nil</h2>
          <p>Bid <b>Nil</b> and promise to win <b>no tricks at all</b>. Pull it off for <b>+100</b> points. Take even one trick and you lose <b>100</b>.</p>
          <p className="tu-small">Bid Nil without looking at your cards (Blind Nil) and it is worth ±200.</p>
          <button className="tu-go" onClick={next}>Got it</button>
        </div>
      )}

      {beat.k === 'done' && (
        <div className="tu-card">
          <div className="tu-big"><Coin size={72} /></div>
          <h2>Nice! You know the basics</h2>
          <p className="tu-reward">+{fmt(TUTORIAL_REWARD)} coins</p>
          <p>A full hand has 13 tricks. Make your bid for 10 points per trick you promised.</p>
          <button className="tu-go" onClick={() => finish(true)}>Play your first game</button>
          <button className="tu-later" onClick={() => finish(false)}>Back to the lobby</button>
        </div>
      )}

      {(beat.k === 'say' || beat.k === 'bid' || beat.k === 'play') && (
        <>
          <div className="tu-say" aria-live="polite">{say}</div>
          <div className="tu-felt">
            {[1, 2, 3].map((seat) => <div key={seat} className={`tu-who s${seat}`}>{NAMES[seat]}</div>)}
            {table.map((p) => (
              <div key={p.id} className={`tu-played s${p.seat} ${winnerSeat === p.seat ? 'win' : ''}`}><CardView card={decodeCard(p.id)} /></div>
            ))}
          </div>
          {beat.k === 'bid' && bid === null && (
            <div className="tu-bids">{[2, 3, 4].map((n) => <button key={n} onClick={() => { sfx.click(); setBid(n); }}>{n}</button>)}</div>
          )}
          {beat.k === 'bid' && bid !== null && <button className="tu-next" onClick={next}>Next ▶</button>}
          {beat.k === 'say' && <button className="tu-next" onClick={next}>Next ▶</button>}
          {beat.k === 'play' && phase === 'result' && <button className="tu-next" onClick={next}>Next ▶</button>}
          <div className="tu-hand">
            {hand.map((c: Card, n) => {
              const id = `${c.r === 14 ? 'A' : c.r === 13 ? 'K' : c.r === 12 ? 'Q' : c.r === 11 ? 'J' : c.r}${c.s}`;
              if (gone.includes(id)) return <span key={id} className="tu-slot" />;
              const need = beat.k === 'play' && phase === 'ready' && id === beat.need;
              return <CardView key={id} card={c} className={`tu-c ${need ? 'need' : ''} ${beat.k === 'play' && phase === 'ready' && !need ? 'dim' : ''}`} onClick={need ? () => playMine(id) : undefined} disabled={!need} style={{ ['--i' as string]: n }} />;
            })}
          </div>
        </>
      )}
    </div>
  );
}
