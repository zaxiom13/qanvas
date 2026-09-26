import { QError, typeErr, domainErr } from "./errors";
import { bare, fmtFloat } from "./format";
import { NS_PER_DAY, parseTemporal, qDateParts, qDate } from "./temporal";
import {
  QAtom, QDict, QTable, QValue, QVec, TYPE_NAMES, atom, dict, fromItems, items, list, str, sym, syms, table, typeOfChar, vec, nullOf, emptyOf,
} from "./value";

const NAME_TO_TYPE: Record<string, number> = {
  boolean: 1, guid: 2, byte: 4, short: 5, int: 6, long: 7, real: 8, float: 9, char: 10, symbol: 11,
  timestamp: 12, month: 13, date: 14, datetime: 15, timespan: 16, minute: 17, second: 18, time: 19,
};

const FIELDS = new Set(["year", "mm", "dd", "hh", "uu", "ss", "week"]);

// units of temporal types in ns (for inter-temporal casts)
const UNIT: Record<number, number> = { 12: 1, 14: NS_PER_DAY, 15: NS_PER_DAY, 16: 1, 17: 60e9, 18: 1e9, 19: 1e6 };

/** Resolve the left operand of $ to a target: type code (>0), parse code (<0 means parse from text), or field name. */
function target(x: QValue): { t: number; parse: boolean; field?: string } {
  if (x instanceof QAtom) {
    if (x.t === -11) {
      if (x.v === "") return { t: 11, parse: true };
      if (FIELDS.has(x.v)) return { t: 0, parse: false, field: x.v };
      const t = NAME_TO_TYPE[x.v];
      if (t === undefined) throw typeErr(`Unknown type name \`${x.v}. Try \`long, \`float, \`symbol, \`date...`);
      return { t, parse: false };
    }
    if (x.t === -10) {
      const c = x.v as string;
      if (c === "*") return { t: 10, parse: true };
      if (c >= "A" && c <= "Z") {
        const t = typeOfChar(c.toLowerCase());
        if (t <= 0) throw typeErr(`Unknown parse type "${c}".`);
        return { t, parse: true };
      }
      const t = typeOfChar(c);
      if (t < 0 || c === " ") throw typeErr(`Unknown type char "${c}".`);
      return { t, parse: false };
    }
    if (typeof x.v === "number" && (x.t === -5 || x.t === -6 || x.t === -7)) {
      if (x.v < 0) throw typeErr("Cast with a positive type number, like 9h$x.");
      const t = x.v;
      if (t < 1 || t > 19 || t === 3) throw typeErr(`Unknown type number ${x.v}.`);
      return { t, parse: false };
    }
  }
  throw typeErr("Cast needs a type on the left: a name like `float, a char like \"f\", or a number like 9h.");
}

export function cast(x: QValue, y: QValue): QValue {
  if (x instanceof QVec) {
    // list of targets pairs with y
    const xs = items(x);
    const ys = y instanceof QAtom ? xs.map(() => y) : items(y);
    if (ys.length !== xs.length) throw new QError("length", "Cast: left and right lengths differ.");
    return fromItems(xs.map((t, i) => cast(t, ys[i])));
  }
  const tg = target(x);
  if (tg.field) return field(tg.field, y);
  if (tg.parse) return parseText(tg.t, y);
  return castTo(tg.t, y);
}

export function castByName(c: string, y: QValue): QValue {
  return cast(atom(-10, c), y);
}

function castTo(t: number, y: QValue): QValue {
  if (y instanceof QTable) return table(y.cols, y.data.map((c) => castTo(t, c)));
  if (y instanceof QDict) return dict(y.k, castTo(t, y.v));
  if (y instanceof QAtom) {
    const from = -y.t;
    return atom(-t, convertOne(t, from, y.v));
  }
  if (y instanceof QVec) {
    const from = y.t;
    if (from === 0 && y.d.length === 0) return emptyOf(t);
    if (from === 0) {
      // strings -> symbols is the common case
      if (t === 11) return syms((y.d as QValue[]).map((e) => (e instanceof QVec && e.t === 10 ? e.d : e instanceof QAtom && e.t === -10 ? e.v : (castTo(11, e) as QAtom).v)));
      return fromItems((y.d as QValue[]).map((e) => castTo(t, e)));
    }
    if (from === 10 && t === 11) return sym(y.d as string);
    const n = y.d.length;
    if (t === 10) {
      if (from === 10) return y;
      return str(Array.from({ length: n }, (_, i) => convertOne(10, from, (y.d as any)[i])).join(""));
    }
    if (t === 11 || t === 2) return vec(t, Array.from({ length: n }, (_, i) => convertOne(t, from, (y.d as any)[i])));
    const out = new Float64Array(n);
    const d = y.d as any;
    for (let i = 0; i < n; i++) out[i] = convertOne(t, from, from === 10 ? d[i] : d[i]);
    return vec(t, out);
  }
  throw typeErr("Can't cast a function.");
}

