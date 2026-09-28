// Screenshots for docs/guide. Phone size (390x844 @2x) unless noted.
import { mkdirSync } from "node:fs";
const OUT = new URL("../../docs/guide/img", import.meta.url).pathname;

export default async function (b, { fresh, URL }) {
  mkdirSync(OUT, { recursive: true });
  // CSS transitions run on real time, not the fake clock: let them settle
  const shot = async (p, name, opts = {}) => (await p.waitForTimeout(700), p.screenshot({ path: `${OUT}/${name}.png`, ...opts }));
  const hideFinger = (p) => p.evaluate(() => document.getElementById("finger")?.remove());
  const scrollToCell = (p, prefix, off) => p.evaluate(([prefix, off]) => __scroll(__top(prefix) - off), [prefix, off]);
  const pick = async (p, prefix, label) => {
    await p.evaluate(([prefix, label]) => {
      let el = [...document.querySelectorAll(".cm-content")].find((e) => e.textContent.startsWith(prefix));
      while (el && ![...el.querySelectorAll("button")].some((b) => b.textContent.trim() === label)) el = el.parentElement;
      [...el.querySelectorAll("button")].find((b) => b.textContent.trim() === label).dataset.pick = prefix;
    }, [prefix, label]);
    return p.locator(`button[data-pick="${prefix}"]`);
  };
  const example = async (p, title) => {
    await p.getByRole("tab", { name: "Code" }).click(); await p.clock.runFor(200);
    await p.getByTitle("Examples").click(); await p.clock.runFor(500);
    await p.getByText(title, { exact: true }).click(); await p.clock.runFor(800);
  };

  // --- Learn
  {
    const { p, ctx } = await fresh(b); await hideFinger(p);
    await p.goto(URL + "#/learn"); await p.clock.runFor(2000); await hideFinger(p);
    await shot(p, "learn-home");
    await p.goto(URL + "#/learn/lists"); await p.clock.runFor(1200); await hideFinger(p);
    await shot(p, "lesson-top");
    await scrollToCell(p, "til 10", 330);
    await (await pick(p, "til 10", "Run")).click(); await p.clock.runFor(600);
    await shot(p, "lesson-run");
    await scrollToCell(p, "xs:30+60*til 10", 140);
    await (await pick(p, "xs:30+60*til 10", "Draw")).click(); await p.clock.runFor(900);
    await shot(p, "lesson-draw");
    await p.getByRole("button", { name: "Shrink canvas" }).click(); await p.clock.runFor(400);
    await shot(p, "lesson-pip");
    await p.getByRole("button", { name: "Hide the mini canvas" }).click(); await p.clock.runFor(300);
    // the challenge at the end of the lesson
    await p.evaluate(() => { const c = document.querySelector("[aria-label=Challenge]"); const sc = __sc(); sc.scrollTop = c.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 80; });
    await p.clock.runFor(300);
    await p.getByRole("button", { name: "Hint" }).first().click(); await p.clock.runFor(300);
    await shot(p, "lesson-challenge");
    await ctx.close();
  }
  // --- Studio
  {
    const { p, ctx } = await fresh(b);
    await p.goto(URL + "#/sketch"); await p.clock.runFor(1500); await hideFinger(p);
    await example(p, "Ripples");
    const cv = await p.locator("canvas").first().boundingBox();
    await p.mouse.move(cv.x + cv.width * 0.4, cv.y + cv.height * 0.4); await p.clock.runFor(1000);
    await shot(p, "studio-canvas");
    await p.getByRole("tab", { name: "Code" }).click(); await p.clock.runFor(800);
    await shot(p, "studio-code");
    await p.getByTitle("Examples").click(); await p.clock.runFor(800);
    await shot(p, "studio-examples");
    await p.keyboard.press("Escape"); await p.clock.runFor(300);
    if (await p.getByRole("dialog").count()) await p.getByRole("button", { name: /close/i }).first().click().catch(() => {});
    await p.clock.runFor(300);
    // an error, explained
    await p.getByRole("tab", { name: "Code" }).click();
    await p.getByRole("textbox", { name: "Sketch code" }).click();
    await p.keyboard.press("Control+a");
    await p.keyboard.insertText("background 20\nink `coral\ncircle[center;\"big\"]");
    await p.clock.runFor(1500);
    await shot(p, "studio-error");
    await p.getByRole("tab", { name: "Canvas" }).click(); await p.clock.runFor(300);
    await shot(p, "studio-error-canvas");
    await p.getByRole("tab", { name: "Console" }).click(); await p.clock.runFor(300);
    await p.getByLabel("q console input").click();
    for (const cmd of ["t:([] n:1+til 6; sq:{x*x} 1+til 6)", "select from t where sq>9", "til 10"]) {
      await p.keyboard.insertText(cmd); await p.keyboard.press("Escape"); await p.keyboard.press("Enter"); await p.clock.runFor(300);
    }
    await shot(p, "studio-console");
    await ctx.close();
  }
  // --- Dojo
  {
    const { p, ctx } = await fresh(b);
    await p.goto(URL + "#/dojo"); await p.clock.runFor(1200); await hideFinger(p);
    await shot(p, "dojo-list");
    await p.goto(URL + "#/dojo/dojo:lists:dot-product"); await p.clock.runFor(1000);
    const line = p.getByRole("textbox", { name: "Challenge code" }).locator(".cm-line", { hasText: "answer:0" });
    await line.click(); await p.keyboard.press("End"); await p.keyboard.press("Backspace");
    await p.keyboard.insertText("sum a*b"); await p.keyboard.press("Escape");
    await p.getByRole("button", { name: "Check" }).click(); await p.clock.runFor(600);
    await shot(p, "dojo-solved");
    await ctx.close();
  }
  // --- Reference
  {
    const { p, ctx } = await fresh(b);
    await p.goto(URL + "#/ref"); await p.clock.runFor(1200); await hideFinger(p);
    await p.getByLabel("Search the reference").fill("circle"); await p.clock.runFor(400);
    await shot(p, "ref-search");
    await p.locator("button.entry", { has: p.locator("code.nm", { hasText: /^circle$/ }) }).click(); await p.clock.runFor(800);
    await shot(p, "ref-detail");
    await ctx.close();
  }
  // --- Desktop, light and dark
  for (const theme of ["light", "dark"]) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, colorScheme: theme });
    const p = await ctx.newPage();
    await p.clock.install({ time: new Date("2026-09-28T10:00:00") });
    await p.goto(URL + "#/sketch"); await p.clock.runFor(1500);
    await p.getByTitle("Examples").click(); await p.clock.runFor(600);
    await p.getByText(theme === "light" ? "Swarm" : "Flow field", { exact: true }).click();
    const cv = await p.locator("canvas").first().boundingBox();
    await p.mouse.move(cv.x + cv.width * 0.6, cv.y + cv.height * 0.4);
    await p.clock.runFor(theme === "light" ? 1500 : 4000);
    await p.screenshot({ path: `${OUT}/desktop-${theme}.png` });
    await ctx.close();
  }
}
