import { applyAction, Card, GameState, legalCards, sideOf, seatsOfSide, Suit, trickWinner } from './engine';

const bySuit = (h: Card[], s: Suit) => h.filter((c) => c.s === s);

/** Estimate a sensible bid from the bot's own hand (and, in partners, what's already bid). */
export function botBid(g: GameState, seat: number): number {
  const hand = g.hands[seat];
  const spades = bySuit(hand, 'S');
  let est = 0;
  for (const c of spades) {
    if (c.r === 14) est += 1;
    else if (c.r === 13 && spades.length >= 2) est += 0.9;
    else if (c.r === 12 && spades.length >= 3) est += 0.7;
  }
  if (spades.length > 3) est += (spades.length - 3) * 0.85;
  for (const s of ['H', 'D', 'C'] as Suit[]) {
    const cs = bySuit(hand, s);
    const has = (r: number) => cs.some((c) => c.r === r);
    if (has(14)) est += cs.length >= 6 ? 0.6 : 1;
    if (has(13) && cs.length >= 2 && cs.length <= 5) est += has(14) ? 0.8 : 0.6;
    if (has(12) && cs.length >= 3 && cs.length <= 4 && (has(14) || has(13))) est += 0.3;
    if (cs.length === 0 && spades.length >= 3) est += 0.9;
    if (cs.length === 1 && spades.length >= 2) est += 0.4;
  }

  const partners = g.settings.mode === 'partners';
  const partner = (seat + 2) % 4;
  const partnerBid = partners ? g.bids[partner] : null;
  const highSpade = spades.reduce((m, c) => Math.max(m, c.r), 0);
  const canNil =
    est < 1.1 && highSpade <= 10 && spades.length <= 3 &&
    !['H', 'D', 'C'].some((s) => bySuit(hand, s as Suit).some((c) => c.r >= 13)) &&
    partnerBid !== 0 && (!partners || partnerBid === null || partnerBid >= 3);
  if (canNil) return 0;

  let bid = Math.max(1, Math.round(est));
  if (partners && partnerBid !== null) bid = Math.min(bid, 13 - partnerBid);
  return Math.max(1, Math.min(13, bid));
}

function currentBest(g: GameState) {
  return g.trick.length ? trickWinner(g.trick) : -1;
}
function beats(card: Card, g: GameState): boolean {
  if (!g.trick.length) return true;
  return trickWinner([...g.trick, { seat: -1, card }]) === -1;
}
const lowest = (cs: Card[]) => cs.reduce((a, b) => (b.r < a.r || (b.r === a.r && b.s !== 'S') ? b : a));
const highest = (cs: Card[]) => cs.reduce((a, b) => (b.r > a.r ? b : a));
const lowestRank = (cs: Card[]) => cs.reduce((a, b) => (b.r < a.r ? b : a));
const lowestNonSpadeFirst = (cs: Card[]) => {
  const ns = cs.filter((c) => c.s !== 'S');
  return ns.length ? ns.reduce((a, b) => (b.r < a.r ? b : a)) : cs.reduce((a, b) => (b.r < a.r ? b : a));
};


// ---------------- Covering a partner's Nil ----------------
/** n(U-k choose n) / (U choose n): the chance that n cards dealt from U contain none of k particular cards. */
function noneOf(U: number, k: number, n: number): number {
  if (n <= 0) return 1;
  if (U - k < n) return 0;
  let p = 1;
  for (let i = 0; i < n; i++) p *= (U - k - i) / (U - i);
  return p;
}

/**
 * How likely is it that my Nil partner is forced to win this trick if the card `c` is the best one on the table afterwards?
 * Partner must follow suit, so they win only when they hold cards of the led suit and every one of them is higher than the best card.
 * Counted from the cards nobody has shown yet; a Nil hand is low, so the chance is scaled down a little.
 */
