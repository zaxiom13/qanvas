// The Qanvas drawing API, exposed to q in the `.qv` namespace (visible unqualified in sketches).
import { Builtin } from "../q/fns";
import {
  NIL, QAtom, QDict, QTable, QValue, QVec, Session, atom, bool, count, float, floats, items, list, long, str, sym, syms,
  inline,
} from "../q/index";
import { Paint, colormapLUT, hsb2rgb, paint } from "./color";
import { lengthErr, nums, num, points, spread, text, texts, typeErr } from "./convert";

/** Everything the API needs from the host renderer. */
export interface Surface {
  ctx(): CanvasRenderingContext2D;
  width: number;
  height: number;
  resize(w: number, h: number): void;
  noise(x: number, y: number, z: number): number;
  noiseSeed(n: number): void;
  setFps(n: number): void;
  stopLoop(): void;
  tone(freq: number, dur: number, type: string, vol: number): void;
  startMic(): void;
  startCamera(w: number, h: number): void;
  log(text: string): void;
}

export interface Style {
  ink: Paint;
  pen: Paint;
  weight: number;
  fontSize: number;
  fontFamily: string;
  align: CanvasTextAlign;
  baseline: CanvasTextBaseline;
  depth: number;
}

export const defaultStyle = (): Style => ({
  ink: { kind: "one", css: "#ffffff" },
  pen: { kind: "none" },
  weight: 1,
  fontSize: 18,
  fontFamily: "Inter Variable, Inter, system-ui, sans-serif",
  align: "left",
  baseline: "alphabetic",
  depth: 0,
});

const FONTS: Record<string, string> = {
  sans: "Inter Variable, Inter, system-ui, sans-serif",
  mono: "JetBrains Mono Variable, JetBrains Mono, ui-monospace, monospace",
  serif: "Georgia, 'Times New Roman', serif",
};

export class Api {
  style: Style = defaultStyle();
  stack: Style[] = [];
  constructor(public s: Surface) {}

  reset() {
    this.style = defaultStyle();
    this.stack = [];
  }

  // ---------- paint helpers ----------
  private fillAt(i: number): string | null {
    const k = this.style.ink;
    if (k.kind === "none") return null;
    if (k.kind === "one") return k.css;
    return k.css[i % k.css.length];
  }
  private strokeAt(i: number): string | null {
    const k = this.style.pen;
    if (k.kind === "none") return null;
    if (k.kind === "one") return k.css;
    return k.css[i % k.css.length];
  }
  private uniform() {
    return this.style.ink.kind !== "many" && this.style.pen.kind !== "many";
  }

  /** Draw n shapes, each traced by `trace(ctx, i)`. Batches into one path when style is uniform. */
  private shapes(n: number, trace: (c: CanvasRenderingContext2D, i: number) => void, closedFill = true) {
    const c = this.s.ctx();
    c.lineWidth = this.style.weight;
    if (this.uniform()) {
      const f = this.fillAt(0), st = this.strokeAt(0);
      if (!f && !st) return;
      c.beginPath();
      for (let i = 0; i < n; i++) trace(c, i);
      if (f && closedFill) {
        c.fillStyle = f;
        c.fill();
      }
      if (st) {
        c.strokeStyle = st;
        c.stroke();
      }
      return;
    }
    for (let i = 0; i < n; i++) {
      const f = this.fillAt(i), st = this.strokeAt(i);
      if (!f && !st) continue;
      c.beginPath();
      trace(c, i);
      if (f && closedFill) {
        c.fillStyle = f;
        c.fill();
      }
      if (st) {
        c.strokeStyle = st;
        c.stroke();
      }
    }
  }

  // ---------- shapes ----------
  circle(p: QValue, r: QValue) {
    if (p instanceof QTable) return this.fromTable(p, "circle");
    const P = points(p, "circle position");
    const n = Math.max(P.n, count(r));
    const xs = spread(P.single ? floats(P.xs) : floats(P.xs), n, "circle position"), ys = spread(floats(P.ys), n, "circle position");
    const rs = spread(r, n, "circle radius");
    this.shapes(n, (c, i) => {
      const rr = Math.abs(rs[i]);
      c.moveTo(xs[i] + rr, ys[i]);
      c.arc(xs[i], ys[i], rr, 0, Math.PI * 2);
    });
  }

