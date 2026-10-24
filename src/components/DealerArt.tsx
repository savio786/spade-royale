// An original illustration for the lobby: a friendly blonde card dealer at a felt table, fanning out a hand of spades.
// Pure SVG (no image file), drawn for Spade Haven.
export function DealerArt({ className = '' }: { className?: string }) {
  return (
    <svg className={`dealer-art ${className}`} viewBox="0 0 240 290" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="dl-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a1260" /><stop offset=".6" stopColor="#4a1d7d" /><stop offset="1" stopColor="#14082e" /></linearGradient>
        <linearGradient id="dl-hair" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff0a8" /><stop offset=".45" stopColor="#f2c85a" /><stop offset="1" stopColor="#c58a26" /></linearGradient>
        <linearGradient id="dl-hair2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#d9a23a" /><stop offset="1" stopColor="#f7dc84" /></linearGradient>
        <linearGradient id="dl-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffdcc0" /><stop offset="1" stopColor="#f0b999" /></linearGradient>
        <linearGradient id="dl-vest" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0f8f74" /><stop offset="1" stopColor="#06483f" /></linearGradient>
        <linearGradient id="dl-felt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1b8c4e" /><stop offset="1" stopColor="#0b4a28" /></linearGradient>
        <radialGradient id="dl-spot" cx=".5" cy=".28" r=".6"><stop offset="0" stopColor="#ffd98a" stopOpacity=".55" /><stop offset="1" stopColor="#ffd98a" stopOpacity="0" /></radialGradient>
      </defs>
      {/* the casino behind her */}
      <rect width="240" height="290" fill="url(#dl-bg)" />
      <rect width="240" height="290" fill="url(#dl-spot)" />
      {[[22, 40, 12, '#ff6fb0'], [58, 22, 8, '#6fd8ff'], [196, 34, 14, '#ffd23f'], [216, 76, 8, '#b388ff'], [14, 96, 9, '#ffd23f'], [200, 124, 10, '#ff6fb0'], [34, 150, 7, '#6fd8ff'], [168, 18, 7, '#7cff9b']].map(([x, y, r, c], i) => (
        <circle key={i} cx={x as number} cy={y as number} r={r as number} fill={c as string} opacity=".38" />
      ))}
      <path d="M0 86 Q120 40 240 86" fill="none" stroke="#ffd23f" strokeWidth="3" opacity=".5" />
      {/* hair behind */}
      <path d="M120 30C76 30 54 64 58 112C60 144 50 172 64 202C74 222 94 214 98 200L142 200C146 214 166 222 176 202C190 172 180 144 182 112C186 64 164 30 120 30Z" fill="url(#dl-hair)" />
      {/* body: blouse, then vest */}
      <path d="M34 290C36 238 60 214 100 206L140 206C180 214 204 238 206 290Z" fill="#fbfbff" />
      <path d="M62 290C60 250 78 224 106 212L120 258L114 290Z" fill="url(#dl-vest)" stroke="#ffd23f" strokeWidth="2" />
      <path d="M178 290C180 250 162 224 134 212L120 258L126 290Z" fill="url(#dl-vest)" stroke="#ffd23f" strokeWidth="2" />
      <path d="M100 206L120 236L90 224Z" fill="#fff" stroke="#dcdcf0" strokeWidth="1" />
      <path d="M140 206L120 236L150 224Z" fill="#fff" stroke="#dcdcf0" strokeWidth="1" />
      {[266, 280].map((y) => <circle key={y} cx="120" cy={y} r="2.6" fill="#ffd23f" />)}
      {/* neck + head */}
      <path d="M106 170L106 210C106 220 134 220 134 210L134 170Z" fill="url(#dl-skin)" />
      <path d="M106 192C114 202 128 202 134 192L134 180L106 180Z" fill="#d99c7a" opacity=".5" />
      <path d="M82 104C82 68 100 56 120 56C140 56 158 68 158 104C158 138 142 164 120 164C98 164 82 138 82 104Z" fill="url(#dl-skin)" />
      {/* necklace with a little spade */}
      <path d="M104 214Q120 232 136 214" fill="none" stroke="#ffd23f" strokeWidth="1.6" />
      <path d="M120 222c-4 -4 -8 -1 -6 3c1 2 4 2 5 1c0 2 -1 4 -2 5h6c-1 -1 -2 -3 -2 -5c1 1 4 1 5 -1c2 -4 -2 -7 -6 -3Z" fill="#ffd23f" />
      {/* hair in front: side-swept bangs and waves */}
      <path d="M80 112C76 68 98 42 126 44C150 46 164 66 160 104C150 84 134 70 110 70C96 80 86 94 80 112Z" fill="url(#dl-hair)" />
      <path d="M82 104C90 82 104 70 122 66" fill="none" stroke="#fff3b8" strokeWidth="2.4" strokeLinecap="round" opacity=".8" />
      <path d="M70 130C66 160 70 180 62 200" fill="none" stroke="url(#dl-hair2)" strokeWidth="5" strokeLinecap="round" opacity=".9" />
      <path d="M170 130C174 160 170 180 178 200" fill="none" stroke="url(#dl-hair2)" strokeWidth="5" strokeLinecap="round" opacity=".9" />
      {/* face */}
      <ellipse cx="97" cy="130" rx="9" ry="6" fill="#ff7a7a" opacity=".25" />
      <ellipse cx="143" cy="130" rx="9" ry="6" fill="#ff7a7a" opacity=".25" />
      {[105, 135].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="110" rx="7.5" ry="5" fill="#fff" />
          <circle cx={x} cy="110" r="4" fill="#2f86d8" /><circle cx={x} cy="110" r="2" fill="#10264a" /><circle cx={x + 1.4} cy="108.4" r="1.2" fill="#fff" />
          <path d={`M${x - 8.5} 109.5Q${x} 101 ${x + 8.5} 109.5`} fill="none" stroke="#3a2412" strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}
      <path d="M96 98Q105 93 114 97" fill="none" stroke="#b07a2e" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M126 97Q135 93 144 98" fill="none" stroke="#b07a2e" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M120 116C118 126 117 130 122 132" fill="none" stroke="#d99572" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M107 143C113 139 118 141 120 142C122 141 127 139 133 143C129 151 111 151 107 143Z" fill="#d3203f" />
      <path d="M110 144C116 142 124 142 130 144" fill="none" stroke="#ff9aa8" strokeWidth="1.4" strokeLinecap="round" opacity=".8" />
      <circle cx="82" cy="124" r="3.2" fill="#ffd23f" /><circle cx="158" cy="124" r="3.2" fill="#ffd23f" />
      {/* fanned cards, held up at the table */}
      {[[-24, '#c8102e', '♥', 'K'], [0, '#14142b', '♠', 'A'], [24, '#c8102e', '♦', 'Q']].map(([rot, col, suit, rank], i) => (
        <g key={i} transform={`translate(176 262) rotate(${rot})`}>
          <rect x="-17" y="-64" width="34" height="48" rx="4" fill="#fff" stroke="#bbb" strokeWidth="1" />
          <text x="-12" y="-50" fontSize="11" fontWeight="800" fill={col as string} fontFamily="Georgia,serif">{rank}</text>
          <text x="0" y="-26" fontSize="24" textAnchor="middle" fill={col as string}>{suit}</text>
        </g>
      ))}
      {/* the felt table in front */}
      <path d="M0 252Q120 236 240 252L240 290L0 290Z" fill="url(#dl-felt)" />
      <path d="M0 252Q120 236 240 252" fill="none" stroke="#ffd23f" strokeWidth="3" />
      <path d="M20 270Q120 256 220 270" fill="none" stroke="#fff" strokeWidth="1" opacity=".18" />
    </svg>
  );
}
