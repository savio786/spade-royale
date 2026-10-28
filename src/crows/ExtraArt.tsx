// Crows Haven picture choices drawn for this game: flowers (f1–f10) and things (t1–t12).
// All original simple drawings. Crows Haven only — Spades never loads this file.
import React from 'react';

type Art = { name: string; bg: [string, string]; draw: React.ReactNode };

const ring = (n: number, f: (i: number, deg: number) => React.ReactNode) =>
  Array.from({ length: n }, (_, i) => f(i, (360 / n) * i));

const stem = (d = 'M50 62 C50 72 49 82 50 96') => <path d={d} stroke="#3f8f3a" strokeWidth="4" fill="none" strokeLinecap="round" />;
const leaf = (x: number, y: number, rot: number, flip = 1) => (
  <path d="M0 0 C8 -10 22 -8 26 0 C22 8 8 10 0 0Z" fill="#4caf50" transform={`translate(${x} ${y}) rotate(${rot}) scale(${flip} 1)`} />
);

export const FLOWERS: Record<string, Art> = {
  f1: { name: 'Rose', bg: ['#ffe3e6', '#f7b6be'], draw: <>
    {stem()}{leaf(50, 80, -30)}{leaf(50, 86, 210, 1)}
    <circle cx="50" cy="42" r="24" fill="#c8102e" />
    <path d="M27 44 C30 22 70 20 73 44 C66 34 34 34 27 44Z" fill="#e0263f" />
    <circle cx="50" cy="42" r="15" fill="#a50d25" />
    <path d="M50 30 C62 30 64 44 54 48 C46 51 40 44 44 38 C47 34 54 36 53 41" stroke="#ff5a6e" strokeWidth="3" fill="none" strokeLinecap="round" />
    <path d="M30 50 C36 62 64 62 70 50 C62 58 38 58 30 50Z" fill="#8e0a1f" />
  </> },
  f2: { name: 'Sunflower', bg: ['#e6f4ff', '#a9d6f5'], draw: <>
    {stem('M50 60 C51 74 49 84 50 98')}{leaf(50, 82, -25)}
    {ring(16, (i, d) => <ellipse key={i} cx="50" cy="20" rx="6.5" ry="15" fill={i % 2 ? '#ffc21a' : '#ffd84a'} transform={`rotate(${d} 50 42)`} />)}
    <circle cx="50" cy="42" r="14" fill="#6b3d12" />
    {ring(10, (i, d) => <circle key={i} cx="50" cy="34" r="1.8" fill="#3d2207" transform={`rotate(${d} 50 42)`} />)}
    <circle cx="50" cy="42" r="5" fill="#4a2a0b" />
  </> },
  f3: { name: 'Tulip', bg: ['#fff1d6', '#ffd38a'], draw: <>
    {stem('M50 64 C50 76 50 86 50 98')}
    <path d="M50 96 C38 86 30 74 32 62 C42 70 48 82 50 96Z" fill="#4caf50" />
    <path d="M50 96 C62 86 70 74 68 62 C58 70 52 82 50 96Z" fill="#43a047" />
    <path d="M31 30 C30 56 40 66 50 66 C60 66 70 56 69 30 L59 42 L50 26 L41 42Z" fill="#e5397a" />
    <path d="M41 42 L50 26 L59 42 C58 56 54 64 50 66 C46 64 42 56 41 42Z" fill="#ff5c9a" />
  </> },
  f4: { name: 'Daisy', bg: ['#e7f6e7', '#9fd89f'], draw: <>
    {ring(14, (i, d) => <ellipse key={i} cx="50" cy="23" rx="6" ry="17" fill="#ffffff" stroke="#e8e8e8" strokeWidth="1" transform={`rotate(${d} 50 50)`} />)}
    <circle cx="50" cy="50" r="13" fill="#ffc928" />
    <circle cx="46" cy="46" r="4" fill="#ffe27a" />
  </> },
  f5: { name: 'Lotus', bg: ['#e2f3f7', '#8fcbd6'], draw: <>
    <path d="M10 80 Q30 74 50 80 T90 80" stroke="#4aa3b5" strokeWidth="3" fill="none" />
    <path d="M14 88 Q32 82 50 88 T86 88" stroke="#4aa3b5" strokeWidth="3" fill="none" opacity=".6" />
    <path d="M50 74 C34 74 16 64 14 52 C28 52 42 60 50 74Z" fill="#f48fb1" />
    <path d="M50 74 C66 74 84 64 86 52 C72 52 58 60 50 74Z" fill="#f48fb1" />
    <path d="M50 74 C36 68 28 52 32 36 C44 44 50 58 50 74Z" fill="#f06292" />
    <path d="M50 74 C64 68 72 52 68 36 C56 44 50 58 50 74Z" fill="#f06292" />
    <path d="M50 74 C42 62 40 42 50 24 C60 42 58 62 50 74Z" fill="#ec407a" />
  </> },
  f6: { name: 'Cherry blossom', bg: ['#fdf0f5', '#f3c4d6'], draw: <>
    {ring(5, (i, d) => <path key={i} d="M50 50 C38 40 38 20 47 16 L50 21 L53 16 C62 20 62 40 50 50Z" fill="#ffb7cf" stroke="#f48fb1" strokeWidth="1.5" transform={`rotate(${d} 50 50)`} />)}
    {ring(8, (i, d) => <g key={i} transform={`rotate(${d} 50 50)`}><path d="M50 50 L50 38" stroke="#c2185b" strokeWidth="1.5" /><circle cx="50" cy="37" r="2" fill="#ffd54f" /></g>)}
    <circle cx="50" cy="50" r="5" fill="#e91e63" />
  </> },
  f7: { name: 'Hibiscus', bg: ['#fff5e0', '#ffcf80'], draw: <>
    {ring(5, (i, d) => <path key={i} d="M50 50 C30 38 30 10 50 10 C70 10 70 38 50 50Z" fill="#ff3d3d" stroke="#d32f2f" strokeWidth="1.5" transform={`rotate(${d} 50 50)`} />)}
    <circle cx="50" cy="50" r="7" fill="#8b0000" />
    <path d="M50 50 L68 28" stroke="#ffeb3b" strokeWidth="3" strokeLinecap="round" />
    {ring(5, (i) => <circle key={i} cx={62 + i * 1.6} cy={32 - i * 2.2} r="2.2" fill="#ffd600" />)}
  </> },
  f8: { name: 'Lavender', bg: ['#f1ecfa', '#c9b6ea'], draw: <>
    {[[36, -8], [50, 0], [64, 8]].map(([x, r], j) => (
      <g key={j} transform={`rotate(${r} ${x} 92)`}>
        <path d={`M${x} 92 L${x} 30`} stroke="#5d8f4a" strokeWidth="3" strokeLinecap="round" />
        {Array.from({ length: 8 }, (_, i) => <g key={i}><ellipse cx={x - 4} cy={22 + i * 6} rx="4" ry="5" fill={i % 2 ? '#8e6bd1' : '#7e57c2'} /><ellipse cx={x + 4} cy={24 + i * 6} rx="4" ry="5" fill={i % 2 ? '#7e57c2' : '#9575cd'} /></g>)}
      </g>
    ))}
  </> },
  f9: { name: 'Poppy', bg: ['#eef6e4', '#bfe09a'], draw: <>
    {stem('M50 60 C52 72 48 84 50 98')}
    <circle cx="36" cy="38" r="17" fill="#e53935" /><circle cx="64" cy="38" r="17" fill="#e53935" />
    <circle cx="38" cy="58" r="16" fill="#f4511e" /><circle cx="62" cy="58" r="16" fill="#f4511e" />
    <circle cx="50" cy="48" r="9" fill="#212121" />
    {ring(8, (i, d) => <circle key={i} cx="50" cy="36" r="1.8" fill="#212121" transform={`rotate(${d} 50 48)`} />)}
  </> },
  f10: { name: 'Lily', bg: ['#cfdcfa', '#6f8fd8'], draw: <>
    {ring(6, (i, d) => <path key={i} d="M50 50 C44 38 44 22 50 10 C56 22 56 38 50 50Z" fill={i % 2 ? '#ffffff' : '#ffd6e6'} stroke="#e07aa0" strokeWidth="1.8" transform={`rotate(${d} 50 50)`} />)}
    {ring(6, (i, d) => <path key={i} d="M50 48 L50 28" stroke="#ff9800" strokeWidth="1.5" transform={`rotate(${d + 30} 50 50)`} />)}
    {ring(6, (i, d) => <circle key={i} cx="50" cy="27" r="2.2" fill="#8d4a1e" transform={`rotate(${d + 30} 50 50)`} />)}
    <circle cx="50" cy="50" r="4" fill="#c5e1a5" />
  </> },
};

