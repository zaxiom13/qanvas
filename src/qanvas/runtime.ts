// Runs a q sketch against a p5.js canvas: executes the code, then calls `draw` every frame.
import p5 from "p5";
import { QError } from "../q/errors";
import { NIL, QValue, Session, bool, float, floats, list, long, syms, QVec } from "../q/index";
import { Lambda } from "../q/fns";
import { Api, Surface, installApi, syncSize } from "./api";
import { QANVAS_Q } from "./qlib";

export type RunState = "idle" | "running" | "paused" | "done" | "error";

export interface RuntimeEvents {
  output(kind: "out" | "err" | "info", text: string): void;
  error(err: QError, src: string): void;
  state(s: RunState): void;
  fps?(fps: number): void;
}

export interface RuntimeOptions {
  /** max ms for top-level code, and for one draw call */
  runBudget?: number;
  frameBudget?: number;
}

const KEY_NAMES: Record<string, string> = {
  " ": "space", ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", Enter: "enter",
  Escape: "escape", Shift: "shift", Control: "control", Alt: "alt", Meta: "meta", Backspace: "backspace", Tab: "tab",
};
const keyName = (k: string) => KEY_NAMES[k] ?? (k.length === 1 ? k.toLowerCase() : k.toLowerCase());

export const DEFAULT_BG = "#15141d";
export const DEFAULT_INK = "#f6f1e7";

export class QanvasRuntime {
  p!: p5;
  ready: Promise<void>;
  session!: Session;
  api: Api;
  width = 600;
  height = 600;
  state: RunState = "idle";
  src = "";
  private drawFn: QValue | null = null;
  private frameNo = 0;
  private t0 = 0;
  private lastT = 0;
  private opts: Required<RuntimeOptions>;
  // input state
  private mouse = [0, 0];
  private pmouse = [0, 0];
  private down = false;
  private clickedFlag = false;
  private releasedFlag = false;
  private held = new Set<string>();
  private pressedKeys = new Set<string>();
  private touches = new Map<number, [number, number]>();
  private wheel = 0;
  // media
  private audio: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private video: HTMLVideoElement | null = null;
  private camCanvas: HTMLCanvasElement | null = null;
  private camSize = [64, 48];
  private canvasEl!: HTMLCanvasElement;
  private fpsAvg = 60;

  constructor(public parent: HTMLElement, public ev: RuntimeEvents, opts: RuntimeOptions = {}) {
    this.opts = { runBudget: 8000, frameBudget: 400, ...opts };
    const surface: Surface = {
      ctx: () => this.p.drawingContext as CanvasRenderingContext2D,
      get width() { return rt.width; },
      get height() { return rt.height; },
      resize: (w, h) => this.resize(w, h),
      noise: (x, y, z) => this.p.noise(x, y, z),
      noiseSeed: (n) => this.p.noiseSeed(n),
      setFps: (n) => this.p.frameRate(n),
      stopLoop: () => {
        this.p.noLoop();
        this.setState("done");
      },
      tone: (f, d, type, vol) => this.tone(f, d, type, vol),
      startMic: () => void this.startMic(),
      startCamera: (w, h) => this.startCamera(w, h),
      log: (t) => this.ev.output("info", t),
    };
    const rt = this;
    this.api = new Api(surface);
    this.ready = new Promise((resolve) => {
      new p5((p: p5) => {
        this.p = p;
        p.setup = () => {
          const r = p.createCanvas(this.width, this.height);
          this.canvasEl = (r as unknown as { elt: HTMLCanvasElement }).elt ?? (p as any).canvas;
          p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
          p.noLoop();
          this.attachInput();
          this.paintIdle();
          resolve();
        };
        p.draw = () => this.frame();
      }, parent);
    });
  }

  get canvas(): HTMLCanvasElement {
    return this.canvasEl;
  }

  private setState(s: RunState) {
    this.state = s;
    this.ev.state(s);
  }

  private paintIdle() {
    const c = this.p.drawingContext as CanvasRenderingContext2D;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = DEFAULT_BG;
    c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.restore();
  }

  resize(w: number, h: number) {
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.p.resizeCanvas(w, h);
    this.paintIdle();
  }

