import type { Node, NodeOf } from "./ast";
import { QError, lengthErr, rankErr, typeErr, indexErr, domainErr, formatError } from "./errors";
import { Builtin, Comp, Derived, Lambda, Proj } from "./fns";
import { DEFAULT_FMT, FmtOpts, inline, setFnFormatter, show } from "./format";
import { parse, type Program } from "./parser";
import { RT } from "./rt";
import {
  NIL, QAtom, QDict, QFn, QIdentity, QTable, QValue, QVec, T, atom, count, dict, emptyList, fromItems, isKeyed,
  item, items, list, list2vec, long, longs, nullItem, nullLike, nullOf, str, sym, syms, table, typeOf, vec, TYPE_NAMES,
} from "./value";
import { BUILTINS, GLYPHS, identityFor, matchValues } from "./verbs";
import "./keywords";
import { runSql } from "./qsql";
import { fastDerived } from "./fastpaths";
import { installBootstrap, DYNAMIC } from "./bootstrap";

class Return {
  constructor(public v: QValue) {}
}

export interface Frame {
  lam: Lambda | null;
  locals: Map<string, QValue> | null;
  ns: string;
  /** enclosing frame for qSQL column scopes */
  parent: Frame | null;
}

export interface EvalResult {
  value?: QValue;
  /** text as the q) prompt would print it ("" for silent results) */
  text: string;
  error?: QError;
  errorText?: string;
  silent: boolean;
  ms: number;
}

const MAX_DEPTH = 2000;
const TRACEABLE = new Set(["mono", "dyad", "app", "sql", "cond", "list", "table", "lsect", "assign"]);

