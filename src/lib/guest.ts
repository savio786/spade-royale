// Guest accounts on the device + server.
// - A guest gets an automatic, permanent name (Guest48213).
// - The account is remembered on this device even after "Sign out", so "Continue as guest" brings back the same player.
// - Progress (coins, level, stats…) is saved to the server automatically and can be restored on another device with the guest code.
import { Profile, profile } from './profile';
import { serverOrigin } from './config';
import { toast } from './toast';

interface Vault { id: string; key: string | null; code: string | null; name: string; profile: Profile | null }
export interface Account { id: string; key: string; code: string; name: string; profile: Partial<Profile> | null; updatedAt: number; kind?: 'guest' | 'email' | 'google' | 'facebook'; email?: string | null }

const VAULT = 'spade-royale-guest';
const readVault = (): Vault | null => { try { const v = localStorage.getItem(VAULT); return v ? JSON.parse(v) : null; } catch { return null; } };
const writeVault = (v: Vault) => { try { localStorage.setItem(VAULT, JSON.stringify(v)); } catch { /* storage unavailable */ } };

export const hasGuestOnDevice = () => !!readVault();
export const deviceGuestName = () => readVault()?.name ?? null;

async function api<T>(path: string, init?: RequestInit): Promise<T | null> {
  const base = serverOrigin();
  if (!base) return null;
  try {
    const r = await fetch(base + path, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch { return null; }
}

export function applyAccount(a: Account, base?: Profile | null) {
  const local = base ?? profile.get();
  const server = a.profile as Profile | null;
  const useServer = server && (a.updatedAt || 0) > (local.updatedAt || 0);
  const kind = a.kind ?? 'guest';
  const next: Profile = {
    ...(useServer ? { ...local, ...server } : local),
    id: a.id, name: a.name, provider: kind, email: a.email ?? null, guestKey: a.key, guestCode: a.code,
    updatedAt: useServer ? a.updatedAt : local.updatedAt,
  };
  profile.replace(next);
  if (kind === 'guest') writeVault({ id: a.id, key: a.key, code: a.code, name: a.name, profile: next });
  else if (readVault()?.id === a.id) { try { localStorage.removeItem(VAULT); } catch { /* ignore */ } } // the guest became a real account
}

const randomGuestName = () => `Guest${10000 + Math.floor(Math.random() * 90000)}`;

/** "Continue as guest": returns the same guest as before on this device, or creates a new one. */
export async function continueAsGuest(): Promise<{ returning: boolean; name: string }> {
  const v = readVault();
  if (v) {
    const local: Profile = { ...(v.profile ?? profile.get()), id: v.id, name: v.name, provider: 'guest', guestKey: v.key, guestCode: v.code };
    profile.replace(local);
    if (v.key) {
      const a = await api<Account>(`/api/guest?id=${encodeURIComponent(v.id)}&key=${encodeURIComponent(v.key)}`);
      if (a) applyAccount(a, local);
    } else {
      void registerExistingGuest();
    }
    return { returning: true, name: v.name };
  }
  // brand-new guest: the server hands out a unique permanent name
  const a = await api<Account>('/api/guest', { method: 'POST', body: '{}' });
  const fresh = profile.get();
  // (provider is set in finishNewGuest, after the player picks an avatar)
  if (a) {
    profile.replace({ ...fresh, id: a.id, name: a.name, guestKey: a.key, guestCode: a.code });
    return { returning: false, name: a.name };
  }
  // offline: create the guest on this device and register it with the server later
  const name = randomGuestName();
  profile.replace({ ...fresh, name });
  return { returning: false, name };
}

/** New guest confirmed their avatar: enter the game and remember them on this device. */
export function finishNewGuest(avatar: string) {
  profile.set({ avatar, provider: 'guest' });
  const p = profile.get();
  writeVault({ id: p.id, key: p.guestKey, code: p.guestCode, name: p.name, profile: p });
}

/** Continue on this device with a guest code from another device. */
export async function restoreWithCode(code: string): Promise<string | null> {
  const base = serverOrigin();
  if (!base) return 'Restoring needs the game server, which isn\'t reachable right now.';
  try {
    const r = await fetch(`${base}/api/guest/restore`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
    const j = await r.json();
    if (!r.ok) return j.error || 'That code didn\'t work.';
    const a = j as Account;
    const start = { ...profile.get(), updatedAt: 0 }; // always take the saved progress
    applyAccount(a, start);
    if (!a.profile) profile.replace({ ...profile.get(), provider: 'guest' });
    return null;
  } catch { return 'Restoring needs the game server, which isn\'t reachable right now.'; }
}

/** Guests created offline, or before guest accounts existed, get registered with the server (keeping their name). */
export async function registerExistingGuest() {
  const p = profile.get();
  if (p.provider !== 'guest' || p.guestKey) return;
  const a = await api<Account>('/api/guest', { method: 'POST', body: JSON.stringify({ adoptId: p.id, name: p.name }) });
  if (a) {
    profile.replace({ ...profile.get(), guestKey: a.key, guestCode: a.code, name: a.name });
    writeVault({ id: a.id, key: a.key, code: a.code, name: a.name, profile: profile.get() });
  } else if (!readVault()) {
    writeVault({ id: p.id, key: null, code: null, name: p.name, profile: p });
  }
}

/** On startup: pull newer progress from the server (e.g. played on another device). */
export async function pullGuestProgress() {
  const p = profile.get();
  if (!p.provider) return;
  if (!p.guestKey) return p.provider === 'guest' ? registerExistingGuest() : undefined;
  const a = await api<Account>(`/api/guest?id=${encodeURIComponent(p.id)}&key=${encodeURIComponent(p.guestKey)}`);
  if (a) applyAccount(a);
}

// ---- automatic saving ----
let timer: ReturnType<typeof setTimeout> | null = null;
let lastSent = 0;
async function push() {
  const p = profile.get();
  if (!p.provider || p.updatedAt <= lastSent) return;
  if (p.provider === 'guest') writeVault({ id: p.id, key: p.guestKey, code: p.guestCode, name: p.name, profile: p });
  if (!p.guestKey) return;
  const base = serverOrigin();
  if (!base) return;
  try {
    const r = await fetch(`${base}/api/guest`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: p.id, key: p.guestKey, profile: p, updatedAt: p.updatedAt }) });
    if (r.ok) lastSent = p.updatedAt;
    else if (r.status === 409) { const j = await r.json(); if (j.account) applyAccount(j.account); }
  } catch { /* offline: saved on this device, retried on the next change */ }
}
export function startGuestSync() {
  profile.subscribe(() => {
    if (!profile.get().provider || !profile.get().guestKey) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void push(); }, 2500);
  });
  // signing out keeps the guest on this device so "Continue as guest" brings them back
  profile.onBeforeReset((p) => {
    if (p.provider === 'guest') writeVault({ id: p.id, key: p.guestKey, code: p.guestCode, name: p.name, profile: p });
    void push();
  });
  window.addEventListener('pagehide', () => { void push(); });
}

