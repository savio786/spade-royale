// Owner's review list: accounts whose numbers look unusual. This only READS data and never bans, mutes or wipes anyone;
// every signal is a reason to take a closer look, not proof of cheating.
import type { Account } from './accounts';
import { snapshot } from './leaderboard';
import { auditSnapshot } from './audit';
import { isBanned, isMuted, sharedDeviceGroups } from './moderation';

const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };
const n = (v: number) => Math.round(v).toLocaleString('en-US');

export interface Signal { k: 'far-above' | 'shared-browser' | 'browser-reported' | 'steady-pace'; text: string }

export function reviewReport(accounts: Account[]) {
  const snap = snapshot();
  const au = auditSnapshot();
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const week = new Map(snap.players.map((p) => [p.id, p]));
  const all = new Map(snap.allTime.map((p) => [p.id, p]));
  const positives = snap.players.filter((p) => p.earnings > 0).map((p) => p.earnings);
  const med = median(positives);
  const groupOf = new Map<string, string[]>();
  for (const g of sharedDeviceGroups()) for (const id of g) groupOf.set(id, g);
  const nameOf = (id: string) => byId.get(id)?.name ?? week.get(id)?.name ?? all.get(id)?.name ?? id.slice(0, 8);

  const rows = [];
  for (const id of new Set([...week.keys(), ...all.keys()])) {
    const w = week.get(id)?.earnings ?? 0;
    const signals: Signal[] = [];

    if (positives.length >= 5 && w >= 1_000_000 && med > 0 && w >= med * 20) {
      signals.push({ k: 'far-above', text: `This week's winnings (${n(w)}) are about ${n(w / med)} times the typical player's (${n(med)}).` });
    }

    const grp = groupOf.get(id);
    if (grp) {
      const others = grp.filter((x) => x !== id && (week.has(x) || all.has(x) || byId.has(x)));
      if (others.length) signals.push({ k: 'shared-browser', text: `Played from the same browser as ${others.map(nameOf).slice(0, 6).join(', ')}.` });
    }

    const a = au.wk[id];
    if (a && a.bw >= 5 && a.bc / Math.max(1, a.bc + a.oc) >= 0.9) {
      signals.push({ k: 'browser-reported', text: `${a.bw} wins this week came from results reported by the player's own browser (games against computer players), ${a.ow} from real online games.` });
    }

    const t = au.botWinTimes[id] ?? [];
    if (t.length >= 8) {
      const gaps = t.slice(1).map((x, i) => (x - t[i]!) / 1000);
      const mg = median(gaps);
      if (mg < 60) signals.push({ k: 'steady-pace', text: `Its last ${t.length} browser-reported wins came about every ${Math.round(mg)} seconds, faster than a game can be played.` });
    }

    if (!signals.length) continue;
    const acct = byId.get(id);
    rows.push({
      id, name: nameOf(id), kind: acct?.kind ?? 'guest', email: acct?.email ?? '', joined: acct?.createdAt ?? 0,
      banned: isBanned(id), muted: isMuted(id),
      week: w, allTime: all.get(id)?.earnings ?? 0,
      botWins: au.wk[id]?.bw ?? 0, onlineWins: au.wk[id]?.ow ?? 0,
      signals,
    });
  }
  rows.sort((x, y) => y.signals.length - x.signals.length || y.week - x.week);
  return { week: snap.week, typical: Math.round(med), auditSince: au.since, rows: rows.slice(0, 60) };
}
