import {
  fmtDate, fmtDatetime, fmtMinute, fmtMonth, fmtSecond, fmtTime, fmtTimespan, fmtTimestamp,
} from "./temporal";
import { QAtom, QDict, QFn, QTable, QValue, QVec, count, isKeyed, items, typeChar } from "./value";

export interface FmtOpts {
  precision: number; // \P
  rows: number; // \c rows
  cols: number; // \c cols
}

export const DEFAULT_FMT: FmtOpts = { precision: 7, rows: 25, cols: 80 };

// Function display is provided by the interpreter (it knows about lambdas, projections...)
let fnFormatter: (f: QFn) => string = () => "<fn>";
export function setFnFormatter(f: (f: QFn) => string) {
  fnFormatter = f;
}

// ---------- numbers ----------
export function fmtFloat(v: number, p: number): string {
  if (v !== v) return "0n";
  if (v === Infinity) return "0w";
  if (v === -Infinity) return "-0w";
  if (v === 0) return Object.is(v, -0) ? "-0" : "0";
  if (p === 0) p = 17;
  const exp = Math.floor(Math.log10(Math.abs(v)));
  let s: string;
  if (exp < -4 || exp >= p) {
    s = v.toExponential(Math.max(0, p - 1));
    let [m, e] = s.split("e");
    if (m.includes(".")) m = m.replace(/0+$/, "").replace(/\.$/, "");
    const sign = e[0] === "-" ? "-" : "+";
    let digits = e.replace(/^[+-]/, "");
    if (digits.length < 2) digits = "0" + digits;
    s = `${m}e${sign}${digits}`;
  } else {
    s = v.toPrecision(p);
    if (s.includes("e")) {
      // toPrecision may choose exponent form; recompute fixed
      s = v.toFixed(Math.max(0, p - 1 - exp));
    }
    if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  }
  return s;
}

const intNull = (v: number, sfx: string) => (v !== v ? "0N" + sfx : v === Infinity ? "0W" + sfx : v === -Infinity ? "-0W" + sfx : null);

/** Format an atom value without type decoration (as used inside vectors & tables). */
export function bare(t: number, v: any, p: number): string {
  switch (t) {
    case 1: return v ? "1" : "0";
    case 2: return v;
    case 4: return (v as number).toString(16).padStart(2, "0");
    case 5: case 6: case 7: return intNull(v, "") ?? String(v);
    case 8: case 9: return fmtFloat(v, p);
    case 10: return v;
    case 11: return v;
    case 12: return fmtTimestamp(v);
    case 13: return fmtMonth(v);
    case 14: return fmtDate(v);
    case 15: return fmtDatetime(v);
    case 16: return fmtTimespan(v);
    case 17: return fmtMinute(v);
    case 18: return fmtSecond(v);
    case 19: return fmtTime(v);
  }
  return String(v);
}

function escStr(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (c < 32 || c === 127) out += "\\" + c.toString(8).padStart(3, "0");
    else out += ch;
  }
  return out;
}

export function fmtAtom(a: QAtom, p: number): string {
  const t = -a.t;
  const v = a.v;
  switch (t) {
    case 1: return (v ? "1" : "0") + "b";
    case 2: return v;
    case 4: return "0x" + bare(4, v, p);
    case 5: return intNull(v, "h") ?? v + "h";
    case 6: return intNull(v, "i") ?? v + "i";
    case 7: return intNull(v, "") ?? String(v);
    case 8: {
      if (v !== v) return "0Ne";
      if (!Number.isFinite(v)) return (v < 0 ? "-" : "") + "0we";
      const s = fmtFloat(v, p);
      return s + "e";
    }
    case 9: {
      const s = fmtFloat(v, p);
      if (v !== v || !Number.isFinite(v)) return s;
      return /[.e]/.test(s) ? s : s + "f";
    }
    case 10: return `"${escStr(v)}"`;
    case 11: return "`" + v;
    case 13: return v !== v ? "0Nm" : bare(13, v, p) + "m";
    case 16: return fmtTimespan(v);
    case 17: return fmtMinute(v);
    case 18: return fmtSecond(v);
    default: return bare(t, v, p);
  }
}

