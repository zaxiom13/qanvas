import { qMonarchSyntax } from "./syntax.js";

const reIdent = /^[a-zA-Z_.][a-zA-Z0-9_.]*/;
const reSymbol = /^`\w*/;
const reBrackets = /^[{}()[\]]/;
const reDate = /^\d{4}\.\d{2}\.\d{2}/;
const reTime = /^\d{2}:\d{2}:\d{2}(\.\d{1,9})?/;
const reNumber = /^0[NWwn]|-0[Ww]|\d+(\.\d+)?([eE][-+]?\d+)?[fij]?/;
const reWs = /^[ \t\r\n]+/;

const symbolsHead = new RegExp(`^${qMonarchSyntax.symbols.source}`);

function symbolsAtStart(s: string): string | null {
  const m = symbolsHead.exec(s);
  return m ? m[0] : null;
}

function tryKdbComment(source: string, i: number): number | null {
  if (source[i] !== "/") return null;
  if (source[i + 1] === ":") return null;

  const prev = i === 0 ? "\n" : source[i - 1]!;
  let j = i - 1;
  while (j >= 0 && (source[j] === " " || source[j] === "\t" || source[j] === "\r")) j -= 1;
  const prevNonSpace = j < 0 ? "\n" : source[j]!;
  const atStatementStart = j < 0 || prevNonSpace === "\n" || prevNonSpace === ";";

  const next = source[i + 1] ?? "";
  const startsCommentText =
    next === " " || next === "\t" || /[A-Za-z0-9`"]/.test(next);
  const looksLikeTrailing =
    (prev === " " || prev === "\t" || prev === "\r") &&
    startsCommentText &&
    next !== ":" &&
    next !== "/" &&
    next !== "\\";

  if (next !== ":" && (atStatementStart || looksLikeTrailing)) {
    let k = i;
    while (k < source.length && source[k] !== "\n") k += 1;
    return k;
  }
  return null;
}

export type KdbLexTokenKind =
  | "whitespace"
  | "newline"
  | "separator"
  | "identifier"
  | "symbol"
  | "bracket"
  | "operator"
  | "date"
  | "number"
  | "string"
  | "boolean"
  | "boolvector"
  | "comment"
  | "directive"
  | "eof";

export interface KdbLexToken {
  kind: KdbLexTokenKind;
  value: string;
  start: number;
  end: number;
}

const pushToken = (
  tokens: KdbLexToken[],
  kind: KdbLexTokenKind,
  value: string,
  start: number,
  end: number
) => {
  tokens.push({ kind, value, start, end });
};

/**
 * Walks the source with the same rule order as KDBLex / qMonarchSyntax (root + strings).
 * Invoked before the Peggy parse entry so the editor lexer and runtime share one lexical front-end.
 */