function partnerForcedToWin(g: GameState, seat: number, partner: number, c: Card): number {
  const after = [...g.trick, { seat, card: c }];
  const led = after[0].card.s;
  const winSeat = trickWinner(after);
  const win = after.find((t) => t.seat === winSeat)!;
  if (win.card.s !== led) return 0;                    // trumped: partner can only follow suit with a lower card, or is void and may discard anything
  const unseen = unseenCards(g, seat);
  const U = unseen.length, n = g.hands[partner].length;
  if (!n || !U) return 0;
  const suit = unseen.filter((u) => u.s === led);
  const lower = suit.filter((u) => u.r < win.card.r);
  const risk = noneOf(U, lower.length, n) - noneOf(U, suit.length, n);   // no lower card of the suit, but at least one card of it
  return Math.max(0, risk) * 0.75;
}

/** Cheapest card that keeps the Nil partner safe: weigh the danger to partner against the value of the card (aces, kings and spades are worth saving). */
function coverChoice(g: GameState, seat: number, partner: number, legal: Card[]): Card {
  const WEIGHT = 6;
  let best = legal[0], bestV = Infinity;
  for (const c of legal) {
    const cost = (c.r - 2) / 12 + (c.s === 'S' ? 0.35 : 0);
    const v = WEIGHT * partnerForcedToWin(g, seat, partner, c) + cost;
    if (v < bestV - 1e-9 || (Math.abs(v - bestV) <= 1e-9 && c.r < best.r)) { bestV = v; best = c; }
  }
  return best;
}

let inSearch = false;   // true while a look-ahead is playing the rest of the round out (those plays use the plain rules, no nested search)

/**
 * Look ahead for a Nil, either to cover my partner's or to break an opponent's: deal the cards nobody has shown to the other players many times (the Nil partner's hand
 * leans low, because a Nil bid is made from low cards), play the round out with the plain rules, and choose the card that keeps the Nil
 * alive most often (cover) or break it most often (opponent): the round's result for my side decides, and the small cost of spending a
 * high card breaks ties.
 */
/** Look-ahead tuning (exported so a simulation can try other values). decay: how strongly a Nil hand leans low; spade: weight of a spade in it; cost: how much saving a high card matters. */
export const NIL_TUNING = { decay: 9, spade: 0.8, cost: 0.15, samples: 36 };

function nilSearch(g: GameState, seat: number, partner: number, legal: Card[]): Card | null {
  const unseen = unseenCards(g, seat);
  const others = [0, 1, 2, 3].filter((x) => x !== seat);
  const sizes = others.map((x) => g.hands[x].length);
  if (unseen.length !== sizes.reduce((a, b) => a + b, 0)) return null;
  const SAMPLES = NIL_TUNING.samples;
  const blindNil = !!g.blind?.[partner];   // a blind Nil is bid before looking, so the hand is not specially low
  const total = new Map<string, number>(legal.map((c) => [c.s + c.r, 0]));
  inSearch = true;
  try {
    for (let k = 0; k < SAMPLES; k++) {
      // the Nil bidder draws first, favouring low cards (and few spades) unless the Nil was blind
      const pool = unseen.slice();
      const pIdx = others.indexOf(partner), pn = sizes[pIdx];
      const pHand: Card[] = [];
      for (let i = 0; i < pn && pool.length; i++) {
        let sum = 0;
        const w = pool.map((c) => { const x = blindNil ? 1 : Math.exp(-(c.r - 2) / NIL_TUNING.decay) * (c.s === 'S' ? NIL_TUNING.spade : 1); sum += x; return x; });
        let r = Math.random() * sum, j = 0;
        while (j < pool.length - 1 && (r -= w[j]) > 0) j++;
        pHand.push(pool.splice(j, 1)[0]);
      }
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      const hands = g.hands.map((h) => h.slice());
      let o = 0;
      others.forEach((x, idx) => { if (x === partner) hands[x] = pHand; else { hands[x] = pool.slice(o, o + sizes[idx]); o += sizes[idx]; } });
      for (const c of legal) {
        const after = applyAction({ ...g, hands }, { type: 'play', seat, card: c });
        total.set(c.s + c.r, total.get(c.s + c.r)! + rollout(after, seat) - NIL_TUNING.cost * ((c.r - 2) / 12 + (c.s === 'S' ? 0.35 : 0)));
      }
    }
  } catch { return null; } finally { inSearch = false; }
  let best = legal[0], bestV = -Infinity;
  for (const c of legal) { const v = total.get(c.s + c.r)!; if (v > bestV + 1e-9) { bestV = v; best = c; } }
  return best;
}