/** Mulberry32 PRNG — deterministic for \S seeds. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SessionHost {
  stdout?: (s: string) => void;
  stderr?: (s: string) => void;
  files?: Map<string, string>;
}

export class Session {
  /** namespace -> variables ("" is the root namespace) */
  readonly ns = new Map<string, Map<string, QValue>>();
  cur = "";
  fmt: FmtOpts = { ...DEFAULT_FMT };
  depth = 0;
  rand = prng(-314159);
  /** namespaces searched after root and .q for unqualified names (e.g. the Qanvas drawing API) */
  imports: string[] = [];
  host: SessionHost;
  /** set by hosts to interrupt long loops */
  interrupt = false;
  steps = 0;
  /** performance.now() deadline after which evaluation stops with 'stop (0 = none) */
  deadline = 0;
  budgetHint = "";

  constructor(host: SessionHost = {}) {
    this.host = host;
    this.ns.set("", new Map());
    const q = new Map<string, QValue>();
    for (const [k, v] of BUILTINS) q.set(k, v);
    this.ns.set(".q", q);
    this.ns.set(".Q", new Map());
    this.ns.set(".z", new Map());
    this.bind();
    installBootstrap(this);
  }

  /** point the late-bound runtime at this session */
  bind() {
    RT.apply = (f, a) => this.apply(f, a);
    (RT as any).amend = (x: QValue, idx: (QValue | undefined)[], f: QValue | undefined, y: QValue | undefined) => this.amendPath(x, idx, f, y);
    RT.applyDerived = (f, adv, a) => this.applyDerived(new Derived(f, adv, rankOf(f)), a);
    RT.evalStr = (s) => this.run(s);
    RT.parseStr = (s) => parseToQ(s);
    RT.getGlobal = (n) => this.lookupGlobal(n, this.cur);
    RT.setGlobal = (n, v) => this.setGlobal(n, v, this.cur);
    RT.stdout = (s) => (this.host.stdout ?? ((t: string) => console.log(t)))(s);
    RT.stderr = (s) => (this.host.stderr ?? ((t: string) => console.error(t)))(s);
    RT.random = () => this.rand();
    RT.seed = (n) => (this.rand = prng(n));
    RT.show = (x) => show(x, this.fmt);
    RT.inline = (x) => inline(x, this.fmt.precision);
    RT.now = () => Date.now();
    RT.tzOffsetMin = () => -new Date().getTimezoneOffset();
    RT.tables = (ns) => [...(this.ns.get(ns === "." ? "" : ns) ?? new Map()).entries()].filter(([, v]) => v instanceof QTable || isKeyed(v)).map(([k]) => k).sort();
    RT.names = (ns, kind) => {
      const m = this.ns.get(ns === "." ? "" : ns) ?? new Map();
      return [...m.entries()]
        .filter(([, v]) => (kind === "f" ? v instanceof QFn : kind === "a" ? v instanceof QTable || isKeyed(v) : true))
        .map(([k]) => k)
        .sort();
    };
    setFnFormatter((f) => fmtFn(f, this.fmt.precision));
  }

  // ---------------- public API ----------------

  /** Evaluate source as the q) prompt would. Never throws. */
  evaluate(src: string): EvalResult {
    const t0 = performance.now();
    this.bind();
    this.interrupt = false;
    try {
      const prog = parse(src);
      const { value, silent } = this.runProgram(prog);
      const quiet = silent || value === undefined || value === NIL || isAssignLast(prog);
      return { value, text: quiet ? "" : show(value!, this.fmt), silent: quiet, ms: performance.now() - t0 };
    } catch (e) {
      const err = toQError(e);
      return { error: err, errorText: formatError(err, src), text: "", silent: false, ms: performance.now() - t0 };
    }
  }

  /** Evaluate and return the value, throwing QError on failure. */
  run(src: string): QValue {
    const prog = parse(src);
    return this.runProgram(prog).value ?? NIL;
  }

  runProgram(prog: Program): { value: QValue | undefined; silent: boolean } {
    const fr: Frame = { lam: null, locals: null, ns: this.cur, parent: null };
    let value: QValue | undefined;
    for (const st of prog.stmts) {
      fr.ns = this.cur;
      try {
        value = this.ev(st, fr);
      } catch (e) {
        if (e instanceof Return) {
          value = e.v;
          break;
        }
        const err = toQError(e);
        if (err.span && !err.span.src) err.span.src = prog.src;
        throw err;
      }
    }
    return { value, silent: prog.silent };
  }

  /** Call a q function value from JS. */
  call(f: QValue | string, ...args: QValue[]): QValue {
    this.bind();
    const fn = typeof f === "string" ? this.lookupGlobal(f, "") : f;
    if (fn === undefined) throw new QError(String(f), `${f} is not defined`);
    return this.apply(fn, args);
  }

  get(name: string): QValue | undefined {
    return this.lookupGlobal(name, "");
  }
  set(name: string, v: QValue) {
    this.setGlobal(name, v, "");
  }

  // ---------------- names ----------------

  nsMap(ns: string): Map<string, QValue> {
    let m = this.ns.get(ns);
    if (!m) {
      m = new Map();
      this.ns.set(ns, m);
    }
    return m;
  }

  lookupGlobal(name: string, ns: string): QValue | undefined {
    if (name[0] === ".") return this.lookupAbs(name);
    // q keywords are reserved words: they win over any namespace variable of the same name
    let v = this.ns.get(".q")!.get(name);
    if (v !== undefined) return v;
    if (ns) {
      v = this.ns.get(ns)?.get(name);
      if (v !== undefined) return v;
    }
    const root = this.ns.get("")!;
    v = root.get(name);
    if (v !== undefined) return v;
    for (const imp of this.imports) {
      v = this.ns.get(imp)?.get(name);
      if (v !== undefined) return v;
    }
    // relative dotted name: a.b -> index a by `b
    const dot = name.indexOf(".");
    if (dot > 0) {
      const base = this.lookupGlobal(name.slice(0, dot), ns);
      if (base !== undefined) {
        let cur: QValue = base;
        for (const part of name.slice(dot + 1).split(".")) cur = this.index(cur, [sym(part)]);
        return cur;
      }
    }
    return undefined;
  }

  lookupAbs(name: string): QValue | undefined {
    const dyn = DYNAMIC[name];
    if (dyn) return dyn();
    const parts = name.slice(1).split(".");
    for (let i = parts.length - 1; i >= 1; i--) {
      const ns = "." + parts.slice(0, i).join(".");
      const m = this.ns.get(ns);
      if (m && m.has(parts[i])) {
        let cur = m.get(parts[i])!;
        for (const p of parts.slice(i + 1)) cur = this.index(cur, [sym(p)]);
        return cur;
      }
    }
    // a namespace itself
    const m = this.ns.get(name);
    if (m) return this.nsDict(name);
    return undefined;
  }

  nsDict(name: string): QValue {
    const m = this.ns.get(name)!;
    const keys = ["", ...m.keys()];
    const vals: QValue[] = [NIL, ...m.values()];
    // child namespaces
    for (const k of this.ns.keys()) {
      if (k.startsWith(name + ".") && !k.slice(name.length + 1).includes(".")) {
        keys.push(k.slice(name.length + 1));
        vals.push(this.nsDict(k));
      }
    }
    return dict(syms(keys), list(vals));
  }

  setGlobal(name: string, v: QValue, ns: string) {
    if (name[0] === ".") {
      const i = name.lastIndexOf(".");
      if (i === 0) {
        // assigning a whole namespace from a dictionary
        if (v instanceof QDict && v.k instanceof QVec && v.k.t === 11) {
          const m = this.nsMap(name);
          const vs = items(v.v);
          (v.k.d as string[]).forEach((k, j) => k && m.set(k, vs[j]));
          return;
        }
        throw new QError("assign", `Can't assign to namespace ${name}.`);
      }
      const nsName = name.slice(0, i);
      if (nsName === ".q") throw new QError("assign", `${name} is a built-in and can't be reassigned.`);
      this.nsMap(nsName).set(name.slice(i + 1), v);
      return;
    }
    if (this.ns.get(".q")!.has(name) && !ns) throw new QError("assign", `'${name}' is a q keyword and can't be reassigned — pick another name.`);
    if (name.includes(".")) {
      // a.b:v amends dictionary a
      const dot = name.indexOf(".");
      const base = name.slice(0, dot);
      const cur = this.lookupGlobal(base, ns) ?? dict(syms([]), emptyList());
      const nv = this.amendPath(cur, name.slice(dot + 1).split(".").map((p) => sym(p)), undefined, v);
      this.setGlobal(base, nv, ns);
      return;
    }
    this.nsMap(ns).set(name, v);
  }

  // ---------------- evaluation ----------------

  lookup(n: NodeOf<"name">, fr: Frame): QValue {
    for (let f: Frame | null = fr; f; f = f.parent) {
      const loc = f.locals?.get(n.n);
      if (loc !== undefined) return loc;
      if (f.lam && f.lam.node.locals.includes(n.n)) {
        // declared local (assigned somewhere in this function) but not set yet
        const err = new QError(
          n.n,
          `'${n.n}' is a local inside this function (because it's assigned with ${n.n}: here), but it has no value yet. ` +
            `To change the global ${n.n}, use ${n.n}+: (or -:, *:…) or ${n.n}::value.`,
        );
        err.span = { s: n.s, e: n.e };
        throw err;
      }
      if (f.lam && !f.parent) break;
    }
    const v = this.lookupGlobal(n.n, fr.ns);
    if (v === undefined) {
      const err = new QError(n.n, this.suggest(n.n, fr));
      err.span = { s: n.s, e: n.e };
      throw err;
    }
    return v;
  }

  suggest(name: string, fr: Frame): string {
    const pool = new Set<string>();
    for (let f: Frame | null = fr; f; f = f.parent) f.locals?.forEach((_, k) => pool.add(k));
    this.ns.get("")!.forEach((_, k) => pool.add(k));
    this.ns.get(".q")!.forEach((_, k) => pool.add(k));
    for (const imp of this.imports) this.ns.get(imp)?.forEach((_, k) => pool.add(k));
    let best = "", bd = 3;
    for (const c of pool) {
      const d = editDistance(name, c);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    const lam = fr.lam ? " Inside a function, only its parameters, its own locals, and globals are visible." : "";
    return `'${name}' is not defined.` + (best ? ` Did you mean '${best}'?` : "") + lam;
  }

  /** optional hook receiving (node, value) for top-level evaluation steps */
  tracer: ((n: Node, v: QValue) => void) | null = null;

  ev(n: Node, fr: Frame): QValue {
    const v = this.ev0(n, fr);
    if (this.tracer && this.depth === 0 && TRACEABLE.has(n.k)) this.tracer(n, v);
    return v;
  }

  /** Evaluate src, recording each intermediate result (in q's right-to-left order). */
  trace(src: string): { steps: { s: number; e: number; value: QValue }[]; result: EvalResult } {
    const steps: { s: number; e: number; value: QValue }[] = [];
    this.tracer = (n, v) => steps.push({ s: n.s, e: n.e, value: v });
    try {
      return { steps, result: this.evaluate(src) };
    } finally {
      this.tracer = null;
    }
  }

  ev0(n: Node, fr: Frame): QValue {
    if (this.interrupt) throw new QError("stop", "Stopped.");
    switch (n.k) {
      case "lit":
        return n.v;
      case "name":
        return this.lookup(n, fr);
      case "verb":
        return verbValue(n.op, n);
      case "adv": {
        const f = this.ev(n.f, fr);
        return new Derived(f, n.a, rankOf(f));
      }
      case "mono": {
        const x = this.ev(n.x, fr);
        if (n.f.k === "verb") {
          const op = n.f.op;
          const b = verbValue(op, n.f);
          if (b instanceof Builtin && b.m) return this.guard(() => b.m!(x), n.f);
          return this.guard(() => this.apply(b, [x]), n.f);
        }
        const f = this.ev(n.f, fr);
        return this.guard(() => this.applyJux(f, x), n.f);
      }
      case "dyad": {
        const y = this.ev(n.y, fr);
        const x = this.ev(n.x, fr);
        const f = n.f.k === "verb" ? verbValue(n.f.op, n.f) : this.ev(n.f, fr);
        if (f instanceof Builtin && f.d) return this.guard(() => f.d!(x, y), n.f);
        return this.guard(() => this.apply(f, [x, y]), n.f);
      }
      case "lsect": {
        const x = this.ev(n.x, fr);
        const f = n.f.k === "verb" ? verbValue(n.f.op, n.f) : this.ev(n.f, fr);
        return new Proj(f, [x, undefined], 1);
      }
      case "app": {
        const args = new Array<QValue | undefined>(n.args.length);
        for (let i = n.args.length - 1; i >= 0; i--) {
          const a = n.args[i];
          args[i] = a ? this.ev(a, fr) : undefined;
        }
        const f = n.f.k === "verb" ? verbValue(n.f.op, n.f) : this.ev(n.f, fr);
        if (!args.length) args.push(NIL);
        return this.guard(() => this.apply(f, args), n.f.k === "name" || n.f.k === "verb" ? n.f : n);
      }
      case "assign":
        return this.assign(n, fr);
      case "lambda":
        return new Lambda(n, fr.ns);
      case "list": {
        const out = new Array<QValue>(n.items.length);
        for (let i = n.items.length - 1; i >= 0; i--) out[i] = this.ev(n.items[i], fr);
        return fromItems(out);
      }
      case "table":
        return this.guard(() => this.tableLit(n, fr), n);
      case "cond": {
        const a = n.args;
        if (a.length < 3) {
          if (a.length === 2) {
            // $[c;t] is cast-like in q; treat as conditional without else -> ::
            return truthy(this.ev(a[0], fr), a[0]) ? this.ev(a[1], fr) : NIL;
          }
          throw new QError("cond", "$[...] needs at least a condition, a true branch and a false branch.").at(n);
        }
        let i = 0;
        for (; i + 1 < a.length; i += 2) {
          if (truthy(this.ev(a[i], fr), a[i])) return this.ev(a[i + 1], fr);
        }
        return i < a.length ? this.ev(a[i], fr) : NIL;
      }
      case "ctl":
        return this.ctl(n, fr);
      case "ret":
        throw new Return(n.x ? this.ev(n.x, fr) : NIL);
      case "sig": {
        const v = this.ev(n.x, fr);
        let msg: string;
        if (v instanceof QAtom && (v.t === -11 || v.t === -10)) msg = v.v;
        else if (v instanceof QVec && v.t === 10) msg = v.d;
        else if (v instanceof QVec && v.t === 11) msg = (v.d as string[]).join("");
        else throw typeErr("Signal a symbol or a string, like '`oops or '\"oops\".").at(n);
        const e = new QError(msg);
        e.span = { s: n.s, e: n.e };
        throw e;
      }
      case "seq": {
        let v: QValue = NIL;
        for (const st of n.stmts) v = this.ev(st, fr);
        return v;
      }
      case "sql":
        return this.guard(() => runSql(this, n, fr), n);
      case "sys":
        return this.system(n.cmd, n);
      case "nil":
        return NIL;
    }
  }

  guard<V>(f: () => V, n: { s: number; e: number }): V {
    try {
      return f();
    } catch (e) {
      if (e instanceof QError) {
        if (!e.span) e.span = { s: n.s, e: n.e };
        throw e;
      }
      if (e instanceof Return) throw e;
      if (e instanceof RangeError && /call stack/i.test(e.message)) throw new QError("stack", "Recursion went too deep.").at(n);
      throw e;
    }
  }

  tableLit(n: NodeOf<"table">, fr: Frame): QValue {
    const evalCols = (defs: [string, Node][]) => {
      const vals = new Array<QValue>(defs.length);
      for (let i = defs.length - 1; i >= 0; i--) vals[i] = this.ev(defs[i][1], fr);
      return vals;
    };
    const kv = evalCols(n.keys);
    const cv = evalCols(n.cols);
    const all = [...kv, ...cv];
    let len = -1;
    for (const v of all) if (!(v instanceof QAtom)) {
      const c = count(v);
      if (len >= 0 && c !== len) throw lengthErr(`Table columns have different lengths (${len} and ${c}).`);
      len = c;
    }
    if (len < 0) len = 1;
    const norm = (v: QValue) => (v instanceof QAtom ? takeAtom(v, len) : v instanceof QTable || v instanceof QDict ? list(items(v)) : v);
    const mk = (defs: [string, Node][], vals: QValue[]) => table(defs.map((d) => d[0]), vals.map(norm));
    if (!n.keys.length) return mk(n.cols, cv);
    return dict(mk(n.keys, kv), mk(n.cols, cv));
  }

  ctl(n: NodeOf<"ctl">, fr: Frame): QValue {
    const [c, ...body] = n.args;
    if (n.kind === "if") {
      if (truthy(this.ev(c, fr), c)) for (const b of body) this.ev(b, fr);
      return NIL;
    }
    if (n.kind === "do") {
      const cv = this.ev(c, fr);
      if (!(cv instanceof QAtom) || typeof cv.v !== "number") throw typeErr("do[n;...] needs a number of times to repeat.").at(c);
      const k = cv.v;
      for (let i = 0; i < k; i++) {
        this.tick();
        for (const b of body) this.ev(b, fr);
      }
      return NIL;
    }
    while (truthy(this.ev(c, fr), c)) {
      this.tick();
      for (const b of body) this.ev(b, fr);
    }
    return NIL;
  }

  tick() {
    if ((++this.steps & 0x3ff) === 0) {
      if (this.interrupt) throw new QError("stop", "Stopped.");
      if (this.deadline && performance.now() > this.deadline) {
        this.deadline = 0;
        throw new QError("stop", this.budgetHint || "This took too long, so it was stopped.");
      }
    }
  }

  assign(n: NodeOf<"assign">, fr: Frame): QValue {
    let v = this.ev(n.v, fr);
    const isLocal = !n.global && fr.lam !== null && (fr.lam.node.params.includes(n.name) || fr.lam.node.locals.includes(n.name));
    const get = (): QValue => {
      if (isLocal) {
        const cur = fr.locals!.get(n.name);
        if (cur === undefined) throw new QError(n.name, `'${n.name}' has no value yet.`).at(n);
        return cur;
      }
      const cur = this.lookupGlobal(n.name, fr.ns);
      if (cur === undefined) throw new QError(n.name, `'${n.name}' has no value yet.`).at(n);
      return cur;
    };
    const put = (val: QValue) => {
      if (isLocal) fr.locals!.set(n.name, val);
      else this.guard(() => this.setGlobal(n.name, val, fr.lam ? fr.lam.ns : fr.ns), n);
    };
    if (n.idx) {
      const idx = new Array<QValue | undefined>(n.idx.length);
      for (let i = n.idx.length - 1; i >= 0; i--) {
        const a = n.idx[i];
        idx[i] = a ? this.ev(a, fr) : undefined;
      }
      let cur: QValue;
      try {
        cur = get();
      } catch (e) {
        if (n.op) throw e;
        cur = dict(syms([]), emptyList());
      }
      const f = n.op ? verbValue(n.op, n) : undefined;
      const nv = this.guard(() => this.amendPath(cur, idx, f, v), n);
      put(nv);
      return v;
    }
    if (n.op) {
      const f = verbValue(n.op, n);
      v = this.guard(() => this.apply(f, [get(), v]), n);
    }
    put(v);
    return v;
  }

  // ---------------- application ----------------

  /** juxtaposition `f x` */
  applyJux(f: QValue, x: QValue): QValue {
    if (f instanceof QFn) return this.apply(f, [x]);
    return this.index(f, [x]);
  }

  apply(f: QValue, args: (QValue | undefined)[]): QValue {
    if (!(f instanceof QFn)) return this.index(f, args);
    if (f instanceof QIdentity) {
      if (args.length !== 1) throw rankErr("(::) takes one argument.");
      return args[0] ?? NIL;
    }
    let holes = 0;
    for (const a of args) if (a === undefined) holes++;
    if (f instanceof Proj) return this.applyProj(f, args);
    const rank = f.rank;
    if (holes || (args.length < rank && !(ambivalent(f) && args.length >= 1))) {
      if (args.length > rank && !(f instanceof Builtin && f.n)) throw rankErr(rankMsg(f, args.length));
      const full = [...args];
      while (full.length < rank) full.push(undefined);
      return new Proj(f, full, full.filter((a) => a === undefined).length);
    }
    if (f instanceof Lambda) return this.callLambda(f, args as QValue[]);
    if (f instanceof Builtin) {
      const a = args as QValue[];
      if (a.length === 1 && f.m && !(f.glyph && f.d)) return f.m(a[0]);
      if (a.length === 2 && f.d) return f.d(a[0], a[1]);
      if (f.n && a.length <= Math.max(f.rank, 4)) return f.n(a);
      if (a.length === 1 && f.d) return new Proj(f, [a[0], undefined], 1);
      throw rankErr(rankMsg(f, a.length));
    }
    if (f instanceof Derived) return this.applyDerived(f, args as QValue[]);
    if (f instanceof Comp) {
      let v = this.apply(f.fs[f.fs.length - 1], args);
      for (let i = f.fs.length - 2; i >= 0; i--) v = this.apply(f.fs[i], [v]);
      return v;
    }
    throw typeErr("Can't apply this value.");
  }

  applyProj(p: Proj, args: (QValue | undefined)[]): QValue {
    const merged = [...p.args];
    let j = 0;
    for (let i = 0; i < merged.length && j < args.length; i++) {
      if (merged[i] === undefined) merged[i] = args[j++];
    }
    while (j < args.length) merged.push(args[j++]);
    const holes = merged.filter((a) => a === undefined).length;
    if (holes) {
      // a projection applied to fewer args than holes stays a projection
      if (args.length && args.every((a) => a !== undefined) && holes === 0) return this.apply(p.f, merged);
      return new Proj(p.f, merged, holes);
    }
    const f = p.f;
    if (f instanceof QFn && !(f instanceof Builtin && f.n) && !(f instanceof Derived) && merged.length > f.rank && !ambivalent(f))
      throw rankErr(rankMsg(f, merged.length));
    return this.apply(f, merged);
  }

  callLambda(f: Lambda, args: QValue[]): QValue {
    this.tick();
    const node = f.node;
    const ps = node.params;
    if (args.length > ps.length) throw rankErr(rankMsg(f, args.length));
    const locals = new Map<string, QValue>();
    for (let i = 0; i < ps.length; i++) locals.set(ps[i], args[i]);
    const fr: Frame = { lam: f, locals, ns: f.ns, parent: null };
    if (++this.depth > MAX_DEPTH) {
      this.depth = 0;
      throw new QError("stack", "Too much recursion — does your function always reach a base case?");
    }
    try {
      let v: QValue = NIL;
      const body = node.body;
      for (let i = 0; i < body.length; i++) v = this.ev(body[i], fr);
      return v;
    } catch (e) {
      if (e instanceof Return) return e.v;
      if (e instanceof QError) {
        if (!e.frames.length || e.frames[e.frames.length - 1].name !== "lambda") {
          e.frames.push({ name: "lambda", span: e.span ? { ...e.span, src: node.src } : undefined });
        }
        if (e.span && !e.span.src) e.span = { s: e.span.s - node.s, e: e.span.e - node.s, src: node.src };
      }
      throw e;
    } finally {
      this.depth--;
    }
  }

  // ---------------- iterators ----------------

  applyDerived(d: Derived, args: QValue[]): QValue {
    const f = d.f;
    const fast = fastDerived(d, args);
    if (fast !== undefined) return fast;
    const fr = d.baseRank;
    switch (d.adv) {
      case "'":
        return this.each(f, args);
      case "/":
      case "\\": {
        const scan = d.adv === "\\";
        if (fr === 1 || !(f instanceof QFn)) {
          if (args.length === 1) return this.converge(f, args[0], scan);
          if (args.length === 2) {
            const [c, x] = args;
            if (c instanceof QAtom && typeof c.v === "number" && c.t !== -9 && c.t !== -8) return this.repeat(f, c.v, x, scan);
            return this.whileLoop(c, f, x, scan);
          }
          throw rankErr(`${d.adv === "/" ? "over" : "scan"} of a unary function takes 1 or 2 arguments.`);
        }
        if (args.length === 1) {
          const xs = args[0];
          if (xs instanceof QAtom) return xs;
          const its = items(xs);
          if (!its.length) {
            if (scan) return xs;
            const id = identityFor(f, xs);
            return id ?? emptyList();
          }
          let acc = its[0];
          if (!scan) {
            for (let i = 1; i < its.length; i++) acc = this.apply(f, [acc, its[i]]);
            return acc;
          }
          const out = [acc];
          for (let i = 1; i < its.length; i++) out.push((acc = this.apply(f, [acc, its[i]])));
          return keepShape(xs, out);
        }
        // seeded fold: x f/ y (or f/[x;y;z...])
        let acc = args[0];
        const rest = args.slice(1);
        const n = conformCount(rest);
        if (n < 0) {
          const r = this.apply(f, [acc, ...rest]);
          return scan ? r : r;
        }
        const its = rest.map((a) => (a instanceof QAtom ? null : items(a)));
        const out: QValue[] = [];
        for (let i = 0; i < n; i++) {
          acc = this.apply(f, [acc, ...its.map((it, j) => (it ? it[i] : rest[j]))]);
          if (scan) out.push(acc);
        }
        return scan ? keepShape(rest[0], out) : acc;
      }
      case "':": {
        if (args.length === 1) {
          const xs = args[0];
          const its = items(xs);
          if (!its.length) return xs;
          const seed = priorSeed(f, its[0]);
          const out: QValue[] = [seed === undefined ? its[0] : this.apply(f, [its[0], seed])];
          for (let i = 1; i < its.length; i++) out.push(this.apply(f, [its[i], its[i - 1]]));
          return keepShape(xs, out);
        }
        const [x0, ys] = args;
        const its = items(ys);
        const out: QValue[] = [];
        for (let i = 0; i < its.length; i++) out.push(this.apply(f, [its[i], i ? its[i - 1] : x0]));
        return keepShape(ys, out);
      }
      case "/:": {
        if (args.length !== 2) throw rankErr("each-right (/:) takes two arguments.");
        const [x, y] = args;
        if (y instanceof QAtom) return this.apply(f, [x, y]);
        if (y instanceof QDict && !isKeyed(y)) return dict(y.k, fromItems(items(y.v).map((e) => this.apply(f, [x, e]))));
        return fromItems(items(y).map((e) => this.apply(f, [x, e])));
      }
      case "\\:": {
        if (args.length !== 2) throw rankErr("each-left (\\:) takes two arguments.");
        const [x, y] = args;
        if (x instanceof QAtom) return this.apply(f, [x, y]);
        if (x instanceof QDict && !isKeyed(x)) return dict(x.k, fromItems(items(x.v).map((e) => this.apply(f, [e, y]))));
        return fromItems(items(x).map((e) => this.apply(f, [e, y])));
      }
    }
    throw typeErr("unknown iterator");
  }

  each(f: QValue, args: QValue[]): QValue {
    if (args.length === 1) {
      const x = args[0];
      if (x instanceof QAtom) return this.apply(f, [x]);
      if (x instanceof QDict && !isKeyed(x)) return dict(x.k, fromItems(items(x.v).map((e) => this.apply(f, [e]))));
      const its = items(x);
      const out = new Array<QValue>(its.length);
      for (let i = 0; i < its.length; i++) out[i] = this.apply(f, [its[i]]);
      return fromItems(out);
    }
    const n = conformCount(args);
    if (n < 0) return this.apply(f, args);
    const its = args.map((a) => (a instanceof QAtom ? null : items(a)));
    const out = new Array<QValue>(n);
    for (let i = 0; i < n; i++) out[i] = this.apply(f, its.map((it, j) => (it ? it[i] : args[j])));
    const d = args.find((a) => a instanceof QDict && !isKeyed(a)) as QDict | undefined;
    if (d) return dict(d.k, fromItems(out));
    return fromItems(out);
  }

  converge(f: QValue, x: QValue, scan: boolean): QValue {
    const out: QValue[] = [x];
    let prev = x;
    for (let i = 0; ; i++) {
      this.tick();
      if (this.interrupt) throw new QError("stop");
      const next = this.applyJux(f, prev);
      if (matchValues(next, prev) || matchValues(next, x)) break;
      if (scan) out.push(next);
      prev = next;
      if (i > 1e7) throw new QError("limit", "Converge didn't settle after 10 million steps.");
    }
    return scan ? fromItems(out) : prev;
  }

  repeat(f: QValue, n: number, x: QValue, scan: boolean): QValue {
    if (n < 0) throw domainErr("Can't repeat a negative number of times.");
    const out: QValue[] = [x];
    let v = x;
    for (let i = 0; i < n; i++) {
      this.tick();
      v = this.applyJux(f, v);
      if (scan) out.push(v);
    }
    return scan ? fromItems(out) : v;
  }

  whileLoop(c: QValue, f: QValue, x: QValue, scan: boolean): QValue {
    const out: QValue[] = [x];
    let v = x;
    while (truthy(this.applyJux(c, v))) {
      this.tick();
      if (this.interrupt) throw new QError("stop");
      v = this.applyJux(f, v);
      if (scan) out.push(v);
    }
    return scan ? fromItems(out) : v;
  }

  // ---------------- indexing ----------------

  index(x: QValue, args: (QValue | undefined)[]): QValue {
    if (args.length === 1) return this.indexAt(x, args[0]);
    const [i, ...rest] = args;
    if (i === undefined || i === NIL) {
      if (x instanceof QTable) return this.index(this.index(x, rest), [undefined]);
      if (x instanceof QDict && !isKeyed(x)) return dict(x.k, fromItems(items(x.v).map((e) => this.index(e, rest))));
      return fromItems(items(x).map((e) => this.index(e, rest)));
    }
    if (x instanceof QTable && i instanceof QAtom && typeof i.v === "number") return this.index(this.indexAt(x, i), rest);
    const sel = this.indexAt(x, i);
    if (i instanceof QAtom) return this.index(sel, rest);
    if (i instanceof QVec || i instanceof QDict) return fromItems(items(sel).map((e) => this.index(e, rest)));
    return this.index(sel, rest);
  }

  indexAt(x: QValue, i: QValue | undefined): QValue {
    if (i === undefined || i === NIL) return x;
    if (x instanceof QFn) return this.apply(x, [i]);
    if (x instanceof QVec) {
      if (i instanceof QAtom) {
        if (typeof i.v !== "number" || i.t === -9 || i.t === -8) {
          if (typeof i.v === "number" && Number.isInteger(i.v)) return this.indexAt(x, long(i.v));
          throw typeErr(`A list is indexed by whole numbers, not a ${TYPE_NAMES[-i.t]}.`);
        }
        const k = i.v;
        if (k >= 0 && k < x.d.length && k === Math.floor(k)) return item(x, k);
        return nullItem(x);
      }
      if (i instanceof QVec) {
        if (i.t === 0) return fromItems((i.d as QValue[]).map((e) => this.indexAt(x, e)));
        if (i.t === 11 || i.t === 10 || i.t === 9 || i.t === 8) throw typeErr(`A list is indexed by whole numbers, not ${TYPE_NAMES[i.t]} values.`);
        return gather(x, i.d as Float64Array);
      }
      if (i instanceof QDict) return dict(i.k, this.indexAt(x, i.v));
      if (i instanceof QTable) return table(i.cols, i.data.map((c) => this.indexAt(x, c)));
      throw typeErr("Bad index.");
    }
    if (x instanceof QTable) {
      if (i instanceof QAtom && i.t === -11) {
        const j = x.cols.indexOf(i.v);
        if (j < 0) throw new QError(i.v, `Table has no column '${i.v}'. Columns: ${x.cols.join(", ")}.`);
        return x.data[j];
      }
      if (i instanceof QVec && i.t === 11) return list((i.d as string[]).map((c) => this.indexAt(x, sym(c))));
      if (i instanceof QAtom) {
        const k = i.v;
        const n = x.n;
        return dict(syms(x.cols), fromItems(x.data.map((c) => (k >= 0 && k < n ? this.indexAt(c, i) : nullItem(c as QVec)))));
      }
      if (i instanceof QVec) return table(x.cols, x.data.map((c) => this.indexAt(c, i)));
      throw typeErr("Bad table index.");
    }
    if (x instanceof QDict) {
      if (isKeyed(x)) return this.keyedLookup(x, i);
      return this.dictLookup(x, i);
    }
    if (x instanceof QAtom) {
      // file handles & integer handles
      if (typeof x.v === "number" && (x.t === -7 || x.t === -6 || x.t === -5)) return this.handleWrite(x.v, i);
      throw typeErr(`Can't index into an atom (${inline(x, 7)}).`);
    }
    throw typeErr("Bad index.");
  }

  handleWrite(h: number, v: QValue): QValue {
    const text = (x: QValue): string => {
      if (x instanceof QVec && x.t === 10) return x.d;
      if (x instanceof QAtom && x.t === -10) return x.v;
      if (x instanceof QVec && x.t === 0) return (x.d as QValue[]).map(text).join("\n");
      throw typeErr("Write strings to a handle, like -1 \"hello\".");
    };
    if (h === 1 || h === -1) {
      RT.stdout(text(v) + (h < 0 ? "" : ""));
      return h < 0 ? atom(-7, h) : atom(-7, h);
    }
    if (h === 2 || h === -2) {
      RT.stderr(text(v));
      return atom(-7, h);
    }
    throw domainErr(`Handle ${h} isn't open. Only 1/-1 (stdout) and 2/-2 (stderr) exist here.`);
  }

  dictLookup(d: QDict, i: QValue): QValue {
    const keys = d.k;
    const vals = d.v;
    const find = (k: QValue): QValue => {
      const pos = findIndex(keys, k);
      return pos < 0 ? nullItemOf(vals) : at(vals, pos);
    };
    const kIsListOfLists = keys instanceof QVec && keys.t === 0;
    if (i instanceof QAtom || kIsListOfLists) return find(i);
    if (i instanceof QVec) return fromItems(items(i).map(find));
    return find(i);
  }

  keyedLookup(d: QDict, i: QValue): QValue {
    const kt = d.k as QTable, vt = d.v as QTable;
    const rowOf = (key: QValue): number => {
      let kv: QValue[];
      if (key instanceof QDict) kv = kt.cols.map((c) => this.dictLookup(key, sym(c)));
      else if (kt.cols.length === 1) kv = [key];
      else kv = items(key);
      const n = kt.n;
      outer: for (let r = 0; r < n; r++) {
        for (let j = 0; j < kt.cols.length; j++) if (!matchValues(at(kt.data[j], r), kv[j])) continue outer;
        return r;
      }
      return -1;
    };
    if (i instanceof QTable) {
      const rows = items(i).map((r) => rowOf(r));
      return table(vt.cols, vt.data.map((c) => fromItems(rows.map((r) => (r < 0 ? nullItemOf(c) : at(c, r))))));
    }
    if (kt.cols.length === 1 && i instanceof QVec && i.t !== 0) {
      const rows = items(i).map((k) => rowOf(k));
      return table(vt.cols, vt.data.map((c) => fromItems(rows.map((r) => (r < 0 ? nullItemOf(c) : at(c, r))))));
    }
    const r = rowOf(i);
    return dict(syms(vt.cols), fromItems(vt.data.map((c) => (r < 0 ? nullItemOf(c) : at(c, r)))));
  }

  // ---------------- amend ----------------

  /** Functional amend at depth: x[idx...] (f)= y */
  amendPath(x: QValue, idx: (QValue | undefined)[], f: QValue | undefined, y: QValue | undefined): QValue {
    if (!idx.length) return f ? (y === undefined ? this.apply(f, [x]) : this.apply(f, [x, y])) : y!;
    const [i, ...rest] = idx;
    if (!rest.length) return this.amendAt(x, i, f, y);
    // nested
    if (i === undefined || i === NIL) {
      const its = items(x);
      const ys = y !== undefined && !(y instanceof QAtom) && count(y) === its.length ? items(y) : null;
      const out = its.map((e, j) => this.amendPath(e, rest, f, ys ? ys[j] : y));
      return rebuild(x, out);
    }
    if (i instanceof QAtom) {
      const cur = this.indexAt(x, i);
      const nv = this.amendPath(cur, rest, f, y);
      return this.amendAt(x, i, undefined, nv);
    }
    const ks = items(i);
    const ys = y !== undefined && !(y instanceof QAtom) && count(y) === ks.length ? items(y) : null;
    let cur = x;
    ks.forEach((k, j) => {
      cur = this.amendPath(cur, [k, ...rest], f, ys ? ys[j] : y);
    });
    return cur;
  }

  amendAt(x: QValue, i: QValue | undefined, f: QValue | undefined, y: QValue | undefined): QValue {
    const upd = (old: QValue, yv: QValue | undefined): QValue => {
      if (!f) return yv!;
      return yv === undefined ? this.apply(f, [old]) : this.apply(f, [old, yv]);
    };
    if (i === undefined || i === NIL) {
      // whole value
      if (x instanceof QTable || x instanceof QDict) {
        if (!f) return y!;
        return y === undefined ? this.apply(f, [x]) : this.apply(f, [x, y]);
      }
      const its = items(x);
      const ys = y !== undefined && !(y instanceof QAtom) && count(y) === its.length ? items(y) : null;
      return rebuild(x, its.map((e, j) => upd(e, ys ? ys[j] : y)));
    }
    if (x instanceof QDict && !isKeyed(x)) {
      const keys = items(x.k);
      const vals = [...items(x.v)];
      const set = (k: QValue, yv: QValue | undefined) => {
        const p = findIndex(x.k, k);
        if (p < 0) {
          keys.push(k);
          vals.push(upd(nullItemOf(x.v), yv));
        } else vals[p] = upd(vals[p], yv);
      };
      if (i instanceof QAtom) set(i, y);
      else {
        const ks = items(i);
        const ys = y !== undefined && !(y instanceof QAtom) && count(y) === ks.length ? items(y) : null;
        ks.forEach((k, j) => set(k, ys ? ys[j] : y));
      }
      const nk = x.k instanceof QVec && x.k.t === 0 && keys.length ? list(keys) : fromItems(keys);
      return dict(nk, keepType(x.v, vals));
    }
    if (x instanceof QTable) {
      if (i instanceof QAtom && i.t === -11) {
        const j = x.cols.indexOf(i.v);
        const cols = [...x.cols], data = [...x.data];
        const nv = j < 0 ? upd(nullLike(x.data[0] ?? emptyList()), y) : upd(x.data[j], y);
        const col = nv instanceof QAtom ? takeAtom(nv, x.n) : nv;
        if (j < 0) {
          cols.push(i.v);
          data.push(col);
        } else data[j] = col;
        return table(cols, data);
      }
      if (i instanceof QAtom) {
        // row amend with a dict
        const row = upd(this.indexAt(x, i), y);
        if (!(row instanceof QDict)) throw typeErr("Assign a dictionary to a table row.");
        return table(x.cols, x.data.map((c, j) => this.amendAt(c, i, undefined, this.dictLookup(row, sym(x.cols[j])))));
      }
      throw typeErr("Unsupported table amend.");
    }
    if (x instanceof QDict) {
      // keyed table: upsert row by key
      const kt = x.k as QTable, vt = x.v as QTable;
      const cur = this.keyedLookup(x, i!);
      const row = upd(cur, y);
      if (!(row instanceof QDict)) throw typeErr("Assign a dictionary to a keyed-table row.");
      const krow = kt.cols.length === 1 && !(i instanceof QDict) ? [i!] : items(i!);
      let r = -1;
      outer: for (let rr = 0; rr < kt.n; rr++) {
        for (let j = 0; j < kt.cols.length; j++) if (!matchValues(at(kt.data[j], rr), krow[j])) continue outer;
        r = rr;
        break;
      }
      if (r < 0) {
        return dict(
          table(kt.cols, kt.data.map((c, j) => appendItem(c, krow[j]))),
          table(vt.cols, vt.data.map((c, j) => appendItem(c, this.dictLookup(row, sym(vt.cols[j]))))),
        );
      }
      return dict(kt, table(vt.cols, vt.data.map((c, j) => this.amendAt(c, long(r), undefined, this.dictLookup(row, sym(vt.cols[j]))))));
    }
    if (!(x instanceof QVec)) {
      if (x instanceof QAtom && (i instanceof QAtom || i === undefined)) return upd(x, y);
      throw typeErr("Can't amend this value.");
    }
    // vector
    const n = x.d.length;
    let its: QValue[] | null = null;
    const setAt = (k: number, yv: QValue | undefined) => {
      if (!Number.isInteger(k) || k < 0 || k >= n) throw indexErr(`Index ${k} is out of range — this list has ${n} item${n === 1 ? "" : "s"} (0..${n - 1}).`);
      if (!its) its = [...items(x)];
      its[k] = upd(its[k], yv);
    };
    if (i instanceof QAtom) setAt(i.v, y);
    else if (i instanceof QVec) {
      const ks = items(i);
      const ys = y !== undefined && !(y instanceof QAtom) && count(y) === ks.length ? items(y) : null;
      if (y !== undefined && !(y instanceof QAtom) && !ys && ks.length !== 1) throw lengthErr(`Amending ${ks.length} positions needs 1 or ${ks.length} values, got ${count(y)}.`);
      ks.forEach((k, j) => {
        if (k instanceof QAtom) setAt(k.v, ys ? ys[j] : y);
        else throw typeErr("Nested index lists aren't supported in amend.");
      });
    } else throw typeErr("Bad amend index.");
    if (!its) return x;
    return keepType(x, its);
  }

  // ---------------- system commands ----------------

  system(cmd: string, n: { s: number; e: number }): QValue {
    const m = /^(\S+)\s*([\s\S]*)$/.exec(cmd.trim());
    if (!m) return NIL;
    const [, c, rest] = m;
    const timed = /^(t|ts)(?::(\d+))?$/.exec(c);
    if (timed) {
      const reps = timed[2] ? +timed[2] : 1;
      const prog = parse(rest);
      const t0 = performance.now();
      for (let i = 0; i < reps; i++) this.runProgram(prog);
      const ms = Math.round(performance.now() - t0);
      if (timed[1] === "ts") return longs([ms, 0]);
      return long(ms);
    }
    switch (c) {
      case "c": {
        if (!rest) return vec(6, Float64Array.from([this.fmt.rows, this.fmt.cols]));
        const [r, w] = rest.split(/\s+/).map(Number);
        this.fmt.rows = r;
        if (w) this.fmt.cols = w;
        return NIL;
      }
      case "P": {
        if (!rest) return atom(-6, this.fmt.precision);
        this.fmt.precision = Math.max(0, Math.min(17, +rest));
        return NIL;
      }
      case "S": {
        if (!rest) return atom(-6, 0);
        RT.seed(+rest);
        return NIL;
      }
      case "d": {
        if (!rest) return sym(this.cur || ".");
        const ns = rest.trim();
        this.cur = ns === "." ? "" : ns;
        this.nsMap(this.cur);
        return NIL;
      }
      case "v": case "f": case "a": {
        const ns = rest.trim() || this.cur;
        return syms(RT.names(ns || "", c as "v" | "f" | "a"));
      }
      case "l": {
        const file = rest.trim();
        const text = this.host.files?.get(file);
        if (text === undefined) throw new QError(file, `No file named '${file}' in this project.`).at(n);
        this.run(text);
        return NIL;
      }
      case "\\":
        return NIL;
      default:
        throw new QError("nyi", `System command \\${c} isn't available in the browser.`).at(n);
    }
  }
}