function roundQ(v: number) {
  if (v !== v || !Number.isFinite(v)) return v;
  return Math.sign(v) * Math.floor(Math.abs(v) + 0.5);
}

function convertOne(t: number, from: number, v: any): any {
  if (from === t) return v;
  // from char / symbol
  if (from === 10) {
    if (t === 11) return v;
    const code = (v as string).charCodeAt(0);
    return convertOne(t, 4, code);
  }
  if (from === 11) {
    if (t === 10) throw typeErr("Cast a symbol to a string with `string`, not `char$.");
    if (t === 11) return v;
    throw typeErr(`Can't cast a symbol to ${TYPE_NAMES[t]}. To parse text use an uppercase type, e.g. "J"$string x.`);
  }
  if (t === 11) {
    if (from === 10) return v;
    throw typeErr(`Can't cast ${TYPE_NAMES[from]} to symbol. Try \`$string x.`);
  }
  if (t === 10) {
    if (typeof v !== "number") throw typeErr();
    return v !== v ? " " : String.fromCharCode(((v % 256) + 256) % 256);
  }
  if (t === 2) throw typeErr("Can't cast to guid.");
  if (typeof v !== "number") throw typeErr();
  const isNull = v !== v;
  const fromT = from >= 12 && from <= 19;
  const toT = t >= 12 && t <= 19;
  if (fromT && toT) {
    if (isNull || !Number.isFinite(v)) return v;
    if (t === 13) {
      if (from === 14) return monthOfDate(v);
      if (from === 12) return monthOfDate(Math.floor(v / NS_PER_DAY));
      if (from === 15) return monthOfDate(Math.floor(v));
      throw typeErr(`Can't cast ${TYPE_NAMES[from]} to month.`);
    }
    if (from === 13) {
      if (t === 14) return monthToDate(v);
      if (t === 12) return monthToDate(v) * NS_PER_DAY;
      if (t === 15) return monthToDate(v);
      throw typeErr(`Can't cast month to ${TYPE_NAMES[t]}.`);
    }
    const ns = v * UNIT[from];
    const absolute = (tt: number) => tt === 12 || tt === 14 || tt === 15;
    if (absolute(from) && !absolute(t)) {
      // time-of-day part
      const tod = ns - Math.floor(ns / NS_PER_DAY) * NS_PER_DAY;
      const r = tod / UNIT[t];
      return t === 16 ? tod : Math.floor(r + 1e-9);
    }
    if (t === 14) return Math.floor(ns / NS_PER_DAY);
    if (t === 15) return ns / NS_PER_DAY;
    const r = ns / UNIT[t];
    return t === 12 || t === 16 ? Math.round(r) : Math.floor(r + 1e-9);
  }
  if (toT) {
    if (from === 9 || from === 8) {
      if (t === 15) return v;
      return roundQ(v);
    }
    return v;
  }
  switch (t) {
    case 1: return isNull ? 0 : v !== 0 ? 1 : 0;
    case 4: return isNull ? 0 : ((roundQ(v) % 256) + 256) % 256;
    case 5: {
      if (isNull || !Number.isFinite(v)) return v;
      const r = roundQ(v);
      return (r << 16) >> 16;
    }
    case 6: {
      if (isNull || !Number.isFinite(v)) return v;
      return roundQ(v) | 0;
    }
    case 7: {
      if (from === 15) return isNull ? v : Math.floor(v);
      return roundQ(v);
    }
    case 8: return Math.fround(v);
    case 9: return v;
  }
  throw typeErr(`Can't cast ${TYPE_NAMES[from]} to ${TYPE_NAMES[t]}.`);
}

function monthOfDate(d: number): number {
  const [y, m] = qDateParts(d);
  return (y - 2000) * 12 + (m - 1);
}
function monthToDate(m: number): number {
  const y = 2000 + Math.floor(m / 12);
  const mm = m - Math.floor(m / 12) * 12 + 1;
  return qDate(y, mm, 1);
}

function field(f: string, y: QValue): QValue {
  const one = (t: number, v: number): [number, number] => {
    if (v !== v) return [f === "year" || f === "mm" || f === "dd" || f === "hh" || f === "uu" || f === "ss" ? 6 : 14, NaN];
    let days = 0, ns = 0;
    if (t === 14) days = v;
    else if (t === 12) { days = Math.floor(v / NS_PER_DAY); ns = v - days * NS_PER_DAY; }
    else if (t === 15) { days = Math.floor(v); ns = (v - days) * NS_PER_DAY; }
    else if (t === 13) { days = monthToDate(v); }
    else if (t >= 16) ns = v * UNIT[t];
    const [yy, mm, dd] = qDateParts(days);
    switch (f) {
      case "year": return [6, yy];
      case "mm": return [6, mm];
      case "dd": return [6, dd];
      case "hh": return [6, Math.floor(ns / 3600e9) % 24];
      case "uu": return [6, Math.floor(ns / 60e9) % 60];
      case "ss": return [6, Math.floor(ns / 1e9) % 60];
      case "week": {
        const wd = ((days % 7) + 7 + 5) % 7; // 2000.01.01 was a Saturday; Monday-based
        return [14, days - wd];
      }
    }
    return [6, NaN];
  };
  if (y instanceof QAtom) {
    const [t, v] = one(-y.t, y.v);
    return atom(-t, v);
  }
  if (y instanceof QVec && y.t > 0) {
    const d = y.d as Float64Array;
    let rt = 6;
    const out = new Float64Array(d.length);
    for (let i = 0; i < d.length; i++) {
      const [t, v] = one(y.t, d[i]);
      rt = t;
      out[i] = v;
    }
    return vec(rt, out);
  }
  return fromItems(items(y).map((e) => field(f, e)));
}