const EMPTY_NAMES: Record<number, string> = {
  1: "`boolean$()", 2: "`guid$()", 4: "`byte$()", 5: "`short$()", 6: "`int$()", 7: "`long$()", 8: "`real$()",
  9: "`float$()", 10: '""', 11: "`symbol$()", 12: "`timestamp$()", 13: "`month$()", 14: "`date$()",
  15: "`datetime$()", 16: "`timespan$()", 17: "`minute$()", 18: "`second$()", 19: "`time$()",
};

/** One-line form of a simple vector, with type decoration. */
export function fmtSimpleVec(x: QVec, p: number): string {
  const t = x.t, d = x.d as any, n = d.length;
  const attr = x.attr ? "`" + x.attr + "#" : "";
  if (n === 0) return EMPTY_NAMES[t] ?? "()";
  if (t === 10) return attr + (n === 1 ? "," : "") + `"${escStr(d)}"`;
  const pre = attr + (n === 1 ? "," : "");
  if (t === 11) return pre + (d as string[]).map((s) => "`" + s).join("");
  if (t === 1) return pre + Array.from(d as Float64Array, (b) => (b ? "1" : "0")).join("") + "b";
  if (t === 4) return pre + "0x" + Array.from(d as Float64Array, (b) => bare(4, b, p)).join("");
  if (t === 2) return pre + (d as string[]).join(" ");
  const parts = new Array<string>(n);
  for (let i = 0; i < n; i++) parts[i] = bare(t, d[i], p);
  let body = parts.join(" ");
  switch (t) {
    case 5: body = n === 1 && d[0] !== d[0] ? "0Nh" : allNull(d) ? parts.map(() => "0N").join(" ") + "h" : body + "h"; break;
    case 6: body = allNull(d) ? parts.map(() => "0N").join(" ") + "i" : body + "i"; break;
    case 7: if (allNull(d)) body = parts.join(" "); break;
    case 8: body = body + "e"; break;
    case 9: {
      const decorated = parts.some((s) => /[.e]|n|w/.test(s));
      if (!decorated) body += "f";
      break;
    }
    case 13: body += "m"; break;
    case 17: case 18: case 16: break;
  }
  if (t === 14 || t === 12 || t === 15 || t === 19) {
    // nulls in temporal vectors print as 0N
    body = parts.map((s) => s.replace(/^0N[a-z]$/, "0N")).join(" ");
    if (parts.every((s) => /^-?0[NW]/.test(s))) body = parts.map((s) => s.replace(/[a-z]$/, "")).join(" ") + typeChar(t);
  }
  return pre + body;
}

function allNull(d: Float64Array) {
  for (let i = 0; i < d.length; i++) if (d[i] === d[i]) return false;
  return true;
}

/** Single-line representation used for nested values: (1;`a;"bc"). */
export function inline(x: QValue, p: number): string {
  if (x instanceof QAtom) return fmtAtom(x, p);
  if (x instanceof QVec) {
    if (x.t > 0) return fmtSimpleVec(x, p);
    const d = x.d as QValue[];
    if (d.length === 0) return "()";
    if (d.length === 1) return "," + inlineNested(d[0], p);
    return "(" + d.map((e) => inlineNested(e, p)).join(";") + ")";
  }
  if (x instanceof QTable) return "+" + inline(new QDict(new QVec(11, x.cols), new QVec(0, x.data)), p);
  if (x instanceof QDict) {
    if (isKeyed(x)) return "(" + inline(x.k, p) + ")!" + inline(x.v, p);
    const k = inlineNested(x.k, p);
    return k + "!" + inlineNested(x.v, p);
  }
  return fnFormatter(x as QFn);
}

function inlineNested(x: QValue, p: number): string {
  if (x instanceof QVec && x.t === 0 && x.d.length > 1) return inline(x, p);
  if (x instanceof QDict && !isKeyed(x)) return "(" + inline(x, p) + ")";
  return inline(x, p);
}

// ---------- console (multi-line) ----------

