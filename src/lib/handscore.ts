// Turns a scored hand into plain-language score lines, using the same arithmetic as the engine's scoreRound.
import { seatsOfSide } from '../../shared/engine';
import type { HandRec } from './handlog';

const first = (r: HandRec, seat: number) => (r.names[seat] || 'Player').split(' ')[0].slice(0, 9);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** The score lines for one side, worked out the same way the engine scores a hand. If they ever failed to add up to the engine's total, only the total is shown. */
export function explain(r: HandRec, side: number) {
  const res = r.res!;
  const lines: { t: string; p: number }[] = [];
  let contract = 0, won = 0;
  for (const s of seatsOfSide(r.mode, side)) {
    const b = res.bids[s] ?? 0;
    won += res.tricks[s];
    if (b === 0) {
      const ok = !!res.nilResults[s], blind = !!res.blind?.[s], worth = blind ? 200 : 100;
      lines.push({ t: `${s === r.me ? 'You' : first(r, s)} bid ${blind ? 'blind ' : ''}nil and ${ok ? 'made it' : s === r.me ? 'were set' : 'was set'}`, p: ok ? worth : -worth });
    } else contract += b;
  }
  if (contract > 0) {
    if (won >= contract) {
      lines.push({ t: `Bid ${contract}, took ${won}: made it (${contract} × 10)`, p: contract * 10 });
      if (won > contract) lines.push({ t: `${plural(won - contract, 'extra trick')} (${plural(won - contract, 'bag')}, 1 point each)`, p: won - contract });
    } else lines.push({ t: `Bid ${contract}, took ${won}: missed (${contract} × 10)`, p: -contract * 10 });
  } else if (won > 0) lines.push({ t: `${plural(won, 'trick')} taken with no contract: all bags, 1 point each`, p: won });
  if (res.bagPenalty[side]) lines.push({ t: '10 bags reached: bag penalty', p: -100 });
  const sum = lines.reduce((a, l) => a + l.p, 0);
  return sum === res.delta[side] ? lines : [{ t: 'Hand total', p: res.delta[side] }];
}

