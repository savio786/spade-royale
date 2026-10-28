// Crows Haven computer players (first version: rule-based, no look-ahead yet).
// Bots only use what a real player could see: their own hand, the cards played, the current trick,
// trump, the bidding, and (for the bidder) the cards they put down.

import {
  Card, Colour, COLOURS, CrowsState, MAX_BID, MIN_BID, BID_STEP, NEST_SIZE, RANKS, rankValue,
  cardPoints, isCrow, legalCards, minNextBid, partnerOf, pointsOf, sameCard, sideOf, suitOf, trickWinner, canAskRedeal,
} from './engine';

export type CrowsSkill = 'medium' | 'high';

// ---------- hand strength ----------

/** Rough number of card points this hand's side expects to take with `trump` as trump. */
export function handValue(hand: Card[], trump: Colour): number {
  const trumps = hand.filter((c) => c.s === trump);
  const hasCrow = hand.some(isCrow);
  const tLen = trumps.length + (hasCrow ? 1 : 0);
  let v = 0;
  if (hasCrow) v += 22;                                    // the Crow wins a trick and is worth 20 itself
  for (const c of trumps) { const rv = rankValue(c.r); v += rv >= 14 ? 10 : rv >= 12 ? 7 : 4; }
  if (tLen >= 5) v += (tLen - 4) * 6;                       // long trump keeps control and wins late tricks
  for (const s of COLOURS) {
    if (s === trump) continue;
    const cards = hand.filter((c) => c.s === s);
    const ranks = cards.map((c) => c.r);
    if (ranks.includes(1)) v += 16;                         // a 1 usually wins and carries 15
    if (ranks.includes(14)) v += ranks.includes(1) ? 10 : 4; // a 14 behind the 1 is a second winner
    if (cards.length === 0 && tLen >= 3) v += 5;            // void: can trump in
    if (cards.length === 1 && tLen >= 3 && !ranks.includes(1)) v += 2;
  }
  return v;
}

export function bestTrump(hand: Card[]): Colour {
  let best: Colour = COLOURS[0], bv = -1;
  for (const s of COLOURS) { const v = handValue(hand, s); if (v > bv) { bv = v; best = s; } }
  return best;
}

/**
 * Highest bid the bot is willing to make. Measured from 40,000 bot hands on the 45-card deck
 * (scripts/simulate-crows.ts): the bidding side takes about 88 + 0.78 × handValue points on average;
 * bidding ~15 below that makes roughly two bids in three.
 */
export function estimateBid(hand: Card[]): number {
  const est = 73 + 0.78 * handValue(hand, bestTrump(hand));
  return Math.min(MAX_BID, Math.floor(est / BID_STEP) * BID_STEP);
}

// ---------- bidding ----------

export function botBid(g: CrowsState, seat: number, skill: CrowsSkill = 'high', rnd: () => number = Math.random): { type: 'bid'; seat: number; bid: number } | { type: 'pass'; seat: number } | { type: 'redeal'; seat: number } {
  const hand = g.hands[seat];
  if (canAskRedeal(g, seat)) return { type: 'redeal', seat };
  let limit = estimateBid(hand);
  if (skill === 'medium') limit += Math.round((rnd() - 0.5) * 20 / BID_STEP) * BID_STEP;  // misjudges a little
  const need = minNextBid(g);
  // Don't outbid your own partner unless clearly stronger.
  if (g.highBidder !== null && g.highBidder === partnerOf(seat) && limit < need + 15) return { type: 'pass', seat };
  if (need > MAX_BID || need > limit) return { type: 'pass', seat };
  // Open at the minimum; when competing, raise by one step.
  return { type: 'bid', seat, bid: Math.max(MIN_BID, need) };
}

// ---------- nest ----------

/** Bidder picks trump and the 5 cards to put down. */
export function botNest(g: CrowsState, seat: number): { type: 'nest'; seat: number; discard: Card[]; trump: Colour } {
  const hand = g.hands[seat];
  const trump = bestTrump(hand);
  // How much we want to keep each card (lower = put down first).
  const keep = (c: Card): number => {
    if (isCrow(c) || c.s === trump) return 1000 + rankValue(c.r);      // never put down trump or the Crow
    const suit = hand.filter((h) => h.s === c.s);
    const has1 = suit.some((h) => h.r === 1);
    let k = rankValue(c.r) * 2 + suit.length * 6;            // short colours go first (to make voids)
    if (c.r === 1) k += 220;                                 // a 1 is a likely winner
    if (c.r === 14 && has1) k += 120;                        // …and the 14 behind it
    // a 14, 10 or 5 without the 1 to protect it is likely lost to opponents: better hidden in the nest
    if ((c.r === 14 || c.r === 10 || c.r === 5) && !has1) k -= 25;
    return k;
  };
  const sorted = hand.slice().sort((a, b) => keep(a) - keep(b));
  return { type: 'nest', seat, discard: sorted.slice(0, NEST_SIZE), trump };
}

// ---------- card play ----------

function remaining(g: CrowsState, seat: number): Card[] {
  // cards not yet played and not in my hand (and not in my put-down cards, if I'm the bidder)
  const seen = [...g.played, ...g.hands[seat], ...g.trick.map((t) => t.card), ...(g.highBidder === seat ? g.nest : [])];
  const all: Card[] = [];
  for (const s of COLOURS) for (const r of RANKS) all.push({ s, r });
  all.push({ s: 'crow', r: 0 });
  return all.filter((c) => !seen.some((x) => sameCard(x, c)));
}

