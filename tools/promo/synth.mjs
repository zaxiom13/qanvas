// Soundtrack + sound effects, synthesized from scratch and locked to the video timeline.
// 120 BPM synth-pop in C major / A minor (Am F C G), with a drop when the phone arrives.
import { writeFileSync } from "node:fs";
import { FPS, BPM, BEAT, TOTAL, scenes, sfxEvents } from "./timeline.mjs";

const SR = 44100;
const SEC = TOTAL / FPS + 1.5;
const N = Math.ceil(SEC * SR);
const beatSec = 60 / BPM;
const bus = () => [new Float32Array(N), new Float32Array(N)];
const drums = bus(), bass = bus(), music = bus(), fx = bus(), wet = bus();
const duck = new Float32Array(N).fill(1); // kick sidechain for music + bass

let seed = 1234567;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296) * 2 - 1;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

class Biquad {
  constructor(type, f, q = 0.707) { this.type = type; this.q = q; this.z1 = this.z2 = 0; this.set(f); }
  set(f) {
    const w = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR, c = Math.cos(w), a = Math.sin(w) / (2 * this.q);
    let b0, b1, b2;
    if (this.type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (this.type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = a; b1 = 0; b2 = -a; }
    const a0 = 1 + a;
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = (-2 * c) / a0; this.a2 = (1 - a) / a0;
  }
  run(x) { const y = this.b0 * x + this.z1; this.z1 = this.b1 * x - this.a1 * y + this.z2; this.z2 = this.b2 * x - this.a2 * y; return y; }
}

// write a mono voice into a stereo bus with a pan (-1..1)
function voice(b, t0, dur, fn, gain = 1, pan = 0, send = 0) {
  const s0 = Math.floor(t0 * SR), n = Math.floor(dur * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4), gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < n; i++) {
    const k = s0 + i;
    if (k < 0 || k >= N) continue;
    const v = fn(i / SR, i);
    b[0][k] += v * gl; b[1][k] += v * gr;
    if (send) { wet[0][k] += v * gl * send; wet[1][k] += v * gr * send; }
  }
}

// ---------------- instruments ----------------
function kick(t0, g = 1) {
  let ph = 0;
  voice(drums, t0, 0.45, (t) => {
    const f = 42 + 120 * Math.exp(-t * 28);
    ph += (2 * Math.PI * f) / SR;
    return Math.tanh(1.6 * Math.sin(ph) * Math.exp(-t * 7.5)) + (t < 0.004 ? rnd() * 0.5 * (1 - t / 0.004) : 0);
  }, 0.95 * g);
  const s0 = Math.floor(t0 * SR);
  for (let i = 0; i < SR * 0.3; i++) {
    const k = s0 + i; if (k >= N) break;
    const d = 0.35 + 0.65 * Math.min(1, i / (SR * 0.22)) ** 1.5;
    duck[k] = Math.min(duck[k], d);
  }
}
function clap(t0, g = 1) {
  const bp = new Biquad("bp", 1400, 0.9), hp = new Biquad("hp", 500);
  voice(drums, t0, 0.3, (t) => {
    const e = t < 0.03 ? [0, 0.011, 0.022].reduce((a, o) => a + (t >= o ? Math.exp(-(t - o) * 180) : 0), 0) : Math.exp(-(t - 0.03) * 16) * 0.9;
    return hp.run(bp.run(rnd())) * e * 2.2;
  }, 0.5 * g, 0.05, 0.25);
}
function hat(t0, open = false, g = 1, pan = 0.25) {
  const hp = new Biquad("hp", 7500, 0.8);
  voice(drums, t0, open ? 0.25 : 0.06, (t) => hp.run(rnd()) * Math.exp(-t * (open ? 14 : 70)), 0.22 * g, pan);
}
function crash(t0, g = 1) {
  const hp = new Biquad("hp", 4500, 0.6);
  voice(drums, t0, 2.2, (t) => hp.run(rnd()) * Math.exp(-t * 2.2), 0.28 * g, 0, 0.3);
}
function bassNote(t0, m, dur) {
  const lp = new Biquad("lp", 400, 1.4);
  let ph = 0, sub = 0;
  voice(bass, t0, dur, (t) => {
    const f = mtof(m);
    ph = (ph + f / SR) % 1; sub += (2 * Math.PI * f) / SR;
    lp.set(180 + 1500 * Math.exp(-t * 14));
    const env = Math.min(1, t / 0.005) * Math.min(1, (dur - t) / 0.02);
    return (lp.run(2 * ph - 1) * 0.8 + Math.sin(sub) * 0.55) * env;
  }, 0.55);
}
function padChord(t0, notes, dur, g = 1) {
  for (const m of notes) for (const [det, pan] of [[-0.09, -0.6], [0, 0], [0.08, 0.6]]) {
    const lp = new Biquad("lp", 1600, 0.6);
    let ph = 0.5 + 0.5 * rnd();
    voice(music, t0, dur + 0.6, (t) => {
      ph = (ph + mtof(m + det) / SR) % 1;
      const env = Math.min(1, t / 0.25) * (t > dur ? Math.exp(-(t - dur) * 6) : 1);
      return lp.run(2 * ph - 1) * env;
    }, 0.045 * g, pan, 0.35);
  }
}
function pluck(t0, m, g = 1, pan = 0) {
  const lp = new Biquad("lp", 3000, 1.2);
  let ph = 0;
  voice(music, t0, 0.35, (t) => {
    ph = (ph + mtof(m) / SR) % 1;
    lp.set(700 + 4200 * Math.exp(-t * 22));
    return lp.run((ph < 0.5 ? 1 : -1) * 0.7 + (2 * ph - 1) * 0.3) * Math.exp(-t * 9) * Math.min(1, t / 0.002);
  }, 0.17 * g, pan, 0.45);
}
function bell(t0, m, g = 1, pan = 0, b = fx) {
  const f = mtof(m);
  voice(b, t0, 1.6, (t) =>
    (Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 3) +
      0.4 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t * 6) +
      0.2 * Math.sin(2 * Math.PI * f * 5.4 * t) * Math.exp(-t * 10)) * Math.min(1, t / 0.003), 0.22 * g, pan, 0.5);
}

