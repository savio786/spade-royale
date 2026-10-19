import React, { ReactNode, useEffect } from 'react';
import { Card, rankLabel, SUIT_SYMBOL } from '../../shared/engine';
import { sfx } from '../lib/sound';
import { AvatarArt, avatarName, isPhoto, AVATAR_KEYS as AVATAR_KEYS_LIST } from './avatars';
import { PEOPLE_KEYS } from './people';
import { photoUrl, uploadPhoto } from '../lib/photo';

// ---------------- Icons ----------------
const P: Record<string, ReactNode> = {
  play: <path d="M7 4.5v15l13-7.5z" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  podium: <><rect x="9" y="5" width="6" height="15" rx="1" /><rect x="3" y="10" width="6" height="10" rx="1" /><rect x="15" y="13" width="6" height="7" rx="1" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 20h8M9 17h6" /></>,
  gift: <><rect x="4" y="9" width="16" height="11" rx="1" /><path d="M3 9h18M12 9v11M12 9c-2-4-6-4-6-1.5S10 9 12 9c2 0 6-.2 6-1.5S14 5 12 9" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.8" /><path d="M16 14.2a5 5 0 0 1 6 4.8" /></>,
  gear: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  left: <path d="M15 5l-7 7 7 7" />,
  right: <path d="M9 5l7 7-7 7" />,
  tv: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M10 9.5v5l4.5-2.5z" /></>,
  crown: <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />,
  send: <path d="M4 12l16-8-6 16-2.5-6.5z" />,
  sound: <><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /></>,
  mute: <><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M17 9l5 6M22 9l-5 6" /></>,
  exit: <><path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V4H4v12h4" /></>,
  download: <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />,
  windows: <path d="M3 5.5l7.5-1v7H3zM12 4.3L21 3v8.5h-9zM3 12.5h7.5v7L3 18.5zM12 12.5h9V21l-9-1.3z" />,
  apple: <path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9s-1.8-.8-3-.8C6.9 7.4 5.4 8.3 4.6 9.8c-1.7 2.9-.4 7.2 1.2 9.5.8 1.1 1.7 2.4 2.9 2.4s1.6-.8 3-.8 1.8.8 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.4-1-2.4-4.1zM14.1 5.8c.6-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.1 1.8-1 2.9 1.1.1 2.2-.6 2.8-1.4z" />,
  android: <><path d="M6 10h12v8a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" /><path d="M6 9a6 6 0 0 1 12 0zM8 4l1.3 2M16 4l-1.3 2M3.5 10.5v5M20.5 10.5v5M9 19v2.5M15 19v2.5" /></>,
  ipad: <><rect x="5" y="2.5" width="14" height="19" rx="2" /><path d="M11 18.5h2" /></>,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  spade: <path d="M12 2.5C9 7 3.5 9.5 3.5 14a4.5 4.5 0 0 0 7.4 3.4L9.5 21.5h5l-1.4-4.1A4.5 4.5 0 0 0 20.5 14C20.5 9.5 15 7 12 2.5z" />,
};
const FILLED = new Set(['play', 'star', 'crown', 'apple', 'windows', 'bolt', 'spade', 'send']);
export function Icon({ name, size = 22, className, style }: { name: string; size?: number; className?: string; style?: React.CSSProperties }) {
  const filled = FILLED.has(name);
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {P[name]}
    </svg>
  );
}

// ---------------- Coin / Logo ----------------
export function Coin({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="coin-svg">
      <defs>
        <radialGradient id="cg" cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#fff6c2" /><stop offset=".45" stopColor="#ffc83d" /><stop offset="1" stopColor="#b86a00" /></radialGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill="url(#cg)" stroke="#8a4b00" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="11" fill="none" stroke="#fff3b0" strokeOpacity=".6" strokeWidth="1.2" />
      <path d="M16 7.5c-2 3-6 4.8-6 8a3.2 3.2 0 0 0 5.3 2.4l-1 3.1h3.4l-1-3.1A3.2 3.2 0 0 0 22 15.5c0-3.2-4-5-6-8z" fill="#9a5600" />
    </svg>
  );
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className={`logo ${compact ? 'compact' : ''}`} role="img" aria-label="Spade Haven">
      <img className="logo-emblem" src="./brand/emblem.svg" alt="" draggable={false} />
      <span className="logo-name" aria-hidden="true"><span>SPADE</span><span>HAVEN</span></span>
    </div>
  );
}

// ---------------- Avatars (cartoon animals & characters: ./avatars.tsx) ----------------
export { AVATAR_KEYS, avatarName } from './avatars';
export function Avatar({ k, size = 64, vip, name }: { k: string; size?: number; vip?: boolean; name?: string }) {
  return (
    <span className={`avatar ${vip ? 'vip' : ''}`} style={{ width: size, height: size }} role="img" aria-label={name ? `${name}'s avatar` : `${avatarName(k)} avatar`}>
      {isPhoto(k) ? <PhotoImg k={k} /> : <AvatarArt k={k} />}
    </span>
  );
}

