// One source of truth for the cut: scenes on a 120 BPM grid at 30 fps (1 beat = 15 frames).
import { readFileSync } from "node:fs";

export const FPS = 30;
export const BPM = 120;
export const BEAT = (FPS * 60) / BPM; // 15 frames
export const meta = JSON.parse(readFileSync(new URL("./clips/meta.json", import.meta.url), "utf8"));

const EX = [
  ["ex-swarm", "Swarm"],
  ["ex-golden-spiral", "Golden spiral"],
  ["ex-flow-field", "Flow field"],
  ["ex-mandelbrot", "Mandelbrot"],
  ["ex-a-network-learns", "A network learns"],
  ["ex-ray-tracer", "Ray tracer"],
];

// scene: [id, startBeat, beats, extra] -- every cut on a bar line (4 beats)
// clip playback: frame = from + (f - start) * speed, clamped to the clip.
const raw = [
  ["intro", 0, 8],
  ["home", 8, 8, { clip: "home", from: 0 }],
  ["type", 16, 12, { clip: "type", from: 0 }],
  ["touch", 28, 8, { clip: "touch", from: 0 }],
  ["gallery", 36, 4, { clip: "gallery", from: 0 }],
  ["montage", 40, 12],
  ["lesson", 52, 12, { clip: "lesson", from: 0 }],
  ["dojo", 64, 8, { clip: "dojo", from: 0 }],
  ["duo", 72, 8],
  ["outro", 80, 12],
];

export const scenes = raw.map(([id, b, n, x = {}]) => ({ id, start: b * BEAT, len: n * BEAT, end: (b + n) * BEAT, ...x }));
export const TOTAL = scenes[scenes.length - 1].end + 20; // let the last chord ring a little

// montage: 6 examples x 2 beats
export const montage = EX.map(([clip, title], i) => ({ clip, title, start: scenes.find((s) => s.id === "montage").start + i * 2 * BEAT, len: 2 * BEAT }));

// fit each clip scene's speed so it fills its slot (never slower than 1x unless it has spare frames)
for (const s of scenes) {
  if (!s.clip) continue;
  const n = meta[s.clip]?.frames ?? 0;
  const avail = n - s.from;
  s.speed = Math.max(1, avail / s.len);
  if (s.id === "gallery") s.speed = 1; // only the first 2 seconds (flick through + tap)
}

export const clipFrame = (s, f) => {
  const n = meta[s.clip].frames;
  return Math.min(n - 1, Math.max(0, Math.floor(s.from + (f - s.start) * s.speed)));
};

// sound effects: from the capture event logs, plus scripted ones
export function sfxEvents() {
  const ev = [];
  for (const s of scenes) {
    if (!s.clip) continue;
    for (const e of meta[s.clip].events) {
      const f = s.start + (e.f - s.from) / s.speed;
      if (f >= s.start && f < s.end) ev.push({ type: e.type, f });
    }
  }
  // duo scene plays ref (left) and console (right) clips; take their taps/keys at half volume
  const duo = scenes.find((s) => s.id === "duo");
  for (const c of ["ref", "console"]) {
    const n = meta[c].frames, sp = Math.max(1, n / duo.len);
    for (const e of meta[c].events) {
      const f = duo.start + e.f / sp;
      if (f < duo.end) ev.push({ type: e.type, f, quiet: true });
    }
  }
  for (const s of scenes.slice(1)) ev.push({ type: "whoosh", f: s.start - 7 });
  for (const m of montage) ev.push({ type: "pop", f: m.start });
  // intro: logo circles pop on the beat
  for (let b = 0; b < 4; b++) ev.push({ type: "pop", f: b * BEAT, pitch: b });
  ev.push({ type: "riser", f: 4 * BEAT, len: 4 * BEAT });
  const outro = scenes.find((s) => s.id === "outro");
  ev.push({ type: "impact", f: outro.start });
  ev.push({ type: "sparkle", f: outro.start + 2 });
  return ev.sort((a, b) => a.f - b.f);
}