/** How a value appears inside a table cell or dictionary value column. */
function cell(x: QValue, p: number): string {
  if (x instanceof QAtom) {
    const t = -x.t;
    if (t === 10) return x.v;
    if (t === 11) return x.v;
    if (t === 4) return "0x" + bare(4, x.v, p);
    if (t === 1) return (x.v ? "1" : "0") + "b";
    return bare(t, x.v, p);
  }
  if (x instanceof QVec) {
    if (x.t === 10) return x.d;
    if (x.t === 11) return (x.d as string[]).map((s) => "`" + s).join("");
    if (x.t > 0) {
      if (x.d.length === 1) return fmtSimpleVec(x, p);
      const s = fmtSimpleVec(x, p);
      return s;
    }
    return inline(x, p);
  }
  return inline(x, p);
}

/** Column of cells for a table column. */
function colCells(c: QValue, n: number, p: number): string[] {
  if (c instanceof QVec) {
    const t = c.t;
    const d = c.d as any;
    const out = new Array<string>(n);
    if (t === 0) {
      // equal-length vectors in a column print as aligned sub-columns
      const grid = gridCells((d as QValue[]).slice(0, n), p);
      if (grid && grid[0] && grid[0].length > 1 && (d as QValue[]).every((e) => e instanceof QVec && e.t !== 0)) {
        const w: number[] = [];
        for (const r of grid) r.forEach((c, j) => (w[j] = Math.max(w[j] ?? 0, c.length)));
        for (let i = 0; i < n; i++) out[i] = grid[i].map((c, j) => pad(c, w[j])).join(" ");
      } else for (let i = 0; i < n; i++) out[i] = inlineNested(d[i], p);
    }
    else if (t === 10) for (let i = 0; i < n; i++) out[i] = d[i];
    else if (t === 11 || t === 2) for (let i = 0; i < n; i++) out[i] = d[i];
    else if (t === 1) for (let i = 0; i < n; i++) out[i] = d[i] ? "1" : "0";
    else if (t === 4) for (let i = 0; i < n; i++) out[i] = bare(4, d[i], p);
    else for (let i = 0; i < n; i++) out[i] = bareCell(t, d[i], p);
    return out;
  }
  return items(c).map((e) => cell(e, p));
}

function bareCell(t: number, v: number, p: number): string {
  if (v !== v) return "";
  return bare(t, v, p);
}

function pad(s: string, w: number) {
  return s.length >= w ? s : s + " ".repeat(w - s.length);
}

function tableLines(t: QTable, p: number, maxRows: number): string[] {
  const n = Math.min(t.n, maxRows);
  const cols = t.cols.map((name, j) => {
    const cells = colCells(t.data[j], n, p);
    const w = Math.max(name.length, ...cells.map((s) => s.length));
    return { name, cells, w };
  });
  const lines: string[] = [];
  lines.push(cols.map((c) => pad(c.name, c.w)).join(" "));
  lines.push("-".repeat(cols.reduce((a, c) => a + c.w, 0) + cols.length - 1));
  for (let i = 0; i < n; i++) lines.push(cols.map((c) => pad(c.cells[i], c.w)).join(" "));
  return lines;
}

function keyedLines(k: QTable, v: QTable, p: number, maxRows: number): string[] {
  const kl = tableLines(k, p, maxRows);
  const vl = tableLines(v, p, maxRows);
  const kw = Math.max(...kl.map((l) => l.length));
  return kl.map((l, i) => pad(l, kw) + "| " + vl[i]);
}

