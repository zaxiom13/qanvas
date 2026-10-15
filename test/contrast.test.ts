import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

/** WCAG relative luminance and contrast. Same formula as the 2026-10-15 measurement. */
function rel(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const u = v / 255;
    return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function contrast(fg: string, bg: string) {
  const L1 = rel(fg), L2 = rel(bg);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

function vars(block: string) {
  const out = new Map<string, string>();
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out.set(m[1], m[2].toLowerCase());
  return out;
}

const css = readFileSync(new URL("../src/app.css", import.meta.url), "utf8");
const light = vars(css.slice(0, css.indexOf("@media")));
const dark = vars(css.slice(css.indexOf(':root[data-theme="dark"]')));

test("light muted and status text clears 4.5:1 on the darkest paper", () => {
  // Measured 2026-10-15 on the old tokens, against #f3eee4: text-3 3.10, good 3.38, bad 3.87, warn 2.74.
  // #e8e0d0 is --surface-3, the darkest light surface. A colour that clears it also clears --bg and --surface.
  const paper = "#e8e0d0";
  for (const name of ["text-3", "good", "bad", "warn"]) {
    const ratio = contrast(light.get(name)!, paper);
    expect(ratio, name).toBeGreaterThanOrEqual(4.5);
  }
  expect(light.get("type-list")).toBe(light.get("text-3"));
  expect(light.get("type-bool")).toBe(light.get("good"));
});

test("dark muted text clears 4.5:1 on the lightest dark surface", () => {
  // Old --text-3 #6e6a80 was 3.31:1 on --surface-2 and lower on --surface-3.
  const ratio = contrast(dark.get("text-3")!, "#24232f");
  expect(ratio).toBeGreaterThanOrEqual(4.5);
  expect(css.match(/--text-3:\s*#6e6a80/)).toBeNull();
});
