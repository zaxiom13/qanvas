import { HighlightStyle, StreamLanguage, syntaxHighlighting, type StringStream } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { REFERENCE } from "../content/reference";

const Q_KEYWORDS = new Set(
  REFERENCE.filter((r) => r.kind === "keyword" || r.kind === "iterator").map((r) => r.name).concat([
    "select", "update", "delete", "exec", "from", "where", "by", "if", "do", "while", "each", "over", "scan", "prior",
    "peach", "and", "or", "not", "null", "value", "key", "keys", "type", "show", "system", "string", "enlist", "flip",
    "til", "count", "first", "last", "sum", "avg", "max", "min", "neg", "abs", "exp", "log", "sqrt", "sin", "cos", "tan",
    "floor", "ceiling", "mod", "div", "in", "within", "like", "xbar", "cross", "except", "inter", "union", "sv", "vs",
    "raze", "reverse", "distinct", "group", "where", "asc", "desc", "iasc", "idesc", "rank", "differ", "deltas", "sums",
    "prds", "maxs", "mins", "avgs", "ratios", "fills", "prev", "next", "xprev", "rotate", "sublist", "cut", "bin", "binr",
    "upper", "lower", "trim", "ltrim", "rtrim", "ss", "ssr", "string", "parse", "eval", "get", "set", "cols", "meta",
    "xkey", "xcol", "xcols", "xasc", "xdesc", "lj", "ij", "uj", "pj", "aj", "ej", "insert", "upsert", "ungroup", "xgroup",
    "fby", "wavg", "wsum", "cor", "cov", "var", "dev", "med", "mavg", "msum", "mmax", "mmin", "mcount", "ema", "all", "any",
    "mmu", "inv", "lsq", "xexp", "xlog", "signum", "reciprocal", "attr", "tables", "rand", "hsym",
  ]),
);

export const API_NAMES = new Set(
  REFERENCE.filter((r) => r.kind === "draw" || r.kind === "helper" || r.kind === "input").map((r) => r.name).concat(["camrgb"]),
);

interface QState {
  block: boolean; // inside / ... \ block comment
  ended: boolean; // after a lone "\" (rest of script ignored)
}

