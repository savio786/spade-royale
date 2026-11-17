// Crows Haven table bets and their cities (the same cities and pictures as Spade Haven's tables).
// Shared by the game and its server (crows-server/), so both agree on which bets exist.

export const CROWS_BETS = [100, 250, 500, 1_000, 2_500, 5_000, 10_000, 20_000, 50_000, 100_000, 250_000, 500_000];
const CITIES: { city: string; min: number }[] = [
  { city: 'New York', min: 100 }, { city: 'Chicago', min: 1_000 }, { city: 'Miami', min: 5_000 },
  { city: 'Seattle', min: 20_000 }, { city: 'Las Vegas', min: 100_000 }, { city: 'London', min: 500_000 },
];
export const crowsCity = (bet: number) => ([...CITIES].reverse().find((t) => bet >= t.min) ?? CITIES[0]).city;
export const normBet = (b: unknown) => (CROWS_BETS.includes(Number(b)) ? Number(b) : 0);
/** The winning side's players each get this back: their bet plus 80%. */
export const prizeOf = (bet: number) => Math.round(bet * 1.8);
