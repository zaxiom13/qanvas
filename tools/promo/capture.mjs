// Deterministic mobile footage: fake clock stepped one video frame at a time, a screenshot per frame.
import { chromium } from "playwright";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
const URL = process.env.QANVAS_URL ?? "http://127.0.0.1:5173/"; // `npm run build && npm run preview` in the repo root
const FPS = 30, DT = 1000 / FPS;
const only = process.argv.slice(2);

async function fresh(b) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.clock.install({ time: new Date("2026-09-28T10:00:00") });
  // a soft "finger" dot that follows the pointer, so taps and drags read on video
  await p.addInitScript(() => {
    // the app scrolls an inner pane, not the window
    window.__sc = () => [...document.querySelectorAll("*")].filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 10 && e.offsetParent !== null).sort((a, b) => b.clientHeight - a.clientHeight)[0] ?? document.scrollingElement;
    window.__scroll = (y) => { __sc().scrollTop = y; };
    window.__y = () => __sc().scrollTop;
    window.__top = (prefix) => { const sc = __sc(), el = [...document.querySelectorAll(".cm-content")].find((e) => e.textContent.startsWith(prefix)); return el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop; };
    addEventListener("DOMContentLoaded", () => {
      const d = document.createElement("div");
      d.id = "finger";
      d.style.cssText = "position:fixed;z-index:99999;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(255,255,255,.45);border:3px solid #fff;box-shadow:0 0 0 2px rgba(30,30,60,.35),0 4px 14px rgba(0,0,0,.35);pointer-events:none;opacity:0;transition:none;left:-100px;top:-100px";
      document.body.appendChild(d);
    });
  });
  return { ctx, p };
}
const finger = (p, x, y, on = true, down = false) =>
  p.evaluate(([x, y, on, down]) => {
    const d = document.getElementById("finger");
    if (!d) return;
    d.style.left = x + "px"; d.style.top = y + "px"; d.style.opacity = on ? "1" : "0";
    d.style.transform = down ? "scale(.8)" : "scale(1)";
    d.style.background = down ? "rgba(129,140,248,.6)" : "rgba(255,255,255,.45)";
  }, [x, y, on, down]);

