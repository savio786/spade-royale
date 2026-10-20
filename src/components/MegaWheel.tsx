import { useEffect, useRef, useState } from 'react';
import { Coin } from './ui';

// Mega Bonus wheel art: 16 wedges (gold / charcoal / cream, one red jackpot) inside a chrome rim with chasing bulbs.
export const WHEEL_VALUES = [500, 2500, 750, 250, 1000, 250, 10000, 1500, 250, 1000, 2000, 500, 750, 250, 5000, 1000];
const N = WHEEL_VALUES.length, SEG = 360 / N;
const short = (v: number) => (v >= 10000 ? `${v / 1000}K` : String(v));
const fill = (i: number, v: number) => (v >= 10000 ? 'url(#mw-red)' : i % 4 === 0 ? 'url(#mw-gold)' : i % 4 === 2 ? 'url(#mw-cream)' : 'url(#mw-dark)');
const ink = (i: number, v: number) => (v >= 10000 ? '#fff4e0' : i % 4 === 0 ? '#3a2400' : i % 4 === 2 ? '#2a2a2e' : '#e9ecf8');
const rad = (d: number) => ((d - 90) * Math.PI) / 180;           // 0° = straight up, clockwise
const pt = (r: number, d: number) => `${(r * Math.cos(rad(d))).toFixed(2)} ${(r * Math.sin(rad(d))).toFixed(2)}`;

