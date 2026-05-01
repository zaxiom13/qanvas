import { describe, expect, it } from "vitest";
import { createSession, formatValue } from "../src/index";
import { EXAMPLES } from "../../../app/src/lib/examples";
import { compileSketch } from "../../../app/src/lib/compiler/compile";
import { createCompiledRuntimeHelpers } from "../../../app/src/lib/runtime/compiled-runtime-helpers";

function runCompiledExample(exampleId: string, frameNum = 12) {
  const example = EXAMPLES.find((entry) => entry.id === exampleId);
  expect(example).toBeTruthy();

  const compiled = compileSketch(example!.code);
  expect(compiled.status).toBe("compiled");
  expect(compiled.code).toBeTruthy();

  const module = new Function(`return ${compiled.code};`)() as {
    setup: (rt: ReturnType<typeof createCompiledRuntimeHelpers>) => unknown;
    draw: (
      state: unknown,
      frameInfo: Record<string, unknown>,
      input: Record<string, unknown>,
      canvas: Record<string, unknown>,
      rt: ReturnType<typeof createCompiledRuntimeHelpers>
    ) => unknown;
  };

  const rt = createCompiledRuntimeHelpers();
  rt.resetCommands();
  const state = module.setup(rt);
  rt.takeCommands();
  rt.resetCommands();
  module.draw(
    state,
    { frameNum, timeMs: frameNum * 16.67 },
    { mouse: [320, 240], mouseButtons: { left: false, right: false } },
    { size: [800, 600], pixelRatio: 1 },
    rt
  );
  return rt.takeCommands();
}

