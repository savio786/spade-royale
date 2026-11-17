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

// Each table's bet is taken once and its prize paid once, even after a reload (kept for this browser tab).
const KEY = 'crowsPaid';
const done = (): Record<string, string> => { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const mark = (id: string, what: string) => { try { sessionStorage.setItem(KEY, JSON.stringify({ ...done(), [id]: what })); } catch { /* private mode */ } };

/** Take the table bet when the first hand is dealt. Returns false if there aren't enough coins. */
export function chargeBet(gameId: string, bet: number): boolean {
  if (!bet || done()[gameId]) return true;
  if (profile.get().coins < bet) return false;
  profile.addCoins(-bet);
  mark(gameId, 'bet');
  return true;
}

/** Game over: pay the prize to the winning side, add XP and the stats. Returns what was paid. */
export function settleGame(gameId: string, bet: number, won: boolean): { prize: number; xp: number } {
  if (done()[gameId] === 'settled') return { prize: 0, xp: 0 };
  const charged = done()[gameId] === 'bet';
  mark(gameId, 'settled');
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
