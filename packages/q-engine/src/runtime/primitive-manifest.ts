// Kona (ISC-licensed, kevinlawler/kona) keeps primitive verbs in compact tables:
// glyphs, valence, function pointers, and adverb specializations live together.
// This manifest is the q-engine equivalent spine for pure TypeScript q support:
// one source of truth for builtin discovery and primitive adverbs.
export const MONAD_NAMES = [
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
  "fkeys",
  "group",
  "ungroup",
  "key",
  "keys",
  "meta",
  "lower",
  "lsq",
  "ltrim",
  "md5",
  "next",
  "upper",
  "cut",
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
  "view",
  "show",
  "system",
  "hopen",
  "hclose",
  "hcount",
  "hdel",
  "read0",
  "read1",
  "reval",
  "rload",
  "rsave",
  "save",
  "load",
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
] as const;

export const DIAD_NAMES = [
  "+",
  "-",
  "*",
  "%",
  "=",
  "<",
  ">",
  "<=",
  ">=",
  ",",
  "!",
  "#",
  "_",
  "~",
  "cor",
  "cov",
  "div",
  "dsave",
  "ema",
  "mavg",
  "mcount",
  "mdev",
  "mmax",
  "mmin",
  "msum",
  "scov",
  "mod",
  "^",
  "?",
  "$",
  "@",
  "and",
  "in",
  "like",
  "|",
  "&",
  "cross",
  "or",
  "over",
  "prior",
  "scan",
  "ss",
  "sv",
  "vs",
  "within",
  "except",
  "fby",
  "inter",
  "union",
  "xbar",
  "xexp",
  "xlog",
  "xprev",
  "xrank",
  "cut",
  "xcol",
  "rotate",
  "sublist",
  "xasc",
  "xdesc",
  "xkey",
  "xgroup",
  "lj",
  "ljf",
  "lsq",
  "ij",
  "ijf",
  "uj",
  "ujf",
  "pj",
  "asof",
  "ssr",
  "mmu",
  "wsum",
  "wavg",
  "bin",
  "binr",
  "xcols",
  "insert",
  "upsert",
  "peach",
  "setenv",
  "set"
] as const;

export const TRIAD_NAMES = ["aj", "aj0", "ajf", "ajf0", "ej"] as const;
export const QUAD_NAMES = ["wj", "wj1"] as const;

export const PRIMITIVE_ADVERB_BASES = [
  "+",
  "-",
  "*",
  "%",
  "=",
  "<",
  ">",
  "<=",
  ">=",
  "!",
  "#",
  "_",
  "~",
  "^",
  "?",
  "$",
  "|",
  "&"
] as const;

export const KONA_VERB_CHARS = "+-*%|&^!<>=~@?_,#$.:" as const;
export const KONA_ADVERB_CHARS = "/\\'" as const;

export type PrimitiveEntry = {
  name: string;
  monad?: true;
  dyad?: true;
  triad?: true;
  quad?: true;
  primitiveAdverbs?: true;
  overKernel?: true;
  scanKernel?: true;
  eachPairKernel?: true;
};

const primitiveNameSet = new Set<string>();
export const PRIMITIVES: PrimitiveEntry[] = [];

const upsertPrimitive = (name: string): PrimitiveEntry => {
  let entry = PRIMITIVES.find((primitive) => primitive.name === name);
  if (!entry) {
    entry = { name };
    PRIMITIVES.push(entry);
    primitiveNameSet.add(name);
  }
  return entry;
};

MONAD_NAMES.forEach((name) => {
  upsertPrimitive(name).monad = true;
});
DIAD_NAMES.forEach((name) => {
  upsertPrimitive(name).dyad = true;
});
TRIAD_NAMES.forEach((name) => {
  upsertPrimitive(name).triad = true;
});
QUAD_NAMES.forEach((name) => {
  upsertPrimitive(name).quad = true;
});
PRIMITIVE_ADVERB_BASES.forEach((name) => {
  upsertPrimitive(name).primitiveAdverbs = true;
});
["+", "*", "|", "&"].forEach((name) => {
  const primitive = upsertPrimitive(name);
  primitive.overKernel = true;
  primitive.scanKernel = true;
});
upsertPrimitive("-").eachPairKernel = true;

export const primitiveNamesBy = (field: Exclude<keyof PrimitiveEntry, "name">) =>
  PRIMITIVES.filter((primitive) => primitive[field]).map((primitive) => primitive.name);

export const isPrimitiveName = (name: string) => primitiveNameSet.has(name);
