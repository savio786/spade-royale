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

// ---------------- Background music: six original tracks, played live with Web Audio (no files to download) ----------------
// Every track was composed for Spade Haven. Each one is a 16-bar form: an 8-bar melody hook, then 8 bars of groove
// with a light riff, then it loops. Players pick a track in the table menu or in Settings.
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);
type Note = [number, number, number, number];            // [bar, 16th step, midi note, length in 16ths]
type Drums = 'lounge' | 'brush' | 'disco' | 'reggae' | 'shuffle' | 'bossa';
type LeadT = 'square' | 'vibes' | 'saw' | 'marimba' | 'brass' | 'flute';
type KeysT = 'ep' | 'pad' | 'organ' | 'pluck' | 'brass';
interface Song {
  id: string; name: string; mood: string; bpm: number; swing: number;
  chords: number[][];                                     // four chords: [bass, ...voicing]
  drums: Drums; bass: [number, number, number][] | 'walk' | 'octaves'; keys: KeysT; stabs: number[]; pad: boolean;
  lead: LeadT; hook: Note[];
}
/** 4-bar hooks are played twice; the second time the last bar resolves on a long note. */
const twice = (h: Note[], res: number): Note[] => [...h, ...h.filter(([b]) => b < 3).map(([b, s, n, l]): Note => [b + 4, s, n, l]), [7, 0, res, 12]];
const LOUNGE_BASS: [number, number, number][] = [[0, 0, 3], [3, 0, 1], [6, 12, 2], [8, 7, 2], [10, 0, 1], [11, 12, 1], [14, -1, 2]];