export function notifyReturning(name: string) { toast(`Welcome back, ${name}!`); }

// ---- choosing / changing the player's name (names are unique: see server/names.ts) ----
export interface NameResult { ok: boolean; message?: string; name?: string; offline?: boolean }

async function nameCall(check: boolean, name: string): Promise<NameResult> {
  const base = serverOrigin(), p = profile.get();
  if (!base || !p.guestKey) return { ok: false, offline: true, message: 'Changing your name needs the game server. Check your connection and try again.' };
  try {
    const r = await fetch(`${base}/api/guest/name`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: p.id, key: p.guestKey, name, check }) });
    const j = (await r.json().catch(() => ({}))) as NameResult;
    return typeof j.ok === 'boolean' ? j : { ok: false, message: 'Something went wrong. Please try again.' };
  } catch { return { ok: false, offline: true, message: 'Can’t reach the game server right now. Check your connection and try again.' }; }
}

/** Is this name free for me? Changes nothing. */
export const checkName = (name: string) => nameCall(true, name);

/** Take a new name. On success the profile (and the copy remembered on this device) has it straight away. */
export async function changeName(name: string): Promise<NameResult> {
  const r = await nameCall(false, name);
  if (r.ok && r.name) {
    profile.set({ name: r.name });
    const me = profile.get();
    if (me.provider === 'guest') writeVault({ id: me.id, key: me.guestKey, code: me.guestCode, name: me.name, profile: me }); // "Continue as …" shows the new name even if the app is closed right now
  }
  return r;
}
