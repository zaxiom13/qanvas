import { QError } from "./errors";
import { parseTemporal } from "./temporal";
import { QAtom, QValue, QVec, atom, str, sym, syms, vec, typeOfChar } from "./value";

export type TokKind =
  | "num" | "sym" | "str" | "name" | "op" | "adv"
  | "(" | ")" | "[" | "]" | "{" | "}" | ";" | "nl" | "sys" | "eof";

export interface Tok {
  k: TokKind;
  s: number;
  e: number;
  text: string;
  v?: QValue;
  /** preceded by whitespace (or line start) */
  ws: boolean;
}

const VERB_CHARS = "+-*%!&|<>=~,^#_$?@.:";
const isDigit = (c: string) => c >= "0" && c <= "9";
const isAlpha = (c: string) => (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
const isNameChar = (c: string) => isAlpha(c) || isDigit(c) || c === "_" || c === ".";
const isSpace = (c: string) => c === " " || c === "\t" || c === "\r";

// A single numeric element (no spaces). Temporal forms first.
const NUM_RE =
  /^(?:0x[0-9a-fA-F]*|[01]+b|-?\d{4}\.\d{2}\.\d{2}[DT][\d:.]*[a-z]?|-?\d{4}\.\d{2}\.\d{2}|-?\d{4}\.\d{2}m|-?\d+D[\d:.]*[a-z]?|-?\d{1,2}:\d{2}(?::\d{2}(?:\.\d*)?)?[a-z]?|-?0[NnWw][a-z]?|-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?[a-z]?)/;

interface NumElem {
  t: number; // type code of the element, 0 = untyped integer literal (long by default)
  v: number;
  explicit: boolean; // had a type suffix
  floaty: boolean; // written with . or e
  nullish: "" | "N" | "n" | "W" | "w";
}

const SUFFIXES = "bxhijefpmdznuvt";

function parseElem(text: string): NumElem | null {
  let neg = false;
  let s = text;
  if (s[0] === "-") { neg = true; s = s.slice(1); }
  const sign = neg ? -1 : 1;
  // nulls / infinities
  const nm = /^0([NnWw])([a-z]?)$/.exec(s);
  if (nm) {
    const kind = nm[1] as "N" | "n" | "W" | "w";
    const suf = nm[2];
    let t = suf ? typeOfChar(suf) : kind === "n" || kind === "w" ? 9 : 7;
    if (suf === "c") return null;
    if (t < 0) return null;
    const v = kind === "N" || kind === "n" ? NaN : sign * Infinity;
    return { t, v, explicit: !!suf || kind === "n" || kind === "w", floaty: kind === "n" || kind === "w", nullish: kind };
  }
  // temporal
  const tm = /^(.*?)([a-z]?)$/.exec(s)!;
  if (/[.:D]/.test(s) && /^\d/.test(s) && (s.includes(":") || s.includes("D") || /^\d{4}\.\d{2}/.test(s))) {
    let body = s, hint: string | undefined;
    if (/[a-z]$/.test(s) && !/D$/.test(s)) { hint = tm[2]; body = tm[1]; }
    const pt = parseTemporal(body, hint);
    if (pt) {
      let [t, v] = pt;
      if (hint && typeOfChar(hint) !== t) {
        // allow explicit retyping of clock forms e.g. 12:00:00t
        const ht = typeOfChar(hint);
        if (ht > 0) t = ht;
      }
      return { t, v: sign * v, explicit: true, floaty: false, nullish: "" };
    }
    if (!/^\d+\.?\d*(e[+-]?\d+)?[a-z]?$/.test(s)) return null;
  }
  // plain numbers
  const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?([a-z]?)$/.exec(s);
  if (!m) return null;
  const suf = m[3];
  const floaty = m[1].includes(".") || !!m[2];
  let v = Number(m[1] + (m[2] ?? ""));
  if (suf && !SUFFIXES.includes(suf)) return null;
  let t = suf ? typeOfChar(suf) : floaty ? 9 : 0;
  if (suf === "e") v = Math.fround(v);
  if (suf === "b") { if (v !== 0 && v !== 1) return null; }
  if (suf && t >= 12) {
    // numeric with temporal suffix e.g. 1D? keep as count in that unit
  }
  if (!floaty && Number.isInteger(v) === false) return null;
  return { t, v: sign * v, explicit: !!suf, floaty, nullish: "" };
}

function combine(elems: NumElem[], texts: string[]): QValue {
  if (elems.length === 1) {
    const e = elems[0];
    let t = e.t === 0 ? 7 : e.t;
    let v = e.v;
    if ((t === 6 || t === 5 || t === 4 || t === 7) && e.floaty) throw new QError("parse", `'${texts[0]}' is not an integer`);
    return atom(-t, v);
  }
  // explicit suffix on last element decides; otherwise widest
  const last = elems[elems.length - 1];
  const lastText = texts[texts.length - 1];
  if (last.explicit && last.t >= 12 && /[a-z]$/.test(lastText)) {
    const suf = lastText[lastText.length - 1];
    const d = new Float64Array(elems.length);
    for (let i = 0; i < elems.length; i++) {
      const tx = texts[i].replace(/[a-z]$/, "");
      if (/^-?0[NW]$/.test(tx)) { d[i] = tx.includes("N") ? NaN : tx[0] === "-" ? -Infinity : Infinity; continue; }
      const neg = tx[0] === "-";
      const r = parseTemporal(neg ? tx.slice(1) : tx, suf);
      if (!r) throw new QError("parse", `'${texts[i]}' isn't a valid ${suf} value`);
      d[i] = neg ? -r[1] : r[1];
    }
    return vec(last.t, d);
  }
  let t = 0;
  if (last.explicit && last.nullish === "") t = last.t;
  else {
    const types = new Set(elems.filter((e) => e.nullish !== "N" || e.explicit).map((e) => e.t));
    if (elems.some((e) => e.floaty) || types.has(9)) t = 9;
    else if (types.size === 1) t = [...types][0];
    else if (types.size === 0) t = 7;
    else {
      types.delete(0);
      t = types.size === 1 ? [...types][0] : -1;
    }
    if (t === 0) t = 7;
  }
  if (t < 0) throw new QError("parse", `can't mix ${texts.join(" ")} in one vector literal`);
  const d = new Float64Array(elems.length);
  for (let i = 0; i < elems.length; i++) {
    const e = elems[i];
    if (e.explicit && e.t !== t && e.nullish === "" && i !== elems.length - 1) {
      // temporal mixed with numbers etc.
      if (!(t === 9 && e.t === 7)) throw new QError("parse", `can't mix ${texts.join(" ")} in one vector literal`);
    }
    d[i] = t === 8 ? Math.fround(e.v) : e.v;
  }
  return vec(t, d);
}

export function lex(src: string): Tok[] {
  const toks: Tok[] = [];
  const n = src.length;
  let i = 0;
  const stack: string[] = [];
  let lineStart = true;
  let ws = true;

  const push = (k: TokKind, s: number, e: number, v?: QValue) => {
    toks.push({ k, s, e, text: src.slice(s, e), v, ws });
    ws = false;
    lineStart = false;
  };
  const prevNounEnd = () => {
    const p = toks[toks.length - 1];
    if (!p) return false;
    return p.k === "num" || p.k === "sym" || p.k === "str" || p.k === "name" || p.k === ")" || p.k === "]" || p.k === "}";
  };

  while (i < n) {
    const c = src[i];

    // ----- line-start constructs -----
    if (lineStart) {
      // block comment: line with only "/"
      const eol = src.indexOf("\n", i) < 0 ? n : src.indexOf("\n", i);
      const line = src.slice(i, eol);
      if (stack.length === 0 && /^\/\s*$/.test(line)) {
        // skip to a line that is only "\"
        let j = eol + 1;
        while (j < n) {
          const e2 = src.indexOf("\n", j) < 0 ? n : src.indexOf("\n", j);
          if (/^\\\s*$/.test(src.slice(j, e2))) { j = e2 + 1; break; }
          j = e2 + 1;
        }
        i = j;
        continue;
      }
      if (stack.length === 0 && /^\\\s*$/.test(line)) { i = n; break; }
      if (c === "/") { i = eol; continue; }
      if (stack.length === 0 && c === "\\" && i + 1 < n && src[i + 1] !== "\n") {
        push("sys", i, eol);
        toks[toks.length - 1].text = src.slice(i + 1, eol).trim();
        i = eol;
        continue;
      }
    }

    if (c === "\n") {
      const top = stack[stack.length - 1];
      // A newline ends a statement at top level and directly inside { }, indented or not, so
      // nobody has to remember a trailing ';'. Inside ( ) and [ ] it is just whitespace, which
      // keeps multi-line lists, tables and if[...] / $[...] bodies working.
      if (!top || top === "{") {
        const p = toks[toks.length - 1];
        if (p && p.k !== "nl" && p.k !== ";" && p.k !== "{") push("nl", i, i + 1);
      }
      i++;
      ws = true;
      lineStart = true;
      continue;
    }
    if (isSpace(c)) {
      i++;
      ws = true;
      continue;
    }
    lineStart = false;

    // trailing comment: whitespace then "/"
    if (c === "/" && ws) {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }

    const start = i;

    // strings
    if (c === '"') {
      let j = i + 1;
      let out = "";
      while (j < n && src[j] !== '"') {
        if (src[j] === "\\" && j + 1 < n) {
          const e = src[j + 1];
          if (e === "n") out += "\n";
          else if (e === "t") out += "\t";
          else if (e === "r") out += "\r";
          else if (e === "\\") out += "\\";
          else if (e === '"') out += '"';
          else if (/[0-7]/.test(e) && /^[0-7]{3}/.test(src.slice(j + 1, j + 4))) {
            out += String.fromCharCode(parseInt(src.slice(j + 1, j + 4), 8));
            j += 2;
          } else out += e;
          j += 2;
        } else out += src[j++];
      }
      if (j >= n) throw new QError("parse", "This string is missing its closing quote \".").at({ s: start, e: n, src });
      i = j + 1;
      push("str", start, i, out.length === 1 ? atom(-10, out) : str(out));
      continue;
    }

    // symbols
    if (c === "`") {
      const names: string[] = [];
      let j = i;
      while (j < n && src[j] === "`") {
        let k = j + 1;
        if (src[k] === ":") {
          k++;
          while (k < n && (isNameChar(src[k]) || src[k] === ":" || src[k] === "/")) k++;
        } else {
          while (k < n && isNameChar(src[k])) k++;
        }
        names.push(src.slice(j + 1, k));
        j = k;
      }
      i = j;
      push("sym", start, i, names.length === 1 ? sym(names[0]) : syms(names));
      continue;
    }

    // numbers (incl. negative literals)
    const negCtx = c === "-" && (isDigit(src[i + 1] ?? "") || (src[i + 1] === "." && isDigit(src[i + 2] ?? ""))) && (ws || !prevNounEnd());
    if (isDigit(c) || (c === "." && isDigit(src[i + 1] ?? "")) || negCtx) {
      const elems: NumElem[] = [];
      const texts: string[] = [];
      let j = i;
      let lastEnd = i;
      while (true) {
        const m = NUM_RE.exec(src.slice(j));
        if (!m) break;
        const text = m[0];
        const after = src[j + text.length] ?? "";
        if (isAlpha(after)) {
          if (elems.length === 0) throw new QError("parse", `'${text}${after}' is not a valid number or name`).at({ s: j, e: j + text.length + 1, src });
          break;
        }
        // boolean vectors and byte literals are standalone tokens
        if (/^[01]+b$/.test(text) || text.startsWith("0x")) {
          if (elems.length) break;
          j += text.length;
          lastEnd = j;
          let v: QValue;
          if (text.endsWith("b")) {
            const bits = text.slice(0, -1);
            v = bits.length === 1 ? atom(-1, +bits) : vec(1, Float64Array.from(bits, (b) => +b));
          } else {
            const hex = text.slice(2);
            if (!hex.length) v = vec(4, new Float64Array(0));
            else if (hex.length <= 2) v = atom(-4, parseInt(hex, 16));
            else {
              const h = hex.length % 2 ? "0" + hex : hex;
              const d = new Float64Array(h.length / 2);
              for (let b = 0; b < d.length; b++) d[b] = parseInt(h.slice(b * 2, b * 2 + 2), 16);
              v = vec(4, d);
            }
          }
          elems.push({ t: -1, v: 0, explicit: true, floaty: false, nullish: "" });
          i = j;
          push("num", start, i, v);
          break;
        }
        const e = parseElem(text);
        if (!e) {
          if (elems.length === 0) throw new QError("parse", `'${text}' is not a valid number`).at({ s: j, e: j + text.length, src });
          break;
        }
        elems.push(e);
        texts.push(text);
        j += text.length;
        lastEnd = j;
        // continue the vector across single-line spaces
        let k = j;
        while (k < n && (src[k] === " " || src[k] === "\t")) k++;
        if (k === j || k >= n) break;
        const nc = src[k];
        const startsNum = isDigit(nc) || (nc === "." && isDigit(src[k + 1] ?? "")) || (nc === "-" && (isDigit(src[k + 1] ?? "") || src[k + 1] === "."));
        if (!startsNum) break;
        const m2 = NUM_RE.exec(src.slice(k));
        if (!m2 || /^[01]+b$/.test(m2[0]) || m2[0].startsWith("0x")) break;
        const after2 = src[k + m2[0].length] ?? "";
        if (isAlpha(after2)) break;
        const e2 = parseElem(m2[0]);
        if (!e2) break;
        // don't merge temporal with non-temporal
        const tmp1 = e.t >= 12, tmp2 = e2.t >= 12;
        if (tmp1 !== tmp2 && e.nullish === "" && e2.nullish === "" && !(tmp2 && /[a-z]$/.test(m2[0]))) break;
        j = k;
      }
      if (toks.length && toks[toks.length - 1].s === start) continue; // bool/byte handled
      if (!elems.length) throw new QError("parse", "bad number").at({ s: i, e: i + 1, src });
      i = lastEnd;
      let v: QValue;
      try {
        v = combine(elems, texts);
      } catch (err) {
        if (err instanceof QError) throw err.at({ s: start, e: i, src });
        throw err;
      }
      push("num", start, i, v);
      continue;
    }

    // names
    if (isAlpha(c) || (c === "." && isAlpha(src[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < n && isNameChar(src[j])) j++;
      // trailing dots are not part of a name
      while (j > i + 1 && src[j - 1] === ".") j--;
      i = j;
      push("name", start, i);
      continue;
    }

    // brackets
    if (c === "(" || c === "[" || c === "{") {
      stack.push(c);
      i++;
      push(c as TokKind, start, i);
      continue;
    }
    if (c === ")" || c === "]" || c === "}") {
      const want = c === ")" ? "(" : c === "]" ? "[" : "{";
      if (stack[stack.length - 1] !== want) {
        throw new QError("parse", stack.length ? `Found '${c}' but expected the '${closer(stack[stack.length - 1])}' that closes an earlier '${stack[stack.length - 1]}'.` : `This '${c}' has no matching opening bracket.`).at({ s: i, e: i + 1, src });
      }
      stack.pop();
      i++;
      // drop a trailing separator before a closing brace
      const p = toks[toks.length - 1];
      if (c === "}" && p && p.k === "nl") toks.pop();
      push(c as TokKind, start, i);
      continue;
    }
    if (c === ";") {
      i++;
      push(";", start, i);
      continue;
    }

    // adverbs
    if (c === "'" || c === "/" || c === "\\") {
      if (src[i + 1] === ":" ) {
        i += 2;
        push("adv", start, i);
        continue;
      }
      i++;
      push("adv", start, i);
      continue;
    }

    // verbs (+ optional ':' for assign-ops); "::"; io verbs 0: 1: 2:
    if (VERB_CHARS.includes(c)) {
      if (c === ":" && src[i + 1] === ":") {
        i += 2;
        push("op", start, i);
        continue;
      }
      if (c === "'" ) { i++; push("adv", start, i); continue; }
      if ((c === "<" && (src[i + 1] === "=" || src[i + 1] === ">")) || (c === ">" && src[i + 1] === "=")) {
        i += 2;
        push("op", start, i);
        continue;
      }
      if (c !== ":" && src[i + 1] === ":" && !(src[i + 2] === ":")) {
        // forms like +: ,: (assign-op or explicit monadic)
        i += 2;
        push("op", start, i);
        continue;
      }
      i++;
      push("op", start, i);
      continue;
    }

    throw new QError("parse", `Unexpected character '${c}'.`).at({ s: i, e: i + 1, src });
  }
  if (stack.length) {
    const open = stack[stack.length - 1];
    let pos = -1;
    for (let k = toks.length - 1; k >= 0; k--) if (toks[k].k === open) { pos = toks[k].s; break; }
    throw new QError("parse", `This '${open}' is never closed — add a '${closer(open)}'.`).at({ s: Math.max(0, pos), e: Math.max(1, pos + 1), src });
  }
  toks.push({ k: "eof", s: n, e: n, text: "", ws: true });
  return toks;
}

const closer = (o: string) => (o === "(" ? ")" : o === "[" ? "]" : "}");

export const isQAtom = (v: QValue | undefined): v is QAtom => v instanceof QAtom;
export const isQVec = (v: QValue | undefined): v is QVec => v instanceof QVec;
