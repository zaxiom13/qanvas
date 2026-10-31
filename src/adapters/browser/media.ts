import { floats, list, float, type QValue } from "../../q/index";

/** Owns device resources and late permission results, independently of p5. */
export class BrowserMedia {
  private audio: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private video: HTMLVideoElement | null = null;
  private camCanvas: HTMLCanvasElement | null = null;
  private camSize = [64, 48];
  private micStream: MediaStream | null = null;
  private micPending = false;
  private disposed = false;
  constructor(private readonly output: (kind: "info" | "err", text: string) => void) {}

  resume() { void this.audio?.resume(); }

  publish(ns: Map<string, QValue>) {
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
  }

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
    if (this.analyser || this.micPending || this.disposed) return;
    this.micPending = true;
    try {
      const a = this.ensureAudio();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (this.disposed) { stream.getTracks().forEach((t) => t.stop()); return; }
      this.micStream = stream;
      const src = a.createMediaStreamSource(stream);
      this.analyser = a.createAnalyser();
      this.analyser.fftSize = 1024;
      src.connect(this.analyser);
      this.output("info", "Microphone on — read `level` and `spectrum`.");
    } catch {
      if (!this.disposed) this.output("err", "Couldn't open the microphone (permission denied?).");
    } finally { this.micPending = false; }
  }

  startCamera(w: number, h: number) {
    if (this.disposed) return;
    this.camSize = [Math.max(8, Math.min(320, Math.round(w))), Math.max(6, Math.min(240, Math.round(h)))];
    if (this.video) {
      this.camCanvas!.width = this.camSize[0]; this.camCanvas!.height = this.camSize[1];
      return;
    }
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
        if (this.disposed) { stream.getTracks().forEach((t) => t.stop()); return; }
        v.srcObject = stream;
        void v.play();
        this.output("info", "Camera on — read `cam` (gray rows) or `camrgb`.");
      })
      .catch(() => {
        this.video = null;
        if (!this.disposed) this.output("err", "Couldn't open the camera (permission denied?).");
      });
  }

  destroy() {
    this.disposed = true;
    this.micStream?.getTracks().forEach((t) => t.stop());
    (this.video?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    if (this.video) this.video.srcObject = null;
    void this.audio?.close();
  }
}