function recorder(p, name) {
  const dir = `clips/${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  let n = 0;
  const events = [];
  const mark = (type) => events.push({ type, f: n });
  const frame = async () => {
    await p.clock.runFor(DT);
    await p.screenshot({ path: `${dir}/${String(n++).padStart(4, "0")}.jpg`, type: "jpeg", quality: 90 });
  };
  const hold = async (k) => { for (let i = 0; i < k; i++) await frame(); };
  return { frame, hold, mark, events, count: () => n };
}
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
async function tapAt(p, r, x, y, before = 6, after = 6) {
  // finger moves in, presses, lifts
  await finger(p, x + 40, y + 60, true);
  for (let i = 0; i < before; i++) { const t = ease((i + 1) / before); await finger(p, x + 40 * (1 - t), y + 60 * (1 - t), true); await r.frame(); }
  await finger(p, x, y, true, true); r.mark("tap"); await r.frame();
  await p.mouse.click(x, y);
  await r.frame();
  await finger(p, x, y, true, false);
  for (let i = 0; i < after; i++) { await r.frame(); }
  await finger(p, x, y, false);
}
async function tap(p, r, loc, o) {
  const bb = await loc.boundingBox();
  await tapAt(p, r, bb.x + bb.width / 2, bb.y + bb.height / 2, o?.before, o?.after);
}
async function typeText(p, r, text, perChar = 1) {
  for (const ch of text) {
    if (ch === "\n") { await p.keyboard.press("Escape"); await p.keyboard.press("Enter"); }
    else await p.keyboard.type(ch);
    if (ch !== " ") r.mark(ch === "\n" ? "enter" : "key");
    for (let i = 0; i < perChar; i++) await r.frame();
  }
}
// the Run/Draw button that belongs to the code cell starting with `prefix`
async function cellButton(p, prefix, label) {
  await p.evaluate(([prefix, label]) => {
    let el = [...document.querySelectorAll(".cm-content")].find((e) => e.textContent.startsWith(prefix));
    while (el && ![...el.querySelectorAll("button")].some((b) => b.textContent.trim() === label)) el = el.parentElement;
    [...el.querySelectorAll("button")].find((b) => b.textContent.trim() === label).dataset.pick = prefix;
  }, [prefix, label]);
  return p.locator(`button[data-pick="${prefix}"]`);
}
const meta = {};
const done = (name, r) => (meta[name] = { frames: r.count(), events: r.events });
const clips = {
  async home(b) {
    const { p, ctx } = await fresh(b);
    await p.goto(URL + "#/learn"); await p.clock.runFor(1200);
    const r = recorder(p, "home");
    await r.hold(50);
    for (let i = 0; i < 40; i++) { await p.evaluate((y) => __scroll(y), ease(i / 39) * 720); await r.frame(); }
    await r.hold(20);
    done("home", r); await ctx.close();
  },
  // type a sketch from scratch; the mini canvas re-runs live. Then open the canvas and play with a finger.
  async type(b) {
    const { p, ctx } = await fresh(b);
    await p.goto(URL + "#/sketch"); await p.clock.runFor(1500);
    await p.getByRole("tab", { name: "Code" }).click(); await p.clock.runFor(300);
    await p.getByRole("textbox", { name: "Sketch code" }).click();
    await p.keyboard.press("Control+a"); await p.keyboard.press("Delete");
    await p.clock.runFor(1500);
    const r = recorder(p, "type");
    await r.hold(6);
    await typeText(p, r, "g:20+40*grid[15;15]\n\ndraw:{\n  background 10 12 20\nd:dist[g;mouse]\nink hsb[0.55+d%1400;0.6;1]\ncircle[g;3+15*0.5+0.5*sin (d%28)-4*time]", 1);
    await p.keyboard.press("Escape");
    r.mark("live");
    await r.hold(40);
    done("type", r);
    const t = recorder(p, "touch");
    await tap(p, t, p.getByRole("tab", { name: "Canvas" }), { before: 8, after: 8 });
    const cv = await p.locator("canvas").first().boundingBox();
    const cx = cv.x + cv.width / 2, cy = cv.y + cv.height / 2, R = cv.width * 0.3;
    t.mark("touchdown");
    const N = 130;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const x = cx + R * Math.sin(a), y = cy + R * Math.sin(2 * a) * 0.8;
      await p.mouse.move(x, y); await finger(p, x, y, true, true);
      await t.frame();
    }
    await finger(p, 0, 0, false); await t.hold(8);
    done("touch", t); await ctx.close();
  },
  // flick through the examples gallery, then a beat of each sketch
  async gallery(b) {
    const { p, ctx } = await fresh(b);
    await p.goto(URL + "#/sketch"); await p.clock.runFor(1500);
    await p.getByRole("tab", { name: "Code" }).click(); await p.clock.runFor(300);
    const r = recorder(p, "gallery");
    await tap(p, r, p.getByTitle("Examples"), { before: 6, after: 10 });
    const sc = p.locator(".sheet, [role=dialog]").first();
    for (let i = 0; i < 36; i++) {
      await p.evaluate((y) => { const el = [...document.querySelectorAll("*")].find((e) => e.scrollHeight > e.clientHeight + 50 && getComputedStyle(e).overflowY !== "visible" && e.closest("[role=dialog], .gallery, .modal, dialog")); if (el) el.scrollTop = y; }, ease(i / 35) * 5200);
      await r.frame();
    }
    await r.hold(6);
    await tap(p, r, p.getByText("Swarm", { exact: true }), { before: 6, after: 2 });
    await p.clock.runFor(400);
    await r.hold(40);
    done("gallery", r);
    for (const title of ["Swarm", "Golden spiral", "Flow field", "Mandelbrot", "A network learns", "Ray tracer"]) {
      await p.getByRole("tab", { name: "Code" }).click(); await p.clock.runFor(200);
      await p.getByTitle("Examples").click(); await p.clock.runFor(400);
      await p.getByText(title, { exact: true }).click();
      await p.clock.runFor(200);
      await p.getByRole("tab", { name: "Canvas" }).click();
      { await p.clock.runFor(100); const cv = await p.locator("canvas").first().boundingBox(); await p.mouse.move(cv.x + cv.width * 0.6, cv.y + cv.height * 0.45); }
      await p.clock.runFor(title === "Flow field" ? 2500 : title === "Ray tracer" || title === "Mandelbrot" ? 3000 : 600);
      const name = "ex-" + title.toLowerCase().replace(/\W+/g, "-");
      const e = recorder(p, name);
      await e.hold(36);
      done(name, e);
    }
    await ctx.close();
  },
  async lesson(b) {
    const { p, ctx } = await fresh(b);
    await p.goto(URL + "#/learn/lists"); await p.clock.runFor(1200);
    const r = recorder(p, "lesson");
    await r.hold(20);
    const target = (await p.evaluate(() => __top("til 10"))) - 200;
    for (let i = 0; i < 30; i++) { await p.evaluate((y) => __scroll(y), ease(i / 29) * target); await r.frame(); }
    await tap(p, r, await cellButton(p, "til 10", "Run"), { before: 6, after: 4 });
    r.mark("pop");
    await r.hold(24);
    const t2 = (await p.evaluate(() => __top("xs:30+60*til 10"))) - 170;
    const y0 = await p.evaluate(() => __y());
    for (let i = 0; i < 30; i++) { await p.evaluate((y) => __scroll(y), y0 + ease(i / 29) * (t2 - y0)); await r.frame(); }
    await tap(p, r, await cellButton(p, "xs:30+60*til 10", "Draw"), { before: 6, after: 4 });
    r.mark("pop");
    await r.hold(12);
    const y1 = await p.evaluate(() => __y());
    for (let i = 0; i < 24; i++) { await p.evaluate((y) => __scroll(y), y1 + ease(i / 23) * 330); await r.frame(); }
    await r.hold(30);
    done("lesson", r); await ctx.close();
  },
  async dojo(b) {
    const { p, ctx } = await fresh(b);
    await p.goto(URL + "#/dojo/dojo:lists:dot-product"); await p.clock.runFor(1200);
    const r = recorder(p, "dojo");
    await r.hold(15);
    const ed = p.getByRole("textbox", { name: "Challenge code" });
    const line = ed.locator(".cm-line", { hasText: "answer:0" });
    const bb = await line.boundingBox();
    await tapAt(p, r, bb.x + bb.width - 4, bb.y + bb.height / 2, 6, 4);
    await p.keyboard.press("End"); await p.keyboard.press("Backspace"); r.mark("key"); await r.hold(3);
    await typeText(p, r, "sum a*b", 2);
    await p.keyboard.press("Escape");
    await r.hold(8);
    await tap(p, r, p.getByRole("button", { name: "Check" }), { before: 6, after: 1 });
    r.mark("success");
    await r.hold(55);
    done("dojo", r); await ctx.close();
  },
  async ref(b) {
    const { p, ctx } = await fresh(b);
    await p.goto(URL + "#/ref"); await p.clock.runFor(1200);
    const r = recorder(p, "ref");
    await r.hold(8);
    await tap(p, r, p.getByLabel("Search the reference"), { before: 6, after: 2 });
    await typeText(p, r, "circle", 2);
    await r.hold(10);
    await tap(p, r, p.locator("button.entry", { has: p.locator("code.nm", { hasText: /^circle$/ }) }), { before: 6, after: 4 });
    await p.clock.runFor(300);
    await r.hold(40);
    for (let i = 0; i < 30; i++) { await p.evaluate((y) => { const d = document.querySelector(".detail"); if (d) d.scrollTop = y; else scrollTo(0, y); }, ease(i / 29) * 420); await r.frame(); }
    await r.hold(25);
    done("ref", r); await ctx.close();
  },
  async console(b) {
    const { p, ctx } = await fresh(b);
    await p.goto(URL + "#/sketch"); await p.clock.runFor(1500);
    await p.getByRole("tab", { name: "Console" }).click(); await p.clock.runFor(300);
    const r = recorder(p, "console");
    await r.hold(6);
    await p.getByLabel("q console input").click();
    for (const cmd of ["t:([] n:1+til 6; sq:{x*x} 1+til 6)", "select from t where sq>9"]) {
      await typeText(p, r, cmd, 1);
      await p.keyboard.press("Escape"); await p.keyboard.press("Enter"); r.mark("enter");
      await r.hold(14);
    }
    await r.hold(30);
    done("console", r); await ctx.close();
  },
  // stills for the guide
  async stills(b) {
    await import("./stills.mjs").then((m) => m.default(b, { fresh, URL }));
  },
};
const b = await chromium.launch();
import { existsSync, readFileSync } from "node:fs";
Object.assign(meta, existsSync("clips/meta.json") ? { ...JSON.parse(readFileSync("clips/meta.json", "utf8")), ...meta } : {});
for (const [k, f] of Object.entries(clips)) if (only.length ? only.includes(k) : k !== "stills") {
  const t = Date.now(); await f(b); console.log(k, Date.now() - t, "ms");
  writeFileSync("clips/meta.json", JSON.stringify(meta));
}
await b.close();