// ---------------- helpers ----------------

const VERB_CACHE = new Map<string, QValue>();

export function verbValue(op: string, n?: { s: number; e: number }): QValue {
  let v = VERB_CACHE.get(op);
  if (v) return v;
  if (op === "::") v = NIL;
  else if (op.length === 2 && op[1] === ":") {
    const base = GLYPHS.get(op[0]);
    if (!base || !(base instanceof Builtin) || !base.m) throw new QError("parse", `'${op}' isn't a verb.`).at(n);
    v = new Builtin(op, 1, base.m, undefined, undefined, true);
  } else {
    v = GLYPHS.get(op);
    if (!v) throw new QError("parse", `'${op}' isn't a verb.`).at(n);
  }
  VERB_CACHE.set(op, v);
  return v;
}

export function rankOf(f: QValue): number {
  if (f instanceof QFn) return f.rank;
  return 1;
}

function ambivalent(f: QFn): boolean {
  if (f instanceof Builtin) return !!(f.m && f.d);
  if (f instanceof Derived) return f.adv !== "'" || f.baseRank === 1;
  return false;
}

function rankMsg(f: QFn, got: number): string {
  if (f instanceof Lambda) return `This function takes ${f.rank} argument${f.rank === 1 ? "" : "s"} (${f.node.params.join(";")}) but was given ${got}.`;
  if (f instanceof Builtin) return `${f.name} takes ${f.rank} argument${f.rank === 1 ? "" : "s"} but was given ${got}.`;
  return `Wrong number of arguments (${got}).`;
}