  ellipse(p: QValue, r: QValue) {
    const P = points(p, "ellipse position");
    let rx: Float64Array, ry: Float64Array;
    if (r instanceof QAtom) rx = ry = new Float64Array(P.n).fill(num(r, "ellipse radius"));
    else {
      const R = points(r, "ellipse radii");
      rx = R.xs;
      ry = R.ys;
    }
    const n = Math.max(P.n, rx.length);
    const xs = spread(floats(P.xs), n, "ellipse position"), ys = spread(floats(P.ys), n, "ellipse position");
    const RX = spread(floats(rx), n, "ellipse radii"), RY = spread(floats(ry), n, "ellipse radii");
    this.shapes(n, (c, i) => {
      c.moveTo(xs[i] + Math.abs(RX[i]), ys[i]);
      c.ellipse(xs[i], ys[i], Math.abs(RX[i]), Math.abs(RY[i]), 0, 0, Math.PI * 2);
    });
  }

  rect(p: QValue, wh: QValue) {
    if (p instanceof QTable) return this.fromTable(p, "rect");
    const P = points(p, "rect corner");
    let W: Float64Array, H: Float64Array;
    if (wh instanceof QAtom) W = H = Float64Array.of(num(wh, "rect size"));
    else {
      const S = points(wh, "rect size");
      W = S.xs;
      H = S.ys;
    }
    const n = Math.max(P.n, W.length);
    const xs = spread(floats(P.xs), n, "rect corner"), ys = spread(floats(P.ys), n, "rect corner");
    const ws = spread(floats(W), n, "rect width"), hs = spread(floats(H), n, "rect height");
    this.shapes(n, (c, i) => c.rect(xs[i], ys[i], ws[i], hs[i]));
  }

  line(a: QValue, b: QValue) {
    const A = points(a, "line start"), B = points(b, "line end");
    const n = Math.max(A.n, B.n);
    const ax = spread(floats(A.xs), n, "line start"), ay = spread(floats(A.ys), n, "line start");
    const bx = spread(floats(B.xs), n, "line end"), by = spread(floats(B.ys), n, "line end");
    const saved = this.style.ink;
    this.style.ink = { kind: "none" };
    const pen = this.style.pen.kind === "none" ? ({ kind: "one", css: "#ffffff" } as Paint) : null;
    if (pen) this.style.pen = pen;
    try {
      this.shapes(n, (c, i) => {
        c.moveTo(ax[i], ay[i]);
        c.lineTo(bx[i], by[i]);
      }, false);
    } finally {
      this.style.ink = saved;
      if (pen) this.style.pen = { kind: "none" };
    }
  }

  point(p: QValue) {
    const P = points(p, "point");
    const r = Math.max(0.5, this.style.weight / 2);
    const c = this.s.ctx();
    const col = this.strokeAt(0) ?? this.fillAt(0);
    if (this.style.pen.kind === "many" || (this.style.pen.kind === "none" && this.style.ink.kind === "many")) {
      for (let i = 0; i < P.n; i++) {
        c.fillStyle = (this.style.pen.kind !== "none" ? this.strokeAt(i) : this.fillAt(i)) ?? "transparent";
        c.fillRect(P.xs[i] - r, P.ys[i] - r, r * 2, r * 2);
      }
      return;
    }
    if (!col) return;
    c.fillStyle = col;
    if (r <= 1.5) {
      for (let i = 0; i < P.n; i++) c.fillRect(P.xs[i] - r, P.ys[i] - r, r * 2, r * 2);
      return;
    }
    c.beginPath();
    for (let i = 0; i < P.n; i++) {
      c.moveTo(P.xs[i] + r, P.ys[i]);
      c.arc(P.xs[i], P.ys[i], r, 0, Math.PI * 2);
    }
    c.fill();
  }

