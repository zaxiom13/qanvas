import type { Lesson } from "../learning/lesson-parser";
export type { Lesson, Block } from "../learning/lesson-parser";

// Markdown is compiled and validated by the content plugin, not parsed in the browser.
const files = import.meta.glob("./lessons/*.md", { query: "?lesson", import: "default", eager: true }) as Record<string, Lesson>;
export const LESSONS: Lesson[] = Object.keys(files).sort().map((file, i) => ({ ...files[file], n: i + 1 }));
if (new Set(LESSONS.map((lesson) => lesson.id)).size !== LESSONS.length) throw new Error("Duplicate lesson IDs");

export const LESSON_BY_ID = new Map(LESSONS.map((l) => [l.id, l]));

export interface Chapter {
  title: string;
  lessons: Lesson[];
}

export const CHAPTERS: Chapter[] = (() => {
  const out: Chapter[] = [];
  for (const l of LESSONS) {
    let c = out.find((c) => c.title === l.chapter);
    if (!c) out.push((c = { title: l.chapter, lessons: [] }));
    c.lessons.push(l);
  }
  return out;
})();