export function truthy(v: QValue, n?: { s: number; e: number }): boolean {
  if (v instanceof QAtom) {
    if (typeof v.v === "number") return v.v !== 0;
    if (v.t === -10) return v.v.charCodeAt(0) !== 0;
    throw typeErr("A condition must be a number or boolean.").at(n);
  }
  if (v instanceof QVec && v.d.length === 1 && v.t > 0 && v.t !== 11) return (v.d as any)[0] !== 0;
  throw typeErr("A condition must be a single boolean (atom), not a list. Try `all` or `any`.").at(n);
}

function takeAtom(a: QAtom, n: number): QValue {
  const t = -a.t;
  if (t === 10) return str(a.v.repeat(n));
  if (t === 11 || t === 2) return vec(t, new Array(n).fill(a.v));
  if (t > 0 && t < 20) return vec(t, new Float64Array(n).fill(a.v));
  return list(new Array(n).fill(a));
}

export function conformCount(args: QValue[]): number {
  let n = -1;
  for (const a of args) {
    if (a instanceof QAtom) continue;
    const c = count(a);
    if (n >= 0 && c !== n) throw lengthErr(`each: arguments have different lengths (${n} and ${c}).`);
    n = c;
  }
  return n;
}

function keepShape(src: QValue, out: QValue[]): QValue {
  if (src instanceof QDict && !isKeyed(src)) return dict(src.k, fromItems(out));
  return fromItems(out);
}