  /** Start a sketch from source. Resolves when the top-level code has run. */
  async run(src: string, files?: Map<string, string>): Promise<boolean> {
    await this.ready;
    this.p.noLoop();
    this.src = src;
    this.drawFn = null;
    this.frameNo = 0;
    this.held.clear();
    this.pressedKeys.clear();
    this.api.reset();
    const c = this.p.drawingContext as CanvasRenderingContext2D;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    if (this.width !== 600 || this.height !== 600) this.resize(600, 600);
    this.paintIdle();
    this.p.resetMatrix();
    this.p.scale(1);

    const s = new Session({
      stdout: (t) => this.ev.output("out", t),
      stderr: (t) => this.ev.output("err", t),
      files,
    });
    this.session = s;
    s.imports = [".qv"];
    installApi(s, this.api);
    s.run(QANVAS_Q);
    this.api.style.ink = { kind: "one", css: DEFAULT_INK };
    this.publishInputs();
    this.t0 = performance.now();
    this.lastT = this.t0;

    // run top-level code
    s.deadline = performance.now() + this.opts.runBudget;
    s.budgetHint = `Your code ran for more than ${this.opts.runBudget / 1000}s, so it was stopped. Is there a loop that never ends?`;
    this.p.push();
    try {
      s.run(src);
    } catch (e) {
      this.p.pop();
      this.fail(e, src);
      return false;
    } finally {
      s.deadline = 0;
    }
    this.p.pop();

    const setup = s.get("setup");
    if (setup instanceof Lambda) {
      try {
        s.deadline = performance.now() + this.opts.runBudget;
        this.p.push();
        s.call(setup, ...(setup.rank ? [NIL] : []));
        this.p.pop();
      } catch (e) {
        this.fail(e, src);
        return false;
      } finally {
        s.deadline = 0;
      }
    }
    const draw = s.get("draw");
    if (draw instanceof Lambda) {
      this.drawFn = draw;
      this.p.frameRate(60);
      this.setState("running");
      this.p.loop();
    } else {
      this.setState("done");
    }
    return true;
  }

  private fail(e: unknown, src: string) {
    this.p.noLoop();
    const err = e instanceof QError ? e : new QError("internal", String(e));
    this.setState("error");
    this.ev.error(err, src);
  }

  private frame() {
    if (!this.drawFn || !this.session) return;
    const now = performance.now();
    const dt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (dt > 0) this.fpsAvg = this.fpsAvg * 0.95 + (1 / dt) * 0.05;
    if (this.frameNo % 15 === 0) this.ev.fps?.(this.fpsAvg);
    this.publishInputs(dt);
    const s = this.session;
    s.deadline = performance.now() + this.opts.frameBudget;
    s.budgetHint = `One frame of draw took longer than ${this.opts.frameBudget}ms, so the sketch was paused. Try fewer shapes or iterations.`;
    try {
      const f = this.drawFn;
      s.call(f, ...((f as Lambda).rank ? [NIL] : []));
    } catch (e) {
      s.deadline = 0;
      this.fail(e, this.src);
      return;
    }
    s.deadline = 0;
    this.frameNo++;
    this.clickedFlag = false;
    this.releasedFlag = false;
    this.pressedKeys.clear();
    this.wheel = 0;
    this.pmouse = [...this.mouse];
  }

