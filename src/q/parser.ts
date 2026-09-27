import type { Node } from "./ast";
import { QError } from "./errors";
import { lex, type Tok } from "./lexer";

/** q keywords that act as infix operators (binary functions in .q). */
export const INFIX = new Set([
  "and", "or", "mod", "div", "in", "within", "like", "xbar", "cross", "except", "inter", "union", "sv", "vs",
  "each", "peach", "over", "scan", "prior", "bin", "binr", "xexp", "xlog", "lj", "ljf", "ij", "ijf", "uj", "ujf", "pj", "ej",
  "mmu", "lsq", "insert", "upsert", "set", "xasc", "xdesc", "xcol", "xcols", "xkey", "xgroup", "xrank", "xprev",
  "wavg", "wsum", "cor", "cov", "scov", "ss", "rotate", "sublist", "cut", "setm", "fby", "asof", "mavg", "mcount",
  "mdev", "mmax", "mmin", "msum", "ema", "dsave", "upsert", "aj", "aj0", "sublist", "cross", "rotate", "vs", "sv", "like",
  "within", "sublist", "xbar", "xexp", "xlog", "ss", "ssr", "and", "or", "wj", "wj1", "coalesce",
]);
// Words that are triadic or only bracket-called and should not be infix.
INFIX.delete("ssr");
INFIX.delete("wj");
INFIX.delete("wj1");
INFIX.delete("aj");
INFIX.delete("aj0");
INFIX.delete("ej");

const SQL = new Set(["select", "exec", "update", "delete"]);
const CTL = new Set(["if", "do", "while"]);

interface Item {
  node: Node;
  verb: boolean;
  paren?: boolean;
}

interface LambdaCtx {
  used: Set<string>;
  assigned: Set<string>;
  globals: Set<string>;
}

export interface Program {
  stmts: Node[];
  /** last statement was followed by ';' — REPL shows nothing */
  silent: boolean;
  src: string;
}

export function parse(src: string): Program {
  const p = new Parser(src);
  return p.program();
}

export class Parser {
  toks: Tok[];
  i = 0;
  lam: LambdaCtx[] = [];
  constructor(public src: string) {
    this.toks = lex(src);
  }

  get tok(): Tok {
    return this.toks[this.i];
  }
  tk(): Tok["k"] {
    return this.toks[this.i].k;
  }
  tx(): string {
    return this.toks[this.i].text;
  }
  peek(o = 1): Tok {
    return this.toks[Math.min(this.i + o, this.toks.length - 1)];
  }
  err(msg: string, t: Tok = this.tok): QError {
    return new QError("parse", msg).at({ s: t.s, e: Math.max(t.e, t.s + 1), src: this.src });
  }
  expect(k: Tok["k"], what: string) {
    if (this.tk() !== k) throw this.err(`Expected ${what} here.`);
    return this.toks[this.i++];
  }

  program(): Program {
    const stmts: Node[] = [];
    let silent = false;
    while (this.tk() !== "eof") {
      if (this.tk() === "nl" || this.tk() === ";") {
        silent = this.tk() === ";";
        this.i++;
        continue;
      }
      stmts.push(this.statement(new Set()));
      silent = false;
      if (this.tk() === ";") {
        silent = true;
      } else if (this.tk() !== "nl" && this.tk() !== "eof") {
        throw this.err(`Unexpected '${this.tx()}'.`);
      }
    }
    return { stmts, silent, src: this.src };
  }

  statement(stops: Set<string>): Node {
    const t = this.tok;
    if (t.k === "sys") {
      this.i++;
      return { k: "sys", cmd: t.text, s: t.s, e: t.e };
    }
    return this.expr(stops) ?? { k: "nil", s: t.s, e: t.s };
  }

  isStop(stops: Set<string>): boolean {
    const t = this.tok;
    switch (t.k) {
      case ";": case "nl": case ")": case "]": case "}": case "eof": return true;
      case "op": return t.text === "," && stops.has(",");
      case "name": return stops.has(t.text);
      default: return false;
    }
  }

  /** Parse an expression up to a stop token. Returns null for an empty expression. */
  expr(stops: Set<string>): Node | null {
    const items: Item[] = [];
    while (!this.isStop(stops)) {
      const it = this.item(stops);
      items.push(it);
      if (!it.paren && (it.node.k === "assign" || it.node.k === "ret" || it.node.k === "sig")) break;
    }
    if (!items.length) return null;
    return this.build(items, 0);
  }

