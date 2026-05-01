import { describe, expect, it } from "vitest";
import { createSession, parse, type AstNode } from "../src/index";
import { EXAMPLES } from "../../../app/src/lib/examples";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const Q_BIN = process.env.QANVAS_Q_BIN || `${process.env.HOME}/.kx/bin/q`;

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

function normalizeForEngine(source: string) {
  return source.replace(/\b0x([0-9A-Fa-f]+)\b/g, (_, hex: string) => String(Number.parseInt(hex, 16)));
}

function normalizeForRealQ(source: string) {
  return normalizeForEngine(source)
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function convertValue(value: any, mode: "columns" | "rows" = "columns"): unknown {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map((entry) => convertValue(entry, mode));
  if (typeof value !== "object") return value;

  switch (value.kind) {
    case "null":
      return null;
    case "boolean":
      return Boolean(value.value);
    case "number":
      if (value.special === "null" || value.special === "intNull") return null;
      return Number.isFinite(value.value) ? value.value : String(value.value);
    case "symbol":
    case "string":
    case "temporal":
      return value.value;
    case "list":
      return (value.items ?? []).map((entry: unknown) => convertValue(entry, mode));
    case "dictionary":
      return convertDictionary(value, mode);
    case "table":
      return convertTable(value, mode);
    case "keyedTable":
      return {
        keys: convertValue(value.keys, mode),
        values: convertValue(value.values, mode),
      };
    case "namespace":
      return convertNamespace(value, mode);
    case "error":
      return { name: value.name, message: value.message };
    case "lambda":
      return { kind: "lambda", params: value.params ?? null, source: value.source };
    case "projection":
      return {
        kind: "projection",
        target: convertValue(value.target, mode),
        args: (value.args ?? []).map((entry: unknown) => (entry === null ? null : convertValue(entry, mode))),
        arity: value.arity,
      };
    case "builtin":
      return { kind: "builtin", name: value.name, arity: value.arity };
    default:
      return value;
  }
}

function convertDictionary(value: any, mode: "columns" | "rows") {
  const keys = Array.isArray(value.keys) ? value.keys : [];
  const entries: Array<[string, unknown]> = [];

  for (let index = 0; index < keys.length; index += 1) {
    const key = normalizeKey(keys[index]);
    entries.push([key, convertValue(value.values?.[index], mode)]);
  }

  return Object.fromEntries(entries);
}

function convertTable(value: any, mode: "columns" | "rows") {
  const columns = value.columns ?? {};
  const columnNames = Object.keys(columns);

  if (mode === "columns") {
    return Object.fromEntries(columnNames.map((name) => [name, convertValue(columns[name], "columns")]));
  }

  const rowCount = columnNames.length > 0 ? getColumnLength(columns[columnNames[0]]) : 0;
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const row: Record<string, unknown> = {};
    for (const name of columnNames) {
      row[name] = getColumnItem(columns[name], rowIndex);
    }
    return row;
  });
}

function convertNamespace(value: any, mode: "columns" | "rows") {
  const entries = value.entries instanceof Map ? [...value.entries.entries()] : Object.entries(value.entries ?? {});
  return Object.fromEntries(entries.map(([name, entry]) => [name, convertValue(entry, mode)]));
}

function normalizeKey(value: unknown) {
  const converted = convertValue(value, "columns");
  if (typeof converted === "string") return converted;
  if (typeof converted === "number" || typeof converted === "boolean") return String(converted);
  return JSON.stringify(converted);
}

function getColumnLength(value: any) {
  if (value?.kind === "list" && Array.isArray(value.items)) return value.items.length;
  if (Array.isArray(value)) return value.length;
  return 0;
}

