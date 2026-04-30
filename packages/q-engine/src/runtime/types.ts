import type {
  CanonicalNode,
  QBuiltin,
  QLambda,
  QValue
} from "@qpad/core";
import type { HostFileSystem } from "../host-file-system.js";
import type { Session } from "./session.js";

export type AstNode =
  | { kind: "program"; statements: AstNode[]; source: string }
  | { kind: "return"; value: AstNode }
  | { kind: "assign"; name: string; value: AstNode }
  | { kind: "assignGlobal"; name: string; value: AstNode }
  | { kind: "identifier"; name: string }
  | { kind: "number"; value: string }
  | { kind: "date"; value: string }
  | { kind: "string"; value: string }
  | { kind: "symbol"; value: string }
  | { kind: "boolean"; value: boolean }
  | { kind: "null" }
  | { kind: "placeholder" }
  | { kind: "vector"; items: AstNode[] }
  | { kind: "list"; items: AstNode[] }
  | { kind: "table"; columns: { name: string; value: AstNode }[] }
  | {
      kind: "keyedTable";
      keys: { name: string; value: AstNode }[];
      values: { name: string; value: AstNode }[];
    }
  | {
      kind: "select";
      columns: { name: string | null; value: AstNode }[] | null;
      by: { name: string | null; value: AstNode }[] | null;
      source: AstNode;
      where: AstNode | null;
    }
  | {
      kind: "exec";
      value: AstNode;
      by: { name: string | null; value: AstNode }[] | null;
      source: AstNode;
      where: AstNode | null;
    }
  | {
      kind: "update";
      updates: { name: string; value: AstNode }[];
      source: AstNode;
      where: AstNode | null;
    }
  | { kind: "delete"; columns: string[] | null; source: AstNode; where: AstNode | null }
  | { kind: "if"; condition: AstNode; body: AstNode[] }
  | { kind: "while"; condition: AstNode; body: AstNode[] }
  | { kind: "do"; count: AstNode; body: AstNode[] }
  | {
      kind: "cond";
      branches: { condition: AstNode; value: AstNode }[];
      elseValue: AstNode | null;
    }
  | { kind: "each"; callee: AstNode; arg: AstNode }
  | { kind: "eachCall"; callee: AstNode; args: AstNode[] }
  | { kind: "binary"; op: string; left: AstNode; right: AstNode }
  | { kind: "call"; callee: AstNode; args: AstNode[] }
  | { kind: "lambda"; params: string[] | null; body: AstNode[]; source: string }
  | { kind: "group"; value: AstNode };

export interface Token {
  kind: string;
  value: string;
  start: number;
  end: number;
}

export interface SourcePosition {
  line: number;
  column: number;
  offset: number;
}

export interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}

export const MONAD_KEYWORDS = new Set([
  "abs",
  "all",
  "any",
  "avgs",
  "til",
  "ceiling",
  "cols",
  "count",
  "desc",
  "differ",
  "exp",
  "fills",
  "first",
  "last",
  "log",
  "min",
  "mins",
  "max",
  "maxs",
  "med",
  "asc",
  "iasc",
  "idesc",
  "asin",
  "atan",
  "sum",
  "avg",
  "asin",
  "acos",
  "atan",
  "sin",
  "cos",
  "tan",
  "floor",
  "null",
  "reciprocal",
  "reverse",
  "signum",
  "sqrt",
  "neg",
  "not",
  "enlist",
  "distinct",
  "attr",
  "flip",
  "group",
  "key",
  "keys",
  "lower",
  "ltrim",
  "next",
  "upper",
  "prd",
  "prds",
  "prev",
  "raze",
  "ratios",
  "rtrim",
  "var",
  "svar",
  "dev",
  "sdev",
  "deltas",
  "trim",
  "sums",
  "string",
  "type",
  "where",
  "value",
  "show",
  "+/",
  "+\\",
  "system",
  "hopen",
  "hclose",
  "hcount",
  "hdel",
  "read0",
  "read1",
  "inv",
  "rank",
  "rand",
  "hsym",
  "get",
  "getenv",
  "gtime",
  "ltime",
  "parse",
  "eval",
  "tables",
  "views"
]);

export const WORD_DIAD_KEYWORDS = new Set([
  "and",
  "cross",
  "cut",
  "div",
  "mavg",
  "mcount",
  "mdev",
  "msum",
  "in",
  "except",
  "inter",
  "like",
  "mod",
  "or",
  "over",
  "prior",
  "rotate",
  "scan",
  "ss",
  "sublist",
  "sv",
  "union",
  "vs",
  "within",
  "xbar",
  "xcol",
  "xexp",
  "xlog",
  "xasc",
  "xdesc",
  "xkey",
  "xgroup",
  "lj",
  "ljf",
  "ij",
  "uj",
  "pj",
  "asof",
  "mmu",
  "wsum",
  "wavg",
  "bin",
  "binr",
  "xcols",
  "insert",
  "upsert",
  "peach",
  "set"
]);
export const Q_LONG_MAX = 9223372036854775807;
export const Q_INT_MAX = 2147483647;
export const Q_SHORT_MAX = 32767;
export const Q_X10_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export const Q_X12_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const CX_USAGE =
  "usage: complex must be a numeric scalar, numeric pair (re im), or `re`im dictionary";

export const Q_RESERVED_WORDS = [
  "abs",
  "acos",
  "asin",
  "atan",
  "avg",
  "bin",
  "binr",
  "cor",
  "cos",
  "cov",
  "count",
  "delete",
  "dev",
  "div",
  "do",
  "enlist",
  "exec",
  "exit",
  "exp",
  "get",
  "if",
  "in",
  "like",
  "log",
  "max",
  "min",
  "prd",
  "select",
  "sum",
  "update",
  "var",
  "wavg",
  "while",
  "within",
  "xexp"
] as const;

export const Q_RESERVED_SET = new Set<string>(Q_RESERVED_WORDS);

export interface FormatOptions {
  trailingNewline?: boolean;
}

export interface EvalResult {
  value: QValue;
  formatted: string;
  canonical: CanonicalNode;
}

export interface HostAdapter {
  now?: () => Date;
  timezone?: () => string;
  env?: () => Record<string, string>;
  consoleSize?: () => { rows: number; columns: number };
  unsupported?: (name: string) => never;
  fs?: HostFileSystem;
}

export class QRuntimeError extends Error {
  readonly qName: string;
  readonly location?: SourceRange;

  constructor(qName: string, message: string, location?: SourceRange) {
    super(message);
    this.qName = qName;
    this.location = location;
  }
}

export type BuiltinImpl = (session: Session, args: QValue[]) => QValue;
export type TemporalType = "date" | "month" | "minute" | "second" | "time" | "timespan" | "datetime" | "timestamp";
export type StoredFileFormat = "csv" | "tsv" | "txt" | "json" | "q";

export interface BuiltinEntry extends QBuiltin {
  impl: BuiltinImpl;
}

export interface LambdaValue extends QLambda {
  body: AstNode[];
}

export interface TableQueryScope {
  source: import("@qpad/core").QTable;
  positions: number[];
  filtered: import("@qpad/core").QTable;
  context: Session;
}
