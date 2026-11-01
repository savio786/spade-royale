// Owner-only page: the list of players who signed up with an email. Needs the ADMIN_KEY secret (kept in memory only).
import { useEffect, useMemo, useState } from 'react';

interface Row { name: string; kind: string; email: string; joined: number; lastSaved: number }
interface Data { total: number; withEmail: number; byKind: Record<string, number>; rows: Row[] }
const date = (t: number) => (t ? new Date(t).toLocaleString() : '');
const KIND: Record<string, string> = { email: 'Email', google: 'Google', facebook: 'Facebook', guest: 'Guest' };

export function AdminPage() {
  const [key, setKey] = useState('');
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  useEffect(() => {
    document.title = 'Owner · Spade Haven';
    const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex,nofollow'; document.head.appendChild(m);
    return () => { m.remove(); document.title = 'Spade Haven'; };
  }, []);

  const load = async () => {
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/admin/users', { headers: { 'x-admin-key': key.trim() }, cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(r.status === 404 ? 'This page is not switched on yet: add ADMIN_KEY in Render.' : j.error || 'Could not load.'); setData(null); }
      else setData(j as Data);
    } catch { setErr('Could not reach the server.'); }
    setBusy(false);
  };
  const download = async () => {
    const r = await fetch('/api/admin/users?format=csv', { headers: { 'x-admin-key': key.trim() }, cache: 'no-store' });
    if (!r.ok) { setErr('Could not download.'); return; }
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a'); a.href = url; a.download = 'spade-haven-players.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data ? data.rows.filter((r) => !s || r.email.toLowerCase().includes(s) || r.name.toLowerCase().includes(s)) : [];
  }, [data, q]);

  return (
    <div className="legal-page">
      <header className="legal-top"><a href="/" className="legal-brand">♠ Spade Haven · Owner</a></header>
      <article className="legal-body">
        <h1>Players who signed up</h1>
        {!data ? (
          <form onSubmit={(e) => { e.preventDefault(); if (key.trim()) void load(); }}>
            <p>Enter your owner key (the ADMIN_KEY you set in Render).</p>
            <input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Owner key" style={{ padding: '10px 12px', fontSize: 16, width: '100%', maxWidth: 360, borderRadius: 8, border: '1px solid #6f7bd6', background: '#0b0d33', color: '#fff' }} />
            <p><button type="submit" disabled={busy || !key.trim()} className="pill gold small-pill">{busy ? 'Checking…' : 'Show players'}</button></p>
            {err && <p style={{ color: '#ff8a8a' }}>{err}</p>}
          </form>
        ) : (
          <>
            <p>{data.withEmail} players with an email · {data.total} accounts in all ({Object.entries(data.byKind).map(([k, n]) => `${KIND[k] ?? k}: ${n}`).join(' · ')}). Guests have no email.</p>
            <p style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" style={{ padding: '8px 10px', fontSize: 16, borderRadius: 8, border: '1px solid #6f7bd6', background: '#0b0d33', color: '#fff', minWidth: 220 }} />
              <button className="pill gold small-pill" onClick={() => void download()}>Download spreadsheet (CSV)</button>
              <button className="pill small-pill" onClick={() => void load()}>Refresh</button>
            </p>
            {err && <p style={{ color: '#ff8a8a' }}>{err}</p>}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 15 }}>
                <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #6f7bd6' }}><th style={{ padding: 6 }}>Name</th><th style={{ padding: 6 }}>Email</th><th style={{ padding: 6 }}>Sign-in</th><th style={{ padding: 6 }}>Joined</th></tr></thead>
                <tbody>{shown.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.12)' }}><td style={{ padding: 6 }}>{r.name}</td><td style={{ padding: 6 }}>{r.email}</td><td style={{ padding: 6 }}>{KIND[r.kind] ?? r.kind}</td><td style={{ padding: 6, whiteSpace: 'nowrap' }}>{date(r.joined)}</td></tr>
                ))}</tbody>
              </table>
            </div>
            <p style={{ opacity: .7, fontSize: 14 }}>Private: use these emails only to run the game and support players. Don’t share this list.</p>
          </>
        )}
      </article>
    </div>
  );
}