function getColumnItem(value: any, index: number) {
  if (value?.kind === "list" && Array.isArray(value.items)) return convertValue(value.items[index], "columns");
  if (Array.isArray(value)) return convertValue(value[index], "columns");
  return convertValue(value, "columns");
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
    return `enlist \`${sanitizeSymbol(key)}!enlist ${toQLiteral(entry)}`;
  }
  return `${entries.map(([key]) => `\`${sanitizeSymbol(key)}`).join("")}!(${entries.map(([, entry]) => toQLiteral(entry)).join(";")})`;
}

function sanitizeSymbol(value: string) {
  return value.replace(/[^\w]/g, "_");
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stable(entry)])
    );
  }
  return value;
}

function normalizeRealQJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeRealQJson);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, normalizeRealQJson(entry)])
  );
}

type ParseShape = {
  root: string | null;
  assignments: string[];
};

function realQParseShape(tree: unknown): ParseShape {
  const assignments: string[] = [];

  let root = (() => {
    if (Array.isArray(tree)) return typeof tree[0] === "string" ? tree[0] : null;
    if (typeof tree === "string") return "lambda";
    if (tree && typeof tree === "object") return "object";
    return null;
  })();

  const visit = (node: unknown) => {
    if (!Array.isArray(node)) return;
    if (node[0] === ":" && typeof node[1] === "string") {
      assignments.push(node[1]);
    }
    for (const child of node.slice(1)) visit(child);
  };

  visit(tree);
  if (assignments.length > 1) root = "program";
  return { root, assignments };
}

function localParseShape(ast: AstNode): ParseShape {
  const assignments: string[] = [];

  const rootOf = (node: AstNode): string | null => {
    switch (node.kind) {
      case "program":
        return node.statements.length > 0 ? rootOf(node.statements[node.statements.length - 1]!) : null;
      case "assign":
      case "assignGlobal":
        return ":";
      case "binary":
        return node.op;
      case "call":
        return rootOf(node.callee);
      case "identifier":
        return node.name;
      case "lambda":
        return "lambda";
      case "select":
      case "exec":
        return "?";
      case "update":
        return "!";
      case "delete":
        return "_";
      case "cond":
        return "$";
      case "if":
        return "if";
      case "while":
        return "while";
      case "do":
        return "do";
      case "return":
        return ":";
      case "group":
        return rootOf(node.value);
      default:
        return node.kind;
    }
  };

  const visit = (node: AstNode) => {
    switch (node.kind) {
      case "program":
        node.statements.forEach(visit);
        break;
      case "assign":
      case "assignGlobal":
        assignments.push(node.name);
        visit(node.value);
        break;
      default:
        break;
    }
  };

  visit(ast);
  return { root: assignments.length > 1 ? "program" : rootOf(ast), assignments };
}

function runRealQParse(exampleCode: string): ParseShape {
  const dir = mkdtempSync(join(tmpdir(), "qanvas-qparse-"));
  const sourcePath = join(dir, "source.q");
  const outputPath = join(dir, "parse.json");
  const runnerPath = join(dir, "runner.q");

  try {
    writeFileSync(sourcePath, normalizeForEngine(exampleCode).replace(/\r\n/g, "\n"), "utf8");
    writeFileSync(
      runnerPath,
      [
        `source:"\\n" sv read0 \`:source.q`,
        `(\`$":${outputPath}") 0: enlist .j.j parse source`,
        "\\\\"
      ].join("\n"),
      "utf8"
    );

    const result = spawnSync(Q_BIN, [runnerPath], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, QHOME: process.env.QHOME || `${process.env.HOME}/.kx` },
    });

    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || `q exited with code ${result.status}`);
    }

    return realQParseShape(JSON.parse(readFileSync(outputPath, "utf8")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runInterpreter(exampleCode: string) {
  const session = createSession();
  session.evaluate(INTERPRETER_BOOT);
  session.evaluate(normalizeForEngine(exampleCode));

  const init = convertValue(session.evaluate(".qv.result:.qv.init[]").value, "rows");
  const initState = convertValue(session.evaluate(".qv.state").value, "rows");
  session.evaluate(`.qv.frame[${toQLiteral(FRAME_INFO)};${toQLiteral(INPUT)};${toQLiteral(CANVAS)}]`);
  const frameState = convertValue(session.evaluate(".qv.state").value, "rows");

  return {
    init: stable(init),
    initState: stable(initState),
    frameState: stable(frameState),
  };
}

function runRealQ(exampleCode: string) {
  const dir = mkdtempSync(join(tmpdir(), "qanvas-qdiff-"));
  const sketchPath = join(dir, "sketch.q");
  const initPath = join(dir, "init.json");
  const initStatePath = join(dir, "init-state.json");
  const frameStatePath = join(dir, "frame-state.json");
  const runnerPath = join(dir, "runner.q");

  try {
    writeFileSync(sketchPath, normalizeForRealQ(exampleCode), "utf8");
    writeFileSync(
      runnerPath,
      [
        ".cx.new:{[re;im] `re`im!(re;im)}",
        ".cx.mul:{[a;b] `re`im!(((a`re)*(b`re))-((a`im)*(b`im));((a`re)*(b`im))+((a`im)*(b`re)))}",
        ".cx.abs:{[z] sqrt ((z`re)*(z`re))+((z`im)*(z`im))}",
        "\\d .qv",
        "cmds:enlist (::)",
        "state:()",
        "config:()",
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
        "append:{[cmd] cmds,:enlist cmd; :cmd}",
        "background:{[fill] append `kind`fill!(`background;fill)}",
        "circle:{[data] append `kind`data!(`circle;data)}",
        "rect:{[data] append `kind`data!(`rect;data)}",
        "pixel:{[data] append `kind`data!(`pixel;data)}",
        "line:{[data] append `kind`data!(`line;data)}",
        "text:{[data] append `kind`data!(`text;data)}",
        "image:{[data] append `kind`data!(`image;data)}",
        "generic:{[x] cmds,:$[0h=type x;x;enlist x]; :x}",
        "push:{[] append enlist[`kind]!enlist `push}",
        "pop:{[] append enlist[`kind]!enlist `pop}",
        "translate:{[xy] append `kind`x`y!(`translate;first xy;last xy)}",
        "scale:{[xy] if[1=count xy;xy:xy,xy]; append `kind`x`y!(`scale;first xy;last xy)}",
        "cursor:{[name] append `kind`cursor!(`cursor;name)}",
        "\\d .",
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
        "`background`circle`rect`pixel`line`text`image`generic`push`pop`translate`scale`cursor set' (.qv.background; .qv.circle; .qv.rect; .qv.pixel; .qv.line; .qv.text; .qv.image; .qv.generic; .qv.push; .qv.pop; .qv.translate; .qv.scale; .qv.cursor)",
        `system "l ${sketchPath}"`,
        ".qv.cmds:enlist (::)",
        "initResult:setup[]",
        ".qv.state:initResult",
        ".qv.config:initResult",
        `(\`$":${initPath}") 0: enlist .j.j initResult`,
        `(\`$":${initStatePath}") 0: enlist .j.j .qv.state`,
        `.qv.state:draw[.qv.state;${toQLiteral(FRAME_INFO)};${toQLiteral(INPUT)};${toQLiteral(CANVAS)}]`,
        `(\`$":${frameStatePath}") 0: enlist .j.j .qv.state`,
        "\\\\"
      ].join("\n"),
      "utf8"
    );

    const result = spawnSync(Q_BIN, [runnerPath], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, QHOME: process.env.QHOME || `${process.env.HOME}/.kx` },
    });

    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || `q exited with code ${result.status}`);
    }

    return {
      init: stable(normalizeRealQJson(JSON.parse(readFileSync(initPath, "utf8")))),
      initState: stable(normalizeRealQJson(JSON.parse(readFileSync(initStatePath, "utf8")))),
      frameState: stable(normalizeRealQJson(JSON.parse(readFileSync(frameStatePath, "utf8")))),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const hasRealQ = existsSync(Q_BIN);

describe.skipIf(!hasRealQ)("guided examples real-q differential", () => {
  for (const example of EXAMPLES) {
    it(
      `matches real q for ${example.id}`,
      () => {
        const interpreter = runInterpreter(example.code);
        const realQ = runRealQ(example.code);

        expect(interpreter).toEqual(realQ);
      },
      20_000
    );

    it(`has a q parse shape for ${example.id} that matches the client parser`, () => {
      const clientShape = localParseShape(parse(normalizeForEngine(example.code)));
      const realQShape = runRealQParse(example.code);

      expect(clientShape).toEqual(realQShape);
    });
  }
});
