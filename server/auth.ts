// Sign-in with email + password, Google or Facebook. Every method leads to the same kind of account
// (see accounts.ts): an id + secret key held by the device, with progress saved on the server.
import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash } from 'crypto';
import { promisify } from 'util';
import { getRecord, putRecord } from './storage';
import { Account, acctKey, codeKey, pub, rand } from './accounts';
import { availability, cleanName, takeName, uniqueName } from './names';
import { mailConfigured, sendMail } from './mail';

const scrypt = promisify(_scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const FACEBOOK_APP_ID = (process.env.FACEBOOK_APP_ID || '').trim();
const FACEBOOK_APP_SECRET = (process.env.FACEBOOK_APP_SECRET || '').trim();

export const authConfig = () => ({ google: GOOGLE_CLIENT_ID || null, facebook: FACEBOOK_APP_ID && FACEBOOK_APP_SECRET ? FACEBOOK_APP_ID : null, resetMail: mailConfigured() });

export class AuthError extends Error { constructor(msg: string, public status = 400) { super(msg); } }

const normEmail = (e: unknown) => String(e ?? '').trim().toLowerCase();
const emailOk = (e: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e);
const emailRef = (e: string) => `login-email-${createHash('sha256').update(e).digest('hex').slice(0, 40)}`;

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
  const email = normEmail(b.email), pw = String(b.password ?? '');
  if (!emailOk(email)) throw new AuthError('Enter a valid email address.');
  if (pw.length < 6) throw new AuthError('Use a password of at least 6 characters.');
  if (await getRecord(emailRef(email))) throw new AuthError('An account with this email already exists — sign in instead.', 409);
  // a guest upgrading keeps all their progress (and may keep their name, or choose a new one)
  const guest = await ownedGuest(b.adopt);
  const chk = await availability(b.name, guest?.id ?? '', guest?.name);
  if (!chk.ok) throw new AuthError(chk.message, chk.code === 'taken' ? 409 : 400);
  const pass = await hash(pw);
  let name = chk.name;
  let a: Account;
  if (guest) {
    a = { ...guest, kind: 'email', email, pass, name, profile: guest.profile ? { ...guest.profile, name, provider: 'email' } : null };
    await putRecord(acctKey(a.id), a);
  } else a = await newAccount('email', name, { email, pass });
  // make the name theirs (and free the guest name they had); if somebody grabbed it a moment ago, add digits
  const took = await takeName(a.id, name, guest?.name);
  if (!took.ok) { name = await uniqueName(name, a.id); await takeName(a.id, name, guest?.name); a.name = name; if (a.profile) a.profile = { ...a.profile, name }; await putRecord(acctKey(a.id), a); }
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

// ---- forgot password: an emailed link that works once, for 30 minutes ----
const SITE = () => (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || 'https://spade-haven.onrender.com').replace(/\/+$/, '');
const resetKey = (token: string) => `reset-${createHash('sha256').update(token).digest('hex').slice(0, 40)}`;
const lastAsk = new Map<string, number>();

export async function forgotPassword(b: Record<string, unknown>) {
  if (!mailConfigured()) throw new AuthError('Password reset by email isn’t set up yet. Please contact support.', 503);
  const email = normEmail(b.email);
  if (!emailOk(email)) throw new AuthError('Enter the email address you signed up with.');
  const now = Date.now();
  if (now - (lastAsk.get(email) ?? 0) < 60_000) return { ok: true };   // one email a minute per address
  lastAsk.set(email, now); if (lastAsk.size > 5000) lastAsk.clear();
  // always the same answer, so nobody can use this form to find out who has an account
  const ref = await getRecord<{ id: string }>(emailRef(email));
  const a = ref ? await getRecord<Account>(acctKey(ref.id)) : null;
  if (a?.pass) {
    const token = randomBytes(24).toString('base64url');
    await putRecord(resetKey(token), { id: a.id, exp: now + 30 * 60_000 });
    const link = `${SITE()}/#/play/reset/${token}`;
    const text = `Hi ${a.name},\n\nSomeone asked to reset the password for your Spade Haven account. To choose a new password, open this link within 30 minutes:\n\n${link}\n\nIf this wasn’t you, ignore this email. Your password stays the same.\n\n♠ Spade Haven`;
    const html = `<p>Hi ${a.name.replace(/[<>&]/g, '')},</p><p>Someone asked to reset the password for your Spade Haven account. To choose a new password, use the button below within 30 minutes.</p><p><a href="${link}" style="display:inline-block;padding:12px 22px;background:#1a9d4a;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Choose a new password</a></p><p style="color:#666;font-size:13px">If the button doesn’t work, copy this link: ${link}<br>If this wasn’t you, ignore this email. Your password stays the same.</p><p>♠ Spade Haven</p>`;
    const sent = await sendMail(email, 'Reset your Spade Haven password', text, html);
    if (!sent) console.error('forgot-password: the email could not be sent');
  }
  return { ok: true };
}

export async function resetPassword(b: Record<string, unknown>) {
  const token = String(b.token ?? '');
  if (!/^[\w-]{20,60}$/.test(token)) throw new AuthError('This reset link isn’t valid. Ask for a new one.', 400);
  if (String(b.password ?? '').length < 6) throw new AuthError('Use a password of at least 6 characters.');
  const rec = await getRecord<{ id: string; exp: number }>(resetKey(token));
  if (!rec?.id || rec.exp < Date.now()) throw new AuthError('This reset link has expired or was already used. Ask for a new one.', 400);
  const a = await getRecord<Account>(acctKey(rec.id));
  if (!a) throw new AuthError('This reset link isn’t valid. Ask for a new one.', 400);
  a.pass = await hash(String(b.password)); await putRecord(acctKey(a.id), a);
  await putRecord(resetKey(token), { id: '', exp: 0 });   // the link works once
  return pub(a);
}

async function socialAccount(kind: 'google' | 'facebook', subject: string, display: string, email: string | null, adopt: unknown) {
  const ref = `login-${kind}-${createHash('sha256').update(subject).digest('hex').slice(0, 40)}`;
  const known = await getRecord<{ id: string }>(ref);
  if (known) { const a = await getRecord<Account>(acctKey(known.id)); if (a) return pub(a); }
  const guest = await ownedGuest(adopt);
  // the name from their Google / Facebook profile, with digits added if somebody already has it
  const name = await uniqueName(cleanName(display).length >= 3 ? cleanName(display) : 'Player', guest?.id ?? '');
  let a: Account;
  if (guest) { a = { ...guest, kind, email: email ?? undefined, name, profile: guest.profile ? { ...guest.profile, name, provider: kind } : null }; await putRecord(acctKey(a.id), a); }
  else a = await newAccount(kind, name, { email: email ?? undefined });
  await takeName(a.id, name, guest?.name);
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