export function botPlay(g: GameState, seat: number): Card {
  const legal = legalCards(g, seat);
  if (legal.length === 1) return legal[0];
  const mode = g.settings.mode;
  const partners = mode === 'partners';
  const partner = (seat + 2) % 4;
  const leading = g.trick.length === 0;
  const lastToPlay = g.trick.length === 3;

  // 1) Protect my own nil
  if (g.bids[seat] === 0 && g.tricks[seat] === 0) {
    if (leading) return lowestNonSpadeFirst(legal);
    const losers = legal.filter((c) => !beats(c, g));
    if (losers.length) return highest(losers);
    return lowest(legal);
  }

  // 2) Cover partner's nil
  const partnerNil = partners && g.bids[partner] === 0 && g.tricks[partner] === 0;
  if (partnerNil && !inSearch) {
    const searched = nilSearch(g, seat, partner, legal);
    if (searched) return searched;
  }
  if (partnerNil) {
    const partnerPlayed = g.trick.some((t) => t.seat === partner);
    const best = currentBest(g);
    const winners = legal.filter((c) => beats(c, g));
    if (leading) return coverChoice(g, seat, partner, legal);   // protect partner with the cheapest safe lead, not always the highest card
    if (partnerPlayed && best === partner) {
      // partner is about to take the trick: beat their card with the cheapest card that does it (a plain suit card before a trump)
      if (winners.length) { const plain = winners.filter((c) => c.s !== 'S'); return lowestRank(plain.length ? plain : winners); }
      return lowestNonSpadeFirst(legal);   // cannot beat them: nothing to save, keep the good cards
    }
    if (!partnerPlayed) return coverChoice(g, seat, partner, legal);   // partner plays after me: raise the trick only as high as needed
    // partner already played and somebody else is winning: partner is safe, play on normally
  }

  // 2b) An opponent's Nil is alive: try to make them take a trick
  if (!inSearch) {
    const nilSeat = [0, 1, 2, 3].find((x) => x !== seat && sideOf(mode, x) !== sideOf(mode, seat) && g.bids[x] === 0 && g.tricks[x] === 0);
    if (nilSeat !== undefined) {
      const searched = nilSearch(g, seat, nilSeat, legal);
      if (searched) return searched;
    }
  }

  // 3) Normal contract play
  const side = sideOf(mode, seat);
  const sideSeats = seatsOfSide(mode, side);
  const contract = sideSeats.reduce((s, i) => s + (g.bids[i] ?? 0), 0);
  const taken = sideSeats.reduce((s, i) => s + g.tricks[i], 0);
  const need = contract - taken;

  if (leading) {
    if (need <= 0) return lowestNonSpadeFirst(legal);
    const aces = legal.filter((c) => c.s !== 'S' && c.r === 14);
    if (aces.length) return aces[0];
    const kingsWithAceGone = legal.filter((c) => c.s !== 'S' && c.r === 13 && g.hands[seat].filter((x) => x.s === c.s).length <= 3);
    if (kingsWithAceGone.length && Math.random() < 0.4) return kingsWithAceGone[0];
    const spades = legal.filter((c) => c.s === 'S');
    if (spades.length >= 4 && highest(spades).r >= 13) return highest(spades);
    return lowestNonSpadeFirst(legal);
  }

  const best = currentBest(g);
  const partnerWinning = partners && best === partner;
  const winners = legal.filter((c) => beats(c, g));

  if (need <= 0) {
    // Contract made: duck to avoid bags
    const losers = legal.filter((c) => !beats(c, g));
    if (losers.length) return highest(losers);
    return lowest(legal);
  }

  if (partnerWinning) {
    const pc = g.trick.find((t) => t.seat === partner)!.card;
    if (lastToPlay || pc.r >= 13 || pc.s === 'S') {
      const losers = legal.filter((c) => !beats(c, g));
      return losers.length ? lowestNonSpadeFirst(losers) : lowest(legal);
    }
  }

  if (winners.length) {
    const nonSpadeWinners = winners.filter((c) => c.s !== 'S');
    const pool = nonSpadeWinners.length ? nonSpadeWinners : winners;
    if (lastToPlay) return lowest(pool);
    const h = highest(pool);
    return h.r >= 12 ? h : lowest(pool);
  }
  return lowestNonSpadeFirst(legal);
}

