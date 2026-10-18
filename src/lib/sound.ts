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

// ---------------- Background music: a soft lounge loop made with Web Audio (no files to download) ----------------
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);
// ii–V–I–VI in C, voiced as 7th chords: [bass, ...chord tones]
const CHORDS = [[38, 62, 65, 69, 72], [43, 59, 62, 65, 69], [36, 60, 64, 67, 71], [45, 61, 64, 67, 70]];
const BEAT = 0.55; // seconds per beat (≈ 109 bpm)

class Music {
  private master: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private next = 0;
  private step = 0;
  get playing() { return !!this.timer; }
  start() {
    if (this.timer) return;
    const a = ac(); if (!a) return;
    const filter = a.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 2200;
    this.master = a.createGain();
    this.master.gain.setValueAtTime(0, a.currentTime);
    this.master.gain.linearRampToValueAtTime(0.55, a.currentTime + 2.5);
    this.master.connect(filter).connect(a.destination);
    this.next = a.currentTime + 0.15; this.step = 0;
    this.timer = setInterval(() => this.schedule(), 200);
  }
  stop() {
    if (!this.timer) return;
    clearInterval(this.timer); this.timer = null;
    const a = ac(), m = this.master; this.master = null;
    if (a && m) { m.gain.cancelScheduledValues(a.currentTime); m.gain.setValueAtTime(m.gain.value, a.currentTime); m.gain.linearRampToValueAtTime(0, a.currentTime + 0.6); setTimeout(() => m.disconnect(), 800); }
  }
  private note(freq: number, t: number, dur: number, vol: number, type: OscillatorType, attack = 0.02) {
    const a = ac(); if (!a || !this.master) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  private schedule() {
    const a = ac(); if (!a || !this.master) return;
    if (document.hidden) { this.next = a.currentTime + 0.15; return; }
    while (this.next < a.currentTime + 0.9) {
      const t = this.next, bar = Math.floor(this.step / 4) % CHORDS.length, beat = this.step % 4;
      const [bass, ...tones] = CHORDS[bar];
      if (beat === 0) for (const n of tones) this.note(midi(n), t, BEAT * 4.2, 0.018, 'triangle', 0.35);   // soft pad
      this.note(midi(beat % 2 ? bass + 7 : bass), t, BEAT * 0.9, 0.05, 'sine');                          // walking bass
      if (beat % 2 === 1) this.note(2600, t, 0.05, 0.006, 'square');                                       // light brush tick
      if (Math.random() < 0.38) this.note(midi(tones[Math.floor(Math.random() * tones.length)] + 12), t + (Math.random() < 0.5 ? 0 : BEAT / 2), 0.5, 0.016, 'sine'); // keys
      this.next += BEAT; this.step++;
    }
  }
}
export const music = new Music();
