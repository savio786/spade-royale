// Glossy, glowing icons for the three big lobby buttons (original artwork).
import { useEffect, useId, useRef } from 'react';

const useUid = () => useId().replace(/[^a-zA-Z0-9]/g, '');

/** Bold "play" chevrons, animated: ripple rings, breathing glow, a light sweep across the arrow and a forward nudge. */
export function PlayArt() {
  const u = useUid();
  const ARROW = 'M40 24 L100 58 L58 96Z';
  return (
    <svg viewBox="0 0 120 120" className="ring-art play-art" aria-hidden="true">
      <defs>
        <linearGradient id={`${u}a`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d6ffe4" /><stop offset=".4" stopColor="#4cff95" /><stop offset="1" stopColor="#12b552" /></linearGradient>
        <linearGradient id={`${u}b`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a6ffc9" /><stop offset="1" stopColor="#1bc45e" /></linearGradient>
        <linearGradient id={`${u}s`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".85" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <clipPath id={`${u}c`}><path d={ARROW} /><path d="M18 34 L32 30 L46 92 L32 96Z" /></clipPath>
        <filter id={`${u}g`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {/* ripples pulsing outward */}
      {[0, 1, 2].map((k) => <circle key={k} className={`pa-ripple r${k}`} cx="60" cy="60" r="30" fill="none" stroke="#4cff95" strokeWidth="3" />)}
      <g className="pa-body" filter={`url(#${u}g)`} strokeLinejoin="round">
        <path className="pa-bar" d="M18 34 L32 30 L46 92 L32 96Z" fill={`url(#${u}b)`} stroke="#04461d" strokeWidth="2.5" />
        <g className="pa-arrow">
          <path d={ARROW} fill={`url(#${u}a)`} stroke="#04461d" strokeWidth="3" />
          <path d="M46 32 L92 58 L60 66Z" fill="#fff" opacity=".28" />
          <path d="M60 50 L80 60 L64 74Z" fill="#05341a" opacity=".55" />
        </g>
        <g clipPath={`url(#${u}c)`}><rect className="pa-shine" x="-40" y="0" width="34" height="120" fill={`url(#${u}s)`} transform="skewX(-20)" /></g>
      </g>
      {/* sparkles */}
      {[[96, 30], [24, 100], [102, 92]].map(([x, y], k) => <path key={k} className={`pa-spark s${k}`} d={`M${x} ${y - 6} L${x + 1.6} ${y - 1.6} L${x + 6} ${y} L${x + 1.6} ${y + 1.6} L${x} ${y + 6} L${x - 1.6} ${y + 1.6} L${x - 6} ${y} L${x - 1.6} ${y - 1.6}Z`} fill="#eafff1" />)}
    </svg>
  );
}

/** A real world globe (country map) drawn on a canvas. It turns slowly while the pointer is over its button. */
export function GlobeArt() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const SIZE = 176, dpr = Math.min(3, window.devicePixelRatio || 1);
    cv.width = SIZE * dpr; cv.height = SIZE * dpr;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    ctx.scale(dpr, dpr);
    let alive = true, raf = 0, last = 0, hovering = false;
    let lon = -15;                                   // start over Africa / Europe
    let draw = (_l: number) => {};
    const r = SIZE / 2 - 6, cx = SIZE / 2, cy = SIZE / 2;
    const PALETTE = ['#57c27a', '#e9c55a', '#45b3a3', '#9fd36a', '#f0a95a', '#7fc3e0', '#d9df73', '#c0e08a'];
    void Promise.all([import('d3-geo'), import('topojson-client'), import('world-atlas/countries-110m.json')]).then(([geo, topo, atlas]) => {
      if (!alive) return;
      const world = (atlas as unknown as { default?: unknown }).default ?? atlas;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const countries = (topo.feature(world as any, (world as any).objects.countries) as any).features as { id?: string; geometry: unknown }[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const borders = topo.mesh(world as any, (world as any).objects.countries, (a: unknown, b: unknown) => a !== b);
      const proj = geo.geoOrthographic().scale(r).translate([cx, cy]).clipAngle(90);
      const path = geo.geoPath(proj, ctx);
      const grat = geo.geoGraticule10();
      const colorOf = (id: string | undefined, i: number) => PALETTE[((id ? parseInt(id, 10) : i) * 7 + 3) % PALETTE.length] ?? PALETTE[0];
      draw = (l: number) => {
        proj.rotate([l, -18, 0]);
        ctx.clearRect(0, 0, SIZE, SIZE);
        // atmosphere glow
        const halo = ctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, r + 6);
        halo.addColorStop(0, 'rgba(120,200,255,.55)'); halo.addColorStop(1, 'rgba(120,200,255,0)');
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, Math.PI * 2); ctx.fill();
        // ocean
        const sea = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
        sea.addColorStop(0, '#5fb6ff'); sea.addColorStop(0.55, '#1f6fd6'); sea.addColorStop(1, '#0a2a7a');
        ctx.fillStyle = sea; ctx.beginPath(); path({ type: 'Sphere' }); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 0.6; ctx.beginPath(); path(grat); ctx.stroke();
        // countries, each its own colour
        countries.forEach((f, i) => { ctx.fillStyle = colorOf(f.id, i); ctx.beginPath(); path(f as never); ctx.fill(); });
        ctx.strokeStyle = 'rgba(20,40,60,.55)'; ctx.lineWidth = 0.6; ctx.beginPath(); path(borders as never); ctx.stroke();
        // 3D shading and gloss
        const shade = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.45, r * 0.2, cx, cy, r * 1.05);
        shade.addColorStop(0, 'rgba(255,255,255,.18)'); shade.addColorStop(0.55, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,10,40,.6)');
        ctx.fillStyle = shade; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.translate(cx - r * 0.35, cy - r * 0.48); ctx.rotate(-0.45);
        const gloss = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.42);
        gloss.addColorStop(0, 'rgba(255,255,255,.55)'); gloss.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gloss; ctx.scale(1, 0.55); ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        ctx.strokeStyle = 'rgba(6,24,80,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      };
      draw(lon);
    });
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const tick = (t: number) => {
      if (!hovering) { raf = 0; return; }
      if (last) lon += ((t - last) / 1000) * 14;      // about 14° a second: a slow, gentle turn
      last = t; draw(lon); raf = requestAnimationFrame(tick);
    };
    const host = cv.closest('.ring-btn') ?? cv;
    const enter = () => { if (still) return; hovering = true; last = 0; if (!raf) raf = requestAnimationFrame(tick); };
    const leave = () => { hovering = false; };
    host.addEventListener('pointerenter', enter); host.addEventListener('pointerleave', leave);
    host.addEventListener('focus', enter); host.addEventListener('blur', leave);
    return () => { alive = false; cancelAnimationFrame(raf); host.removeEventListener('pointerenter', enter); host.removeEventListener('pointerleave', leave); host.removeEventListener('focus', enter); host.removeEventListener('blur', leave); };
  }, []);
  return (
    <span className="ring-art globe-wrap" aria-hidden="true">
      <canvas ref={ref} className="globe-canvas" />
      <svg className="globe-fx front" viewBox="0 0 120 120">
        {[0, 1, 2].map((k) => <circle key={k} className={`gl-ripple r${k}`} cx="60" cy="60" r="52" fill="none" stroke="#8fd0ff" strokeWidth="2.5" />)}
        {[[102, 26], [16, 34], [104, 98]].map(([x, y], k) => <path key={k} className={`gl-spark s${k}`} d={`M${x} ${y - 6} L${x + 1.6} ${y - 1.6} L${x + 6} ${y} L${x + 1.6} ${y + 1.6} L${x} ${y + 6} L${x - 1.6} ${y + 1.6} L${x - 6} ${y} L${x - 1.6} ${y - 1.6}Z`} fill="#e8f6ff" />)}
      </svg>
    </span>
  );
}

