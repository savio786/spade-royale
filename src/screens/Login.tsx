import { useState } from 'react';
import { AVATAR_KEYS, AvatarPicker, Icon, Logo, Modal, Pill } from '../components/ui';
import { profile } from '../lib/profile';
import { sfx } from '../lib/sound';
import { continueAsGuest, deviceGuestName, finishNewGuest, notifyReturning, restoreWithCode } from '../lib/guest';

type Step = null | 'facebook' | 'google' | 'guest-new' | 'restore';

export function Login() {
  const [step, setStep] = useState<Step>(null);
  const [name, setName] = useState('');
  const [guestName, setGuestName] = useState('');
  const [avatar, setAvatar] = useState(AVATAR_KEYS[Math.floor(Math.random() * AVATAR_KEYS.length)]);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const returningName = deviceGuestName();

  const guest = async () => {
    sfx.click();
    setBusy(true);
    const r = await continueAsGuest();
    setBusy(false);
    if (r.returning) { sfx.coins(); notifyReturning(r.name); return; }
    setGuestName(r.name);
    setStep('guest-new');
  };
  const social = () => {
    const n = name.trim() || `Player${Math.floor(1000 + Math.random() * 9000)}`;
    profile.set({ name: n.slice(0, 18), avatar, provider: step === 'facebook' ? 'facebook' : 'google' });
    sfx.coins();
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
          <button className="social fb" onClick={() => { sfx.click(); setStep('facebook'); }}>
            <span className="social-ico">f</span><span>Sign in with Facebook</span>
          </button>
          <button className="social gp" onClick={() => { sfx.click(); setStep('google'); }}>
            <span className="social-ico"><svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="6" fill="#fff" /><path d="M7 10v4M5 12h4" stroke="#1a7f37" strokeWidth="2" strokeLinecap="round" /><circle cx="16" cy="11" r="1.2" fill="#1a7f37" /><circle cx="18" cy="13" r="1.2" fill="#1a7f37" /></svg></span>
            <span>Google Play Games</span>
          </button>
        </div>
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

      {(step === 'facebook' || step === 'google') && (
        <Modal title={`Sign in with ${step === 'facebook' ? 'Facebook' : 'Google Play Games'}`} onClose={() => setStep(null)}>
          <p className="note">Social sign-in needs your own app keys (see README → “Sign-in”). Until they're added, this creates a profile on this device tagged to {step === 'facebook' ? 'Facebook' : 'Google'}.</p>
          <form className="profile-form" onSubmit={(e) => { e.preventDefault(); social(); }}>
            <label className="field">
              <span>Player name</span>
              <input autoFocus maxLength={18} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ApexSpadeOverlord" />
            </label>
            <div className="field"><span>Choose your avatar</span>
              <AvatarPicker value={avatar} onChange={setAvatar} />
            </div>
            <Pill type="submit" color="green" className="wide-btn"><Icon name="play" size={18} /> Start playing — 50,000 free coins</Pill>
          </form>
        </Modal>
      )}
    </div>
  );
}