  /** closed polygon(s) */
  poly(p: QValue, closed: boolean) {
    const polys = this.polyList(p);
    const saved = this.style.ink;
    if (!closed) this.style.ink = { kind: "none" };
    const pen = !closed && this.style.pen.kind === "none" ? ({ kind: "one", css: "#ffffff" } as Paint) : null;
    if (pen) this.style.pen = pen;
    try {
      this.shapes(polys.length, (c, i) => {
        const P = polys[i];
        if (!P.n) return;
        c.moveTo(P.xs[0], P.ys[0]);
        for (let k = 1; k < P.n; k++) c.lineTo(P.xs[k], P.ys[k]);
        if (closed) c.closePath();
      }, closed);
    } finally {
      this.style.ink = saved;
      if (pen) this.style.pen = { kind: "none" };
    }
  }

  curve(p: QValue, closed: boolean) {
    const polys = this.polyList(p);
    const saved = this.style.ink;
    if (!closed) this.style.ink = { kind: "none" };
    const pen = !closed && this.style.pen.kind === "none" ? ({ kind: "one", css: "#ffffff" } as Paint) : null;
    if (pen) this.style.pen = pen;
    try {
      this.shapes(polys.length, (c, i) => {
        const { xs, ys, n } = polys[i];
        if (n < 2) return;
        const at = (k: number) => (closed ? ((k % n) + n) % n : Math.max(0, Math.min(n - 1, k)));
        c.moveTo(xs[0], ys[0]);
        const segs = closed ? n : n - 1;
        for (let k = 0; k < segs; k++) {
          const p0 = at(k - 1), p1 = at(k), p2 = at(k + 1), p3 = at(k + 2);
          c.bezierCurveTo(
            xs[p1] + (xs[p2] - xs[p0]) / 6, ys[p1] + (ys[p2] - ys[p0]) / 6,
            xs[p2] - (xs[p3] - xs[p1]) / 6, ys[p2] - (ys[p3] - ys[p1]) / 6,
            xs[p2], ys[p2],
          );
        }
        if (closed) c.closePath();
      }, closed);
    } finally {
      this.style.ink = saved;
      if (pen) this.style.pen = { kind: "none" };
    }
  }

  private polyList(p: QValue) {
    // a single polygon is (xs;ys); several are a list of those
    if (p instanceof QVec && p.t === 0) {
      const its = p.d as QValue[];
      const isSingle = (its.length === 2 || its.length === 3) && its.every((e) => e instanceof QVec && e.t !== 0);
      if (!isSingle) return its.map((e, i) => points(e, `polygon ${i}`));
    }
    return [points(p, "polygon points")];
  }

  tri(a: QValue, b: QValue, cc: QValue) {
    const A = points(a, "triangle corner"), B = points(b, "triangle corner"), C = points(cc, "triangle corner");
    const n = Math.max(A.n, B.n, C.n);
    const X = [A, B, C].map((P) => spread(floats(P.xs), n, "triangle corner"));
    const Y = [A, B, C].map((P) => spread(floats(P.ys), n, "triangle corner"));
    this.shapes(n, (c, i) => {
      c.moveTo(X[0][i], Y[0][i]);
      c.lineTo(X[1][i], Y[1][i]);
      c.lineTo(X[2][i], Y[2][i]);
      c.closePath();
    });
  }

  arc(p: QValue, r: QValue, ang: QValue) {
    const P = points(p, "arc centre");
    const a = nums(ang, "arc angles");
    const n = Math.max(P.n, count(r));
    const xs = spread(floats(P.xs), n, "arc centre"), ys = spread(floats(P.ys), n, "arc centre"), rs = spread(r, n, "arc radius");
    let a0: Float64Array, a1: Float64Array;
    if (ang instanceof QVec && ang.t === 0) {
      a0 = spread((ang.d as QValue[])[0], n, "arc start");
      a1 = spread((ang.d as QValue[])[1], n, "arc end");
    } else {
      if (a.length !== 2) throw lengthErr("arc angles should be start end in radians, like 0 3.14.");
      a0 = new Float64Array(n).fill(a[0]);
      a1 = new Float64Array(n).fill(a[1]);
    }
    this.shapes(n, (c, i) => {
      c.moveTo(xs[i], ys[i]);
      c.arc(xs[i], ys[i], Math.abs(rs[i]), a0[i], a1[i]);
      c.closePath();
    });
  }