// ---------- parsing text ----------
function parseText(t: number, y: QValue): QValue {
  if (y instanceof QAtom && y.t === -10) return parseText(t, str(y.v));
  if (y instanceof QVec && y.t === 10) return atom(-t, parseOne(t, y.d as string));
  if (y instanceof QVec && y.t === 0) {
    const its = y.d as QValue[];
    if (its.every((e) => (e instanceof QVec && e.t === 10) || (e instanceof QAtom && e.t === -10))) {
      if (t === 11) return syms(its.map((e) => (e instanceof QVec ? e.d : (e as QAtom).v)));
      const out = its.map((e) => parseOne(t, e instanceof QVec ? e.d : (e as QAtom).v));
      if (t === 10) return str(out.join(""));
      return vec(t, Float64Array.from(out as number[]));
    }
    return fromItems(its.map((e) => parseText(t, e)));
  }
  if (y instanceof QDict) return dict(y.k, parseText(t, y.v));
  if (y instanceof QTable) return table(y.cols, y.data.map((c) => parseText(t, c)));
  throw typeErr("Parsing with an uppercase type needs strings on the right.");
}

function parseOne(t: number, s: string): any {
  s = s.trim();
  if (t === 11) return s;
  if (t === 10) return s;
  if (s === "") return nullOf(t).v;
  switch (t) {
    case 1: return s === "1" || /^t(rue)?$/i.test(s) || /^y(es)?$/i.test(s) ? 1 : 0;
    case 4: return parseInt(s.replace(/^0x/, ""), 16) & 255;
    case 5: case 6: case 7: {
      if (/^-?0[NnWw]/.test(s)) return /N/i.test(s[s[0] === "-" ? 2 : 1]) ? NaN : s[0] === "-" ? -Infinity : Infinity;
      if (!/^-?\d+[hij]?$/.test(s)) {
        if (/^-?\d*\.\d*$/.test(s)) return Math.trunc(Number(s));
        return NaN;
      }
      return parseInt(s, 10);
    }
    case 8: case 9: {
      if (/^-?0[nw]$/i.test(s)) return s.toLowerCase().includes("n") ? NaN : s[0] === "-" ? -Infinity : Infinity;
      const v = Number(s.replace(/[ef]$/, ""));
      return Number.isNaN(v) ? NaN : t === 8 ? Math.fround(v) : v;
    }
    default: {
      const suffix = "pmdznuvt"[t - 12];
      let body = s.replace(/[a-z]$/, "");
      // allow ISO-ish separators
      body = body.replace(/^(\d{4})-(\d{2})-(\d{2})/, "$1.$2.$3");
      if (t === 12 && /^\d{4}\.\d{2}\.\d{2}$/.test(body)) body += "D";
      if (t === 12) body = body.replace(/^(\d{4}\.\d{2}\.\d{2})[T ]/, "$1D");
      if (t === 15) body = body.replace(/^(\d{4}\.\d{2}\.\d{2})[D ]/, "$1T");
      const r = parseTemporal(body, suffix);
      if (!r) return NaN;
      const [pt, v] = r;
      if (pt === t) return v;
      return convertOne(t, pt, v);
    }
  }
}

// ---------- string ----------
export function stringOf(x: QValue): QValue {
  if (x instanceof QAtom) {
    const t = -x.t;
    if (t === 10) return str(x.v);
    if (t === 11) return str(x.v);
    if (t === 1) return str(x.v ? "1" : "0");
    if (t === 4) return str(bare(4, x.v, 7));
    if (t === 8 || t === 9) {
      if (x.v !== x.v) return str("");
      return str(fmtFloat(x.v, 7));
    }
    if (typeof x.v === "number" && x.v !== x.v) return str("");
    if (t === 13) return str(bare(13, x.v, 7));
    return str(bare(t, x.v, 7));
  }
  if (x instanceof QVec) {
    if (x.t === 10) return list(Array.from(x.d as string, (c) => str(c)));
    if (x.t === 0) return list((x.d as QValue[]).map(stringOf));
    return list(items(x).map(stringOf));
  }
  if (x instanceof QDict) return dict(x.k, stringOf(x.v));
  if (x instanceof QTable) return table(x.cols, x.data.map(stringOf));
  return str("");
}

export { domainErr };
