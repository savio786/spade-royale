// Table & card themes that unlock as players level up. Each viewer sees their own chosen theme.
import type { CSSProperties } from 'react';

export interface Theme {
  id: string;
  name: string;
  level: number;              // unlocks at this player level
  felt: [string, string, string];  // centre → edge
  feltLine: string;           // inner ring
  glow: string;               // outer glow
  rim: string;                // table edge (CSS background)
  rimEdge: string;
  rail?: [string, string, string]; // light, mid, dark tones of the table rail
  panel: string;              // info / score panel fill
  panelLine: string;
  panelText: string;
  cardFace: string;           // card face background
  cardBack: string;           // card back (CSS background)
  cardBackEdge: string;
  suits: { S: string; H: string; D: string; C: string };
  fourColor?: boolean;
}

const CLASSIC = { S: '#141428', H: '#c8102e', D: '#c8102e', C: '#141428' };
const FOUR = { S: '#141428', H: '#d0103a', D: '#1565c0', C: '#1b8a3a' };
const WOOD = 'linear-gradient(180deg, #ffe4a0 0%, #e2ab52 14%, #b9802f 40%, #c99245 62%, #e6b766 82%, #7a4c12 100%)';

const RAIL: [string, string, string] = ['#f8dc98', '#c99543', '#6e440f'];

export const THEMES: Theme[] = [
  { id: 'royal', rail: ['#f8dc98', '#c99543', '#6e440f'], name: 'Royal Purple', level: 1,
    felt: ['#8a4cf2', '#5a24c4', '#3b1394'], feltLine: '#c9a0ff', glow: 'rgba(170,120,255,.7)', rim: WOOD, rimEdge: '#5a3608',
    panel: 'rgba(60,20,140,.45)', panelLine: 'rgba(220,200,255,.6)', panelText: '#e2d6ff',
    cardFace: 'linear-gradient(180deg, #fff, #eeeef4)', cardBack: 'repeating-linear-gradient(45deg, #2a3ad0 0 6px, #1a2390 6px 12px)', cardBackEdge: '#fff', suits: CLASSIC },
  { id: 'emerald', rail: ['#b07644', '#6b3f1f', '#2a170a'], name: 'Emerald', level: 2,
    felt: ['#2fbf71', '#16924f', '#0b5e33'], feltLine: '#9ff0bf', glow: 'rgba(60,220,140,.55)', rim: 'linear-gradient(135deg, #6b3f1f, #3d2210 40%, #7a4a24 60%, #2e1a0c)', rimEdge: '#1c0f06',
    panel: 'rgba(0,60,30,.45)', panelLine: 'rgba(190,255,215,.6)', panelText: '#dcffe9',
    cardFace: 'linear-gradient(180deg, #fffdf6, #f1ecdc)', cardBack: 'repeating-linear-gradient(45deg, #c62828 0 6px, #8e1b1b 6px 12px)', cardBackEdge: '#fff7e0', suits: CLASSIC },
  { id: 'ocean', rail: ['#f6f9fc', '#a9b8c6', '#55677a'], name: 'Ocean', level: 4,
    felt: ['#29b6f6', '#0277bd', '#01416e'], feltLine: '#a6e4ff', glow: 'rgba(60,190,255,.6)', rim: 'linear-gradient(135deg, #e0e7ee, #9fb0c0 40%, #f4f7fa 60%, #7d8fa1)', rimEdge: '#3c4a57',
    panel: 'rgba(0,40,80,.45)', panelLine: 'rgba(180,230,255,.6)', panelText: '#e1f5ff',
    cardFace: 'linear-gradient(180deg, #ffffff, #e6f4fb)', cardBack: 'radial-gradient(circle at 30% 30%, #4fc3f7 0 18%, transparent 19%) 0 0/16px 16px, linear-gradient(160deg, #0288d1, #01579b)', cardBackEdge: '#e1f5fe', suits: FOUR, fourColor: true },
  { id: 'ruby', rail: ['#6a5252', '#2e1c1c', '#0b0606'], name: 'Ruby', level: 6,
    felt: ['#ef4a5f', '#b3123a', '#6d0a24'], feltLine: '#ffb3c1', glow: 'rgba(255,80,110,.6)', rim: 'linear-gradient(135deg, #3a2a2a, #120a0a 45%, #4a3434 60%, #0d0707)', rimEdge: '#000',
    panel: 'rgba(80,0,20,.45)', panelLine: 'rgba(255,200,210,.6)', panelText: '#ffe3e8',
    cardFace: 'linear-gradient(180deg, #fff, #fbeef0)', cardBack: 'repeating-linear-gradient(-45deg, #212121 0 7px, #3a3a3a 7px 14px)', cardBackEdge: '#ffcdd2', suits: CLASSIC },
  { id: 'sunset', rail: ['#ffe39a', '#ff8a65', '#9c4dac'], name: 'Sunset', level: 9,
    felt: ['#ffb74d', '#f4511e', '#8e1e5a'], feltLine: '#ffe0b2', glow: 'rgba(255,150,80,.65)', rim: 'linear-gradient(135deg, #ffe082, #ff8a65 45%, #f8bbd0 60%, #ba68c8)', rimEdge: '#5d1d4a',
    panel: 'rgba(90,20,50,.42)', panelLine: 'rgba(255,230,200,.7)', panelText: '#fff3e0',
    cardFace: 'linear-gradient(180deg, #fffaf2, #ffeedd)', cardBack: 'linear-gradient(160deg, #ff7043, #ec407a 55%, #7e57c2)', cardBackEdge: '#fff3e0', suits: FOUR, fourColor: true },
  { id: 'neon', rail: ['#ff6af2', '#7c4dff', '#0097b2'], name: 'Neon Night', level: 12,
    felt: ['#1c2541', '#0b132b', '#05070f'], feltLine: '#00e5ff', glow: 'rgba(0,229,255,.75)', rim: 'linear-gradient(135deg, #ff00e6, #7c4dff 45%, #00e5ff)', rimEdge: '#0b0b1a',
    panel: 'rgba(0,10,30,.6)', panelLine: 'rgba(0,229,255,.75)', panelText: '#bdf7ff',
    cardFace: 'linear-gradient(180deg, #f7fbff, #e3ecff)', cardBack: 'repeating-linear-gradient(90deg, #ff00e6 0 3px, #120a2a 3px 10px)', cardBackEdge: '#00e5ff', suits: { S: '#111', H: '#e6007a', D: '#0091ea', C: '#00a152' }, fourColor: true },
  { id: 'gold', rail: ['#fff6c2', '#ffc83d', '#8a5200'], name: 'Royal Gold', level: 16,
    felt: ['#3a3a3a', '#1c1c1c', '#070707'], feltLine: '#ffd54f', glow: 'rgba(255,200,61,.65)', rim: 'linear-gradient(135deg, #fff3b0, #ffc83d 40%, #fff1a8 55%, #b06a00)', rimEdge: '#5a3500',
    panel: 'rgba(0,0,0,.45)', panelLine: 'rgba(255,213,79,.75)', panelText: '#fff1c1',
    cardFace: 'linear-gradient(180deg, #fffdf2, #f6ecc8)', cardBack: 'repeating-linear-gradient(45deg, #ffc83d 0 3px, #111 3px 9px)', cardBackEdge: '#ffc83d', suits: { S: '#111', H: '#b8001f', D: '#b8001f', C: '#111' } },
  { id: 'prism', rail: ['#ffffff', '#b39dff', '#3a6ad8'], name: 'Prism', level: 20,
    felt: ['#7c4dff', '#2979ff', '#00bfa5'], feltLine: '#ffffff', glow: 'rgba(255,255,255,.6)', rim: 'linear-gradient(90deg, #ff5252, #ffab40, #ffee58, #69f0ae, #40c4ff, #7c4dff, #ff4081)', rimEdge: '#222',
    panel: 'rgba(20,10,60,.4)', panelLine: 'rgba(255,255,255,.7)', panelText: '#ffffff',
    cardFace: 'linear-gradient(180deg, #ffffff, #f2ecff)', cardBack: 'linear-gradient(135deg, #ff5252, #ffab40, #ffee58, #69f0ae, #40c4ff, #7c4dff)', cardBackEdge: '#fff', suits: { S: '#3d1a8f', H: '#e91e63', D: '#ff6d00', C: '#00897b' }, fourColor: true },
];

