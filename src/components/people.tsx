// Realistic illustrated portraits (original artwork). Built from parts so every face is shaded consistently:
// soft studio backdrop, lit skin with a chin shadow, layered hair with a highlight, clothing and accessories.
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
}

const shade = (hex: string, amt: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  return `#${[n >> 16, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, '0')).join('')}`;
};

const HEAD = 'M50 17 C66 17 73 30 73 46 C73 61 63 72 50 73 C37 72 27 61 27 46 C27 30 34 17 50 17Z';

export function PersonArt({ p, uid }: { p: PersonSpec; uid: string }) {
  const s = SKIN[p.skin];
  const id = (n: string) => `${uid}${n}`;
  const u = (n: string) => `url(#${uid}${n})`;
  const hairHi = shade(p.hairColor, 0.28), hairLo = shade(p.hairColor, -0.35);
  const beardC = p.beardColor ?? p.hairColor;

  const hairBack: ReactNode = (() => {
    switch (p.hair) {
      case 'long': return <path d="M25 46 C21 22 36 10 50 10 C64 10 79 22 75 46 C77 62 80 76 85 90 L65 92 C65 80 65 70 63 62 L37 62 C35 70 35 80 35 92 L15 90 C20 76 23 62 25 46Z" fill={u('hair')} />;
      case 'curlsLong': return <g fill={u('hair')}>{[[24, 40, 12], [76, 40, 12], [22, 58, 12], [78, 58, 12], [24, 74, 11], [76, 74, 11], [30, 86, 10], [70, 86, 10], [50, 18, 18], [32, 22, 13], [68, 22, 13]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}</g>;
      case 'bob': return <path d="M24 46 C21 22 36 11 50 11 C64 11 79 22 76 46 C77 58 78 66 78 72 Q70 74 66 66 L34 66 Q30 74 22 72 C22 66 23 58 24 46Z" fill={u('hair')} />;
      case 'afro': return <g fill={u('hair')}><ellipse cx="50" cy="32" rx="31" ry="25" />{Array.from({ length: 14 }, (_, i) => { const a = Math.PI * (0.95 + i / 13 * 1.1); return <circle key={i} cx={50 + Math.cos(a) * 29} cy={34 + Math.sin(a) * 23} r={7.5} />; })}</g>;
      case 'bun': return <><circle cx="50" cy="11" r="9.5" fill={u('hair')} /><ellipse cx="47" cy="8" rx="4" ry="2.5" fill={hairHi} opacity=".45" /></>;
      default: return null;
    }
  })();

  const hairFront: ReactNode = (() => {
    switch (p.hair) {
      case 'short': return <path d="M26 45 C23 24 36 12 51 12 C66 12 78 23 74 45 C72 36 70 30 64 27 C56 31 42 31 35 27 C30 31 28 37 26 45Z" fill={u('hair')} />;
      case 'side': return <><path d="M26 47 C22 22 38 10 53 10 C69 10 79 24 74 47 C73 37 71 31 67 27 C58 25 46 32 34 27 C30 32 28 39 26 47Z" fill={u('hair')} /><path d="M36 27 C44 22 56 19 66 22" stroke={hairHi} strokeWidth="1.4" fill="none" opacity=".6" /></>;
      case 'waves': return <><path d="M25 47 C21 20 37 9 52 9 C69 9 80 22 75 47 C73 38 72 33 68 29 C64 33 58 30 54 27 C49 31 42 31 38 28 C33 31 29 37 25 47Z" fill={u('hair')} /><path d="M33 22 Q40 17 47 21 Q54 16 62 20" stroke={hairHi} strokeWidth="1.6" fill="none" opacity=".55" /></>;
      case 'buzz': return <path d="M28 41 C28 24 38 16 50 16 C62 16 72 24 72 41 C68 31 60 27 50 27 C40 27 32 31 28 41Z" fill={u('hair')} opacity=".92" />;
      case 'afro': return <g fill={u('hair')}><path d="M27 40 C27 22 38 14 50 14 C62 14 73 22 73 40 C67 31 59 28 50 28 C41 28 33 31 27 40Z" />{[31, 37, 43, 50, 57, 63, 69].map((x, i) => <circle key={i} cx={x} cy={29 - Math.sin((x - 27) / 46 * Math.PI) * 2} r="3.4" />)}</g>;
      case 'curlsLong': return <g fill={u('hair')}>{[[34, 26, 8], [44, 22, 8], [56, 22, 8], [66, 26, 8], [29, 34, 6], [71, 34, 6]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}</g>;
      case 'long': return <path d="M27 49 C25 26 38 14 50 14 C64 14 76 26 73 49 C71 37 65 29 55 27 C50 33 40 37 30 39 C28 42 27 45 27 49Z" fill={u('hair')} />;
      case 'bob': return <path d="M27 44 C26 24 38 14 50 14 C62 14 74 24 73 44 C72 39 70 36 68 35 C58 33 42 33 32 35 C30 37 28 40 27 44Z" fill={u('hair')} />;
      case 'bun': return <path d="M28 43 C27 25 38 16 50 16 C62 16 73 25 72 43 C69 33 61 27 50 27 C39 27 31 33 28 43Z" fill={u('hair')} />;
      case 'cap': return <g><path d="M26 37 C26 19 38 12 50 12 C62 12 74 19 74 37Z" fill={u('cap')} /><path d="M50 12 L50 37" stroke={shade(p.capColor ?? '#c62828', -0.3)} strokeWidth=".8" /><circle cx="50" cy="13" r="1.6" fill={shade(p.capColor ?? '#c62828', -0.3)} /><path d="M25 36 Q52 30 82 39 Q80 43 74 42 Q52 37 26 40Z" fill={shade(p.capColor ?? '#c62828', -0.25)} /></g>;
      case 'bald': return <ellipse cx="44" cy="26" rx="9" ry="5" fill="#fff" opacity=".22" />;
    }
  })();

  const top: ReactNode = (() => {
    const body = <path d="M8 100 Q10 80 32 73 Q41 70 50 70 Q59 70 68 73 Q90 80 92 100Z" fill={u('top')} />;
    switch (p.top) {
      case 'tee': return <>{body}<path d="M38 72 Q50 82 62 72" stroke={shade(p.topColor, -0.25)} strokeWidth="2.4" fill="none" /></>;
      case 'vneck': return <>{body}<path d="M39 72 L50 88 L61 72Z" fill={u('skin')} /><path d="M39 72 L50 88 L61 72" stroke={shade(p.topColor, -0.25)} strokeWidth="1.6" fill="none" /></>;
      case 'collar': return <>{body}<path d="M40 71 L50 84 L60 71" fill={s.shade} opacity=".5" /><path d="M38 70 L48 86 L42 88 L33 74Z M62 70 L52 86 L58 88 L67 74Z" fill={shade(p.topColor, 0.35)} stroke={shade(p.topColor, -0.2)} strokeWidth=".6" /></>;
      case 'hoodie': return <>{body}<path d="M30 74 Q50 90 70 74 Q66 70 60 70 Q50 80 40 70 Q34 70 30 74Z" fill={shade(p.topColor, -0.22)} /><path d="M45 80 L44 94 M55 80 L56 94" stroke="#f2f2f2" strokeWidth="1.3" strokeLinecap="round" /></>;
      case 'jacket': return <>{body}<path d="M40 71 L50 100 L60 71 Q55 69 50 69 Q45 69 40 71Z" fill="#f4f1ec" /><path d="M40 71 L46 84 L41 86 L50 100 M60 71 L54 84 L59 86 L50 100" stroke={shade(p.topColor, -0.35)} strokeWidth="1" fill="none" /><path d="M32 74 L44 90 L40 92Z M68 74 L56 90 L60 92Z" fill={shade(p.topColor, -0.18)} /></>;
    }
  })();

  const browW = p.fem ? 1.5 : 2.4;
  return (
    <g>
      <defs>
        <radialGradient id={id('bg')} cx=".5" cy=".38" r=".75"><stop offset="0" stopColor={shade(p.bg, 0.35)} /><stop offset="1" stopColor={shade(p.bg, -0.3)} /></radialGradient>
        <radialGradient id={id('skin')} cx=".42" cy=".36" r=".72"><stop offset="0" stopColor={s.hi} /><stop offset=".55" stopColor={s.base} /><stop offset="1" stopColor={s.shade} /></radialGradient>
        <linearGradient id={id('hair')} x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stopColor={hairHi} /><stop offset=".45" stopColor={p.hairColor} /><stop offset="1" stopColor={hairLo} /></linearGradient>
        <linearGradient id={id('top')} x1="0" y1="0" x2=".5" y2="1"><stop offset="0" stopColor={shade(p.topColor, 0.22)} /><stop offset="1" stopColor={shade(p.topColor, -0.3)} /></linearGradient>
        <linearGradient id={id('cap')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={shade(p.capColor ?? '#c62828', 0.25)} /><stop offset="1" stopColor={p.capColor ?? '#c62828'} /></linearGradient>
        <linearGradient id={id('lens')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a4250" /><stop offset="1" stopColor="#0d0f14" /></linearGradient>
      </defs>
      <rect width="100" height="100" fill={u('bg')} />
      {hairBack}
      {top}
      {/* neck with shadow under the chin */}
      <path d="M41 60 L41 74 Q50 79 59 74 L59 60Z" fill={s.base} />
      <path d="M41 64 Q50 72 59 64 L59 70 Q50 76 41 70Z" fill={s.shade} opacity=".7" />
      {/* ears */}
      {[28, 72].map((x) => <g key={x}><ellipse cx={x} cy="49" rx="4.2" ry="7" fill={s.base} /><ellipse cx={x} cy="49" rx="2" ry="4" fill={s.shade} opacity=".55" /></g>)}
      {p.earrings && [28, 72].map((x) => <circle key={x} cx={x} cy="57.5" r="1.9" fill="#f2c94c" stroke="#a87b12" strokeWidth=".5" />)}
      {/* face */}
      <path d={HEAD} fill={u('skin')} />
      <path d="M31 58 C36 68 43 72 50 72.6 C57 72 64 68 69 58 C66 66 59 71 50 71 C41 71 34 66 31 58Z" fill={s.shade} opacity=".35" />
      <ellipse cx="37" cy="57" rx="5" ry="3" fill="#ff7a7a" opacity={p.fem ? 0.22 : 0.1} />
      <ellipse cx="63" cy="57" rx="5" ry="3" fill="#ff7a7a" opacity={p.fem ? 0.22 : 0.1} />
      {p.beard === 'stubble' && <path d="M29 50 C30 66 38 76 50 77 C62 76 70 66 71 50 C68 60 62 66 56 66 Q50 64 44 66 C38 66 32 60 29 50Z" fill={beardC} opacity=".3" />}
      {p.beard === 'full' && <path d="M28 48 C29 68 38 79 50 80 C62 79 71 68 72 48 C69 58 63 63 57 63 Q50 61 43 63 C37 63 31 58 28 48Z" fill={beardC} />}
      {/* eyes */}
      {!p.shades && [40, 60].map((x) => (
        <g key={x}>
          <path d={`M${x - 6} 47 Q${x} 42.6 ${x + 6} 47 Q${x} 50.6 ${x - 6} 47Z`} fill="#fbf8f4" />
          <circle cx={x} cy="46.9" r="2.7" fill={p.eyes} />
          <circle cx={x} cy="46.9" r="2.7" fill="none" stroke="#000" strokeOpacity=".35" strokeWidth=".5" />
          <circle cx={x} cy="46.9" r="1.2" fill="#0b0b0b" />
          <circle cx={x + 0.9} cy="45.9" r=".75" fill="#fff" />
          <path d={`M${x - 6.2} 47 Q${x} 42.2 ${x + 6.2} 47`} stroke="#2a1a14" strokeWidth={p.fem ? 1.5 : 1.1} fill="none" strokeLinecap="round" />
          {p.fem && <path d={`M${x + (x < 50 ? -6 : 6)} 46.8 l${x < 50 ? -1.6 : 1.6} -1.4`} stroke="#2a1a14" strokeWidth="1" strokeLinecap="round" />}
          <path d={`M${x - 5} 49.6 Q${x} 51.4 ${x + 5} 49.6`} stroke={s.shade} strokeWidth=".7" fill="none" opacity=".7" />
        </g>
      ))}
      {/* brows */}
      {[-1, 1].map((d) => <path key={d} d={`M${50 + d * 4.5} 40.5 Q${50 + d * 10} ${p.fem ? 37.2 : 37.8} ${50 + d * 16} 40`} stroke={p.hair === 'bald' ? beardC : shade(p.hairColor, -0.1)} strokeWidth={browW} fill="none" strokeLinecap="round" />)}
      {/* nose */}
      <path d="M51 47 Q51.5 54 54 57.5 Q52 59.6 50 59.2" stroke={s.shade} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M48.7 48 Q48.4 53 48.6 55.5" stroke={s.hi} strokeWidth="1.2" fill="none" opacity=".7" strokeLinecap="round" />
      <ellipse cx="46.6" cy="58.8" rx="1.3" ry=".8" fill={s.shade} /><ellipse cx="53.4" cy="58.8" rx="1.3" ry=".8" fill={s.shade} />
      {/* mouth */}
      {p.beard === 'mustache' && <path d="M42 62.6 Q46 59.4 50 61 Q54 59.4 58 62.6 Q50 62.4 42 62.6Z" fill={beardC} />}
      {p.smile ? (
        <g>
          <path d="M43 64 Q50 66 57 64 Q55 70.5 50 70.5 Q45 70.5 43 64Z" fill="#7a2e2a" />
          <path d="M44.2 64.6 Q50 66.4 55.8 64.6 L55.2 66 Q50 67.4 44.8 66Z" fill="#fff" />
          <path d="M42.6 63.6 Q46.5 62 50 62.8 Q53.5 62 57.4 63.6" stroke={s.lip} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <path d="M43.4 64.4 Q46.8 62.3 50 63.3 Q53.2 62.3 56.6 64.4 Q50 65.4 43.4 64.4Z" fill={p.fem ? shade(s.lip, 0.05) : s.lip} />
          <path d="M43.4 64.4 Q50 65.4 56.6 64.4 Q54.5 68.6 50 68.6 Q45.5 68.6 43.4 64.4Z" fill={p.fem ? shade(s.lip, 0.2) : shade(s.lip, 0.15)} />
          <path d="M43.4 64.4 Q50 65.6 56.6 64.4" stroke={shade(s.lip, -0.4)} strokeWidth=".7" fill="none" />
          <ellipse cx="51.5" cy="66.6" rx="2.2" ry=".7" fill="#fff" opacity=".28" />
        </g>
      )}
      {p.beard === 'full' && <path d="M43 70 Q50 73 57 70" stroke={shade(beardC, -0.2)} strokeWidth=".8" fill="none" opacity=".6" />}
      {hairFront}
      {p.shades && (
        <g>
          <path d="M31 43 L69 43" stroke="#111" strokeWidth="1.6" />
          {[40, 60].map((x) => <rect key={x} x={x - 8} y="42" width="16" height="10" rx="4" fill={u('lens')} stroke="#111" strokeWidth="1" />)}
          {[40, 60].map((x) => <path key={x} d={`M${x - 5} 44.5 L${x - 1} 44.5`} stroke="#fff" strokeOpacity=".55" strokeWidth="1.2" strokeLinecap="round" />)}
        </g>
      )}
      {p.glasses && (
        <g fill="rgba(200,230,255,.12)" stroke="#2b2b2b" strokeWidth="1.2">
          <rect x="32.5" y="42" width="15" height="10" rx="3.5" /><rect x="52.5" y="42" width="15" height="10" rx="3.5" />
          <path d="M47.5 46 Q50 44.6 52.5 46" fill="none" />
        </g>
      )}
      {/* soft vignette */}
      <rect width="100" height="100" fill="none" stroke="#000" strokeOpacity=".12" strokeWidth="6" />
    </g>
  );
}

export const PEOPLE: Record<string, PersonSpec> = {
  p1: { name: 'Marcus', skin: 's6', hair: 'buzz', hairColor: '#1a1210', eyes: '#3a2414', top: 'collar', topColor: '#14796f', bg: '#3b5b7a', beard: 'full', smile: true },
  p2: { name: 'Sofia', skin: 's3', hair: 'long', hairColor: '#3b2416', eyes: '#5a3a1e', top: 'vneck', topColor: '#c62842', bg: '#7a4a6a', fem: true, earrings: true },
  p3: { name: 'Jake', skin: 's2', hair: 'side', hairColor: '#c9a15a', eyes: '#3b7bbf', top: 'tee', topColor: '#f1f1f1', bg: '#5a6a80', shades: true, beard: 'stubble', beardColor: '#a07a3a' },
  p4: { name: 'Aiyana', skin: 's4', hair: 'long', hairColor: '#141010', eyes: '#3a2414', top: 'vneck', topColor: '#18a3a3', bg: '#5a4a8a', fem: true, smile: true },
  p5: { name: 'Mei', skin: 's1', hair: 'bob', hairColor: '#17110f', eyes: '#3a2414', top: 'tee', topColor: '#9a7ad8', bg: '#4a7a8a', fem: true, glasses: true },
  p6: { name: 'Andre', skin: 's5', hair: 'afro', hairColor: '#1c1310', eyes: '#2b1a10', top: 'hoodie', topColor: '#ef7d22', bg: '#2f4a6a', beard: 'stubble', smile: true },
  p7: { name: 'Priya', skin: 's4', hair: 'bun', hairColor: '#120d0b', eyes: '#3a2414', top: 'jacket', topColor: '#d6a21e', bg: '#6a3a5a', fem: true, earrings: true },
  p8: { name: 'Carlos', skin: 's3', hair: 'waves', hairColor: '#1b1411', eyes: '#4a2c16', top: 'jacket', topColor: '#22325e', bg: '#7a5a3a', beard: 'stubble' },
  p9: { name: 'Grace', skin: 's6', hair: 'curlsLong', hairColor: '#1c1410', eyes: '#2b1a10', top: 'vneck', topColor: '#f06a5a', bg: '#3a6a5a', fem: true, earrings: true, smile: true },
  p10: { name: 'Ethan', skin: 's1', hair: 'buzz', hairColor: '#6b4a2e', eyes: '#4f8a4a', top: 'hoodie', topColor: '#6a7380', bg: '#2a3a5a' },
  p11: { name: 'Hana', skin: 's1', hair: 'long', hairColor: '#8e3b1f', eyes: '#4f8a4a', top: 'tee', topColor: '#3f8f4f', bg: '#5a4a7a', fem: true, smile: true },
  p12: { name: 'Omar', skin: 's5', hair: 'short', hairColor: '#120d0b', eyes: '#2b1a10', top: 'collar', topColor: '#2a6fc9', bg: '#6a5a3a', beard: 'full' },
  p13: { name: 'Rosa', skin: 's3', hair: 'bob', hairColor: '#5a2e1a', eyes: '#5a3a1e', top: 'vneck', topColor: '#c2307e', bg: '#2a5a6a', fem: true, earrings: true, smile: true },
  p14: { name: 'Frank', skin: 's2', hair: 'bald', hairColor: '#9a9a9a', eyes: '#3b6b9f', top: 'jacket', topColor: '#7a5230', bg: '#4a5a4a', beard: 'mustache', beardColor: '#bdbdbd', glasses: true, smile: true },
  p15: { name: 'Kenji', skin: 's2', hair: 'cap', hairColor: '#120d0b', eyes: '#2b1a10', top: 'tee', topColor: '#24272e', bg: '#7a3a3a', capColor: '#c62828', smile: true },
  p16: { name: 'Lena', skin: 's1', hair: 'bun', hairColor: '#d7b46a', eyes: '#3b7bbf', top: 'jacket', topColor: '#e46aa0', bg: '#3a4a7a', fem: true, shades: true },
};
export const PEOPLE_KEYS = Object.keys(PEOPLE);
