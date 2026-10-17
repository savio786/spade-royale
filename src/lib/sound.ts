import { profile } from './profile';

let ctx: AudioContext | null = null;
function ac() {
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.08, delay = 0) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = a.currentTime + delay;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.05) {
  const a = ac();
  if (!a) return;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = a.createBufferSource();
  const f = a.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 1800;
  const g = a.createGain(); g.gain.value = vol;
  s.buffer = buf;
  s.connect(f).connect(g).connect(a.destination);
  s.start();
}

const on = () => profile.get().settings.sound;
export const sfx = {
  click: () => on() && tone(660, 0.06, 'triangle', 0.06),
  card: () => on() && noise(0.09, 0.12),
  deal: () => { if (on()) for (let i = 0; i < 6; i++) setTimeout(() => noise(0.05, 0.07), i * 45); },
  turn: () => on() && (tone(880, 0.12, 'sine', 0.07), tone(1320, 0.18, 'sine', 0.05, 0.09)),
  trick: () => on() && tone(520, 0.12, 'triangle', 0.05),
  coins: () => { if (on()) [988, 1319, 1568, 1976].forEach((f, i) => tone(f, 0.14, 'square', 0.03, i * 0.06)); },
  win: () => { if (on()) [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.07, i * 0.13)); },
  lose: () => { if (on()) [392, 330, 262].forEach((f, i) => tone(f, 0.35, 'sine', 0.07, i * 0.16)); },
  chat: () => on() && tone(1200, 0.07, 'sine', 0.04),
};

export function vibrate(ms = 20) {
  if (profile.get().settings.vibrate && 'vibrate' in navigator) try { navigator.vibrate(ms); } catch { /* ignore */ }
}
