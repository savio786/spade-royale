// Crows Haven: rule tests plus thousands of bot-vs-bot games, checking the engine never stalls or breaks a rule.
// Run: npx tsx scripts/simulate-crows.ts   (Spades has its own: npm run sim)
import {
  applyAction, createGame, startRound, legalCards, trickWinner, pointsOf, newDeck, sideOf,
  Card, CrowsState, DECK_POINTS, HAND_SIZE, NEST_SIZE, MAX_BID, MIN_BID, RuleError, CROW,
} from '../shared/crows/engine';
import { botAction, CrowsSkill } from '../shared/crows/bot';

let failures = 0;
function check(cond: unknown, msg: string) { if (!cond) { failures++; console.error('FAIL:', msg); } }
const c = (s: Card['s'], r: number): Card => ({ s, r });
const seats = [0, 1, 2, 3].map((i) => ({ id: `bot:${i}`, name: `B${i}`, avatar: 'a1', level: 1, bot: true }));

// ---------- fixed rule tests ----------
{
  const d = newDeck();
  check(d.length === 45, 'deck has 45 cards (1, 5–14 in four colours + the Crow)');
  check(pointsOf(d) === DECK_POINTS && DECK_POINTS === 180, 'deck has 180 points');
  check(pointsOf([c('sky', 1)]) === 15, 'a 1 is worth 15');

  // A playing state built by hand: trump = moss.
  const base = (hands: Card[][], trick: { seat: number; card: Card }[] = [], turn = 0): CrowsState => ({
    ...createGame({}, seats), phase: 'playing', trump: 'moss', hands, trick, turn, highBidder: 0, highBid: 70,
  });
  // Following a non-trump colour: must follow, but the Crow is always allowed.
  let g = base([[c('sky', 6), c('ember', 9), CROW], [], [], []], [{ seat: 3, card: c('sky', 12) }]);
  let legal = legalCards(g, 0);
  check(legal.length === 2 && legal.some((x) => x.s === 'crow') && legal.some((x) => x.s === 'sky'), 'Crow playable while following another colour');
  // Trump led, Crow is my only trump: must play it.
  g = base([[c('sky', 6), CROW], [], [], []], [{ seat: 3, card: c('moss', 7) }]);
  legal = legalCards(g, 0);
  check(legal.length === 1 && legal[0].s === 'crow', 'Crow forced when trump led and it is the only trump');
  // Crow led: everyone must play trump if they can.
  g = base([[c('moss', 5), c('sky', 14)], [], [], []], [{ seat: 3, card: CROW }]);
  legal = legalCards(g, 0);
  check(legal.length === 1 && legal[0].s === 'moss', 'Crow led counts as trump led');
  // Void: anything goes.
  g = base([[c('ember', 5), c('moss', 6)], [], [], []], [{ seat: 3, card: c('sky', 9) }]);
  check(legalCards(g, 0).length === 2, 'void in colour led: any card');
  // Winners.
  check(trickWinner([{ seat: 0, card: c('sky', 14) }, { seat: 1, card: c('moss', 5) }, { seat: 2, card: c('sky', 13) }, { seat: 3, card: c('ember', 14) }], 'moss') === 1, 'low trump beats 14 of colour led');
  check(trickWinner([{ seat: 0, card: c('moss', 1) }, { seat: 1, card: CROW }], 'moss') === 1, 'Crow beats the 1 of trump');
  check(trickWinner([{ seat: 0, card: c('sky', 14) }, { seat: 1, card: c('sky', 1) }, { seat: 2, card: c('sky', 13) }], 'moss') === 1, 'the 1 beats the 14 of its colour');
  check(trickWinner([{ seat: 0, card: c('moss', 14) }, { seat: 1, card: c('moss', 1) }], 'moss') === 1, 'the 1 of trump beats the 14 of trump');
  check(trickWinner([{ seat: 0, card: c('sky', 8) }, { seat: 1, card: c('ember', 14) }, { seat: 2, card: c('sky', 9) }], 'moss') === 2, 'off-colour card cannot win');

  // Bidding: dealer opens, everybody passes → dealer forced at 70.
  let b = startRound(createGame({}, seats, () => 0.1), () => 0.3);
  const dealer = b.dealer;
  check(b.turn === dealer, 'dealer bids first');
  for (let i = 0; i < 4; i++) b = applyAction(b, { type: 'pass', seat: b.turn });
  check(b.phase === 'nest' && b.highBidder === dealer && b.highBid === MIN_BID && b.forced, 'all pass: dealer takes it at the minimum (100)');
  check(b.hands[dealer].length === HAND_SIZE + NEST_SIZE, 'bidder picks up the nest');
  // Bad bids are refused.
  b = startRound(createGame({}, seats, () => 0.1), () => 0.3);
  let threw = false; try { applyAction(b, { type: 'bid', seat: b.turn, bid: 72 }); } catch (e) { threw = e instanceof RuleError; }
  check(threw, 'bids must be in steps of 5');
  threw = false; try { applyAction(b, { type: 'bid', seat: b.turn, bid: MAX_BID + 5 }); } catch (e) { threw = e instanceof RuleError; }
  check(threw, 'bids cannot pass 180');
  // A bid of 120 ends bidding at once.
  b = applyAction(b, { type: 'bid', seat: b.turn, bid: MAX_BID });
  check(b.phase === 'nest', 'the top bid (180) ends the bidding');

  // Scoring: set bid loses its amount, the other side keeps its points.
  const s: CrowsState = { ...createGame({}, seats), phase: 'trickEnd', highBidder: 0, highBid: 100, trump: 'sky', lastTrickWinner: 1,
    taken: [[c('sky', 14), c('ember', 10), c('moss', 5)], [CROW, c('plum', 14)]], nest: [c('sky', 10)], hands: [[], [], [], []] };
  const r = applyAction(s, { type: 'collect' });
  check(r.history[0].points[0] === 25 && r.history[0].points[1] === 40, 'last trick side gets the nest points');
  check(r.scores[0] === -100 && r.scores[1] === 40, 'set: bidders lose the bid, opponents keep their points');
}

