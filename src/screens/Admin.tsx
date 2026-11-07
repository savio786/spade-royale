// Owner-only page: players who signed up, suspending cheaters, wiping winnings, player reports.
// Needs the ADMIN_KEY secret (kept in memory only; it is never saved on this device).
import { useCallback, useEffect, useMemo, useState } from 'react';

interface Row { id: string; name: string; kind: string; email: string; joined: number; lastSaved: number; banned: boolean; muted?: boolean }
interface Data { total: number; withEmail: number; byKind: Record<string, number>; rows: Row[] }
interface Rep { n: number; at: number; byName: string; targetId: string; targetName: string; reason: string; note: string; targetBanned: boolean; targetMuted?: boolean }
interface BanRow { id: string; name: string; reason: string; at: number; email?: string }
interface MuteRow { id: string; name: string; reason: string; at: number; auto?: boolean }
type Tab = 'players' | 'find' | 'reports' | 'muted' | 'suspended';
const date = (t: number) => (t ? new Date(t).toLocaleString() : '');
const KIND: Record<string, string> = { email: 'Email', google: 'Google', facebook: 'Facebook', guest: 'Guest' };
const input: React.CSSProperties = { padding: '8px 10px', fontSize: 16, borderRadius: 8, border: '1px solid #6f7bd6', background: '#0b0d33', color: '#fff' };
const th: React.CSSProperties = { padding: 6, textAlign: 'left' };
const td: React.CSSProperties = { padding: 6, verticalAlign: 'top' };