function priorSeed(f: QValue, x0: QValue): QValue | undefined {
  if (f instanceof Builtin && f.glyph) {
    const zero = (v: number) => (x0 instanceof QAtom && typeof x0.v === "number" ? atom(x0.t, v) : long(v));
    switch (f.name) {
      case "-": case "+": return zero(0);
      default: return undefined;
    }
  }
  return x0 instanceof QAtom ? nullOf(x0.t) : nullLike(x0);
}

function gather(x: QVec, idx: Float64Array): QVec {
  const n = idx.length, len = x.d.length, t = x.t;
  if (t === 10) {
    let s = "";
    const d = x.d as string;
    for (let i = 0; i < n; i++) {
      const k = idx[i];
      s += k >= 0 && k < len ? d[k] : " ";
    }
    return str(s);
  }
  if (t === 0) {
    const d = x.d as QValue[];
    const nul = nullItem(x);
    const out = new Array<QValue>(n);
    for (let i = 0; i < n; i++) {
      const k = idx[i];
      out[i] = k >= 0 && k < len ? d[k] : nul;
    }
    return fromItems(out) as QVec;
  }
  if (t === 11 || t === 2) {
    const d = x.d as string[];
    const nv = nullOf(t).v;
    const out = new Array<string>(n);
    for (let i = 0; i < n; i++) {
      const k = idx[i];
      out[i] = k >= 0 && k < len ? d[k] : nv;
    }
    return vec(t, out);
  }
  const d = x.d as Float64Array;
  const out = new Float64Array(n);
  const nv = t === 1 || t === 4 ? 0 : NaN;
  for (let i = 0; i < n; i++) {
    const k = idx[i];
    out[i] = k >= 0 && k < len ? d[k] : nv;
  }
  return vec(t, out);
}

