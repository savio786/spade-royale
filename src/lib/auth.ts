// Sign in / create account with email + password, Google or Facebook.
import { serverOrigin } from './config';
import { profile } from './profile';
import { applyAccount, type Account } from './guest';

export interface AuthConfig { google: string | null; facebook: string | null; resetMail?: boolean }

async function post(path: string, body: unknown): Promise<Account> {
  const base = serverOrigin();
  if (!base) throw new Error('Signing in needs the game server, which isn’t reachable right now.');
  let r: Response;
  // never hang forever: a sleeping server can take a while to wake, but after 60 s tell the player and let them retry
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 60_000);
  try { r = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal }); }
  catch (e) { throw new Error((e as Error).name === 'AbortError' ? 'The game server is taking too long to answer. Wait a moment and tap the button again.' : 'Can’t reach the game server. Check your connection and try again.'); }
  finally { clearTimeout(timer); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Something went wrong. Please try again.');
  return j as Account;
}

/** The guest currently on this device (so creating an account keeps its progress). */
const adoptGuest = () => { const p = profile.get(); return p.provider === 'guest' && p.guestKey ? { id: p.id, key: p.guestKey } : undefined; };

function enter(a: Account, avatar?: string) {
  const start = { ...profile.get(), updatedAt: 0 };         // saved progress on the server always wins
  applyAccount(a, start);
  if (!a.profile && avatar) profile.set({ avatar });          // brand-new account
  else if (!a.profile) profile.set({});                       // make sure the first save happens
}

export async function emailSignUp(email: string, password: string, name: string, avatar?: string) {
  const adopt = adoptGuest();
  const a = await post('/api/auth/signup', { email, password, name, adopt });
  if (adopt) applyAccount(a); else enter(a, avatar);
}
export async function emailSignIn(email: string, password: string) { enter(await post('/api/auth/login', { email, password })); }
/** "Forgot password?": asks the server to email a reset link. */
export async function forgotPassword(email: string) { await post('/api/auth/forgot', { email }); }
/** The page the emailed link opens: sets the new password and signs the player in. */
export async function resetPassword(token: string, password: string) { enter(await post('/api/auth/reset', { token, password })); }
export async function changePassword(current: string, password: string) {
  const p = profile.get();
  await post('/api/auth/password', { id: p.id, key: p.guestKey, current, password });
}

let config: AuthConfig | null = null;
export async function loadAuthConfig(): Promise<AuthConfig> {
  if (config) return config;
  const base = serverOrigin();
  try { config = base ? ((await (await fetch(`${base}/api/auth/config`)).json()) as AuthConfig) : { google: null, facebook: null }; }
  catch { config = { google: null, facebook: null }; }
  return config;
}

const loadScript = (src: string) => new Promise<void>((ok, bad) => {
  if (document.querySelector(`script[src="${src}"]`)) return ok();
  const s = document.createElement('script'); s.src = src; s.async = true; s.onload = () => ok(); s.onerror = () => bad(new Error('Could not load sign-in.'));
  document.head.appendChild(s);
});

type G = { accounts: { id: { initialize(o: object): void; renderButton(el: HTMLElement, o: object): void } } };
/** Renders Google's own sign-in button into `el`. */
export async function mountGoogleButton(el: HTMLElement, clientId: string, onDone: (err: string | null) => void) {
  await loadScript('https://accounts.google.com/gsi/client');
  const g = (window as unknown as { google: G }).google;
  g.accounts.id.initialize({ client_id: clientId, callback: async (r: { credential: string }) => {
    try { const adopt = adoptGuest(); const a = await post('/api/auth/google', { credential: r.credential, adopt }); adopt ? applyAccount(a) : enter(a); onDone(null); }
    catch (e) { onDone((e as Error).message); }
  } });
  g.accounts.id.renderButton(el, { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', width: 320 });
}

type FBT = { init(o: object): void; login(cb: (r: { authResponse?: { accessToken: string } }) => void, o: object): void };
export async function facebookSignIn(appId: string) {
  await loadScript('https://connect.facebook.net/en_US/sdk.js');
  const FB = (window as unknown as { FB: FBT }).FB;
  FB.init({ appId, version: 'v19.0', cookie: false, xfbml: false });
  const token = await new Promise<string>((ok, bad) => FB.login((r) => (r.authResponse ? ok(r.authResponse.accessToken) : bad(new Error('Facebook sign-in was cancelled.'))), { scope: 'public_profile,email' }));
  const adopt = adoptGuest();
  const a = await post('/api/auth/facebook', { accessToken: token, adopt });
  adopt ? applyAccount(a) : enter(a);
}