  build(items: Item[], i: number): Node {
    const a = items[i];
    if (i === items.length - 1) return a.node;
    if (a.verb) {
      const rest = this.build(items, i + 1);
      return { k: "mono", f: a.node, x: rest, s: a.node.s, e: rest.e };
    }
    const b = items[i + 1];
    if (b.verb) {
      if (i + 2 >= items.length) return { k: "lsect", f: b.node, x: a.node, s: a.node.s, e: b.node.e };
      const rest = this.build(items, i + 2);
      return { k: "dyad", f: b.node, x: a.node, y: rest, s: a.node.s, e: rest.e };
    }
    const rest = this.build(items, i + 1);
    return { k: "mono", f: a.node, x: rest, s: a.node.s, e: rest.e };
  }

  noteUse(name: string) {
    const ctx = this.lam[this.lam.length - 1];
    if (ctx) ctx.used.add(name);
  }
  noteAssign(name: string, global: boolean) {
    const ctx = this.lam[this.lam.length - 1];
    if (!ctx || name.includes(".")) return;
    if (global) ctx.globals.add(name);
    else ctx.assigned.add(name);
  }

  item(stops: Set<string>): Item {
    const t = this.tok;
    let it: Item;
    switch (t.k) {
      case "num": case "sym": case "str":
        this.i++;
        it = { node: { k: "lit", v: t.v!, s: t.s, e: t.e }, verb: false };
        break;
      case "name": {
        const name = t.text;
        if (SQL.has(name) && !(this.peek().k === "op" && (this.peek().text === ":" || this.peek().text === "::"))) return { node: this.sql(), verb: false };
        if (CTL.has(name) && this.peek().k === "[") return { node: this.ctl(), verb: false };
        // assignment?
        const nx = this.peek();
        if (nx.k === "op" && (nx.text === ":" || nx.text === "::" || isAssignOp(nx.text))) {
          return { node: this.assign(null), verb: false };
        }
        if (nx.k === "[") {
          // x[i]:v  or  x[i]+:v ?
          const close = this.matching(this.i + 1);
          const after = this.toks[close + 1];
          if (after && after.k === "op" && (after.text === ":" || isAssignOp(after.text))) {
            this.i++;
            const idx = this.bracketArgs();
            return { node: this.assign(idx, t), verb: false };
          }
        }
        this.i++;
        this.noteUse(name);
        it = { node: { k: "name", n: name, s: t.s, e: t.e }, verb: INFIX.has(name) };
        break;
      }
      case "op": {
        const nk = this.peek().k;
        if (t.text === ":" && this.lam.length && nk !== ";" && nk !== "]" && nk !== ")" && nk !== "}" && nk !== "nl" && nk !== "eof") {
          // return
          this.i++;
          const x = this.expr(stops);
          return { node: { k: "ret", x, s: t.s, e: x ? x.e : t.e }, verb: false };
        }
        if (t.text === "::") {
          this.i++;
          it = { node: { k: "verb", op: "::", s: t.s, e: t.e }, verb: false };
          break;
        }
        if (t.text === "$" && this.peek().k === "[" && !this.peek().ws) {
          this.i++;
          const args = this.bracketArgs();
          const e = this.toks[this.i - 1].e;
          it = { node: { k: "cond", args: args.map((a) => a ?? { k: "nil", s: t.s, e: t.s }), s: t.s, e }, verb: false };
          break;
        }
        this.i++;
        it = { node: { k: "verb", op: t.text, s: t.s, e: t.e }, verb: true };
        break;
      }
      case "adv": {
        if (t.text === "'" && this.peek().k === "[" && !this.peek().ws) {
          this.i++;
          it = { node: { k: "verb", op: "'", s: t.s, e: t.e }, verb: false };
          break;
        }
        if (t.text === "'") {
          this.i++;
          const x = this.expr(stops);
          if (!x) throw this.err("Signal ' needs a value to signal, like '\"oops\" or '`oops.", t);
          return { node: { k: "sig", x, s: t.s, e: x.e }, verb: false };
        }
        throw this.err(`The iterator '${t.text}' needs a function on its left.`);
      }
      case "(":
        it = { node: this.paren(), verb: false, paren: true };
        break;
      case "{":
        it = { node: this.lambda(), verb: false };
        break;
      case "[": {
        // block: [a;b;c] evaluates in order, returns last
        const s = t.s;
        const args = this.bracketArgs();
        const e = this.toks[this.i - 1].e;
        it = { node: { k: "seq", stmts: args.map((a) => a ?? { k: "nil", s, e: s }), s, e }, verb: false };
        break;
      }
      case "sys":
        throw this.err("System commands (\\) must start a line.");
      default:
        throw this.err(`Unexpected '${t.text}'.`);
    }
    // postfix: application brackets and iterators
    for (;;) {
      const nt = this.tok;
      if (nt.k === "[") {
        const s = it.node.s;
        const args = this.bracketArgs();
        const e = this.toks[this.i - 1].e;
        it = { node: { k: "app", f: it.node, args, s, e }, verb: false };
        continue;
      }
      if (nt.k === "adv" && !nt.ws) {
        this.i++;
        it = { node: { k: "adv", f: it.node, a: nt.text, s: it.node.s, e: nt.e }, verb: true };
        continue;
      }
      break;
    }
    return it;
  }

