import React, { ReactNode, useEffect } from 'react';
import { Card, rankLabel, SUIT_SYMBOL } from '../../shared/engine';
import { sfx } from '../lib/sound';

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
    <div className={`logo ${compact ? 'compact' : ''}`} aria-label="Spade Royale">
      <span className="logo-word">SP</span>
      <span className="logo-spade"><Icon name="spade" size={compact ? 34 : 86} /></span>
      <span className="logo-word">DE</span>
      <span className="logo-sub">ROYALE</span>
    </div>
  );
}

// ---------------- Avatars (original geometric set) ----------------
const AV: Record<string, [string, string, string]> = {
  a1: ['#10b981', '#064e3b', '♠'], a2: ['#6366f1', '#1e1b4b', '★'], a3: ['#f59e0b', '#7c2d12', '♛'], a4: ['#ec4899', '#500724', '♥'],
  a5: ['#06b6d4', '#083344', '♦'], a6: ['#ef4444', '#450a0a', '♣'], a7: ['#a855f7', '#2e1065', '☾'], a8: ['#84cc16', '#1a2e05', '✿'],
  a9: ['#f97316', '#431407', '☀'], a10: ['#3b82f6', '#172554', '♞'], a11: ['#14b8a6', '#042f2e', '♜'], a12: ['#eab308', '#422006', '✦'],
};
export const AVATAR_KEYS = Object.keys(AV);
export function Avatar({ k, size = 64, vip, name }: { k: string; size?: number; vip?: boolean; name?: string }) {
  const [a, b, g] = AV[k] ?? AV.a1;
  return (
    <span className={`avatar ${vip ? 'vip' : ''}`} style={{ width: size, height: size }} role="img" aria-label={name ? `${name}'s avatar` : 'avatar'}>
      <svg viewBox="0 0 64 64" width="100%" height="100%">
        <defs>
          <radialGradient id={`av-${k}`} cx="35%" cy="25%" r="85%"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></radialGradient>
        </defs>
        <circle cx="32" cy="32" r="32" fill={`url(#av-${k})`} />
        <path d="M0 44 Q16 36 32 44 T64 44 V64 H0z" fill="#000" opacity=".18" />
        <text x="32" y="42" textAnchor="middle" fontSize="30" fill="#fff" fontFamily="'Segoe UI Symbol','Apple Symbols','DejaVu Sans',sans-serif" style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,.4))' }}>{g}{'︎'}</text>
      </svg>
    </span>
  );
}

// ---------------- Playing card ----------------
export function CardView({ card, small, back, className, onClick, disabled, style }: {
  card?: Card; small?: boolean; back?: boolean; className?: string; onClick?: () => void; disabled?: boolean; style?: React.CSSProperties;
}) {
  if (back || !card) return <div className={`pcard back ${small ? 'small' : ''} ${className ?? ''}`} style={style} aria-hidden="true" />;
  const red = card.s === 'H' || card.s === 'D';
  const label = `${rankLabel(card.r)} of ${({ S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' })[card.s]}`;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`pcard ${red ? 'red' : 'black'} ${small ? 'small' : ''} ${className ?? ''}`} style={style}
      onClick={onClick} disabled={onClick ? disabled : undefined} aria-label={label}>
      <span className="pc-corner"><b>{rankLabel(card.r)}</b><i>{SUIT_SYMBOL[card.s]}{'︎'}</i></span>
      <span className="pc-center">{SUIT_SYMBOL[card.s]}{'︎'}</span>
      <span className="pc-corner br"><b>{rankLabel(card.r)}</b><i>{SUIT_SYMBOL[card.s]}{'︎'}</i></span>
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