// ---------- bot games ----------
function playGame(skill: CrowsSkill, rnd: () => number) {
  let g = startRound(createGame({ target: 500 }, seats, rnd), rnd);
  let steps = 0;
  while (g.phase !== 'gameOver') {
    if (++steps > 50000) throw new Error('stalled');
    if (g.phase === 'bidding' || g.phase === 'nest' || g.phase === 'playing') {
      const before = g;
      const a = botAction(g, g.turn, skill, rnd);
      if (a.type === 'play') check(legalCards(g, a.seat).some((x) => x.s === a.card.s && x.r === a.card.r), 'bot played an illegal card');
      g = applyAction(g, a, rnd);
      if (before.phase === 'nest') {
        const total = g.hands.reduce((n, h) => n + h.length, 0) + g.nest.length;
        check(total === 45 && g.hands.every((h) => h.length === HAND_SIZE), 'cards conserved after the nest');
      }
    } else if (g.phase === 'trickEnd') g = applyAction(g, { type: 'collect' }, rnd);
    else if (g.phase === 'roundEnd') g = applyAction(g, { type: 'nextRound' }, rnd);
  }
  for (const h of g.history) check(h.points[0] + h.points[1] === DECK_POINTS, 'every hand scores exactly 180 points');
  check(g.scores.some((s) => s >= 500) && g.scores[0] !== g.scores[1], 'game ends at 500 with a clear winner');
  return g;
}

let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
for (const skill of ['high', 'medium'] as CrowsSkill[]) {
  const N = 2000;
  let hands = 0, made = 0, forced = 0, bidSum = 0, ptsSum = 0, sideWins = [0, 0];
  for (let i = 0; i < N; i++) {
    const g = playGame(skill, rnd);
    for (const h of g.history) { hands++; if (h.made) made++; if (h.forced) forced++; bidSum += h.bid; ptsSum += h.points[sideOf(h.bidder)]; }
    sideWins[g.winners[0]]++;
  }
  console.log(`${skill}: ${N} games OK · ${(hands / N).toFixed(1)} hands/game · bids made ${(100 * made / hands).toFixed(0)}% · avg bid ${(bidSum / hands).toFixed(0)} · bidders take ${(ptsSum / hands).toFixed(0)} pts · dealer stuck ${(100 * forced / hands).toFixed(0)}%`);
}
if (failures) { console.error(`${failures} check(s) failed`); process.exit(1); }
console.log('All Crows Haven checks passed.');
