// Crows Haven rules engine (published Rook tournament rules, our own deck).
// Shared by the browser (offline play) and, later, a multiplayer server. No DOM, no Node APIs.
// Rules are written up in GAMES.md → "2. Second game: Crows Haven". Spades lives in ../engine.ts and is not touched.

import type { Seat } from '../engine';
export type { Seat };

/** The four coloured suits. Names and colours are our own (not the original game's). */
export type Colour = 'sky' | 'ember' | 'moss' | 'plum';
export const COLOURS: Colour[] = ['sky', 'ember', 'moss', 'plum'];
export const COLOUR_NAME: Record<Colour, string> = { sky: 'Sky', ember: 'Ember', moss: 'Moss', plum: 'Plum' };

/** A card: a colour numbered 5..14, or the Crow (s: 'crow', r: 0). */
export interface Card { s: Colour | 'crow'; r: number }
export const CROW: Card = { s: 'crow', r: 0 };
export const isCrow = (c: Card) => c.s === 'crow';
export const sameCard = (a: Card, b: Card) => a.s === b.s && a.r === b.r;
export const cardId = (c: Card) => (isCrow(c) ? 'CROW' : `${c.r}${c.s[0].toUpperCase()}`);

export const MIN_RANK = 5, MAX_RANK = 14;
export const HAND_SIZE = 9, NEST_SIZE = 5;
export const MIN_BID = 70, MAX_BID = 120, BID_STEP = 5;
export const DECK_POINTS = 120;
export const DEFAULT_TARGET = 300;

/** Points a card is worth: 5s = 5, 10s and 14s = 10, the Crow = 20, everything else 0. */
export function cardPoints(c: Card): number {
  if (isCrow(c)) return 20;
  if (c.r === 5) return 5;
  if (c.r === 10 || c.r === 14) return 10;
  return 0;
}
export const pointsOf = (cards: Card[]) => cards.reduce((n, c) => n + cardPoints(c), 0);

export type Phase = 'waiting' | 'bidding' | 'nest' | 'playing' | 'trickEnd' | 'roundEnd' | 'gameOver';

export interface CrowsSettings {
  bet: number;
  target: number;      // first side to reach this wins (300)
  city: string;
  isPrivate?: boolean;
}

export interface CrowsRoundResult {
  bidder: number;
  bid: number;
  trump: Colour;
  points: number[];       // card points taken per side (nest included for the last-trick side)
  nestPoints: number;     // points in the put-down cards
  nestSide: number;       // side that took the last trick (and the put-down cards)
  made: boolean;
  delta: number[];        // per side
  forced: boolean;        // everyone passed, the dealer took it at the minimum
}

export interface CrowsState {
  game: 'crows';
  settings: CrowsSettings;
  seats: (Seat | null)[];
  phase: Phase;
  dealer: number;
  turn: number;
  round: number;
  hands: Card[][];
  nest: Card[];               // the 5 face-down cards; after the bidder puts down, the 5 put-down cards
  // bidding
  highBid: number | null;
  highBidder: number | null;
  passed: boolean[];
  bidLog: { seat: number; bid: number | null }[];  // null = pass
  forced: boolean;
  // play
  trump: Colour | null;
  trick: { seat: number; card: Card }[];
  leadSeat: number;
  lastTrickWinner: number | null;
  taken: Card[][];            // cards captured per side this round
  played: Card[];             // every card played this round (public)
  scores: number[];           // per side: side 0 = seats 0 & 2, side 1 = seats 1 & 3
  history: CrowsRoundResult[];
  winners: number[];
}

export const sideOf = (seat: number) => seat % 2;
export const partnerOf = (seat: number) => (seat + 2) % 4;
const next = (seat: number) => (seat + 1) % 4;

export function newDeck(): Card[] {
  const d: Card[] = [];
  for (const s of COLOURS) for (let r = MIN_RANK; r <= MAX_RANK; r++) d.push({ s, r });
  d.push({ ...CROW });
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

/** Hand order: Crow first, then each colour (trump first once named), low to high. */
export function sortHand(h: Card[], trump: Colour | null = null): Card[] {
  const order = (c: Card) => (isCrow(c) ? -1 : c.s === trump ? 0 : 1 + COLOURS.indexOf(c.s as Colour));
  return h.slice().sort((a, b) => order(a) - order(b) || a.r - b.r);
}

export function createGame(settings: Partial<CrowsSettings> = {}, seats: (Seat | null)[] = [null, null, null, null], rnd: () => number = Math.random): CrowsState {
  return {
    game: 'crows',
    settings: { bet: 0, target: DEFAULT_TARGET, city: '', ...settings },
    seats: seats.slice(0, 4).concat([null, null, null, null]).slice(0, 4),
    phase: 'waiting',
    dealer: Math.floor(rnd() * 4),
    turn: 0,
    round: 0,
    hands: [[], [], [], []],
    nest: [],
    highBid: null,
    highBidder: null,
    passed: [false, false, false, false],
    bidLog: [],
    forced: false,
    trump: null,
    trick: [],
    leadSeat: 0,
    lastTrickWinner: null,
    taken: [[], []],
    played: [],
    scores: [0, 0],
    history: [],
    winners: [],
  };
}

function deal(g: CrowsState, dealer: number, round: number, rnd: () => number): CrowsState {
  const deck = shuffle(newDeck(), rnd);
  const hands = [0, 1, 2, 3].map((i) => sortHand(deck.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE)));
  return {
    ...g,
    phase: 'bidding',
    round,
    dealer,
    turn: dealer,               // the dealer bids first
    hands,
    nest: deck.slice(4 * HAND_SIZE),
    highBid: null,
    highBidder: null,
    passed: [false, false, false, false],
    bidLog: [],
    forced: false,
    trump: null,
    trick: [],
    leadSeat: dealer,
    lastTrickWinner: null,
    taken: [[], []],
    played: [],
  };
}