const STAR = 'M50 10 L61 38 L91 39 L67 57 L76 86 L50 69 L24 86 L33 57 L9 39 L39 38Z';

export const THINGS: Record<string, Art> = {
  t1: { name: 'Crown', bg: ['#3a2a6a', '#1c1238'], draw: <>
    <path d="M18 70 L14 32 L32 48 L50 24 L68 48 L86 32 L82 70Z" fill="#ffc83d" stroke="#b37a00" strokeWidth="2.5" strokeLinejoin="round" />
    <rect x="18" y="70" width="64" height="12" rx="3" fill="#e0a800" stroke="#b37a00" strokeWidth="2.5" />
    <circle cx="50" cy="56" r="6" fill="#e53935" /><circle cx="32" cy="62" r="4" fill="#1e88e5" /><circle cx="68" cy="62" r="4" fill="#43a047" />
    <circle cx="14" cy="30" r="4" fill="#ffd54f" /><circle cx="50" cy="22" r="4" fill="#ffd54f" /><circle cx="86" cy="30" r="4" fill="#ffd54f" />
  </> },
  t2: { name: 'Diamond', bg: ['#0f3550', '#071a29'], draw: <>
    <path d="M28 28 L72 28 L88 44 L50 88 L12 44Z" fill="#7fd8ff" />
    <path d="M12 44 L88 44 L50 88Z" fill="#4fc3f7" />
    <path d="M28 28 L38 44 L50 28 L62 44 L72 28" fill="none" stroke="#e1f5fe" strokeWidth="2" />
    <path d="M38 44 L50 88 L62 44" fill="none" stroke="#b3e5fc" strokeWidth="2" />
    <path d="M30 34 L36 40" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
  </> },
  t3: { name: 'Gold star', bg: ['#4a148c', '#1a0533'], draw: <>
    <path d={STAR} fill="#ffc83d" stroke="#c98a00" strokeWidth="3" strokeLinejoin="round" />
    <path d="M50 22 L44 38" stroke="#fff6c2" strokeWidth="3" strokeLinecap="round" />
  </> },
  t4: { name: 'Moon', bg: ['#1a2350', '#070b22'], draw: <>
    <path d="M60 14 A36 36 0 1 0 86 66 A30 30 0 1 1 60 14Z" fill="#fff3b0" />
    {[[24, 22, 2.5], [80, 22, 2], [30, 82, 2], [74, 84, 1.6], [16, 54, 1.6]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#ffffff" />)}
  </> },
  t5: { name: 'Sun', bg: ['#8fd3ff', '#3fa9f5'], draw: <>
    {ring(12, (i, d) => <path key={i} d="M50 6 L55 20 L45 20Z" fill="#ffb300" transform={`rotate(${d} 50 50)`} />)}
    <circle cx="50" cy="50" r="24" fill="#ffd54f" stroke="#ffb300" strokeWidth="3" />
    <circle cx="42" cy="46" r="3" fill="#6d4c00" /><circle cx="58" cy="46" r="3" fill="#6d4c00" />
    <path d="M40 56 Q50 64 60 56" stroke="#6d4c00" strokeWidth="3" fill="none" strokeLinecap="round" />
  </> },
  t6: { name: 'Rocket', bg: ['#16213e', '#05070f'], draw: <>
    <path d="M44 74 L50 96 L56 74Z" fill="#ff9800" /><path d="M47 74 L50 88 L53 74Z" fill="#ffeb3b" />
    <path d="M36 62 L26 78 L40 72Z" fill="#e53935" /><path d="M64 62 L74 78 L60 72Z" fill="#e53935" />
    <path d="M50 8 C64 20 66 50 62 74 L38 74 C34 50 36 20 50 8Z" fill="#eceff1" stroke="#90a4ae" strokeWidth="2" />
    <circle cx="50" cy="40" r="8" fill="#29b6f6" stroke="#90a4ae" strokeWidth="3" />
    <path d="M42 18 C46 12 54 12 58 18Z" fill="#e53935" />
  </> },
  t7: { name: 'Guitar', bg: ['#ffe0b2', '#ffb74d'], draw: <>
    <rect x="47" y="6" width="6" height="48" rx="2" fill="#5d4037" />
    <rect x="44" y="4" width="12" height="10" rx="2" fill="#3e2723" />
    <circle cx="50" cy="62" r="17" fill="#c0392b" /><circle cx="50" cy="80" r="15" fill="#c0392b" />
    <circle cx="50" cy="66" r="6" fill="#3e2723" />
    <rect x="42" y="80" width="16" height="4" rx="1" fill="#3e2723" />
    <path d="M48.5 14 L48.5 82 M51.5 14 L51.5 82" stroke="#f5f5f5" strokeWidth=".8" />
  </> },
  t8: { name: 'Anchor', bg: ['#e3f2fd', '#90caf9'], draw: <>
    <circle cx="50" cy="18" r="8" fill="none" stroke="#1a237e" strokeWidth="5" />
    <path d="M50 26 L50 86" stroke="#1a237e" strokeWidth="7" strokeLinecap="round" />
    <path d="M34 38 L66 38" stroke="#1a237e" strokeWidth="6" strokeLinecap="round" />
    <path d="M18 60 C20 80 36 88 50 88 C64 88 80 80 82 60" fill="none" stroke="#1a237e" strokeWidth="7" strokeLinecap="round" />
    <path d="M12 64 L18 54 L26 62Z M88 64 L82 54 L74 62Z" fill="#1a237e" />
  </> },
  t9: { name: 'Lightning', bg: ['#263238', '#0e1417'], draw: <>
    <path d="M58 6 L22 56 L46 56 L38 94 L78 40 L54 40Z" fill="#ffeb3b" stroke="#f9a825" strokeWidth="3" strokeLinejoin="round" />
  </> },
  t10: { name: 'Heart', bg: ['#fce4ec', '#f48fb1'], draw: <>
    <path d="M50 86 C30 72 10 58 10 36 C10 22 22 12 34 12 C42 12 47 17 50 23 C53 17 58 12 66 12 C78 12 90 22 90 36 C90 58 70 72 50 86Z" fill="#e91e63" stroke="#ad1457" strokeWidth="3" />
    <path d="M24 30 C26 24 30 22 34 22" stroke="#ffffff" strokeWidth="4" fill="none" strokeLinecap="round" />
  </> },
  t11: { name: 'Coffee', bg: ['#efebe9', '#bcaaa4'], draw: <>
    <path d="M38 22 C34 16 42 12 38 6 M52 22 C48 16 56 12 52 6 M66 22 C62 16 70 12 66 6" stroke="#8d6e63" strokeWidth="3" fill="none" strokeLinecap="round" />
    <path d="M22 34 L78 34 L72 80 C71 86 66 90 60 90 L40 90 C34 90 29 86 28 80Z" fill="#ffffff" stroke="#6d4c41" strokeWidth="3" />
    <path d="M78 42 C92 42 92 64 76 64" fill="none" stroke="#6d4c41" strokeWidth="5" />
    <ellipse cx="50" cy="36" rx="26" ry="4" fill="#6d4c41" />
    <path d="M42 58 C42 52 50 52 50 58 C50 52 58 52 58 58 C58 64 50 70 50 70 C50 70 42 64 42 58Z" fill="#e57373" />
  </> },
  t12: { name: 'Trophy', bg: ['#1b5e20', '#0a2e0d'], draw: <>
    <path d="M28 14 L72 14 L70 44 C68 58 60 64 50 64 C40 64 32 58 30 44Z" fill="#ffc83d" stroke="#b37a00" strokeWidth="2.5" />
    <path d="M28 20 C12 20 12 44 31 44 M72 20 C88 20 88 44 69 44" fill="none" stroke="#ffc83d" strokeWidth="5" />
    <rect x="45" y="64" width="10" height="12" fill="#e0a800" />
    <rect x="32" y="76" width="36" height="10" rx="2" fill="#8d6e63" />
    <path d="M50 24 L53 32 L61 32 L55 37 L57 45 L50 40 L43 45 L45 37 L39 32 L47 32Z" fill="#fff6c2" />
  </> },
};

const ALL: Record<string, Art> = { ...FLOWERS, ...THINGS };
export const isExtra = (k: string) => k in ALL;
export const extraName = (k: string) => ALL[k]?.name ?? '';

export function ExtraArt({ k }: { k: string }) {
  const a = ALL[k];
  if (!a) return null;
  const id = `xg-${k}`;
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <defs><radialGradient id={id} cx=".35" cy=".3" r=".8"><stop offset="0" stopColor={a.bg[0]} /><stop offset="1" stopColor={a.bg[1]} /></radialGradient></defs>
      <rect width="100" height="100" fill={`url(#${id})`} />
      <g transform="translate(10 10) scale(.8)">{a.draw}</g>
    </svg>
  );
}
