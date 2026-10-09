// Rasterise public/icon.svg into the PNG icons the manifest and index.html reference.
// Needs a local Chrome/Chromium (no npm deps). Run: node tools/make-icons.mjs
// Override the browser with CHROME=/path/to/chrome.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pub = join(root, "public");
const svg = readFileSync(join(pub, "icon.svg"), "utf8");

// Maskable / apple-touch: full-bleed square background (the OS applies its own mask),
// glyph scaled so it stays inside the 80% safe zone.
const fullBleed = (scale) =>
  svg
    .replace(/<rect([^>]*?) rx="\d+"/, "<rect$1")
    .replace(/(<rect[^>]*\/>)([\s\S]*)<\/svg>/, `$1<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">$2</g></svg>`);

const targets = [
  { file: "icon-192.png", size: 192, src: svg },
  { file: "icon-512.png", size: 512, src: svg },
  { file: "icon-maskable-512.png", size: 512, src: fullBleed(0.8) },
  { file: "apple-touch-icon.png", size: 180, src: fullBleed(0.86) },
];

const candidates = [process.env.CHROME, "/usr/local/bin/google-chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
const chrome = candidates.find((c) => c && existsSync(c));
if (!chrome) {
  console.error("No Chrome found. Set CHROME=/path/to/chrome.");
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), "qanvas-icons-"));

// headless Chrome writes the screenshot and then sometimes lingers, so wait for the file, then stop it
function shoot(html, size, out) {
  const page = join(work, "page.html");
  writeFileSync(page, html);
  if (existsSync(out)) rmSync(out);
  const args = ["--headless", "--no-sandbox", "--disable-gpu", "--no-first-run", `--user-data-dir=${join(work, "profile")}`, "--hide-scrollbars", "--default-background-color=00000000", `--window-size=${size},${size}`, `--screenshot=${out}`, "file://" + page];
  const proc = spawn(chrome, args, { stdio: "ignore" });
  return new Promise((ok, fail) => {
    const started = Date.now();
    let last = -1;
    const tick = setInterval(() => {
      const n = existsSync(out) ? statSync(out).size : -1;
      if (n > 0 && n === last) {
        clearInterval(tick);
        proc.kill();
        ok();
      } else if (Date.now() - started > 30000) {
        clearInterval(tick);
        proc.kill();
        fail(new Error("Chrome did not write " + out));
      }
      last = n;
    }, 250);
  });
}

for (const t of targets) {
  const html = `<!doctype html><html><body style="margin:0;background:transparent"><img width="${t.size}" height="${t.size}" style="display:block" src="data:image/svg+xml;base64,${Buffer.from(t.src).toString("base64")}"></body></html>`;
  const out = join(pub, t.file);
  await shoot(html, t.size, out);
  console.log(`${t.file}  ${t.size}x${t.size}  ${statSync(out).size} bytes`);
}
rmSync(work, { recursive: true, force: true });