/** Deal the next hand. The deal moves one seat clockwise each hand. */
export function startRound(g: CrowsState, rnd: () => number = Math.random): CrowsState {
  const dealer = g.round === 0 ? g.dealer : next(g.dealer);
  return deal(g, dealer, g.round + 1, rnd);
}

/** Lowest bid the seat may make now. */
export const minNextBid = (g: CrowsState) => (g.highBid === null ? MIN_BID : g.highBid + BID_STEP);

export function canAskRedeal(g: CrowsState, seat: number) {
  return g.phase === 'bidding' && pointsOf(g.hands[seat]) === 0;
}

/** The colour a card belongs to for following suit: the Crow counts as trump. */
export function suitOf(c: Card, trump: Colour | null): Colour | 'crow' {
  return isCrow(c) ? (trump ?? 'crow') : c.s;
}

export function legalCards(g: CrowsState, seat: number): Card[] {
  const hand = g.hands[seat];
  if (g.phase !== 'playing' || g.turn !== seat) return [];
  if (g.trick.length === 0) return hand;
  const led = suitOf(g.trick[0].card, g.trump);
  const follow = hand.filter((c) => suitOf(c, g.trump) === led);
  if (!follow.length) return hand;
  // The Crow may be played to any trick, even when you could follow the colour led.
  const crow = hand.find(isCrow);
  return crow && !follow.some(isCrow) ? [...follow, crow] : follow;
}

/** Strength of a card in a trick: Crow beats every trump, trump beats the colour led, others can't win. */
function power(c: Card, led: Colour | 'crow', trump: Colour | null): number {
  if (isCrow(c)) return 300;
  if (c.s === trump) return 200 + c.r;
  if (c.s === led) return 100 + c.r;
  return 0;
}

export function trickWinner(trick: { seat: number; card: Card }[], trump: Colour | null): number {
  const led = suitOf(trick[0].card, trump);
  let best = trick[0];
  for (const t of trick.slice(1)) if (power(t.card, led, trump) > power(best.card, led, trump)) best = t;
  return best.seat;
}

export class RuleError extends Error {}

export type CrowsAction =
  | { type: 'bid'; seat: number; bid: number }
  | { type: 'pass'; seat: number }
  | { type: 'redeal'; seat: number }                                  // no point cards in hand
  | { type: 'nest'; seat: number; discard: Card[]; trump: Colour }    // bidder puts down 5 and names trump
  | { type: 'play'; seat: number; card: Card }
  | { type: 'collect' }                                               // clear a finished trick
  | { type: 'nextRound' };

function nextBidder(passed: boolean[], from: number): number {
  let s = next(from);
  while (passed[s]) s = next(s);
  return s;
}

function endBidding(g: CrowsState, bidder: number, bid: number, forced: boolean): CrowsState {
  const hands = g.hands.slice();
  hands[bidder] = sortHand([...hands[bidder], ...g.nest]);
  return { ...g, hands, nest: [], highBid: bid, highBidder: bidder, forced, phase: 'nest', turn: bidder };
}

