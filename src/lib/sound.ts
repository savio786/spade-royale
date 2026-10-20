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

// ---------------- Background music: "Spade Haven Theme" ----------------
// An original casino-lounge groove composed for the game and played live with Web Audio (no files to download):
// kick, clap and swung hi-hats, a plucky synth bass, electric-piano stabs and a catchy lead hook with echo.
// 16 bars: the hook (A) and its answer (B), then 8 bars of groove with a light keys riff, then it loops.
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);
const BPM = 98;
const SIX = 60 / BPM / 4;           // one 16th note in seconds
// Dm9 – G13 – B♭maj9 – A7♭9: [bass, ...electric-piano voicing]
const CHORDS = [[38, 65, 69, 72, 76], [43, 65, 71, 76], [46, 62, 65, 69, 72], [45, 61, 67, 70]];
// lead melody: [bar 0-7, 16th step, midi note, length in 16ths]
const HOOK: [number, number, number, number][] = [
  [0, 0, 69, 2], [0, 3, 72, 1], [0, 4, 74, 2], [0, 7, 72, 1], [0, 8, 69, 3], [0, 12, 67, 2], [0, 14, 69, 2],
  [1, 2, 74, 2], [1, 4, 77, 2], [1, 6, 76, 1], [1, 7, 74, 1], [1, 8, 71, 4], [1, 13, 69, 1], [1, 14, 67, 2],
  [2, 0, 77, 3], [2, 3, 74, 1], [2, 4, 77, 2], [2, 6, 79, 2], [2, 8, 81, 4], [2, 12, 79, 2], [2, 14, 77, 2],
  [3, 0, 76, 2], [3, 2, 73, 2], [3, 4, 76, 2], [3, 6, 79, 2], [3, 8, 81, 6],
  [4, 0, 74, 1], [4, 2, 77, 1], [4, 4, 81, 2], [4, 7, 79, 1], [4, 8, 77, 2], [4, 10, 76, 1], [4, 11, 74, 1], [4, 12, 72, 2], [4, 14, 74, 2],
  [5, 2, 71, 2], [5, 4, 74, 1], [5, 6, 77, 2], [5, 8, 76, 2], [5, 10, 74, 2], [5, 12, 71, 4],
  [6, 0, 74, 2], [6, 2, 77, 2], [6, 4, 82, 3], [6, 8, 81, 2], [6, 10, 79, 2], [6, 12, 77, 4],
  [7, 0, 76, 2], [7, 2, 79, 1], [7, 3, 77, 1], [7, 4, 76, 2], [7, 6, 73, 2], [7, 8, 74, 8],
];
const BASS: [number, number, number][] = [[0, 0, 3], [3, 0, 1], [6, 12, 2], [8, 7, 2], [10, 0, 1], [11, 12, 1], [14, -1, 2]]; // [step, interval, length]