  text(p: QValue, s: QValue, fmt: (v: QValue) => string) {
    const P = points(p, "text position");
    const strs = texts(s, fmt);
    const n = Math.max(P.n, strs.length);
    const xs = spread(floats(P.xs), n, "text position"), ys = spread(floats(P.ys), n, "text position");
    const c = this.s.ctx();
    c.font = `${this.style.fontSize}px ${this.style.fontFamily}`;
    c.textAlign = this.style.align;
    c.textBaseline = this.style.baseline;
    c.lineWidth = this.style.weight;
    for (let i = 0; i < n; i++) {
      const t = strs[i % strs.length];
      const f = this.fillAt(i), st = this.strokeAt(i);
      if (st) {
        c.strokeStyle = st;
        c.strokeText(t, xs[i], ys[i]);
      }
      if (f) {
        c.fillStyle = f;
        c.fillText(t, xs[i], ys[i]);
      }
    }
  }

  private fromTable(t: QTable, shape: "circle" | "rect") {
    const col = (n: string) => {
      const j = t.cols.indexOf(n);
      return j < 0 ? null : t.data[j];
    };
    const p = col("p");
    if (!p) throw typeErr(`A ${shape} table needs a column p of points (one x y pair per row).`);
    const P = flipPairs(p, "p");
    const saved = { ink: this.style.ink, pen: this.style.pen };
    try {
      const ink = col("ink") ?? col("fill");
      const pen = col("pen") ?? col("stroke");
      if (ink) this.style.ink = paint(ink instanceof QVec && ink.t === 0 ? list(items(ink)) : ink);
      if (pen) this.style.pen = paint(pen instanceof QVec && pen.t === 0 ? list(items(pen)) : pen);
      if (shape === "circle") this.circle(P, col("r") ?? float(10));
      else this.rect(P, col("s") ?? col("wh") ?? float(10));
    } finally {
      this.style.ink = saved.ink;
      this.style.pen = saved.pen;
    }
  }

  // ---------- images ----------
  private off: HTMLCanvasElement | OffscreenCanvas | null = null;
  pixels(m: QValue, cmap: string | null, x0 = 0, y0 = 0, w = this.s.width, h = this.s.height) {
    // m: rows of numbers (h x w). Or (r;g;b) of such matrices.
    let rgb: [number[][] | null, Float64Array[] | null] = [null, null];
    void rgb;
    const rowsOf = (v: QValue, what: string): Float64Array[] => {
      if (!(v instanceof QVec) || v.t !== 0) {
        if (v instanceof QVec && v.t > 0) return [nums(v, what)];
        throw typeErr(`${what} should be a matrix: a list of equal-length rows of numbers.`);
      }
      return (v.d as QValue[]).map((r) => nums(r, what));
    };
    let chans: Float64Array[][];
    const isRGB = m instanceof QVec && m.t === 0 && m.d.length === 3 && (m.d as QValue[]).every((e) => e instanceof QVec && e.t === 0);
    if (isRGB) chans = (m.d as QValue[]).map((c, i) => rowsOf(c, `pixels ${"rgb"[i]}`));
    else chans = [rowsOf(m, "pixels")];
    const H = chans[0].length;
    const W = chans[0][0]?.length ?? 0;
    if (!H || !W) return;
    for (const ch of chans) for (const r of ch) if (r.length !== W) throw lengthErr(`pixels: every row must have ${W} values.`);
    const img = new ImageData(W, H);
    const d = img.data;
    if (cmap) {
      // normalise to 0..1 by min/max, then map through the colour map
      let lo = Infinity, hi = -Infinity;
      for (const r of chans[0]) for (let i = 0; i < W; i++) {
        const v = r[i];
        if (v === v && Number.isFinite(v)) {
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      }
      const span = hi > lo ? hi - lo : 1;
      const lut = colormapLUT(cmap);
      for (let y = 0; y < H; y++) {
        const r = chans[0][y];
        for (let x = 0; x < W; x++) {
          const v = r[x];
          const k = v === v && Number.isFinite(v) ? Math.round(((v - lo) / span) * 255) * 3 : 0;
          const o = (y * W + x) * 4;
          d[o] = lut[k];
          d[o + 1] = lut[k + 1];
          d[o + 2] = lut[k + 2];
          d[o + 3] = 255;
        }
      }
    } else {
      // values 0..1 (floats) or 0..255
      const scale = looksUnit(chans) ? 255 : 1;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const o = (y * W + x) * 4;
          if (chans.length === 3) {
            d[o] = chans[0][y][x] * scale;
            d[o + 1] = chans[1][y][x] * scale;
            d[o + 2] = chans[2][y][x] * scale;
          } else d[o] = d[o + 1] = d[o + 2] = chans[0][y][x] * scale;
          d[o + 3] = 255;
        }
      }
    }
    if (!this.off || this.off.width !== W || this.off.height !== H) {
      this.off = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(W, H) : Object.assign(document.createElement("canvas"), { width: W, height: H });
    }
    const oc = this.off.getContext("2d") as CanvasRenderingContext2D;
    oc.putImageData(img, 0, 0);
    const c = this.s.ctx();
    const smooth = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = W * 2 > w; // keep low-res grids crisp
    c.drawImage(this.off as CanvasImageSource, x0, y0, w, h);
    c.imageSmoothingEnabled = smooth;
  }

  // ---------- style ----------
  setInk(c: QValue) {
    this.style.ink = paint(c);
  }
  setPen(c: QValue) {
    this.style.pen = paint(c);
  }
  background(c: QValue) {
    const p = paint(c);
    const ctx = this.s.ctx();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (p.kind === "none") ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    else {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = p.kind === "one" ? p.css : p.css[0];
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
    ctx.restore();
  }
  push() {
    this.stack.push({ ...this.style });
    if (this.stack.length > 256) throw typeErr("Too many push[] without pop[].");
    this.s.ctx().save();
  }
  pop() {
    const st = this.stack.pop();
    if (!st) throw typeErr("pop[] without a matching push[].");
    this.style = st;
    this.s.ctx().restore();
  }
}

