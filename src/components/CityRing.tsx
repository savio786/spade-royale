// Championship rings and table colours for each city (original artwork).
// Each city's tables have their own felt colour and ring gem.
export const CITY_LOOK: Record<string, { theme: string; gem: string }> = {
  'New York': { theme: 'emerald', gem: '#2ecc71' },
  Chicago: { theme: 'ocean', gem: '#3aa0ff' },
  Miami: { theme: 'sunset', gem: '#ff6aa8' },
  Seattle: { theme: 'royal', gem: '#b07bff' },
  'Las Vegas': { theme: 'ruby', gem: '#ff3355' },
  London: { theme: 'neon', gem: '#00e5ff' },
  Monaco: { theme: 'gold', gem: '#ffd34d' },
};
export const lookFor = (city: string) => CITY_LOOK[city] ?? CITY_LOOK.Seattle;


export function CityRing({ gem, className }: { gem: string; className?: string }) {
  return (
    <svg viewBox="0 0 60 60" className={className ?? 'lt-ring'} aria-hidden="true">
      <defs>
        <linearGradient id={`rg${gem.slice(1)}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff6c8" /><stop offset=".4" stopColor="#e2a92e" /><stop offset=".7" stopColor="#8a5a10" /><stop offset="1" stopColor="#f2cf6a" /></linearGradient>
      </defs>
      <ellipse cx="30" cy="40" rx="20" ry="14" fill="none" stroke={`url(#rg${gem.slice(1)})`} strokeWidth="7" />
      <path d="M14 30 L18 12 H42 L46 30 L38 36 H22Z" fill={`url(#rg${gem.slice(1)})`} stroke="#5a3a08" strokeWidth="1.5" />
      <path d="M21 15 H39 L42 28 L36 32 H24 L18 28Z" fill={gem} stroke="#2a1a00" strokeWidth="1" />
      <path d="M21 15 L30 23 L39 15 M18 28 L30 23 L42 28 M30 23 V32" stroke="#fff" strokeOpacity=".35" strokeWidth="1" fill="none" />
      <ellipse cx="26" cy="19" rx="4" ry="2" fill="#fff" opacity=".6" />
    </svg>
  );
}