const NUM =
  /^-?(?:0x[0-9a-fA-F]*|[01]+b|\d{4}\.\d{2}\.\d{2}(?:[DT][\d:.]*)?|\d{4}\.\d{2}m|\d+D[\d:.]*|\d{1,2}:\d{2}(?::\d{2}(?:\.\d*)?)?|0[NnWw][a-z]?|(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)[a-z]?/;

function token(stream: StringStream, st: QState): string | null {
  if (st.ended) {
    stream.skipToEnd();
    return "comment";
  }
  if (stream.sol()) {
    const line = stream.string;
    if (st.block) {
      if (/^\\\s*$/.test(line)) st.block = false;
      stream.skipToEnd();
      return "comment";
    }
    if (/^\/\s*$/.test(line)) {
      st.block = true;
      stream.skipToEnd();
      return "comment";
    }
    if (/^\\\s*$/.test(line)) {
      st.ended = true;
      stream.skipToEnd();
      return "comment";
    }
    if (stream.peek() === "/") {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.peek() === "\\") {
      stream.skipToEnd();
      return "meta";
    }
  }
  if (stream.eatSpace()) {
    if (stream.peek() === "/") {
      stream.skipToEnd();
      return "comment";
    }
    return null;
  }
  const ch = stream.peek()!;
  if (ch === '"') {
    stream.next();
    let esc = false;
    while (!stream.eol()) {
      const c = stream.next();
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') break;
    }
    return "string";
  }
  if (ch === "`") {
    stream.next();
    if (stream.peek() === ":") stream.match(/^:[\w.:/]*/);
    else stream.match(/^[\w.]*/);
    return "atom";
  }
  // numbers (allow a leading minus only where it can't be subtraction)
  const prev = stream.pos > 0 ? stream.string[stream.pos - 1] : " ";
  const allowNeg = /[\s([{;:+*%!&|<>=~,^#_$?@'/\\-]/.test(prev) || stream.pos === 0;
  if (/[\d.]/.test(ch) || (ch === "-" && allowNeg && /[\d.]/.test(stream.string[stream.pos + 1] ?? ""))) {
    const m = stream.match(NUM) as RegExpMatchArray | null;
    if (m && !/[a-zA-Z_]/.test(stream.peek() ?? "")) return "number";
    if (m) stream.backUp(m[0].length);
  }
  if (/[a-zA-Z.]/.test(ch)) {
    const m = stream.match(/^\.?[a-zA-Z][\w.]*/) as RegExpMatchArray | null;
    if (m) {
      const w = m[0];
      if (Q_KEYWORDS.has(w)) return "keyword";
      if (API_NAMES.has(w)) return "api";
      if (w.startsWith(".cx.") || w.startsWith(".qv.") || w.startsWith(".Q.") || w.startsWith(".z.")) return "api";
      if (w === "x" || w === "y" || w === "z") return "local";
      if (stream.match(/^\s*::?(?!:)/, false)) return "def";
      return "name";
    }
  }
  if (ch === "'" || ch === "/" || ch === "\\") {
    stream.next();
    stream.eat(":");
    return "adverb";
  }
  if ("()[]{}".includes(ch)) {
    stream.next();
    return "bracket";
  }
  if (ch === ";") {
    stream.next();
    return "punct";
  }
  if ("+-*%!&|<>=~,^#_$?@.:".includes(ch)) {
    stream.next();
    if (ch === "$" && stream.peek() === "[") return "keyword";
    stream.eat(":");
    return "operator";
  }
  stream.next();
  return null;
}

export const qLanguage = StreamLanguage.define<QState>({
  name: "q",
  startState: () => ({ block: false, ended: false }),
  token,
  copyState: (s) => ({ ...s }),
  languageData: { commentTokens: { line: "/" } },
  tokenTable: {
    api: t.special(t.variableName),
    local: t.local(t.variableName),
    def: t.definition(t.variableName),
    adverb: t.controlKeyword,
    punct: t.separator,
  },
});

export const qHighlight = HighlightStyle.define([
  { tag: t.comment, color: "var(--syn-comment)", fontStyle: "italic" },
  { tag: t.string, color: "var(--syn-string)" },
  { tag: t.atom, color: "var(--syn-symbol)" },
  { tag: t.number, color: "var(--syn-number)" },
  { tag: t.keyword, color: "var(--syn-keyword)", fontWeight: "550" },
  { tag: t.special(t.variableName), color: "var(--syn-api)", fontWeight: "550" },
  { tag: t.local(t.variableName), color: "var(--syn-local)", fontStyle: "italic" },
  { tag: t.definition(t.variableName), color: "var(--syn-name)", fontWeight: "650" },
  { tag: t.variableName, color: "var(--syn-name)" },
  { tag: t.controlKeyword, color: "var(--syn-adverb)", fontWeight: "700" },
  { tag: t.operator, color: "var(--syn-op)", fontWeight: "600" },
  { tag: t.bracket, color: "var(--syn-bracket)" },
  { tag: t.separator, color: "var(--syn-bracket)" },
  { tag: t.meta, color: "var(--syn-keyword)" },
]);

export const qSyntax = [qLanguage, syntaxHighlighting(qHighlight)];

/** Token classes for static highlighting (used for read-only snippets). */
export function highlightToHtml(src: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const st: QState = { block: false, ended: false };
  let out = "";
  const lines = src.split("\n");
  lines.forEach((line, li) => {
    const stream = new SimpleStream(line);
    while (!stream.eol()) {
      const start = stream.pos;
      const cls = token(stream as unknown as StringStream, st);
      if (stream.pos === start) stream.pos++;
      const text = esc(line.slice(start, stream.pos));
      out += cls ? `<span class="tk-${cls}">${text}</span>` : text;
    }
    if (li < lines.length - 1) out += "\n";
  });
  return out;
}

class SimpleStream {
  pos = 0;
  start = 0;
  constructor(public string: string) {}
  sol() { return this.pos === 0; }
  eol() { return this.pos >= this.string.length; }
  peek() { return this.string[this.pos]; }
  next() { return this.string[this.pos++]; }
  eat(m: string) { if (this.string[this.pos] === m) { this.pos++; return m; } return undefined; }
  eatSpace() { const s = this.pos; while (/\s/.test(this.string[this.pos] ?? "")) this.pos++; return this.pos > s; }
  skipToEnd() { this.pos = this.string.length; }
  backUp(n: number) { this.pos -= n; }
  match(re: RegExp | string, consume = true) {
    if (typeof re === "string") {
      const ok = this.string.startsWith(re, this.pos);
      if (ok && consume) this.pos += re.length;
      return ok;
    }
    const m = re.exec(this.string.slice(this.pos));
    if (m && m.index === 0 && consume) this.pos += m[0].length;
    return m && m.index === 0 ? m : null;
  }
}