export function findIndex(keys: QValue, k: QValue): number {
  if (keys instanceof QVec) {
    const d = keys.d as any;
    if (k instanceof QAtom && keys.t === -k.t) {
      const v = k.v;
      if (keys.t === 10) return (d as string).indexOf(v);
      if (v !== v) {
        for (let i = 0; i < d.length; i++) if (d[i] !== d[i]) return i;
        return -1;
      }
      for (let i = 0; i < d.length; i++) if (d[i] === v) return i;
      return -1;
    }
    const its = items(keys);
    for (let i = 0; i < its.length; i++) if (matchValues(its[i], k)) return i;
    return -1;
  }
  if (keys instanceof QTable) {
    const its = items(keys);
    for (let i = 0; i < its.length; i++) if (matchValues(its[i], k)) return i;
  }
  return -1;
}

function at(x: QValue, i: number): QValue {
  if (x instanceof QVec) return item(x, i);
  return items(x)[i];
}

function nullItemOf(x: QValue): QValue {
  if (x instanceof QVec) return nullItem(x);
  if (x instanceof QTable) return dict(syms(x.cols), fromItems(x.data.map((c) => nullItemOf(c))));
  return NIL;
}

function appendItem(c: QValue, v: QValue): QValue {
  return keepType(c, [...items(c), v]);
}

