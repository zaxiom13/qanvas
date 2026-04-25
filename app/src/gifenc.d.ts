declare module 'gifenc' {
  export type GifPalette = number[][];

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: Record<string, unknown>,
  ): GifPalette;

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
    format?: string,
  ): Uint8Array;

  export type GIFEncoderFrameOptions = {
    palette?: GifPalette;
    delay?: number;
    first?: boolean;
    transparent?: boolean;
    transparentIndex?: number;
    repeat?: number;
    dispose?: number;
    colorDepth?: number;
  };

  export type GIFEncoderInstance = {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: GIFEncoderFrameOptions,
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
  };

  export function GIFEncoder(options?: { initialCapacity?: number; auto?: boolean }): GIFEncoderInstance;

  const _default: typeof GIFEncoder;
  export default _default;
}
