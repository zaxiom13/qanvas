import { Session, floats, bool, long, float, syms, list } from "../src/q/index";
import { Api, Surface, installApi } from "../src/qanvas/api";
import { QANVAS_Q } from "../src/qanvas/qlib";

/** A CanvasRenderingContext2D stand-in that records calls. */
export function mockCtx() {
  const calls: string[] = [];
  const target: Record<string, unknown> = { canvas: { width: 600, height: 600 } };
  const ctx = new Proxy(target, {
    get(t, k: string) {
      if (k in t) return t[k];
      return (...args: unknown[]) => {
        calls.push(k + "(" + args.map((a) => (typeof a === "number" ? Math.round(a * 100) / 100 : typeof a)).join(",") + ")");
      };
    },
    set(t, k: string, v) {
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

export function sketchSession() {
  const { ctx, calls } = mockCtx();
  const out: string[] = [];
  const surface: Surface = {
    ctx: () => ctx,
    width: 600,
    height: 600,
    resize(w, h) {
      this.width = w;
      this.height = h;
    },
    noise: (x, y, z) => (Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 0.5 + 0.5),
    noiseSeed: () => {},
    setFps: () => {},
    stopLoop: () => {},
    tone: () => {},
    startMic: () => {},
    startCamera: () => {},
    log: (t) => out.push(t),
  };
  const api = new Api(surface);
  const s = new Session({ stdout: (t) => out.push(t), stderr: (t) => out.push(t) });
  s.imports = [".qv"];
  installApi(s, api);
  s.run(QANVAS_Q);
  const ns = s.nsMap(".qv");
  ns.set("mouse", floats([300, 300]));
  ns.set("pmouse", floats([300, 300]));
  ns.set("mousedown", bool(false));
  ns.set("clicked", bool(false));
  ns.set("released", bool(false));
  ns.set("held", syms([]));
  ns.set("pressed", syms([]));
  ns.set("frame", long(0));
  ns.set("time", float(0));
  ns.set("dt", float(1 / 60));
  ns.set("wheel", float(0));
  ns.set("touches", list([floats([]), floats([])]));
  ns.set("level", float(0));
  ns.set("spectrum", floats(new Float64Array(64)));
  ns.set("cam", list([floats(new Float64Array(8))]));
  return { s, api, calls, out };
}