const INTERPRETER_BOOT = [
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

function normalizeForEngine(source: string) {
  return source.replace(/\b0x([0-9A-Fa-f]+)\b/g, (_, hex: string) => String(Number.parseInt(hex, 16)));
}

function toQLiteral(value: unknown): string {
  if (value === null || value === undefined) return "()";
  if (typeof value === "number") return Number.isFinite(value) ? `${value}` : "0n";
  if (typeof value === "boolean") return value ? "1b" : "0b";
  if (typeof value === "string") return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
  if (Array.isArray(value)) return value.length ? `(${value.map((entry) => toQLiteral(entry)).join(";")})` : "()";
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 1) {
    const [key, entry] = entries[0]!;
    return `enlist \`${key.replace(/[^\w]/g, "_")}!enlist ${toQLiteral(entry)}`;
  }
  return `${entries.map(([key]) => `\`${key.replace(/[^\w]/g, "_")}`).join("")}!(${entries.map(([, entry]) => toQLiteral(entry)).join(";")})`;
}

function runInterpreterExample(exampleId: string, frameNum = 12) {
  const example = EXAMPLES.find((entry) => entry.id === exampleId);
  expect(example).toBeTruthy();

  const session = createSession();
  session.evaluate(INTERPRETER_BOOT);
  session.evaluate(normalizeForEngine(example!.code));
  session.evaluate(".qv.result:.qv.init[]");
  return formatValue(
    session.evaluate(
      `.qv.frame[${toQLiteral({ frameNum, timeMs: frameNum * 16.67 })};${toQLiteral({ mouse: [320, 240], mouseButtons: { left: false, right: false } })};${toQLiteral({ size: [800, 600], pixelRatio: 1 })}]`
    ).value
  );
}

describe("compiled example runtime", () => {
  it("supports prd in compiled grid shape expressions", () => {
    const commands = runCompiledExample("color-grid");
    const rectCommand = commands.find((command) => command.kind === "rect") as { data: Array<{ p: [number, number] }> } | undefined;
    expect(rectCommand).toBeTruthy();
    expect(rectCommand!.data).toHaveLength(300);
    expect(rectCommand!.data[0]!.p).toEqual([0, 0]);
    expect(rectCommand!.data[20]!.p).toEqual([0, 40]);
  });

  it("draws hello-circle with compiled null-match against mouse", () => {
    const commands = runCompiledExample("hello-circle");
    expect(commands.some((c) => c.kind === "circle")).toBe(true);
  });

  it("broadcasts point vectors over general lists in compiled draw tables", () => {
    const source = `setup:{
  \`size\`bg!(539 1048;0)
}
draw:{[state;frameInfo;input;canvas]
  circle[([]
    p:(2#enlist 0.5*canvas\`size)+(0 0;72 72);
    r:44 28;
    fill:(Color.BLUE;Color.CORAL);
    alpha:0.92 0.82
  )];
  state
}`;
    const compiled = compileSketch(source);
    expect(compiled.status).toBe("compiled");
    const module = new Function(`return ${compiled.code};`)() as {
      setup: (rt: ReturnType<typeof createCompiledRuntimeHelpers>) => unknown;
      draw: (
        state: unknown,
        frameInfo: Record<string, unknown>,
        input: Record<string, unknown>,
        canvas: Record<string, unknown>,
        rt: ReturnType<typeof createCompiledRuntimeHelpers>
      ) => unknown;
    };
    const rt = createCompiledRuntimeHelpers();
    const state = module.setup(rt);
    rt.takeCommands();
    module.draw(state, { frameNum: 1 }, {}, { size: [539, 1048], pixelRatio: 1 }, rt);
    const circleCommand = rt.takeCommands().find((command) => command.kind === "circle") as { data: Array<{ p: [number, number] }> } | undefined;

    expect(circleCommand?.data).toHaveLength(2);
    expect(circleCommand!.data[0]!.p).toEqual([269.5, 524]);
    expect(circleCommand!.data[1]!.p).toEqual([341.5, 596]);
  });

  it("plucks columns from rt.table rows so orbit-dance planets sit on distinct orbits", () => {
    const commands = runCompiledExample("orbit-dance");
    const circles = commands.filter((command) => command.kind === "circle") as Array<{
      kind: string;
      data: Array<{ p: [number, number] }>;
    }>;
    expect(circles).toHaveLength(3);
    const planets = circles[2]!;
    expect(planets.data).toHaveLength(4);
    const keys = new Set(planets.data.map((row) => `${row.p[0].toFixed(4)},${row.p[1].toFixed(4)}`));
    expect(keys.size).toBe(4);
  });

  it("supports compiled reduction families and derived primitive over/scan forms", () => {
    const source = `setup:{\`size\`bg!(800 600;0)}
draw:{[state;frameInfo;input;canvas]
  n:20 15;
  a:(*/) n;
  b:prd n;
  c:last (*\\) n;
  d:last prds n;
  e:last sums 1 2 3;
  f:last avgs 2 4 6;
  a,b,c,d,e,f
}`;
    const compiled = compileSketch(source);
    expect(compiled.status).toBe("compiled");
    const module = new Function(`return ${compiled.code};`)() as {
      setup: (rt: ReturnType<typeof createCompiledRuntimeHelpers>) => unknown;
      draw: (
        state: unknown,
        frameInfo: Record<string, unknown>,
        input: Record<string, unknown>,
        canvas: Record<string, unknown>,
        rt: ReturnType<typeof createCompiledRuntimeHelpers>
      ) => unknown;
    };
    const rt = createCompiledRuntimeHelpers();
    const state = module.setup(rt);
    expect(module.draw(state, { frameNum: 1 }, {}, { size: [800, 600] }, rt)).toEqual([300, 300, 300, 300, 6, 4]);
  });

  it("emits show output from compiled setup and draw while returning the shown value", () => {
    const source = `setup:{
  show \`size\`bg!(800 600;0)
}
draw:{[state;frameInfo;input;canvas]
  show 0.5*canvas\`size;
  show 44+18*sin 0.05*frameInfo\`frameNum
}`;
    const compiled = compileSketch(source);
    expect(compiled.status).toBe("compiled");
    expect(compiled.code).toContain('rt.callBuiltin("show"');

    const module = new Function(`return ${compiled.code};`)() as {
      setup: (rt: ReturnType<typeof createCompiledRuntimeHelpers>) => unknown;
      draw: (
        state: unknown,
        frameInfo: Record<string, unknown>,
        input: Record<string, unknown>,
        canvas: Record<string, unknown>,
        rt: ReturnType<typeof createCompiledRuntimeHelpers>
      ) => unknown;
    };
    const stdout: string[] = [];
    const rt = createCompiledRuntimeHelpers({ onStdout: (text) => stdout.push(text) });
    const state = module.setup(rt);
    const result = module.draw(state, { frameNum: 1 }, {}, { size: [800, 600] }, rt);

    expect(state).toEqual({ size: [800, 600], bg: 0 });
    expect(result).toBeCloseTo(44.89962503124896);
    expect(stdout[0]).toContain('"size": [800 600]');
    expect(stdout[0]).toContain('"bg": 0');
    expect(stdout[1]).toBe('[400 300]');
    expect(Number(stdout[2])).toBeCloseTo(44.89962503124896);
  });

  it("keeps text-poster centered instead of collapsing to the corner", () => {
    const commands = runCompiledExample("text-poster");
    const textCommand = commands.find((command) => command.kind === "text") as { data: Array<{ p: [number, number] }> } | undefined;
    expect(textCommand).toBeTruthy();
    expect(textCommand!.data).toHaveLength(4);
    const xs = textCommand!.data.map((row) => row.p[0]);
    const ys = textCommand!.data.map((row) => row.p[1]);
    expect(Math.min(...xs)).toBeGreaterThan(300);
    expect(Math.max(...xs)).toBeLessThan(500);
    expect(new Set(ys).size).toBe(4);
  });

  it("keeps line-weave animated by separating p and p2 and changing over time", () => {
    const frameA = runCompiledExample("line-weave", 12);
    const frameB = runCompiledExample("line-weave", 48);
    const lineA = frameA.find((command) => command.kind === "line") as { data: Array<{ p: [number, number]; p2: [number, number] }> } | undefined;
    const lineB = frameB.find((command) => command.kind === "line") as { data: Array<{ p: [number, number]; p2: [number, number] }> } | undefined;
    expect(lineA).toBeTruthy();
    expect(lineB).toBeTruthy();
    expect(lineA!.data.some((row) => row.p2[1] !== row.p[1])).toBe(true);
    expect(lineA!.data.map((row) => row.p2[1])).not.toEqual(lineB!.data.map((row) => row.p2[1]));
  });

  it("splices generic inner commands like q boot (push/translate/generic rotate)", () => {
    const source = `setup:{\`size\`bg!(800 600;0)}
draw:{[state;frameInfo;input;canvas]
  push[];
  translate[0.5*canvas\`size];
  generic[enlist \`kind\`angle!(\`rotate;0.25)];
  state
}`;
    const compiled = compileSketch(source);
    expect(compiled.status).toBe("compiled");
    expect(compiled.code).toContain('rt.callBuiltin("generic"');
    expect(compiled.code).not.toMatch(/rt\.call\(generic/);

    const module = new Function(`return ${compiled.code};`)() as {
      setup: (rt: ReturnType<typeof createCompiledRuntimeHelpers>) => unknown;
      draw: (
        state: unknown,
        frameInfo: Record<string, unknown>,
        input: Record<string, unknown>,
        canvas: Record<string, unknown>,
        rt: ReturnType<typeof createCompiledRuntimeHelpers>
      ) => unknown;
    };
    const rt = createCompiledRuntimeHelpers();
    const state = module.setup(rt);
    rt.takeCommands();
    module.draw(state, { frameNum: 1 }, {}, { size: [800, 600], pixelRatio: 1 }, rt);
    const commands = rt.takeCommands();
    expect(commands.map((c) => c.kind)).toEqual(["push", "translate", "rotate"]);
    const rotate = commands[2] as { kind: string; angle?: unknown };
    expect(rotate.angle).toBe(0.25);
  });

  it("keeps lissajous-dots moving between frames on the interpreter path", () => {
    const compiled = compileSketch(EXAMPLES.find((entry) => entry.id === "lissajous-dots")!.code);
    expect(compiled.status).toBe("unsupported");

    const frameA = runInterpreterExample("lissajous-dots", 12);
    const frameB = runInterpreterExample("lissajous-dots", 48);
    expect(frameA).toContain("kind");
    expect(frameA).toContain("circle");
    expect(frameA).not.toEqual(frameB);
  });

  it("does not emit invalid JavaScript for leading-dot q identifiers", () => {
    const source = `setup:{[] \`size\`bg!(800 600;Color.INK);:()}
draw:{[s].cx.new[1;2];:s}`;
    const compiled = compileSketch(source);
    expect(compiled.status).toBe("unsupported");
    expect(compiled.unsupported).toContain("dotted-root-identifier");
    expect(compiled.code).toBeNull();
  });
});