export function applyAction(g: CrowsState, a: CrowsAction, rnd: () => number = Math.random): CrowsState {
  switch (a.type) {
    case 'bid': {
      if (g.phase !== 'bidding') throw new RuleError('Not bidding');
      if (g.turn !== a.seat || g.passed[a.seat]) throw new RuleError('Not your turn');
      if (!Number.isInteger(a.bid) || a.bid % BID_STEP !== 0 || a.bid < minNextBid(g) || a.bid > MAX_BID) throw new RuleError('Bad bid');
      const bidLog = [...g.bidLog, { seat: a.seat, bid: a.bid }];
      const s = { ...g, highBid: a.bid, highBidder: a.seat, bidLog };
      const passedCount = g.passed.filter(Boolean).length;
      if (a.bid === MAX_BID || passedCount === 3) return endBidding(s, a.seat, a.bid, false);
      return { ...s, turn: nextBidder(g.passed, a.seat) };
    }
    case 'pass': {
      if (g.phase !== 'bidding') throw new RuleError('Not bidding');
      if (g.turn !== a.seat || g.passed[a.seat]) throw new RuleError('Not your turn');
      const passed = g.passed.slice(); passed[a.seat] = true;
      const bidLog = [...g.bidLog, { seat: a.seat, bid: null }];
      const passedCount = passed.filter(Boolean).length;
      const s = { ...g, passed, bidLog };
      if (passedCount === 4) return endBidding(s, g.dealer, MIN_BID, true);                 // nobody bid: dealer takes it at 70
      if (passedCount === 3 && g.highBidder !== null) return endBidding(s, g.highBidder, g.highBid!, false);
      return { ...s, turn: nextBidder(passed, a.seat) };
    }
    case 'redeal': {
      if (!canAskRedeal(g, a.seat)) throw new RuleError('Only a hand with no point cards can ask for a redeal');
      return deal(g, g.dealer, g.round, rnd);  // same dealer, same hand number, fresh cards
    }
    case 'nest': {
      if (g.phase !== 'nest') throw new RuleError('Not the nest');
      if (a.seat !== g.highBidder) throw new RuleError('Only the bidder takes the nest');
      if (!COLOURS.includes(a.trump)) throw new RuleError('Name a colour for trump');
      if (a.discard.length !== NEST_SIZE) throw new RuleError(`Put down exactly ${NEST_SIZE} cards`);
      let hand = g.hands[a.seat];
      for (const c of a.discard) {
        if (!hand.some((h) => sameCard(h, c))) throw new RuleError('You can only put down cards in your hand');
        hand = hand.filter((h) => !sameCard(h, c));
      }
      const hands = g.hands.map((h, i) => sortHand(i === a.seat ? hand : h, a.trump));
      return { ...g, hands, nest: a.discard.slice(), trump: a.trump, phase: 'playing', turn: a.seat, leadSeat: a.seat };
    }
    case 'play': {
      if (g.phase !== 'playing') throw new RuleError('Not playing');
      if (g.turn !== a.seat) throw new RuleError('Not your turn');
      if (!legalCards(g, a.seat).some((c) => sameCard(c, a.card))) throw new RuleError('Illegal card');
      const hands = g.hands.slice();
      hands[a.seat] = hands[a.seat].filter((c) => !sameCard(c, a.card));
      const trick = [...g.trick, { seat: a.seat, card: a.card }];
      const played = [...g.played, a.card];
      if (trick.length < 4) return { ...g, hands, trick, played, turn: next(a.seat) };
      const w = trickWinner(trick, g.trump);
      const taken = g.taken.slice();
      taken[sideOf(w)] = [...taken[sideOf(w)], ...trick.map((t) => t.card)];
      return { ...g, hands, trick, played, taken, lastTrickWinner: w, turn: w, phase: 'trickEnd' };
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

export function scoreRound(g: CrowsState): CrowsState {
  const bidder = g.highBidder!, bid = g.highBid!;
  const nestSide = sideOf(g.lastTrickWinner!);
  const nestPoints = pointsOf(g.nest);
  const points = [0, 1].map((side) => pointsOf(g.taken[side]) + (side === nestSide ? nestPoints : 0));
  const bidSide = sideOf(bidder);
  const made = points[bidSide] >= bid;
  const delta = [0, 1].map((side) => (side === bidSide ? (made ? points[side] : -bid) : points[side]));
  const scores = g.scores.map((s, i) => s + delta[i]);
  const result: CrowsRoundResult = { bidder, bid, trump: g.trump!, points, nestPoints, nestSide, made, delta, forced: g.forced };
  const history = [...g.history, result];
  const reached = scores.some((s) => s >= g.settings.target);
  if (reached && scores[0] !== scores[1]) {
    return { ...g, scores, history, phase: 'gameOver', winners: [scores[0] > scores[1] ? 0 : 1] };
  }
  return { ...g, scores, history, phase: 'roundEnd' };   // a tie at or over the target plays another hand
}

/** What one player may see: their own hand, everyone's card counts, the nest only while they hold it. */
export interface CrowsPublicState extends Omit<CrowsState, 'hands' | 'nest'> {
  hand: Card[];
  handCounts: number[];
  nest: Card[];        // the put-down cards: shown to the bidder, and to everyone once the hand is scored
  nestCount: number;
  mySeat: number;
}
export function viewFor(g: CrowsState, viewerSeat: number): CrowsPublicState {
  const { hands, nest, ...rest } = g;
  const showNest = g.phase === 'roundEnd' || g.phase === 'gameOver' || (g.phase !== 'bidding' && g.highBidder === viewerSeat);
  return {
    ...rest,
    hand: hands[viewerSeat] ?? [],
    handCounts: hands.map((h) => h.length),
    nest: showNest ? nest : [],
    nestCount: nest.length,
    mySeat: viewerSeat,
  };
}
