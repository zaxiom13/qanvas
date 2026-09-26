export interface Span {
  s: number; // start offset (inclusive)
  e: number; // end offset (exclusive)
  src?: string; // source text the offsets refer to
}

/** A q signal. `name` is the q error text ('type, 'length, or a user signal). */
export class QError extends Error {
  span?: Span;
  /** Human explanation shown under the q error. */
  hint?: string;
  /** Call stack of lambda names (innermost first). */
  frames: { name: string; span?: Span }[] = [];
  constructor(public readonly qname: string, hint?: string, span?: Span) {
    super(qname);
    this.hint = hint;
    this.span = span;
  }
  at(span: Span | undefined): this {
    if (!this.span && span) this.span = span;
    return this;
  }
}

export const qerr = (name: string, hint?: string) => new QError(name, hint);

export const typeErr = (hint?: string) => new QError("type", hint);
export const lengthErr = (hint?: string) => new QError("length", hint);
export const rankErr = (hint?: string) => new QError("rank", hint);
export const domainErr = (hint?: string) => new QError("domain", hint);
export const nyiErr = (hint?: string) => new QError("nyi", hint);
export const indexErr = (hint?: string) => new QError("index", hint);

export const ERROR_HELP: Record<string, string> = {
  type: "An argument has the wrong type for this operation.",
  length: "Two lists that must pair up item-by-item have different lengths.",
  rank: "A function was called with the wrong number of arguments.",
  domain: "The argument is out of the domain this operation accepts.",
  nyi: "Not yet implemented in this q engine.",
  value: "No value: that name has not been defined.",
  parse: "The code could not be parsed.",
  index: "An index is out of range or of the wrong kind.",
  limit: "A size limit was exceeded.",
  stack: "Too much recursion.",
  mismatch: "Tables being combined have different columns.",
  wsfull: "Out of memory for this operation.",
  "assign": "Can't assign to a reserved word or built-in.",
  "cond": "$[...] needs an odd number of arguments or a trailing default.",
  "stop": "Execution was interrupted.",
};

/** Render an error the way KDB-X does (with caret), plus a friendly hint. */
export function formatError(err: QError, src?: string): string {
  let out = `'${err.qname}`;
  const code = err.span?.src ?? src;
  if (err.span && code != null) {
    const { s, e } = err.span;
    const lineStart = code.lastIndexOf("\n", s - 1) + 1;
    let lineEnd = code.indexOf("\n", s);
    if (lineEnd < 0) lineEnd = code.length;
    const line = code.slice(lineStart, lineEnd);
    const col = s - lineStart;
    const width = Math.max(1, Math.min(e, lineEnd) - s);
    out += `\n  [0]  ${line}\n       ${" ".repeat(col)}${"^".repeat(width)}`;
  }
  return out;
}
