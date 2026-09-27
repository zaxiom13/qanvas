import { writeFileSync } from "node:fs";
import { LESSONS } from "../src/content/lessons";
import { API_NAMES } from "../src/editor/qlang";
const out: string[] = [];
for (const l of LESSONS) for (const b of l.blocks) {
  if (b.kind !== "cell" || b.sketch) continue;
  const code = b.code.trim();
  const words = code.match(/[a-zA-Z.][\w.]*/g) ?? [];
  if (words.some((w) => API_NAMES.has(w) || w.startsWith(".cx") || w === "drawn")) continue;
  out.push(code.split("\n").join(";"));
}
writeFileSync("test/corpus/lessons.q", out.join("\n") + "\n");
console.log(out.length, "cells");
