// Plays full computer-only games with the real engine, records them with the hand history recorder, and checks that every score explanation adds up to the engine's number.
import { applyAction, createGame, startRound, seatsOfSide } from '../shared/engine';
import { botBid, botPlay } from '../shared/bot';
import { makeBot } from '../shared/runtime';
(globalThis as any).localStorage = { _d: {} as Record<string, string>, getItem(k: string) { return this._d[k] ?? null; }, setItem(k: string, v: string) { this._d[k] = v; }, removeItem(k: string) { delete this._d[k]; } };
const { observe, hands } = await import('../src/lib/handlog');
const { explain } = await import('../src/lib/handscore');
const { viewFor } = await import('../shared/engine');
let hand = 0, bad = 0, incompleteTricks = 0, nils = 0;
for (let game = 0; game < 40; game++) {
  const mode = game % 2 ? 'solo' : 'partners';
  let g: any = createGame({ mode, bet: 100, minPoints: -100, maxPoints: 100, city: 'Seattle' } as any);
  g = { ...g, seats: [0, 1, 2, 3].map(() => makeBot()) };
  g = startRound(g);
  let guard = 0;
  while (g.phase !== 'gameOver' && guard++ < 5000) {
    const view = () => viewFor(g, 0);
    observe(view(), `g${game}`);
    if (g.phase === 'bidding') { const b = botBid(g, g.turn); g = applyAction(g, { type: 'bid', seat: g.turn, bid: b } as any); }
    else if (g.phase === 'playing') { const c = botPlay(g, g.turn); g = applyAction(g, { type: 'play', seat: g.turn, card: c } as any); }
    else if (g.phase === 'trickEnd') g = applyAction(g, { type: 'collect' } as any);
    else if (g.phase === 'roundEnd') g = applyAction(g, { type: 'nextRound' } as any);
    else break;
  }
  observe(viewFor(g, 0), `g${game}`);
}
for (const h of hands()) {
  hand++; if (h.tricks.length !== 13) incompleteTricks++;
  const sides = h.mode === 'partners' ? [0, 1] : [0, 1, 2, 3];
  for (const side of sides) {
    const lines = explain(h, side);
    const sum = lines.reduce((a, l) => a + l.p, 0);
    if (sum !== h.res!.delta[side] || (lines.length === 1 && lines[0].t === 'Hand total' && h.res!.delta[side] !== 0)) { bad++; if (bad < 4) console.log('MISMATCH', JSON.stringify(h.res), side, lines); }
    if (seatsOfSide(h.mode, side).some((s) => h.res!.bids[s] === 0)) nils++;
  }
}
console.log(`stored hands (ring buffer keeps last 20): ${hand} · hands with <13 tricks: ${incompleteTricks} · explanation mismatches/fallbacks: ${bad} · sides with a nil: ${nils}`);
const hs = hands(); console.log('kept after trimming:', hs.length);
