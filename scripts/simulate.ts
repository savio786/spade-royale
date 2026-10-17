// Plays many full bot-vs-bot games to check the engine never stalls or breaks rules.
import { applyAction, createGame, Mode, startRound, GameState } from '../shared/engine';
import { botBid, botPlay } from '../shared/bot';

function playGame(mode: Mode, maxPoints: number, minPoints: number) {
  const seats = [0, 1, 2, 3].map((i) => ({ id: `bot:${i}`, name: `B${i}`, avatar: 'a1', level: 1, bot: true }));
  let g: GameState = startRound(createGame({ mode, bet: 100, maxPoints, minPoints, city: 'Test' }, seats));
  let steps = 0, nils = 0, nilMade = 0;
  while (g.phase !== 'gameOver') {
    if (++steps > 20000) throw new Error('stalled');
    if (g.phase === 'bidding') g = applyAction(g, { type: 'bid', seat: g.turn, bid: botBid(g, g.turn) });
    else if (g.phase === 'playing') g = applyAction(g, { type: 'play', seat: g.turn, card: botPlay(g, g.turn) });
    else if (g.phase === 'trickEnd') g = applyAction(g, { type: 'collect' });
    else if (g.phase === 'roundEnd') g = applyAction(g, { type: 'nextRound' });
  }
  for (const h of g.history) for (const n of h.nilResults) if (n !== null) { nils++; if (n) nilMade++; }
  const made = g.history.reduce((acc, h) => acc + h.delta.filter((d) => d > 0).length, 0);
  return { rounds: g.round, scores: g.scores, nils, nilMade, made, sides: g.history.length * g.scores.length };
}

for (const mode of ['partners', 'solo'] as Mode[]) {
  let rounds = 0, nils = 0, nilMade = 0, made = 0, sides = 0;
  const N = 2000;
  for (let i = 0; i < N; i++) {
    const r = playGame(mode, 500, -200);
    rounds += r.rounds; nils += r.nils; nilMade += r.nilMade; made += r.made; sides += r.sides;
  }
  console.log(`${mode}: ${N} games OK, avg rounds ${(rounds / N).toFixed(1)}, contracts positive ${(100 * made / sides).toFixed(0)}%, nil bids ${nils} (${(100 * nilMade / Math.max(1, nils)).toFixed(0)}% made)`);
}