  private publishInputs(dt = 0) {
    const ns = this.session?.nsMap(".qv");
    if (!ns) return;
    ns.set("mouse", floats(this.mouse));
    ns.set("pmouse", floats(this.pmouse));
    ns.set("mousedown", bool(this.down));
    ns.set("clicked", bool(this.clickedFlag));
    ns.set("released", bool(this.releasedFlag));
    ns.set("held", syms([...this.held]));
    ns.set("pressed", syms([...this.pressedKeys]));
    ns.set("frame", long(this.frameNo));
    ns.set("time", float((performance.now() - this.t0) / 1000));
    ns.set("dt", float(dt));
    ns.set("wheel", float(this.wheel));
    const ts = [...this.touches.values()];
    ns.set("touches", list([floats(ts.map((t) => t[0])), floats(ts.map((t) => t[1]))]));
    if (this.analyser) {
      const bins = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(bins);
      const n = 64;
      const spec = new Float64Array(n);
      const per = Math.floor(bins.length / n);
      for (let i = 0; i < n; i++) {
        let m = 0;
        for (let k = 0; k < per; k++) m += bins[i * per + k];
        spec[i] = m / per / 255;
      }
      const wave = new Uint8Array(this.analyser.fftSize);
      this.analyser.getByteTimeDomainData(wave);
      let rms = 0;
      for (const v of wave) rms += ((v - 128) / 128) ** 2;
      ns.set("spectrum", floats(spec));
      ns.set("level", float(Math.sqrt(rms / wave.length)));
    }
    if (this.video && this.camCanvas && this.video.readyState >= 2) {
      const [w, h] = this.camSize;
      const cc = this.camCanvas.getContext("2d", { willReadFrequently: true })!;
      cc.save();
      cc.scale(-1, 1);
      cc.drawImage(this.video, -w, 0, w, h);
      cc.restore();
      const d = cc.getImageData(0, 0, w, h).data;
      const gray: QValue[] = [], R: QValue[] = [], G: QValue[] = [], B: QValue[] = [];
      for (let y = 0; y < h; y++) {
        const g = new Float64Array(w), r = new Float64Array(w), gg = new Float64Array(w), bb = new Float64Array(w);
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4;
          r[x] = d[o] / 255;
          gg[x] = d[o + 1] / 255;
          bb[x] = d[o + 2] / 255;
          g[x] = 0.299 * r[x] + 0.587 * gg[x] + 0.114 * bb[x];
        }
        gray.push(floats(g));
        R.push(floats(r));
        G.push(floats(gg));
        B.push(floats(bb));
      }
      ns.set("cam", list(gray));
      ns.set("camrgb", list([list(R), list(G), list(B)]));
    }
    syncSize(ns, this.api);
  }

  pause() {
    if (this.state !== "running") return;
    this.p.noLoop();
    this.setState("paused");
  }
  resume() {
    if (this.state !== "paused" || !this.drawFn) return;
    this.lastT = performance.now();
    this.setState("running");
    this.p.loop();
  }
  step() {
    if (!this.drawFn) return;
    if (this.state === "running") this.pause();
    this.p.redraw();
  }
  stop() {
    this.p?.noLoop();
    this.drawFn = null;
    if (this.state === "running" || this.state === "paused") this.setState("done");
  }

  /** Evaluate a line in the running sketch's session (for the console). */
  evalInSketch(src: string) {
    if (!this.session) return null;
    this.session.deadline = performance.now() + this.opts.runBudget;
    try {
      return this.session.evaluate(src);
    } finally {
      this.session.deadline = 0;
    }
  }

  // ---------------- input ----------------
  private toCanvas(e: { clientX: number; clientY: number }): [number, number] {
    const r = this.canvasEl.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * this.width, ((e.clientY - r.top) / r.height) * this.height];
  }

  private attachInput() {
    const el = this.canvasEl;
    el.tabIndex = 0;
    el.style.touchAction = "none";
    el.setAttribute("aria-label", "Sketch canvas");
    el.addEventListener("pointerdown", (e) => {
      el.focus({ preventScroll: true });
      this.mouse = this.toCanvas(e);
      this.down = true;
      this.clickedFlag = true;
      if (e.pointerType === "touch") this.touches.set(e.pointerId, this.toCanvas(e));
      el.setPointerCapture(e.pointerId);
      this.audio?.resume();
    });
    el.addEventListener("pointermove", (e) => {
      this.mouse = this.toCanvas(e);
      if (e.pointerType === "touch") this.touches.set(e.pointerId, this.toCanvas(e));
    });
    const up = (e: PointerEvent) => {
      if (e.pointerType === "touch") this.touches.delete(e.pointerId);
      if (!this.touches.size) {
        this.down = false;
        this.releasedFlag = true;
      }
    };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", (e) => {
      if (this.state !== "running") return;
      e.preventDefault();
      this.wheel += e.deltaY;
    }, { passive: false });
    el.addEventListener("keydown", (e) => {
      const k = keyName(e.key);
      if (!this.held.has(k)) this.pressedKeys.add(k);
      this.held.add(k);
      if (this.state === "running" && (k === "space" || k.startsWith("arrow") || ["up", "down", "left", "right"].includes(k))) e.preventDefault();
    });
    el.addEventListener("keyup", (e) => this.held.delete(keyName(e.key)));
    el.addEventListener("blur", () => this.held.clear());
  }

  // ---------------- media ----------------
  private ensureAudio() {
    if (!this.audio) this.audio = new AudioContext();
    if (this.audio.state === "suspended") void this.audio.resume();
    return this.audio;
  }

  tone(freq: number, dur: number, type: string, vol: number) {
    const a = this.ensureAudio();
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = (["sine", "square", "sawtooth", "triangle"].includes(type) ? type : "sine") as OscillatorType;
    o.frequency.value = freq;
    const t = a.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.05, dur));
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + Math.max(0.05, dur) + 0.05);
  }

  async startMic() {
    if (this.analyser) return;
    try {
      const a = this.ensureAudio();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const src = a.createMediaStreamSource(stream);
      this.analyser = a.createAnalyser();
      this.analyser.fftSize = 1024;
      src.connect(this.analyser);
      this.ev.output("info", "Microphone on — read `level` and `spectrum`.");
    } catch {
      this.ev.output("err", "Couldn't open the microphone (permission denied?).");
    }
  }

  startCamera(w: number, h: number) {
    this.camSize = [Math.max(8, Math.min(320, Math.round(w))), Math.max(6, Math.min(240, Math.round(h)))];
    if (this.video) return;
    const v = document.createElement("video");
    v.playsInline = true;
    v.muted = true;
    this.video = v;
    this.camCanvas = document.createElement("canvas");
    this.camCanvas.width = this.camSize[0];
    this.camCanvas.height = this.camSize[1];
    navigator.mediaDevices
      .getUserMedia({ video: { width: 320, height: 240 } })
      .then((stream) => {
        v.srcObject = stream;
        void v.play();
        this.ev.output("info", "Camera on — read `cam` (gray rows) or `camrgb`.");
      })
      .catch(() => this.ev.output("err", "Couldn't open the camera (permission denied?)."));
    const ns = this.session?.nsMap(".qv");
    ns?.set("cam", list([floats(new Float64Array(this.camSize[0]))]));
  }

  destroy() {
    this.p?.remove();
    (this.video?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    void this.audio?.close();
  }

  snapshot(): string {
    return this.canvasEl.toDataURL("image/png");
  }
}

export { QVec };