export function lexKdbLex(source: string): KdbLexToken[] {
  const tokens: KdbLexToken[] = [];
  let i = 0;

  while (i < source.length) {
    const rest = source.slice(i);
    const char = source[i]!;
    const start = i;

    if (char === " " || char === "\t" || char === "\r") {
      let end = i + 1;
      while (end < source.length && (source[end] === " " || source[end] === "\t" || source[end] === "\r")) {
        end += 1;
      }
      pushToken(tokens, "whitespace", source.slice(i, end), start, end);
      i = end;
      continue;
    }

    const cEnd = tryKdbComment(source, i);
    if (cEnd !== null) {
      pushToken(tokens, "comment", source.slice(i, cEnd), start, cEnd);
      i = cEnd;
      continue;
    }

    if (char === "\\") {
      const previous = source[i - 1] ?? "\n";
      const atDirectiveStart =
        i === 0 ||
        previous === "\n" ||
        previous === ";" ||
        previous === " " ||
        previous === "\t" ||
        previous === "\r";
      if (atDirectiveStart) {
        let end = i;
        while (end < source.length && source[end] !== "\n") end += 1;
        pushToken(tokens, "directive", source.slice(i, end), start, end);
        i = end;
        continue;
      }
    }

    if (char === "\n") {
      pushToken(tokens, "newline", "\n", start, start + 1);
      i += 1;
      continue;
    }

    if (char === ";") {
      pushToken(tokens, "separator", ";", start, start + 1);
      i += 1;
      continue;
    }

    if (
      (char === "+" || char === ",") &&
      (source[i + 1] === "/" || source[i + 1] === "\\") &&
      source[i + 2] !== ":" &&
      source[i + 2] !== "'"
    ) {
      pushToken(tokens, "operator", `${char}${source[i + 1]}`, start, start + 2);
      i += 2;
      continue;
    }

    if (reBrackets.test(rest)) {
      pushToken(tokens, "bracket", char, start, start + 1);
      i += 1;
      continue;
    }

    if (char === "_") {
      pushToken(tokens, "operator", char, start, start + 1);
      i += 1;
      continue;
    }

    if (char === "\"") {
      let end = i + 1;
      while (end < source.length && source[end] !== "\"") {
        if (source[end] === "\\" && end + 1 < source.length) {
          end += 2;
        } else {
          end += 1;
        }
      }
      end = Math.min(end + 1, source.length);
      pushToken(tokens, "string", source.slice(i, end), start, end);
      i = end;
      continue;
    }

    if (char === "`") {
      let end = i + 1;
      while (end < source.length && /[a-zA-Z0-9_./:]/.test(source[end]!)) {
        end += 1;
      }
      pushToken(tokens, "symbol", source.slice(i, end), start, end);
      i = end;
      continue;
    }

    const spacedBoolMatch = rest.match(/^[01](?:[ \t]+[01])+b(?![a-zA-Z0-9_])/);
    if (spacedBoolMatch) {
      pushToken(tokens, "boolvector", spacedBoolMatch[0], start, start + spacedBoolMatch[0].length);
      i += spacedBoolMatch[0].length;
      continue;
    }

    const booleanMatch = rest.match(/^[01]+b/);
    if (booleanMatch) {
      pushToken(
        tokens,
        booleanMatch[0].length === 2 ? "boolean" : "boolvector",
        booleanMatch[0],
        start,
        start + booleanMatch[0].length
      );
      i += booleanMatch[0].length;
      continue;
    }

    const nullMatch = rest.match(/^(0Wj|-0Wj|0N|0n|-0W|0W|-0w|0w)/);
    if (nullMatch) {
      pushToken(tokens, "number", nullMatch[0], start, start + nullMatch[0].length);
      i += nullMatch[0].length;
      continue;
    }

    const dateMatch = rest.match(/^\d{4}\.\d{2}\.\d{2}/);
    if (dateMatch) {
      pushToken(tokens, "date", dateMatch[0], start, start + dateMatch[0].length);
      i += dateMatch[0].length;
      continue;
    }

    const temporalBoundary = "(?=$|[ \\t\\r\\n\\]\\)\\};,])";
    const monthMatch = rest.match(new RegExp(`^\\d{4}\\.\\d{2}m?${temporalBoundary}`));
    if (monthMatch) {
      pushToken(tokens, "date", monthMatch[0], start, start + monthMatch[0].length);
      i += monthMatch[0].length;
      continue;
    }

    const timespanMatch = rest.match(new RegExp(`^\\d{1,2}:\\d{2}:\\d{2}\\.\\d{9}${temporalBoundary}`));
    if (timespanMatch) {
      pushToken(tokens, "date", timespanMatch[0], start, start + timespanMatch[0].length);
      i += timespanMatch[0].length;
      continue;
    }

    const timeMatch = rest.match(new RegExp(`^\\d{1,2}:\\d{2}:\\d{2}\\.\\d{3}${temporalBoundary}`));
    if (timeMatch) {
      pushToken(tokens, "date", timeMatch[0], start, start + timeMatch[0].length);
      i += timeMatch[0].length;
      continue;
    }

    const secondMatch = rest.match(new RegExp(`^\\d{1,2}:\\d{2}:\\d{2}${temporalBoundary}`));
    if (secondMatch) {
      pushToken(tokens, "date", secondMatch[0], start, start + secondMatch[0].length);
      i += secondMatch[0].length;
      continue;
    }

    const minuteMatch = rest.match(new RegExp(`^\\d{1,2}:\\d{2}${temporalBoundary}`));
    if (minuteMatch) {
      pushToken(tokens, "date", minuteMatch[0], start, start + minuteMatch[0].length);
      i += minuteMatch[0].length;
      continue;
    }

    const canStartSignedNumber =
      i === 0 ||
      [" ", "\t", "\r", "\n", "(", "[", "{", ";", ":"].includes(source[i - 1] ?? "") ||
      "+-*%=<>,!#_~?/^&|\\'$".includes(source[i - 1] ?? "");
    const numberPattern = canStartSignedNumber
      ? /^-?(?:\d+\.\d+|\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?[fhij]?/
      : /^(?:\d+\.\d+|\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?[fhij]?/;
    const numberMatch = rest.match(numberPattern);
    if (numberMatch) {
      pushToken(tokens, "number", numberMatch[0], start, start + numberMatch[0].length);
      i += numberMatch[0].length;
      continue;
    }

    const identifierMatch = reIdent.exec(rest);
    if (identifierMatch) {
      pushToken(tokens, "identifier", identifierMatch[0], start, start + identifierMatch[0].length);
      i += identifierMatch[0].length;
      continue;
    }

    const opMatch = rest.match(
      /^(<=|>=|<>|::|\/:|\\:|[+\-*%=<>,!#_~?/^&|@\\$']\:|[+\-*%=<>,!#_~:?/^&|@\\'$])/
    );
    if (opMatch) {
      pushToken(tokens, "operator", opMatch[1], start, start + opMatch[1].length);
      i += opMatch[1].length;
      continue;
    }

    const sym = symbolsAtStart(rest);
    if (sym) {
      pushToken(tokens, "operator", sym, start, start + sym.length);
      i += sym.length;
      continue;
    }

    throw new KdbLexError(i, `unexpected character for KDBLex: ${JSON.stringify(source[i])}`);
  }

  pushToken(tokens, "eof", "", source.length, source.length);
  return tokens;
}

export class KdbLexError extends Error {
  readonly offset: number;
  constructor(offset: number, message: string) {
    super(`KDBLex: ${message} at offset ${offset}`);
    this.name = "KdbLexError";
    this.offset = offset;
  }
}
