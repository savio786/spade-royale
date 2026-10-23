// Pure, deterministic-ish Spades engine shared by the browser (offline play)
// and the Node server (online / private tables). No DOM, no Node APIs.

export type Suit = 'S' | 'H' | 'D' | 'C';
export interface Card { s: Suit; r: number } // r: 2..14 (14 = Ace)
export type Mode = 'partners' | 'solo';
export type Phase = 'waiting' | 'bidding' | 'playing' | 'trickEnd' | 'roundEnd' | 'gameOver';

/** Career numbers shown on a player's profile card. */
export interface PublicStats {
  coins: number; played: number; won: number;
  last5: string;                     // most recent last, e.g. "LWWWW"
  nil: number; nilMade: number; blind: number; blindMade: number;
  rings: Record<string, number>;     // city → wins at that city's tables
}
export const CITIES = ['New York', 'Chicago', 'Miami', 'Seattle', 'Las Vegas', 'London', 'Monaco'];

export interface Seat {
  id: string;          // player id (bots start with "bot:")
  name: string;
  avatar: string;      // avatar key
  level: number;
  bot: boolean;
  stats?: PublicStats;
}

export interface TableSettings {
  mode: Mode;
  bet: number;
  minPoints: number;   // e.g. -100 (lose when at/below)
  maxPoints: number;   // e.g. 100  (win when at/above)
  city: string;
  isPrivate?: boolean;
}

export interface RoundResult {
  bids: (number | null)[];
  tricks: number[];
  delta: number[];     // per side
  bagsAdded: number[];
  bagPenalty: boolean[];
  nilResults: (null | boolean)[]; // per seat: null = no nil
  blind?: boolean[];              // per seat: nil bid blind (worth ±200)
}

export interface GameState {
  settings: TableSettings;
  seats: (Seat | null)[];       // 4 seats; seat 0 = south for the creator
  phase: Phase;
  dealer: number;
  turn: number;
  round: number;
  hands: Card[][];
  bids: (number | null)[];      // 0 = nil
  blind: boolean[];             // nil bid without looking at the cards
  revealed: boolean[];          // has looked at their cards this round
  tricks: number[];             // tricks won this round per seat
  trick: { seat: number; card: Card }[];
  leadSeat: number;
  spadesBroken: boolean;
  lastTrickWinner: number | null;
  scores: number[];             // per side (2 for partners, 4 for solo)
  bags: number[];               // per side
  history: RoundResult[];
  winners: number[];            // sides that won (gameOver)
  placements: number[];         // sides ordered best → worst (gameOver)
}

