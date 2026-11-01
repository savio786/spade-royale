// Owner-only tools: the list of players who signed up, suspending cheaters, wiping their winnings and reading player reports.
// Locked behind the ADMIN_KEY secret set in Render (never in the code). Without ADMIN_KEY (16+ characters) it is all switched off
// and every address here answers "not found".
import { createHash, timingSafeEqual } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { exportAll, listRecords } from './storage';
import type { Account } from './accounts';
import { ban, dismissReport, isBanned, isMuted, listBans, listMuted, listReports, mute, unban, unmute } from './moderation';
import { removePlayer } from './leaderboard';

const KEY = (process.env.ADMIN_KEY || '').trim();
export const adminEnabled = KEY.length >= 16;
const digest = (s: string) => createHash('sha256').update(s).digest();

// too many wrong keys from one address: locked out for 15 minutes
const fails = new Map<string, { n: number; until: number }>();
const MAX_FAILS = 5, LOCK_MS = 15 * 60_000;

const send = (res: ServerResponse, code: number, type: string, body: string, extra: Record<string, string> = {}) => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', 'x-robots-tag': 'noindex', ...extra });
  res.end(body);
};
const json = (res: ServerResponse, code: number, body: unknown) => send(res, code, 'application/json', JSON.stringify(body));
// a spreadsheet would run a cell that starts with = + - @ as a formula: neutralise those
const cell = (v: unknown) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
const body = (req: IncomingMessage) => new Promise<Record<string, unknown>>((resolve) => {
  let raw = ''; req.on('data', (d) => { raw += d; if (raw.length > 4000) req.destroy(); });
  req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); } });
  req.on('error', () => resolve({}));
});
const acctId = (id: unknown) => String(id ?? '').slice(0, 64);

export async function adminApi(req: IncomingMessage, res: ServerResponse, url: URL, ip: string, onBan: (id: string) => void) {
  if (!adminEnabled) return json(res, 404, { error: 'not found' });
  const p = url.pathname;
  const known = (req.method === 'GET' && ['/api/admin/users', '/api/admin/find', '/api/admin/bans', '/api/admin/reports', '/api/admin/muted', '/api/admin/backup'].includes(p))
    || (req.method === 'POST' && ['/api/admin/ban', '/api/admin/unban', '/api/admin/wipe', '/api/admin/mute', '/api/admin/unmute', '/api/admin/reports/dismiss'].includes(p));
  if (!known) return json(res, 404, { error: 'not found' });
  const f = fails.get(ip);
  if (f && f.until > Date.now()) return json(res, 429, { error: 'Too many wrong keys. Try again in 15 minutes.' });
  const given = String(req.headers['x-admin-key'] || '');
  if (!given || !timingSafeEqual(digest(given), digest(KEY))) {
    const n = (f && f.until > 0 && f.until <= Date.now() ? 0 : f?.n ?? 0) + 1;
    fails.set(ip, { n, until: n >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
    return json(res, 403, { error: 'Wrong key.' });
  }
  fails.delete(ip);

  if (p === '/api/admin/backup') {   // everything the game stores, as one file (it contains password hashes and account keys: keep it private)
    const all = await exportAll(url.searchParams.get('photos') === '1');
    const day = new Date().toISOString().slice(0, 10);
    return send(res, 200, 'application/json; charset=utf-8', JSON.stringify({ app: 'spade-haven', exportedAt: new Date().toISOString(), records: all }), { 'content-disposition': `attachment; filename="spade-haven-backup-${day}.json"` });
  }

  const accounts = await listRecords<Account>('acct-');
  const row = (a: Account) => ({ id: a.id, name: a.name, kind: a.kind ?? 'guest', email: a.email ?? '', joined: a.createdAt || 0, lastSaved: a.updatedAt || 0, banned: isBanned(a.id), muted: isMuted(a.id) });

  if (p === '/api/admin/users') {
    const rows = accounts.map(row).sort((x, y) => y.joined - x.joined);
    const withEmail = rows.filter((r) => r.email);
    if (url.searchParams.get('format') === 'csv') {
      const list = url.searchParams.get('all') === '1' ? rows : withEmail;
      const iso = (t: number) => (t ? new Date(t).toISOString() : '');
      const text = ['name,sign-in type,email,joined,last saved', ...list.map((r) => [r.name, r.kind, r.email, iso(r.joined), iso(r.lastSaved)].map(cell).join(','))].join('\r\n');
      return send(res, 200, 'text/csv; charset=utf-8', text, { 'content-disposition': 'attachment; filename="spade-haven-players.csv"' });
    }
    const byKind: Record<string, number> = {};
    for (const r of rows) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
    return json(res, 200, { total: rows.length, withEmail: withEmail.length, byKind, rows: url.searchParams.get('all') === '1' ? rows : withEmail });
  }
  if (p === '/api/admin/find') {   // any player, guests included, by name or email
    const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
    if (q.length < 2) return json(res, 200, { rows: [] });
    return json(res, 200, { rows: accounts.filter((a) => a.name.toLowerCase().includes(q) || (a.email ?? '').toLowerCase().includes(q)).slice(0, 30).map(row) });
  }
  if (p === '/api/admin/muted') return json(res, 200, { rows: listMuted() });
  if (p === '/api/admin/bans') return json(res, 200, { rows: listBans() });
  if (p === '/api/admin/reports') return json(res, 200, { rows: listReports().map((r) => ({ ...r, targetBanned: isBanned(r.targetId), targetMuted: isMuted(r.targetId) })) });

  const b = await body(req);
  if (p === '/api/admin/reports/dismiss') { dismissReport(Number(b.n)); return json(res, 200, { ok: true }); }
  const id = acctId(b.id);
  const a = accounts.find((x) => x.id === id);
  if (!a) return json(res, 404, { error: 'That account was not found.' });
  if (p === '/api/admin/ban') { ban(a.id, a.name, String(b.reason || ''), a.email); onBan(a.id); return json(res, 200, { ok: true }); }
  if (p === '/api/admin/unban') { unban(a.id); return json(res, 200, { ok: true }); }
  if (p === '/api/admin/mute') { mute(a.id, a.name, String(b.reason || '')); return json(res, 200, { ok: true }); }
  if (p === '/api/admin/unmute') { unmute(a.id); return json(res, 200, { ok: true }); }
  if (p === '/api/admin/wipe') { removePlayer(a.id, a.name); return json(res, 200, { ok: true }); }
  return json(res, 404, { error: 'not found' });
}