export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];
export const unlocked = (level: number) => THEMES.filter((t) => level >= t.level);
/** The chosen theme, or the best unlocked one if the choice isn't unlocked. */
export function activeTheme(chosen: string | null | undefined, level: number) {
  const t = chosen ? themeById(chosen) : null;
  return t && level >= t.level ? t : unlocked(level).slice(-1)[0] ?? THEMES[0];
}
export const newlyUnlocked = (from: number, to: number) => THEMES.filter((t) => t.level > from && t.level <= to);

/** CSS variables applied to the table screen. */
export function themeVars(t: Theme): CSSProperties {
  return {
    '--felt-a': t.felt[0], '--felt-b': t.felt[1], '--felt-c': t.felt[2], '--felt-line': t.feltLine, '--felt-glow': t.glow,
    '--rim': t.rim, '--rim-edge': t.rimEdge,
    '--rail-a': (t.rail ?? RAIL)[0], '--rail-b': (t.rail ?? RAIL)[1], '--rail-c': (t.rail ?? RAIL)[2], '--panel': t.panel, '--panel-line': t.panelLine, '--panel-text': t.panelText,
    '--card-face': t.cardFace, '--card-back': t.cardBack, '--card-back-edge': t.cardBackEdge,
    '--suit-s': t.suits.S, '--suit-h': t.suits.H, '--suit-d': t.suits.D, '--suit-c': t.suits.C,
  } as CSSProperties;
}
