import { describe, expect, it } from "vitest";
import { isNarrow, isPhoneLandscape } from "../src/lib/viewport";

describe("viewport breakpoints", () => {
  it("treats a modern phone on its side as landscape", () => {
    expect(isPhoneLandscape(844, 390)).toBe(true);
    expect(isPhoneLandscape(932, 430)).toBe(true);
    expect(isNarrow(844)).toBe(false);
  });

  it("keeps a portrait phone on the narrow layout", () => {
    expect(isNarrow(390)).toBe(true);
    expect(isPhoneLandscape(390, 844)).toBe(false);
  });

  it("keeps a phone that is still under 760px wide on the narrow layout", () => {
    expect(isNarrow(667)).toBe(true);
    expect(isPhoneLandscape(667, 375)).toBe(false);
  });

  it("keeps a short desktop window and a tablet on the desktop layout", () => {
    expect(isPhoneLandscape(1280, 400)).toBe(false);
    expect(isPhoneLandscape(1280, 800)).toBe(false);
    expect(isPhoneLandscape(1024, 768)).toBe(false);
    expect(isNarrow(1024)).toBe(false);
  });
});