export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const rankLabel = (r: number) => (r <= 10 ? String(r) : ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' } as Record<number, string>)[r]);
export const cardId = (c: Card) => `${rankLabel(c.r)}${c.s}`;
export const sameCard = (a: Card, b: Card) => a.s === b.s && a.r === b.r;

export const sideCount = (mode: Mode) => (mode === 'partners' ? 2 : 4);
export const sideOf = (mode: Mode, seat: number) => (mode === 'partners' ? seat % 2 : seat);
export const seatsOfSide = (mode: Mode, side: number) => (mode === 'partners' ? [side, side + 2] : [side]);

/** Prize paid to each winning seat. Partners: both winners get 1.8x bet. Solo: winner gets 3.6x bet. */
export function prizeFor(settings: Pick<TableSettings, 'mode' | 'bet'>): number {
  return Math.round(settings.bet * (settings.mode === 'partners' ? 1.8 : 3.6));
}

export function newDeck(): Card[] {
  const d: Card[] = [];
  for (const s of SUITS) for (let r = 2; r <= 14; r++) d.push({ s, r });
  return d;
}

export function shuffle<T>(a: T[], rnd: () => number = Math.random): T[] {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Hand order, left to right: diamonds, clubs, hearts, spades (highest card first within a suit)
const SUIT_ORDER: Record<Suit, number> = { D: 0, C: 1, H: 2, S: 3 };
export function sortHand(h: Card[]): Card[] {
  return h.slice().sort((a, b) => SUIT_ORDER[a.s] - SUIT_ORDER[b.s] || b.r - a.r);
}

export function createGame(settings: TableSettings, seats: (Seat | null)[] = [null, null, null, null]): GameState {
  const n = sideCount(settings.mode);
  return {
    settings,
    seats: seats.slice(0, 4).concat([null, null, null, null]).slice(0, 4),
    phase: 'waiting',
    dealer: Math.floor(Math.random() * 4),
    turn: 0,
    round: 0,
    hands: [[], [], [], []],
    bids: [null, null, null, null],
    blind: [false, false, false, false],
    revealed: [false, false, false, false],
    tricks: [0, 0, 0, 0],
    trick: [],
    leadSeat: 0,
    spadesBroken: false,
    lastTrickWinner: null,
    scores: Array(n).fill(0),
    bags: Array(n).fill(0),
    history: [],
    winners: [],
    placements: [],
  };
}

export function isFull(g: GameState) {
  return g.seats.every(Boolean);
}

export function startRound(g: GameState, rnd: () => number = Math.random): GameState {
  const deck = shuffle(newDeck(), rnd);
  const hands = [0, 1, 2, 3].map((i) => sortHand(deck.slice(i * 13, i * 13 + 13)));
  const dealer = g.round === 0 ? g.dealer : (g.dealer + 1) % 4;
  return {
    ...g,
    phase: 'bidding',
    round: g.round + 1,
    dealer,
    turn: (dealer + 1) % 4,
    hands,
    bids: [null, null, null, null],
    blind: [false, false, false, false],
    revealed: [false, false, false, false],
    tricks: [0, 0, 0, 0],
    trick: [],
    leadSeat: (dealer + 1) % 4,
    spadesBroken: false,
    lastTrickWinner: null,
  };
}

export function legalCards(g: GameState, seat: number): Card[] {
  const hand = g.hands[seat];
  if (g.phase !== 'playing' || g.turn !== seat) return [];
  if (g.trick.length === 0) {
    const nonSpades = hand.filter((c) => c.s !== 'S');
    if (!g.spadesBroken && nonSpades.length > 0) return nonSpades;
    return hand;
  }
  const lead = g.trick[0].card.s;
  const follow = hand.filter((c) => c.s === lead);
  return follow.length ? follow : hand;
}

export function trickWinner(trick: { seat: number; card: Card }[]): number {
  const lead = trick[0].card.s;
  let best = trick[0];
  for (const t of trick.slice(1)) {
    const c = t.card, b = best.card;
    if (c.s === b.s) { if (c.r > b.r) best = t; }
    else if (c.s === 'S') best = t;
    else if (b.s !== 'S' && c.s === lead && c.r > b.r) best = t;
  }
  return best.seat;
}

export class RuleError extends Error {}

export type Action =
  | { type: 'bid'; seat: number; bid: number; blind?: boolean }
  | { type: 'reveal'; seat: number }  // look at your cards (you can no longer bid blind nil)
  | { type: 'ready'; seat: number }   // done reading the round summary
  | { type: 'play'; seat: number; card: Card }
  | { type: 'collect' }      // clear a finished trick (after the UI pause)
  | { type: 'nextRound' };   // after round summary

export function applyAction(g: GameState, a: Action, rnd: () => number = Math.random): GameState {
  switch (a.type) {
    case 'bid': {
      if (g.phase !== 'bidding') throw new RuleError('Not bidding');
      if (g.turn !== a.seat) throw new RuleError('Not your turn');
      if (!Number.isInteger(a.bid) || a.bid < 0 || a.bid > 13) throw new RuleError('Bad bid');
      const blindNil = !!a.blind;
      if (blindNil && (a.bid !== 0 || g.revealed?.[a.seat])) throw new RuleError('Blind nil must be bid before looking at your cards');
      const bids = g.bids.slice();
      bids[a.seat] = a.bid;
      const blind = (g.blind ?? [false, false, false, false]).slice(); blind[a.seat] = blindNil;
      const revealed = (g.revealed ?? [true, true, true, true]).slice(); revealed[a.seat] = true;
      const done = bids.every((b) => b !== null);
      return { ...g, bids, blind, revealed, turn: (a.seat + 1) % 4, phase: done ? 'playing' : 'bidding', ...(done ? { turn: g.leadSeat } : {}) };
    }
    case 'reveal': {
      if (g.phase !== 'bidding' || g.revealed?.[a.seat]) return g;
      const revealed = (g.revealed ?? [true, true, true, true]).slice(); revealed[a.seat] = true;
      return { ...g, revealed };
    }
    case 'ready':
      return g;
    case 'play': {
      if (g.phase !== 'playing') throw new RuleError('Not playing');
      if (g.turn !== a.seat) throw new RuleError('Not your turn');
      const legal = legalCards(g, a.seat);
      if (!legal.some((c) => sameCard(c, a.card))) throw new RuleError('Illegal card');
      const hands = g.hands.slice();
      hands[a.seat] = hands[a.seat].filter((c) => !sameCard(c, a.card));
      const trick = [...g.trick, { seat: a.seat, card: a.card }];
      const spadesBroken = g.spadesBroken || a.card.s === 'S';
      if (trick.length < 4) {
        return { ...g, hands, trick, spadesBroken, turn: (a.seat + 1) % 4 };
      }
      const w = trickWinner(trick);
      const tricks = g.tricks.slice();
      tricks[w]++;
      return { ...g, hands, trick, spadesBroken, tricks, lastTrickWinner: w, turn: w, phase: 'trickEnd' };
    }
    case 'collect': {
      if (g.phase !== 'trickEnd') return g;
      const w = g.lastTrickWinner!;
      if (g.hands.every((h) => h.length === 0)) return scoreRound({ ...g, trick: [] });
      return { ...g, trick: [], leadSeat: w, turn: w, phase: 'playing' };
    }
    case 'nextRound': {
      if (g.phase !== 'roundEnd') return g;
      return startRound(g, rnd);
    }
  }
}

export function scoreRound(g: GameState): GameState {
  const { mode, maxPoints, minPoints } = g.settings;
  const n = sideCount(mode);
  const delta = Array(n).fill(0);
  const bagsAdded = Array(n).fill(0);
  const bagPenalty = Array(n).fill(false);
  const nilResults: (null | boolean)[] = [null, null, null, null];
  const bags = g.bags.slice();

  for (let side = 0; side < n; side++) {
    const seats = seatsOfSide(mode, side);
    let contract = 0, won = 0;
    for (const s of seats) {
      const b = g.bids[s] ?? 0;
      if (b === 0) {
        const ok = g.tricks[s] === 0;
        const worth = g.blind?.[s] ? 200 : 100;
        nilResults[s] = ok;
        delta[side] += ok ? worth : -worth;
        won += g.tricks[s]; // a failed nil's tricks still count toward the partner's contract
      } else {
        contract += b;
        won += g.tricks[s];
      }
    }
    if (contract > 0) {
      if (won >= contract) {
        const over = won - contract;
        delta[side] += contract * 10 + over;
        bagsAdded[side] = over;
      } else {
        delta[side] -= contract * 10;
      }
    } else {
      bagsAdded[side] = won; // whole side bid nil: every trick is a bag
      delta[side] += won;
    }
    bags[side] += bagsAdded[side];
    if (bags[side] >= 10) {
      bags[side] -= 10;
      delta[side] -= 100;
      bagPenalty[side] = true;
    }
  }

  const scores = g.scores.map((s, i) => s + delta[i]);
  const result: RoundResult = { bids: g.bids.slice(), tricks: g.tricks.slice(), delta, bagsAdded, bagPenalty, nilResults, blind: (g.blind ?? []).slice() };
  const history = [...g.history, result];

  const anyEnd = scores.some((s) => s >= maxPoints || s <= minPoints);
  const top = Math.max(...scores);
  const leaders = scores.map((s, i) => (s === top ? i : -1)).filter((i) => i >= 0);
  if (anyEnd && leaders.length === 1) {
    const placements = scores.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
    return { ...g, scores, bags, history, phase: 'gameOver', winners: leaders, placements };
  }
  return { ...g, scores, bags, history, phase: 'roundEnd' };
}

/** Hide other players' cards before sending a state to `viewerSeat`. */
export interface PublicState extends Omit<GameState, 'hands'> {
  hand: Card[];
  handCounts: number[];
  mySeat: number;
}
export function viewFor(g: GameState, viewerSeat: number): PublicState {
  const { hands, ...rest } = g;
  // during bidding your cards stay face down until you choose to look (so a blind nil is really blind)
  const hidden = g.phase === 'bidding' && g.revealed && !g.revealed[viewerSeat];
  return { ...rest, hand: hidden ? [] : hands[viewerSeat] ?? [], handCounts: hands.map((h) => h.length), mySeat: viewerSeat };
}
