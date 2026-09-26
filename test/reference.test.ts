import { describe, expect, test } from "vitest";
import { REFERENCE } from "../src/content/reference";
import { sketchSession } from "./helpers";

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

describe("reference examples run", () => {
  for (const r of REFERENCE) {
    if (!r.ex.length) continue;
    test(r.name, () => {
      const { s } = sketchSession();
      for (const ex of r.ex) {
        const res = s.evaluate(ex);
        expect(res.error ? `${ex}  =>  '${res.error.qname}: ${res.error.hint ?? ""}` : "ok").toBe("ok");
      }
    });
  }
});
