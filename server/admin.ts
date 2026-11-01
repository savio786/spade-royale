// Owner-only list of players who signed up. Locked behind the ADMIN_KEY secret set in Render (never in the code).
// Without ADMIN_KEY (16+ characters) this feature is switched off and the address answers "not found".
import { createHash, timingSafeEqual } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { listRecords } from './storage';
import type { Account } from './accounts';

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
// a spreadsheet would run a cell that starts with = + - @ as a formula: neutralise those
const cell = (v: unknown) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };

export async function adminApi(req: IncomingMessage, res: ServerResponse, url: URL, ip: string) {
  if (!adminEnabled) return send(res, 404, 'application/json', '{"error":"not found"}');
  if (req.method !== 'GET' || url.pathname !== '/api/admin/users') return send(res, 404, 'application/json', '{"error":"not found"}');
  const f = fails.get(ip);
  if (f && f.until > Date.now()) return send(res, 429, 'application/json', '{"error":"Too many wrong keys. Try again in 15 minutes."}');
  const given = String(req.headers['x-admin-key'] || '');
  if (!given || !timingSafeEqual(digest(given), digest(KEY))) {
    const n = (f && f.until > 0 && f.until <= Date.now() ? 0 : f?.n ?? 0) + 1;
    fails.set(ip, { n, until: n >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
    return send(res, 403, 'application/json', '{"error":"Wrong key."}');
  }
  fails.delete(ip);
  const accounts = await listRecords<Account>('acct-');
  const rows = accounts
    .map((a) => ({ name: a.name, kind: a.kind ?? 'guest', email: a.email ?? '', joined: a.createdAt || 0, lastSaved: a.updatedAt || 0 }))
    .sort((x, y) => y.joined - x.joined);
  const withEmail = rows.filter((r) => r.email);
  if (url.searchParams.get('format') === 'csv') {
    const list = url.searchParams.get('all') === '1' ? rows : withEmail;
    const head = 'name,sign-in type,email,joined,last saved';
    const iso = (t: number) => (t ? new Date(t).toISOString() : '');
    const body = [head, ...list.map((r) => [r.name, r.kind, r.email, iso(r.joined), iso(r.lastSaved)].map(cell).join(','))].join('\r\n');
    return send(res, 200, 'text/csv; charset=utf-8', body, { 'content-disposition': 'attachment; filename="spade-haven-players.csv"' });
  }
  const byKind: Record<string, number> = {};
  for (const r of rows) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
  return send(res, 200, 'application/json', JSON.stringify({ total: rows.length, withEmail: withEmail.length, byKind, rows: withEmail }));
}
