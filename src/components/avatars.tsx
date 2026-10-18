// Original cartoon avatars (animals + characters), drawn as SVG on a 100×100 canvas.
// Keys a1–a12 keep working for existing players; a13–a24 are new.
import type { ReactNode } from 'react';

const INK = '#1d1a24';
const BLUSH = '#ff8fa3';

/** Simple cute eyes: dark ovals with a shine. */
function Eyes({ y = 52, dx = 11, rx = 4.2, ry = 5.2, color = INK }: { y?: number; dx?: number; rx?: number; ry?: number; color?: string }) {
  return (
    <g>
      {[-1, 1].map((s) => (
        <g key={s}>
          <ellipse cx={50 + s * dx} cy={y} rx={rx} ry={ry} fill={color} />
          <circle cx={50 + s * dx + 1.4} cy={y - 1.8} r={1.5} fill="#fff" />
        </g>
      ))}
    </g>
  );
}
/** Big round eyes with a white, a coloured iris and a shine. */
function BigEyes({ y = 50, dx = 13, r = 8, iris = INK }: { y?: number; dx?: number; r?: number; iris?: string }) {
  return (
    <g>
      {[-1, 1].map((s) => (
        <g key={s}>
          <circle cx={50 + s * dx} cy={y} r={r} fill="#fff" stroke={INK} strokeWidth={1.2} />
          <circle cx={50 + s * dx + 1} cy={y + 1} r={r * 0.55} fill={iris} />
          <circle cx={50 + s * dx + 2.6} cy={y - 1.6} r={r * 0.2} fill="#fff" />
        </g>
      ))}
    </g>
  );
}
const Smile = ({ y = 68, w = 6, sw = 2.4, color = INK }: { y?: number; w?: number; sw?: number; color?: string }) => (
  <path d={`M${50 - w} ${y} Q50 ${y + w * 0.9} ${50 + w} ${y}`} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
);
const Cheeks = ({ y = 62, dx = 20, r = 4.5 }: { y?: number; dx?: number; r?: number }) => (
  <g opacity={0.55}>{[-1, 1].map((s) => <ellipse key={s} cx={50 + s * dx} cy={y} rx={r} ry={r * 0.7} fill={BLUSH} />)}</g>
);
const Mirror = ({ children }: { children: ReactNode }) => (
  <>
    {children}
    <g transform="translate(100 0) scale(-1 1)">{children}</g>
  </>
);

interface Def { name: string; bg: string; art: ReactNode }

