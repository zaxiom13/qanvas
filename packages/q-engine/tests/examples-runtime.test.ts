import { describe, expect, it } from "vitest";
import { createSession } from "../src/index";
import { EXAMPLES } from "../../../app/src/lib/examples";

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

function convertValue(value: any, mode: "columns" | "rows" = "columns"): unknown {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map((entry) => convertValue(entry, mode));
  if (typeof value !== "object") return value;

  switch (value.kind) {
    case "null":
      return null;
    case "boolean":
    case "symbol":
    case "string":
    case "temporal":
      return value.value;
    case "number":
      return value.special === "null" || value.special === "intNull" ? null : value.value;
    case "list":
      return (value.items ?? []).map((entry: unknown) => convertValue(entry, mode));
    case "dictionary":
      return Object.fromEntries(
        (value.keys ?? []).map((key: any, index: number) => [String(convertValue(key, "columns")), convertValue(value.values?.[index], mode)])
      );
    case "table":
      return convertTable(value, mode);
    default:
      return value;
  }
}

function convertTable(value: any, mode: "columns" | "rows") {
  const columns = value.columns ?? {};
  const names = Object.keys(columns);

  if (mode === "columns") {
    return Object.fromEntries(names.map((name) => [name, convertValue(columns[name], "columns")]));
  }

  const rowCount = names.length > 0 ? getColumnLength(columns[names[0]]) : 0;
  return Array.from({ length: rowCount }, (_, rowIndex) =>
    Object.fromEntries(names.map((name) => [name, getColumnItem(columns[name], rowIndex)]))
  );
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

const FRAME_INFO = { frameNum: 12, timeMs: 200 };
const INPUT = { mouse: [320, 240], mouseButtons: { left: false, right: false } };
const CANVAS = { size: [800, 600], pixelRatio: 1 };

describe("guided examples runtime", () => {
  for (const example of EXAMPLES) {
    it(`runs ${example.id}`, () => {
      const session = createSession();

      session.evaluate(BOOT_SOURCE);
      session.evaluate(normalizeForEngine(example.code));

      expect(() => session.evaluate(".qv.result:.qv.init[]")).not.toThrow();
      expect(() => session.evaluate(`.qv.frame[${toQLiteral(FRAME_INFO)};${toQLiteral(INPUT)};${toQLiteral(CANVAS)}]`)).not.toThrow();
    });
  }

  it("keeps pulse-grid on an evenly spaced grid instead of collapsing from operator precedence drift", () => {
    const example = EXAMPLES.find((entry) => entry.id === "pulse-grid");
    expect(example).toBeTruthy();

    const session = createSession();
    session.evaluate(BOOT_SOURCE);
    session.evaluate(normalizeForEngine(example!.code));
    session.evaluate(".qv.result:.qv.init[]");

    const commands = convertValue(
      session.evaluate(`.qv.frame[${toQLiteral(FRAME_INFO)};${toQLiteral(INPUT)};${toQLiteral(CANVAS)}]`).value,
      "rows"
    ) as Array<{ kind: string; data?: Array<{ p: [number, number] }> }>;

    const circles = commands.find((command) => command.kind === "circle");
    expect(circles?.data).toBeTruthy();
    expect(circles!.data).toHaveLength(300);

    const firstRowXs = circles!.data!.slice(0, 20).map((row) => row.p[0]);
    const firstColumnYs = circles!.data!.filter((_, index) => index % 20 === 0).map((row) => row.p[1]);

    expect(firstRowXs).toEqual([
      20, 60, 100, 140, 180, 220, 260, 300, 340, 380,
      420, 460, 500, 540, 580, 620, 660, 700, 740, 780,
    ]);
    expect(firstColumnYs).toEqual([20, 60, 100, 140, 180, 220, 260, 300, 340, 380, 420, 460, 500, 540, 580]);
  });
});
