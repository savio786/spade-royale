// The game table drawn as one SVG so it can have a shaped outline: flared top corners, bowed sides and an
// alcove at the bottom centre for your seat. Colours come from the table theme (CSS variables).
import { useEffect, useId, useRef, useState } from 'react';

interface Box { x0: number; y0: number; x1: number; y1: number; rx: number; ry: number; bow: number; arch: number; nW: number; nH: number }

const K = 0.5523; // bezier handle length for a quarter ellipse

/** An oval card table: big elliptical ends, gently bowed sides and top/bottom, and an alcove at the bottom centre for your seat. */
function outline({ x0, y0, x1, y1, rx, ry, bow, arch, nW, nH }: Box) {
  const cx = (x0 + x1) / 2;
  const p = (n: number) => n.toFixed(1);
  return [
    `M${p(x0 + rx)} ${p(y0)}`,
    `C${p(cx - (cx - x0 - rx) * 0.4)} ${p(y0 - arch)} ${p(cx + (x1 - rx - cx) * 0.4)} ${p(y0 - arch)} ${p(x1 - rx)} ${p(y0)}`,
    `C${p(x1 - rx + rx * K)} ${p(y0)} ${p(x1)} ${p(y0 + ry - ry * K)} ${p(x1)} ${p(y0 + ry)}`,
    `C${p(x1 + bow)} ${p(y0 + ry + (y1 - y0 - 2 * ry) * 0.3)} ${p(x1 + bow)} ${p(y1 - ry - (y1 - y0 - 2 * ry) * 0.3)} ${p(x1)} ${p(y1 - ry)}`,
    `C${p(x1)} ${p(y1 - ry + ry * K)} ${p(x1 - rx + rx * K)} ${p(y1)} ${p(x1 - rx)} ${p(y1)}`,
    `C${p(x1 - rx - (x1 - rx - cx - nW) * 0.5)} ${p(y1 + arch * 0.6)} ${p(cx + nW + 20)} ${p(y1 + arch * 0.3)} ${p(cx + nW)} ${p(y1)}`,
    `C${p(cx + nW * 0.55)} ${p(y1)} ${p(cx + nW * 0.62)} ${p(y1 - nH)} ${p(cx)} ${p(y1 - nH)}`,
    `C${p(cx - nW * 0.62)} ${p(y1 - nH)} ${p(cx - nW * 0.55)} ${p(y1)} ${p(cx - nW)} ${p(y1)}`,
    `C${p(cx - nW - 20)} ${p(y1 + arch * 0.3)} ${p(x0 + rx + (cx - nW - x0 - rx) * 0.5)} ${p(y1 + arch * 0.6)} ${p(x0 + rx)} ${p(y1)}`,
    `C${p(x0 + rx - rx * K)} ${p(y1)} ${p(x0)} ${p(y1 - ry + ry * K)} ${p(x0)} ${p(y1 - ry)}`,
    `C${p(x0 - bow)} ${p(y1 - ry - (y1 - y0 - 2 * ry) * 0.3)} ${p(x0 - bow)} ${p(y0 + ry + (y1 - y0 - 2 * ry) * 0.3)} ${p(x0)} ${p(y0 + ry)}`,
    `C${p(x0)} ${p(y0 + ry - ry * K)} ${p(x0 + rx - rx * K)} ${p(y0)} ${p(x0 + rx)} ${p(y0)}Z`,
  ].join(' ');
}

const RAIL = 34;   // rail thickness
/** Aurora colours blended over every table's own felt: green, cyan, violet, pink (the fifth ribbon uses the table's accent). */
const AURORA = ['#36f5a8', '#2ad4ff', '#a85cff', '#ff5ecf'];