  matching(openIdx: number): number {
    let depth = 0;
    for (let j = openIdx; j < this.toks.length; j++) {
      const k = this.toks[j].k;
      if (k === "(" || k === "[" || k === "{") depth++;
      else if (k === ")" || k === "]" || k === "}") {
        depth--;
        if (depth === 0) return j;
      }
    }
    return this.toks.length - 1;
  }

  /** Parses [a;b;c] (current token is '['). Empty slots are null. */
  bracketArgs(): (Node | null)[] {
    this.expect("[", "'['");
    const args: (Node | null)[] = [];
    for (;;) {
      while (this.tk() === "nl") this.i++;
      const x = this.expr(new Set());
      args.push(x);
      while (this.tk() === "nl") this.i++;
      if (this.tk() === ";") {
        this.i++;
        continue;
      }
      if (this.tk() === "]") {
        this.i++;
        break;
      }
      throw this.err(`Expected ';' or ']' but found '${this.tx()}'.`);
    }
    if (args.length === 1 && args[0] === null) return [];
    return args;
  }

  assign(idx: (Node | null)[] | null, nameTok?: Tok): Node {
    const nt = nameTok ?? this.toks[this.i++];
    const opTok = this.toks[this.i++];
    const global = opTok.text === "::";
    const op = opTok.text === ":" || opTok.text === "::" ? null : opTok.text.slice(0, -1);
    const name = nt.text;
    if (op || idx) this.noteUse(name);
    // only a plain `name:value` introduces a local; `name+:v` and `name[i]:v` amend whatever `name` already is
    if (!op && !idx) this.noteAssign(name, global);
    const v = this.expr(new Set());
    if (!v) throw this.err(`Nothing to assign to '${name}'.`, opTok);
    return { k: "assign", name, idx, op, global, v, s: nt.s, e: v.e };
  }

  paren(): Node {
    const open = this.expect("(", "'('");
    // table literal
    if (this.tk() === "[") {
      this.i++;
      const keys = this.colDefs("]");
      this.expect("]", "']'");
      const cols = this.colDefs(")");
      const close = this.expect(")", "')'");
      return { k: "table", keys, cols, s: open.s, e: close.e };
    }
    if (this.tk() === ")") {
      const close = this.toks[this.i++];
      return { k: "list", items: [], s: open.s, e: close.e };
    }
    const items: Node[] = [];
    let sawSemi = false;
    for (;;) {
      const st = this.tok;
      const x = this.expr(new Set());
      items.push(x ?? { k: "nil", s: st.s, e: st.s });
      if (this.tk() === ";") {
        sawSemi = true;
        this.i++;
        continue;
      }
      if (this.tk() === ")") break;
      throw this.err(`Expected ';' or ')' but found '${this.tx()}'.`);
    }
    const close = this.toks[this.i++];
    if (!sawSemi) {
      const x = items[0];
      // keep parens visible to the evaluator only as span info
      return { ...x, s: open.s, e: close.e } as Node;
    }
    return { k: "list", items, s: open.s, e: close.e };
  }

  colDefs(end: ")" | "]"): [string, Node][] {
    const out: [string, Node][] = [];
    while (this.tk() !== end) {
      const t = this.tok;
      let name: string | null = null;
      if (t.k === "name" && this.peek().k === "op" && this.peek().text === ":") {
        name = t.text;
        this.i += 2;
      }
      const x = this.expr(new Set());
      if (!x) throw this.err("Expected a column definition.");
      if (!name) name = inferName(x) ?? "x";
      out.push([name, x]);
      if (this.tk() === ";") this.i++;
      else if (this.tk() !== end) throw this.err(`Expected ';' or '${end}' in table literal.`);
    }
    return out;
  }

