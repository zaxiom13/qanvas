// Finds the values in q source that are safe to change by tapping: number literals, colour
// names and palette names. Pure and DOM-free, so it can run anywhere (and be reasoned about).
import { NAMED, PALETTES } from "./color";

export type Piece =
  | { kind: "text"; text: string }
  | { kind: "comment"; text: string }
  | { kind: "string"; text: string }
  | { kind: "word"; text: string }
  | { kind: "symbol"; text: string }
  | { kind: "num"; text: string; tweak: number }
  | { kind: "color"; text: string; tweak: number }
  | { kind: "palette"; text: string; tweak: number };

export type Tweak =
  | { kind: "num"; from: number; to: number; value: number; decimals: number; suffix: string; signed: boolean }
  | { kind: "color"; from: number; to: number; name: string }
  | { kind: "palette"; from: number; to: number; name: string };

export const COLOR_NAMES = Object.keys(NAMED).filter((n) => !["q", "kx"].includes(n));
export const PALETTE_NAMES = Object.keys(PALETTES);

const isWord = (c: string | undefined) => !!c && /[\w.]/.test(c);
const isDigit = (c: string | undefined) => !!c && c >= "0" && c <= "9";

/** Split source into display pieces; tweakable pieces carry their index into `tweaks`. */
export function scan(src: string): { pieces: Piece[]; tweaks: Tweak[] } {
  const pieces: Piece[] = [];
  const tweaks: Tweak[] = [];
  let i = 0;
  let plain = "";
  const flush = () => {
    if (plain) pieces.push({ kind: "text", text: plain });
    plain = "";
  };
  while (i < src.length) {
    const c = src[i];
    const prev = src[i - 1];
    // comment: "/" at the start of a line or after whitespace runs to the end of the line
    if (c === "/" && (i === 0 || prev === "\n" || prev === " " || prev === "\t")) {
      const end = src.indexOf("\n", i);
      const stop = end < 0 ? src.length : end;
      flush();
      pieces.push({ kind: "comment", text: src.slice(i, stop) });
      i = stop;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"' && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      j = Math.min(src.length, j + 1);
      flush();
      pieces.push({ kind: "string", text: src.slice(i, j) });
      i = j;
      continue;
    }
    if (c === "`") {
      let j = i + 1;
      while (j < src.length && /[\w.:/]/.test(src[j])) j++;
      const name = src.slice(i + 1, j);
      flush();
      if (NAMED[name] && COLOR_NAMES.includes(name)) {
        pieces.push({ kind: "color", text: src.slice(i, j), tweak: tweaks.length });
        tweaks.push({ kind: "color", from: i, to: j, name });
      } else if (PALETTES[name]) {
        pieces.push({ kind: "palette", text: src.slice(i, j), tweak: tweaks.length });
        tweaks.push({ kind: "palette", from: i, to: j, name });
      } else pieces.push({ kind: "symbol", text: src.slice(i, j) });
      i = j;
      continue;
    }
    if (isDigit(c) && !isWord(prev)) {
      let j = i;
      while (isDigit(src[j])) j++;
      let decimals = 0;
      if (src[j] === "." && isDigit(src[j + 1])) {
        j++;
        while (isDigit(src[j])) {
          j++;
          decimals++;
        }
      } else if (src[j] === "." && !isWord(src[j + 1])) j++;
      let suffix = "";
      if (src[j] === "f" || src[j] === "j" || src[j] === "i" || src[j] === "h" || src[j] === "e") suffix = src[j++];
      const tail = src[j];
      // dates, times, 0N/0w/0b, 0x.., and names like 2nd are not plain numbers
      const literal = !isWord(tail) && tail !== ":" && !(tail === "." && isDigit(src[j + 1]));
      flush();
      if (literal) {
        const negStart = prev === "-" && (i < 2 || /[\s(\[;:]/.test(src[i - 2]));
        const from = negStart ? i - 1 : i;
        if (negStart) {
          // the "-" was already emitted as plain text; take it back into the number
          const last = pieces[pieces.length - 1];
          if (last?.kind === "text" && last.text.endsWith("-")) {
            last.text = last.text.slice(0, -1);
            if (!last.text) pieces.pop();
          }
        }
        const text = src.slice(from, j);
        const signed = from === 0 || /[\s(\[;:]/.test(src[from - 1]);
        pieces.push({ kind: "num", text, tweak: tweaks.length });
        tweaks.push({ kind: "num", from, to: j, value: parseFloat(text), decimals, suffix, signed });
      } else {
        // swallow the whole literal, including the rest of a time like 12:30:05
        while (isWord(src[j]) || (src[j] === ":" && isDigit(src[j + 1]))) j++;
        pieces.push({ kind: "text", text: src.slice(i, j) });
      }
      i = j;
      continue;
    }
    if (/[a-zA-Z_.]/.test(c) && !isWord(prev)) {
      let j = i;
      while (isWord(src[j])) j++;
      flush();
      pieces.push({ kind: "word", text: src.slice(i, j) });
      i = j;
      continue;
    }
    plain += c;
    i++;
  }
  flush();
  return { pieces, tweaks };
}

/** The natural step for a number: its last decimal place, or a tenth of its size for big integers. */
export function stepFor(t: Extract<Tweak, { kind: "num" }>): number {
  if (t.decimals > 0) return 10 ** -t.decimals;
  const mag = Math.abs(t.value);
  return mag >= 100 ? 10 ** (Math.floor(Math.log10(mag)) - 1) : 1;
}

export function formatNum(t: Extract<Tweak, { kind: "num" }>, value: number): string {
  let v = t.signed ? value : Math.max(0, value);
  v = Number(v.toFixed(t.decimals));
  const body = t.decimals > 0 ? v.toFixed(t.decimals) : String(Math.round(v));
  return body + t.suffix;
}

/** Replace one tweakable value; returns the new source. */
export function applyTweak(src: string, t: Tweak, replacement: string): string {
  return src.slice(0, t.from) + replacement + src.slice(t.to);
}
