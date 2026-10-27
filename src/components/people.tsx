// Lifelike painted portraits (original artwork) for the computer players. Built from parts so every face is lit the
// same way: soft studio backdrop with bokeh, painted light and shadow on the skin, almond eyes with lids and lashes,
// shaped lips with gloss, layered hair with strands, stubble texture, clothing with folds, film grain and vignette.
import type { ReactNode } from 'react';

type Skin = { base: string; shade: string; hi: string; lip: string };
const SKIN: Record<string, Skin> = {
  s1: { base: '#f3cdb6', shade: '#d39d84', hi: '#fde6d8', lip: '#c86e6e' },
  s2: { base: '#ebbd9b', shade: '#c88f6e', hi: '#f8dac4', lip: '#c2675f' },
  s3: { base: '#d6a07a', shade: '#ab7451', hi: '#ebc29f', lip: '#b05c52' },
  s4: { base: '#c08659', shade: '#93603c', hi: '#d9a77f', lip: '#9b5048' },
  s5: { base: '#9c6643', shade: '#71452a', hi: '#bb8862', lip: '#7b3e36' },
  s6: { base: '#70462b', shade: '#4a2c19', hi: '#90623f', lip: '#5a2c26' },
};

type Hair = 'short' | 'side' | 'buzz' | 'afro' | 'long' | 'bob' | 'bun' | 'waves' | 'bald' | 'cap' | 'curlsLong';
type Top = 'tee' | 'vneck' | 'collar' | 'hoodie' | 'jacket';
export interface PersonSpec {
  name: string; skin: keyof typeof SKIN; hair: Hair; hairColor: string; eyes: string; top: Top; topColor: string; bg: string;
  fem?: boolean; beard?: 'full' | 'stubble' | 'mustache'; beardColor?: string; shades?: boolean; glasses?: boolean; earrings?: boolean; smile?: boolean; capColor?: string;
  lip?: string; shadow?: string; // lipstick and eyeshadow colours (ladies)
}

