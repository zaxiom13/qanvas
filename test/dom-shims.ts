// Minimal DOM stand-ins so drawing code can run under Node.
globalThis.ImageData ??= class {
  data: Uint8ClampedArray;
  constructor(public width: number, public height: number) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }
} as unknown as typeof ImageData;

globalThis.OffscreenCanvas ??= class {
  constructor(public width: number, public height: number) {}
  getContext() {
    return new Proxy({}, { get: () => () => {} });
  }
} as unknown as typeof OffscreenCanvas;
