// Hand history: a few small numbers are written down when a trick ends and when a hand is scored, so the player can look back later
// (Hand history screen). Nothing here runs while a card is being played, and nothing is sent to the server.
import { rankLabel, type Card, type PublicState, type RoundResult, type Suit } from '../../shared/engine';

/** One finished trick: who led, the four cards in the order they were played ("10H", "AS"…), who won it. */
export interface TrickRec { lead: number; cards: string[]; winner: number }
/** One hand (a single deal): tricks, then the scoring once the hand is over. */
export interface HandRec {
  gid: string;            // which game it belongs to
  n: number;              // hand number in that game (1, 2, 3…)
  ts: number;
  mode: 'solo' | 'partners';
  city: string;
  me: number;             // the player's own seat
  names: string[];        // seat names (computer players marked)
  tricks: TrickRec[];
  res?: RoundResult;      // set when the hand has been scored
  scores?: number[];      // each side's score after this hand
  bags?: number[];        // each side's bags after this hand
}

const KEY = 'spade-haven-hands';
const KEEP = 20;        // hands kept (about 3 kB each)
const encode = (c: Card) => `${rankLabel(c.r)}${c.s}`;
export const decodeCard = (id: string): Card => {
  const s = id.slice(-1) as Suit, l = id.slice(0, -1);
  return { s, r: ({ J: 11, Q: 12, K: 13, A: 14 } as Record<string, number>)[l] ?? Number(l) };
};

let live: HandRec | null = null;   // the hand being played right now (kept in memory; saved when the hand is scored)
let stored: HandRec[] | null = null;

function load(): HandRec[] {
  if (stored) return stored;
  try { stored = JSON.parse(localStorage.getItem(KEY) || '[]') as HandRec[]; } catch { stored = []; }
  return stored;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(load().slice(-KEEP))); } catch { /* storage full or blocked: history just isn't kept */ }
}

const names = (st: PublicState) => st.seats.map((s) => (s ? (s.bot ? `${s.name}` : s.name) : '—'));
const fresh = (st: PublicState, gid: string): HandRec => ({
  gid, n: st.history.length + 1, ts: Date.now(), mode: st.settings.mode, city: st.settings.city, me: st.mySeat, names: names(st), tricks: [],
});

/** Called from the table whenever its state changes. Does nothing unless a trick just ended or a hand was just scored. */
export function observe(st: PublicState, gid: string) {
  if (st.phase === 'trickEnd' && st.trick.length === 4 && st.lastTrickWinner !== null) {
    if (!live || live.gid !== gid || live.n !== st.history.length + 1) live = fresh(st, gid);
    const lead = st.trick[0].seat;
    const cards = st.trick.map((x) => encode(x.card));
    if (!live.tricks.some((t) => t.cards.join() === cards.join())) live.tricks.push({ lead, cards, winner: st.lastTrickWinner });   // the same trick can be reported twice
    return;
  }
  if ((st.phase === 'roundEnd' || st.phase === 'gameOver') && live && live.gid === gid && !live.res && st.history.length === live.n) {
    live.res = st.history[st.history.length - 1];
    live.scores = st.scores.slice();
    live.bags = st.bags.slice();
    live.names = names(st);
    const all = load();
    all.push(live);
    if (all.length > KEEP) all.splice(0, all.length - KEEP);   // only the last 20 hands are kept, in memory and on the device
    save();
    live = null;
  }
}

/** Saved hands, oldest first. */
export const hands = () => load().slice();
export const clearHands = () => { stored = []; save(); };
