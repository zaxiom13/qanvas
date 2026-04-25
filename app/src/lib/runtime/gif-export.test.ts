import { describe, expect, it } from 'vitest';
import { encodeRgbaFramesToGif } from './gif-export';

function solidFrame(width: number, height: number, r: number, g: number, b: number, a = 255) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
  return data;
}

describe('encodeRgbaFramesToGif', () => {
  it('produces a GIF89a byte stream for two solid frames', () => {
    const w = 4;
    const h = 4;
    const frames = [solidFrame(w, h, 255, 0, 0), solidFrame(w, h, 0, 0, 255)];
    const bytes = encodeRgbaFramesToGif(frames, w, h, 100);
    expect(bytes.length).toBeGreaterThan(32);
    expect(String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!)).toBe('GIF');
    expect(String.fromCharCode(bytes[3]!, bytes[4]!, bytes[5]!)).toBe('89a');
  });

  it('throws when frame buffer size does not match dimensions', () => {
    const bad = new Uint8ClampedArray(10);
    expect(() => encodeRgbaFramesToGif([bad], 2, 2, 50)).toThrow(/size mismatch/);
  });
});
