import { QAtom, QValue, QVec } from "../q/index";
import { lengthErr, typeErr } from "./convert";

export type Paint = { kind: "none" } | { kind: "one"; css: string } | { kind: "many"; css: string[] };

const clamp255 = (v: number) => (v !== v ? 0 : v < 0 ? 0 : v > 255 ? 255 : v);
export const rgbCss = (r: number, g: number, b: number, a = 255) =>
  a >= 255 ? `rgb(${clamp255(r) | 0},${clamp255(g) | 0},${clamp255(b) | 0})` : `rgba(${clamp255(r) | 0},${clamp255(g) | 0},${clamp255(b) | 0},${(clamp255(a) / 255).toFixed(3)})`;

const NAMED: Record<string, string> = {
  // Qanvas palette (tuned to look good on both themes)
  ink: "#1d1b26", paper: "#f6f1e7", night: "#0f1020", cream: "#f3ead7", coral: "#ff6b5b", tangerine: "#ff9f1c",
  lemon: "#ffd23f", mint: "#3ddc97", teal: "#12a4a4", sky: "#4cc9f0", azure: "#3a86ff", indigo: "#5b5bd6",
  violet: "#9b5de5", rose: "#f15bb5", slate: "#6c7086", fog: "#c9c3b6", q: "#1e5cff", kx: "#0080ff",
};

export function namedColor(name: string): string {
  return NAMED[name] ?? name;
}

function one(x: QValue): string | null {
  if (x instanceof QAtom) {
    if (x.t === -11) return x.v === "none" ? null : namedColor(x.v);
    if (x.t === -10) return x.v;
    if (typeof x.v === "number") return rgbCss(x.v, x.v, x.v);
  }
  if (x instanceof QVec) {
    if (x.t === 10) return x.d as string;
    if (x.t > 0 && x.t !== 11) {
      const d = x.d as Float64Array;
      if (d.length === 1) return rgbCss(d[0], d[0], d[0]);
      if (d.length === 2) return rgbCss(d[0], d[0], d[0], d[1]);
      if (d.length === 3) return rgbCss(d[0], d[1], d[2]);
      if (d.length === 4) return rgbCss(d[0], d[1], d[2], d[3]);
    }
  }
  return undefined as unknown as string;
}

/** Parse a q colour value (one colour, or one per shape). */
export function paint(x: QValue): Paint {
  if (x instanceof QAtom && x.t === -11 && x.v === "none") return { kind: "none" };
  if (x instanceof QVec && x.t === 11) return { kind: "many", css: (x.d as string[]).map(namedColor) };
  if (x instanceof QVec && x.t > 0 && x.t !== 10 && x.t !== 11 && x.d.length > 4) {
    throw lengthErr(
      `A colour is 1 number (gray), 3 numbers (r g b) or 4 (r g b a) — got ${x.d.length}. For one gray per shape use gray x.`,
    );
  }
  const s = one(x);
  if (s === null) return { kind: "none" };
  if (s !== undefined) return { kind: "one", css: s };
  if (x instanceof QVec && x.t === 0) {
    const rows = x.d as QValue[];
    // per-shape strings
    if (rows.every((r) => (r instanceof QVec && r.t === 10) || (r instanceof QAtom && (r.t === -11 || r.t === -10))))
      return { kind: "many", css: rows.map((r) => one(r) ?? "transparent") };
    // SoA rows: (rs;gs;bs) or (rs;gs;bs;as) — atoms broadcast
    if (rows.length === 3 || rows.length === 4 || rows.length === 2) {
      let n = -1;
      for (const r of rows) if (r instanceof QVec) {
        if (n >= 0 && r.d.length !== n) throw lengthErr("Colour rows (r;g;b) must have the same length.");
        n = r.d.length;
      }
      if (n >= 0) {
        const get = (r: QValue) => (r instanceof QAtom ? () => r.v as number : (i: number) => ((r as QVec).d as Float64Array)[i]);
        const gs = rows.map(get);
        const css = new Array<string>(n);
        if (rows.length === 2) for (let i = 0; i < n; i++) css[i] = rgbCss(gs[0](i), gs[0](i), gs[0](i), gs[1](i));
        else for (let i = 0; i < n; i++) css[i] = rgbCss(gs[0](i), gs[1](i), gs[2](i), rows.length === 4 ? gs[3](i) : 255);
        return { kind: "many", css };
      }
    }
    // list of rgb triples (one per shape)
    if (rows.every((r) => r instanceof QVec && r.t > 0 && r.t !== 11 && (r.d.length === 3 || r.d.length === 4)))
      return { kind: "many", css: rows.map((r) => one(r)!) };
  }
  throw typeErr("That isn't a colour. Try 255 (gray), 255 0 0 (r g b), `coral (a name) or \"#ff8800\".");
}

// ---------- colour maps ----------
// Stops from matplotlib's perceptually uniform maps (CC0) and a few creative ones.
const MAPS: Record<string, number[][]> = {
  viridis: [[68, 1, 84], [72, 40, 120], [62, 74, 137], [49, 104, 142], [38, 130, 142], [31, 158, 137], [53, 183, 121], [109, 205, 89], [180, 222, 44], [253, 231, 37]],
  magma: [[0, 0, 4], [28, 16, 68], [79, 18, 123], [129, 37, 129], [181, 54, 122], [229, 80, 100], [251, 135, 97], [254, 194, 135], [252, 253, 191]],
  inferno: [[0, 0, 4], [31, 12, 72], [85, 15, 109], [136, 34, 106], [186, 54, 85], [227, 89, 51], [249, 140, 10], [249, 201, 50], [252, 255, 164]],
  plasma: [[13, 8, 135], [84, 2, 163], [139, 10, 165], [185, 50, 137], [219, 92, 104], [244, 136, 73], [254, 188, 43], [240, 249, 33]],
  ocean: [[3, 7, 30], [2, 62, 125], [0, 119, 182], [0, 180, 216], [144, 224, 239], [202, 240, 248]],
  fire: [[0, 0, 0], [120, 0, 0], [220, 40, 0], [255, 140, 0], [255, 220, 80], [255, 255, 255]],
  ice: [[4, 6, 19], [37, 38, 80], [59, 76, 139], [62, 120, 165], [83, 164, 186], [142, 205, 208], [232, 250, 253]],
  gray: [[0, 0, 0], [255, 255, 255]],
  rainbow: [[110, 64, 170], [191, 60, 175], [254, 75, 131], [255, 120, 71], [226, 183, 47], [175, 240, 91], [82, 246, 103], [29, 223, 163], [35, 171, 216], [76, 110, 219], [110, 64, 170]],
};

export const COLORMAPS = Object.keys(MAPS);

export function colormapLUT(name: string): Uint8ClampedArray {
  const stops = MAPS[name];
  if (!stops) throw typeErr(`Unknown colour map \`${name}. Try: ${COLORMAPS.map((m) => "`" + m).join(" ")}.`);
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * (stops.length - 1);
    const k = Math.min(stops.length - 2, Math.floor(t));
    const f = t - k;
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = stops[k][c] + (stops[k + 1][c] - stops[k][c]) * f;
  }
  return lut;
}

/** HSB (all 0..1, hue wraps) to RGB 0..255 */
export function hsb2rgb(h: number, s: number, b: number): [number, number, number] {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = b * (1 - s), q = b * (1 - f * s), t = b * (1 - (1 - f) * s);
  const [r, g, bb] = [[b, t, p], [q, b, p], [p, b, t], [p, q, b], [t, p, b], [b, p, q]][i % 6];
  return [r * 255, g * 255, bb * 255];
}
