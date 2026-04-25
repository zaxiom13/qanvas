import { GIFEncoder, applyPalette, quantize } from 'gifenc';

/** Encodes RGBA frame buffers (row-major, 4 bytes per pixel) into a GIF byte stream. */
export function encodeRgbaFramesToGif(
  frames: Uint8ClampedArray[],
  width: number,
  height: number,
  frameDelayMs: number,
): Uint8Array {
  if (frames.length === 0) {
    return new Uint8Array(0);
  }

  const expected = width * height * 4;
  for (const frame of frames) {
    if (frame.length !== expected) {
      throw new Error(`GIF frame size mismatch: expected ${expected} bytes, got ${frame.length}`);
    }
  }

  const palette = quantize(frames[0]!, 256);
  const gif = GIFEncoder();

  for (let i = 0; i < frames.length; i += 1) {
    const index = applyPalette(frames[i]!, palette);
    if (i === 0) {
      gif.writeFrame(index, width, height, { palette, delay: frameDelayMs });
    } else {
      gif.writeFrame(index, width, height, { delay: frameDelayMs });
    }
  }

  gif.finish();
  return gif.bytes();
}