const shade = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, '0')).join('')}`;
};

// Face shapes: ladies have a softer, narrower jaw; guys a squarer jaw and wider chin.
const FACE_F = 'M50 20 C61 20 68 28 68 41 C68 50 66.6 57 63 62.6 C59.6 67.8 55 70.6 50 70.6 C45 70.6 40.4 67.8 37 62.6 C33.4 57 32 50 32 41 C32 28 39 20 50 20Z';
const FACE_M = 'M50 19.5 C61.5 19.5 69 27.5 69 41 C69 50 68 56.5 65.4 61.4 C62.4 66.6 57 71.4 50 71.4 C43 71.4 37.6 66.6 34.6 61.4 C32 56.5 31 50 31 41 C31 27.5 38.5 19.5 50 19.5Z';

/** Thin highlight / lowlight strands that follow a hairstyle, for a painted look. */
function strands(paths: string[], color: string, opacity: number, width = 0.6) {
  return <g fill="none" stroke={color} strokeOpacity={opacity} strokeWidth={width} strokeLinecap="round">{paths.map((d, i) => <path key={i} d={d} />)}</g>;
}

export function PersonArt({ p, uid }: { p: PersonSpec; uid: string }) {
  const s = SKIN[p.skin];
  const id = (n: string) => `${uid}${n}`;
  const u = (n: string) => `url(#${uid}${n})`;
  const fem = !!p.fem;
  const FACE = fem ? FACE_F : FACE_M;
  const hairHi = shade(p.hairColor, 0.38), hairLo = shade(p.hairColor, -0.45), hairMid = shade(p.hairColor, 0.12);
  const beardC = p.beardColor ?? p.hairColor;
  const lip = fem ? (p.lip ?? '#c8325a') : s.lip;
  const eyeY = 45.5, eyeL = 41.6, eyeR = 58.4;

  // ---------- hair behind the head ----------
  const hairBack: ReactNode = (() => {
    switch (p.hair) {
      case 'long': return <path d="M29 40 C27 19 39 9.5 50 9.5 C61 9.5 73 19 71 40 C72.5 58 75 74 80.5 93 C74 97 66 97 61.5 92 C63.5 80 63.5 70 62.5 63 L37.5 63 C36.5 70 36.5 80 38.5 92 C34 97 26 97 19.5 93 C25 74 27.5 58 29 40Z" fill={u('hair')} />;
      case 'curlsLong': return <g fill={u('hair')}>{[[27, 36, 11], [73, 36, 11], [25, 52, 11.5], [75, 52, 11.5], [26, 68, 11], [74, 68, 11], [31, 82, 10], [69, 82, 10], [50, 15, 16], [34, 20, 12], [66, 20, 12], [24, 82, 8], [76, 82, 8]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}</g>;
      case 'bob': return <path d="M28.5 42 C27 20 39 11.5 50 11.5 C61 11.5 73 20 71.5 42 C72.5 54 72.5 62 73.5 68.5 Q66.5 72 63 64.5 L37 64.5 Q33.5 72 26.5 68.5 C27.5 62 27.5 54 28.5 42Z" fill={u('hair')} />;
      case 'afro': return <g fill={u('hair')}><ellipse cx="50" cy="31" rx="30" ry="23" />{Array.from({ length: 16 }, (_, i) => { const a = Math.PI * (0.92 + (i / 15) * 1.16); return <circle key={i} cx={50 + Math.cos(a) * 28} cy={33 + Math.sin(a) * 21} r={7} />; })}</g>;
      case 'bun': return <><circle cx="50" cy="12.5" r="8.5" fill={u('hair')} />{strands(['M44 10 Q50 6 56 10', 'M43.5 14 Q50 9.5 56.5 14'], hairHi, 0.5, 0.7)}</>;
      default: return null;
    }
  })();

  // ---------- hair in front (fringe, hairline) ----------
  const hairFront: ReactNode = (() => {
    switch (p.hair) {
      case 'short': return <><path d="M30.5 42 C29 25 38.5 13.5 51 13.5 C63.5 13.5 71.5 24 69.5 42 C68.6 35 66.6 30 62 27.6 C55 30.4 44 30.4 37.6 27.6 C33.6 30.4 31.4 35 30.5 42Z" fill={u('hair')} />{strands(['M36 22 Q46 16 58 18', 'M38 26 Q50 20 63 23', 'M34 30 Q40 24 47 23'], hairHi, 0.45)}</>;
      case 'side': return <><path d="M30 44 C28 23 38.5 11.5 52.5 11.5 C66.5 11.5 72.5 24 70 44 C69 35.5 67.2 30 64 27 C57 25 47 30.5 35.5 26.5 C32.6 31 31 37 30 44Z" fill={u('hair')} />{strands(['M36 25 C44 19 56 16 66 21', 'M38 22 C46 16 56 14 64 17', 'M35 28.5 C43 24 51 23.5 58 24.5', 'M57 15 C63 16.5 67 20 69 26'], hairHi, 0.5, 0.7)}{strands(['M40 27 C47 24 55 23 62 25'], hairLo, 0.5, 0.8)}</>;
      case 'waves': return <><path d="M29.5 46 C27 20 38 9.5 52 9.5 C67 9.5 74 21 70.5 46 C69.5 38 68.5 33 65 29 C61 32.5 56 30 52.5 27.5 C48 31 42 31 38 28.5 C33.5 31.5 31 37.5 29.5 46Z" fill={u('hair')} />{strands(['M34 22 Q39 15 46 19 Q52 13 59 18 Q64 14 68 21', 'M33 27 Q39 21 45 24 Q51 19 57 23 Q62 20 67 25'], hairHi, 0.5, 0.8)}</>;
      case 'buzz': return <><path d="M32 38.5 C32 26 40 18.5 50 18.5 C60 18.5 68 26 68 38.5 C64 30.5 57 27.5 50 27.5 C43 27.5 36 30.5 32 38.5Z" fill={u('hair')} opacity=".88" /><path d="M32 38.5 C32 26 40 18.5 50 18.5 C60 18.5 68 26 68 38.5 C64 30.5 57 27.5 50 27.5 C43 27.5 36 30.5 32 38.5Z" fill="#000" filter={u('grain')} opacity=".35" /></>;
      case 'afro': return <g fill={u('hair')}><path d="M31 40 C31 22 39 14 50 14 C61 14 69 22 69 40 C64 31 58 28.5 50 28.5 C42 28.5 36 31 31 40Z" />{[34, 40, 46, 52, 58, 64].map((x, i) => <circle key={i} cx={x} cy={29.2 - Math.sin(((x - 31) / 38) * Math.PI) * 2} r="3.3" />)}</g>;
      case 'curlsLong': return <g>{[[36, 25, 7.5], [45, 21, 7.5], [55, 21, 7.5], [64, 25, 7.5], [31, 33, 5.5], [69, 33, 5.5]].map(([x, y, r], i) => <g key={i}><circle cx={x} cy={y} r={r} fill={u('hair')} /><path d={`M${x - r * 0.5} ${y - r * 0.2} q${r * 0.5} ${-r * 0.6} ${r} 0`} stroke={hairHi} strokeOpacity=".55" strokeWidth=".7" fill="none" /></g>)}</g>;
      case 'long': return <><path d="M30.5 48 C29 27 39 15.5 50.5 15.5 C62 15.5 71 26 69.5 46 C67 36 62 30 54.5 28.5 C49 34.5 41 37.5 33 38.5 C31.6 41.5 31 44.5 30.5 48Z" fill={u('hair')} />{strands(['M33 37 C40 34 48 31 54 28', 'M36 30 C43 25 50 22 58 22', 'M56 27 C62 30 66 35 68.5 42', 'M29.5 50 C28.5 62 27 76 24 90', 'M70.5 50 C71.5 62 73 76 76 90', 'M33 56 C32 68 32 80 34 90', 'M67 56 C68 68 68 80 66 90'], hairHi, 0.42, 0.7)}{strands(['M31 60 C30 72 29 82 27 92', 'M69 60 C70 72 71 82 73 92'], hairLo, 0.5, 0.9)}</>;
      case 'bob': return <><path d="M31 41 C30 24 39 15.5 50 15.5 C61 15.5 70 24 69 41 C66 35.5 60 33.5 50 33.5 C40 33.5 34 35.5 31 41Z" fill={u('hair')} />{strands(['M35 32 C40 26 46 23 52 23', 'M48 22 C56 23 63 27 66 33', 'M29.5 46 C29 54 29 62 30 67', 'M70.5 46 C71 54 71 62 70 67'], hairHi, 0.45, 0.7)}</>;
      case 'bun': return <><path d="M31 41 C31 25 39 17 50 17 C61 17 69 25 69 41 C65 31.5 58 27 50 27 C42 27 35 31.5 31 41Z" fill={u('hair')} />{strands(['M35 32 C40 24 46 20 50 19.5', 'M65 32 C60 24 54 20 50 19.5', 'M40 26 C44 22 47 20.5 50 20'], hairHi, 0.5, 0.6)}</>;
      case 'cap': {
        const c = p.capColor ?? '#c62828';
        return <g><path d="M30 37 C30 19.5 39.5 12 50 12 C60.5 12 70 19.5 70 37Z" fill={u('cap')} /><path d="M50 12 L50 37 M40 14.5 Q38 26 36 37 M60 14.5 Q62 26 64 37" stroke={shade(c, -0.3)} strokeWidth=".6" fill="none" /><circle cx="50" cy="12.8" r="1.5" fill={shade(c, -0.3)} /><path d="M29 36 Q53 30.5 82 38.5 Q80.5 42.5 74.5 42 Q53 37.5 30 40.5Z" fill={shade(c, -0.22)} /><path d="M30 40 Q50 37 74 41.5" stroke="#000" strokeOpacity=".25" strokeWidth="1.2" fill="none" /></g>;
      }
      case 'bald': return <ellipse cx="45" cy="27" rx="9" ry="4.5" fill="#fff" opacity=".25" filter={u('soft')} />;
    }
  })();

  // ---------- clothing ----------
  const top: ReactNode = (() => {
    const body = <path d="M3 100 C5 86 19 78.5 35.5 75.5 Q43 74.4 50 74.4 Q57 74.4 64.5 75.5 C81 78.5 95 86 97 100Z" fill={u('top')} />;
    const folds = <path d="M22 88 Q28 92 30 100 M78 88 Q72 92 70 100" stroke="#000" strokeOpacity=".18" strokeWidth="1.4" fill="none" filter={u('soft')} />;
    switch (p.top) {
      case 'tee': return <>{body}{folds}<path d="M39.5 75.5 Q50 84 60.5 75.5" stroke={shade(p.topColor, -0.3)} strokeWidth="2.2" fill="none" /></>;
      case 'vneck': return <>{body}{folds}<path d="M38.5 75 L50 92 L61.5 75Z" fill={u('neck')} /><path d="M45 81 Q50 86 55 81" stroke={s.shade} strokeOpacity=".35" strokeWidth="1" fill="none" filter={u('soft')} /><path d="M38.5 75 L50 92 L61.5 75" stroke={shade(p.topColor, -0.3)} strokeWidth="1.2" fill="none" /></>;
      case 'collar': return <>{body}{folds}<path d="M40.5 74.5 L50 88 L59.5 74.5Z" fill={s.shade} opacity=".55" /><path d="M38 73.5 L48 89 L42 91 L33 77Z M62 73.5 L52 89 L58 91 L67 77Z" fill={shade(p.topColor, 0.3)} stroke={shade(p.topColor, -0.22)} strokeWidth=".5" /><path d="M50 89 L50 100" stroke={shade(p.topColor, -0.25)} strokeWidth=".6" />{[93, 98].map((y) => <circle key={y} cx="50" cy={y} r=".7" fill={shade(p.topColor, -0.35)} />)}</>;
      case 'hoodie': return <>{body}{folds}<path d="M30 78 Q50 93 70 78 Q66 74 60 74 Q50 84 40 74 Q34 74 30 78Z" fill={shade(p.topColor, -0.25)} /><path d="M45 84 L44 97 M55 84 L56 97" stroke="#f2f2f2" strokeWidth="1.2" strokeLinecap="round" /></>;
      case 'jacket': return <>{body}{folds}<path d="M40 74.5 L50 100 L60 74.5 Q55 73.4 50 73.4 Q45 73.4 40 74.5Z" fill="#f2efe9" /><path d="M44 76 L50 88 L56 76" stroke="#d8d2c8" strokeWidth=".8" fill="none" /><path d="M31.5 77.5 L44.5 93 L40 95Z M68.5 77.5 L55.5 93 L60 95Z" fill={shade(p.topColor, -0.2)} /><path d="M40 74.5 L46 87.5 L41 89.5 L50 100 M60 74.5 L54 87.5 L59 89.5 L50 100" stroke={shade(p.topColor, -0.4)} strokeWidth=".8" fill="none" /></>;
    }
  })();

  const eye = (x: number) => {
    const d = x < 50 ? -1 : 1; // outer corner direction
    const w = fem ? 5.6 : 5.3;
    const almond = `M${x - w} ${eyeY + 0.3} C${x - w * 0.55} ${eyeY - 3.1} ${x + w * 0.55} ${eyeY - 3.3} ${x + w} ${eyeY - 0.1 - (fem ? 0.6 * d * d : 0)} C${x + w * 0.5} ${eyeY + 2.5} ${x - w * 0.5} ${eyeY + 2.6} ${x - w} ${eyeY + 0.3}Z`;
    return (
      <g key={x}>
        {/* socket shadow and lid crease */}
        <ellipse cx={x} cy={eyeY - 1.5} rx="7" ry="4" fill={s.shade} opacity=".35" filter={u('soft')} />
        {fem && <ellipse cx={x + d * 1} cy={eyeY - 2.6} rx="6.6" ry="3" fill={p.shadow ?? '#b46ad0'} opacity=".42" filter={u('soft')} />}
        <path d={`M${x - w + 0.6} ${eyeY - 2.4} C${x - 2} ${eyeY - 5.4} ${x + 2.5} ${eyeY - 5.6} ${x + w - 0.2} ${eyeY - 2.6}`} stroke={s.shade} strokeWidth=".7" fill="none" opacity=".8" />
        <path d={almond} fill="#f6f1ea" />
        <clipPath id={id(`e${x}`)}><path d={almond} /></clipPath>
        <g clipPath={u(`e${x}`)}>
          <circle cx={x} cy={eyeY - 0.2} r="2.75" fill={u('iris')} />
          <circle cx={x} cy={eyeY - 0.2} r="2.75" fill="none" stroke="#000" strokeOpacity=".55" strokeWidth=".45" />
          <circle cx={x} cy={eyeY - 0.2} r="1.15" fill="#080706" />
          <path d={`M${x - w} ${eyeY - 3} L${x + w} ${eyeY - 3} L${x + w} ${eyeY - 0.6} C${x + 2} ${eyeY - 2} ${x - 2} ${eyeY - 2} ${x - w} ${eyeY - 0.4}Z`} fill="#000" opacity=".22" />
        </g>
        <circle cx={x + 0.95} cy={eyeY - 1.15} r=".72" fill="#fff" />
        <circle cx={x - 0.9} cy={eyeY + 0.7} r=".32" fill="#fff" opacity=".7" />
        {/* upper lid line (+ lashes and wing for ladies), soft lower lid */}
        <path d={`M${x - w - 0.2} ${eyeY + 0.3} C${x - w * 0.55} ${eyeY - 3.2} ${x + w * 0.55} ${eyeY - 3.4} ${x + w + 0.2} ${eyeY - 0.1}`} stroke="#1a110d" strokeWidth={fem ? 1.25 : 0.85} fill="none" strokeLinecap="round" />
        {fem && <path d={`M${x + d * (w - 0.3)} ${eyeY - 0.4} Q${x + d * (w + 0.9)} ${eyeY - 0.9} ${x + d * (w + 1.6)} ${eyeY - 1.8}`} stroke="#1a110d" strokeWidth=".75" fill="none" strokeLinecap="round" />}
        {fem && <path d={`M${x - w * 0.6} ${eyeY - 2.3} C${x - 1} ${eyeY - 3.8} ${x + 2} ${eyeY - 3.6} ${x + d * (w + 0.6)} ${eyeY - 1.2}`} stroke="#1a110d" strokeWidth=".9" strokeOpacity=".45" fill="none" strokeLinecap="round" filter={u('hairline')} />}
        <path d={`M${x - w + 0.8} ${eyeY + 1.1} C${x - 2} ${eyeY + 2.9} ${x + 2} ${eyeY + 2.9} ${x + w - 0.6} ${eyeY + 0.9}`} stroke={fem ? '#4a2e26' : s.shade} strokeWidth=".45" fill="none" opacity=".7" />
        <ellipse cx={x} cy={eyeY + 3.6} rx="4.4" ry="1.4" fill={s.shade} opacity=".22" filter={u('soft')} />
      </g>
    );
  };

  const brow = (d: number) => {
    const c = p.hair === 'bald' ? beardC : shade(p.hairColor, p.hairColor > '#80' ? -0.25 : -0.05);
    const inner = 50 + d * 3.8, outer = 50 + d * 15;
    const top = fem ? 36.6 : 37.4, th = fem ? 1.1 : 1.9;
    return <path key={d} d={`M${inner} ${top + 2.6} C${inner + d * 3} ${top - 0.2} ${outer - d * 4} ${top - 1} ${outer} ${top + 1.6} C${outer - d * 4} ${top + 0.6 + th * 0.4} ${inner + d * 3} ${top + 1 + th} ${inner} ${top + 2.6 + th}Z`} fill={c} opacity=".92" />;
  };

  return (
    <g>
      <defs>
        <radialGradient id={id('bg')} cx=".5" cy=".36" r=".8"><stop offset="0" stopColor={shade(p.bg, 0.42)} /><stop offset=".55" stopColor={shade(p.bg, 0.02)} /><stop offset="1" stopColor={shade(p.bg, -0.45)} /></radialGradient>
        <radialGradient id={id('skin')} cx=".4" cy=".34" r=".78"><stop offset="0" stopColor={s.hi} /><stop offset=".5" stopColor={s.base} /><stop offset="1" stopColor={s.shade} /></radialGradient>
        <linearGradient id={id('neck')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.shade} /><stop offset=".45" stopColor={s.base} /><stop offset="1" stopColor={s.base} /></linearGradient>
        <linearGradient id={id('hair')} x1=".1" y1="0" x2=".5" y2="1"><stop offset="0" stopColor={hairHi} /><stop offset=".35" stopColor={hairMid} /><stop offset=".7" stopColor={p.hairColor} /><stop offset="1" stopColor={hairLo} /></linearGradient>
        <linearGradient id={id('top')} x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stopColor={shade(p.topColor, 0.28)} /><stop offset=".5" stopColor={p.topColor} /><stop offset="1" stopColor={shade(p.topColor, -0.42)} /></linearGradient>
        <linearGradient id={id('cap')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={shade(p.capColor ?? '#c62828', 0.25)} /><stop offset="1" stopColor={p.capColor ?? '#c62828'} /></linearGradient>
        <linearGradient id={id('lens')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a4250" /><stop offset="1" stopColor="#0d0f14" /></linearGradient>
        <radialGradient id={id('iris')} cx=".5" cy=".5" r=".5"><stop offset="0" stopColor={shade(p.eyes, 0.45)} /><stop offset=".55" stopColor={p.eyes} /><stop offset="1" stopColor={shade(p.eyes, -0.5)} /></radialGradient>
        <linearGradient id={id('lipU')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={shade(lip, -0.12)} /><stop offset="1" stopColor={shade(lip, -0.3)} /></linearGradient>
        <linearGradient id={id('lipL')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={shade(lip, 0.12)} /><stop offset="1" stopColor={shade(lip, -0.15)} /></linearGradient>
        <filter id={id('hairline')} x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation=".35" /></filter>
        <filter id={id('soft')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.3" /></filter>
        <filter id={id('blur')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.6" /></filter>
        <filter id={id('grain')} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="3.2" numOctaves="1" seed="3" />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 1.6" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <clipPath id={id('face')}><path d={FACE} /></clipPath>
      </defs>

      {/* studio backdrop with soft bokeh */}
      <rect width="100" height="100" fill={u('bg')} />
      <g filter={u('blur')} opacity=".35">
        <circle cx="16" cy="22" r="7" fill={shade(p.bg, 0.6)} /><circle cx="86" cy="16" r="5" fill={shade(p.bg, 0.55)} /><circle cx="88" cy="58" r="8" fill={shade(p.bg, 0.4)} />
      </g>
      {/* rim light behind the shoulders */}
      <ellipse cx="50" cy="56" rx="34" ry="30" fill={shade(p.bg, 0.5)} opacity=".25" filter={u('blur')} />

      <g transform="translate(50 50) scale(1.16) translate(-50 -47.5)">
      {hairBack}
      {top}
      {/* neck, with the shadow cast by the jaw */}
      <path d={fem ? 'M43 60 L42.4 77 Q50 80.5 57.6 77 L57 60Z' : 'M41.5 60 L40.6 77 Q50 81 59.4 77 L58.5 60Z'} fill={u('neck')} />
      <path d="M40 62 Q50 73 60 62 L60 70 Q50 77 40 70Z" fill={s.shade} opacity=".55" filter={u('soft')} />
      {fem && <path d="M44 76.5 Q50 78.6 56 76.5" stroke={s.hi} strokeOpacity=".5" strokeWidth=".8" fill="none" filter={u('soft')} />}
      {/* ears */}
      {[fem ? 32.4 : 31.4, fem ? 67.6 : 68.6].map((x) => <g key={x}><ellipse cx={x} cy="47" rx="3.4" ry="6" fill={s.base} /><ellipse cx={x} cy="47" rx="1.6" ry="3.5" fill={s.shade} opacity=".6" filter={u('soft')} /></g>)}
      {p.earrings && [fem ? 32.4 : 31.4, fem ? 67.6 : 68.6].map((x) => <g key={x}><circle cx={x} cy="55" r="1.6" fill="#f2c94c" stroke="#a87b12" strokeWidth=".4" /><circle cx={x - 0.5} cy="54.5" r=".5" fill="#fff" opacity=".8" /></g>)}

      {/* face: painted light and shadow */}
      <path d={FACE} fill={u('skin')} />
      <g clipPath={u('face')}>
        <ellipse cx="67" cy="48" rx="7" ry="24" fill={s.shade} opacity=".55" filter={u('blur')} />
        <ellipse cx="33" cy="48" rx="4" ry="20" fill={s.shade} opacity=".3" filter={u('blur')} />
        <ellipse cx="50" cy="26" rx="14" ry="6" fill={s.hi} opacity=".55" filter={u('blur')} />
        {[38.5, 61.5].map((x) => <ellipse key={x} cx={x} cy="53.5" rx="5.5" ry="2.6" fill={s.hi} opacity={x < 50 ? 0.5 : 0.25} filter={u('soft')} />)}
        {[37, 63].map((x) => <ellipse key={x} cx={x} cy="58" rx="4.8" ry="4" fill={s.shade} opacity=".22" filter={u('blur')} />)}
        {fem && [38, 62].map((x) => <ellipse key={x} cx={x} cy="55.5" rx="5" ry="3" fill="#ff6f7d" opacity=".2" filter={u('blur')} />)}
        <ellipse cx="50" cy="66.5" rx="5" ry="2.6" fill={s.hi} opacity=".38" filter={u('soft')} />
        <path d="M33 58 C37 67 43 71 50 71.4 C57 71 63 67 67 58 L68 75 L32 75Z" fill={s.shade} opacity=".35" filter={u('soft')} />
        {/* hair casts a soft shadow on the forehead */}
        {p.hair !== 'bald' && p.hair !== 'buzz' && <path d="M30 34 C36 28 44 27 50 27.5 C57 27 64 28 70 34 L70 26 L30 26Z" fill="#000" opacity=".22" filter={u('blur')} />}
      </g>
      {/* stubble / beard */}
      {p.beard === 'stubble' && <g clipPath={u('face')}><path d="M31 50 C32 64 40 72.6 50 73 C60 72.6 68 64 69 50 C66.5 59 61.5 63 56 63.4 Q50 62 44 63.4 C38.5 63 33.5 59 31 50Z" fill={beardC} opacity=".42" filter={u('grain')} /><path d="M31 50 C32 64 40 72.6 50 73 C60 72.6 68 64 69 50 C66.5 59 61.5 63 56 63.4 Q50 62 44 63.4 C38.5 63 33.5 59 31 50Z" fill={beardC} opacity=".14" filter={u('soft')} /></g>}
      {p.beard === 'full' && <g><path d="M30.5 47 C31 66 39 75.5 50 76.5 C61 75.5 69 66 69.5 47 C67 57 62 61.5 56.5 62 Q50 60.6 43.5 62 C38 61.5 33 57 30.5 47Z" fill={u('hair')} />{strands(['M36 60 Q40 68 46 72', 'M64 60 Q60 68 54 72', 'M41 64 Q45 70 50 73', 'M59 64 Q55 70 50 73', 'M33 54 Q35 62 39 67', 'M67 54 Q65 62 61 67'], shade(beardC, 0.35), 0.45, 0.6)}</g>}

      {/* eyes and brows */}
      {!p.shades && [eyeL, eyeR].map(eye)}
      {[-1, 1].map(brow)}

      {/* nose: side shadow, bridge highlight, nostrils, tip */}
      <path d="M52.6 44 C53.4 50 55.4 54 55.8 57.4 C54.2 59.6 51.6 60 50 59.6" stroke={s.shade} strokeWidth="1.8" fill="none" opacity=".75" filter={u('soft')} />
      <ellipse cx="50" cy="59.6" rx="4.2" ry="1.3" fill={s.shade} opacity=".55" filter={u('soft')} />
      <path d="M46.2 56.6 C45.2 57.6 45.4 59 46.6 59.4 M53.8 56.6 C54.8 57.6 54.6 59 53.4 59.4" stroke={s.shade} strokeWidth=".7" fill="none" strokeLinecap="round" opacity=".8" />
      <path d="M49.2 44.5 C48.9 49 48.9 53 49.3 56" stroke={s.hi} strokeWidth="1.3" fill="none" opacity=".75" strokeLinecap="round" filter={u('soft')} />
      <ellipse cx="50.2" cy="57.2" rx="2.4" ry="1.6" fill={s.hi} opacity=".5" filter={u('soft')} />
      <path d="M45.6 58.4 Q47 59.8 48.6 59.2 M51.4 59.2 Q53 59.8 54.4 58.4" stroke={shade(s.shade, -0.2)} strokeWidth=".9" fill="none" strokeLinecap="round" opacity=".85" />

      {/* mouth */}
      {p.beard === 'mustache' && <path d="M42.5 62.2 Q46 59.4 50 60.8 Q54 59.4 57.5 62.2 Q50 62 42.5 62.2Z" fill={u('hair')} />}
      <ellipse cx="50" cy="65" rx="7" ry="3.2" fill={s.shade} opacity=".25" filter={u('soft')} />
      {p.smile ? (
        <g>
          <path d="M43.4 63.2 C45.6 61.9 48.2 61.7 50 62.4 C51.8 61.7 54.4 61.9 56.6 63.2 Q50 64.2 43.4 63.2Z" fill={u('lipU')} />
          <path d="M44.6 63.6 Q50 64.9 55.4 63.6 L55 64.4 Q50 65.5 45 64.4Z" fill="#ece5dc" />
          <path d="M45 64.4 Q50 65.5 55 64.4 C54 66.7 52.4 67.5 50 67.5 C47.6 67.5 46 66.7 45 64.4Z" fill={u('lipL')} />
          <path d="M43.4 63.2 Q42.6 62.8 42.2 62 M56.6 63.2 Q57.4 62.8 57.8 62" stroke={s.shade} strokeWidth=".6" fill="none" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <path d="M44 63.6 C45.8 62.3 48.2 62 50 62.7 C51.8 62 54.2 62.3 56 63.6 Q50 64.3 44 63.6Z" fill={u('lipU')} />
          <path d="M44 63.6 Q50 64.4 56 63.6 C55 66.2 52.8 67 50 67 C47.2 67 45 66.2 44 63.6Z" fill={u('lipL')} />
          <path d="M44 63.6 Q50 64.5 56 63.6" stroke={shade(lip, -0.55)} strokeWidth=".5" fill="none" />
        </g>
      )}
      <ellipse cx="51" cy={p.smile ? 66.2 : 65.6} rx={fem ? 2 : 1.4} ry=".55" fill="#fff" opacity={fem ? 0.55 : 0.22} filter={u('hairline')} />
      <ellipse cx="50" cy="69.2" rx="3.2" ry="1.1" fill={s.shade} opacity=".38" filter={u('soft')} />

      {hairFront}
      {p.shades && (
        <g>
          <path d="M33 42.5 L67 42.5" stroke="#111" strokeWidth="1.4" />
          {[eyeL, eyeR].map((x) => <rect key={x} x={x - 7.5} y="41" width="15" height="9.5" rx="4" fill={u('lens')} stroke="#111" strokeWidth=".9" />)}
          {[eyeL, eyeR].map((x) => <path key={x} d={`M${x - 4.5} 43.4 L${x - 1} 43.4`} stroke="#fff" strokeOpacity=".55" strokeWidth="1.1" strokeLinecap="round" />)}
        </g>
      )}
      {p.glasses && (
        <g fill="rgba(200,230,255,.1)" stroke="#2b2b2b" strokeWidth="1">
          <rect x={eyeL - 7.2} y="40.6" width="14.4" height="9.6" rx="3.4" /><rect x={eyeR - 7.2} y="40.6" width="14.4" height="9.6" rx="3.4" />
          <path d="M48.8 44.5 Q50 43.4 51.2 44.5" fill="none" />
        </g>
      )}
      </g>
      {/* a touch of film grain and a soft vignette keep it from looking flat */}
      <rect width="100" height="100" fill="#000" filter={u('grain')} opacity=".05" />
      <rect width="100" height="100" fill="none" stroke="#000" strokeOpacity=".22" strokeWidth="10" filter={u('blur')} />
    </g>
  );
}

export const PEOPLE: Record<string, PersonSpec> = {
  p1: { name: 'Marcus', skin: 's6', hair: 'buzz', hairColor: '#1a1210', eyes: '#3a2414', top: 'collar', topColor: '#14796f', bg: '#3b5b7a', beard: 'stubble', smile: true },
  p2: { name: 'Sofia', skin: 's3', hair: 'long', hairColor: '#3b2416', eyes: '#5a3a1e', top: 'vneck', topColor: '#c62842', bg: '#7a4a6a', fem: true, earrings: true, lip: '#c0203f', shadow: '#a0507a', smile: true },
  p3: { name: 'Jake', skin: 's2', hair: 'side', hairColor: '#c9a15a', eyes: '#3b7bbf', top: 'jacket', topColor: '#1e2a44', bg: '#5a6a80', beard: 'stubble', beardColor: '#a07a3a', smile: true },
  p4: { name: 'Aiyana', skin: 's4', hair: 'long', hairColor: '#141010', eyes: '#3a2414', top: 'vneck', topColor: '#18a3a3', bg: '#5a4a8a', fem: true, earrings: true, lip: '#b3264a', shadow: '#c08a40', smile: true },
  p5: { name: 'Mei', skin: 's1', hair: 'bob', hairColor: '#17110f', eyes: '#3a2414', top: 'vneck', topColor: '#9a7ad8', bg: '#4a7a8a', fem: true, earrings: true, lip: '#d6455e', shadow: '#c46aa0' },
  p6: { name: 'Andre', skin: 's5', hair: 'short', hairColor: '#1c1310', eyes: '#2b1a10', top: 'jacket', topColor: '#2a2a2e', bg: '#2f4a6a', beard: 'stubble', smile: true },
  p7: { name: 'Priya', skin: 's4', hair: 'long', hairColor: '#120d0b', eyes: '#3a2414', top: 'vneck', topColor: '#d6a21e', bg: '#6a3a5a', fem: true, earrings: true, lip: '#a8183a', shadow: '#c48a2a', smile: true },
  p8: { name: 'Carlos', skin: 's3', hair: 'waves', hairColor: '#1b1411', eyes: '#4a2c16', top: 'jacket', topColor: '#22325e', bg: '#7a5a3a', beard: 'stubble', smile: true },
  p9: { name: 'Grace', skin: 's6', hair: 'curlsLong', hairColor: '#1c1410', eyes: '#2b1a10', top: 'vneck', topColor: '#f06a5a', bg: '#3a6a5a', fem: true, earrings: true, lip: '#9a1a3a', shadow: '#d08a3a', smile: true },
  p10: { name: 'Ethan', skin: 's1', hair: 'side', hairColor: '#6b4a2e', eyes: '#4f8a4a', top: 'collar', topColor: '#ffffff', bg: '#2a3a5a', beard: 'stubble', beardColor: '#6b4a2e', smile: true },
  p11: { name: 'Hana', skin: 's1', hair: 'long', hairColor: '#8e3b1f', eyes: '#4f8a4a', top: 'vneck', topColor: '#1f6a3a', bg: '#5a4a7a', fem: true, earrings: true, lip: '#c8325a', shadow: '#8a6ac0', smile: true },
  p12: { name: 'Omar', skin: 's5', hair: 'short', hairColor: '#120d0b', eyes: '#2b1a10', top: 'collar', topColor: '#2a6fc9', bg: '#6a5a3a', beard: 'full', smile: true },
  p13: { name: 'Rosa', skin: 's3', hair: 'bob', hairColor: '#5a2e1a', eyes: '#5a3a1e', top: 'vneck', topColor: '#c2307e', bg: '#2a5a6a', fem: true, earrings: true, lip: '#c0203f', shadow: '#c06a8a', smile: true },
  p14: { name: 'Luca', skin: 's2', hair: 'waves', hairColor: '#3a2416', eyes: '#3b6b9f', top: 'jacket', topColor: '#5a3a24', bg: '#4a5a4a', beard: 'stubble', beardColor: '#3a2416', smile: true },
  p15: { name: 'Kenji', skin: 's2', hair: 'side', hairColor: '#120d0b', eyes: '#2b1a10', top: 'jacket', topColor: '#24272e', bg: '#7a3a3a', smile: true },
  p16: { name: 'Lena', skin: 's1', hair: 'long', hairColor: '#d7b46a', eyes: '#3b7bbf', top: 'vneck', topColor: '#e46aa0', bg: '#3a4a7a', fem: true, earrings: true, lip: '#d6455e', shadow: '#7a8ad0', smile: true },
  p17: { name: 'Bella', skin: 's2', hair: 'curlsLong', hairColor: '#6a3a1e', eyes: '#4a7a3a', top: 'vneck', topColor: '#1a1a2e', bg: '#7a3a5a', fem: true, earrings: true, lip: '#b0183a', shadow: '#a0607a' },
  p18: { name: 'Jordan', skin: 's6', hair: 'waves', hairColor: '#120d0b', eyes: '#2b1a10', top: 'collar', topColor: '#7a1a2a', bg: '#3a3a6a', beard: 'full', smile: true },
  p19: { name: 'Camila', skin: 's4', hair: 'bob', hairColor: '#2a1a12', eyes: '#3a2414', top: 'vneck', topColor: '#e8b030', bg: '#2a5a7a', fem: true, earrings: true, lip: '#c0203f', shadow: '#c08040', smile: true },
  p20: { name: 'Ryan', skin: 's1', hair: 'short', hairColor: '#c9a15a', eyes: '#3b7bbf', top: 'tee', topColor: '#1e3a6a', bg: '#5a4a3a', beard: 'stubble', beardColor: '#b08a4a', smile: true },
  p21: { name: 'Zara', skin: 's5', hair: 'long', hairColor: '#120d0b', eyes: '#2b1a10', top: 'vneck', topColor: '#7a3ad0', bg: '#5a2a4a', fem: true, earrings: true, lip: '#8a1a3a', shadow: '#c09040', smile: true },
  p22: { name: 'Mateo', skin: 's3', hair: 'side', hairColor: '#1b1411', eyes: '#4a2c16', top: 'jacket', topColor: '#0e3a4a', bg: '#3a5a4a', beard: 'full', smile: true },
  p23: { name: 'Ava', skin: 's1', hair: 'bun', hairColor: '#e0c07a', eyes: '#3b7bbf', top: 'vneck', topColor: '#c2307e', bg: '#4a3a7a', fem: true, earrings: true, lip: '#d6455e', shadow: '#c46aa0', smile: true },
  p24: { name: 'Dante', skin: 's4', hair: 'buzz', hairColor: '#120d0b', eyes: '#2b1a10', top: 'collar', topColor: '#222222', bg: '#6a4a2a', beard: 'stubble', smile: true },
};
export const PEOPLE_KEYS = Object.keys(PEOPLE);