/** Will this card win the trick so far and also stay on top of anything still out? (approximate) */
function isBoss(card: Card, g: CrowsState, seat: number): boolean {
  const trump = g.trump;
  const out = remaining(g, seat);
  if (isCrow(card)) return true;
  const s = suitOf(card, trump);
  if (s === trump) return !out.some((c) => isCrow(c) || (c.s === trump && rankValue(c.r) > rankValue(card.r)));
  return !out.some((c) => c.s === s && rankValue(c.r) > rankValue(card.r));
}

function wouldWin(g: CrowsState, seat: number, card: Card): boolean {
  return trickWinner([...g.trick, { seat, card }], g.trump) === seat;
}

const lowestBy = (cards: Card[], f: (c: Card) => number) => cards.slice().sort((a, b) => f(a) - f(b))[0];
// Cheapness of throwing a card away: points lost first, then rank (keep high cards).
const dumpCost = (trump: Colour | null) => (c: Card) => cardPoints(c) * 10 + (isCrow(c) ? 500 : 0) + (c.s === trump ? 100 : 0) + rankValue(c.r);

export function botPlay(g: CrowsState, seat: number, _skill: CrowsSkill = 'high'): Card {
  const legal = legalCards(g, seat);
  if (legal.length === 1) return legal[0];
  const trump = g.trump;
  const out = remaining(g, seat);
  const myHand = g.hands[seat];
  const weBid = sideOf(seat) === sideOf(g.highBidder!);
  const trumpsOut = out.filter((c) => c.s === trump || isCrow(c)).length;

  // ----- leading -----
  if (g.trick.length === 0) {
    const myTrumps = legal.filter((c) => c.s === trump || isCrow(c));
    // Bidding side: pull the opponents' trump while we hold the top one.
    if (weBid && trumpsOut > 0 && myTrumps.length >= 2) {
      const top = myTrumps.slice().sort((a, b) => (isCrow(b) ? 99 : rankValue(b.r)) - (isCrow(a) ? 99 : rankValue(a.r)))[0];
      if (isBoss(top, g, seat)) return top;
    }
    // Cash a side-colour winner (best if it carries points).
    const bossSide = legal.filter((c) => !isCrow(c) && c.s !== trump && isBoss(c, g, seat));
    if (bossSide.length && (trumpsOut === 0 || bossSide.some((c) => cardPoints(c) > 0))) {
      return bossSide.sort((a, b) => cardPoints(b) - cardPoints(a) || rankValue(b.r) - rankValue(a.r))[0];
    }
    // Otherwise lead something cheap from a side colour (short colours first, to make voids).
    const side = legal.filter((c) => !isCrow(c) && c.s !== trump);
    const pool = side.length ? side : legal;
    return lowestBy(pool, (c) => dumpCost(trump)(c) + myHand.filter((h) => h.s === c.s).length * 2);
  }

  // ----- following -----
  const current = trickWinner(g.trick, trump);
  const partnerWinning = current === partnerOf(seat);
  const last = g.trick.length === 3;
  const trickPts = pointsOf(g.trick.map((t) => t.card));
  const winners = legal.filter((c) => wouldWin(g, seat, c));

  if (partnerWinning) {
    const partnerCard = g.trick.find((t) => t.seat === current)!.card;
    const safe = last || isBoss(partnerCard, g, seat);
    if (safe) {
      // Smear: give partner points, but never the Crow or trump just for that.
      const counters = legal.filter((c) => cardPoints(c) > 0 && !isCrow(c) && c.s !== trump);
      if (counters.length) return counters.sort((a, b) => cardPoints(b) - cardPoints(a))[0];
    }
    return lowestBy(legal, dumpCost(trump));
  }

  if (winners.length) {
    if (last) return lowestBy(winners, dumpCost(trump));        // win as cheaply as possible
    // Not last: prefer a winner nobody left can beat.
    const solid = winners.filter((c) => isBoss(c, g, seat));
    const worth = trickPts + 10 >= 15 || solid.some((c) => cardPoints(c) > 0);
    const nonCrowSolid = solid.filter((c) => !isCrow(c));
    if (nonCrowSolid.length) return lowestBy(nonCrowSolid, dumpCost(trump));
    // Save the Crow for a trick worth taking.
    const crow = solid.find(isCrow);
    if (crow && (trickPts >= 10 || myHand.length <= 2)) return crow;
    if (worth) {
      const nonCrow = winners.filter((c) => !isCrow(c));
      if (nonCrow.length) return nonCrow.sort((a, b) => rankValue(b.r) - rankValue(a.r))[0];
    }
  }
  // Can't (or shouldn't) win: throw the cheapest card.
  const noCrow = legal.filter((c) => !isCrow(c));
  return lowestBy(noCrow.length ? noCrow : legal, dumpCost(trump));
}

/** One step of a bot at seat `seat` in whatever phase the game is in. */
export function botAction(g: CrowsState, seat: number, skill: CrowsSkill = 'high', rnd: () => number = Math.random) {
  if (g.phase === 'bidding') return botBid(g, seat, skill, rnd);
  if (g.phase === 'nest') return botNest(g, seat);
  return { type: 'play' as const, seat, card: botPlay(g, seat, skill) };
}