/** Two players with a padlock (private game), animated: ripples, breathing glow, padlock jiggle and shine; the lock pops open on hover. */
export function PrivateArt() {
  const u = useUid();
  return (
    <svg viewBox="0 0 120 120" className="ring-art private-art" aria-hidden="true">
      <defs>
        <radialGradient id={`${u}p`} cx=".4" cy=".3" r=".8"><stop offset="0" stopColor="#f0d4ff" /><stop offset=".5" stopColor="#b065ff" /><stop offset="1" stopColor="#5a1fb8" /></radialGradient>
        <radialGradient id={`${u}q`} cx=".4" cy=".3" r=".8"><stop offset="0" stopColor="#e2c2ff" /><stop offset=".55" stopColor="#9446f0" /><stop offset="1" stopColor="#47148f" /></radialGradient>
        <linearGradient id={`${u}l`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f2dcff" /><stop offset="1" stopColor="#8d3ce6" /></linearGradient>
        <linearGradient id={`${u}s`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".9" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <clipPath id={`${u}c`}><rect x="53" y="76" width="34" height="27" rx="6" /></clipPath>
        <filter id={`${u}g`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {[0, 1, 2].map((k) => <circle key={k} className={`pv-ripple r${k}`} cx="60" cy="62" r="30" fill="none" stroke="#c08bff" strokeWidth="3" />)}
      <g className="pv-body" filter={`url(#${u}g)`} stroke="#3a0d78" strokeWidth="2.5">
        {/* back player */}
        <g className="pv-back">
          <circle cx="76" cy="38" r="15" fill={`url(#${u}q)`} />
          <path d="M50 92 C50 68 60 58 76 58 C92 58 104 68 104 92Z" fill={`url(#${u}q)`} />
        </g>
        {/* front player */}
        <g className="pv-front">
          <circle cx="46" cy="44" r="17" fill={`url(#${u}p)`} />
          <path d="M16 100 C16 74 28 64 46 64 C64 64 76 74 76 100Z" fill={`url(#${u}p)`} />
          <ellipse cx="40" cy="38" rx="7" ry="5" fill="#fff" opacity=".4" stroke="none" />
        </g>
        {/* padlock */}
        <g className="pv-lock">
          <g className="pv-shackle">
            <path d="M60 78 V70 a10 10 0 0 1 20 0 V78" fill="none" stroke="#3a0d78" strokeWidth="9" />
            <path d="M60 78 V70 a10 10 0 0 1 20 0 V78" fill="none" stroke="#e9d2ff" strokeWidth="4" />
          </g>
          <rect x="53" y="76" width="34" height="27" rx="6" fill={`url(#${u}l)`} />
          <g clipPath={`url(#${u}c)`}><rect className="pv-shine" x="30" y="70" width="14" height="40" fill={`url(#${u}s)`} stroke="none" transform="skewX(-20)" /></g>
          <circle cx="70" cy="87" r="3.6" fill="#3a0d78" stroke="none" /><rect x="68.4" y="88" width="3.2" height="8" rx="1.4" fill="#3a0d78" stroke="none" />
        </g>
      </g>
      {[[100, 28], [18, 30], [104, 100]].map(([x, y], k) => <path key={k} className={`pv-spark s${k}`} d={`M${x} ${y - 6} L${x + 1.6} ${y - 1.6} L${x + 6} ${y} L${x + 1.6} ${y + 1.6} L${x} ${y + 6} L${x - 1.6} ${y + 1.6} L${x - 6} ${y} L${x - 1.6} ${y - 1.6}Z`} fill="#f6e8ff" />)}
    </svg>
  );
}
