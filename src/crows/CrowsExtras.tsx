// Crows Haven: your picture (with your own photo kept on this device) and "install the app" help.
// The Crows Haven site has no game server, so photos are stored in this browser instead of uploaded.
import { useRef, useState } from 'react';
import { Avatar, Modal, Pill } from '../components/ui';
import { BOT_PHOTOS } from '../../shared/botphotos';
import { profile } from '../lib/profile';
import { installGuide, thisDevice, alreadyInstalled } from '../lib/device';
import { Rich } from '../screens/Install';
import { sfx } from '../lib/sound';

/** The pictures Crows Haven uses: the same AI portraits as the Spades computer players (no cartoon or drawn pictures). */
export const PORTRAITS = BOT_PHOTOS.map((b) => b.id);
export const isPortrait = (k: string) => PORTRAITS.includes(k);
export const randomPortrait = (exclude: string[] = []) => {
  const free = PORTRAITS.filter((k) => !exclude.includes(k));
  const list = free.length ? free : PORTRAITS;
  return list[Math.floor(Math.random() * list.length)];
};

/** Avatar key for "my own photo", kept in this browser only. */
export const MY_PHOTO = 'crows-photo';
const PHOTO_KEY = 'crowsPhoto';
const readPhoto = () => { try { return localStorage.getItem(PHOTO_KEY); } catch { return null; } };

/** A player's picture: your own photo from this device, or one of the shared illustrated pictures. */
export function CrowsAvatar({ k, size = 64, name }: { k: string; size?: number; name?: string }) {
  if (k === MY_PHOTO) {
    const src = readPhoto();
    if (src) return <span className="avatar" style={{ width: size, height: size }} role="img" aria-label={name ? `${name}'s photo` : 'Your photo'}><img src={src} alt="" draggable={false} /></span>;
    return <Avatar k={PORTRAITS[0]} size={size} name={name} />;
  }
  return <Avatar k={k} size={size} name={name} />;
}

/** Square-crop a photo and shrink it to a small JPEG (so it fits in browser storage). */
async function toSmallJpeg(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('That file isn’t a picture we can read.')); i.src = url; });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas'); c.width = c.height = 200;
    const g = c.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    const sx = (img.naturalWidth - side) / 2, sy = Math.max(0, (img.naturalHeight - side) / 2 - (img.naturalHeight - side) * 0.2);
    g.drawImage(img, sx, sy, side, side, 0, 0, 200, 200);
    return c.toDataURL('image/jpeg', 0.8);
  } finally { URL.revokeObjectURL(url); }
}

export function PictureModal({ onClose }: { onClose: () => void }) {
  const [value, setValue] = useState(profile.get().avatar);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pick = (k: string) => { sfx.click(); setValue(k); profile.set({ avatar: k }); };
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setErr(null);
    try {
      if (!f.type.startsWith('image/')) throw new Error('Please choose a picture file.');
      const data = await toSmallJpeg(f);
      try { localStorage.setItem(PHOTO_KEY, data); } catch { throw new Error('This browser won’t let us save the photo (private mode?).'); }
      pick(MY_PHOTO);
    } catch (e) { setErr((e as Error).message); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  };
  const tile = (k: string, i: number) => (
    <button type="button" key={k} role="radio" aria-checked={k === value} className={`avatar-pick ${k === value ? 'on' : ''}`} onClick={() => pick(k)} aria-label={`Picture ${i + 1}`}>
      <Avatar k={k} size={60} />
    </button>
  );
  return (
    <Modal title="Your picture" onClose={onClose} wide>
      <div className="avatar-picker">
        <div className="ap-preview"><CrowsAvatar k={value} size={84} /><b>{value === MY_PHOTO ? 'Your photo' : 'Your picture'}</b>
          <button type="button" className="ap-upload" onClick={() => fileRef.current?.click()}>{value === MY_PHOTO ? 'Change photo' : 'Use my photo'}</button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        {err && <p className="ap-err" role="alert">{err}</p>}
        <p className="crows-small-note">Your photo stays on this device; other players at your table see it during the game.</p>
        <div className="avatar-grid crows-portraits" role="radiogroup" aria-label="Choose a picture">
          {PORTRAITS.map(tile)}
        </div>
      </div>
      <div className="btn-row"><Pill color="green" onClick={onClose}>Done</Pill></div>
    </Modal>
  );
}

/** Install help: one tap where the browser allows it, otherwise the steps for this device. */
export function InstallHelp({ installPrompt, onDone }: { installPrompt: null | (() => void); onDone?: () => void }) {
  const g = installGuide(thisDevice(), !!installPrompt);
  if (alreadyInstalled()) return <p className="center">Crows Haven is already installed on this device. 🎉</p>;
  return (
    <div className="crows-install">
      <p>Put Crows Haven on your phone's home screen or your computer's desktop and open it like any other app — full screen, and it keeps working without internet against the computer players.</p>
      {installPrompt
        ? <button className="cl-btn" onClick={() => { sfx.click(); installPrompt(); onDone?.(); }}>⤓ INSTALL NOW</button>
        : g.supported
          ? <ol className="crows-install-steps">{g.steps.map((s, i) => <li key={i}><Rich text={s} /></li>)}</ol>
          : <p>{g.short} {g.steps.map((s, i) => <span key={i}><Rich text={s} /> </span>)}</p>}
      {g.note && <p className="crows-small-note">{g.note}</p>}
      <p className="crows-small-note">Other devices: iPhone/iPad — open in Safari, tap Share, then Add to Home Screen. Android — Chrome menu ⋮, then Install app. Windows/Mac — Chrome or Edge, install icon in the address bar.</p>
    </div>
  );
}

export function InstallModal({ installPrompt, onClose }: { installPrompt: null | (() => void); onClose: () => void }) {
  return (
    <Modal title="Install Crows Haven" onClose={onClose}>
      <InstallHelp installPrompt={installPrompt} onDone={onClose} />
      <div className="btn-row"><Pill color="blue" onClick={onClose}>Close</Pill></div>
    </Modal>
  );
}