function looksUnit(chans: Float64Array[][]): boolean {
  let hi = 0;
  for (const ch of chans) for (const r of ch) for (let i = 0; i < r.length; i++) if (r[i] > hi) hi = r[i];
  return hi <= 1;
}

/** A table column of x y pairs → (xs;ys). */
function flipPairs(p: QValue, what: string): QValue {
  if (p instanceof QVec && p.t === 0) {
    const its = p.d as QValue[];
    const xs = new Float64Array(its.length), ys = new Float64Array(its.length);
    its.forEach((e, i) => {
      const d = nums(e, what);
      if (d.length < 2) throw lengthErr(`Each ${what} should be an x y pair.`);
      xs[i] = d[0];
      ys[i] = d[1];
    });
    return list([floats(xs), floats(ys)]);
  }
  return p;
}

// ============ binding into a q session ============

const b1 = (name: string, f: (x: QValue) => QValue) => new Builtin(name, 1, f);
const b2 = (name: string, f: (x: QValue, y: QValue) => QValue) => new Builtin(name, 2, undefined, f);
const bn = (name: string, rank: number, f: (a: QValue[]) => QValue) => new Builtin(name, rank, undefined, undefined, f);

export function installApi(session: Session, api: Api) {
  const ns = session.nsMap(".qv");
  const fmt = (v: QValue) => inline(v, 7);
  const set = (name: string, v: QValue) => ns.set(name, v);
  const unit = NIL;

  set("canvas", b1("canvas", (x) => {
    const d = nums(x, "canvas size");
    const w = Math.round(d[0]), h = Math.round(d.length > 1 ? d[1] : d[0]);
    if (!(w > 0 && h > 0 && w <= 4096 && h <= 4096)) throw typeErr("canvas size should be two numbers between 1 and 4096, like canvas 800 600.");
    api.s.resize(w, h);
    syncSize(ns, api);
    return unit;
  }));
  set("background", b1("background", (x) => (api.background(x), unit)));
  set("clear", b1("clear", () => (api.background(sym("none")), unit)));
  set("ink", b1("ink", (x) => (api.setInk(x), unit)));
  set("pen", b1("pen", (x) => (api.setPen(x), unit)));
  set("weight", b1("weight", (x) => ((api.style.weight = num(x, "weight")), unit)));
  set("alpha", b1("alpha", (x) => ((api.s.ctx().globalAlpha = Math.max(0, Math.min(1, num(x, "alpha") / 255))), unit)));
  set("blend", b1("blend", (x) => {
    const m: Record<string, GlobalCompositeOperation> = {
      normal: "source-over", add: "lighter", multiply: "multiply", screen: "screen", difference: "difference",
      overlay: "overlay", lighten: "lighten", darken: "darken", xor: "xor",
    };
    const k = text(x);
    if (!m[k]) throw typeErr("blend takes one of `normal`add`multiply`screen`difference`overlay`lighten`darken.");
    api.s.ctx().globalCompositeOperation = m[k];
    return unit;
  }));
  set("font", b1("font", (x) => {
    if (x instanceof QAtom && typeof x.v === "number") api.style.fontSize = x.v;
    else {
      const t = text(x);
      if (t === null) throw typeErr("font takes a size like font 24, or a face like font `mono.");
      api.style.fontFamily = FONTS[t] ?? t;
    }
    return unit;
  }));
  set("align", b1("align", (x) => {
    const ts = x instanceof QVec && x.t === 11 ? (x.d as string[]) : [text(x)];
    for (const t of ts) {
      if (t === "left" || t === "right" || t === "center") api.style.align = t;
      else if (t === "top" || t === "middle" || t === "bottom") api.style.baseline = t;
      else if (t === "baseline") api.style.baseline = "alphabetic";
      else throw typeErr("align takes `left`center`right and/or `top`middle`bottom`baseline.");
    }
    return unit;
  }));

  set("circle", new Builtin("circle", 2, (t) => (api.circle(t, float(10)), unit), (p, r) => (api.circle(p, r), unit)));
  set("ellipse", b2("ellipse", (p, r) => (api.ellipse(p, r), unit)));
  set("rect", new Builtin("rect", 2, (t) => (api.rect(t, float(10)), unit), (p, wh) => (api.rect(p, wh), unit)));
  set("square", b2("square", (p, s) => (api.rect(p, s), unit)));
  set("line", b2("line", (a, bb) => (api.line(a, bb), unit)));
  set("point", b1("point", (p) => (api.point(p), unit)));
  set("poly", b1("poly", (p) => (api.poly(p, true), unit)));
  set("path", b1("path", (p) => (api.poly(p, false), unit)));
  set("curve", b1("curve", (p) => (api.curve(p, false), unit)));
  set("blob", b1("blob", (p) => (api.curve(p, true), unit)));
  set("tri", bn("tri", 3, ([a, bb, c]) => (api.tri(a, bb, c), unit)));
  set("arc", bn("arc", 3, ([p, r, a]) => (api.arc(p, r, a), unit)));
  set("text", b2("text", (p, s) => (api.text(p, s, fmt), unit)));
  set("pixels", b1("pixels", (m) => (api.pixels(m, null), unit)));
  set("heatmap", new Builtin("heatmap", 2, (m) => (api.pixels(m, "viridis"), unit), (m, c) => (api.pixels(m, text(c) ?? "viridis"), unit)));

  // transforms
  set("move", b1("move", (p) => {
    const d = nums(p, "move");
    api.s.ctx().translate(d[0], d.length > 1 ? d[1] : 0);
    return unit;
  }));
  set("turn", b1("turn", (a) => (api.s.ctx().rotate(num(a, "turn angle")), unit)));
  set("zoom", b1("zoom", (s) => {
    const d = nums(s, "zoom");
    api.s.ctx().scale(d[0], d.length > 1 ? d[1] : d[0]);
    return unit;
  }));
  set("push", b1("push", () => (api.push(), unit)));
  set("pop", b1("pop", () => (api.pop(), unit)));

  // colour helpers
  set("hsb", bn("hsb", 3, ([h, s, br]) => colorRows(h, s, br, (a, b, c) => hsb2rgb(a, b, c))));
  set("rgb", bn("rgb", 3, ([r, g, bb]) => colorRows(r, g, bb, (a, b, c) => [a, b, c])));
  set("gray", b1("gray", (g) => (g instanceof QAtom ? floats([g.v, g.v, g.v]) : list([g, g, g]))));

  // noise & maths
  set("noise", b1("noise", (p) => {
    if (p instanceof QAtom) return float(api.s.noise(num(p, "noise"), 0, 0));
    if (p instanceof QVec && p.t === 0) {
      const rows = (p.d as QValue[]).map((r) => nums(r, "noise"));
      const n = Math.max(...rows.map((r) => r.length));
      const out = new Float64Array(n);
      const g = (r: Float64Array | undefined, i: number) => (!r ? 0 : r.length === 1 ? r[0] : r[i]);
      for (let i = 0; i < n; i++) out[i] = api.s.noise(g(rows[0], i), g(rows[1], i), g(rows[2], i));
      return floats(out);
    }
    const d = nums(p, "noise");
    const out = new Float64Array(d.length);
    for (let i = 0; i < d.length; i++) out[i] = api.s.noise(d[i], 0, 0);
    return floats(out);
  }));
  set("noiseseed", b1("noiseseed", (x) => (api.s.noiseSeed(num(x, "seed")), unit)));
  set("atan2", b2("atan2", (y, x) => zipNum(y, x, Math.atan2, "atan2")));

  // loop control
  set("fps", b1("fps", (x) => (api.s.setFps(num(x, "fps")), unit)));
  set("noloop", b1("noloop", () => (api.s.stopLoop(), unit)));

  // sound & camera
  set("tone", new Builtin("tone", 2, (f) => (api.s.tone(num(f, "tone frequency"), 0.3, "sine", 0.2), unit), (f, d) => {
    const fs = nums(f, "tone frequency");
    const dur = num(d, "tone duration");
    for (const fr of fs) api.s.tone(fr, dur, "sine", 0.2 / Math.sqrt(fs.length));
    return unit;
  }));
  set("mic", b1("mic", () => (api.s.startMic(), unit)));
  set("camera", b1("camera", (x) => {
    const d = x instanceof QAtom && x.t === 101 ? Float64Array.of(64, 48) : nums(x, "camera size");
    api.s.startCamera(d[0] || 64, d[1] || d[0] * 0.75 || 48);
    return unit;
  }));

  syncSize(ns, api);
}