// ---------------- Chatter ----------------
export const BOT_NAMES = [
  'Nina Patel', 'Tyler Grant', 'Maya Johnson', 'Diego Ramirez', 'Leilani Kahale', 'Oskar Lindqvist', 'Amara Nwosu', 'Tomasz Nowak',
  'Chloe Martin', 'Isaac Reed', 'Jasmine Price', 'Noah Kim', 'Elena Petrova', 'Malik Robinson', 'Sienna Clarke', 'Victor Santos',
  'Keisha Moore', 'Liam Walsh', 'Yuki Sato', 'Hector Ruiz', 'Olivia Parker', 'Samir Khan', 'Ruby Foster', 'Felix Wagner',
];
export const BOT_LINES = {
  greet: ['Hi all! 👋', 'Good luck everyone', 'Let\'s gooo', 'gl hf', 'Hey partner!'],
  win: ['Nice hand!', 'Too easy 😎', 'That\'s how it\'s done', 'Booked it!'],
  lose: ['Ugh, set 😩', 'Next round is ours', 'Bad cards...', 'Oops'],
  reply: ['😂', 'lol', 'For real', 'Thanks!', 'Agreed', '👍', 'Haha nice', 'Focus partner 😅'],
  nil: ['Going nil, cover me!', 'Nil time 🙏'],
};
export const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

// ---------------- Skill levels ----------------
export type BotSkill = 'medium' | 'high' | 'expert';
/** Tables with a bet at or above this use high-skill computer players; smaller tables use medium. */
export const HIGH_SKILL_BET = 50_000;
/** Tables with a bet at or above this use expert computer players: they count cards and play to the score. */
export const EXPERT_SKILL_BET = 100_000;
export const skillForBet = (bet: number): BotSkill => (bet >= EXPERT_SKILL_BET ? 'expert' : bet >= HIGH_SKILL_BET ? 'high' : 'medium');

/** High plays the full strategy. Medium misjudges some bids and makes occasional loose plays. */
export function skilledBid(g: GameState, seat: number, skill: BotSkill): number {
  const best = botBid(g, seat);
  if (skill === 'high') return best;
  if (skill === 'expert') return expertBid(g, seat, best);
  if (best === 0) return Math.random() < 0.35 ? 1 : 0;               // sometimes too timid to go nil
  if (Math.random() < 0.3) return Math.max(1, Math.min(13, best + (Math.random() < 0.5 ? -1 : 1)));
  return best;
}
/** Is any seat playing for a Nil that is still alive? Computer players never play loosely then. */
function nilAlive(g: GameState, _seat: number): boolean {
  return [0, 1, 2, 3].some((x) => g.bids[x] === 0 && g.tricks[x] === 0);   // anybody's: partners cover it, opponents try to break it
}
export function skilledPlay(g: GameState, seat: number, skill: BotSkill): Card {
  if (nilAlive(g, seat)) return skill === 'expert' ? expertPlay(g, seat) : botPlay(g, seat);
  if (skill === 'expert') return expertPlay(g, seat);
  if (skill === 'high' || Math.random() >= 0.22) return botPlay(g, seat);
  const legal = legalCards(g, seat);
  return legal[Math.floor(Math.random() * legal.length)];
}