/** Rebuild a list after item replacement. Simple vectors stay typed if every item still fits. */
function keepType(orig: QValue, its: QValue[]): QValue {
  if (orig instanceof QVec && orig.t > 0) {
    const t = orig.t;
    const ok = its.every((e) => e instanceof QAtom && e.t === -t);
    if (!ok) {
      const bad = its.find((e) => !(e instanceof QAtom && e.t === -t))!;
      throw typeErr(`This is a ${TYPE_NAMES[t]} list, so every item must be a ${TYPE_NAMES[t]} — got ${describeVal(bad)}. Cast first, e.g. \`${TYPE_NAMES[t]}$x.`);
    }
    return list2vec(its);
  }
  if (orig instanceof QTable) return fromItems(its);
  return fromItems(its);
}

function describeVal(v: QValue): string {
  if (v instanceof QAtom) return `a ${TYPE_NAMES[-v.t]}`;
  if (v instanceof QVec) return v.t ? `a ${TYPE_NAMES[v.t]} list` : "a list";
  return TYPE_NAMES[typeOf(v)] ?? "a value";
}

function rebuild(x: QValue, out: QValue[]): QValue {
  if (x instanceof QDict && !isKeyed(x)) return dict(x.k, fromItems(out));
  if (x instanceof QVec && x.t > 0) return keepType(x, out);
  return fromItems(out);
}