export function syncSize(ns: Map<string, QValue>, api: Api) {
  const w = api.s.width, h = api.s.height;
  ns.set("size", floats([w, h]));
  ns.set("width", long(w));
  ns.set("height", long(h));
  ns.set("center", floats([w / 2, h / 2]));
}

function zipNum(a: QValue, b: QValue, f: (x: number, y: number) => number, what: string): QValue {
  if (a instanceof QAtom && b instanceof QAtom) return float(f(num(a, what), num(b, what)));
  if (a instanceof QVec && a.t === 0) return list((a.d as QValue[]).map((e, i) => zipNum(e, b instanceof QVec && b.t === 0 ? (b.d as QValue[])[i] : b, f, what)));
  const x = nums(a, what), y = nums(b, what);
  const n = Math.max(x.length, y.length);
  if (x.length !== n && x.length !== 1) throw lengthErr(`${what}: lengths differ (${x.length} and ${y.length}).`);
  if (y.length !== n && y.length !== 1) throw lengthErr(`${what}: lengths differ (${x.length} and ${y.length}).`);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = f(x.length === 1 ? x[0] : x[i], y.length === 1 ? y[0] : y[i]);
  return floats(out);
}

function colorRows(a: QValue, b: QValue, c: QValue, f: (a: number, b: number, c: number) => [number, number, number]): QValue {
  const A = nums(a, "colour"), B = nums(b, "colour"), C = nums(c, "colour");
  const n = Math.max(A.length, B.length, C.length);
  for (const v of [A, B, C]) if (v.length !== 1 && v.length !== n) throw lengthErr("Colour channels have different lengths.");
  const g = (v: Float64Array, i: number) => (v.length === 1 ? v[0] : v[i]);
  if (n === 1 && a instanceof QAtom && b instanceof QAtom && c instanceof QAtom) return floats(f(A[0], B[0], C[0]).map(Math.round));
  const r = new Float64Array(n), gg = new Float64Array(n), bb = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const [x, y, z] = f(g(A, i), g(B, i), g(C, i));
    r[i] = Math.round(x);
    gg[i] = Math.round(y);
    bb[i] = Math.round(z);
  }
  return list([floats(r), floats(gg), floats(bb)]);
}

export { FONTS, bool, str, syms, QDict };