// ---------------- Expert play (bets of 50,000 and up) ----------------
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
/** Cards nobody has shown yet and that are not in my hand: what the other three players may still hold. */
function unseenCards(g: GameState, seat: number): Card[] {
  const gone = new Set([...(g.played ?? []), ...g.trick.map((t) => t.card), ...g.hands[seat]].map((c) => c.s + c.r));
  const out: Card[] = [];
  for (const s of ['S', 'H', 'D', 'C'] as Suit[]) for (const r of RANKS) if (!gone.has(s + r)) out.push({ s, r } as Card);
  return out;
}
const rankLow = (cs: Card[]) => cs.reduce((a, b) => (b.r < a.r ? b : a));

/** Same hand reading as the standard bid, then adjusted for the score: protect a lead, chase when far behind. */
function expertBid(g: GameState, seat: number, best: number): number {
  if (best === 0) return 0;
  const partners = g.settings.mode === 'partners';
  const side = sideOf(g.settings.mode, seat);
  const mine = g.scores[side] ?? 0;
  const other = Math.max(...g.scores.filter((_, i) => i !== side));
  const hand = g.hands[seat];
  const spades = bySuit(hand, 'S').length;
  let bid = best;
  if (mine - other >= 100 && bid > 2 && spades < 5) bid -= 1;               // well ahead: bid safe, avoid bags
  if (other - mine >= 150 && spades >= 4 && bid < 13) bid += 1;             // far behind: be bolder
  if (partners) {
    const pb = g.bids[(seat + 2) % 4];
    if (pb !== null && pb !== undefined) bid = Math.min(bid, Math.max(1, 13 - pb));
  }
  return Math.max(1, Math.min(13, bid));
}

/** Rest-of-round score for my side if the round is played out with standard play (positive = good for me). */
function rollout(g0: GameState, seat: number): number {
  let g = g0, guard = 0;
  while ((g.phase === 'playing' || g.phase === 'trickEnd') && guard++ < 80) {
    if (g.phase === 'trickEnd') g = applyAction(g, { type: 'collect' });
    else g = applyAction(g, { type: 'play', seat: g.turn, card: botPlay(g, g.turn) });
  }
  const r = g.history[g.history.length - 1];
  if (!r) return 0;
  const mode = g.settings.mode, me = sideOf(mode, seat);
  const others = r.delta.filter((_, i) => i !== me);
  return r.delta[me] - others.reduce((a, b) => a + b, 0) / others.length;
}

/**
 * Expert play: for each legal card, deal the cards nobody has shown to the other players at random many times, play the rest of
 * the round out with standard play, and pick the card with the best average result.
 */
export function expertPlay(g: GameState, seat: number): Card {
  const legal = legalCards(g, seat);
  if (legal.length === 1) return legal[0];
  const myNil = g.bids[seat] === 0 && g.tricks[seat] === 0;
  const partners = g.settings.mode === 'partners';
  if (nilAlive(g, seat)) return botPlay(g, seat);
  const unseen = unseenCards(g, seat);
  const others = [0, 1, 2, 3].filter((x) => x !== seat);
  const sizes = others.map((x) => g.hands[x].length);
  if (unseen.length !== sizes.reduce((a, b) => a + b, 0)) return botPlay(g, seat);
  const SAMPLES = 28;
  const score = new Map<string, number>(legal.map((c) => [c.s + c.r, 0]));
  for (let k = 0; k < SAMPLES; k++) {
    const deck = unseen.slice();
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    const hands = g.hands.map((h) => h.slice());
    let o = 0;
    others.forEach((x, idx) => { hands[x] = deck.slice(o, o + sizes[idx]); o += sizes[idx]; });
    for (const c of legal) {
      const sim: GameState = { ...g, hands };
      const after = applyAction(sim, { type: 'play', seat, card: c });
      score.set(c.s + c.r, score.get(c.s + c.r)! + rollout(after, seat));
    }
  }
  let bestC = legal[0], bestV = -Infinity;
  for (const c of legal) { const v = score.get(c.s + c.r)!; if (v > bestV) { bestV = v; bestC = c; } }
  return bestC;
}
