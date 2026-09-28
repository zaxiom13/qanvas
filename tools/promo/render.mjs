// node render.mjs                -> docs/promo/qanvas-promo.mp4 + poster.jpg (all frames + soundtrack.wav)
// node render.mjs --stills 0,300 -> preview/f0000.jpg ... for a quick look
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { FPS, TOTAL, scenes, montage, meta } from "./timeline.mjs";

const OUT = new URL("../../docs/promo/qanvas-promo.mp4", import.meta.url).pathname;
const POSTER = new URL("../../docs/promo/poster.jpg", import.meta.url).pathname;
const ffmpeg = createRequire(import.meta.url)("ffmpeg-static");
const args = process.argv.slice(2);
const stills = args[0] === "--stills" ? args[1].split(",").map(Number) : null;
const outDir = args[2] ?? "preview";

const S = Object.fromEntries(scenes.map((s) => [s.id, s]));
const successE = meta.dojo.events.find((e) => e.type === "success");
const cfg = {
  scenes, montage, total: TOTAL,
  frames: Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, v.frames])),
  liveF: meta.type.events.find((e) => e.type === "live").f - 40,
  successF: S.dojo.start + Math.round((successE.f - S.dojo.from) / S.dojo.speed) + 4,
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await p.goto(new URL("./stage.html", import.meta.url).href);
await p.evaluate(() => document.fonts.ready);
await p.evaluate((c) => window.setup(c), cfg);

if (stills) {
  mkdirSync(outDir, { recursive: true });
  for (const f of stills) {
    await p.evaluate((f) => window.render(f), f);
    await p.screenshot({ path: `${outDir}/f${String(f).padStart(4, "0")}.jpg`, type: "jpeg", quality: 85 });
  }
} else {
  const ff = spawn(ffmpeg, ["-y", "-loglevel", "error", "-framerate", String(FPS), "-f", "image2pipe", "-c:v", "mjpeg", "-i", "-",
    "-i", "soundtrack.wav", "-c:v", "libx264", "-preset", "slower", "-crf", "25", "-pix_fmt", "yuv420p", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", OUT], { stdio: ["pipe", "inherit", "inherit"] });
  const t0 = Date.now();
  for (let f = 0; f < TOTAL; f++) {
    await p.evaluate((f) => window.render(f), f);
    const buf = await p.screenshot({ type: "jpeg", quality: 94 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f === 1290) await p.screenshot({ path: POSTER, type: "jpeg", quality: 88 });
    if (f % 150 === 0) console.log(`frame ${f}/${TOTAL} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  console.log(OUT);
}
await b.close();