export const AVATARS: Record<string, Def> = {
  // ------------------------------ animals ------------------------------
  a1: { name: 'Fox', bg: '#2e7d6b', art: (
    <g>
      <Mirror><polygon points="22,44 28,10 46,30" fill="#f07a2a" /><polygon points="27,24 28,12 35,20" fill="#3a2316" /></Mirror>
      <ellipse cx="50" cy="57" rx="31" ry="27" fill="#f07a2a" />
      <path d="M20 58 Q34 62 50 74 Q66 62 80 58 Q76 84 50 86 Q24 84 20 58Z" fill="#fff4e6" />
      <Eyes y={52} dx={12} />
      <ellipse cx="50" cy="66" rx="4.5" ry="3.2" fill={INK} />
      <Smile y={71} w={4} sw={2} />
    </g>) },
  a2: { name: 'Bear', bg: '#4f6bd8', art: (
    <g>
      <Mirror><circle cx="26" cy="30" r="11" fill="#8b5a2b" /><circle cx="26" cy="30" r="5.5" fill="#d9a074" /></Mirror>
      <circle cx="50" cy="57" r="31" fill="#8b5a2b" />
      <ellipse cx="50" cy="68" rx="15" ry="12" fill="#e0b48a" />
      <Eyes y={52} dx={12} />
      <ellipse cx="50" cy="63" rx="5.5" ry="4" fill="#2b1a10" />
      <Smile y={70} w={4.5} sw={2} />
    </g>) },
  a3: { name: 'Panda', bg: '#7cb342', art: (
    <g>
      <Mirror><circle cx="25" cy="30" r="11" fill={INK} /></Mirror>
      <circle cx="50" cy="57" r="31" fill="#fafafa" />
      <Mirror><ellipse cx="37" cy="53" rx="8.5" ry="11" fill={INK} transform="rotate(25 37 53)" /></Mirror>
      <Eyes y={52} dx={12} rx={2.6} ry={3.2} color="#fff" />
      <ellipse cx="50" cy="65" rx="5" ry="3.4" fill={INK} />
      <Smile y={70} w={4} sw={2} />
      <Cheeks y={66} dx={22} />
    </g>) },
  a4: { name: 'Cat', bg: '#e98a2c', art: (
    <g>
      <Mirror><polygon points="21,44 24,12 46,30" fill="#8e99a6" /><polygon points="26,36 27,19 39,30" fill="#f6a7b8" /></Mirror>
      <circle cx="50" cy="58" r="30" fill="#8e99a6" />
      <path d="M42 30 L44 40 M50 29 L50 40 M58 30 L56 40" stroke="#6f7a86" strokeWidth="3" strokeLinecap="round" />
      <BigEyes y={53} dx={12} r={7} iris="#3fa34d" />
      <polygon points="46,62 54,62 50,66" fill="#f48fb1" />
      <path d="M44 69 Q47 72 50 68 Q53 72 56 69" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <Mirror><path d="M14 62 L32 64 M15 70 L32 67" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" /></Mirror>
    </g>) },
  a5: { name: 'Puppy', bg: '#29a3c7', art: (
    <g>
      <circle cx="50" cy="56" r="29" fill="#e2b072" />
      <Mirror><ellipse cx="22" cy="54" rx="10" ry="21" fill="#7a4a24" transform="rotate(14 22 54)" /></Mirror>
      <circle cx="61" cy="47" r="9" fill="#f3d3a6" />
      <ellipse cx="50" cy="68" rx="14" ry="10" fill="#f6dfbd" />
      <Eyes y={50} dx={11} />
      <ellipse cx="50" cy="63" rx="5" ry="3.6" fill={INK} />
      <path d="M43 69 Q50 74 57 69" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <path d="M47 71 Q47 79 50 79 Q53 79 53 71Z" fill="#ef6b7f" />
    </g>) },
  a6: { name: 'Owl', bg: '#3b3f9a', art: (
    <g>
      <Mirror><polygon points="24,36 26,12 40,28" fill="#7b5544" /></Mirror>
      <circle cx="50" cy="58" r="32" fill="#8d6e63" />
      <path d="M30 78 Q50 92 70 78" fill="none" stroke="#6d4c41" strokeWidth="3" />
      <Mirror><circle cx="37" cy="52" r="13" fill="#efe3d0" /><circle cx="37" cy="52" r="9" fill="#f9a825" /><circle cx="38" cy="53" r="5.2" fill={INK} /><circle cx="39.8" cy="50.6" r="1.6" fill="#fff" /></Mirror>
      <polygon points="45,62 55,62 50,72" fill="#ff9800" />
    </g>) },
  a7: { name: 'Lion', bg: '#c2185b', art: (
    <g>
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return <circle key={i} cx={50 + Math.cos(a) * 30} cy={55 + Math.sin(a) * 30} r={11} fill={i % 2 ? '#b34d14' : '#cf6a1f'} />;
      })}
      <circle cx="50" cy="55" r="30" fill="#cf6a1f" />
      <Mirror><circle cx="31" cy="35" r="7" fill="#f7c04a" /></Mirror>
      <circle cx="50" cy="57" r="24" fill="#f7c04a" />
      <ellipse cx="50" cy="67" rx="12" ry="9" fill="#fff1cc" />
      <Eyes y={52} dx={10} />
      <polygon points="45,61 55,61 50,66" fill="#6d3b1f" />
      <Smile y={70} w={4} sw={2} />
    </g>) },
  a8: { name: 'Bunny', bg: '#8e5bd6', art: (
    <g>
      <Mirror><ellipse cx="38" cy="24" rx="7.5" ry="21" fill="#f5f5f5" transform="rotate(-8 38 24)" /><ellipse cx="38" cy="25" rx="3.6" ry="15" fill="#f6b3c4" transform="rotate(-8 38 25)" /></Mirror>
      <circle cx="50" cy="62" r="27" fill="#f5f5f5" />
      <Eyes y={57} dx={11} />
      <ellipse cx="50" cy="66" rx="4" ry="3" fill="#f48fb1" />
      <path d="M50 69 L50 72 M44 72 Q50 77 56 72" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
      <rect x="46.5" y="72" width="7" height="6" rx="1.5" fill="#fff" stroke={INK} strokeWidth="1.2" />
      <Cheeks y={68} dx={18} />
    </g>) },
  a9: { name: 'Penguin', bg: '#26a69a', art: (
    <g>
      <circle cx="50" cy="56" r="32" fill="#263238" />
      <Mirror><circle cx="40" cy="57" r="14" fill="#fafafa" /></Mirror>
      <ellipse cx="50" cy="68" rx="19" ry="14" fill="#fafafa" />
      <Eyes y={54} dx={10} />
      <ellipse cx="50" cy="66" rx="8" ry="4.5" fill="#ff9800" />
      <Cheeks y={66} dx={19} r={4} />
    </g>) },
  a10: { name: 'Frog', bg: '#5c6bc0', art: (
    <g>
      <ellipse cx="50" cy="64" rx="35" ry="25" fill="#66bb6a" />
      <Mirror><circle cx="32" cy="40" r="13" fill="#66bb6a" /></Mirror>
      <BigEyes y={40} dx={18} r={8.5} />
      <path d="M26 64 Q50 84 74 64" fill="none" stroke="#1b5e20" strokeWidth="3" strokeLinecap="round" />
      <Cheeks y={66} dx={27} r={5} />
      <Mirror><circle cx="46" cy="56" r="1.4" fill="#1b5e20" /></Mirror>
    </g>) },
  a11: { name: 'Monkey', bg: '#f2a516', art: (
    <g>
      <Mirror><circle cx="20" cy="55" r="10" fill="#8d5524" /><circle cx="20" cy="55" r="6" fill="#f0c39a" /></Mirror>
      <circle cx="50" cy="54" r="30" fill="#8d5524" />
      <Mirror><circle cx="41" cy="52" r="12" fill="#f0c39a" /></Mirror>
      <ellipse cx="50" cy="66" rx="18" ry="14" fill="#f0c39a" />
      <Eyes y={52} dx={9} />
      <Mirror><circle cx="47.5" cy="63" r="1.6" fill="#5d3a1a" /></Mirror>
      <Smile y={70} w={7} sw={2.4} color="#5d3a1a" />
    </g>) },
  a12: { name: 'Raccoon', bg: '#00897b', art: (
    <g>
      <Mirror><polygon points="22,40 26,14 44,30" fill="#78828c" /><polygon points="27,34 28,20 37,29" fill="#2b2f33" /></Mirror>
      <circle cx="50" cy="57" r="31" fill="#9aa4ad" />
      <path d="M22 50 Q36 40 50 50 Q64 40 78 50 Q72 62 50 58 Q28 62 22 50Z" fill="#2b2f33" />
      <Mirror><circle cx="38" cy="51" r="5.5" fill="#fff" /><circle cx="38.6" cy="51.4" r="3" fill={INK} /></Mirror>
      <ellipse cx="50" cy="69" rx="14" ry="10" fill="#f2f2f2" />
      <ellipse cx="50" cy="65" rx="4.6" ry="3.2" fill={INK} />
      <Smile y={71} w={4} sw={2} />
    </g>) },
  a13: { name: 'Tiger', bg: '#3949ab', art: (
    <g>
      <Mirror><circle cx="26" cy="32" r="10" fill="#f57c00" /><circle cx="26" cy="32" r="5" fill={INK} /></Mirror>
      <circle cx="50" cy="57" r="31" fill="#f57c00" />
      <path d="M50 27 L50 37 M42 28 L44 36 M58 28 L56 36" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <Mirror><path d="M20 52 L30 54 M20 60 L29 60 M21 68 L30 65" stroke={INK} strokeWidth="3" strokeLinecap="round" /></Mirror>
      <Mirror><ellipse cx="43" cy="68" rx="9" ry="7.5" fill="#fff" /></Mirror>
      <Eyes y={51} dx={12} color="#2e7d32" />
      <polygon points="46,62 54,62 50,66" fill="#f48fb1" />
    </g>) },
  a14: { name: 'Koala', bg: '#ef6c8f', art: (
    <g>
      <Mirror><circle cx="21" cy="40" r="16" fill="#90a4ae" /><circle cx="21" cy="40" r="9.5" fill="#eceff1" /></Mirror>
      <circle cx="50" cy="58" r="28" fill="#90a4ae" />
      <Eyes y={53} dx={12} rx={3.4} ry={4.2} />
      <ellipse cx="50" cy="63" rx="7.5" ry="10" fill="#37474f" />
      <Smile y={75} w={4} sw={1.8} />
      <Cheeks y={66} dx={19} />
    </g>) },
  a15: { name: 'Piggy', bg: '#4caf50', art: (
    <g>
      <Mirror><polygon points="24,40 26,18 42,30" fill="#f48fb1" /></Mirror>
      <circle cx="50" cy="57" r="30" fill="#f8a5c2" />
      <Eyes y={51} dx={12} />
      <ellipse cx="50" cy="65" rx="12" ry="8.5" fill="#f06292" />
      <Mirror><ellipse cx="45.5" cy="65" rx="2.2" ry="3.2" fill="#8e244d" /></Mirror>
      <Cheeks y={62} dx={23} />
    </g>) },
  a16: { name: 'Unicorn', bg: '#7e57c2', art: (
    <g>
      <circle cx="30" cy="40" r="11" fill="#ff80ab" /><circle cx="25" cy="54" r="10" fill="#80d8ff" /><circle cx="27" cy="68" r="9" fill="#ffd180" />
      <ellipse cx="53" cy="58" rx="25" ry="28" fill="#fafafa" />
      <polygon points="64,34 70,18 74,36" fill="#fafafa" />
      <polygon points="46,34 56,34 51,6" fill="#ffca28" />
      <path d="M48 28 L54 26 M49 20 L53 19" stroke="#f57f17" strokeWidth="1.6" />
      <Eyes y={54} dx={10} />
      <Mirror><path d="M33 49 L36 51" stroke={INK} strokeWidth="1.5" strokeLinecap="round" /></Mirror>
      <Mirror><circle cx="46" cy="70" r="1.6" fill="#b0a7c9" /></Mirror>
      <Smile y={74} w={5} sw={2} />
      <Cheeks y={64} dx={18} />
    </g>) },

  // ------------------------------ characters ------------------------------
  a17: { name: 'Robot', bg: '#ff7043', art: (
    <g>
      <line x1="50" y1="26" x2="50" y2="12" stroke="#78909c" strokeWidth="3" /><circle cx="50" cy="11" r="5" fill="#ef5350" />
      <Mirror><rect x="14" y="46" width="10" height="18" rx="3" fill="#78909c" /></Mirror>
      <rect x="22" y="26" width="56" height="54" rx="12" fill="#b0bec5" />
      <rect x="29" y="38" width="42" height="18" rx="9" fill="#263238" />
      <Mirror><circle cx="40" cy="47" r="5" fill="#4dd0e1" /><circle cx="41.5" cy="45.5" r="1.5" fill="#fff" /></Mirror>
      <rect x="36" y="63" width="28" height="9" rx="3" fill="#78909c" />
      <path d="M43 63 V72 M50 63 V72 M57 63 V72" stroke="#b0bec5" strokeWidth="2" />
    </g>) },
  a18: { name: 'Alien', bg: '#512da8', art: (
    <g>
      <Mirror><path d="M40 26 Q34 16 28 10" stroke="#7cb342" strokeWidth="3" fill="none" strokeLinecap="round" /><circle cx="28" cy="10" r="4.5" fill="#cddc39" /></Mirror>
      <path d="M50 22 C78 22 82 50 74 66 C68 80 58 88 50 88 C42 88 32 80 26 66 C18 50 22 22 50 22Z" fill="#8bc34a" />
      <Mirror><ellipse cx="38" cy="52" rx="8.5" ry="13" fill={INK} transform="rotate(-28 38 52)" /><ellipse cx="36" cy="47" rx="2.5" ry="3.5" fill="#fff" transform="rotate(-28 36 47)" /></Mirror>
      <Smile y={73} w={5} sw={2} />
    </g>) },
  a19: { name: 'Pirate', bg: '#0277bd', art: (
    <g>
      <circle cx="50" cy="59" r="27" fill="#f1c27d" />
      <path d="M22 52 Q22 24 50 24 Q78 24 78 52 Q50 44 22 52Z" fill="#d32f2f" />
      <Mirror><circle cx="38" cy="36" r="2.2" fill="#fff" /></Mirror><circle cx="50" cy="31" r="2.2" fill="#fff" />
      <path d="M76 44 L86 38 L84 50Z" fill="#b71c1c" />
      <line x1="26" y1="46" x2="72" y2="58" stroke={INK} strokeWidth="2" />
      <circle cx="62" cy="57" r="7" fill={INK} />
      <ellipse cx="39" cy="57" rx="3.6" ry="4.4" fill={INK} /><circle cx="40.2" cy="55.6" r="1.2" fill="#fff" />
      <path d="M28 70 Q50 92 72 70 Q60 80 50 78 Q40 80 28 70Z" fill="#5d4037" />
      <Smile y={70} w={6} sw={2.2} />
    </g>) },
  a20: { name: 'Ninja', bg: '#fbc02d', art: (
    <g>
      <circle cx="50" cy="56" r="32" fill="#212121" />
      <rect x="18" y="33" width="64" height="9" rx="2" fill="#e53935" />
      <path d="M80 37 L94 30 M80 39 L92 46" stroke="#e53935" strokeWidth="4" strokeLinecap="round" />
      <rect x="24" y="46" width="52" height="17" rx="8.5" fill="#f1c27d" />
      <Mirror><path d="M31 49 L43 52" stroke={INK} strokeWidth="2.4" strokeLinecap="round" /><ellipse cx="38" cy="56" rx="3.4" ry="3.8" fill={INK} /></Mirror>
    </g>) },
  a21: { name: 'Astronaut', bg: '#1e88e5', art: (
    <g>
      <Mirror><rect x="12" y="48" width="9" height="16" rx="3" fill="#90a4ae" /></Mirror>
      <circle cx="50" cy="56" r="33" fill="#eceff1" stroke="#b0bec5" strokeWidth="2" />
      <ellipse cx="50" cy="57" rx="24" ry="20" fill="#16304f" />
      <circle cx="50" cy="60" r="12" fill="#f1c27d" />
      <Eyes y={58} dx={4.5} rx={1.6} ry={2} />
      <Smile y={64} w={3} sw={1.4} />
      <path d="M33 47 Q40 40 50 40" stroke="#9ec9ff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
      <circle cx="68" cy="66" r="2.2" fill="#9ec9ff" opacity="0.8" />
    </g>) },
  a22: { name: 'Wizard', bg: '#00838f', art: (
    <g>
      <path d="M30 60 Q32 92 50 96 Q68 92 70 60Z" fill="#f5f5f5" />
      <circle cx="50" cy="56" r="19" fill="#f1c27d" />
      <path d="M32 66 Q50 82 68 66 Q66 90 50 92 Q34 90 32 66Z" fill="#fafafa" />
      <path d="M40 66 Q45 62 50 66 Q55 62 60 66" fill="#fafafa" stroke="#e0e0e0" />
      <Eyes y={54} dx={7} rx={2.6} ry={3} />
      <Mirror><path d="M38 48 L46 49" stroke="#fafafa" strokeWidth="3" strokeLinecap="round" /></Mirror>
      <polygon points="22,42 78,42 58,2" fill="#673ab7" />
      <ellipse cx="50" cy="42" rx="32" ry="6" fill="#512da8" />
      <path d="M47 20 l2 4 4 .5-3 3 .8 4-3.8-2-3.8 2 .8-4-3-3 4-.5z" fill="#ffeb3b" />
      <circle cx="58" cy="32" r="2" fill="#ffeb3b" /><circle cx="40" cy="34" r="1.5" fill="#ffeb3b" />
    </g>) },
  a23: { name: 'King', bg: '#c62828', art: (
    <g>
      <circle cx="50" cy="58" r="25" fill="#e0ac69" />
      <path d="M26 62 Q28 92 50 92 Q72 92 74 62 Q62 74 50 74 Q38 74 26 62Z" fill="#6d4c41" />
      <path d="M40 70 Q50 64 60 70" fill="none" stroke="#6d4c41" strokeWidth="4" strokeLinecap="round" />
      <Eyes y={55} dx={9} />
      <polygon points="26,40 26,16 38,28 50,12 62,28 74,16 74,40" fill="#fbc02d" stroke="#e09d00" strokeWidth="1.5" />
      <circle cx="50" cy="31" r="3.5" fill="#e53935" /><Mirror><circle cx="34" cy="34" r="2.6" fill="#1e88e5" /></Mirror>
    </g>) },
  a24: { name: 'Ghost', bg: '#6a1b9a', art: (
    <g>
      <path d="M24 90 L24 48 Q24 18 50 18 Q76 18 76 48 L76 90 Q70 82 63 90 Q56 82 50 90 Q44 82 37 90 Q30 82 24 90Z" fill="#fafafa" />
      <Mirror><ellipse cx="40" cy="48" rx="5" ry="7" fill={INK} /><circle cx="41.5" cy="45.5" r="1.7" fill="#fff" /></Mirror>
      <ellipse cx="50" cy="62" rx="4" ry="5" fill={INK} />
      <Cheeks y={56} dx={17} />
    </g>) },
};

export const AVATAR_KEYS = Object.keys(AVATARS);
export const avatarName = (k: string) => AVATARS[k]?.name ?? 'Player';

export function AvatarArt({ k }: { k: string }) {
  const a = AVATARS[k] ?? AVATARS.a1;
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
      <rect width="100" height="100" fill={a.bg} />
      <ellipse cx="34" cy="20" rx="40" ry="26" fill="#fff" opacity="0.14" />
      {a.art}
    </svg>
  );
}
