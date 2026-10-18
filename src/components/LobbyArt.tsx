// Glossy, glowing icons for the three big lobby buttons (original artwork).
import { useId } from 'react';

const useUid = () => useId().replace(/[^a-zA-Z0-9]/g, '');

/** Bold "play" chevrons. */
export function PlayArt() {
  const u = useUid();
  return (
    <svg viewBox="0 0 120 120" className="ring-art" aria-hidden="true">
      <defs>
        <linearGradient id={`${u}a`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d6ffe4" /><stop offset=".4" stopColor="#4cff95" /><stop offset="1" stopColor="#12b552" /></linearGradient>
        <linearGradient id={`${u}b`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a6ffc9" /><stop offset="1" stopColor="#1bc45e" /></linearGradient>
        <filter id={`${u}g`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <g filter={`url(#${u}g)`} strokeLinejoin="round">
        {/* slanted bar */}
        <path d="M18 34 L32 30 L46 92 L32 96Z" fill={`url(#${u}b)`} stroke="#04461d" strokeWidth="2.5" />
        {/* big triangle */}
        <path d="M40 24 L100 58 L58 96Z" fill={`url(#${u}a)`} stroke="#04461d" strokeWidth="3" />
        <path d="M46 32 L92 58 L60 66Z" fill="#fff" opacity=".28" />
        {/* small inner triangle */}
        <path d="M60 50 L80 60 L64 74Z" fill="#05341a" opacity=".55" />
      </g>
    </svg>
  );
}

/** Blue tiled globe. */
export function GlobeArt() {
  const u = useUid();
  return (
    <svg viewBox="0 0 120 120" className="ring-art" aria-hidden="true">
      <defs>
        <radialGradient id={`${u}s`} cx=".38" cy=".32" r=".75"><stop offset="0" stopColor="#9fd4ff" /><stop offset=".45" stopColor="#2f86ff" /><stop offset="1" stopColor="#0b2f99" /></radialGradient>
        <clipPath id={`${u}c`}><circle cx="60" cy="60" r="44" /></clipPath>
        <filter id={`${u}g`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <g filter={`url(#${u}g)`}>
        <circle cx="60" cy="60" r="44" fill={`url(#${u}s)`} />
        <g clipPath={`url(#${u}c)`} fill="none" stroke="#08236e" strokeWidth="4.5">
          {[-30, -15, 0, 15, 30].map((y) => <path key={y} d={`M10 ${60 + y} Q60 ${60 + y + (y === 0 ? 0 : y * 0.35)} 110 ${60 + y}`} />)}
          {[0.25, 0.55, 1].map((k) => <ellipse key={k} cx="60" cy="60" rx={44 * k} ry="44" />)}
        </g>
        <circle cx="60" cy="60" r="44" fill="none" stroke="#062066" strokeWidth="3.5" />
        <ellipse cx="46" cy="36" rx="20" ry="11" fill="#fff" opacity=".35" transform="rotate(-25 46 36)" />
      </g>
    </svg>
  );
}

/** Two players with a padlock (private game). */
export function PrivateArt() {
  const u = useUid();
  return (
    <svg viewBox="0 0 120 120" className="ring-art" aria-hidden="true">
      <defs>
        <radialGradient id={`${u}p`} cx=".4" cy=".3" r=".8"><stop offset="0" stopColor="#f0d4ff" /><stop offset=".5" stopColor="#b065ff" /><stop offset="1" stopColor="#5a1fb8" /></radialGradient>
        <radialGradient id={`${u}q`} cx=".4" cy=".3" r=".8"><stop offset="0" stopColor="#e2c2ff" /><stop offset=".55" stopColor="#9446f0" /><stop offset="1" stopColor="#47148f" /></radialGradient>
        <linearGradient id={`${u}l`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f2dcff" /><stop offset="1" stopColor="#8d3ce6" /></linearGradient>
        <filter id={`${u}g`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <g filter={`url(#${u}g)`} stroke="#3a0d78" strokeWidth="2.5">
        {/* back player */}
        <circle cx="76" cy="38" r="15" fill={`url(#${u}q)`} />
        <path d="M50 92 C50 68 60 58 76 58 C92 58 104 68 104 92Z" fill={`url(#${u}q)`} />
        {/* front player */}
        <circle cx="46" cy="44" r="17" fill={`url(#${u}p)`} />
        <path d="M16 100 C16 74 28 64 46 64 C64 64 76 74 76 100Z" fill={`url(#${u}p)`} />
        <ellipse cx="40" cy="38" rx="7" ry="5" fill="#fff" opacity=".4" stroke="none" />
        {/* padlock */}
        <path d="M60 78 V70 a10 10 0 0 1 20 0 V78" fill="none" stroke="#3a0d78" strokeWidth="9" />
        <path d="M60 78 V70 a10 10 0 0 1 20 0 V78" fill="none" stroke="#e9d2ff" strokeWidth="4" />
        <rect x="53" y="76" width="34" height="27" rx="6" fill={`url(#${u}l)`} />
        <circle cx="70" cy="87" r="3.6" fill="#3a0d78" stroke="none" /><rect x="68.4" y="88" width="3.2" height="8" rx="1.4" fill="#3a0d78" stroke="none" />
      </g>
    </svg>
  );
}
