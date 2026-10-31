import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { parseLesson } from "../src/learning/lesson-parser.ts";
import { highlightToHtml } from "../src/editor/qlang.ts";

/** Turns authored Markdown into validated, immutable-by-convention content modules. */
export function contentPlugin(): Plugin {
  return {
    name: "qanvas-content",
    enforce: "pre",
    load(id) {
      if (!id.endsWith(".md?lesson")) return;
      const file = id.slice(0, -"?lesson".length);
      this.addWatchFile(file);
      const source = readFileSync(file, "utf8");
      const metadata = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1] ?? "";
      if (!/^id:\s*[a-zA-Z0-9._-]+\s*$/m.test(metadata)) throw new Error(`${file}: an explicit lesson ID is required`);
      const fences = [...source.matchAll(/^```(q[^\n]*)/gm)];
      if (fences.some((fence) => !/\bid=[a-zA-Z0-9:._-]+/.test(fence[1]))) {
        throw new Error(`${file}: every q cell needs a stable id=...`);
      }
      const lesson = parseLesson(file, source, 0, highlightToHtml);
      for (const block of lesson.blocks) {
        if (block.kind === "challenge" && (!block.checks.length || !block.solution.trim())) {
          throw new Error(`${file}: challenge ${block.id} requires checks and a solution`);
        }
      }
      return `export default ${JSON.stringify(lesson)};`;
    },
  };
}
