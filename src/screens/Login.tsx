import { useEffect, useRef, useState } from 'react';
import { emailSignIn, emailSignUp, facebookSignIn, loadAuthConfig, mountGoogleButton, type AuthConfig } from '../lib/auth';
import { AVATAR_KEYS, AvatarPicker, Icon, Logo, Modal, Pill } from '../components/ui';
import { profile } from '../lib/profile';
import { sfx } from '../lib/sound';
import { continueAsGuest, deviceGuestName, finishNewGuest, notifyReturning, restoreWithCode } from '../lib/guest';

type Step = null | 'email' | 'guest-new' | 'restore';

export function Login() {
  const [step, setStep] = useState<Step>(null);
  const [name, setName] = useState('');
  const [guestName, setGuestName] = useState('');
  const [avatar, setAvatar] = useState(AVATAR_KEYS[Math.floor(Math.random() * AVATAR_KEYS.length)]);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const returningName = deviceGuestName();
  const [cfg, setCfg] = useState<AuthConfig>({ google: null, facebook: null });
  const [emailMode, setEmailMode] = useState<'in' | 'up'>('in');
  const googleRef = useRef<HTMLDivElement>(null);
  useEffect(() => { void loadAuthConfig().then(setCfg); }, []);
  useEffect(() => {
    if (cfg.google && googleRef.current) void mountGoogleButton(googleRef.current, cfg.google, (e) => { if (e) setErr(e); else sfx.coins(); }).catch(() => {});
  }, [cfg.google]);
  const fb = async () => {
    sfx.click();
    if (!cfg.facebook) { setErr('Facebook sign-in is coming soon — sign in with email for now.'); return; } setBusy(true); setErr(null);
    try { await facebookSignIn(cfg.facebook); sfx.coins(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const guest = async () => {
    sfx.click();
    setBusy(true);
    const r = await continueAsGuest();
    setBusy(false);
    if (r.returning) { sfx.coins(); notifyReturning(r.name); return; }
    setGuestName(r.name);
    setStep('guest-new');
  };
  const restore = async () => {
    setBusy(true); setErr(null);
    const e = await restoreWithCode(code);
    setBusy(false);
    if (e) setErr(e); else { sfx.coins(); notifyReturning(profile.get().name); }
  };

  return (
    <div className="screen login felt-bg">
      <div className="login-inner">
        <Logo />
        <div className="login-glow" />
        <div className="login-buttons">
          <button className="social fb" onClick={fb} disabled={busy}>
            <span className="social-ico">f</span><span>Sign in with Facebook</span>
          </button>
          {cfg.google ? <div className="google-slot" ref={googleRef} /> : (
            <button className="social gp" onClick={() => { sfx.click(); setErr('Google sign-in is coming soon — sign in with email for now.'); }}>
              <span className="social-ico"><svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="6" fill="#fff" /><path d="M7 10v4M5 12h4" stroke="#1a7f37" strokeWidth="2" strokeLinecap="round" /><circle cx="16" cy="11" r="1.2" fill="#1a7f37" /><circle cx="18" cy="13" r="1.2" fill="#1a7f37" /></svg></span>
              <span>Google Play Games</span>
            </button>
          )}
          <button className="social em" onClick={() => { sfx.click(); setErr(null); setEmailMode('in'); setStep('email'); }}>
            <span className="social-ico"><Icon name="chat" size={24} /></span><span>Sign in with email</span>
          </button>
          <button className="social reg" onClick={() => { sfx.click(); setErr(null); setEmailMode('up'); setStep('email'); }}>
            <span className="social-ico"><Icon name="star" size={24} /></span><span>New player? Register</span>
          </button>
        </div>
        {err && step === null && <p className="form-error login-err" role="alert">{err}</p>}
        <button className="guest-link" onClick={guest} disabled={busy}>
          {busy ? 'One moment…' : returningName ? `Continue as ${returningName}` : 'Continue as guest'}
        </button>
        <button className="restore-link" onClick={() => { sfx.click(); setErr(null); setStep('restore'); }}>Have a guest code? Continue on this device</button>
      </div>

      {step === 'guest-new' && (
        <Modal title="Welcome to the table!" onClose={() => setStep(null)}>
          <form className="profile-form" onSubmit={(e) => { e.preventDefault(); finishNewGuest(avatar); sfx.coins(); }}>
            <div className="field"><span>Your guest name</span>
              <div className="locked-name"><Icon name="lock" size={18} /><b>{guestName}</b></div>
              <small className="muted">Guest names are permanent. Whenever you come back as a guest on this device you'll be {guestName} again, with your coins, level and stats.</small>
            </div>
            <div className="field"><span>Choose your avatar</span>
              <AvatarPicker value={avatar} onChange={setAvatar} />
            </div>
            <Pill type="submit" color="green" className="wide-btn"><Icon name="play" size={18} /> Start playing — 50,000 free coins</Pill>
          </form>
        </Modal>
      )}

      {step === 'restore' && (
        <Modal title="Continue with a guest code" onClose={() => setStep(null)}>
          <form className="center-col" onSubmit={(e) => { e.preventDefault(); if (code.trim().length >= 8) restore(); }}>
            <p>Find your code in <b>Settings</b> on the device you played on before. It looks like <b>K7QM-4XPT</b>.</p>
            <label className="field"><span>Guest code</span>
              <input className="code-input" value={code} maxLength={9} autoFocus onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX" /></label>
            {err && <p className="form-error" role="alert">{err}</p>}
            <Pill type="submit" color="green" className="wide-btn" disabled={busy || code.trim().length < 8}>{busy ? 'Checking…' : 'Continue'}</Pill>
          </form>
        </Modal>
      )}

      {step === 'email' && <EmailModal onClose={() => setStep(null)} startMode={emailMode} />}
    </div>
  );
}

export function EmailModal({ onClose, startMode = 'in' }: { onClose: () => void; startMode?: 'in' | 'up' }) {
  const [mode, setMode] = useState<'in' | 'up'>(startMode);
  const guest = profile.get().provider === 'guest';
  const [avatar, setAvatar] = useState(profile.get().provider ? profile.get().avatar : AVATAR_KEYS[Math.floor(Math.random() * AVATAR_KEYS.length)]);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      if (mode === 'in') await emailSignIn(email, pw); else await emailSignUp(email, pw, name, avatar);
      sfx.coins(); notifyReturning(profile.get().name); onClose();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <Modal title={mode === 'in' ? 'Sign in' : 'Create your account'} onClose={onClose}>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'in'} className={`tab ${mode === 'in' ? 'on' : ''}`} onClick={() => { setMode('in'); setErr(null); }}>Sign in</button>
        <button role="tab" aria-selected={mode === 'up'} className={`tab ${mode === 'up' ? 'on' : ''}`} onClick={() => { setMode('up'); setErr(null); }}>Create account</button>
      </div>
      <form className="profile-form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {mode === 'up' && (
          <label className="field"><span>Player name</span>
            <input value={name} maxLength={20} onChange={(e) => setName(e.target.value.replace(/[^\p{L}\p{N} _.-]/gu, ''))} placeholder="e.g. ApexSpadeOverlord" autoComplete="nickname" required /></label>
        )}
        <label className="field"><span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required autoFocus /></label>
        <label className="field"><span>Password</span>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={mode === 'up' ? 'At least 6 characters' : ''} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} required minLength={mode === 'up' ? 6 : 1} /></label>
        {mode === 'up' && !guest && (
          <details className="field su-avatar"><summary><span>Choose your avatar (optional)</span></summary><AvatarPicker value={avatar} onChange={setAvatar} /></details>
        )}
        {mode === 'up' && guest && <p className="muted small center">Your guest progress — coins, level and stats — moves into your new account.</p>}
        {err && <p className="form-error" role="alert">{err}</p>}
        <Pill type="submit" color="green" className="wide-btn" disabled={busy}>{busy ? 'One moment…' : mode === 'in' ? 'Sign in' : guest ? 'Create account & keep my progress' : 'Create account — 50,000 free coins'}</Pill>
        <p className="muted small center">{mode === 'in' ? <>New here? <button type="button" className="linkish" onClick={() => setMode('up')}>Create an account</button></> : 'Your coins, level and stats are saved to your account, so you can sign in on any phone or computer.'}</p>
      </form>
    </Modal>
  );
}
