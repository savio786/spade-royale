import { useState } from 'react';
import { AVATAR_KEYS, AvatarPicker, Icon, Logo, Modal, Pill } from '../components/ui';
import { profile } from '../lib/profile';
import { sfx } from '../lib/sound';

type Provider = 'facebook' | 'google' | 'guest';

export function Login() {
  const [step, setStep] = useState<null | Provider>(null);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATAR_KEYS[Math.floor(Math.random() * AVATAR_KEYS.length)]);

  const finish = () => {
    const n = name.trim() || `Guest${Math.floor(1000 + Math.random() * 9000)}`;
    profile.set({ name: n.slice(0, 18), avatar, provider: step ?? 'guest' });
    sfx.coins();
  };

  return (
    <div className="screen login felt-bg">
      <div className="login-inner">
        <Logo />
        <div className="logo-tag">TOURNAMENT</div>
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
        <button className="guest-link" onClick={() => { sfx.click(); setStep('guest'); }}>Continue as guest</button>
      </div>

      {step && (
        <Modal title={step === 'guest' ? 'Create your player' : `Sign in with ${step === 'facebook' ? 'Facebook' : 'Google Play Games'}`} onClose={() => setStep(null)}>
          {step !== 'guest' && (
            <p className="note">Social sign-in needs your own app keys (see README → “Sign-in”). Until they're added, this creates a local profile tagged to {step === 'facebook' ? 'Facebook' : 'Google'}.</p>
          )}
          <form className="profile-form" onSubmit={(e) => { e.preventDefault(); finish(); }}>
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
