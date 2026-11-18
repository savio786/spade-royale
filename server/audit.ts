// A small record of HOW each account's winnings arrived, so the owner can review suspicious accounts.
// Read-only bookkeeping: nothing here changes the game, bans anyone or touches the leaderboard.
//   online = a real game finished on the server (the server decided the winner)
//   bot    = a result the player's own browser reported after a practice game against computer players (the server cannot check it; these no longer count on the boards, they are only noted here)
import { loadJSON, saveJSON } from './storage';
import { weekKey } from './leaderboard';

export interface Audit {
  since: number;            // when this record started (older winnings cannot be classified)
  week: string;
  wk: Record<string, { bw: number; bc: number; ow: number; oc: number }>;     // this week: bot wins/coins, online wins/coins
  all: Record<string, { bw: number; bc: number; ow: number; oc: number }>;    // since the record started
  botWinTimes: Record<string, number[]>;   // last bot-win times per account (for the pace check)
}

let store: Audit = { since: Date.now(), week: weekKey(), wk: {}, all: {}, botWinTimes: {} };
export async function initAudit() {
  const loaded = await loadJSON<Audit>('audit', store);
  store = { ...store, ...loaded };
  if (!store.wk) store.wk = {}; if (!store.all) store.all = {}; if (!store.botWinTimes) store.botWinTimes = {};
}
const save = () => saveJSON('audit', () => store);
const blank = () => ({ bw: 0, bc: 0, ow: 0, oc: 0 });

function roll() {
  const now = weekKey();
  if (store.week !== now) { store.week = now; store.wk = {}; }
}

/** Call when a player is credited with a win. */
export function noteWin(id: string, source: 'bot' | 'online', coins: number) {
  if (!id || !(coins > 0)) return;
  roll();
  for (const bucket of [store.wk, store.all]) {
    const e = bucket[id] ?? (bucket[id] = blank());
    if (source === 'bot') { e.bw++; e.bc += coins; } else { e.ow++; e.oc += coins; }
  }
  if (source === 'bot') {
    const t = store.botWinTimes[id] ?? (store.botWinTimes[id] = []);
    t.push(Date.now());
    if (t.length > 30) t.splice(0, t.length - 30);
    if (Object.keys(store.botWinTimes).length > 5000) store.botWinTimes = { [id]: t };   // safety cap
  }
  save();
}

export function auditSnapshot() {
  roll();
  return { since: store.since, wk: store.wk, all: store.all, botWinTimes: store.botWinTimes };
}