export const SONGS: Song[] = [
  { id: 'theme', name: 'Spade Haven Theme', mood: 'Lounge groove', bpm: 98, swing: 0.18, drums: 'lounge', bass: LOUNGE_BASS, keys: 'ep', stabs: [6, 14], pad: true, lead: 'square',
    chords: [[38, 65, 69, 72, 76], [43, 65, 71, 76], [46, 62, 65, 69, 72], [45, 61, 67, 70]],
    hook: [
      [0, 0, 69, 2], [0, 3, 72, 1], [0, 4, 74, 2], [0, 7, 72, 1], [0, 8, 69, 3], [0, 12, 67, 2], [0, 14, 69, 2],
      [1, 2, 74, 2], [1, 4, 77, 2], [1, 6, 76, 1], [1, 7, 74, 1], [1, 8, 71, 4], [1, 13, 69, 1], [1, 14, 67, 2],
      [2, 0, 77, 3], [2, 3, 74, 1], [2, 4, 77, 2], [2, 6, 79, 2], [2, 8, 81, 4], [2, 12, 79, 2], [2, 14, 77, 2],
      [3, 0, 76, 2], [3, 2, 73, 2], [3, 4, 76, 2], [3, 6, 79, 2], [3, 8, 81, 6],
      [4, 0, 74, 1], [4, 2, 77, 1], [4, 4, 81, 2], [4, 7, 79, 1], [4, 8, 77, 2], [4, 10, 76, 1], [4, 11, 74, 1], [4, 12, 72, 2], [4, 14, 74, 2],
      [5, 2, 71, 2], [5, 4, 74, 1], [5, 6, 77, 2], [5, 8, 76, 2], [5, 10, 74, 2], [5, 12, 71, 4],
      [6, 0, 74, 2], [6, 2, 77, 2], [6, 4, 82, 3], [6, 8, 81, 2], [6, 10, 79, 2], [6, 12, 77, 4],
      [7, 0, 76, 2], [7, 2, 79, 1], [7, 3, 77, 1], [7, 4, 76, 2], [7, 6, 73, 2], [7, 8, 74, 8],
    ] },
  { id: 'velvet', name: 'Velvet Night', mood: 'Smooth late-night jazz', bpm: 76, swing: 0.3, drums: 'brush', bass: 'walk', keys: 'ep', stabs: [6, 14], pad: true, lead: 'vibes',
    chords: [[41, 64, 69, 72, 76], [40, 62, 67, 71, 74], [38, 60, 65, 69, 72], [43, 59, 62, 65, 71]],
    hook: twice([
      [0, 0, 76, 4], [0, 4, 77, 2], [0, 6, 76, 2], [0, 8, 72, 6], [0, 14, 69, 2],
      [1, 0, 71, 4], [1, 4, 74, 2], [1, 6, 72, 2], [1, 8, 71, 4], [1, 12, 67, 4],
      [2, 0, 69, 2], [2, 2, 72, 2], [2, 4, 77, 4], [2, 8, 76, 2], [2, 10, 74, 2], [2, 12, 72, 4],
      [3, 0, 71, 3], [3, 3, 74, 1], [3, 4, 77, 4], [3, 8, 76, 4], [3, 12, 74, 4],
    ], 71) },
  { id: 'neon', name: 'Neon Vegas', mood: 'Fast retro synth', bpm: 118, swing: 0, drums: 'disco', bass: 'octaves', keys: 'pad', stabs: [], pad: true, lead: 'saw',
    chords: [[45, 69, 72, 76], [41, 69, 72, 77], [48, 67, 72, 76], [43, 67, 71, 74]],
    hook: twice([
      [0, 0, 76, 2], [0, 2, 76, 2], [0, 4, 79, 2], [0, 6, 76, 2], [0, 8, 74, 2], [0, 10, 72, 2], [0, 12, 74, 4],
      [1, 0, 72, 2], [1, 2, 72, 2], [1, 4, 76, 2], [1, 6, 72, 2], [1, 8, 69, 4], [1, 12, 72, 4],
      [2, 0, 79, 2], [2, 2, 79, 2], [2, 4, 81, 2], [2, 6, 79, 2], [2, 8, 76, 2], [2, 10, 79, 2], [2, 12, 84, 4],
      [3, 0, 83, 4], [3, 4, 81, 2], [3, 6, 79, 2], [3, 8, 74, 8],
    ], 79) },
  { id: 'island', name: 'Island Breeze', mood: 'Sunny tropical', bpm: 92, swing: 0.1, drums: 'reggae', bass: [[0, 0, 3], [3, 7, 1], [6, 12, 2], [10, 7, 2], [12, 0, 2], [14, 4, 2]], keys: 'organ', stabs: [4, 12], pad: false, lead: 'marimba',
    chords: [[48, 64, 67, 72], [45, 64, 69, 72], [41, 65, 69, 72], [43, 62, 67, 71]],
    hook: twice([
      [0, 0, 72, 2], [0, 2, 76, 2], [0, 4, 79, 3], [0, 7, 76, 1], [0, 8, 77, 2], [0, 10, 76, 2], [0, 12, 72, 4],
      [1, 0, 69, 2], [1, 2, 72, 2], [1, 4, 76, 4], [1, 8, 74, 2], [1, 10, 72, 2], [1, 12, 69, 4],
      [2, 0, 77, 2], [2, 2, 81, 2], [2, 4, 84, 3], [2, 7, 81, 1], [2, 8, 79, 2], [2, 10, 77, 2], [2, 12, 76, 4],
      [3, 0, 74, 2], [3, 2, 77, 2], [3, 4, 79, 4], [3, 8, 74, 2], [3, 10, 71, 2], [3, 12, 67, 4],
    ], 74) },
  { id: 'roller', name: 'High Roller', mood: 'Swinging big-band blues', bpm: 126, swing: 0.33, drums: 'shuffle', bass: 'walk', keys: 'brass', stabs: [6, 14], pad: false, lead: 'brass',
    chords: [[46, 62, 65, 68], [39, 61, 67, 70], [46, 62, 65, 68], [41, 63, 69, 72]],
    hook: twice([
      [0, 0, 70, 2], [0, 2, 73, 2], [0, 4, 74, 2], [0, 6, 77, 2], [0, 8, 74, 4], [0, 12, 70, 4],
      [1, 0, 79, 2], [1, 2, 77, 2], [1, 4, 75, 2], [1, 6, 73, 2], [1, 8, 70, 6],
      [2, 0, 77, 3], [2, 3, 77, 1], [2, 4, 80, 2], [2, 6, 77, 2], [2, 8, 73, 2], [2, 10, 74, 2], [2, 12, 70, 4],
      [3, 0, 72, 2], [3, 2, 75, 2], [3, 4, 77, 4], [3, 8, 75, 2], [3, 10, 72, 2], [3, 12, 69, 4],
    ], 70) },
  { id: 'bossa', name: 'Midnight Bossa', mood: 'Gentle bossa nova', bpm: 84, swing: 0, drums: 'bossa', bass: [[0, 0, 5], [6, 7, 2], [8, 0, 5], [14, 7, 2]], keys: 'pluck', stabs: [0, 3, 6, 8, 11, 14], pad: false, lead: 'flute',
    chords: [[38, 60, 64, 65, 69], [43, 59, 64, 65], [48, 62, 64, 67, 71], [45, 61, 65, 67]],
    hook: twice([
      [0, 0, 69, 4], [0, 4, 72, 2], [0, 6, 74, 2], [0, 8, 76, 6], [0, 14, 74, 2],
      [1, 0, 72, 4], [1, 4, 71, 2], [1, 6, 72, 2], [1, 8, 74, 8],
      [2, 0, 71, 4], [2, 4, 72, 2], [2, 6, 74, 2], [2, 8, 79, 4], [2, 12, 76, 4],
      [3, 0, 73, 4], [3, 4, 76, 2], [3, 6, 79, 2], [3, 8, 77, 4], [3, 12, 76, 4],
    ], 74) },
];
export const songById = (id?: string) => SONGS.find((x) => x.id === id) ?? SONGS[0];