/** The wheel graphic. `rotation` turns only the wedges; the rim, bulbs and pointer stay put. */
export function WheelArt({ rotation = 0, mult = 1, win = -1, rotRef, rotClass }: { rotation?: number; mult?: number; win?: number; rotRef?: React.Ref<SVGGElement>; rotClass?: string }) {
  return (
    <svg className="mw-svg" viewBox="-200 -214 400 414" role="img" aria-label="Mega bonus prize wheel">
      <defs>
        <linearGradient id="mw-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffe9a0" /><stop offset=".5" stopColor="#f2b632" /><stop offset="1" stopColor="#b77a0c" /></linearGradient>
        <linearGradient id="mw-cream" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fffdf2" /><stop offset="1" stopColor="#d9d3bd" /></linearGradient>
        <linearGradient id="mw-dark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4a4d5c" /><stop offset="1" stopColor="#1f2129" /></linearGradient>
        <linearGradient id="mw-red" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff5a5a" /><stop offset=".55" stopColor="#d91a2a" /><stop offset="1" stopColor="#8a0614" /></linearGradient>
        <linearGradient id="mw-chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset=".25" stopColor="#b9c2e0" /><stop offset=".5" stopColor="#6b7499" /><stop offset=".75" stopColor="#d9def0" /><stop offset="1" stopColor="#59618a" /></linearGradient>
        <radialGradient id="mw-bulb"><stop offset="0" stopColor="#fff7d6" /><stop offset=".45" stopColor="#ffb53d" /><stop offset="1" stopColor="#c45a00" /></radialGradient>
        <radialGradient id="mw-shine" cx=".5" cy=".2" r=".8"><stop offset="0" stopColor="#fff" stopOpacity=".28" /><stop offset=".5" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <linearGradient id="mw-ptr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#eaf4ff" /><stop offset="1" stopColor="#7fb6ff" /></linearGradient>
      </defs>
      <circle r="198" fill="none" stroke="#3fb4ff" strokeWidth="4" className="mw-neon" />
      <circle r="192" fill="url(#mw-chrome)" />
      <circle r="176" fill="#141626" />
      {Array.from({ length: 32 }, (_, i) => {
        const [x, y] = pt(184, i * 11.25).split(' ');
        return <circle key={i} cx={x} cy={y} r="5.6" fill="url(#mw-bulb)" className={`mw-bulb ${i % 2 ? 'b' : 'a'}`} />;
      })}
      <g ref={rotRef} className={rotClass} style={rotClass ? undefined : { transform: `rotate(${rotation}deg)` }}>
        {WHEEL_VALUES.map((v, i) => {
          const a0 = i * SEG - SEG / 2, a1 = a0 + SEG, mid = i * SEG;
          const [tx, ty] = pt(112, mid).split(' ');
          return (
            <g key={i} className={win === i ? 'mw-win' : undefined}>
              <path d={`M0 0 L${pt(170, a0)} A170 170 0 0 1 ${pt(170, a1)} Z`} fill={fill(i, v)} stroke="#0d0e18" strokeWidth="2" />
              <text x={tx} y={ty} fill={ink(i, v)} fontSize={v * mult >= 10000 ? 30 : 34} fontFamily="Bebas Neue, Impact, sans-serif" letterSpacing="1"
                textAnchor="middle" dominantBaseline="central" transform={`rotate(${mid + 90} ${tx} ${ty})`}>{short(v * mult)}</text>
            </g>
          );
        })}
        {WHEEL_VALUES.map((_, i) => { const [x, y] = pt(162, i * SEG - SEG / 2).split(' '); return <circle key={i} cx={x} cy={y} r="4.5" fill="url(#mw-chrome)" stroke="#0d0e18" />; })}
        <circle r="170" fill="url(#mw-shine)" pointerEvents="none" />
      </g>
      <circle r="62" fill="url(#mw-chrome)" />
      <circle r="54" fill="#1b1340" />
      {Array.from({ length: 8 }, (_, i) => { const [x, y] = pt(58, i * 45 + 22.5).split(' '); return <circle key={i} cx={x} cy={y} r="4.4" fill="#ffd34d" stroke="#7a5200" strokeWidth="1" />; })}
      <g className="mw-pointer">
        <path d="M-24 -206 L24 -206 L0 -156 Z" fill="url(#mw-ptr)" stroke="#173a80" strokeWidth="3" strokeLinejoin="round" />
        {[0, 1, 2].map((k) => <path key={k} d={`M-9 ${-200 + k * 11} L0 ${-192 + k * 11} L9 ${-200 + k * 11}`} fill="none" stroke="#ff3fa4" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" className={`mw-chev c${k}`} />)}
      </g>
    </svg>
  );
}

/** Full-screen Mega Bonus: tap SPIN, the wheel ticks to a stop, then a YOU WON banner with flying coins. */
export function MegaWheel({ ready, nextIn, mult, onWin, onClose, tick, jackpot }: {
  ready: boolean; nextIn: string; mult: number; onWin: (coins: number, jackpot: boolean) => void; onClose: () => void; tick: () => void; jackpot: () => void;
}) {
  const rot = useRef<SVGGElement>(null);
  const ptr = useRef<HTMLDivElement>(null);
  const angle = useRef(0);
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'won'>('idle');
  const [win, setWin] = useState<{ i: number; coins: number } | null>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && phase !== 'spinning') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose, phase]);
  // a gentle idle drift so the wheel feels alive before it's spun
  useEffect(() => {
    if (phase !== 'idle') return;
    let raf = 0, last = performance.now();
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const step = (t: number) => { angle.current += ((t - last) / 1000) * 4; last = t; if (rot.current) rot.current.style.transform = `rotate(${angle.current}deg)`; raf = requestAnimationFrame(step); };
    if (!still) raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase]);
  const spin = () => {
    if (!ready || phase !== 'idle') return;
    const i = Math.floor(Math.random() * N);
    const from = angle.current;
    const jitter = (Math.random() - 0.5) * SEG * 0.6;
    const base = from - (((from % 360) + 360) % 360);
    const to = base + 360 * 7 + ((360 - i * SEG) % 360) + jitter;
    const dur = 5600, t0 = performance.now();
    let lastSeg = Math.floor((from + SEG / 2) / SEG);
    setPhase('spinning');
    const ease = (x: number) => 1 - Math.pow(1 - x, 4);
    const frame = (t: number) => {
      const k = Math.min(1, (t - t0) / dur), a = from + (to - from) * ease(k);
      angle.current = a;
      if (rot.current) rot.current.style.transform = `rotate(${a}deg)`;
      const seg = Math.floor((a + SEG / 2) / SEG);
      if (seg !== lastSeg) {
        lastSeg = seg; tick();
        const p = ptr.current; if (p) { p.classList.remove('flick'); void p.offsetWidth; p.classList.add('flick'); }
      }
      if (k < 1) requestAnimationFrame(frame);
      else {
        const coins = WHEEL_VALUES[i] * mult, big = WHEEL_VALUES[i] >= 5000;
        setWin({ i, coins }); setPhase('won');
        if (big) jackpot();
        onWin(coins, big);
      }
    };
    requestAnimationFrame(frame);
  };
  return (
    <div className="mw-overlay" role="dialog" aria-modal="true" aria-label="Mega bonus wheel">
      <div className="mw-dim" onClick={() => phase !== 'spinning' && onClose()} />
      {phase !== 'spinning' && <button className="mw-close" onClick={onClose} aria-label="Close">×</button>}
      <div className="mw-stage">
        <div className="mw-head" style={phase === 'won' ? { visibility: 'hidden' } : undefined}>{ready ? 'MEGA BONUS' : <>NEXT SPIN IN <b>{nextIn}</b></>}{mult > 1 && <small>VIP ×{mult}</small>}</div>
        {phase === 'won' && win && (
          <div className="mw-won" role="status">
            <div className="mw-won-title">YOU WON</div>
            <div className="mw-won-amt"><Coin size={40} /><span>{win.coins.toLocaleString()}</span></div>
          </div>
        )}
        <div className={`mw-wheel ${ready ? '' : 'locked'} ${phase}`} ref={ptr}>
          <WheelArt mult={mult} win={phase === 'won' && win ? win.i : -1} rotRef={rot} rotation={angle.current} />
          <button className="mw-hub" onClick={spin} disabled={!ready || phase !== 'idle'} aria-label={ready ? 'Spin the wheel' : `Next spin in ${nextIn}`}>
            <svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 14 C36 32 18 42 18 58 C18 70 28 76 37 75 C42 74.5 46 72 48 69 C47 77 44 82 38 86 L62 86 C56 82 53 77 52 69 C54 72 58 74.5 63 75 C72 76 82 70 82 58 C82 42 64 32 50 14 Z" fill="currentColor" /></svg>
            <span>{phase === 'won' ? 'WIN!' : ready ? 'SPIN' : 'SOON'}</span>
          </button>
          {ready && phase === 'idle' && <div className="mw-cta" aria-hidden="true"><span className="mw-cta-click">Click</span><span className="mw-cta-to">TO SPIN</span><svg viewBox="0 0 120 60"><path d="M6 44 C40 44 62 34 92 16 M92 16 L74 14 M92 16 L86 33" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /></svg></div>}
        </div>
        {phase === 'won' && (
          <div className="mw-coins" aria-hidden="true">
            {Array.from({ length: 22 }, (_, k) => {
              const a = (k / 22) * Math.PI * 2 + Math.random() * 0.3, d = 140 + Math.random() * 220;
              return <span key={k} style={{ '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d - 80}px`, '--dl': `${Math.random() * 0.35}s`, '--sp': `${(Math.random() - 0.5) * 720}deg` } as React.CSSProperties}><Coin size={34} /></span>;
            })}
          </div>
        )}
        {phase === 'won' && <button className="mw-collect pill gold" onClick={onClose}>COLLECT</button>}
      </div>
    </div>
  );
}