/** A button that asks "Sure?" before doing something serious: click twice. */
function Confirm({ label, onGo, danger }: { label: string; onGo: () => void; danger?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  return <button className={`pill small-pill ${armed || danger ? 'red' : ''}`} onClick={() => { if (armed) { setArmed(false); onGo(); } else setArmed(true); }}>{armed ? 'Sure? Click again' : label}</button>;
}

export function AdminPage() {
  const [key, setKey] = useState('');
  const [authed, setAuthed] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('players');
  const [data, setData] = useState<Data | null>(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Row[]>([]);
  const [reports, setReports] = useState<Rep[]>([]);
  const [bans, setBans] = useState<BanRow[]>([]);
  const [mutes, setMutes] = useState<MuteRow[]>([]);
  const [reason, setReason] = useState('');
  const [guests, setGuests] = useState(false);   // list guests too (they have no email)
  useEffect(() => {
    document.title = 'Owner · Spade Haven';
    const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex,nofollow'; document.head.appendChild(m);
    return () => { m.remove(); document.title = 'Spade Haven'; };
  }, []);

  const call = useCallback(async (path: string, body?: unknown) => {
    const r = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: { 'x-admin-key': key.trim(), ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(r.status === 404 && path.includes('users') ? 'This page is not switched on yet: add ADMIN_KEY in Render.' : (j as { error?: string }).error || 'Something went wrong.');
    return j as never;
  }, [key]);

  const refresh = useCallback(async (t: Tab = tab, query = q, guestsFlag?: boolean) => {
    setBusy(true); setErr('');
    try {
      if (t === 'players') setData(await call(`/api/admin/users${guestsFlag ?? guests ? '?all=1' : ''}`));
      if (t === 'find') setFound(query.trim().length >= 2 ? ((await call(`/api/admin/find?q=${encodeURIComponent(query.trim())}`)) as { rows: Row[] }).rows : []);
      if (t === 'reports') setReports(((await call('/api/admin/reports')) as { rows: Rep[] }).rows);
      if (t === 'muted') setMutes(((await call('/api/admin/muted')) as { rows: MuteRow[] }).rows);
      if (t === 'suspended') setBans(((await call('/api/admin/bans')) as { rows: BanRow[] }).rows);
      setAuthed(true);
    } catch (e) { setErr((e as Error).message); if (!authed) setAuthed(false); }
    setBusy(false);
  }, [call, tab, q, authed, guests]);

  const act = async (path: string, body: unknown, done: string) => {
    setErr(''); setMsg('');
    try { await call(path, body); setMsg(done); await refresh(); } catch (e) { setErr((e as Error).message); }
  };
  const go = (t: Tab) => { setTab(t); setMsg(''); void refresh(t); };
  const download = async () => {
    const r = await fetch('/api/admin/users?format=csv', { headers: { 'x-admin-key': key.trim() }, cache: 'no-store' });
    if (!r.ok) { setErr('Could not download.'); return; }
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a'); a.href = url; a.download = 'spade-haven-players.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const backup = async () => {
    setErr(''); setMsg('');
    const r = await fetch('/api/admin/backup', { headers: { 'x-admin-key': key.trim() }, cache: 'no-store' });
    if (!r.ok) { setErr('Could not download the backup.'); return; }
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a'); a.href = url; a.download = `spade-haven-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setMsg('Backup downloaded. It holds private account data, so keep the file somewhere safe.');
  };
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data ? data.rows.filter((r) => !s || r.email.toLowerCase().includes(s) || r.name.toLowerCase().includes(s)) : [];
  }, [data, q]);

  const actions = (r: { id: string; name: string; banned: boolean; muted?: boolean }) => (
    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {r.banned
        ? <button className="pill small-pill" onClick={() => void act('/api/admin/unban', { id: r.id }, `${r.name} can play again.`)}>Let back in</button>
        : <Confirm label="Suspend" danger onGo={() => void act('/api/admin/ban', { id: r.id, reason }, `${r.name} is suspended.`)} />}
      {r.muted
        ? <button className="pill small-pill" onClick={() => void act('/api/admin/unmute', { id: r.id }, `${r.name} has their chat back.`)}>Give chat back</button>
        : <Confirm label="Turn off chat" onGo={() => void act('/api/admin/mute', { id: r.id, reason }, `${r.name}'s chat is turned off.`)} />}
      <Confirm label="Wipe winnings" onGo={() => void act('/api/admin/wipe', { id: r.id }, `${r.name} was taken off the leaderboards.`)} />
    </span>
  );
  const reasonBox = (
    <p><input style={{ ...input, width: '100%', maxWidth: 420 }} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="Reason when suspending (only you see it)" /></p>
  );

  return (
    <div className="legal-page">
      <header className="legal-top"><a href="/" className="legal-brand">♠ Spade Haven · Owner</a></header>
      <article className="legal-body" style={{ maxWidth: 980 }}>
        <h1>Owner tools</h1>
        {!authed ? (
          <form onSubmit={(e) => { e.preventDefault(); if (key.trim()) void refresh('players'); }}>
            <p>Enter your owner key (the ADMIN_KEY you set in Render).</p>
            <input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Owner key" style={{ ...input, padding: '10px 12px', width: '100%', maxWidth: 360 }} />
            <p><button type="submit" disabled={busy || !key.trim()} className="pill gold small-pill">{busy ? 'Checking…' : 'Open'}</button></p>
            {err && <p style={{ color: '#ff8a8a' }}>{err}</p>}
          </form>
        ) : (
          <>
            <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([['players', 'Players'], ['find', 'Find a player'], ['reports', `Reports${reports.length ? ` (${reports.length})` : ''}`], ['muted', 'Chat off'], ['suspended', 'Suspended']] as [Tab, string][]).map(([t, l]) => (
                <button key={t} className={`pill small-pill ${tab === t ? 'gold' : ''}`} onClick={() => go(t)}>{l}</button>
              ))}
              <button className="pill small-pill" onClick={() => void refresh()}>Refresh</button>
              <button className="pill small-pill" onClick={() => void backup()}>Download backup</button>
            </p>
            {err && <p style={{ color: '#ff8a8a' }}>{err}</p>}
            {msg && <p style={{ color: '#7dffb0' }}>{msg}</p>}

            {tab === 'players' && data && (<>
              <p>{data.withEmail} players with an email · {data.total} accounts in all ({Object.entries(data.byKind).map(([k, n]) => `${KIND[k] ?? k}: ${n}`).join(' · ')}). Guests have no email.</p>
              <p style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input style={{ ...input, minWidth: 220 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" />
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={guests} onChange={(e) => { setGuests(e.target.checked); void refresh('players', q, e.target.checked); }} /> Show guests too</label>
                <button className="pill gold small-pill" onClick={() => void download()}>Download spreadsheet (CSV)</button>
              </p>
              <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 15 }}>
                <thead><tr style={{ borderBottom: '2px solid #6f7bd6' }}><th style={th}>Name</th><th style={th}>Email</th><th style={th}>Sign-in</th><th style={th}>Joined</th><th style={th}>Last saved</th><th style={th}></th></tr></thead>
                <tbody>{shown.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,.12)' }}><td style={td}>{r.name}{r.banned ? ' 🚫' : ''}{r.muted ? ' 🔇' : ''}</td><td style={td}>{r.email || '—'}</td><td style={td}>{KIND[r.kind] ?? r.kind}</td><td style={{ ...td, whiteSpace: 'nowrap' }}>{date(r.joined)}</td><td style={{ ...td, whiteSpace: 'nowrap' }}>{date(r.lastSaved)}</td><td style={td}>{actions(r)}</td></tr>
                ))}</tbody></table></div>
            </>)}

            {tab === 'find' && (<>
              <p>Search any player by name or email (guests too).</p>
              {reasonBox}
              <form style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} onSubmit={(e) => { e.preventDefault(); void refresh('find', q); }}>
                <input style={{ ...input, minWidth: 240 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email (2+ letters)" />
                <button type="submit" className="pill gold small-pill">Search</button>
              </form>
              <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 15, marginTop: 10 }}>
                <tbody>{found.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,.12)' }}><td style={td}>{r.name}{r.banned ? ' 🚫' : ''}{r.muted ? ' 🔇' : ''}</td><td style={td}>{r.email || '—'}</td><td style={td}>{KIND[r.kind] ?? r.kind}</td><td style={td}>{actions(r)}</td></tr>
                ))}</tbody></table></div>
            </>)}

            {tab === 'reports' && (<>
              <p>Reports from players. “Suspend” keeps the person out of the game; “Wipe winnings” takes them off the Weekly Rankings and Haven’s Fame boards.</p>
              {reasonBox}
              {reports.length === 0 && <p style={{ opacity: .7 }}>No reports.</p>}
              <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 15 }}>
                <tbody>{reports.map((r) => (
                  <tr key={r.n} style={{ borderBottom: '1px solid rgba(255,255,255,.12)' }}>
                    <td style={td}><b>{r.targetName}</b>{r.targetBanned ? ' 🚫' : ''}<br /><small style={{ opacity: .7 }}>reported by {r.byName} · {date(r.at)}</small></td>
                    <td style={td}>{r.reason}{r.note ? <><br /><i>“{r.note}”</i></> : null}</td>
                    <td style={td}><span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {actions({ id: r.targetId, name: r.targetName, banned: r.targetBanned, muted: r.targetMuted })}
                      <button className="pill small-pill" onClick={() => void act('/api/admin/reports/dismiss', { n: r.n }, 'Report dismissed.')}>Dismiss</button>
                    </span></td></tr>
                ))}</tbody></table></div>
            </>)}

            {tab === 'muted' && (<>
              <p>Players whose chat is turned off. They can still play. The game also does this automatically after repeated foul language.</p>
              {mutes.length === 0 && <p style={{ opacity: .7 }}>Nobody's chat is turned off.</p>}
              <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 15 }}>
                <tbody>{mutes.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,.12)' }}><td style={td}><b>{m.name}</b>{m.auto ? <><br /><small style={{ opacity: .7 }}>automatic</small></> : null}</td><td style={td}>{m.reason || '—'}</td><td style={{ ...td, whiteSpace: 'nowrap' }}>{date(m.at)}</td>
                    <td style={td}><button className="pill small-pill" onClick={() => void act('/api/admin/unmute', { id: m.id }, `${m.name} has their chat back.`)}>Give chat back</button></td></tr>
                ))}</tbody></table></div>
            </>)}

            {tab === 'suspended' && (<>
              {bans.length === 0 && <p style={{ opacity: .7 }}>Nobody is suspended.</p>}
              <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 15 }}>
                <tbody>{bans.map((b) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,.12)' }}><td style={td}><b>{b.name}</b>{b.email ? <><br /><small style={{ opacity: .7 }}>{b.email}</small></> : null}</td><td style={td}>{b.reason || '—'}</td><td style={{ ...td, whiteSpace: 'nowrap' }}>{date(b.at)}</td>
                    <td style={td}><button className="pill small-pill" onClick={() => void act('/api/admin/unban', { id: b.id }, `${b.name} can play again.`)}>Let back in</button></td></tr>
                ))}</tbody></table></div>
            </>)}
            <p style={{ opacity: .7, fontSize: 14, marginTop: 24 }}>Private: use these details only to run the game and support players. Don’t share them.</p>
          </>
        )}
      </article>
    </div>
  );
}
