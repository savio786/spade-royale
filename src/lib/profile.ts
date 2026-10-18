import { useSyncExternalStore } from 'react';

export interface Friend { id: string; name: string; avatar: string; level: number; online: boolean }
export interface Profile {
  id: string;
  name: string;
  avatar: string;
  provider: 'guest' | 'email' | 'facebook' | 'google' | 'apple' | null;
  email?: string | null;        // signed-in email (email / Google / Facebook accounts)
  coins: number;
  xp: number;
  vip: boolean;
  weekKey: string;
  weekEarnings: number;
  claimedWeeks: string[];       // weeks whose leaderboard reward was collected
  stats: { played: number; won: number; soloWins: number; partnersWins: number; nilsMade: number; biggestWin: number; bagsPenalties: number };
  friends: Friend[];
  card: { last5: string; nil: number; nilMade: number; blind: number; blindMade: number; rings: Record<string, number> };
  lastDaily: string | null;     // free gift (yyyy-mm-dd)
  lastSpin: number;             // ms
  lastAd: number;               // ms
  claimed: string[];            // achievement ids
  settings: { sound: boolean; fast: boolean; vibrate: boolean; chatOff?: boolean; music?: boolean };
  lastTable: { bet: number; minPoints: number; maxPoints: number } | null;
  chatUntil: number;            // Chat Pass: ms epoch it runs until, -1 = lifetime, 0 = none
  guestKey: string | null;      // guest account secret (server-side saved progress)
  guestCode: string | null;     // guest restore code shown to the player, e.g. K7QM-4XPT
  updatedAt: number;            // last local change (ms), used to sync with the server
  theme: string | null;         // chosen table & card theme (see themes.ts)
}

// v2: every player starts over with a brand-new account (old v1 data is ignored and removed)
const KEY = 'spade-royale-profile-v2';
try { localStorage.removeItem('spade-royale-profile-v1'); } catch { /* storage unavailable */ }

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
    weekKey: weekKey(), weekEarnings: 0, claimedWeeks: [],
    stats: { played: 0, won: 0, soloWins: 0, partnersWins: 0, nilsMade: 0, biggestWin: 0, bagsPenalties: 0 },
    friends: [],
    card: { last5: '', nil: 0, nilMade: 0, blind: 0, blindMade: 0, rings: {} },
    lastDaily: null, lastSpin: 0, lastAd: 0, claimed: [],
    settings: { sound: true, fast: false, vibrate: true },
    lastTable: null,
    chatUntil: 0,
    guestKey: null,
    guestCode: null,
    updatedAt: 0,
    theme: null,
  };
}

function load(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = { ...fresh(), ...JSON.parse(raw) } as Profile;
      // weekly rollover
      if (p.weekKey !== weekKey()) {
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
const beforeReset = new Set<(p: Profile) => void>();
function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }

export const profile = {
  get: () => state,
  set(patch: Partial<Profile> | ((p: Profile) => Partial<Profile>)) {
    const p = typeof patch === 'function' ? patch(state) : patch;
    state = { ...state, ...p, updatedAt: Date.now() };
    persist();
    subs.forEach((f) => f());
  },
  addCoins(n: number) { profile.set((p) => ({ coins: Math.max(0, p.coins + n) })); },
  /** Replace the whole profile (e.g. progress loaded from the server). */
  replace(p: Profile) { state = { ...fresh(), ...p }; persist(); subs.forEach((f) => f()); },
  reset() { beforeReset.forEach((f) => f(state)); state = fresh(); persist(); subs.forEach((f) => f()); },
  onBeforeReset(f: (p: Profile) => void) { beforeReset.add(f); },
  subscribe(f: () => void) { subs.add(f); return () => subs.delete(f); },
};

export function useProfile() {
  return useSyncExternalStore(profile.subscribe, profile.get);
}

// ---- levels ----
export const levelFromXp = (xp: number) => Math.floor(Math.sqrt(xp / 60)) + 1;
export const xpForLevel = (lvl: number) => (lvl - 1) * (lvl - 1) * 60;

// ---- small deterministic RNG (used for bot-table variety in the online lobby) ----
export function seeded(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

// ---- weekly leaderboard rewards (the board itself lives on the server: src/lib/api.ts) ----
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

/** The numbers this player shows on their profile card at tables. */
export function publicStats(p: Profile): import('../../shared/engine').PublicStats {
  const c = p.card ?? { last5: '', nil: 0, nilMade: 0, blind: 0, blindMade: 0, rings: {} };
  return { coins: p.coins, played: p.stats.played, won: p.stats.won, last5: c.last5, nil: c.nil, nilMade: c.nilMade, blind: c.blind, blindMade: c.blindMade, rings: c.rings };
}