class Music {
  private master: GainNode | null = null;
  private bus: { drums: GainNode; inst: GainNode; lead: GainNode } | null = null;
  private hiss: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private next = 0;
  private step = 0;
  get playing() { return !!this.timer; }
  start() {
    if (this.timer) return;
    const a = ac(); if (!a) return;
    const comp = a.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2;
    this.master = a.createGain();
    this.master.gain.setValueAtTime(0, a.currentTime);
    this.master.gain.linearRampToValueAtTime(0.42, a.currentTime + 2);
    this.master.connect(comp).connect(a.destination);
    const drums = a.createGain(); drums.gain.value = 0.9; drums.connect(this.master);
    const inst = a.createGain(); inst.gain.value = 0.8; inst.connect(this.master);
    // the lead goes through a dotted-eighth echo
    const lead = a.createGain(); lead.gain.value = 0.55; lead.connect(this.master);
    const echo = a.createDelay(1); echo.delayTime.value = SIX * 3;
    const fb = a.createGain(); fb.gain.value = 0.32; const wet = a.createGain(); wet.gain.value = 0.28;
    const tone = a.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2400;
    lead.connect(echo); echo.connect(tone).connect(fb).connect(echo); tone.connect(wet).connect(this.master);
    this.bus = { drums, inst, lead };
    if (!this.hiss) { const n = Math.floor(a.sampleRate * 0.5); this.hiss = a.createBuffer(1, n, a.sampleRate); const d = this.hiss.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    this.next = a.currentTime + 0.12; this.step = 0;
    this.timer = setInterval(() => this.schedule(), 100);
  }
  stop() {
    if (!this.timer) return;
    clearInterval(this.timer); this.timer = null;
    const a = ac(), m = this.master; this.master = null; this.bus = null;
    if (a && m) { m.gain.cancelScheduledValues(a.currentTime); m.gain.setValueAtTime(m.gain.value, a.currentTime); m.gain.linearRampToValueAtTime(0, a.currentTime + 0.6); setTimeout(() => m.disconnect(), 800); }
  }
  // ---- instruments ----
  private kick(t: number, v = 1) {
    const a = ac()!, o = a.createOscillator(), g = a.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.85 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.bus!.drums); o.start(t); o.stop(t + 0.32);
  }
  private noiseHit(t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, q = 1) {
    const a = ac()!, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = this.hiss; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.bus!.drums); s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
  }
  private clap(t: number) { [0, 0.012, 0.024].forEach((d) => this.noiseHit(t + d, 0.09, 0.32, 'bandpass', 1600, 1.4)); this.noiseHit(t + 0.03, 0.22, 0.12, 'bandpass', 1300, 0.8); }
  private hat(t: number, open = false, v = 1) { this.noiseHit(t, open ? 0.24 : 0.045, (open ? 0.1 : 0.075) * v, 'highpass', 7600); }
  private bass(n: number, t: number, len: number) {
    const a = ac()!, o = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain();
    o.type = 'sawtooth'; o.frequency.value = midi(n);
    f.type = 'lowpass'; f.Q.value = 6; f.frequency.setValueAtTime(1100, t); f.frequency.exponentialRampToValueAtTime(180, t + 0.18);
    const d = Math.max(0.12, len * SIX * 0.92);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.008); g.gain.setValueAtTime(0.26, t + d * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(f).connect(g).connect(this.bus!.inst); o.start(t); o.stop(t + d + 0.02);
  }
  private keys(notes: number[], t: number, dur: number, vol: number) {   // electric piano: sine + soft bell overtone
    const a = ac()!;
    for (const n of notes) for (const [mul, v] of [[1, 1], [2, 0.18]] as const) {
      const o = a.createOscillator(), g = a.createGain();
      o.type = mul === 1 ? 'sine' : 'triangle'; o.frequency.value = midi(n) * mul; o.detune.value = (Math.random() - 0.5) * 8;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.bus!.inst); o.start(t); o.stop(t + dur + 0.02);
    }
  }
  private lead(n: number, t: number, len: number) {   // warm square lead with a little vibrato
    const a = ac()!, o = a.createOscillator(), o2 = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain();
    const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 5.5; lg.gain.value = 4; lfo.connect(lg).connect(o.detune);
    o.type = 'square'; o2.type = 'triangle'; o.frequency.value = midi(n); o2.frequency.value = midi(n) * 2; o2.detune.value = 6;
    f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(1500, t + 0.25); f.Q.value = 2;
    const d = len * SIX * 0.95;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.11, t + 0.015); g.gain.setValueAtTime(0.09, t + Math.max(0.03, d - 0.05)); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.08);
    o.connect(f); o2.connect(f); f.connect(g).connect(this.bus!.lead);
    for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + d + 0.1); }
  }
  private schedule() {
    const a = ac(); if (!a || !this.master || !this.bus) return;
    if (document.hidden) { this.next = a.currentTime + 0.12; return; }
    while (this.next < a.currentTime + 0.5) {
      const t = this.next, st = this.step % 16, bar = Math.floor(this.step / 16) % 16, chord = CHORDS[bar % 4], root = chord[0];
      const swing = st % 4 === 2 ? SIX * 0.18 : 0, ts = t + swing;
      // drums: four-on-the-floor-ish lounge kick, clap on 2 & 4, swung hats, open hat at the end of each 4 bars
      if (st === 0 || st === 8 || (st === 10 && bar % 2 === 1)) this.kick(t, st === 0 ? 1 : 0.85);
      if (st === 4 || st === 12) this.clap(t);
      if (st % 2 === 0) this.hat(ts, st === 14 && bar % 4 === 3, st % 4 === 2 ? 1 : 0.6);
      // bass line
      for (const [bs, iv, len] of BASS) if (bs === st) this.bass(iv === -1 ? CHORDS[(bar + 1) % 4][0] - 1 + 12 : root + iv, ts, len);
      // electric-piano: soft chord on the one, offbeat stabs
      if (st === 0) this.keys(chord.slice(1), t, SIX * 7, 0.035);
      if (st === 6 || st === 14 || (st === 10 && bar % 2 === 0)) this.keys(chord.slice(1), ts, SIX * 1.3, 0.05);
      // the hook for 8 bars, then 8 bars of groove with a light keys riff
      if (bar < 8) { for (const [b, s, n, len] of HOOK) if (b === bar && s === st) this.lead(n, ts, len); }
      else if (st % 4 === 2) { const tones = chord.slice(1); this.keys([tones[(st / 2 + bar) % tones.length] + 12], ts, SIX * 2.4, 0.045); }
      this.next += SIX; this.step = (this.step + 1) % (16 * 16);
    }
  }
}
export const music = new Music();