function dictLines(d: QDict, p: number, maxRows: number): string[] {
  if (isKeyed(d)) return keyedLines(d.k as QTable, d.v as QTable, p, maxRows);
  const keys = d.k, vals = d.v;
  const n = Math.min(count(keys), maxRows);
  let klines: string[];
  if (keys instanceof QTable) klines = tableLines(keys, p, n).slice(2);
  else klines = items(keys).slice(0, n).map((k) => cell(k, p));
  if (vals instanceof QTable) {
    const vl = tableLines(vals, p, n);
    const kw = Math.max(0, ...klines.map((s) => s.length));
    const out = [pad("", kw) + "| " + vl[0], "-".repeat(kw) + "| " + vl[1]];
    for (let i = 0; i < n; i++) out.push(pad(klines[i], kw) + "| " + vl[i + 2]);
    return out;
  }
  const vitems = items(vals).slice(0, n);
  if (vals instanceof QVec && vals.t === 0) {
    const grid = gridCells(vitems, p);
    if (grid) {
      const kw0 = Math.max(0, ...klines.map((s) => s.length));
      const w: number[] = [];
      for (const r of grid) r.forEach((c, j) => (w[j] = Math.max(w[j] ?? 0, c.length)));
      return grid.map((r, i) => pad(klines[i], kw0) + "| " + r.map((c, j) => pad(c, w[j])).join(" "));
    }
  }
  const simpleVals = vals instanceof QVec && vals.t > 0;
  const kw = Math.max(0, ...klines.map((s) => s.length));
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const v = vitems[i];
    const vs = simpleVals ? cell(v, p) : dictVal(v, p);
    out.push(pad(klines[i], kw) + "| " + vs);
  }
  return out;
}

function dictVal(v: QValue, p: number): string {
  return inlineNested(v, p);
}

/** Items that are all lists of one common length print as an aligned grid. */
function gridCells(xs: QValue[], p: number): string[][] | null {
  if (!xs.length) return null;
  let n = -1;
  for (const e of xs) {
    if (!(e instanceof QVec)) return null;
    if (n >= 0 && e.d.length !== n) return null;
    n = e.d.length;
  }
  // lists of strings / bit vectors / byte vectors keep their literal form
  const t0 = (xs[0] as QVec).t;
  if ((t0 === 10 || t0 === 1 || t0 === 4) && xs.every((e) => (e as QVec).t === t0)) return null;
  return xs.map((e) => {
    const v = e as QVec;
    if (v.t === 0) return (v.d as QValue[]).map((c) => inlineNested(c, p));
    if (v.t === 10) return Array.from(v.d as string);
    if (v.t === 1) return Array.from(v.d as Float64Array, (b) => (b ? "1" : "0"));
    return Array.from(v.d as ArrayLike<any>, (c) => bare(v.t, c, p));
  });
}

/** Lines for a value as shown at the q) prompt. */
export function lines(x: QValue, o: FmtOpts = DEFAULT_FMT, top = true): string[] {
  const p = o.precision;
  const maxRows = Math.max(1, o.rows);
  if (x instanceof QTable) return tableLines(x, p, maxRows);
  if (x instanceof QDict) return dictLines(x, p, maxRows);
  if (x instanceof QVec && x.t === 0) {
    const d = x.d as QValue[];
    if (!d.length) return top ? [] : ["()"];
    const grid = gridCells(d, p);
    if (grid) {
      const rows = grid.slice(0, maxRows);
      const w: number[] = [];
      for (const r of rows) r.forEach((c, j) => (w[j] = Math.max(w[j] ?? 0, c.length)));
      return rows.map((r) => r.map((c, j) => pad(c, w[j])).join(" "));
    }
    const out: string[] = [];
    for (const e of d.slice(0, maxRows)) {
      if (e instanceof QVec && e.t === 0 && e.d.length === 0) out.push(d.every((z) => !(z instanceof QAtom)) ? "" : "()");
      else if (e instanceof QTable || (e instanceof QDict)) out.push(inline(e, p));
      else out.push(inlineNested(e, p));
    }
    return out;
  }
  if (x instanceof QVec) return [fmtSimpleVec(x, p)];
  if (x instanceof QAtom) return [fmtAtom(x, p)];
  return [fnFormatter(x as QFn)];
}

/** Full console text (with \c truncation). */
export function show(x: QValue, o: FmtOpts = DEFAULT_FMT): string {
  let ls = lines(x, o);
  const maxLines = Math.max(1, o.rows - 1);
  if (ls.length > maxLines) ls = [...ls.slice(0, maxLines - 1), ".."];
  const w = o.cols;
  ls = ls.map((l) => (l.length > w ? l.slice(0, w - 2) + ".." : l));
  return ls.join("\n");
}
