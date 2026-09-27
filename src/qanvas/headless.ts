// Run a sketch without p5 or a visible canvas: used for gallery thumbnails and challenge checks.
import { Lambda } from "../q/fns";
import { NIL, Session, bool, float, floats, list, long, syms, type QValue } from "../q/index";
import { QError } from "../q/errors";
import { Api, installApi, syncSize, type Surface } from "./api";
import { QANVAS_Q } from "./qlib";
import { DEFAULT_BG, DEFAULT_INK } from "./defaults";
import { perlin } from "./perlin";

export interface HeadlessOpts {
  ctx: CanvasRenderingContext2D;
  frames?: number;
  mouse?: [number, number];
  budgetMs?: number;
  /** pixels per sketch unit (thumbnail scale) */
  scale?: number;
  onOut?: (t: string) => void;
  /** record the arguments of every drawing call (for lesson checks) */
  record?: boolean;
}

export interface HeadlessResult {
  error: QError | null;
  session: Session;
  api: Api;
  counts: Record<string, number>;
  calls: Record<string, QValue[][]>;
}

export function runHeadless(code: string, o: HeadlessOpts): HeadlessResult {
  const ctx = o.ctx;
  const scale = o.scale ?? 1;
  let w = 600, h = 600;
  const surface: Surface = {
    ctx: () => ctx,
    get width() { return w; },
    get height() { return h; },
    resize(nw, nh) {
      w = nw;
      h = nh;
    },
    noise: (x, y, z) => perlin(x, y, z),
    noiseSeed: () => {},
    setFps: () => {},
    stopLoop: () => {},
    tone: () => {},
    startMic: () => {},
    startCamera: () => {},
    log: (t) => o.onOut?.(t),
  };
  const api = new Api(surface);
  const s = new Session({ stdout: (t) => o.onOut?.(t), stderr: (t) => o.onOut?.(t) });
  s.imports = [".qv"];
  installApi(s, api);
  const ns = s.nsMap(".qv");
  const calls: Record<string, QValue[][]> = {};
  if (o.record) {
    for (const [name, f] of ns) {
      const b = f as any;
      if (!b || typeof b !== "object" || !("rank" in b)) continue;
      const rec = (impl: any) => impl && ((...a: any[]) => ((calls[name] ??= []).push(Array.isArray(a[0]) ? a[0] : a), impl(...a)));
      if (b.m) b.m = rec(b.m);
      if (b.d) b.d = rec(b.d);
      if (b.n) b.n = rec(b.n);
    }
  }
  s.run(QANVAS_Q);
  api.style.ink = { kind: "one", css: DEFAULT_INK };
  const mouse = o.mouse ?? [300, 300];
  const publish = (frame: number) => {
    ns.set("mouse", floats(mouse));
    ns.set("pmouse", floats(mouse));
    ns.set("mousedown", bool(false));
    ns.set("clicked", bool(false));
    ns.set("released", bool(false));
    ns.set("held", syms([]));
    ns.set("pressed", syms([]));
    ns.set("frame", long(frame));
    ns.set("time", float(frame / 60));
    ns.set("dt", float(1 / 60));
    ns.set("wheel", float(0));
    ns.set("touches", list([floats([]), floats([])]));
    ns.set("level", float(0));
    ns.set("spectrum", floats(new Float64Array(64)));
    ns.set("cam", list([floats(new Float64Array(8))]));
    syncSize(ns, api);
  };
  const reset = () => {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  };
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = DEFAULT_BG;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
  reset();
  publish(0);
  let error: QError | null = null;
  const deadline = () => (s.deadline = performance.now() + (o.budgetMs ?? 1500));
  try {
    deadline();
    s.run(code);
    const setup = s.get("setup");
    if (setup instanceof Lambda) {
      reset();
      s.call(setup, NIL);
    }
    const draw = s.get("draw");
    if (draw instanceof Lambda) {
      const n = o.frames ?? 1;
      for (let i = 0; i < n; i++) {
        publish(i);
        api.drawn = {};
        reset();
        deadline();
        s.call(draw, NIL);
      }
    }
  } catch (e) {
    error = e instanceof QError ? e : new QError("internal", String(e));
  } finally {
    s.deadline = 0;
  }
  return { error, session: s, api, counts: api.drawn, calls };
}

/** A looping, input-less sketch player on a plain 2D canvas (used for decorative previews). */
export function createPlayer(code: string, ctx: CanvasRenderingContext2D, scale: number) {
  const first = runHeadless(code, { ctx, frames: 0, scale, budgetMs: 2000 });
  const s = first.session;
  const draw = s.get("draw");
  let frame = 0;
  const ns = s.nsMap(".qv");
  return {
    error: first.error,
    step(mouse: [number, number], ox = 0, oy = 0) {
      if (!(draw instanceof Lambda) || first.error) return false;
      ns.set("mouse", floats(mouse));
      ns.set("pmouse", floats(mouse));
      ns.set("frame", long(frame));
      ns.set("time", float(frame / 60));
      frame++;
      ctx.setTransform(scale, 0, 0, scale, ox, oy);
      s.deadline = performance.now() + 60;
      try {
        s.call(draw, NIL);
      } catch {
        return false;
      } finally {
        s.deadline = 0;
      }
      return true;
    },
  };
}
