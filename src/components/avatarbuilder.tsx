// Avatar designer: a character is a short code, "c:" + 8 base-36 characters, one per slot below.
// Hair, face and outfit are drawn as SVG so every combination lines up; accessories and backdrops are
// small Canva-made images in /ui/avatar-parts/. Only the code is saved and sent to other players.
import type { ReactNode } from 'react';

export const isBuilt = (k: string) => /^c:[0-9a-z]{8}$/.test(k);

interface Opt { name: string; price: number; color?: string }
export const SLOT_DEFS: { id: string; label: string; opts: Opt[] }[] = [
  { id: 'skin', label: 'Skin', opts: ['#ffe0c2', '#f6c89b', '#e0a470', '#bd7a48', '#8a5230', '#5a3822'].map((color, i) => ({ name: `Tone ${i + 1}`, price: 0, color })) },
  { id: 'hair', label: 'Hair', opts: [
    { name: 'Short', price: 0 }, { name: 'Buzz', price: 0 }, { name: 'Afro', price: 2000 }, { name: 'Long', price: 0 },
    { name: 'Bun', price: 2500 }, { name: 'Mohawk', price: 5000 }, { name: 'Bald', price: 0 }, { name: 'Curly', price: 3000 } ] },
  { id: 'hcol', label: 'Hair colour', opts: [
    { name: 'Black', price: 0, color: '#241812' }, { name: 'Brown', price: 0, color: '#5c3720' }, { name: 'Blond', price: 0, color: '#e9c45c' }, { name: 'Ginger', price: 0, color: '#b8431e' },
    { name: 'Purple', price: 3000, color: '#7d4dff' }, { name: 'Pink', price: 3000, color: '#ff5ca8' }, { name: 'Blue', price: 3000, color: '#2bb8ff' }, { name: 'Silver', price: 3000, color: '#e6e8f2' } ] },
  { id: 'eyes', label: 'Eyes', opts: [{ name: 'Classic', price: 0 }, { name: 'Bright', price: 0 }, { name: 'Happy', price: 1000 }, { name: 'Cool', price: 1000 }] },
  { id: 'mouth', label: 'Mouth', opts: [{ name: 'Smile', price: 0 }, { name: 'Grin', price: 0 }, { name: 'Smirk', price: 1000 }, { name: 'Wow', price: 1000 }] },
  { id: 'outfit', label: 'Outfit', opts: [
    { name: 'Blue tee', price: 0, color: '#3f6bff' }, { name: 'Red tee', price: 0, color: '#e23c4e' }, { name: 'Hoodie', price: 1500, color: '#2a2a3c' }, { name: 'Suit', price: 5000, color: '#20263f' },
    { name: 'Gold jersey', price: 6000, color: '#f2b52c' }, { name: 'Casino vest', price: 6000, color: '#1c7a4a' }, { name: 'Tuxedo', price: 10000, color: '#15151f' }, { name: 'Shirt', price: 1500, color: '#f4f5fb' } ] },
  { id: 'acc', label: 'Extras', opts: [{ name: 'None', price: 0 }, { name: 'Shades', price: 4000 }, { name: 'Headphones', price: 6000 }, { name: 'Cap', price: 3000 }, { name: 'Crown', price: 20000 }] },
  { id: 'bg', label: 'Backdrop', opts: [
    { name: 'Blue', price: 0, color: '#3e63e8' }, { name: 'Purple', price: 0, color: '#7b4fd8' }, { name: 'Neon city', price: 3000 }, { name: 'Casino', price: 3000 }, { name: 'Beach', price: 3000 }, { name: 'Space', price: 5000 } ] },
];
export const IDX = Object.fromEntries(SLOT_DEFS.map((s, i) => [s.id, i]));
export const DEFAULT_CODE = 'c:00000000';

export function decode(code: string): number[] {
  const body = isBuilt(code) ? code.slice(2) : '00000000';
  return SLOT_DEFS.map((s, i) => { const n = parseInt(body[i], 36); return Number.isFinite(n) && n < s.opts.length ? n : 0; });
}
export const encode = (v: number[]) => 'c:' + v.map((n) => n.toString(36)).join('');
export const ownedKey = (slot: string, i: number) => `${slot}:${i}`;
export const isOwned = (owned: string[], slot: string, i: number) => SLOT_DEFS[IDX[slot]].opts[i].price === 0 || owned.includes(ownedKey(slot, i));

