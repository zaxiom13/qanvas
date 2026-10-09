import { describe, expect, test } from "vitest";
import { existsSync, readFileSync } from "node:fs";

// Every icon the manifest or index.html points at must be a real file in public/,
// otherwise the server answers with the HTML shell and install/home-screen icons break.
const pub = (f: string) => new URL("../public/" + f, import.meta.url);
const config = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

const manifestIcons = [...config.matchAll(/\{\s*src:\s*"([^"]+)",\s*sizes:\s*"([^"]+)",\s*type:\s*"([^"]+)"(?:,\s*purpose:\s*"([^"]+)")?/g)].map((m) => ({
  src: m[1],
  sizes: m[2],
  type: m[3],
  purpose: m[4] ?? "any",
}));
const htmlIcons = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)" href="\.\/([^"]+)"/g)].map((m) => m[1]);

function pngSize(file: string): [number, number] {
  const b = readFileSync(pub(file));
  expect(b.subarray(1, 4).toString("latin1")).toBe("PNG");
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe("PWA icons", () => {
  test("the manifest lists a 192px, a 512px and a maskable icon", () => {
    expect(manifestIcons.some((i) => i.sizes === "192x192" && i.type === "image/png")).toBe(true);
    expect(manifestIcons.some((i) => i.sizes === "512x512" && i.type === "image/png" && i.purpose === "any")).toBe(true);
    expect(manifestIcons.some((i) => i.purpose === "maskable" && i.type === "image/png")).toBe(true);
  });

  for (const i of manifestIcons) {
    test(`manifest icon ${i.src} (${i.sizes}, ${i.purpose}) exists with the declared size`, () => {
      expect(existsSync(pub(i.src))).toBe(true);
      if (i.type === "image/png") expect(pngSize(i.src).join("x")).toBe(i.sizes);
    });
  }

  test("index.html links an icon and an apple-touch-icon", () => expect(htmlIcons.length).toBeGreaterThanOrEqual(2));
  for (const f of htmlIcons) {
    test(`index.html icon ${f} exists`, () => {
      expect(existsSync(pub(f))).toBe(true);
      if (f.endsWith(".png")) expect(pngSize(f)[0]).toBeGreaterThanOrEqual(180);
    });
  }
});