// ---------------- sfx ----------------
const sfx = {
  key(t0, e) {
    const hp = new Biquad("hp", 2500 + rnd() * 600, 0.9);
    const g = e.quiet ? 0.5 : 1;
    voice(fx, t0, 0.04, (t) => hp.run(rnd()) * Math.exp(-t * 260) + 0.4 * Math.sin(2 * Math.PI * 1900 * t) * Math.exp(-t * 400), 0.32 * g, rnd() * 0.3);
  },
  enter(t0, e) {
    const bp = new Biquad("bp", 900, 1.2);
    voice(fx, t0, 0.08, (t) => bp.run(rnd()) * Math.exp(-t * 90) * 2 + 0.5 * Math.sin(2 * Math.PI * 520 * t) * Math.exp(-t * 60), 0.35 * (e.quiet ? 0.6 : 1));
  },
  tap(t0, e) {
    let ph = 0;
    voice(fx, t0, 0.14, (t) => { ph += (2 * Math.PI * (320 + 700 * Math.exp(-t * 60))) / SR; return Math.sin(ph) * Math.exp(-t * 32); }, 0.42 * (e.quiet ? 0.6 : 1));
  },
  pop(t0, e) {
    const base = [72, 76, 79, 84][e.pitch ?? Math.floor(Math.abs(rnd()) * 4)];
    let ph = 0;
    voice(fx, t0, 0.22, (t) => { ph += (2 * Math.PI * mtof(base) * (1 + 0.6 * Math.exp(-t * 50))) / SR; return Math.sin(ph) * Math.exp(-t * 16); }, 0.3, rnd() * 0.5, 0.3);
  },
  whoosh(t0) {
    const bp = new Biquad("bp", 400, 1.1);
    const d = 0.55;
    voice(fx, t0, d, (t) => {
      const x = t / d;
      bp.set(300 + 3800 * Math.sin(Math.PI * x) ** 2);
      return bp.run(rnd()) * Math.sin(Math.PI * x) ** 2 * 1.6;
    }, 0.4, 0);
  },
  riser(t0, e) {
    const d = e.len / FPS, bp = new Biquad("bp", 300, 2);
    voice(fx, t0, d, (t) => { const x = t / d; bp.set(250 + 6000 * x * x); return bp.run(rnd()) * x ** 2 * 2.2; }, 0.35);
  },
  success(t0) {
    [84, 88, 91, 96].forEach((m, i) => bell(t0 + i * 0.07, m, 1, (i - 1.5) * 0.3));
    sfx.sparkle(t0 + 0.2, {});
  },
  sparkle(t0) {
    for (let i = 0; i < 14; i++) bell(t0 + i * 0.045 + Math.abs(rnd()) * 0.02, 96 + [0, 4, 7, 12, 16][i % 5] + (i > 7 ? 12 : 0) - 12, 0.25, rnd() * 0.8);
  },
  impact(t0) {
    kick(t0, 1.2); crash(t0, 1.3);
    const lp = new Biquad("lp", 200);
    voice(fx, t0, 1.4, (t) => lp.run(rnd()) * Math.exp(-t * 3) * 2 + Math.sin(2 * Math.PI * 38 * t) * Math.exp(-t * 2.5), 0.45);
  },
  live() {}, touchdown() {},
};

// ---------------- arrangement ----------------
const CHORDS = [
  { root: 45, notes: [57, 60, 64, 69] }, // Am
  { root: 41, notes: [57, 60, 65, 69] }, // F
  { root: 48, notes: [55, 60, 64, 67] }, // C
  { root: 43, notes: [55, 59, 62, 67] }, // G
];
const bars = Math.ceil(TOTAL / BEAT / 4);
const at = (bar, beat) => (bar * 4 + beat) * beatSec;
const sceneAtBeat = (b) => scenes.find((s) => b * BEAT >= s.start && b * BEAT < s.end)?.id;
const outroBar = scenes.find((s) => s.id === "outro").start / BEAT / 4;
const finalBar = outroBar + 2;
const lessonBeat = scenes.find((s) => s.id === "lesson").start / BEAT;
const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 3, 2, 1, 2];