export function TableShape({ scale = 1, emblem = true }: { scale?: number; emblem?: boolean } = {}) {
  const k = scale, R = RAIL * scale;
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (n: string) => `${uid}${n}`;
  const u = (n: string) => `url(#${uid}${n})`;
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  let svg = null;
  if (size && size.w > 100) {
    const { w: W, h: H } = size;
    const bow = 14 * k;
    // big rounded ends: the corner ellipse takes up to ~45% of the height, so the table reads as an oval
    const ry = Math.min((H - 4) * 0.44, 240 * k), rx = Math.min(ry * 1.35, (W - 2 * bow) * 0.2), arch = 10 * k;
    const outer: Box = { x0: bow + 2, y0: 2 + arch, x1: W - bow - 2, y1: H - 2 - arch * 0.6, rx, ry, bow, arch, nW: 130 * k, nH: 50 * k };
    const inner: Box = { x0: outer.x0 + R, y0: outer.y0 + R, x1: outer.x1 - R, y1: outer.y1 - R, rx: Math.max(10, rx - R * 0.9), ry: Math.max(10, ry - R * 0.9), bow: bow * 0.85, arch: arch * 0.8, nW: 150 * k, nH: 50 * k };
    const cx = W / 2, cy = H / 2 - 2;
    const oPath = outline(outer), iPath = outline(inner);
    // pearl inlays follow the bowed sides of the rail
    const inlay = (left: boolean) => {
      // walk along the bowed side of the outer edge and step half a rail inwards
      const { x0, x1, y0, y1, ry } = outer, side = y1 - y0 - 2 * ry;
      const P = left
        ? [[x0, y1 - ry], [x0 - bow, y1 - ry - side * 0.3], [x0 - bow, y0 + ry + side * 0.3], [x0, y0 + ry]]
        : [[x1, y1 - ry], [x1 + bow, y1 - ry - side * 0.3], [x1 + bow, y0 + ry + side * 0.3], [x1, y0 + ry]];
      const pts: string[] = [];
      for (let i = 0; i <= 12; i++) {
        const t = -0.25 + (i / 12) * 1.5, tt = Math.max(0, Math.min(1, t)), m = 1 - tt;
        let x = m * m * m * P[0][0] + 3 * m * m * tt * P[1][0] + 3 * m * tt * tt * P[2][0] + tt * tt * tt * P[3][0];
        let y = m * m * m * P[0][1] + 3 * m * m * tt * P[1][1] + 3 * m * tt * tt * P[2][1] + tt * tt * tt * P[3][1];
        if (t < 0 || t > 1) { const e = (t < 0 ? -t : t - 1) * ry * 0.9; y += t < 0 ? e : -e; x += (left ? 1 : -1) * e * e / (ry * 1.6); } // follow into the rounded ends
        pts.push(`${(x + (left ? R / 2 : -R / 2)).toFixed(1)} ${y.toFixed(1)}`);
      }
      return `M${pts.join(' L')}`;
    };
    const ip = { x: inner.x0 + 46 * k, y: inner.y0 + 40 * k, w: inner.x1 - inner.x0 - 92 * k, h: inner.y1 - inner.y0 - inner.nH - 64 * k };
    svg = (
      <>
      <svg className="ts-base" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <defs>
          <linearGradient id={id('rl')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--rail-a)' }} />
            <stop offset=".1" style={{ stopColor: 'var(--rail-b)' }} />
            <stop offset=".85" style={{ stopColor: 'var(--rail-b)' }} />
            <stop offset="1" style={{ stopColor: 'var(--rail-c)' }} />
          </linearGradient>
          <linearGradient id={id('sh')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".45" /><stop offset=".12" stopColor="#fff" stopOpacity="0" />
            <stop offset=".8" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".35" />
          </linearGradient>
          <radialGradient id={id('fe')} cx=".5" cy=".42" r=".7">
            <stop offset="0" style={{ stopColor: 'var(--felt-a)' }} />
            <stop offset=".6" style={{ stopColor: 'var(--felt-b)' }} />
            <stop offset="1" style={{ stopColor: 'var(--felt-c)' }} />
          </radialGradient>
          <linearGradient id={id('pe')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" /><stop offset=".35" stopColor="#d7dbe6" /><stop offset=".55" stopColor="#f7f2ff" /><stop offset=".8" stopColor="#aeb4c4" /><stop offset="1" stopColor="#eef0f6" />
          </linearGradient>
          <filter id={id('ck')} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 .22  0 0 0 0 .12  0 0 0 0 .02  0 0 0 -1.6 1.15" result="s" />
            <feComposite in="s" in2="SourceGraphic" operator="in" />
          </filter>
          <filter id={id('gl')} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="6" /></filter>
          {/* aurora ribbons (soft-edged so no blur filter is needed) and the edge flashes */}
          {AURORA.map((c, i) => (
            <radialGradient key={c} id={id(`au${i}`)} cx=".5" cy=".5" r=".5">
              <stop offset="0" stopColor={c} stopOpacity=".85" /><stop offset=".5" stopColor={c} stopOpacity=".5" /><stop offset="1" stopColor={c} stopOpacity="0" />
            </radialGradient>
          ))}
          <radialGradient id={id('au4')} cx=".5" cy=".5" r=".5">
            <stop offset="0" style={{ stopColor: 'var(--felt-line)' }} stopOpacity=".9" /><stop offset="1" style={{ stopColor: 'var(--felt-line)' }} stopOpacity="0" />
          </radialGradient>
          {([['ft', 0, 0, 0, 1, 0.3], ['fr', 1, 0, 0, 0, 0.16], ['fb', 0, 1, 0, 0, 0.3], ['fl', 0, 0, 1, 0, 0.16]] as const).map(([n, x1, y1, x2, y2, reach]) => (
            <linearGradient key={n} id={id(n)} x1={x1} y1={y1} x2={x2} y2={y2}>
              <stop offset="0" stopColor="#ffffff" stopOpacity=".95" />
              <stop offset={reach * 0.3} style={{ stopColor: 'var(--felt-line)' }} stopOpacity=".75" />
              <stop offset={reach} style={{ stopColor: 'var(--felt-glow)' }} stopOpacity="0" />
            </linearGradient>
          ))}
          <clipPath id={id('fc')}><path d={iPath} /></clipPath>
        </defs>

        {/* table edge seen from the front, and the shadow on the floor */}
        <path d={oPath} transform={`translate(0 ${14 * k})`} style={{ fill: 'var(--rail-c)' }} />
        <path d={oPath} transform={`translate(0 ${14 * k})`} fill="#000" opacity=".45" />
        {/* rail: colour, cork grain, light from above */}
        <path d={oPath} fill={u('rl')} />
        <path d={oPath} fill="#000" filter={u('ck')} opacity=".55" />
        <path d={oPath} fill={u('sh')} />
        <path d={oPath} fill="none" style={{ stroke: 'var(--rail-c)' }} strokeWidth="2.5" />
        <path d={oPath} fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.2" transform="translate(0 1.5)" />
        {/* pearl inlays on the sides */}
        {[true, false].map((l) => (
          <g key={String(l)}>
            <path d={inlay(l)} fill="none" stroke="#000" strokeOpacity=".45" strokeWidth={12 * k} strokeLinecap="round" />
            <path d={inlay(l)} fill="none" stroke={u('pe')} strokeWidth={9 * k} strokeLinecap="round" />
          </g>
        ))}
        {/* suit inlays either side of the alcove */}
        {[-1, 1].map((d) => (
          <text key={d} x={cx + d * (outer.nW + 92 * k)} y={outer.y1 - R / 2 + 6} textAnchor="middle" fontSize={20 * k} letterSpacing={5 * k} fill="#000" fillOpacity=".7" stroke="#fff" strokeOpacity=".25" strokeWidth=".6">{d < 0 ? '♠♥♣♦' : '♦♣♥♠'}</text>
        ))}
        {/* groove between rail and felt */}
        <path d={iPath} fill="none" stroke="#000" strokeOpacity=".55" strokeWidth={9 * k} />
        {/* felt */}
        <path d={iPath} fill={u('fe')} />
      </svg>
      {/* moving lights live in their own layer so the textured table underneath is drawn once, not every frame */}
      <svg className="ts-layer ts-fx" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <g clipPath={u('fc')}>
          {/* aurora: slow drifting curtains of green, cyan, violet and pink blended into the felt */}
          <g className="aurora">
            {[
              { x: 0.3, y: 0.32, rx: 0.42, ry: 0.2, r: -16 },
              { x: 0.68, y: 0.4, rx: 0.4, ry: 0.18, r: 12 },
              { x: 0.45, y: 0.68, rx: 0.46, ry: 0.17, r: -8 },
              { x: 0.78, y: 0.72, rx: 0.32, ry: 0.2, r: 20 },
              { x: 0.2, y: 0.62, rx: 0.3, ry: 0.22, r: 6 },
            ].map((a, i) => (
              <g key={i} className={`au au${i}`}>
                <ellipse cx={a.x * W} cy={a.y * H} rx={a.rx * W} ry={a.ry * H} fill={u(`au${i}`)} transform={`rotate(${a.r} ${a.x * W} ${a.y * H})`} />
              </g>
            ))}
          </g>
          {/* light flashing in from the four sides, one after another */}
          <g className="edge-flash">
            <rect className="flash f-top" x={inner.x0 - bow} y={inner.y0} width={inner.x1 - inner.x0 + bow * 2} height={inner.y1 - inner.y0} fill={u('ft')} />
            <rect className="flash f-right" x={inner.x0 - bow} y={inner.y0} width={inner.x1 - inner.x0 + bow * 2} height={inner.y1 - inner.y0} fill={u('fr')} />
            <rect className="flash f-bottom" x={inner.x0 - bow} y={inner.y0} width={inner.x1 - inner.x0 + bow * 2} height={inner.y1 - inner.y0} fill={u('fb')} />
            <rect className="flash f-left" x={inner.x0 - bow} y={inner.y0} width={inner.x1 - inner.x0 + bow * 2} height={inner.y1 - inner.y0} fill={u('fl')} />
          </g>
        </g>
      </svg>
      <svg className="ts-layer ts-top" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <g clipPath={u('fc')}>
          {/* inner raised panel and soft vignette */}
          <path d={iPath} fill="none" stroke="#000" strokeOpacity=".35" strokeWidth={60 * k} filter={u('gl')} />
          <rect x={ip.x} y={ip.y} width={ip.w} height={ip.h} rx={Math.min(inner.ry * 0.9, ip.h / 2)} fill="#000" fillOpacity=".1" stroke="#fff" strokeOpacity=".07" strokeWidth="2" />
          {/* deco emblem: heart above, spade below */}
          {emblem && <>
          <g fill="none" style={{ stroke: 'var(--felt-line)' }} strokeOpacity=".28" strokeWidth="3" strokeLinecap="round">
            {[-1, 1].map((d) => (
              <g key={d}>
                <path d={`M${cx - 190} ${cy + d * 46} L${cx - 70} ${cy + d * 46} Q${cx - 40} ${cy + d * 46} ${cx - 30} ${cy + d * 76}`} />
                <path d={`M${cx + 190} ${cy + d * 46} L${cx + 70} ${cy + d * 46} Q${cx + 40} ${cy + d * 46} ${cx + 30} ${cy + d * 76}`} />
                <path d={`M${cx - 160} ${cy + d * 58} L${cx - 76} ${cy + d * 58} M${cx + 160} ${cy + d * 58} L${cx + 76} ${cy + d * 58}`} />
              </g>
            ))}
          </g>
          <g style={{ fill: 'var(--felt-line)' }} fillOpacity=".24">
            <path transform={`translate(${cx - 16} ${cy - 104}) scale(.32)`} d="M50 90C30 74 8 58 8 36 8 20 20 10 33 10c8 0 14 5 17 11 3-6 9-11 17-11 13 0 25 10 25 26 0 22-22 38-42 54z" />
            <path transform={`translate(${cx - 16} ${cy + 72}) scale(.32)`} d="M50 6C40 24 10 38 10 60c0 14 12 22 24 20 6-1 11-5 13-9-1 9-5 17-11 23h28c-6-6-10-14-11-23 2 4 7 8 13 9 12 2 24-6 24-20 0-22-30-36-40-54z" />
          </g>
          </>}
        </g>
      </svg>
      {/* neon strip just inside the rail: the whole layer pulses (opacity only, no repaint) */}
      <svg className="ts-layer ts-neon" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <path d={iPath} fill="none" style={{ stroke: 'var(--felt-glow)' }} strokeWidth={12 * k} filter={u('gl')} />
      </svg>
      <svg className="ts-layer ts-lines" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <path d={iPath} fill="none" style={{ stroke: 'var(--felt-line)' }} strokeWidth="3" />
        <path d={iPath} fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="1" />
      </svg>
      </>
    );
  }
  return <div ref={ref} className="table-shape">{svg}</div>;
}
