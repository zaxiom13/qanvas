// Curated sketches live as plain .q files in ./examples with a small metadata header:
//   / @title ...   / @level ...   / @blurb ...
export type Level = "first steps" | "moving" | "arrays" | "worlds" | "big ideas";

export interface Example {
  id: string;
  title: string;
  blurb: string;
  level: Level;
  code: string;
}

export const LEVELS: Level[] = ["first steps", "moving", "arrays", "worlds", "big ideas"];

export function parseSketchFile(file: string, raw: string): Example {
  const meta: Record<string, string> = {};
  const lines = raw.replace(/\r/g, "").split("\n");
  let i = 0;
  for (; i < lines.length; i++) {
    const m = /^\/ @(\w+)\s+(.*)$/.exec(lines[i]);
    if (!m) break;
    meta[m[1]] = m[2].trim();
  }
  while (i < lines.length && !lines[i].trim()) i++;
  const id = file.replace(/^.*\//, "").replace(/\.q$/, "").replace(/^\d+-/, "");
  return {
    id,
    title: meta.title ?? id,
    blurb: meta.blurb ?? "",
    level: (meta.level as Level) ?? "first steps",
    code: lines.slice(i).join("\n").trimEnd() + "\n",
  };
}

const files = import.meta.glob("./examples/*.q", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export const EXAMPLES: Example[] = Object.keys(files)
  .sort()
  .map((f) => parseSketchFile(f, files[f]));

export const EXAMPLE_BY_ID = new Map(EXAMPLES.map((e) => [e.id, e]));

export const DEFAULT_SKETCH = `/ Welcome to the studio. Press Run (or Ctrl+Enter).
/ Hold Alt and drag any number to change it live.

draw:{
  background 20;
  ink hsb[time%5;0.6;1];
  circle[mouse;40+20*sin 3*time]
 }
`;
