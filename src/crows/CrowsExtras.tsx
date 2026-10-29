// Crows Haven: your picture (with your own photo kept on this device) and "install the app" help.
// The Crows Haven site has no game server, so photos are stored in this browser instead of uploaded.
import { useEffect, useRef, useState } from 'react';
import { Avatar, Modal, Pill } from '../components/ui';
import { BOT_PHOTOS } from '../../shared/botphotos';
import { CROWS_PORTRAITS } from './portraits';
import { PEOPLE_KEYS } from '../components/people';
import { ExtraArt, FLOWERS, THINGS, isExtra, extraName } from './ExtraArt';
import { avatarName } from '../components/avatars';
import { profile } from '../lib/profile';
import { installGuide, thisDevice, alreadyInstalled } from '../lib/device';
import { Rich } from '../screens/Install';
import { sfx } from '../lib/sound';

/** The pictures Crows Haven uses: its own AI portraits plus the Spades computer players' AI portraits (no cartoon or drawn pictures). */
const ALL = [...CROWS_PORTRAITS, ...BOT_PHOTOS];
const BY_ID: Record<string, { name: string; file: string }> = Object.fromEntries(ALL.map((p) => [p.id, p]));
export const PORTRAITS = ALL.map((p) => p.id);
/** The name that goes with a portrait (used for computer players). */
export const portraitName = (k: string) => BY_ID[k]?.name ?? 'Player';

/** What players can pick from: a few AI portraits, cartoon characters, animals, things and flowers.
 *  Computer players always use the AI portraits (all of them). */
export const PICK_GROUPS: { title: string; keys: string[] }[] = [
  { title: 'AI portraits', keys: ['c1', 'c4', 'c8', 'c11', 'c13', 'c15', 'c20', 'c22', 'c27', 'c33', 'c37', 'c40'] },
  { title: 'Cartoon characters', keys: [...PEOPLE_KEYS, 'a17', 'a18', 'a19', 'a20', 'a21', 'a22', 'a23', 'a24'] },
  { title: 'Animals', keys: Array.from({ length: 16 }, (_, i) => `a${i + 1}`) },
  { title: 'Things', keys: Object.keys(THINGS) },
  { title: 'Flowers', keys: Object.keys(FLOWERS) },
];
/** A random non-AI picture for a new player (cartoon, animal, thing or flower). */
export const randomPlayerPicture = () => {
  const list = PICK_GROUPS.slice(1).flatMap((g) => g.keys);
  return list[Math.floor(Math.random() * list.length)];
};
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
    return <CrowsAvatar k={PORTRAITS[0]} size={size} name={name} />;
  }
  if (isExtra(k)) {
    return <span className="avatar" style={{ width: size, height: size }} role="img" aria-label={name ? `${name}'s picture` : 'Picture'}><ExtraArt k={k} /></span>;
  }
  if (k.startsWith('c') && BY_ID[k]) {
    return <span className="avatar" style={{ width: size, height: size }} role="img" aria-label={name ? `${name}'s picture` : 'Picture'}><img src={BY_ID[k].file} alt="" draggable={false} loading="lazy" /></span>;
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
  const label = (k: string) => (isExtra(k) ? extraName(k) : BY_ID[k] ? 'AI portrait' : avatarName(k));
  const tile = (k: string) => (
    <button type="button" key={k} role="radio" aria-checked={k === value} className={`avatar-pick ${k === value ? 'on' : ''}`} onClick={() => pick(k)} aria-label={label(k)} title={label(k)}>
      <CrowsAvatar k={k} size={60} />
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
          {PICK_GROUPS.map((g) => [<span key={g.title} className="ap-group">{g.title}</span>, ...g.keys.map(tile)])}
        </div>
      </div>
      <div className="btn-row"><Pill color="green" onClick={onClose}>Done</Pill></div>
    </Modal>
  );
}

interface BipEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
declare global { interface Window { __crowsBip?: BipEvent | null; __crowsInstalled?: boolean } }

/** The browser's install offer (caught as soon as the page starts loading, see vite.config.ts), or null. */
export function useInstall() {
  const [bip, setBip] = useState<BipEvent | null>(() => window.__crowsBip ?? null);
  const [installed, setInstalled] = useState(() => alreadyInstalled() || !!window.__crowsInstalled);
  useEffect(() => {
    const h = () => { setBip(window.__crowsBip ?? null); if (window.__crowsInstalled) setInstalled(true); };
    window.addEventListener('crowsbip', h);
    h();
    return () => window.removeEventListener('crowsbip', h);
  }, []);
  const install = bip ? async () => {
    await bip.prompt();
    const r = await bip.userChoice.catch(() => ({ outcome: 'dismissed' }));
    window.__crowsBip = null; setBip(null);
    if (r.outcome === 'accepted') { window.__crowsInstalled = true; setInstalled(true); }
  } : null;
  return { install, installed };
}

/** Install help: one tap where the browser allows it, otherwise the steps for this device. */
export function InstallHelp({ installPrompt: fromApp, onDone }: { installPrompt: null | (() => void); onDone?: () => void }) {
  const { install, installed } = useInstall();
  const installPrompt = install ?? fromApp;
  const g = installGuide(thisDevice(), !!installPrompt);
  if (installed) return <p className="center">Crows Haven is installed on this device. 🎉 Open it from your home screen or apps.</p>;
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
