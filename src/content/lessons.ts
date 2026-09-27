// Lessons are Markdown files with front matter and runnable q fences:
//   ```q            a cell you can edit & run; the value is shown
//   ```q sketch     runs on the lesson canvas
//   ```q challenge  "your turn": starter code, then %% lines:
//        %% goal <what to do>
//        %% check <q boolean expression> | <message when it fails>
//        %% hint <a nudge>                (several allowed, shown one at a time)
//        %% solution                      (everything after is the model answer)
import { marked, type Token, type Tokens } from "marked";
import { highlightToHtml } from "../editor/qlang";

export type Block =
  | { kind: "html"; html: string }
  | { kind: "cell"; code: string; sketch: boolean; id: string }
  | { kind: "challenge"; id: string; starter: string; goal: string; checks: { expr: string; msg: string }[]; hints: string[]; solution: string };

export interface Lesson {
  id: string;
  n: number;
  title: string;
  chapter: string;
  blurb: string;
  blocks: Block[];
}

function frontMatter(src: string): [Record<string, string>, string] {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  if (!m) return [{}, src];
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return [meta, src.slice(m[0].length)];
}

const renderer = new marked.Renderer();
renderer.codespan = ({ text }: Tokens.Codespan) => {
  const raw = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return `<code class="qi" data-q="${raw.replace(/"/g, "&quot;")}">${highlightToHtml(raw)}</code>`;
};
renderer.link = ({ href, text }: Tokens.Link) => {
  if (href.startsWith("#")) return `<a href="${href}">${text}</a>`;
  return `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
};
renderer.blockquote = ({ tokens }: Tokens.Blockquote) => {
  const inner = marked.parser(tokens, { renderer });
  const kind = /<strong>(Tip|Note|Try it|Heads up|Why)/i.exec(inner)?.[1]?.toLowerCase().replace(/\s+/g, "") ?? "note";
  return `<aside class="callout ${kind}">${inner}</aside>`;
};

function parseChallenge(body: string, id: string): Block {
  const lines = body.split("\n");
  const starter: string[] = [];
  const checks: { expr: string; msg: string }[] = [];
  const hints: string[] = [];
  const solution: string[] = [];
  let goal = "";
  let inSolution = false;
  for (const line of lines) {
    if (inSolution) {
      solution.push(line);
      continue;
    }
    const m = /^%%\s*(\w+)\s*(.*)$/.exec(line);
    if (!m) {
      starter.push(line);
      continue;
    }
    const [, k, rest] = m;
    if (k === "goal") goal = rest;
    else if (k === "hint") hints.push(rest);
    else if (k === "solution") inSolution = true;
    else if (k === "check") {
      const bar = rest.lastIndexOf(" | ");
      checks.push(bar > 0 ? { expr: rest.slice(0, bar).trim(), msg: rest.slice(bar + 3).trim() } : { expr: rest.trim(), msg: "Not quite yet." });
    }
  }
  const trim = (a: string[]) => a.join("\n").replace(/^\n+|\s+$/g, "") + "\n";
  return { kind: "challenge", id, starter: trim(starter), goal, checks, hints, solution: trim(solution) };
}

export function parseLesson(file: string, src: string, n: number): Lesson {
  const [meta, body] = frontMatter(src.replace(/\r/g, ""));
  const id = file.replace(/^.*\//, "").replace(/\.md$/, "").replace(/^\d+-/, "");
  const tokens = marked.lexer(body);
  const blocks: Block[] = [];
  let pending: Token[] = [];
  let cellNo = 0;
  const flush = () => {
    if (!pending.length) return;
    const list = pending as Token[] & { links?: object };
    list.links = (tokens as unknown as { links: object }).links;
    blocks.push({ kind: "html", html: marked.parser(list as never, { renderer }) });
    pending = [];
  };
  for (const t of tokens) {
    if (t.type === "code" && /^q\b/.test((t as Tokens.Code).lang ?? "")) {
      flush();
      const lang = (t as Tokens.Code).lang ?? "q";
      const code = (t as Tokens.Code).text;
      const cid = `${id}:${cellNo++}`;
      if (/challenge/.test(lang)) blocks.push(parseChallenge(code, cid));
      else blocks.push({ kind: "cell", code: code + "\n", sketch: /sketch/.test(lang), id: cid });
    } else pending.push(t);
  }
  flush();
  return { id, n, title: meta.title ?? id, chapter: meta.chapter ?? "Lessons", blurb: meta.blurb ?? "", blocks };
}

const files = import.meta.glob("./lessons/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export const LESSONS: Lesson[] = Object.keys(files)
  .sort()
  .map((f, i) => parseLesson(f, files[f], i + 1));

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
