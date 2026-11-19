// Crows Haven coins, XP and table bets — the same ideas as Spade Haven (owner decision 2026-11-16).
// The Crows Haven site is its own web address, so its saved profile (coins, level, name, picture) is separate from
// Spade Haven's: these are Crows Haven's own free coins. Nothing here can be bought; there is no shop.
import { profile, fmt } from '../lib/profile';
import { CROWS_BETS, crowsCity, prizeOf } from '../../shared/crows/bets';
import { sfx } from '../lib/sound';
import { toast } from '../lib/toast';

export { CROWS_BETS, crowsCity, prizeOf };
/** A bet that suits the player's balance (about a twentieth of it), like Spade Haven's Play Now. */
export function suggestedCrowsBet(coins: number) {
  return [...CROWS_BETS].reverse().find((b) => b <= coins / 20) ?? CROWS_BETS[0];
}
export const XP_PLAYED = 40, XP_WON = 80;

// Each table's bet is taken once and its prize paid once, even after a reload (kept on this device).
// No penalty for leaving (owner decision 2026-11-19): a bet for a game that didn't finish is given back.
const KEY = 'crowsPaid';
type Mark = { s: 'bet' | 'settled' | 'refunded'; bet: number; at: number };
const done = (): Record<string, Mark> => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, Mark | string>;
    const out: Record<string, Mark> = {};
    for (const [k, v] of Object.entries(raw)) if (v && typeof v === 'object' && Date.now() - v.at < 3 * 86400e3) out[k] = v;  // forget after 3 days
    return out;
  } catch { return {}; }
};
const state = (id: string) => done()[id]?.s;
const mark = (id: string, s: Mark['s'], bet: number) => { try { localStorage.setItem(KEY, JSON.stringify({ ...done(), [id]: { s, bet, at: Date.now() } })); } catch { /* private mode */ } };

/** Take the table bet when the first hand is dealt. Returns false if there aren't enough coins. */
export function chargeBet(gameId: string, bet: number): boolean {
  if (!bet || state(gameId)) return true;
  if (profile.get().coins < bet) return false;
  profile.addCoins(-bet);
  mark(gameId, 'bet', bet);
  return true;
}

/** Leaving before the game is over: give the bet back (no penalty for leaving). */
export function refundBet(gameId: string, quiet = false) {
  const m = done()[gameId];
  if (!m || m.s !== 'bet') return;
  mark(gameId, 'refunded', m.bet);
  profile.addCoins(m.bet);
  if (!quiet) toast(`Your ${fmt(m.bet)} coin bet was given back`, 'coins');
}

/** When the game opens: give back bets from games that were closed part-way (tab or app closed), except the table we're going back to. */
export function refundUnfinished(except?: string) {
  let back = 0;
  for (const [id, m] of Object.entries(done())) {
    if (m.s !== 'bet' || id === except) continue;
    refundBet(id, true);
    back += m.bet;
  }
  if (back) toast(`${fmt(back)} coins from an unfinished game were given back`, 'coins');
}

/** Game over: pay the prize to the winning side, add XP and the stats. Returns what was paid. */
export function settleGame(gameId: string, bet: number, won: boolean): { prize: number; xp: number } {
  const was = state(gameId);
  if (was === 'settled') return { prize: 0, xp: 0 };
  const charged = was === 'bet';
  mark(gameId, 'settled', bet);
  const prize = won && charged ? prizeOf(bet) : 0;
  const xp = XP_PLAYED + (won ? XP_WON : 0);
  profile.set((p) => ({
    coins: p.coins + prize,
    xp: p.xp + xp,
    weekEarnings: p.weekEarnings + Math.max(0, prize - bet),
    stats: { ...p.stats, played: p.stats.played + 1, won: p.stats.won + (won ? 1 : 0), partnersWins: p.stats.partnersWins + (won ? 1 : 0), biggestWin: Math.max(p.stats.biggestWin, prize) },
  }));
  if (prize) { sfx.coins(); toast(`+${fmt(prize)} coins`, 'coins'); }
  return { prize, xp };
}

/** Not enough coins for a table: say so (free coins come from the daily gift, the wheel and the bonus). */
export function notEnough(bet: number) {
  toast(`You need ${fmt(bet)} coins for this table — collect free coins from the gift, the wheel or the bonus.`, 'error');
}
