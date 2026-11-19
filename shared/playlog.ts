import type { Action, GameState, Card } from './engine';

/** A short record of the last few rounds played on this device (bids and every card in order), so a misplay can be replayed exactly.
 *  Kept in memory only, and only in the browser (the server does not use it). */
const MAX_ROUNDS = 4;
const rounds: string[][] = [];
const cs = (c: Card) => `${c.s}${({ 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: 'T' } as Record<number, string>)[c.r] ?? c.r}`;
const hand = (h: Card[]) => h.slice().sort((a, b) => (a.s === b.s ? b.r - a.r : a.s < b.s ? -1 : 1)).map(cs).join(' ');

export function logAction(g: GameState, a: Action) {
  if (typeof window === 'undefined') return;
  try {
    if (a.type === 'bid') {
      if (g.bids.every((b) => b === null)) {
        rounds.push([`Round ${g.round}, dealer seat ${g.dealer}, mode ${g.settings.mode}, bet ${g.settings.bet}`, ...g.hands.map((h, i) => `Seat ${i}${g.seats[i]?.bot ? ' (bot)' : ' (human)'}: ${hand(h)}`)]);
        while (rounds.length > MAX_ROUNDS) rounds.shift();
      }
      rounds[rounds.length - 1]?.push(`Bid seat ${a.seat}: ${a.bid === 0 ? 'NIL' : a.bid}`);
    } else if (a.type === 'play') {
      const r = rounds[rounds.length - 1];
      if (!r) return;
      const lead = g.trick.length === 0;
      r.push(`${lead ? '\nTrick: ' : ''}seat ${a.seat} ${cs(a.card)}${g.trick.length === 3 ? ' ->' : ','}`);
    } else if (a.type === 'collect') {
      const r = rounds[rounds.length - 1];
      if (r && g.lastTrickWinner !== null) r.push(`won by seat ${g.lastTrickWinner}`);
    }
  } catch { /* the log must never get in the way of the game */ }
}

export function roundLogText(): string {
  return rounds.length ? rounds.map((r) => r.join('\n')).join('\n\n----------\n\n') : '';
}
