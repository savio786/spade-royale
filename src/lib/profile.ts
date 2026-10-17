import { useSyncExternalStore } from 'react';

export interface Friend { id: string; name: string; avatar: string; level: number; online: boolean }
export interface Profile {
  id: string;
  name: string;
  avatar: string;
  provider: 'guest' | 'facebook' | 'google' | 'apple' | null;
  coins: number;
  xp: number;
  vip: boolean;
  weekKey: string;
  weekEarnings: number;
  lastWeekRank: number | null;
  lastWeekClaimed: boolean;
  stats: { played: number; won: number; soloWins: number; partnersWins: number; nilsMade: number; biggestWin: number; bagsPenalties: number };
  friends: Friend[];
  lastDaily: string | null;     // free gift (yyyy-mm-dd)
  lastSpin: number;             // ms
  lastAd: number;               // ms
  claimed: string[];            // achievement ids
  settings: { sound: boolean; fast: boolean; vibrate: boolean };
  lastTable: { bet: number; minPoints: number; maxPoints: number } | null;
}

const KEY = 'spade-royale-profile-v1';

export function weekKey(d = new Date()) {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay()); // week starts Sunday
  return start.toISOString().slice(0, 10);
}
export function weekEndsAt(d = new Date()) {
  const end = new Date(d);
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() - end.getDay() + 7);
  return end.getTime();
}

const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function fresh(): Profile {
  return {
    id: rid(), name: '', avatar: 'a1', provider: null, coins: 50_000, xp: 0, vip: false,
    weekKey: weekKey(), weekEarnings: 0, lastWeekRank: null, lastWeekClaimed: true,
    stats: { played: 0, won: 0, soloWins: 0, partnersWins: 0, nilsMade: 0, biggestWin: 0, bagsPenalties: 0 },
    friends: [
      { id: 'f1', name: 'NilQueen', avatar: 'a4', level: 41, online: true },
      { id: 'f2', name: 'Big Joker', avatar: 'a7', level: 18, online: false },
      { id: 'f3', name: 'Amara', avatar: 'a10', level: 27, online: true },
    ],
    lastDaily: null, lastSpin: 0, lastAd: 0, claimed: [],
    settings: { sound: true, fast: false, vibrate: true },
    lastTable: null,
  };
}

function load(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = { ...fresh(), ...JSON.parse(raw) } as Profile;
      // weekly rollover
      if (p.weekKey !== weekKey()) {
        p.lastWeekRank = p.weekEarnings > 0 ? estimateRank(p.weekEarnings) : null;
        p.lastWeekClaimed = p.lastWeekRank === null;
        p.weekEarnings = 0;
        p.weekKey = weekKey();
      }
      return p;
    }
  } catch { /* storage unavailable */ }
  return fresh();
}

let state: Profile = load();
const subs = new Set<() => void>();
function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }

export const profile = {
  get: () => state,
  set(patch: Partial<Profile> | ((p: Profile) => Partial<Profile>)) {
    const p = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...p };
    persist();
    subs.forEach((f) => f());
  },
  addCoins(n: number) { profile.set((p) => ({ coins: Math.max(0, p.coins + n) })); },
  reset() { state = fresh(); persist(); subs.forEach((f) => f()); },
  subscribe(f: () => void) { subs.add(f); return () => subs.delete(f); },
};

export function useProfile() {
  return useSyncExternalStore(profile.subscribe, profile.get);
}

// ---- levels ----
export const levelFromXp = (xp: number) => Math.floor(Math.sqrt(xp / 60)) + 1;
export const xpForLevel = (lvl: number) => (lvl - 1) * (lvl - 1) * 60;

// ---- leaderboard (synthetic global field, deterministic per week) ----
export function seeded(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}
const LB_NAMES = ['InductiveConqueror', 'Fazia K', 'Linda', 'RUKiddingMe', 'Michael', 'SpadeSensei', 'Queen of Books', 'Tobias', 'Marisol', 'TrumpCardTina', 'Yusuf', 'DeltaDealer', 'Ingrid', 'SetTheTable', 'KwameK', 'Bagless Betty', 'Hiroshi', 'NightOwlNil', 'Carmen', 'LuckySeven', 'Olumide', 'Petra', 'BlindNilBob', 'Ravi', 'Chloe', 'MoonShooter', 'Gustavo', 'Hana', 'Felix', 'Ana Lucia'];
export interface LbRow { name: string; avatar: string; earnings: number; me?: boolean; move: -1 | 0 | 1 }
export function globalBoard(key = weekKey()): LbRow[] {
  const r = seeded(key);
  const elapsed = Math.min(1, Math.max(0.08, 1 - (weekEndsAt() - Date.now()) / (7 * 864e5)));
  return LB_NAMES.map((name, i) => ({
    name,
    avatar: `a${(i % 12) + 1}`,
    earnings: Math.round((16_000_000 * Math.pow(0.86, i) * (0.85 + r() * 0.3) * elapsed) / 25_000) * 25_000,
    move: (r() < 0.33 ? -1 : r() < 0.5 ? 0 : 1) as -1 | 0 | 1,
  })).sort((a, b) => b.earnings - a.earnings);
}
export function estimateRank(earnings: number) {
  const b = globalBoard();
  const above = b.filter((x) => x.earnings > earnings).length;
  if (above < b.length) return above + 1;
  // below the visible field: extrapolate
  return Math.min(9999, b.length + Math.round(Math.log(b[b.length - 1].earnings / Math.max(1, earnings)) * 120));
}
export function rewardForRank(rank: number | null) {
  if (!rank) return 0;
  if (rank === 1) return 50_000; if (rank === 2) return 25_000; if (rank === 3) return 10_000;
  if (rank <= 10) return 5_000; if (rank <= 50) return 2_500; if (rank <= 100) return 1_000;
  return 0;
}

export const fmt = (n: number) => n.toLocaleString('en-US');
export const short = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(n % 1e3 ? 1 : 0)}K` : String(n));

export const CITY_TIERS: { city: string; min: number }[] = [
  { city: 'New York', min: 100 }, { city: 'Chicago', min: 1_000 }, { city: 'Miami', min: 5_000 },
  { city: 'Seattle', min: 20_000 }, { city: 'Las Vegas', min: 100_000 }, { city: 'London', min: 500_000 }, { city: 'Monaco', min: 2_000_000 },
];
export const cityForBet = (bet: number) => ([...CITY_TIERS].reverse().find((t) => bet >= t.min) ?? CITY_TIERS[0]).city;
export const BET_STEPS = [100, 250, 500, 1_000, 2_500, 5_000, 10_000, 20_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_000_000, 5_000_000];
export const MAX_STEPS = [100, 150, 200, 250, 300, 350, 400, 500];
export const MIN_STEPS = [-100, -150, -200, -250, -300];
export function suggestedBet(coins: number) {
  const target = coins / 20;
  return [...BET_STEPS].reverse().find((b) => b <= target) ?? 100;
}