function PhotoImg({ k }: { k: string }) {
  const [bad, setBad] = React.useState(false);
  if (bad) return <AvatarArt k="p3" />;
  return <img src={photoUrl(k)} alt="" draggable={false} onError={() => setBad(true)} />;
}

/** Big preview + grid of all avatars with their names, plus "use my photo". */
export function AvatarPicker({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true); setErr(null);
    try { onChange(await uploadPhoto(f)); sfx.click(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const tile = (k: string) => (
    <button type="button" key={k} role="radio" aria-checked={k === value} className={`avatar-pick ${k === value ? 'on' : ''}`}
      onClick={() => { sfx.click(); onChange(k); }} aria-label={avatarName(k)} title={avatarName(k)}>
      <Avatar k={k} size={52} /><small>{avatarName(k)}</small>
    </button>
  );
  return (
    <div className="avatar-picker">
      <div className="ap-preview"><Avatar k={value} size={84} /><b>{avatarName(value)}</b>
        <button type="button" className="ap-upload" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Uploading…' : isPhoto(value) ? 'Change photo' : 'Use my photo'}</button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      {err && <p className="ap-err" role="alert">{err}</p>}
      <div className="avatar-grid" role="radiogroup" aria-label="Choose an avatar">
        <span className="ap-group">People</span>
        {PEOPLE_KEYS.map(tile)}
        <span className="ap-group">Animals & characters</span>
        {AVATAR_KEYS_LIST.filter((k) => !PEOPLE_KEYS.includes(k)).map(tile)}
      </div>
    </div>
  );
}

// ---------------- Playing card ----------------
// Suit shapes drawn as SVG so they look identical on every device.
const SUIT_PATH: Record<string, ReactNode> = {
  S: <path d="M50 6C40 24 10 38 10 60c0 14 12 22 24 20 6-1 11-5 13-9-1 9-5 17-11 23h28c-6-6-10-14-11-23 2 4 7 8 13 9 12 2 24-6 24-20 0-22-30-36-40-54z" />,
  H: <path d="M50 90C30 74 8 58 8 36 8 20 20 10 33 10c8 0 14 5 17 11 3-6 9-11 17-11 13 0 25 10 25 26 0 22-22 38-42 54z" />,
  D: <path d="M50 4Q68 28 88 50 68 72 50 96 32 72 12 50 32 28 50 4z" />,
  C: <><circle cx="50" cy="29" r="19" /><circle cx="28" cy="57" r="19" /><circle cx="72" cy="57" r="19" /><path d="M45 52c0 20-6 32-14 42h38c-8-10-14-22-14-42z" /></>,
};
export function SuitIcon({ s, className, style }: { s: string; className?: string; style?: React.CSSProperties }) {
  return <svg className={className} style={style} viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">{SUIT_PATH[s]}</svg>;
}

// Classic pip positions (x%, y%) for number cards.
const PIPS: Record<number, [number, number][]> = {
  2: [[50, 18], [50, 82]],
  3: [[50, 18], [50, 50], [50, 82]],
  4: [[30, 18], [70, 18], [30, 82], [70, 82]],
  5: [[30, 18], [70, 18], [50, 50], [30, 82], [70, 82]],
  6: [[30, 18], [70, 18], [30, 50], [70, 50], [30, 82], [70, 82]],
  7: [[30, 18], [70, 18], [50, 34], [30, 50], [70, 50], [30, 82], [70, 82]],
  8: [[30, 18], [70, 18], [50, 34], [30, 50], [70, 50], [50, 66], [30, 82], [70, 82]],
  9: [[30, 16], [70, 16], [30, 39], [70, 39], [50, 50], [30, 61], [70, 61], [30, 84], [70, 84]],
  10: [[30, 16], [70, 16], [50, 28], [30, 39], [70, 39], [30, 61], [70, 61], [50, 72], [30, 84], [70, 84]],
};

/** Original court-card emblems: crown (K), tiara (Q), plumed cap (J). */
function CourtEmblem({ r }: { r: number }) {
  if (r === 13) return (
    <svg viewBox="0 0 100 60" className="pc-emblem" aria-hidden="true">
      <path d="M12 52 L8 14 L30 32 L50 6 L70 32 L92 14 L88 52Z" fill="#f5c542" stroke="#9a6a00" strokeWidth="3" strokeLinejoin="round" />
      <rect x="12" y="46" width="76" height="9" rx="2" fill="#e0a800" stroke="#9a6a00" strokeWidth="2" />
      <circle cx="50" cy="31" r="5" fill="#d32f2f" /><circle cx="30" cy="38" r="3.5" fill="#1e63c4" /><circle cx="70" cy="38" r="3.5" fill="#1e63c4" />
      {[8, 50, 92].map((x, i) => <circle key={i} cx={x} cy={i === 1 ? 6 : 14} r="4" fill="#fff4c2" stroke="#9a6a00" strokeWidth="1.5" />)}
    </svg>);
  if (r === 12) return (
    <svg viewBox="0 0 100 60" className="pc-emblem" aria-hidden="true">
      <path d="M10 50 Q50 2 90 50 Q70 40 50 40 Q30 40 10 50Z" fill="#f5c542" stroke="#9a6a00" strokeWidth="3" strokeLinejoin="round" />
      <path d="M50 12 L55 26 L50 34 L45 26Z" fill="#d81b60" stroke="#880e4f" strokeWidth="1.5" />
      <circle cx="30" cy="34" r="3.5" fill="#fff" stroke="#9a6a00" /><circle cx="70" cy="34" r="3.5" fill="#fff" stroke="#9a6a00" />
      <path d="M14 52 Q50 44 86 52" fill="none" stroke="#9a6a00" strokeWidth="3" strokeLinecap="round" />
    </svg>);
  return (
    <svg viewBox="0 0 100 60" className="pc-emblem" aria-hidden="true">
      <path d="M58 30 C66 8 86 4 94 10 C82 12 74 20 70 32Z" fill="#43a047" stroke="#1b5e20" strokeWidth="2" />
      <path d="M14 52 C14 30 30 22 50 22 C70 22 86 30 86 52Z" fill="#1e63c4" stroke="#0d3a80" strokeWidth="3" strokeLinejoin="round" />
      <rect x="10" y="46" width="80" height="9" rx="3" fill="#f5c542" stroke="#9a6a00" strokeWidth="2" />
      <circle cx="50" cy="38" r="4.5" fill="#f5c542" stroke="#9a6a00" strokeWidth="1.5" />
    </svg>);
}

export function CardView({ card, small, back, className, onClick, disabled, style, dataCard }: {
  card?: Card; small?: boolean; back?: boolean; className?: string; onClick?: () => void; disabled?: boolean; style?: React.CSSProperties; dataCard?: string;
}) {
  if (back || !card) return <div className={`pcard back ${small ? 'small' : ''} ${className ?? ''}`} style={style} aria-hidden="true"><span className="pc-back-mark"><SuitIcon s="S" /></span></div>;
  const red = card.s === 'H' || card.s === 'D';
  const label = `${rankLabel(card.r)} of ${({ S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' })[card.s]}`;
  const Tag = onClick ? 'button' : 'div';
  const corner = <><b>{rankLabel(card.r)}</b><SuitIcon s={card.s} className="pc-corner-suit" /></>;
  let body: ReactNode;
  if (small) body = <SuitIcon s={card.s} className="pc-small-suit" />;
  else if (card.r === 14) body = <span className={`pc-ace ${card.s === 'S' ? 'ornate' : ''}`}><SuitIcon s={card.s} /></span>;
  else if (card.r >= 11) body = (
    <span className="pc-face">
      <CourtEmblem r={card.r} />
      <SuitIcon s={card.s} className="pc-face-suit" />
      <span className="pc-face-letter">{rankLabel(card.r)}</span>
    </span>
  );
  else body = (
    <span className="pc-pips">
      {PIPS[card.r].map(([x, y], i) => (
        <SuitIcon key={i} s={card.s} className={`pc-pip ${y > 55 ? 'flip' : ''}`} style={{ left: `${x}%`, top: `${y}%` }} />
      ))}
    </span>
  );
  return (
    <Tag className={`pcard ${red ? 'red' : 'black'} s-${card.s} ${small ? 'small' : ''} ${className ?? ''}`} style={style} data-card={dataCard}
      onClick={onClick} disabled={onClick ? disabled : undefined} aria-label={label}>
      <span className="pc-corner">{corner}</span>
      {body}
      <span className="pc-corner br">{corner}</span>
    </Tag>
  );
}

// ---------------- Big ring button (lobby) ----------------
export function RingButton({ icon, label, color, onClick, badge }: { icon: ReactNode; label: string; color: 'green' | 'blue' | 'purple'; onClick: () => void; badge?: ReactNode }) {
  return (
    <button className={`ring-btn ${color}`} onClick={() => { sfx.click(); onClick(); }}>
      <span className="ring"><span className="ring-inner">{icon}</span>
        {[0, 1, 2, 3].map((i) => <span key={i} className={`ring-bolt b${i}`}>♠{'︎'}</span>)}
      </span>
      <span className="ring-label">{label}</span>
      {badge}
    </button>
  );
}

// ---------------- Modal ----------------
export function Modal({ title, onClose, children, wide, className }: { title?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; className?: string }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''} ${className ?? ''}`} role="dialog" aria-modal="true">
        {title && <h2 className="modal-title">{title}</h2>}
        <button className="modal-close" onClick={() => { sfx.click(); onClose(); }} aria-label="Close"><Icon name="close" size={20} /></button>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Pill({ children, color = 'green', onClick, disabled, className, type }: { children: ReactNode; color?: 'green' | 'blue' | 'purple' | 'gold' | 'red' | 'ghost'; onClick?: () => void; disabled?: boolean; className?: string; type?: 'submit' | 'button' }) {
  return (
    <button type={type ?? 'button'} className={`pill ${color} ${className ?? ''}`} disabled={disabled} onClick={() => { sfx.click(); onClick?.(); }}>
      {children}
    </button>
  );
}