function isAssignLast(p: Program): boolean {
  const last = p.stmts[p.stmts.length - 1];
  return !!last && last.k === "assign";
}

function toQError(e: unknown): QError {
  if (e instanceof QError) return e;
  if (e instanceof Return) return new QError("return", "`:` return used outside a function.");
  if (e instanceof RangeError) return new QError("stack", "Recursion went too deep.");
  const err = new QError("internal", String((e as Error)?.stack ?? e));
  return err;
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}

export function fmtFn(f: QFn, p: number): string {
  if (f instanceof QIdentity) return "::";
  if (f instanceof Lambda) return f.src;
  if (f instanceof Builtin) return f.name;
  if (f instanceof Proj) {
    const base = f.f instanceof QFn ? fmtFn(f.f, p) : inline(f.f, p);
    const b = f.f instanceof Derived || (f.f instanceof Builtin && f.f.glyph) ? base : base;
    const args = [...f.args];
    while (args.length > 1 && args[args.length - 1] === undefined) args.pop();
    return `${b}[${args.map((a) => (a === undefined ? "" : inline(a, p))).join(";")}]`;
  }
  if (f instanceof Derived) {
    const base = f.f instanceof QFn ? fmtFn(f.f, p) : inline(f.f, p);
    return base + f.adv;
  }
  if (f instanceof Comp) return "'[" + f.fs.map((g) => (g instanceof QFn ? fmtFn(g, p) : inline(g, p))).join(";") + "]";
  return "<fn>";
}

/** parse (keyword) – returns a parse tree in q form */
function parseToQ(src: string): QValue {
  const prog = parse(src);
  const conv = (n: Node): QValue => {
    switch (n.k) {
      case "lit": return n.v instanceof QAtom && n.v.t === -11 ? list([n.v]) : n.v;
      case "name": return sym(n.n);
      case "verb": return verbValue(n.op);
      case "mono": return list([conv(n.f), conv(n.x)]);
      case "dyad": return list([conv(n.f), conv(n.x), conv(n.y)]);
      case "app": return list([conv(n.f), ...n.args.map((a) => (a ? conv(a) : NIL))]);
      case "assign": return list([verbValue(":"), sym(n.name), conv(n.v)]);
      case "list": return list([BUILTINS.get("enlist")!, ...n.items.map(conv)]);
      case "lambda": return new Lambda(n, "");
      case "adv": return new Derived(conv(n.f), n.a, 2);
      default: return str(prog.src.slice(n.s, n.e));
    }
  };
  if (prog.stmts.length === 1) return conv(prog.stmts[0]);
  return list(prog.stmts.map(conv));
}

export { NIL };
