// Guest accounts: an automatic, permanent name (Guest48213) plus saved progress,
// so a guest who comes back (same device, or another device with their guest code) keeps everything.
import { randomBytes } from 'crypto';
import { getRecord, nextNumber, putRecord } from './storage';

export interface Account {
  id: string;
  key: string;        // secret held by the player's device; needed to read or save progress
  code: string;       // shareable restore code, e.g. K7QM-4XPT
  name: string;       // permanent guest name
  profile: Record<string, unknown> | null;
  createdAt: number;
  updatedAt: number;
  kind?: 'guest' | 'email' | 'google' | 'facebook';
  email?: string;
  pass?: string;      // scrypt hash "salt:hash" (email accounts)
}

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rand = (n: number) => Array.from(randomBytes(n), (b) => ALPHA[b % ALPHA.length]).join('');
const acctKey = (id: string) => `acct-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
const codeKey = (code: string) => `code-${code.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
export const pub = (a: Account) => ({ id: a.id, key: a.key, code: a.code, name: a.name, profile: a.profile, updatedAt: a.updatedAt, kind: a.kind ?? 'guest', email: a.email ?? null });
export { acctKey, codeKey, rand };

/** Creates a guest, or adopts an existing device profile (keeps its id and name) when `adopt` is given. */
export async function createGuest(adopt?: { id: string; name: string }) {
  if (adopt) {
    const existing = await getRecord<Account>(acctKey(adopt.id));
    if (existing) return null; // already registered: the device must use its key
  }
  const n = 10000 + ((await nextNumber('guest-counter')) * 7919) % 90000; // unique, not obviously sequential
  const id = adopt?.id || `g${Date.now().toString(36)}${rand(6).toLowerCase()}`;
  let code = '';
  for (let i = 0; i < 5; i++) { code = `${rand(4)}-${rand(4)}`; if (!(await getRecord(codeKey(code)))) break; }
  const a: Account = {
    id, key: randomBytes(18).toString('base64url'), code,
    name: adopt?.name ? String(adopt.name).slice(0, 18) : `Guest${n}`,
    profile: null, createdAt: Date.now(), updatedAt: 0,
  };
  await putRecord(acctKey(id), a);
  await putRecord(codeKey(code), { id });
  return pub(a);
}

export async function loadAccount(id: string, key: string) {
  const a = await getRecord<Account>(acctKey(id));
  return a && a.key === key ? pub(a) : null;
}

export async function saveProgress(id: string, key: string, profile: Record<string, unknown>, updatedAt: number) {
  const a = await getRecord<Account>(acctKey(id));
  if (!a || a.key !== key) return { ok: false as const, status: 403 };
  if (updatedAt < a.updatedAt) return { ok: false as const, status: 409, account: pub(a) }; // server has newer progress
  // the name always stays the guest's permanent name
  a.profile = { ...profile, id: a.id, name: a.name, provider: a.kind ?? 'guest' };
  a.updatedAt = updatedAt;
  await putRecord(acctKey(id), a);
  return { ok: true as const, status: 200 };
}

export async function restoreByCode(code: string) {
  const ref = await getRecord<{ id: string }>(codeKey(code));
  if (!ref) return null;
  const a = await getRecord<Account>(acctKey(ref.id));
  return a ? pub(a) : null;
}

/** The account's name when `key` is its secret (proves this connection really is that player), otherwise null. */
export async function verifyKey(id: string, key: string): Promise<string | null> {
  try { const a = await getRecord<Account>(acctKey(id)); return a && key && a.key === key ? a.name : null; } catch { return null; }
}

/** Permanent name for a registered guest (so nobody can impersonate them at tables). */
export async function guestName(id: string): Promise<string | null> {
  try { return (await getRecord<Account>(acctKey(id)))?.name ?? null; } catch { return null; }
}
