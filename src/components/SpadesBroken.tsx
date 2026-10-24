// "SPADES BROKEN!" splash: a glowing spade cracks in two, shards and confetti fly out, and the words pop in.
// Shown once per round, the first time a spade is played on another suit (spades can be led from then on).
const SPADE = 'M50 4C50 4 8 36 8 61C8 77 22 86 35 80C39 78 43 75 46 72C45 82 42 90 33 96H67C58 90 55 82 54 72C57 75 61 78 65 80C78 86 92 77 92 61C92 36 50 4 50 4Z';
const CRACK = '50,4 44,22 55,34 43,48 56,62 46,76 52,96';
const COLORS = ['#ffd23f', '#ff5d8f', '#4dd0ff', '#7CFF6B', '#b388ff', '#ff9a3c'];
// fixed, so every render looks the same (angle in degrees, distance in px)
const BITS = Array.from({ length: 18 }, (_, i) => ({ a: i * 20 + (i % 2) * 9, d: 150 + (i * 37) % 110, c: COLORS[i % COLORS.length], s: 8 + (i * 5) % 9, t: i % 3 }));

export function SpadesBroken() {
  return (
    <div className="sbk" role="status" aria-label="Spades broken">
      <div className="sbk-glow" />
      <svg className="sbk-spade" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id="sbkg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8e5bff" /><stop offset=".55" stopColor="#3a1d8f" /><stop offset="1" stopColor="#14082e" /></linearGradient>
          <clipPath id="sbkl"><rect x="0" y="0" width="52" height="100" /></clipPath>
          <clipPath id="sbkr"><rect x="48" y="0" width="52" height="100" /></clipPath>
        </defs>
        <g className="sbk-half l" clipPath="url(#sbkl)"><path d={SPADE} fill="url(#sbkg)" stroke="#ffd23f" strokeWidth="2.5" /><polyline points={CRACK} className="sbk-crack" /></g>
        <g className="sbk-half r" clipPath="url(#sbkr)"><path d={SPADE} fill="url(#sbkg)" stroke="#ffd23f" strokeWidth="2.5" /><polyline points={CRACK} className="sbk-crack" /></g>
      </svg>
      {BITS.map((b, i) => (
        <span key={i} className={`sbk-bit t${b.t}`} style={{ ['--a' as string]: `${b.a}deg`, ['--d' as string]: `${b.d}px`, width: b.s, height: b.s, background: b.c, animationDelay: `${0.28 + (i % 4) * 0.03}s` }} />
      ))}
      <div className="sbk-words"><span className="w1">SPADES</span><span className="w2">BROKEN!</span></div>
    </div>
  );
}