for (let bar = 0; bar < bars; bar++) {
  const ch = CHORDS[bar % 4];
  const intro = bar < 2, final = bar >= finalBar, breakdown = bar * 4 >= lessonBeat && bar * 4 < lessonBeat + 8;
  if (final) {
    if (bar === finalBar) {
      // last hit: C major, ringing out
      padChord(at(bar, 0), [48, 55, 60, 64, 67, 72], 2.4, 1.4);
      bassNote(at(bar, 0), 36, 1.8);
      kick(at(bar, 0), 1.1); crash(at(bar, 0), 1);
      [72, 76, 79, 84, 88].forEach((m, i) => pluck(at(bar, 0) + i * beatSec / 4, m + 12, 0.9, (i - 2) * 0.35));
    }
    continue;
  }
  padChord(at(bar, 0), ch.notes, 4 * beatSec - 0.05, intro ? 0.9 : breakdown ? 1.1 : 0.8);
  // arp: 16ths
  for (let s = 0; s < 16; s++) {
    if (intro && bar === 0 && s < 8) continue;
    const m = ch.notes[ARP[s] % ch.notes.length] + 12 + (s >= 8 && bar % 2 ? 12 : 0);
    pluck(at(bar, s / 4), m, intro ? 0.8 : 1, s % 2 ? 0.35 : -0.35);
  }
  if (intro) continue;
  // drums
  for (let b = 0; b < 4; b++) {
    if (!breakdown || b === 0) kick(at(bar, b));
    if (b % 2 === 1 && !breakdown) clap(at(bar, b));
    hat(at(bar, b + 0.5), b === 3 && bar % 2 === 1, 1, 0.3);
    if (!breakdown) { hat(at(bar, b + 0.25), false, 0.45, -0.3); hat(at(bar, b + 0.75), false, 0.45, -0.3); }
  }
  // little fill before each scene change
  const nextScene = sceneAtBeat(bar * 4 + 4);
  if (nextScene !== sceneAtBeat(bar * 4 + 3)) for (let s = 12; s < 16; s++) clap(at(bar, s / 4), 0.45 + (s - 12) * 0.12);
  if (bar * 4 === lessonBeat + 8) crash(at(bar, 0), 0.8);
  // bass: pumping 8ths with an octave pop on the offbeats
  for (let e = 0; e < 8; e++) bassNote(at(bar, e / 2), ch.root + (e % 2 && !breakdown ? 12 : 0), beatSec / 2 - 0.02);
}
crash(at(2, 0), 1.2);

for (const e of sfxEvents()) sfx[e.type]?.(e.f / FPS, e);

// ---------------- mix ----------------
// ping-pong delay (3/16) + a short smear for the wet bus
const dl = Math.floor(beatSec * 0.75 * SR);
const wl = new Float32Array(N), wr = new Float32Array(N);
for (let i = 0; i < N; i++) {
  wl[i] = wet[0][i] + (i >= dl ? wr[i - dl] * 0.42 : 0);
  wr[i] = wet[1][i] + (i >= dl ? wl[i - dl] * 0.42 : 0);
}
const lpL = new Biquad("lp", 5000), lpR = new Biquad("lp", 5000);
const out = new Int16Array(N * 2);
let peak = 0;
const mixL = new Float32Array(N), mixR = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const d = duck[i];
  mixL[i] = drums[0][i] * 0.9 + (bass[0][i] + music[0][i]) * d + fx[0][i] * 1.05 + lpL.run(wl[i]) * 0.3;
  mixR[i] = drums[1][i] * 0.9 + (bass[1][i] + music[1][i]) * d + fx[1][i] * 1.05 + lpR.run(wr[i]) * 0.3;
  peak = Math.max(peak, Math.abs(mixL[i]), Math.abs(mixR[i]));
}
const gain = 1.25 / peak;
const fadeOut = SR * 1.2;
for (let i = 0; i < N; i++) {
  const f = i > N - fadeOut ? (N - i) / fadeOut : 1;
  out[2 * i] = Math.tanh(mixL[i] * gain) * 0.92 * f * 32767;
  out[2 * i + 1] = Math.tanh(mixR[i] * gain) * 0.92 * f * 32767;
}
const hdr = Buffer.alloc(44);
hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + out.byteLength, 4); hdr.write("WAVEfmt ", 8);
hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(SR, 24);
hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write("data", 36); hdr.writeUInt32LE(out.byteLength, 40);
writeFileSync("soundtrack.wav", Buffer.concat([hdr, Buffer.from(out.buffer)]));
console.log(`soundtrack.wav ${SEC.toFixed(1)}s, ${sfxEvents().length} sfx, peak ${peak.toFixed(2)}`);