const INK = '#1d1a24';
export const BG_IMG: Record<number, string> = { 2: 'bg-neon', 3: 'bg-casino', 4: 'bg-beach', 5: 'bg-space' };
const ACC: Record<number, { f: string; x: number; y: number; s: number }> = {
  1: { f: 'acc-shades', x: 24, y: 22, s: 52 },
  2: { f: 'acc-phones', x: 13, y: -1, s: 74 },
  3: { f: 'acc-cap', x: 20, y: -16, s: 60 },
  4: { f: 'acc-crown', x: 27, y: -8, s: 46 },
};

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return `#${[f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function HairBack({ style, c }: { style: number; c: string }): ReactNode {
  if (style === 2) return <circle cx="50" cy="34" r="29" fill={c} />;
  if (style === 3) return <path d="M25 42 Q21 16 50 15 Q79 16 75 42 L80 86 Q64 82 64 62 L36 62 Q36 82 20 86Z" fill={c} />;
  if (style === 4) return <circle cx="50" cy="14" r="10" fill={c} />;
  return null;
}
function HairFront({ style, c }: { style: number; c: string }): ReactNode {
  const hi = shade(c, 0.12);
  switch (style) {
    case 0: return <><path d="M27 46 Q24 17 50 17 Q76 17 73 46 Q70 31 50 30 Q30 31 27 46Z" fill={c} /><path d="M34 26 Q44 19 58 21" stroke={hi} strokeWidth="2.4" fill="none" strokeLinecap="round" /></>;
    case 1: return <path d="M29 42 Q30 20 50 20 Q70 20 71 42 Q65 29 50 28 Q35 29 29 42Z" fill={c} opacity=".92" />;
    case 2: return <path d="M28 44 Q30 24 50 24 Q70 24 72 44 Q64 33 50 33 Q36 33 28 44Z" fill={c} />;
    case 3: return <path d="M26 46 Q24 17 50 16 Q76 17 74 46 Q66 28 54 27 Q40 30 26 46Z" fill={c} />;
    case 4: return <path d="M27 46 Q24 18 50 18 Q76 18 73 46 Q68 30 50 30 Q32 30 27 46Z" fill={c} />;
    case 5: return <><path d="M44 26 Q50 -2 56 26 Q50 22 44 26Z" fill={c} /><path d="M28 44 Q30 28 44 26 L44 30 Q34 32 28 44Z M72 44 Q70 28 56 26 L56 30 Q66 32 72 44Z" fill={c} opacity=".35" /></>;
    case 7: return <g fill={c}>{[[30, 30], [38, 22], [50, 19], [62, 22], [70, 30], [27, 40], [73, 40], [44, 28], [57, 28]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="8" />)}</g>;
    default: return <ellipse cx="42" cy="26" rx="8" ry="3.4" fill="#fff" opacity=".28" />;
  }
}

function Eyes({ i }: { i: number }) {
  if (i === 1) return <g>{[-1, 1].map((s) => <g key={s}><ellipse cx={50 + s * 11} cy="47" rx="6" ry="6.6" fill="#fff" stroke={INK} strokeWidth="1" /><circle cx={50 + s * 11 + 1} cy="48" r="3.4" fill="#3a2a1c" /><circle cx={50 + s * 11 + 2.4} cy="46" r="1.3" fill="#fff" /></g>)}</g>;
  if (i === 2) return <g fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round">{[-1, 1].map((s) => <path key={s} d={`M${50 + s * 11 - 5} 48 Q${50 + s * 11} 41 ${50 + s * 11 + 5} 48`} />)}</g>;
  if (i === 3) return <g>{[-1, 1].map((s) => <g key={s}><ellipse cx={50 + s * 11} cy="48" rx="5" ry="4.4" fill="#fff" stroke={INK} strokeWidth="1" /><circle cx={50 + s * 11} cy="49" r="2.6" fill={INK} /><path d={`M${50 + s * 11 - 6} 45.6 H${50 + s * 11 + 6}`} stroke={INK} strokeWidth="2.4" strokeLinecap="round" /></g>)}</g>;
  return <g>{[-1, 1].map((s) => <g key={s}><ellipse cx={50 + s * 11} cy="47" rx="3.8" ry="4.8" fill={INK} /><circle cx={50 + s * 11 + 1.2} cy="45.4" r="1.4" fill="#fff" /></g>)}</g>;
}
function Mouth({ i }: { i: number }) {
  if (i === 1) return <><path d="M41 59 Q50 72 59 59Z" fill="#7a1f2e" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" /><path d="M43 60.2 H57 V62.6 Q50 64 43 62.6Z" fill="#fff" /></>;
  if (i === 2) return <path d="M42 62 Q51 67 60 58" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />;
  if (i === 3) return <ellipse cx="50" cy="63" rx="4.2" ry="5" fill="#7a1f2e" stroke={INK} strokeWidth="1.6" />;
  return <path d="M42 60 Q50 68 58 60" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />;
}

function Outfit({ i }: { i: number }) {
  const c = SLOT_DEFS[IDX.outfit].opts[i].color!;
  const dark = shade(c, -0.14);
  const body = <path d="M10 100 Q12 76 36 71 H64 Q88 76 90 100Z" fill={c} />;
  if (i === 2) return <>{body}<path d="M36 71 Q50 88 64 71 Q50 80 36 71Z" fill={dark} /><path d="M44 78 V90 M56 78 V90" stroke="#e6e8f2" strokeWidth="1.8" strokeLinecap="round" /></>;
  if (i === 3) return <>{body}<path d="M36 71 L50 94 L64 71 L56 71 L50 80 L44 71Z" fill="#f4f5fb" /><path d="M36 71 L47 100 L40 100Z M64 71 L53 100 L60 100Z" fill={shade(c, 0.07)} /><path d="M50 78 L46 100 H54Z" fill="#d83a4c" /></>;
  if (i === 4) return <>{body}<path d="M36 71 Q50 84 64 71" fill="none" stroke="#fff" strokeWidth="3" /><path d="M50 82 C46 88 41 90 41 94 c0 2.4 2 3.4 4 3.2 1.2-.1 2.2-.8 2.6-1.4-.1 1.4-.7 2.6-1.8 3.4h8.4c-1.1-.8-1.7-2-1.8-3.4.4.6 1.4 1.3 2.6 1.4 2 .2 4-.8 4-3.2 0-4-5-6-9-12z" fill="#fff" opacity=".92" /></>;
  if (i === 5) return <>{body}<path d="M36 71 L50 100 L64 71 L58 71 L50 84 L42 71Z" fill="#f4f5fb" /><path d="M36 71 L50 100 H30Z M64 71 L50 100 H70Z" fill={dark} /><circle cx="50" cy="90" r="1.6" fill="#ffd45a" /></>;
  if (i === 6) return <>{body}<path d="M36 71 L50 96 L64 71 L56 71 L50 80 L44 71Z" fill="#f4f5fb" /><path d="M44 77 L50 80 L56 77 L56 84 L50 81 L44 84Z" fill="#d83a4c" /></>;
  if (i === 7) return <>{body}<path d="M36 71 L50 84 L64 71 L58 71 L50 77 L42 71Z" fill="#cfd4ea" /><path d="M50 84 V100" stroke="#cfd4ea" strokeWidth="1.4" /></>;
  return <>{body}<path d="M38 71 Q50 80 62 71" fill="none" stroke={dark} strokeWidth="3" /></>;
}

export function BuiltAvatar({ code }: { code: string }) {
  const [skin, hair, hcol, eyes, mouth, outfit, acc, bg] = decode(code);
  const skinC = SLOT_DEFS[IDX.skin].opts[skin].color!;
  const hairC = SLOT_DEFS[IDX.hcol].opts[hcol].color!;
  const bgDef = SLOT_DEFS[IDX.bg].opts[bg];
  const a = ACC[acc];
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <defs>
        <linearGradient id={`bgg${bg}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={bgDef.color ? shade(bgDef.color, 0.14) : '#000'} /><stop offset="1" stopColor={bgDef.color ?? '#000'} /></linearGradient>
        <clipPath id="bcut"><rect width="100" height="100" /></clipPath>
      </defs>
      {BG_IMG[bg] ? <image href={`/ui/avatar-parts/${BG_IMG[bg]}.webp`} width="100" height="100" preserveAspectRatio="xMidYMid slice" /> : <rect width="100" height="100" fill={`url(#bgg${bg})`} />}
      <ellipse cx="34" cy="16" rx="40" ry="22" fill="#fff" opacity=".1" />
      <g clipPath="url(#bcut)">
        <HairBack style={hair} c={hairC} />
        <Outfit i={outfit} />
        <rect x="43" y="62" width="14" height="14" rx="5" fill={shade(skinC, -0.07)} />
        <ellipse cx="28.5" cy="50" rx="4" ry="6" fill={shade(skinC, -0.04)} /><ellipse cx="71.5" cy="50" rx="4" ry="6" fill={shade(skinC, -0.04)} />
        <ellipse cx="50" cy="47" rx="22" ry="25" fill={skinC} />
        <ellipse cx="50" cy="68" rx="14" ry="5" fill={shade(skinC, -0.05)} opacity=".4" />
        <g opacity=".5">{[-1, 1].map((s) => <ellipse key={s} cx={50 + s * 15} cy="56" rx="4.4" ry="3" fill="#ff8fa3" />)}</g>
        <Eyes i={eyes} />
        <Mouth i={mouth} />
        <HairFront style={hair} c={hairC} />
        {a && <image href={`/ui/avatar-parts/${a.f}.webp`} x={a.x} y={a.y} width={a.s} height={a.s} />}
      </g>
    </svg>
  );
}

