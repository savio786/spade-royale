import { Card, GameState, legalCards, sideOf, seatsOfSide, Suit, trickWinner } from './engine';

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
const lowestNonSpadeFirst = (cs: Card[]) => {
  const ns = cs.filter((c) => c.s !== 'S');
  return ns.length ? ns.reduce((a, b) => (b.r < a.r ? b : a)) : cs.reduce((a, b) => (b.r < a.r ? b : a));
};

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
  if (partnerNil) {
    const partnerPlayed = g.trick.some((t) => t.seat === partner);
    const best = currentBest(g);
    if (leading) return highest(legal.filter((c) => c.s !== 'S').length ? legal.filter((c) => c.s !== 'S') : legal);
    if (best === partner || !partnerPlayed) {
      const winners = legal.filter((c) => beats(c, g));
      if (winners.length) return highest(winners);
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
export type BotSkill = 'medium' | 'high';
/** Tables with a bet at or above this use high-skill computer players; smaller tables use medium. */
export const HIGH_SKILL_BET = 25_000;
export const skillForBet = (bet: number): BotSkill => (bet >= HIGH_SKILL_BET ? 'high' : 'medium');

/** High plays the full strategy. Medium misjudges some bids and makes occasional loose plays. */
export function skilledBid(g: GameState, seat: number, skill: BotSkill): number {
  const best = botBid(g, seat);
  if (skill === 'high') return best;
  if (best === 0) return Math.random() < 0.35 ? 1 : 0;               // sometimes too timid to go nil
  if (Math.random() < 0.3) return Math.max(1, Math.min(13, best + (Math.random() < 0.5 ? -1 : 1)));
  return best;
}
export function skilledPlay(g: GameState, seat: number, skill: BotSkill): Card {
  if (skill === 'high' || Math.random() >= 0.22) return botPlay(g, seat);
  const legal = legalCards(g, seat);
  return legal[Math.floor(Math.random() * legal.length)];
}
