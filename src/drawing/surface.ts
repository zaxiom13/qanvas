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

