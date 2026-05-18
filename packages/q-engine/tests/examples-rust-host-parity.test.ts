/**
 * Parity between the jqport interpreter path used by examples-runtime and the
 * statement-normalized loader used by the Rust WASM host bridge.
 */
import { describe, expect, it } from "vitest";
import { createSession } from "../src/index";
import { EXAMPLES } from "../../../app/src/lib/examples";
import { loadSketchSource } from "../../../app/src/lib/browser/sketch-source-loader";
import { rewriteQanvasCompat, toQLiteral } from "../../../app/src/lib/browser/sketch-q-literals";

const BOOT_SOURCE = [
  ".qv.cmds:enlist 0N",
  ".qv.state:()",
  ".qv.config:()",
  "Color.INK:855327",
  "Color.NIGHT:329228",
  "Color.MIDNIGHT:724250",
  "Color.DEEP:528424",
  "Color.BLUE:5992424",
  "Color.SKY:8169215",
  "Color.GOLD:12883310",
  "Color.CORAL:14711378",
  "Color.RED:13723982",
  "Color.PURPLE:9202633",
  "Color.GREEN:5152658",
  "Color.CREAM:16051416",
  "Color.YELLOW:16769696",
  "Color.SOFT_YELLOW:16769720",
  "Color.LAVENDER:14989311",
  "Color.ORBIT:2500938",
  ".qv.append:{[cmd].qv.cmds,:enlist cmd;:cmd}",
  "background:{[fill].qv.append[`kind`fill!(`background;fill)]}",
  "circle:{[data].qv.append[`kind`data!(`circle;data)]}",
  "rect:{[data].qv.append[`kind`data!(`rect;data)]}",
  "triangle:{[data].qv.append[`kind`data!(`triangle;data)]}",
  "pixel:{[data].qv.append[`kind`data!(`pixel;data)]}",
  "line:{[data].qv.append[`kind`data!(`line;data)]}",
  "text:{[data].qv.append[`kind`data!(`text;data)]}",
  "image:{[data].qv.append[`kind`data!(`image;data)]}",
  "generic:{[cmds].qv.cmds,:$[0h=type cmds;cmds;enlist cmds];:cmds}",
  "push:{[].qv.append[enlist[`kind]!enlist `push]}",
  "pop:{[].qv.append[enlist[`kind]!enlist `pop]}",
  "translate:{[xy].qv.append[`kind`x`y!(`translate;first xy;last xy)]}",
  "scale:{[xy]if[1=count xy;xy:xy,xy];.qv.append[`kind`x`y!(`scale;first xy;last xy)]}",
  "cursor:{[name].qv.append[`kind`cursor!(`cursor;name)]}",
  ".qv.init:{.qv.cmds:enlist 0N;result:setup[];.qv.state:result;.qv.config:result;:result}",
  ".qv.frame:{[frameJson;inputJson;canvasJson].qv.cmds:enlist 0N;state1:draw[.qv.state;frameJson;inputJson;canvasJson];.qv.state:state1;:1_.qv.cmds}"
].join(";\n");

const FRAME_INFO = { frameNum: 12, timeMs: 200 };
const INPUT = { mouse: [320, 240], mouseButtons: { left: false, right: false } };
const CANVAS = { size: [800, 600], pixelRatio: 1 };

const SLOW_EXAMPLE_TIMEOUT_MS = 20_000;
const SLOW_EXAMPLE_IDS = new Set<string>(["mandelbrot-static"]);

function runWithHostLoader(exampleCode: string) {
  const session = createSession();
  loadSketchSource(session, BOOT_SOURCE);
  loadSketchSource(session, rewriteQanvasCompat(exampleCode));
  session.evaluate(".qv.result:.qv.init[]");
  session.evaluate(`.qv.frame[${toQLiteral(FRAME_INFO)};${toQLiteral(INPUT)};${toQLiteral(CANVAS)}]`);
}

function runWithBulkEvaluate(exampleCode: string) {
  const session = createSession();
  session.evaluate(BOOT_SOURCE);
  session.evaluate(rewriteQanvasCompat(exampleCode));
  session.evaluate(".qv.result:.qv.init[]");
  session.evaluate(`.qv.frame[${toQLiteral(FRAME_INFO)};${toQLiteral(INPUT)};${toQLiteral(CANVAS)}]`);
}

describe("rust host loader parity with interpreter", () => {
  for (const example of EXAMPLES) {
    it(
      `host loader runs ${example.id}`,
      () => {
        expect(() => runWithHostLoader(example.code)).not.toThrow();
      },
      SLOW_EXAMPLE_IDS.has(example.id) ? SLOW_EXAMPLE_TIMEOUT_MS : undefined
    );
  }

  it("host loader matches bulk evaluate for hello-circle", () => {
    const example = EXAMPLES.find((entry) => entry.id === "hello-circle");
    expect(example).toBeTruthy();

    const hostSession = createSession();
    loadSketchSource(hostSession, BOOT_SOURCE);
    loadSketchSource(hostSession, rewriteQanvasCompat(example!.code));
    const hostInit = hostSession.evaluate(".qv.result:.qv.init[]");
    const hostFrame = hostSession.evaluate(
      `.qv.frame[${toQLiteral(FRAME_INFO)};${toQLiteral(INPUT)};${toQLiteral(CANVAS)}]`
    );

    const bulkSession = createSession();
    bulkSession.evaluate(BOOT_SOURCE);
    bulkSession.evaluate(rewriteQanvasCompat(example!.code));
    const bulkInit = bulkSession.evaluate(".qv.result:.qv.init[]");
    const bulkFrame = bulkSession.evaluate(
      `.qv.frame[${toQLiteral(FRAME_INFO)};${toQLiteral(INPUT)};${toQLiteral(CANVAS)}]`
    );

    expect(hostInit.formatted).toBe(bulkInit.formatted);
    expect(hostFrame.formatted).toBe(bulkFrame.formatted);
  });
});
