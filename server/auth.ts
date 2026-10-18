// Sign-in with email + password, Google or Facebook. Every method leads to the same kind of account
// (see accounts.ts): an id + secret key held by the device, with progress saved on the server.
import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash } from 'crypto';
import { promisify } from 'util';
import { getRecord, putRecord } from './storage';
import { Account, acctKey, codeKey, pub, rand } from './accounts';

const scrypt = promisify(_scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const FACEBOOK_APP_ID = (process.env.FACEBOOK_APP_ID || '').trim();
const FACEBOOK_APP_SECRET = (process.env.FACEBOOK_APP_SECRET || '').trim();

export const authConfig = () => ({ google: GOOGLE_CLIENT_ID || null, facebook: FACEBOOK_APP_ID && FACEBOOK_APP_SECRET ? FACEBOOK_APP_ID : null });

export class AuthError extends Error { constructor(msg: string, public status = 400) { super(msg); } }

const normEmail = (e: unknown) => String(e ?? '').trim().toLowerCase();
const emailOk = (e: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e);
const emailRef = (e: string) => `login-email-${createHash('sha256').update(e).digest('hex').slice(0, 40)}`;
export const cleanName = (n: unknown) => String(n ?? '').replace(/[^\p{L}\p{N} _.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 18);

async function hash(pw: string) { const salt = randomBytes(16).toString('hex'); return `${salt}:${(await scrypt(pw, salt, 64)).toString('hex')}`; }
async function verify(pw: string, stored: string) {
  const [salt, h] = stored.split(':'); if (!salt || !h) return false;
  const got = await scrypt(pw, salt, 64), want = Buffer.from(h, 'hex');
  return got.length === want.length && timingSafeEqual(got, want);
}

async function newAccount(kind: Account['kind'], name: string, extra: Partial<Account> = {}): Promise<Account> {
  let code = '';
  for (let i = 0; i < 5; i++) { code = `${rand(4)}-${rand(4)}`; if (!(await getRecord(codeKey(code)))) break; }
  const a: Account = { id: `${kind![0]}${Date.now().toString(36)}${rand(6).toLowerCase()}`, key: randomBytes(18).toString('base64url'), code, name, profile: null, createdAt: Date.now(), updatedAt: 0, kind, ...extra };
  await putRecord(acctKey(a.id), a); await putRecord(codeKey(code), { id: a.id });
  return a;
}

/** The guest the player is currently using, if they proved they own it (their device key). */
async function ownedGuest(adopt: unknown): Promise<Account | null> {
  const o = adopt as { id?: string; key?: string } | undefined;
  if (!o?.id || !o.key) return null;
  const a = await getRecord<Account>(acctKey(String(o.id)));
  return a && a.key === String(o.key) && (a.kind ?? 'guest') === 'guest' ? a : null;
}

export async function signUp(b: Record<string, unknown>) {
  const email = normEmail(b.email), pw = String(b.password ?? ''), name = cleanName(b.name);
  if (!emailOk(email)) throw new AuthError('Enter a valid email address.');
  if (pw.length < 6) throw new AuthError('Use a password of at least 6 characters.');
  if (name.length < 3) throw new AuthError('Player names need at least 3 letters or numbers.');
  if (await getRecord(emailRef(email))) throw new AuthError('An account with this email already exists — sign in instead.', 409);
  const pass = await hash(pw);
  // a guest upgrading keeps all their progress
  const guest = await ownedGuest(b.adopt);
  let a: Account;
  if (guest) {
    a = { ...guest, kind: 'email', email, pass, name, profile: guest.profile ? { ...guest.profile, name, provider: 'email' } : null };
    await putRecord(acctKey(a.id), a);
  } else a = await newAccount('email', name, { email, pass });
  await putRecord(emailRef(email), { id: a.id });
  return pub(a);
}

export async function signIn(b: Record<string, unknown>) {
  const email = normEmail(b.email), pw = String(b.password ?? '');
  const ref = emailOk(email) ? await getRecord<{ id: string }>(emailRef(email)) : null;
  const a = ref ? await getRecord<Account>(acctKey(ref.id)) : null;
  if (!a || !a.pass || !(await verify(pw, a.pass))) throw new AuthError('Wrong email or password.', 401);
  return pub(a);
}

/** Change password (signed in: id + key + current password). */
export async function changePassword(b: Record<string, unknown>) {
  const a = await getRecord<Account>(acctKey(String(b.id ?? '')));
  if (!a || a.key !== String(b.key ?? '') || !a.pass || !(await verify(String(b.current ?? ''), a.pass))) throw new AuthError('Current password is wrong.', 401);
  if (String(b.password ?? '').length < 6) throw new AuthError('Use a password of at least 6 characters.');
  a.pass = await hash(String(b.password)); await putRecord(acctKey(a.id), a);
  return { ok: true };
}

async function socialAccount(kind: 'google' | 'facebook', subject: string, display: string, email: string | null, adopt: unknown) {
  const ref = `login-${kind}-${createHash('sha256').update(subject).digest('hex').slice(0, 40)}`;
  const known = await getRecord<{ id: string }>(ref);
  if (known) { const a = await getRecord<Account>(acctKey(known.id)); if (a) return pub(a); }
  const name = cleanName(display).length >= 3 ? cleanName(display) : `Player${Math.floor(1000 + Math.random() * 9000)}`;
  const guest = await ownedGuest(adopt);
  let a: Account;
  if (guest) { a = { ...guest, kind, email: email ?? undefined, name, profile: guest.profile ? { ...guest.profile, name, provider: kind } : null }; await putRecord(acctKey(a.id), a); }
  else a = await newAccount(kind, name, { email: email ?? undefined });
  await putRecord(ref, { id: a.id });
  return pub(a);
}

export async function googleSignIn(b: Record<string, unknown>) {
  if (!GOOGLE_CLIENT_ID) throw new AuthError('Google sign-in is not set up yet.', 503);
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(String(b.credential ?? ''))}`);
  const t = (await r.json().catch(() => ({}))) as Record<string, string>;
  if (!r.ok || t.aud !== GOOGLE_CLIENT_ID || !t.sub) throw new AuthError('Google sign-in failed — please try again.', 401);
  return socialAccount('google', t.sub, t.given_name || t.name || '', t.email_verified === 'true' ? t.email : null, b.adopt);
}

export async function facebookSignIn(b: Record<string, unknown>) {
  if (!authConfig().facebook) throw new AuthError('Facebook sign-in is not set up yet.', 503);
  const token = String(b.accessToken ?? '');
  const dbg = await fetch(`https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(token)}&access_token=${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}`);
  const d = ((await dbg.json().catch(() => ({}))) as { data?: { is_valid?: boolean; app_id?: string; user_id?: string } }).data;
  if (!d?.is_valid || d.app_id !== FACEBOOK_APP_ID || !d.user_id) throw new AuthError('Facebook sign-in failed — please try again.', 401);
  const me = (await (await fetch(`https://graph.facebook.com/me?fields=first_name,name,email&access_token=${encodeURIComponent(token)}`)).json().catch(() => ({}))) as Record<string, string>;
  return socialAccount('facebook', d.user_id, me.first_name || me.name || '', me.email || null, b.adopt);
}