class Music {
  private master: GainNode | null = null;
  private bus: { drums: GainNode; inst: GainNode; lead: GainNode } | null = null;
  private hiss: AudioBuffer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private next = 0;
  private step = 0;
  private song: Song = SONGS[0];
  /** true while the player is at a table (music keeps playing there); previews elsewhere stop by themselves */
  atTable = false;
  get playing() { return !!this.timer; }
  get current() { return this.song.id; }
  start(id?: string) {
    const want = songById(id ?? this.song.id);
    if (this.timer && want.id === this.song.id) return;
    if (this.timer) this.stop(0.35);
    this.song = want;
    const a = ac(); if (!a) return;
    const comp = a.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2;
    this.master = a.createGain();
    this.master.gain.setValueAtTime(0, a.currentTime);
    this.master.gain.linearRampToValueAtTime(0.42, a.currentTime + 1.6);
    this.master.connect(comp).connect(a.destination);
    const drums = a.createGain(); drums.gain.value = 0.9; drums.connect(this.master);
    const inst = a.createGain(); inst.gain.value = 0.8; inst.connect(this.master);
    const lead = a.createGain(); lead.gain.value = 0.55; lead.connect(this.master);
    const echo = a.createDelay(1); echo.delayTime.value = this.six() * 3;                  // dotted-eighth echo on the lead
    const fb = a.createGain(); fb.gain.value = 0.3; const wet = a.createGain(); wet.gain.value = 0.26;
    const tone = a.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2400;
    lead.connect(echo); echo.connect(tone).connect(fb).connect(echo); tone.connect(wet).connect(this.master);
    this.bus = { drums, inst, lead };
    if (!this.hiss) { const n = Math.floor(a.sampleRate * 0.5); this.hiss = a.createBuffer(1, n, a.sampleRate); const d = this.hiss.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    this.next = a.currentTime + 0.12; this.step = 0;
    this.timer = setInterval(() => this.schedule(), 100);
  }
  stop(fade = 0.6) {
    if (this.previewTimer) { clearTimeout(this.previewTimer); this.previewTimer = null; }
    if (!this.timer) return;
    clearInterval(this.timer); this.timer = null;
    const a = ac(), m = this.master; this.master = null; this.bus = null;
    if (a && m) { m.gain.cancelScheduledValues(a.currentTime); m.gain.setValueAtTime(m.gain.value, a.currentTime); m.gain.linearRampToValueAtTime(0, a.currentTime + fade); setTimeout(() => m.disconnect(), fade * 1000 + 200); }
  }
  /** Play a track: at a table it keeps playing; elsewhere (Settings) it's a 12-second preview. */
  preview(id: string) {
    this.start(id);
    if (this.atTable) return;
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => { if (!this.atTable) this.stop(1.2); }, 12000);
  }
  private six() { return 60 / this.song.bpm / 4; }
  // ---- drums ----
  private kick(t: number, v = 1) {
    const a = ac()!, o = a.createOscillator(), g = a.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.85 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.bus!.drums); o.start(t); o.stop(t + 0.32);
  }
  private noiseHit(t: number, dur: number, vol: number, type: BiquadFilterType, freq: number, q = 1, attack = 0) {
    const a = ac()!, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = this.hiss; f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (attack) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); } else g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.bus!.drums); s.start(t, Math.random() * 0.3); s.stop(t + dur + 0.02);
  }
  private clap(t: number, v = 1) { [0, 0.012, 0.024].forEach((d) => this.noiseHit(t + d, 0.09, 0.32 * v, 'bandpass', 1600, 1.4)); this.noiseHit(t + 0.03, 0.22, 0.12 * v, 'bandpass', 1300, 0.8); }
  private snare(t: number, v = 1) { this.noiseHit(t, 0.16, 0.26 * v, 'bandpass', 2400, 0.7); this.tone(185, t, 0.08, 0.12 * v, 'triangle', this.bus!.drums); }
  private hat(t: number, open = false, v = 1) { this.noiseHit(t, open ? 0.24 : 0.045, (open ? 0.1 : 0.075) * v, 'highpass', 7600); }
  private ride(t: number, v = 1) { this.noiseHit(t, 0.3, 0.05 * v, 'bandpass', 6200, 2.5); this.tone(midi(100), t, 0.25, 0.006 * v, 'sine', this.bus!.drums); }
  private brush(t: number, v = 1) { this.noiseHit(t, 0.32, 0.07 * v, 'bandpass', 3200, 0.6, 0.04); }
  private rim(t: number, v = 1) { this.noiseHit(t, 0.035, 0.22 * v, 'bandpass', 3800, 6); this.tone(1700, t, 0.03, 0.05 * v, 'square', this.bus!.drums); }
  private shaker(t: number, v = 1) { this.noiseHit(t, 0.07, 0.035 * v, 'highpass', 6000, 1, 0.02); }
  private tone(freq: number, t: number, dur: number, vol: number, type: OscillatorType, out: AudioNode) {
    const a = ac()!, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  private drums(st: number, bar: number, t: number, ts: number) {
    switch (this.song.drums) {
      case 'lounge':
        if (st === 0 || st === 8 || (st === 10 && bar % 2 === 1)) this.kick(t, st === 0 ? 1 : 0.85);
        if (st === 4 || st === 12) this.clap(t);
        if (st % 2 === 0) this.hat(ts, st === 14 && bar % 4 === 3, st % 4 === 2 ? 1 : 0.6);
        break;
      case 'brush':
        if (st === 0 || (st === 10 && bar % 2 === 1)) this.kick(t, 0.55);
        if (st === 4 || st === 12) this.brush(t, 1.1);
        if (st % 4 === 0 || st % 4 === 2 && (st === 6 || st === 14)) this.ride(ts, st % 8 === 0 ? 1 : 0.7);
        break;
      case 'disco':
        if (st % 4 === 0) this.kick(t, st === 0 ? 1 : 0.9);
        if (st === 4 || st === 12) this.clap(t, 1.1);
        if (st % 4 === 2) this.hat(t, true, 0.9); else this.hat(t, false, 0.45);
        break;
      case 'reggae':
        if (st === 8) this.kick(t, 1); if (st === 0 && bar % 2 === 0) this.kick(t, 0.5);
        if (st === 4 || st === 12) this.rim(t);
        this.shaker(ts, st % 2 === 0 ? 1 : 0.6);
        break;
      case 'shuffle':
        if (st === 0 || st === 8) this.kick(t, 0.7);
        if (st === 4 || st === 12) this.snare(t, 0.9);
        if (st % 4 === 0 || st % 4 === 2) this.ride(ts, st % 4 === 0 ? 1 : 0.65);
        if (st === 4 || st === 12) this.hat(t, false, 0.8);
        break;
      case 'bossa':
        if (st === 0 || st === 6 || st === 8 || st === 14) this.kick(t, st % 8 === 0 ? 0.6 : 0.45);
        if ([0, 3, 6, 10, 12].includes(st)) this.rim(t, 0.7);
        if (st % 2 === 0) this.shaker(t, st % 4 === 2 ? 1 : 0.6);
        break;
    }
  }
  // ---- bass ----
  private bassNote(n: number, t: number, len: number) {
    const a = ac()!, o = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain(), six = this.six();
    const round = this.song.drums === 'brush' || this.song.drums === 'shuffle' || this.song.drums === 'bossa';  // upright-style bass
    o.type = round ? 'triangle' : 'sawtooth'; o.frequency.value = midi(n);
    f.type = 'lowpass'; f.Q.value = round ? 1 : 6; f.frequency.setValueAtTime(round ? 900 : 1100, t); f.frequency.exponentialRampToValueAtTime(round ? 300 : 180, t + 0.18);
    const d = Math.max(0.12, len * six * 0.92), v = round ? 0.36 : 0.32;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.008); g.gain.setValueAtTime(v * 0.8, t + d * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(f).connect(g).connect(this.bus!.inst); o.start(t); o.stop(t + d + 0.02);
  }
  private bass(st: number, bar: number, t: number) {
    const ch = this.song.chords[bar % 4], root = ch[0], nextRoot = this.song.chords[(bar + 1) % 4][0];
    const third = ch.slice(1).map((n) => (n - root) % 12).includes(3) ? 3 : 4;
    const b = this.song.bass;
    if (b === 'walk') { if (st % 4 === 0) this.bassNote([root, root + third, root + 7, nextRoot + (nextRoot > root ? -1 : 1)][st / 4], t, 4); return; }
    if (b === 'octaves') { if (st % 2 === 0) this.bassNote(root + (st % 4 === 2 ? 12 : 0), t, 2); return; }
    for (const [bs, iv, len] of b) if (bs === st) this.bassNote(iv === -1 ? nextRoot - 1 + 12 : root + iv, t, len);
  }
  // ---- chords ----
  private keys(notes: number[], t: number, dur: number, vol: number) {
    const a = ac()!, kind = this.song.keys;
    for (const n of notes) {
      const parts: [OscillatorType, number, number][] = kind === 'ep' ? [['sine', 1, 1], ['triangle', 2, 0.18]]
        : kind === 'pad' ? [['sawtooth', 1, 0.35], ['sawtooth', 1.005, 0.35]]
        : kind === 'organ' ? [['sine', 1, 0.8], ['sine', 2, 0.4], ['sine', 3, 0.2]]
        : kind === 'pluck' ? [['triangle', 1, 1], ['sine', 2, 0.3]]
        : [['sawtooth', 1, 0.5], ['square', 0.5, 0.15]];                                      // brass section
      for (const [type, mul, v] of parts) {
        const o = a.createOscillator(), g = a.createGain(), f = a.createBiquadFilter();
        o.type = type; o.frequency.value = midi(n) * mul; o.detune.value = (Math.random() - 0.5) * 8;
        f.type = 'lowpass'; f.frequency.value = kind === 'pad' ? 1400 : kind === 'brass' ? 2600 : 5000;
        const att = kind === 'pad' ? 0.25 : kind === 'brass' ? 0.02 : 0.006;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * v, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(f).connect(g).connect(this.bus!.inst); o.start(t); o.stop(t + dur + 0.02);
      }
    }
  }
  // ---- lead ----
  private lead(n: number, t: number, len: number) {
    const a = ac()!, kind = this.song.lead, d = len * this.six() * 0.95;
    const f = a.createBiquadFilter(), g = a.createGain(); f.type = 'lowpass';
    const oscs: OscillatorNode[] = [];
    const add = (type: OscillatorType, mul: number, det = 0, v = 1) => { const o = a.createOscillator(), og = a.createGain(); o.type = type; o.frequency.value = midi(n) * mul; o.detune.value = det; og.gain.value = v; o.connect(og).connect(f); oscs.push(o); return o; };
    let peak = 0.11, sustain = 0.09, release = 0.08, vib = 4;
    if (kind === 'square') { add('square', 1); add('triangle', 2, 6, 0.6); f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(1500, t + 0.25); }
    else if (kind === 'saw') { add('sawtooth', 1, -7); add('sawtooth', 1, 7); f.frequency.setValueAtTime(4200, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.3); peak = 0.08; sustain = 0.065; }
    else if (kind === 'vibes') { add('sine', 1); add('sine', 4, 0, 0.25); f.frequency.value = 6000; peak = 0.16; sustain = 0.04; release = 0.9; vib = 0; }
    else if (kind === 'marimba') { add('sine', 1); add('sine', 4, 0, 0.35); add('triangle', 2, 0, 0.15); f.frequency.value = 5000; peak = 0.17; sustain = 0.008; release = 0.25; vib = 0; }
    else if (kind === 'brass') { add('sawtooth', 1); add('sawtooth', 0.5, 4, 0.4); f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(2800, t + 0.06); f.frequency.exponentialRampToValueAtTime(1600, t + 0.3); peak = 0.085; sustain = 0.07; }
    else { add('sine', 1); add('sine', 2, 0, 0.12); f.frequency.value = 3500; peak = 0.14; sustain = 0.11; vib = 7; }       // flute
    if (vib) { const lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = 5.3; lg.gain.value = vib; lfo.connect(lg); oscs.forEach((o) => lg.connect(o.detune)); oscs.push(lfo); }
    if (kind === 'flute') this.noiseHit(t, 0.12, 0.012, 'bandpass', 2500, 1, 0.03);                                // breath
    const hold = Math.max(0.03, d - 0.05);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + (kind === 'flute' ? 0.05 : 0.012));
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, sustain), t + Math.min(hold, kind === 'vibes' || kind === 'marimba' ? 0.08 : hold));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'vibes' || kind === 'marimba' ? Math.max(d, release) : d + release));
    f.connect(g).connect(this.bus!.lead);
    const end = t + d + Math.max(release, 0.1) + 0.05;
    for (const o of oscs) { o.start(t); o.stop(end); }
  }
  private schedule() {
    const a = ac(); if (!a || !this.master || !this.bus) return;
    if (document.hidden) { this.next = a.currentTime + 0.12; return; }
    const song = this.song, six = this.six();
    while (this.next < a.currentTime + 0.5) {
      const t = this.next, st = this.step % 16, bar = Math.floor(this.step / 16) % 16, chord = song.chords[bar % 4];
      const ts = t + (st % 4 === 2 ? six * song.swing : 0);
      this.drums(st, bar, t, ts);
      this.bass(st, bar, st % 4 === 2 ? ts : t);
      const tones = chord.slice(1);
      if (st === 0 && song.pad) this.keys(tones, t, six * (song.keys === 'pad' ? 15 : 7), song.keys === 'pad' ? 0.03 : 0.035);
      if (song.stabs.includes(st) || (song.drums === 'lounge' && st === 10 && bar % 2 === 0)) this.keys(tones, st % 4 === 2 ? ts : t, six * (song.keys === 'pluck' ? 2.5 : 1.3), song.keys === 'pluck' ? 0.06 : 0.05);
      if (bar < 8) { for (const [b, s, n, len] of song.hook) if (b === bar && s === st) this.lead(n, st % 4 === 2 ? ts : t, len); }
      else if (st % 4 === 2) this.keys([tones[(st / 2 + bar) % tones.length] + 12], ts, six * 2.4, 0.045);
      this.next += six; this.step = (this.step + 1) % (16 * 16);
    }
  }
}
export const music = new Music();
