// Artwork for the Solo / Partners room-type cards: glossy navy spades with gold rims, laurels, cards and a chip stack.
const SPADE = 'M50 4 C34 24 8 38 8 60 C8 76 21 84 33 83 C40 82.5 45 79 47.5 75 C46.5 85 42 92 34 97 L66 97 C58 92 53.5 85 52.5 75 C55 79 60 82.5 67 83 C79 84 92 76 92 60 C92 38 66 24 50 4 Z';

function Spade({ x, y, s, id }: { x: number; y: number; s: number; id: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={SPADE} transform="translate(0 4)" fill="#5a3606" />
      <path d={SPADE} fill={`url(#${id}-rim)`} />
      <path d={SPADE} transform="translate(50 52) scale(.84) translate(-50 -52)" fill={`url(#${id}-navy)`} />
      <path d="M50 16 C38 31 22 42 20 58" transform="translate(50 52) scale(.84) translate(-50 -52)" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="3.5" strokeLinecap="round" />
      <ellipse cx="36" cy="48" rx="9" ry="14" transform="rotate(30 36 48)" fill="#fff" fillOpacity=".14" />
    </g>
  );
}

function Card({ x, y, r, rank, red, suit }: { x: number; y: number; r: number; rank: string; red?: boolean; suit: string }) {
  const c = red ? '#d0192f' : '#1a1f3a';
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <rect x="-19" y="-27" width="38" height="54" rx="4" fill="#000" fillOpacity=".3" transform="translate(2 3)" />
      <rect x="-19" y="-27" width="38" height="54" rx="4" fill="#fdfbf4" stroke="#c9c4b4" strokeWidth="1" />
      <text x="-14" y="-14" fontSize="11" fontWeight="700" fill={c} fontFamily="Georgia, serif">{rank}</text>
      <text x="0" y="9" fontSize="22" textAnchor="middle" fill={c} fontFamily="Georgia, serif">{suit}</text>
    </g>
  );
}

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff2b8" /><stop offset=".35" stopColor="#f2c14a" /><stop offset=".7" stopColor="#b97c12" /><stop offset="1" stopColor="#ffd970" /></linearGradient>
      <radialGradient id={`${id}-navy`} cx=".42" cy=".38" r=".75"><stop offset="0" stopColor="#3e57d6" /><stop offset=".45" stopColor="#14206e" /><stop offset="1" stopColor="#05082a" /></radialGradient>
      <linearGradient id={`${id}-leaf`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff0a8" /><stop offset=".5" stopColor="#e3a92c" /><stop offset="1" stopColor="#9a6408" /></linearGradient>
      <linearGradient id={`${id}-chip`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe28a" /><stop offset=".5" stopColor="#e0a321" /><stop offset="1" stopColor="#8f5c06" /></linearGradient>
    </defs>
  );
}

function Laurel({ side, id }: { side: 1 | -1; id: string }) {
  const leaves = Array.from({ length: 10 }, (_, i) => {
    const t = i / 9, a = (-200 + t * 150) * (Math.PI / 180);
    const cx = 100 + side * 62 * Math.cos(a) * -1, cy = 104 + 62 * Math.sin(a) * -1;
    return { cx, cy, rot: side * (t * 150 - 20) };
  });
  return (
    <g>
      <path d={`M${100 + side * 18} 168 Q${100 + side * 72} 140 ${100 + side * 64} 62`} fill="none" stroke="#a46c0a" strokeWidth="5" strokeLinecap="round" />
      {leaves.map((l, i) => (
        <ellipse key={i} cx={l.cx} cy={l.cy} rx="11" ry="21" fill={`url(#${id}-leaf)`} stroke="#7a4e05" strokeWidth="1.2" transform={`rotate(${l.rot} ${l.cx} ${l.cy})`} />
      ))}
    </g>
  );
}

export function SoloArt() {
  return (
    <svg viewBox="0 0 200 190" className="mode-svg" aria-hidden="true">
      <Defs id="so" />
      <ellipse cx="100" cy="178" rx="70" ry="8" fill="#000" fillOpacity=".35" />
      <Laurel side={-1} id="so" /><Laurel side={1} id="so" />
      <Spade x={52} y={16} s={0.96} id="so" />
      <Card x={88} y={150} r={-16} rank="A" suit="♠" />
      <Card x={110} y={146} r={-3} rank="K" red suit="♥" />
      <Card x={132} y={150} r={10} rank="Q" suit="♣" />
      <Card x={152} y={158} r={22} rank="J" red suit="♦" />
    </svg>
  );
}

export function PartnersArt() {
  return (
    <svg viewBox="0 0 200 190" className="mode-svg" aria-hidden="true">
      <Defs id="pa" />
      <ellipse cx="100" cy="180" rx="78" ry="8" fill="#000" fillOpacity=".35" />
      <Card x={44} y={70} r={-24} rank="A" suit="♠" />
      <Card x={74} y={56} r={-9} rank="K" red suit="♥" />
      <Card x={124} y={56} r={9} rank="Q" suit="♣" />
      <Card x={156} y={70} r={24} rank="J" red suit="♦" />
      {[0, 1, 2].map((k) => (
        <g key={k}>
          <ellipse cx="100" cy={170 - k * 9} rx="70" ry="13" fill="#7a4e05" />
          <ellipse cx="100" cy={166 - k * 9} rx="70" ry="13" fill={`url(#pa-chip)`} stroke="#8f5c06" strokeWidth="1.2" />
          <ellipse cx="100" cy={166 - k * 9} rx="52" ry="8" fill="none" stroke="#fff3c4" strokeOpacity=".6" strokeWidth="2" strokeDasharray="6 7" />
        </g>
      ))}
      <Spade x={36} y={58} s={0.8} id="pa" />
      <Spade x={84} y={52} s={0.84} id="pa" />
    </svg>
  );
}