  lambda(): Node {
    const open = this.expect("{", "'{'");
    const ctx: LambdaCtx = { used: new Set(), assigned: new Set(), globals: new Set() };
    this.lam.push(ctx);
    let params: string[] | null = null;
    if (this.tk() === "[" ) {
      this.i++;
      params = [];
      while (this.tk() !== "]") {
        if (this.tk() === "name") params.push(this.toks[this.i++].text);
        else if (this.tk() === ";") this.i++;
        else throw this.err("Lambda parameters must be names, like {[a;b] a+b}.");
      }
      this.i++;
      if (params.length > 8) throw new QError("params", "A lambda can take at most 8 parameters.").at({ s: open.s, e: this.tok.s, src: this.src });
    }
    const body: Node[] = [];
    for (;;) {
      while (this.tk() === "nl" || this.tk() === ";") {
        if (this.tk() === ";" && (this.peek().k === "}")) body.push({ k: "nil", s: this.tok.s, e: this.tok.s });
        this.i++;
      }
      if (this.tk() === "}") break;
      body.push(this.statement(new Set()));
      if (this.tk() === "}") break;
      if (this.tk() !== ";" && this.tk() !== "nl") throw this.err(`Unexpected '${this.tx()}' in lambda.`);
    }
    const close = this.toks[this.i++];
    this.lam.pop();
    let implicit = false;
    if (!params) {
      implicit = true;
      params = ctx.used.has("z") ? ["x", "y", "z"] : ctx.used.has("y") ? ["x", "y"] : ["x"];
    }
    const locals = [...ctx.assigned].filter((n) => !params!.includes(n));
    // names used in this lambda propagate outward only if they are globals; nested lambdas are opaque
    return { k: "lambda", params, implicit, body, locals, src: this.src.slice(open.s, close.e), s: open.s, e: close.e };
  }

  ctl(): Node {
    const t = this.toks[this.i++];
    const args = this.bracketArgs();
    const e = this.toks[this.i - 1].e;
    if (!args.length) throw this.err(`${t.text}[...] needs a condition.`, t);
    return { k: "ctl", kind: t.text as "if" | "do" | "while", args: args.map((a) => a ?? { k: "nil", s: t.s, e: t.s }), s: t.s, e };
  }

  sql(): Node {
    const kw = this.toks[this.i++];
    const kind = kw.text as "select" | "exec" | "update" | "delete";
    let limit: Node | null = null;
    if (this.tk() === "[" && kind === "select") {
      const a = this.bracketArgs();
      limit = a[0] ?? null;
    }
    const cols: [string | null, Node][] = [];
    let delCols: string[] | null = null;
    const colStops = new Set([",", "by", "from"]);
    if (kind === "delete") {
      delCols = [];
      while (this.tk() === "name" && this.tx() !== "from") {
        delCols.push(this.toks[this.i++].text);
        if (this.tk() === "op" && this.tx() === ",") this.i++;
      }
    } else {
      while (!(this.tk() === "name" && (this.tx() === "by" || this.tx() === "from"))) {
        if (this.isStop(new Set())) throw this.err(`${kind} needs a 'from' clause.`, kw);
        cols.push(this.sqlCol(colStops));
        if (this.tk() === "op" && this.tx() === ",") this.i++;
      }
    }
    let by: [string | null, Node][] | null = null;
    if (this.tk() === "name" && this.tx() === "by") {
      this.i++;
      by = [];
      while (!(this.tk() === "name" && this.tx() === "from")) {
        if (this.isStop(new Set())) throw this.err(`${kind} needs a 'from' clause.`, kw);
        by.push(this.sqlCol(colStops));
        if (this.tk() === "op" && this.tx() === ",") this.i++;
      }
    }
    if (!(this.tk() === "name" && this.tx() === "from")) throw this.err(`${kind} needs a 'from' clause.`, kw);
    this.i++;
    const from = this.expr(new Set(["where"]));
    if (!from) throw this.err("Expected a table after 'from'.");
    const where: Node[] = [];
    if (this.tk() === "name" && this.tx() === "where") {
      this.i++;
      for (;;) {
        const c = this.expr(new Set([","]));
        if (!c) throw this.err("Expected a condition after 'where'.");
        where.push(c);
        if (this.tk() === "op" && this.tx() === ",") {
          this.i++;
          continue;
        }
        break;
      }
    }
    const e = this.toks[this.i - 1].e;
    return { k: "sql", kind, cols, by, from, where, limit, delCols, s: kw.s, e };
  }

  sqlCol(stops: Set<string>): [string | null, Node] {
    let name: string | null = null;
    if (this.tk() === "name" && this.peek().k === "op" && this.peek().text === ":") {
      name = this.tx();
      this.i += 2;
    }
    const x = this.expr(stops);
    if (!x) throw this.err("Expected a column expression.");
    return [name, x];
  }
}

const isAssignOp = (t: string) => t.length === 2 && t[1] === ":" && "+-*%!&|<>=~,^#_$?@.".includes(t[0]);

/** Column name q would infer for an expression: first name found, reading arguments left to right. */
export function inferName(n: Node): string | null {
  switch (n.k) {
    case "name": {
      if (n.n === "i") return null;
      const parts = n.n.split(".");
      return parts[parts.length - 1] || null;
    }
    case "dyad": return inferName(n.x) ?? inferName(n.y);
    case "mono": return inferName(n.x) ?? (n.f.k === "name" ? null : inferName(n.f));
    case "app": {
      for (const a of n.args) if (a) { const r = inferName(a); if (r) return r; }
      return null;
    }
    case "assign": return n.name;
    case "adv": return null;
    default: return null;
  }
}
