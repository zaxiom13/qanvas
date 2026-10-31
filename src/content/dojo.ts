// Dojo: stand-alone practice problems, written in the lesson challenge format.
import type { Block, Lesson } from "../learning/lesson-parser";

export type Problem = Extract<Block, { kind: "challenge" }> & { set: string; n: number };

export interface ProblemSet {
  id: string;
  title: string;
  blurb: string;
  problems: Problem[];
}

const files = import.meta.glob("./dojo/*.md", { query: "?lesson", import: "default", eager: true }) as Record<string, Lesson>;

export const DOJO: ProblemSet[] = Object.keys(files)
  .sort()
  .map((f, i) => {
    const l = files[f];
    const problems = l.blocks
      .filter((b): b is Extract<Block, { kind: "challenge" }> => b.kind === "challenge")
      .map((b, n) => ({ ...b, id: b.id.startsWith("dojo:") ? b.id : `dojo:${l.id}:${slug(b.title) || n}`, set: l.id, n: n + 1 }));
    return { id: l.id, title: l.title, blurb: l.blurb, problems };
  });

export const PROBLEMS: Problem[] = DOJO.flatMap((s) => s.problems);
if (new Set(PROBLEMS.map((problem) => problem.id)).size !== PROBLEMS.length) throw new Error("Duplicate problem IDs");
export const PROBLEM_BY_ID = new Map(PROBLEMS.map((p) => [p.id, p]));

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
