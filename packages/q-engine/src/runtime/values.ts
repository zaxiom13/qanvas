import { canonicalize, isTruthy, qBool, qDate, qDictionary, qError, qFloat, qInt, qKeyedTable, qList, qLong, qNull, qProjection, qReal, qShort, qString, qSymbol, qTable, type QDictionary, type QError, type QKeyedTable, type QList, type QNumber, type QString, type QSymbol, type QTable, type QValue } from "@qpad/core";
import { CX_USAGE, Q_INT_MAX, Q_LONG_MAX, Q_RESERVED_SET, Q_SHORT_MAX, type AstNode, type LambdaValue, type StoredFileFormat, type TemporalType, QRuntimeError } from "./types.js";
import type { Session } from "./session.js";

export const formatValue = (value: QValue, options: { trailingNewline?: boolean } = { trailingNewline: true }): string => {
  const text = formatBare(value);
  return options.trailingNewline === false ? text : `${text}\n`;
};

export const parseNumericLiteral = (raw: string): QValue => {
  if (/^0x[0-9a-fA-F]*$/.test(raw)) {
    const bytes = raw.slice(2).match(/[0-9a-fA-F]{2}/g) ?? [];
    return qList(bytes.map((byte) => qLong(Number.parseInt(byte, 16))), true, "byte");
  }
  if (raw === "0N") return qLong(0, "longNull");
  if (raw === "0Ni") return qInt(0, "intNull");
  if (raw === "0Nh") return qShort(0, "shortNull");
  if (raw === "0Ne") return qReal(0, "realNull");
  if (raw === "0Nj") return qLong(0, "longNull");
  if (raw === "0n") return qFloat(Number.NaN, "null");
  if (raw === "0W") return qLong(Q_LONG_MAX, "longPosInf");
  if (raw === "-0W") return qLong(-Q_LONG_MAX, "longNegInf");
  if (raw === "0Wj") return qLong(Q_LONG_MAX, "longPosInf");
  if (raw === "-0Wj") return qLong(-Q_LONG_MAX, "longNegInf");
  if (raw === "0Wi") return qInt(Q_INT_MAX, "intPosInf");
  if (raw === "-0Wi") return qInt(-Q_INT_MAX, "intNegInf");
  if (raw === "0Wh") return qShort(Q_SHORT_MAX, "shortPosInf");
  if (raw === "-0Wh") return qShort(-Q_SHORT_MAX, "shortNegInf");
  if (raw === "0We") return qReal(Number.POSITIVE_INFINITY, "realPosInf");
  if (raw === "-0We") return qReal(Number.NEGATIVE_INFINITY, "realNegInf");
  if (raw === "0w") return qFloat(Number.POSITIVE_INFINITY, "posInf");
  if (raw === "-0w") return qFloat(Number.NEGATIVE_INFINITY, "negInf");
  if (raw.endsWith("i")) return qInt(Number.parseInt(raw.slice(0, -1), 10));
  if (raw.endsWith("h")) return qShort(Number.parseInt(raw.slice(0, -1), 10));
  if (raw.endsWith("j")) return qLong(Number.parseInt(raw.slice(0, -1), 10));
  if (raw.endsWith("e")) return qReal(Number.parseFloat(raw.slice(0, -1)));
  if (raw.endsWith("f")) return qFloat(Number.parseFloat(raw.slice(0, -1)));
  if (/[.eE]/.test(raw)) return qFloat(Number.parseFloat(raw));
  return qLong(Number.parseInt(raw, 10));
};

export const parseTemporalLiteral = (raw: string): QValue => {
  if (/^\d{4}\.\d{2}\.\d{2}D\d{1,2}:\d{2}:\d{2}(?:\.\d{1,9})?$/.test(raw)) {
    return qTemporal("timestamp", raw);
  }
  if (/^\d{4}\.\d{2}\.\d{2}T\d{1,2}:\d{2}:\d{2}(?:\.\d{1,9})?$/.test(raw)) {
    return qTemporal("datetime", raw);
  }
  if (/^-?\d+D\d{1,2}:\d{2}:\d{2}(?:\.\d{1,9})?$/.test(raw)) {
    return qTemporal("timespan", raw);
  }
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(raw)) {
    return qDate(raw);
  }
  if (/^\d{4}\.\d{2}m?$/.test(raw)) {
    return qTemporal("month", raw);
  }
  if (/^\d{1,2}:\d{2}:\d{2}\.\d{9}$/.test(raw)) {
    return qTemporal("timespan", `0D${raw}`);
  }
  if (/^\d{1,2}:\d{2}:\d{2}\.\d{3}$/.test(raw)) {
    return qTemporal("time", raw);
  }
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(raw)) {
    return qTemporal("second", raw);
  }
  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    return qTemporal("minute", raw);
  }
  return qDate(raw);
};

export const qTemporal = (temporalType: TemporalType, value: string): QValue =>
  ({
    kind: "temporal",
    temporalType,
    value
  } as QValue);

export const lambdaArity = (lambda: LambdaValue): number => {
  if (lambda.params) {
    return lambda.params.length;
  }

  const used = new Set<string>();
  for (const statement of lambda.body) {
    collectImplicitParams(statement, used);
  }

  if (used.has("z")) {
    return 3;
  }
  if (used.has("y")) {
    return 2;
  }
  if (used.has("x")) {
    return 1;
  }
  return 0;
};

export const collectImplicitParams = (node: AstNode, used: Set<string>) => {
  switch (node.kind) {
    case "identifier":
      if (node.name === "x" || node.name === "y" || node.name === "z") {
        used.add(node.name);
      }
      return;
    case "assign":
    case "assignGlobal":
      collectImplicitParams(node.value, used);
      return;
    case "vector":
    case "list":
      node.items.forEach((item) => collectImplicitParams(item, used));
      return;
    case "table":
      node.columns.forEach((column) => collectImplicitParams(column.value, used));
      return;
    case "keyedTable":
      node.keys.forEach((column) => collectImplicitParams(column.value, used));
      node.values.forEach((column) => collectImplicitParams(column.value, used));
      return;
    case "select":
      node.columns?.forEach((column) => collectImplicitParams(column.value, used));
      collectImplicitParams(node.source, used);
      if (node.where) {
        collectImplicitParams(node.where, used);
      }
      return;
    case "exec":
      collectImplicitParams(node.value, used);
      collectImplicitParams(node.source, used);
      if (node.where) {
        collectImplicitParams(node.where, used);
      }
      return;
    case "update":
      node.updates.forEach((update) => collectImplicitParams(update.value, used));
      collectImplicitParams(node.source, used);
      if (node.where) {
        collectImplicitParams(node.where, used);
      }
      return;
    case "delete":
      collectImplicitParams(node.source, used);
      if (node.where) {
        collectImplicitParams(node.where, used);
      }
      return;
    case "if":
      collectImplicitParams(node.condition, used);
      node.body.forEach((statement) => collectImplicitParams(statement, used));
      return;
    case "while":
      collectImplicitParams(node.condition, used);
      node.body.forEach((statement) => collectImplicitParams(statement, used));
      return;
    case "do":
      collectImplicitParams(node.count, used);
      node.body.forEach((statement) => collectImplicitParams(statement, used));
      return;
    case "cond":
      node.branches.forEach((branch) => {
        collectImplicitParams(branch.condition, used);
        collectImplicitParams(branch.value, used);
      });
      if (node.elseValue) {
        collectImplicitParams(node.elseValue, used);
      }
      return;
    case "binary":
      collectImplicitParams(node.left, used);
      collectImplicitParams(node.right, used);
      return;
    case "call":
      collectImplicitParams(node.callee, used);
      node.args.forEach((arg) => collectImplicitParams(arg, used));
      return;
    case "each":
      collectImplicitParams(node.callee, used);
      collectImplicitParams(node.arg, used);
      return;
    case "eachCall":
      collectImplicitParams(node.callee, used);
      node.args.forEach((arg) => collectImplicitParams(arg, used));
      return;
    case "group":
      collectImplicitParams(node.value, used);
      return;
    case "lambda":
    case "program":
      return;
    default:
      return;
  }
};

export const asList = (value: QValue): QList => {
  if (value.kind !== "list") {
    throw new QRuntimeError("type", "Expected list");
  }
  return value;
};

export const toNumber = (value: QValue): number => {
  if (value.kind === "boolean") {
    return value.value ? 1 : 0;
  }
  if (value.kind !== "number") {
    throw new QRuntimeError("type", "Expected numeric value");
  }
  return value.value;
};

export const numeric = (value: number, float = false): QNumber =>
  float || !Number.isInteger(value) ? qFloat(value) : qLong(value);

// Type-preserving arithmetic result: picks the "highest" type between two operands.
// short < int < long < real < float, bool gets promoted to long.
export const NUMERIC_RANK: Record<string, number> = {
  short: 1,
  int: 2,
  long: 3,
  real: 4,
  float: 5
};

export const numericTypeOf = (value: QValue): string => {
  if (value.kind === "boolean") return "long";
  if (value.kind === "number") return value.numericType;
  return "long";
};

export const promoteNumericType = (a: string, b: string): string => {
  const ra = NUMERIC_RANK[a] ?? 3;
  const rb = NUMERIC_RANK[b] ?? 3;
  return ra >= rb ? a : b;
};

export const numericOf = (value: number, type: string): QNumber => {
  if (type === "float" || !Number.isInteger(value)) return qFloat(value);
  switch (type) {
    case "short":
      return qShort(value);
    case "int":
      return qInt(value);
    case "real":
      return qReal(value);
    case "long":
    default:
      return qLong(value);
  }
};

export const nullForType = (type: string): QNumber => {
  switch (type) {
    case "short":
      return qShort(0, "shortNull");
    case "int":
      return qInt(0, "intNull");
    case "real":
      return qReal(0, "realNull");
    case "float":
      return qFloat(Number.NaN, "null");
    case "long":
    default:
      return qLong(0, "longNull");
  }
};

export const isNumericNull = (value: QValue) => {
  if (value.kind !== "number") return false;
  if (value.special === "null") return true;
  if (value.special === "intNull") return true;
  if (value.special === "longNull") return true;
  if (value.special === "shortNull") return true;
  if (value.special === "realNull") return true;
  return false;
};

export const unaryNumeric = (value: QValue, mapper: (input: number) => number): QValue =>
  value.kind === "list"
    ? qList(value.items.map((item) => unaryNumeric(item, mapper)), value.homogeneous ?? false)
    : qFloat(mapper(toNumber(value)));

export const roundHalfAwayFromZero = (value: number) =>
  value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);

export const qComplex = (re: number, im: number): QDictionary =>
  qDictionary([qSymbol("re"), qSymbol("im")], [qFloat(re), qFloat(im)]);

export const complexDictionaryField = (value: QDictionary, field: "re" | "im") => {
  const index = value.keys.findIndex((key) => key.kind === "symbol" && key.value === field);
  return index >= 0 ? value.values[index] : undefined;
};

export const complexParts = (value: QValue): { re: number; im: number } => {
  if (value.kind === "number") {
    return { re: value.value, im: 0 };
  }
  if (
    value.kind === "list" &&
    value.items.length === 2 &&
    value.items.every((item) => item.kind === "number")
  ) {
    return {
      re: value.items[0]!.value,
      im: value.items[1]!.value
    };
  }
  if (value.kind === "dictionary") {
    const re = complexDictionaryField(value, "re");
    const im = complexDictionaryField(value, "im");
    if (re?.kind === "number" && im?.kind === "number") {
      return { re: re.value, im: im.value };
    }
  }
  throw new QRuntimeError("type", CX_USAGE);
};

export const qComplexFromValue = (value: QValue) => {
  const parts = complexParts(value);
  return qComplex(parts.re, parts.im);
};

export const complexArg = (value: { re: number; im: number }) => {
  if (value.re === 0 && value.im === 0) {
    return 0;
  }
  return Math.atan2(value.im, value.re);
};

export const positiveModulo = (left: number, right: number) =>
  left - right * Math.floor(left / right);

export const complexModulo = (left: QValue, right: QValue) => {
  const value = complexParts(left);
  if (right.kind === "number") {
    if (right.value === 0) {
      throw new QRuntimeError("domain", "domain");
    }
    return qComplex(positiveModulo(value.re, right.value), positiveModulo(value.im, right.value));
  }
  const divisor = complexParts(right);
  if (divisor.re === 0 || divisor.im === 0) {
    throw new QRuntimeError("domain", "domain");
  }
  return qComplex(
    positiveModulo(value.re, divisor.re),
    positiveModulo(value.im, divisor.im)
  );
};

export const dictionaryKeysMatch = (left: QDictionary, right: QDictionary) =>
  left.keys.length === right.keys.length &&
  left.keys.every((key, index) => equals(key, right.keys[index]!));

export const applyDictionaryBinary = (
  left: QValue,
  right: QValue,
  mapper: (a: QValue, b: QValue) => QValue
): QValue | null => {
  if (left.kind === "dictionary" && right.kind === "dictionary") {
    if (!dictionaryKeysMatch(left, right)) {
      throw new QRuntimeError("length", "Dictionary keys differ");
    }
    return qDictionary(
      left.keys,
      left.values.map((value, index) => mapper(value, right.values[index]!))
    );
  }
  if (left.kind === "dictionary") {
    return qDictionary(left.keys, left.values.map((value) => mapper(value, right)));
  }
  if (right.kind === "dictionary") {
    return qDictionary(right.keys, right.values.map((value) => mapper(left, value)));
  }
  return null;
};

export const arithBinary = (
  a: QValue,
  b: QValue,
  op: (x: number, y: number) => number,
  forceFloat = false
): QValue => {
  const type = forceFloat
    ? "float"
    : promoteNumericType(numericTypeOf(a), numericTypeOf(b));
  if (isNumericNull(a) || isNumericNull(b)) {
    return nullForType(type);
  }
  const result = op(toNumber(a), toNumber(b));
  return forceFloat ? qFloat(result) : numericOf(result, type);
};

export const addTemporal = (a: QValue, b: QValue): QValue | null => {
  const temporal = a.kind === "temporal" ? a : b.kind === "temporal" ? b : null;
  const other = a.kind === "temporal" ? b : a;
  if (!temporal || other.kind === "temporal") return null;
  if (temporal.temporalType === "date" && (other.kind === "number" || other.kind === "boolean")) {
    if (temporal.value === "0Nd" || isNumericNull(other)) return qDate("0Nd");
    const days = parseQDateDays(temporal.value) + toNumber(other);
    return qDate(formatQDateFromDays(days));
  }
  return null;
};

export const subtractTemporal = (a: QValue, b: QValue): QValue | null => {
  if (a.kind === "temporal" && b.kind === "temporal") {
    if (a.temporalType === "date" && b.temporalType === "date") {
      if (a.value === "0Nd" || b.value === "0Nd") return qLong(0, "longNull");
      return qLong(parseQDateDays(a.value) - parseQDateDays(b.value));
    }
    return null;
  }
  if (a.kind === "temporal" && (b.kind === "number" || b.kind === "boolean")) {
    if (a.temporalType === "date") {
      if (a.value === "0Nd" || isNumericNull(b)) return qDate("0Nd");
      const days = parseQDateDays(a.value) - toNumber(b);
      return qDate(formatQDateFromDays(days));
    }
  }
  return null;
};

export const add = (a: QValue, b: QValue): QValue =>
  applyDictionaryBinary(a, b, add) ??
  addTemporal(a, b) ??
  arithBinary(a, b, (x, y) => x + y);
export const subtract = (a: QValue, b: QValue): QValue =>
  applyDictionaryBinary(a, b, subtract) ??
  subtractTemporal(a, b) ??
  arithBinary(a, b, (x, y) => x - y);
export const multiply = (a: QValue, b: QValue): QValue =>
  applyDictionaryBinary(a, b, multiply) ?? arithBinary(a, b, (x, y) => x * y);
export const divide = (a: QValue, b: QValue): QValue =>
  applyDictionaryBinary(a, b, divide) ?? arithBinary(a, b, (x, y) => x / y, true);
export const divValue = (a: QValue, b: QValue): QValue => {
  if (isNumericNull(a) || isNumericNull(b)) return qLong(0, "longNull");
  return qLong(Math.floor(toNumber(a) / toNumber(b)));
};
export const modValue = (a: QValue, b: QValue): QValue => {
  if (isNumericNull(a) || isNumericNull(b)) return qLong(0, "longNull");
  const left = toNumber(a);
  const right = toNumber(b);
  return qLong(left - right * Math.floor(left / right));
};

export const compare = (a: QValue, b: QValue): number => {
  if (a.kind === "number" && b.kind === "number") {
    return toNumber(a) - toNumber(b);
  }
  const left = formatBare(a);
  const right = formatBare(b);
  return left.localeCompare(right);
};

export const compareValue = (a: QValue, b: QValue) => compare(a, b);

export const equals = (a: QValue, b: QValue): boolean =>
  JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));

export const numericUnary = (value: QValue, fn: (input: number) => number): QValue => {
  if (value.kind === "list") {
    return qList(value.items.map((item) => numericUnary(item, fn)), value.homogeneous ?? false);
  }
  if (value.kind !== "number") {
    throw new QRuntimeError("type", "Expected numeric value");
  }
  if (value.special === "null" || value.special === "intNull") {
    return qFloat(Number.NaN, "null");
  }
  return qFloat(fn(value.value));
};

export const mapBinary = (left: QValue, right: QValue, mapper: (a: QValue, b: QValue) => QValue): QValue => {
  if (left.kind === "list" && right.kind === "list") {
    if (left.items.length !== right.items.length) {
      throw new QRuntimeError("length", "Vector lengths differ");
    }
    return qList(
      left.items.map((item, index) => mapBinary(item, right.items[index]!, mapper)),
      left.homogeneous ?? right.homogeneous ?? false
    );
  }
  if (left.kind === "list") {
    return qList(left.items.map((item) => mapBinary(item, right, mapper)), left.homogeneous ?? false);
  }
  if (right.kind === "list") {
    return qList(right.items.map((item) => mapBinary(left, item, mapper)), right.homogeneous ?? false);
  }
  return mapper(left, right);
};

export const countValue = (value: QValue): number => {
  switch (value.kind) {
    case "list":
      return value.items.length;
    case "string":
      return value.value.length;
    case "dictionary":
      return value.keys.length;
    case "table":
      return Object.values(value.columns)[0]?.items.length ?? 0;
    case "keyedTable":
      return countValue(value.keys);
    default:
      return 1;
  }
};

export const absValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList(value.items.map(absValue), value.homogeneous ?? false);
  }
  if (value.kind === "temporal" && value.temporalType === "date") {
    if (value.value === "0Nd") {
      return qDate("0Nd");
    }
    return qDate(formatQDateFromDays(Math.abs(parseQDateDays(value.value))));
  }
  if (value.kind === "number") {
    if (isNumericNull(value)) return nullForType(value.numericType);
    if (
      value.special === "intPosInf" ||
      value.special === "intNegInf"
    ) {
      return qInt(Number.POSITIVE_INFINITY, "intPosInf");
    }
    if (
      value.special === "longPosInf" ||
      value.special === "longNegInf"
    ) {
      return qLong(Number.POSITIVE_INFINITY, "longPosInf");
    }
    if (
      value.special === "shortPosInf" ||
      value.special === "shortNegInf"
    ) {
      return qShort(Number.POSITIVE_INFINITY, "shortPosInf");
    }
    if (
      value.special === "realPosInf" ||
      value.special === "realNegInf"
    ) {
      return qReal(Number.POSITIVE_INFINITY, "realPosInf");
    }
    if (value.special === "posInf" || value.special === "negInf") {
      return qFloat(Number.POSITIVE_INFINITY, "posInf");
    }
    return numericOf(Math.abs(value.value), value.numericType);
  }
  return numeric(Math.abs(toNumber(value)));
};

export const allValue = (value: QValue): QValue =>
  qBool(value.kind === "list" ? value.items.every(isTruthy) : isTruthy(value));

export const anyValue = (value: QValue): QValue =>
  qBool(value.kind === "list" ? value.items.some(isTruthy) : isTruthy(value));

export const ceilingValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList(value.items.map(ceilingValue), value.homogeneous ?? false);
  }
  return qLong(Math.ceil(toNumber(value)));
};

export const colsValue = (value: QValue): QValue => {
  if (value.kind === "table") {
    return qList(Object.keys(value.columns).map((name) => qSymbol(name)), true);
  }
  if (value.kind === "keyedTable") {
    return qList(
      [...Object.keys(value.keys.columns), ...Object.keys(value.values.columns)].map((name) => qSymbol(name)),
      true
    );
  }
  throw new QRuntimeError("type", "cols expects a table");
};

export const firstValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return value.items[0] ?? qNull();
  }
  if (value.kind === "dictionary") {
    return value.values[0] ?? qNull();
  }
  if (value.kind === "string") {
    return qString(value.value[0] ?? "");
  }
  return value;
};

export const lastValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return value.items.at(-1) ?? qNull();
  }
  if (value.kind === "dictionary") {
    return value.values.at(-1) ?? qNull();
  }
  if (value.kind === "string") {
    return qString(value.value.at(-1) ?? "");
  }
  return value;
};

export const ascValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList([...value.items].sort(compareValue), value.homogeneous ?? false, "s");
  }
  if (value.kind === "string") {
    return qString([...value.value].sort((a, b) => a.localeCompare(b)).join(""));
  }
  return value;
};

export const descValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList([...value.items].sort((a, b) => compareValue(b, a)), value.homogeneous ?? false, "s");
  }
  if (value.kind === "string") {
    return qString([...value.value].sort((a, b) => b.localeCompare(a)).join(""));
  }
  return value;
};

export const attrValue = (value: QValue): QValue =>
  value.kind === "list" && value.attribute ? qSymbol(value.attribute) : qSymbol("");

export const sumValue = (value: QValue): QValue => {
  if (value.kind !== "list") {
    return value;
  }
  const items = value.items.filter((item) => !isNullish(item));
  return items.reduce((acc, item) => add(acc, item), qLong(0));
};

export const sampleNumericType = (list: QList): string => {
  for (const item of list.items) {
    if (item.kind === "number") return item.numericType;
    if (item.kind === "boolean") return "long";
  }
  const attr = list.attribute;
  if (
    attr === "int" ||
    attr === "short" ||
    attr === "long" ||
    attr === "real" ||
    attr === "float"
  ) {
    return attr;
  }
  return "long";
};

export const minValue = (value: QValue): QValue => {
  if (value.kind === "string") {
    return qString([...value.value].sort((a, b) => a.localeCompare(b))[0] ?? "");
  }
  if (value.kind !== "list") {
    return value;
  }
  const list = asList(value);
  const items = list.items.filter((item) => !isNullish(item));
  if (items.length === 0) {
    const t = sampleNumericType(list);
    if (t === "int") return qInt(Number.POSITIVE_INFINITY, "intPosInf");
    if (t === "short") return qShort(Number.POSITIVE_INFINITY, "shortPosInf");
    if (t === "real") return qReal(Number.POSITIVE_INFINITY, "realPosInf");
    if (t === "float") return qFloat(Number.POSITIVE_INFINITY, "posInf");
    return qLong(Number.POSITIVE_INFINITY, "longPosInf");
  }
  return items.reduce((acc, item) => (compare(item, acc) < 0 ? item : acc));
};

export const maxValue = (value: QValue): QValue => {
  if (value.kind === "string") {
    return qString([...value.value].sort((a, b) => a.localeCompare(b)).at(-1) ?? "");
  }
  if (value.kind !== "list") {
    return value;
  }
  const list = asList(value);
  const items = list.items.filter((item) => !isNullish(item));
  if (items.length === 0) {
    const t = sampleNumericType(list);
    if (t === "int") return qInt(Number.NEGATIVE_INFINITY, "intNegInf");
    if (t === "short") return qShort(Number.NEGATIVE_INFINITY, "shortNegInf");
    if (t === "real") return qReal(Number.NEGATIVE_INFINITY, "realNegInf");
    if (t === "float") return qFloat(Number.NEGATIVE_INFINITY, "negInf");
    return qLong(Number.NEGATIVE_INFINITY, "longNegInf");
  }
  return items.reduce((acc, item) => (compare(item, acc) > 0 ? item : acc));
};

export const medianValue = (value: QValue): QValue => {
  const list = asList(value);
  const items = [...list.items];
  if (items.length === 0) {
    return qFloat(Number.NaN, "null");
  }

  const sorted = items.sort(compare);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    const item = sorted[middle]!;
    return item.kind === "number" ? qFloat(toNumber(item)) : item;
  }

  const left = sorted[middle - 1]!;
  const right = sorted[middle]!;
  if (left.kind === "number" && right.kind === "number") {
    return qFloat((toNumber(left) + toNumber(right)) / 2);
  }
  return left;
};

export const minPair = (left: QValue, right: QValue): QValue =>
  compare(left, right) <= 0 ? left : right;

export const maxPair = (left: QValue, right: QValue): QValue =>
  compare(left, right) >= 0 ? left : right;

export const avgValue = (value: QValue): QValue => {
  const list = asList(value);
  const items = list.items.filter((item) => !isNullish(item));
  if (items.length === 0) {
    return qFloat(Number.NaN, "null");
  }
  const total = sumValue(qList(items, list.homogeneous ?? false));
  return qFloat(toNumber(total) / items.length);
};

export const avgsValue = (value: QValue): QValue => {
  const list = asList(value);
  let running: QValue = qLong(0);
  let count = 0;
  return qList(
    list.items.map((item) => {
      if (!isNullish(item)) {
        running = add(running, item);
        count += 1;
      }
      return count === 0 ? qFloat(Number.NaN, "null") : qFloat(toNumber(running) / count);
    }),
    false
  );
};

export const productValue = (value: QValue): QValue => {
  if (value.kind !== "list") {
    return value;
  }
  return value.items.reduce((acc, item) => multiply(acc, item), qLong(1));
};

export const prdsValue = (value: QValue): QValue => {
  const list = asList(value);
  let running: QValue = qLong(1);
  return qList(
    list.items.map((item) => {
      if (!isNullish(item)) {
        running = multiply(running, item);
      }
      return running;
    }),
    list.homogeneous ?? false
  );
};

export const prevValue = (value: QValue): QValue => {
  if (value.kind === "string") {
    return qString(` ${value.value.slice(0, -1)}`);
  }
  const list = asList(value);
  if (list.items.length === 0) {
    return qList([], list.homogeneous ?? false);
  }
  return qList(
    [nullLike(list.items[0]), ...list.items.slice(0, -1)],
    list.homogeneous ?? false
  );
};

export const nextValue = (value: QValue): QValue => {
  if (value.kind === "string") {
    return qString(`${value.value.slice(1)} `);
  }
  const list = asList(value);
  if (list.items.length === 0) {
    return qList([], list.homogeneous ?? false);
  }
  return qList(
    [...list.items.slice(1), nullLike(list.items.at(-1))],
    list.homogeneous ?? false
  );
};

export const sumsValue = (value: QValue): QValue => {
  const list = asList(value);
  let running: QValue = qLong(0);
  return qList(
    list.items.map((item) => {
      running = add(running, item);
      return running;
    }),
    list.homogeneous ?? false
  );
};

export const minsValue = (value: QValue): QValue => {
  const list = asList(value);
  let running: QValue | null = null;
  return qList(
    list.items.map((item) => {
      if (!isNullish(item)) {
        running = running === null ? item : minPair(running, item);
      }
      return running ?? nullLike(item);
    }),
    list.homogeneous ?? false
  );
};

export const maxsValue = (value: QValue): QValue => {
  const list = asList(value);
  let running: QValue | null = null;
  return qList(
    list.items.map((item) => {
      if (!isNullish(item)) {
        running = running === null ? item : maxPair(running, item);
      }
      return running ?? nullLike(item);
    }),
    list.homogeneous ?? false
  );
};

export const ratiosValue = (value: QValue): QValue => {
  const list = asList(value);
  return qList(
    list.items.map((item, index) => {
      if (isNullish(item)) {
        return qFloat(Number.NaN, "null");
      }
      if (index === 0) {
        return qFloat(toNumber(item));
      }
      const previous = list.items[index - 1] ?? qNull();
      return isNullish(previous) ? qFloat(Number.NaN, "null") : divide(item, previous);
    }),
    false
  );
};

export const varianceValue = (value: QValue, sample: boolean): QValue => {
  const list = asList(value);
  const items = list.items.filter((item) => !isNullish(item));
  if (items.length === 0 || (sample && items.length < 2)) {
    return qFloat(Number.NaN, "null");
  }

  const numbers = items.map(toNumber);
  const mean = numbers.reduce((sum, current) => sum + current, 0) / numbers.length;
  const divisor = sample ? numbers.length - 1 : numbers.length;
  const variance =
    numbers.reduce((sum, current) => sum + (current - mean) ** 2, 0) / divisor;
  return qFloat(variance);
};

export const deviationValue = (value: QValue, sample: boolean): QValue => {
  const variance = varianceValue(value, sample);
  return variance.kind === "number" && variance.special === "null"
    ? variance
    : qFloat(Math.sqrt(toNumber(variance)));
};

export const movingCountValue = (value: QValue): QValue => {
  const list = asList(value);
  return qLong(list.items.filter((item) => !isNullish(item)).length);
};

export const movingValue = (
  windowSize: QValue,
  value: QValue,
  reducer: (value: QValue) => QValue,
  homogeneous: boolean
): QValue => {
  const size = Math.max(1, Math.trunc(toNumber(windowSize)));
  const list = asList(value);
  const values = list.items.map((_, index) => {
    const start = Math.max(0, index - size + 1);
    const window = qList(list.items.slice(start, index + 1), list.homogeneous ?? false);
    return reducer(window);
  });
  const isHomogeneous = homogeneous && values.every((item) => item.kind === values[0]?.kind);
  const attribute =
    isHomogeneous &&
    values[0]?.kind === "number" &&
    values.every((item) => item.kind === "number" && item.numericType === "int")
      ? "explicitInt"
      : undefined;
  return qList(values, isHomogeneous, attribute);
};

export const deltasValue = (value: QValue, seed?: QValue): QValue => {
  const list = asList(value);
  if (list.items.length === 0) {
    return qList([], list.homogeneous ?? false);
  }

  return qList(
    list.items.map((item, index) => {
      if (index === 0) {
        return seed === undefined ? item : subtract(item, seed);
      }
      return subtract(item, list.items[index - 1] ?? qNull());
    }),
    list.homogeneous ?? false
  );
};

export const reverseValue = (value: QValue): QValue => {
  if (value.kind === "string") {
    return qString([...value.value].reverse().join(""));
  }
  if (value.kind === "list") {
    return qList([...value.items].reverse(), value.homogeneous ?? false);
  }
  return value;
};

export const differValue = (value: QValue): QValue => {
  const list = asList(value);
  return qList(
    list.items.map((item, index) =>
      qBool(index === 0 ? true : !equals(item, list.items[index - 1] ?? qNull()))
    ),
    true
  );
};

export const fillsValue = (value: QValue): QValue => {
  const list = asList(value);
  let previous: QValue | null = null;
  return qList(
    list.items.map((item) => {
      if (isNullish(item)) {
        return previous ?? item;
      }
      previous = item;
      return item;
    }),
    list.homogeneous ?? false
  );
};

export const reciprocalValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList(value.items.map(reciprocalValue), value.homogeneous ?? false);
  }
  return qFloat(1 / toNumber(value));
};

export const signumValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList(value.items.map(signumValue), value.homogeneous ?? false, "explicitInt");
  }
  const number = toNumber(value);
  return {
    kind: "number",
    value: number < 0 ? -1 : number > 0 ? 1 : 0,
    numericType: "int",
    explicitInt: true
  } as QValue;
};

export const floorValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList(value.items.map((item) => floorValue(item)), value.homogeneous ?? false);
  }
  return qLong(Math.floor(toNumber(value)));
};

export const cutValue = (left: QValue, right: QValue): QValue => {
  if (left.kind === "number") {
    const size = toNumber(left);
    if (size <= 0) {
      throw new QRuntimeError("domain", "cut size must be positive");
    }
    return chunkValue(size, right);
  }

  if (left.kind === "list") {
    const starts = left.items.map((item) => {
      if (item.kind !== "number") {
        throw new QRuntimeError("type", "cut indices must be numeric");
      }
      return item.value;
    });
    return cutByIndices(starts, right);
  }

  throw new QRuntimeError("type", "cut expects a numeric left argument");
};

export const rotateValue = (left: QValue, right: QValue): QValue => {
  const count = toNumber(left);
  if (right.kind === "string") {
    const chars = [...right.value];
    if (chars.length === 0) {
      return right;
    }
    const shift = ((count % chars.length) + chars.length) % chars.length;
    return qString([...chars.slice(shift), ...chars.slice(0, shift)].join(""));
  }
  const list = asList(right);
  if (list.items.length === 0) {
    return list;
  }
  const shift = ((count % list.items.length) + list.items.length) % list.items.length;
  return qList(
    [...list.items.slice(shift), ...list.items.slice(0, shift)],
    list.homogeneous ?? false
  );
};

export const sublistValue = (left: QValue, right: QValue): QValue => {
  if (left.kind !== "list" || left.items.length < 2) {
    throw new QRuntimeError("type", "sublist expects a two-item left argument");
  }
  const start = toNumber(left.items[0] ?? qLong(0));
  const count = toNumber(left.items[1] ?? qLong(0));
  if (right.kind === "string") {
    return qString(right.value.slice(start, start + count));
  }
  const list = asList(right);
  return qList(list.items.slice(start, start + count), list.homogeneous ?? false);
};

export const chunkValue = (size: number, right: QValue): QValue => {
  if (right.kind === "string") {
    const parts: QValue[] = [];
    for (let index = 0; index < right.value.length; index += size) {
      parts.push(qString(right.value.slice(index, index + size)));
    }
    return qList(parts, false);
  }

  const list = asList(right);
  const parts: QValue[] = [];
  for (let index = 0; index < list.items.length; index += size) {
    parts.push(qList(list.items.slice(index, index + size), list.homogeneous ?? false));
  }
  return qList(parts, false);
};

export const cutByIndices = (starts: number[], right: QValue): QValue => {
  if (starts.some((start) => start < 0)) {
    throw new QRuntimeError("domain", "cut indices must be non-negative");
  }

  const ordered = [...starts].sort((a, b) => a - b);
  if (right.kind === "string") {
    const parts = ordered.map((start, index) =>
      qString(right.value.slice(start, ordered[index + 1] ?? right.value.length))
    );
    return qList(parts, false);
  }

  const list = asList(right);
  const parts = ordered.map((start, index) =>
    qList(list.items.slice(start, ordered[index + 1] ?? list.items.length), list.homogeneous ?? false)
  );
  return qList(parts, false);
};

export const addMonthsValue = (dateValue: QValue, monthsValue: QValue): QValue => {
  if (dateValue.kind !== "temporal" || dateValue.temporalType !== "date") {
    throw new QRuntimeError("type", ".Q.addmonths expects date values");
  }

  const months = toNumber(monthsValue);
  const [yearText, monthText, dayText] = dateValue.value.split(".");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const utcDate = new Date(Date.UTC(year, month - 1 + months, day));
  const formatted = [
    utcDate.getUTCFullYear(),
    String(utcDate.getUTCMonth() + 1).padStart(2, "0"),
    String(utcDate.getUTCDate()).padStart(2, "0")
  ].join(".");
  return qDate(formatted);
};

export const parseQOpt = (value: QValue): QValue => {
  if (value.kind === "list" && value.items.length === 0) {
    return qDictionary([], []);
  }
  if (value.kind === "dictionary") {
    return value;
  }
  throw new QRuntimeError("type", ".Q.opt expects argv-style input");
};

export const defineDefaults = (defaults: QValue, parser: QValue, raw: QValue): QValue => {
  if (defaults.kind !== "dictionary") {
    throw new QRuntimeError("type", ".Q.def expects a default dictionary");
  }

  const parsed =
    parser.kind === "builtin" && parser.name === ".Q.opt"
      ? parseQOpt(raw)
      : raw.kind === "dictionary"
        ? raw
        : qDictionary([], []);

  if (parsed.kind !== "dictionary") {
    throw new QRuntimeError("type", ".Q.def expects a dictionary of parsed options");
  }

  return qDictionary(
    defaults.keys,
    defaults.keys.map((key, index) => {
      const parsedIndex = parsed.keys.findIndex((candidate) => equals(candidate, key));
      return parsedIndex >= 0 ? parsed.values[parsedIndex] ?? defaults.values[index]! : defaults.values[index]!;
    })
  );
};

export const formatQNumber = (widthValue: QValue, decimalsValue: QValue, value: QValue): QValue => {
  const width = toNumber(widthValue);
  const decimals = toNumber(decimalsValue);
  const numericValue = toNumber(value);
  return qString(numericValue.toFixed(decimals).padStart(width, " "));
};

export const atobValue = (value: QValue): QValue => {
  if (value.kind !== "string") {
    throw new QRuntimeError("type", ".Q.atob expects a string");
  }

  if (typeof atob === "function") {
    return qString(atob(value.value));
  }

  return qString(Buffer.from(value.value, "base64").toString("utf8"));
};

export const btoaValue = (value: QValue): QValue => {
  const text = value.kind === "string" ? value.value : formatBare(value);

  if (typeof btoa === "function") {
    return qString(btoa(text));
  }

  return qString(Buffer.from(text, "utf8").toString("base64"));
};

export const encodeFixedBase = (value: QValue, width: number, alphabet: string): QValue => {
  let remaining = BigInt(Math.max(0, Math.trunc(toNumber(value))));
  const base = BigInt(alphabet.length);
  const chars = Array.from({ length: width }, () => alphabet[0]!);

  for (let index = width - 1; index >= 0 && remaining > 0n; index -= 1) {
    chars[index] = alphabet[Number(remaining % base)]!;
    remaining /= base;
  }

  return qString(chars.join(""));
};

export const decodeFixedBase = (value: QValue, alphabet: string): QValue => {
  if (value.kind !== "string") {
    throw new QRuntimeError("type", "decode expects a string");
  }

  const base = BigInt(alphabet.length);
  let decoded = 0n;
  for (const char of value.value) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) {
      throw new QRuntimeError("domain", `Unsupported digit ${char}`);
    }
    decoded = decoded * base + BigInt(digit);
  }
  return qLong(Number(decoded));
};

export const sanitizeQIdentifier = (name: string) => {
  const stripped = name.replace(/[^A-Za-z0-9_]/g, "");
  return stripped === "" || /^[0-9_]/.test(stripped) ? `a${stripped}` : stripped;
};

export const uniquifyQIdentifiers = (names: string[]) => {
  const used = new Set<string>();
  return names.map((name) => {
    const base = sanitizeQIdentifier(name);
    let candidate = Q_RESERVED_SET.has(base) ? `${base}1` : base;
    if (!used.has(candidate) && !Q_RESERVED_SET.has(candidate)) {
      used.add(candidate);
      return candidate;
    }

    let suffix = 1;
    let unique = `${candidate}${suffix}`;
    while (used.has(unique) || Q_RESERVED_SET.has(unique)) {
      suffix += 1;
      unique = `${candidate}${suffix}`;
    }
    used.add(unique);
    return unique;
  });
};

export const qsqlExpressionName = (node: AstNode | null): string | null => {
  if (!node) {
    return null;
  }
  switch (node.kind) {
    case "identifier":
      return node.name;
    case "group":
      return qsqlExpressionName(node.value);
    case "assign":
    case "assignGlobal":
      return node.name;
    case "call":
      return qsqlExpressionName(node.args[0] ?? null);
    case "binary":
      return qsqlExpressionName(node.left) ?? qsqlExpressionName(node.right);
    case "vector":
      return qsqlExpressionName(node.items[0] ?? null);
    default:
      return null;
  }
};

export const QSQL_AGGREGATES = new Set([
  "sum",
  "avg",
  "min",
  "max",
  "count",
  "first",
  "last",
  "prd",
  "med",
  "dev",
  "sdev",
  "var",
  "svar"
]);

export const isQsqlAggregateExpression = (node: AstNode | null): boolean => {
  if (!node) {
    return false;
  }
  if (node.kind === "group") {
    return isQsqlAggregateExpression(node.value);
  }
  if (node.kind === "assign" || node.kind === "assignGlobal") {
    return isQsqlAggregateExpression(node.value);
  }
  return (
    node.kind === "call" &&
    node.callee.kind === "identifier" &&
    node.args.length === 1 &&
    QSQL_AGGREGATES.has(node.callee.name)
  );
};

export const qsqlColumnNames = (columns: { name: string | null; value: AstNode }[]) =>
  uniquifyQIdentifiers(
    columns.map((column, index) => column.name ?? qsqlExpressionName(column.value) ?? (index === 0 ? "x" : `x${index}`))
  );

export const renameTableColumns = (table: QTable, names: string[]) => {
  const entries = Object.entries(table.columns);
  return qTable(
    Object.fromEntries(
      entries.map(([_, column], index) => [names[index]!, column])
    )
  );
};

export const qIdValue = (value: QValue): QValue => {
  if (value.kind === "symbol") {
    return qSymbol(uniquifyQIdentifiers([value.value])[0]!);
  }
  if (value.kind === "list" && value.items.every((item) => item.kind === "symbol")) {
    return qList(
      uniquifyQIdentifiers(value.items.map((item) => (item as QSymbol).value)).map((name) =>
        qSymbol(name)
      ),
      true
    );
  }
  if (value.kind === "dictionary" && value.keys.every((key) => key.kind === "symbol")) {
    return qDictionary(
      uniquifyQIdentifiers(value.keys.map((key) => (key as QSymbol).value)).map((name) =>
        qSymbol(name)
      ),
      value.values
    );
  }
  if (value.kind === "table") {
    return renameTableColumns(value, uniquifyQIdentifiers(Object.keys(value.columns)));
  }
  if (value.kind === "keyedTable") {
    const allNames = [...Object.keys(value.keys.columns), ...Object.keys(value.values.columns)];
    const renamed = uniquifyQIdentifiers(allNames);
    return qKeyedTable(
      renameTableColumns(value.keys, renamed.slice(0, Object.keys(value.keys.columns).length)),
      renameTableColumns(value.values, renamed.slice(Object.keys(value.keys.columns).length))
    );
  }
  throw new QRuntimeError("type", ".Q.id expects symbols, dictionaries or tables");
};

export const xcolValue = (namesValue: QValue, tableValue: QValue): QValue => {
  if (namesValue.kind !== "list" || !namesValue.items.every((item) => item.kind === "symbol")) {
    throw new QRuntimeError("type", "xcol expects a symbol list on the left");
  }

  const names = namesValue.items.map((item) => (item as QSymbol).value);

  if (tableValue.kind === "table") {
    if (names.length !== Object.keys(tableValue.columns).length) {
      throw new QRuntimeError("length", "xcol name count must match table columns");
    }
    return renameTableColumns(tableValue, names);
  }

  if (tableValue.kind === "keyedTable") {
    const keyNames = Object.keys(tableValue.keys.columns);
    const valueNames = Object.keys(tableValue.values.columns);
    if (names.length !== keyNames.length + valueNames.length) {
      throw new QRuntimeError("length", "xcol name count must match keyed table columns");
    }
    return qKeyedTable(
      renameTableColumns(tableValue.keys, names.slice(0, keyNames.length)),
      renameTableColumns(tableValue.values, names.slice(keyNames.length))
    );
  }

  throw new QRuntimeError("type", "xcol expects a table");
};

export const asMatrix = (value: QValue): number[][] => {
  if (value.kind !== "list") {
    throw new QRuntimeError("type", "expected a matrix (list of lists)");
  }
  return value.items.map((row) => {
    if (row.kind !== "list") {
      throw new QRuntimeError("type", "expected each matrix row to be a list");
    }
    return row.items.map((cell) => toNumber(cell));
  });
};

export const fromMatrix = (rows: number[][]): QValue =>
  qList(
    rows.map((row) => qList(row.map((value) => qFloat(value)), true)),
    false
  );

export const mmuValue = (left: QValue, right: QValue): QValue => {
  const a = asMatrix(left);
  const b = asMatrix(right);
  const rows = a.length;
  if (rows === 0) return qList([]);
  const inner = a[0]!.length;
  if (b.length !== inner) {
    throw new QRuntimeError("length", "mmu: inner dimensions must match");
  }
  const cols = b[0]?.length ?? 0;
  const result: number[][] = new Array(rows);
  for (let i = 0; i < rows; i++) {
    const aRow = a[i]!;
    if (aRow.length !== inner) {
      throw new QRuntimeError("length", "mmu: ragged left matrix");
    }
    const out = new Array<number>(cols);
    for (let j = 0; j < cols; j++) {
      let sum = 0;
      for (let k = 0; k < inner; k++) {
        sum += aRow[k]! * b[k]![j]!;
      }
      out[j] = sum;
    }
    result[i] = out;
  }
  return fromMatrix(result);
};

export const invValue = (value: QValue): QValue => {
  const m = asMatrix(value);
  const n = m.length;
  if (n === 0 || m.some((row) => row.length !== n)) {
    throw new QRuntimeError("length", "inv: matrix must be square");
  }
  const aug: number[][] = m.map((row, i) => {
    const extended = row.slice();
    for (let j = 0; j < n; j++) extended.push(i === j ? 1 : 0);
    return extended;
  });
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row]![col]!) > Math.abs(aug[pivot]![col]!)) {
        pivot = row;
      }
    }
    if (pivot !== col) {
      const tmp = aug[col]!;
      aug[col] = aug[pivot]!;
      aug[pivot] = tmp;
    }
    const pivotValue = aug[col]![col]!;
    if (pivotValue === 0) {
      throw new QRuntimeError("domain", "inv: matrix is singular");
    }
    for (let j = 0; j < 2 * n; j++) aug[col]![j]! /= pivotValue;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row]![col]!;
      if (factor === 0) continue;
      for (let j = 0; j < 2 * n; j++) {
        aug[row]![j]! -= factor * aug[col]![j]!;
      }
    }
  }
  const result: number[][] = aug.map((row) => row.slice(n));
  return fromMatrix(result);
};

export const wsumValue = (weights: QValue, values: QValue): QValue =>
  sumValue(mapBinary(weights, values, (a, b) => multiply(a, b)));

export const wavgValue = (weights: QValue, values: QValue): QValue => {
  const numerator = sumValue(mapBinary(weights, values, (a, b) => multiply(a, b)));
  const denominator = sumValue(weights);
  return divide(numerator, denominator);
};

export const binarySearchValue = (list: QValue, target: QValue, mode: "bin" | "binr"): QValue => {
  if (list.kind !== "list") {
    throw new QRuntimeError("type", `${mode} expects a list on the left`);
  }
  const items = list.items;
  const searchOne = (value: QValue): QValue => {
    let lo = 0;
    let hi = items.length - 1;
    if (mode === "bin") {
      let idx = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (compare(items[mid]!, value) <= 0) {
          idx = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      return qLong(idx);
    }
    let idx = items.length;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (compare(items[mid]!, value) < 0) {
        lo = mid + 1;
      } else {
        idx = mid;
        hi = mid - 1;
      }
    }
    return qLong(idx);
  };
  if (target.kind === "list") {
    return qList(target.items.map(searchOne), true);
  }
  return searchOne(target);
};

export const rankValue = (value: QValue): QValue => gradeValue(gradeValue(value, true), true);

export const randValue = (arg: QValue): QValue => {
  if (arg.kind === "list") {
    if (arg.items.length === 0) return qNull();
    return arg.items[Math.floor(Math.random() * arg.items.length)]!;
  }
  if (arg.kind === "number") {
    const n = arg.value;
    if (Number.isInteger(n) && n > 0) {
      return qLong(Math.floor(Math.random() * n));
    }
    return qFloat(Math.random() * n);
  }
  if (arg.kind === "boolean") {
    return qLong(arg.value ? 0 : 0);
  }
  throw new QRuntimeError("type", "rand expects a number or list");
};

export const hsymValue = (value: QValue): QValue => {
  if (value.kind === "symbol") {
    return qSymbol(value.value.startsWith(":") ? value.value : `:${value.value}`);
  }
  if (value.kind === "list") {
    return qList(value.items.map(hsymValue), value.homogeneous ?? false);
  }
  throw new QRuntimeError("type", "hsym expects a symbol");
};

export const fileHandlePath = (value: QValue, caller: string): string => {
  if (value.kind !== "symbol") {
    throw new QRuntimeError("type", `${caller} expects a file-handle symbol`);
  }
  return value.value.startsWith(":") ? value.value.slice(1) : value.value;
};

export const loadScriptFromFs = (session: Session, rawPath: string): QValue => {
  const path = rawPath.startsWith(":") ? rawPath.slice(1) : rawPath;
  const candidates = [path, `${path}.q`, `${path}.k`];
  const fs = session.fs();
  for (const candidate of candidates) {
    const source = fs.readText(candidate);
    if (source !== null) {
      session.evaluate(source);
      return qSymbol(candidate);
    }
  }
  throw new QRuntimeError("io", `\\l: ${path} not found`);
};

export const textLines = (contents: string): string[] => {
  const lines = contents.split(/\r?\n/);
  return lines.length > 0 && lines[lines.length - 1] === "" ? lines.slice(0, -1) : lines;
};

export const byteListFromBytes = (bytes: Uint8Array): QList =>
  qList([...bytes].map((byte) => qLong(byte)), true, "byte");

export const byteListFromText = (text: string): QList =>
  qList([...text].map((char) => qLong(char.codePointAt(0)!)), true, "byte");

export const inferFormatFromExt = (path: string): StoredFileFormat => {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return "q";
  const ext = path.slice(dot + 1).toLowerCase();
  if (ext === "csv") return "csv";
  if (ext === "tsv") return "tsv";
  if (ext === "txt") return "txt";
  if (ext === "json") return "json";
  return "q";
};

export const isDelimitedFormat = (format: StoredFileFormat): format is "csv" | "tsv" =>
  format === "csv" || format === "tsv";

export const delimiterForDelimitedFormat = (format: "csv" | "tsv"): "," | "\t" =>
  format === "csv" ? "," : "\t";

export const delimiterForFormat = (format: StoredFileFormat): "," | "\t" | null =>
  isDelimitedFormat(format) ? delimiterForDelimitedFormat(format) : null;

export const variableNameFromFilePath = (path: string): string => {
  const slash = path.lastIndexOf("/");
  const file = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = file.lastIndexOf(".");
  return dot >= 0 ? file.slice(0, dot) : file;
};

export const escapeCsvField = (text: string, delimiter: string): string => {
  if (text.includes(delimiter) || text.includes("\"") || text.includes("\n") || text.includes("\r")) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
};

export const cellToCsvText = (value: QValue): string => {
  if (value.kind === "null") return "";
  if (value.kind === "string") return value.value;
  if (value.kind === "symbol") return value.value;
  if (value.kind === "boolean") return value.value ? "1" : "0";
  return formatValue(value, { trailingNewline: false });
};

export const tableToCsv = (table: QTable, delimiter: string): string => {
  const names = Object.keys(table.columns);
  const rows = tableRowCount(table);
  const lines: string[] = [names.map((name) => escapeCsvField(name, delimiter)).join(delimiter)];
  for (let i = 0; i < rows; i += 1) {
    const cells = names.map((name) =>
      escapeCsvField(cellToCsvText(table.columns[name]!.items[i]!), delimiter)
    );
    lines.push(cells.join(delimiter));
  }
  return lines.join("\n");
};

export const tableForDelimitedSave = (value: QValue, format: "csv" | "tsv"): QTable => {
  if (value.kind === "keyedTable") {
    return qTable({ ...value.keys.columns, ...value.values.columns });
  }
  if (value.kind === "table") {
    return value;
  }
  throw new QRuntimeError("type", `save ${format}: expected a table value`);
};

export const parseCsvLine = (line: string, delimiter: string): string[] => {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === "\"") {
        if (line[i + 1] === "\"") {
          field += "\"";
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === "\"") {
      quoted = true;
    } else if (ch === delimiter) {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
};

export const inferCellValue = (text: string): QValue => {
  if (text === "") return qNull();
  if (text === "0b") return qBool(false);
  if (text === "1b") return qBool(true);
  if (/^-?\d+$/.test(text)) {
    const n = Number(text);
    if (Number.isFinite(n) && Number.isInteger(n)) return qLong(n);
  }
  if (/^-?\d+\.\d*$/.test(text) || /^-?\.\d+$/.test(text)) {
    const n = Number(text);
    if (Number.isFinite(n)) return numeric(n, true);
  }
  return qString(text);
};

export const csvToTable = (text: string, delimiter: string): QTable => {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return qTable({});
  const headers = parseCsvLine(lines[0]!, delimiter);
  const columns: Record<string, QValue[]> = {};
  for (const header of headers) columns[header] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]!, delimiter);
    for (let j = 0; j < headers.length; j += 1) {
      columns[headers[j]!]!.push(inferCellValue(cells[j] ?? ""));
    }
  }
  return qTable(
    Object.fromEntries(
      Object.entries(columns).map(([name, items]) => [
        name,
        qList(items, items.every((item) => item.kind === items[0]?.kind))
      ])
    )
  );
};

export const writeQValueToFs = (session: Session, path: string, value: QValue): void => {
  const format = inferFormatFromExt(path);
  const fs = session.fs();
  if (isDelimitedFormat(format)) {
    const table = tableForDelimitedSave(value, format);
    fs.writeText(path, tableToCsv(table, delimiterForDelimitedFormat(format)));
    return;
  }
  if (format === "json") {
    fs.writeText(path, JSON.stringify(canonicalize(value), null, 2));
    return;
  }
  if (format === "txt") {
    const text =
      value.kind === "string"
        ? value.value
        : value.kind === "list" && value.items.every((item) => item.kind === "string")
          ? value.items.map((item) => (item as QString).value).join("\n")
          : formatValue(value, { trailingNewline: false });
    fs.writeText(path, text);
    return;
  }
  fs.writeText(path, JSON.stringify(canonicalize(value)));
};

export const readQValueFromFs = (session: Session, path: string): QValue => {
  const format = inferFormatFromExt(path);
  const fs = session.fs();
  const text = fs.readText(path);
  if (text === null) {
    throw new QRuntimeError("io", `get: ${path} not found`);
  }
  const delimiter = delimiterForFormat(format);
  if (delimiter !== null) return csvToTable(text, delimiter);
  if (format === "json") {
    return hydrateCanonical(JSON.parse(text));
  }
  if (format === "txt") return qString(text);
  try {
    return hydrateCanonical(JSON.parse(text));
  } catch {
    return qString(text);
  }
};

export const hydrateCanonical = (value: unknown): QValue => {
  if (value === null || value === undefined) return qNull();
  if (typeof value === "boolean") return qBool(value);
  if (typeof value === "number") return Number.isInteger(value) ? qLong(value) : numeric(value, true);
  if (typeof value === "string") return qString(value);
  if (Array.isArray(value)) {
    const items = value.map(hydrateCanonical);
    return qList(items, items.every((item) => item.kind === items[0]?.kind));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.kind === "symbol" && typeof record.value === "string") return qSymbol(record.value);
    if (record.kind === "number" && typeof record.value === "number") {
      return Number.isInteger(record.value) ? qLong(record.value) : numeric(record.value, true);
    }
    if (record.kind === "table" && record.columns) {
      const columns: Record<string, QList> = {};
      for (const [name, items] of Object.entries(record.columns as Record<string, unknown>)) {
        const list = hydrateCanonical(items);
        columns[name] = list.kind === "list" ? list : qList([list], true);
      }
      return qTable(columns);
    }
    const keys = Object.keys(record);
    return qDictionary(
      keys.map((key) => qSymbol(key)),
      keys.map((key) => hydrateCanonical(record[key]))
    );
  }
  return qNull();
};

export const xcolsValue = (namesValue: QValue, tableValue: QValue): QValue => {
  const symbols = namesValue.kind === "list"
    ? namesValue.items
    : namesValue.kind === "symbol"
      ? [namesValue]
      : [];
  if (symbols.length === 0 || !symbols.every((item) => item.kind === "symbol")) {
    throw new QRuntimeError("type", "xcols expects a symbol list on the left");
  }
  const orderedNames = symbols.map((item) => (item as QSymbol).value);

  if (tableValue.kind === "table") {
    const existing = Object.keys(tableValue.columns);
    for (const name of orderedNames) {
      if (!(name in tableValue.columns)) {
        throw new QRuntimeError("name", `xcols: column not found: ${name}`);
      }
    }
    const remainder = existing.filter((name) => !orderedNames.includes(name));
    const newOrder = [...orderedNames, ...remainder];
    return qTable(Object.fromEntries(newOrder.map((name) => [name, tableValue.columns[name]!])));
  }
  throw new QRuntimeError("type", "xcols expects a table");
};

export const insertValue = (session: Session, target: QValue, payload: QValue): QValue => {
  if (target.kind !== "symbol") {
    throw new QRuntimeError("type", "insert expects a symbol target");
  }
  const current = session.get(target.value);
  if (current.kind !== "table") {
    throw new QRuntimeError("type", "insert target must be a table");
  }
  const columnNames = Object.keys(current.columns);
  const rowsToAppend: QValue[][] = [];
  if (payload.kind === "list") {
    if (payload.items.length === 0) {
      session.assignGlobal(target.value, current);
      return qList([], true);
    }
    const firstItem = payload.items[0]!;
    const isMultiRow = payload.items.every((item) => item.kind === "list") && firstItem.kind === "list" && firstItem.items.length === columnNames.length;
    if (isMultiRow) {
      for (const row of payload.items) {
        rowsToAppend.push((row as QList).items);
      }
    } else if (payload.items.length === columnNames.length) {
      rowsToAppend.push(payload.items);
    } else {
      throw new QRuntimeError("length", "insert: row width must match table columns");
    }
  } else if (payload.kind === "dictionary") {
    const keys = payload.keys.map((key) => (key.kind === "symbol" ? key.value : null));
    if (keys.some((key) => key === null)) {
      throw new QRuntimeError("type", "insert dictionary requires symbol keys");
    }
    const row = columnNames.map((name) => {
      const idx = keys.indexOf(name);
      return idx >= 0 ? payload.values[idx]! : qNull();
    });
    rowsToAppend.push(row);
  } else {
    throw new QRuntimeError("type", "insert expects a list or dictionary payload");
  }
  const nextColumns: Record<string, QList> = {};
  for (let colIndex = 0; colIndex < columnNames.length; colIndex++) {
    const name = columnNames[colIndex]!;
    const existing = current.columns[name]!;
    const additions = rowsToAppend.map((row) => row[colIndex]!);
    const merged = [...existing.items, ...additions];
    nextColumns[name] = qList(merged, merged.every((item) => item.kind === merged[0]?.kind));
  }
  const updated = qTable(nextColumns);
  session.assignGlobal(target.value, updated);
  const startIndex = Object.values(current.columns)[0]?.items.length ?? 0;
  return qList(
    rowsToAppend.map((_, i) => qLong(startIndex + i)),
    true
  );
};

export const upsertValue = (session: Session, target: QValue, payload: QValue): QValue => {
  if (target.kind === "symbol") {
    return insertValue(session, target, payload);
  }
  if (target.kind === "table" && payload.kind === "table") {
    const leftColumns = Object.keys(target.columns);
    const rightColumns = Object.keys(payload.columns);
    if (leftColumns.length !== rightColumns.length || leftColumns.some((name) => !rightColumns.includes(name))) {
      throw new QRuntimeError("schema", "upsert: table columns must match");
    }
    const merged: Record<string, QList> = {};
    for (const name of leftColumns) {
      const left = target.columns[name]!;
      const right = payload.columns[name]!;
      const items = [...left.items, ...right.items];
      merged[name] = qList(items, items.every((item) => item.kind === items[0]?.kind));
    }
    return qTable(merged);
  }
  throw new QRuntimeError("type", "upsert expects a symbol or matching tables");
};

export const inValue = (left: QValue, right: QValue): QValue => {
  const contains = (value: QValue) => {
    if (right.kind === "list") {
      return qBool(right.items.some((candidate) => equals(candidate, value)));
    }
    return qBool(equals(value, right));
  };

  if (left.kind === "list") {
    return qList(left.items.map(contains), true);
  }

  return contains(left);
};

export const gradeValue = (value: QValue, ascending: boolean): QValue => {
  const items = asSequenceItems(value).map((item, index) => ({ item, index }));
  items.sort((left, right) => {
    const compared = compare(left.item, right.item);
    return compared === 0 ? left.index - right.index : ascending ? compared : -compared;
  });
  return qList(items.map(({ index }) => qLong(index)), true);
};

export const asSequenceItems = (value: QValue): QValue[] => {
  if (value.kind === "list") {
    return value.items;
  }
  if (value.kind === "string") {
    return [...value.value].map((char) => qString(char));
  }
  return [value];
};

export const shuffleItems = <T>(items: T[]) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
  }
  return copy;
};

export const rebuildSequence = (prototype: QValue, items: QValue[]): QValue => {
  if (prototype.kind === "string") {
    return qString(
      items
        .map((item) => {
          if (item.kind !== "string" || item.value.length !== 1) {
            throw new QRuntimeError("type", "String set verbs expect character values");
          }
          return item.value;
        })
        .join("")
    );
  }
  if (prototype.kind === "list") {
    return qList(items, prototype.homogeneous ?? items.every((item) => item.kind === items[0]?.kind));
  }
  return items[0] ?? qNull();
};

export const distinctItems = (items: QValue[]) =>
  items.filter((item, index) => items.findIndex((candidate) => equals(candidate, item)) === index);

export const crossValue = (left: QValue, right: QValue): QValue =>
  qList(
    asSequenceItems(left).flatMap((leftItem) =>
      asSequenceItems(right).map((rightItem) => qList([leftItem, rightItem]))
    ),
    false
  );

export const applyEachValue = (session: Session, left: QValue, right: QValue): QValue => {
  if (left.kind === "list" && right.kind === "list") {
    if (left.items.length !== right.items.length) {
      throw new QRuntimeError("length", "@' expects equal-length lists");
    }
    return qList(
      left.items.map((item, index) => session.invoke(item, [right.items[index]!])),
      false
    );
  }

  const items = asSequenceItems(right);
  return qList(items.map((item) => session.invoke(left, [item])), false);
};

export const groupValue = (value: QValue): QValue => {
  const buckets: { key: QValue; positions: QValue[] }[] = [];
  asSequenceItems(value).forEach((item, index) => {
    const existing = buckets.find((candidate) => equals(candidate.key, item));
    if (existing) {
      existing.positions.push(qLong(index));
      return;
    }
    buckets.push({ key: item, positions: [qLong(index)] });
  });
  return qDictionary(
    buckets.map(({ key }) => key),
    buckets.map(({ positions }) => qList(positions, true))
  );
};

export const callableArity = (value: QValue): number | null => {
  switch (value.kind) {
    case "builtin":
      return value.arity;
    case "lambda":
      return lambdaArity(value as LambdaValue);
    case "projection":
      return value.arity - value.args.filter((arg) => arg !== null).length;
    default:
      return null;
  }
};

export const convergeValue = (session: Session, callable: QValue, value: QValue, scan: boolean): QValue => {
  const outputs = [value];
  let current = value;
  for (let index = 0; index < 1024; index += 1) {
    const next = session.invoke(callable, [current]);
    outputs.push(next);
    if (equals(next, current)) {
      return scan ? qList(outputs, false) : current;
    }
    current = next;
  }
  throw new QRuntimeError("limit", "converge exceeded iteration limit");
};

export const reduceValueWithSeed = (session: Session, callable: QValue, seed: QValue, value: QValue): QValue => {
  let result = seed;
  for (const item of asSequenceItems(value)) {
    result = session.invoke(callable, [result, item]);
  }
  return result;
};

export const scanValueWithSeed = (session: Session, callable: QValue, seed: QValue, value: QValue): QValue => {
  const outputs: QValue[] = [];
  let result = seed;
  for (const item of asSequenceItems(value)) {
    result = session.invoke(callable, [result, item]);
    outputs.push(result);
  }
  return qList(outputs, false);
};

export const flattenRazeLeaves = (value: QValue): QValue[] => {
  if (value.kind !== "list") {
    return [value];
  }
  return value.items.flatMap((item) => flattenRazeLeaves(item));
};

export const PRIMITIVE_ADVERB_TYPECHECK_NAMES = new Set([
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
]);

export const ensurePrimitiveAdverbInput = (callable: QValue, value: QValue) => {
  if (
    callable.kind === "builtin" &&
    PRIMITIVE_ADVERB_TYPECHECK_NAMES.has(callable.name) &&
    value.kind === "list" &&
    !(value.homogeneous ?? false)
  ) {
    throw new QRuntimeError("type", "Primitive adverb expects a simple list");
  }
};

export const reduceValue = (session: Session, callable: QValue, value: QValue, seed?: QValue): QValue => {
  if (seed !== undefined) {
    if (callableArity(callable) === 1 && value.kind === "number") {
      const count = toNumber(value);
      let current = seed;
      for (let i = 0; i < count; i += 1) {
        current = session.invoke(callable, [current]);
      }
      return current;
    }
    return reduceValueWithSeed(session, callable, seed, value);
  }
  if (callableArity(callable) === 1) {
    return convergeValue(session, callable, value, false);
  }
  const items = asSequenceItems(value);
  if (items.length === 0) {
    return qNull();
  }
  let result = items[0]!;
  for (const item of items.slice(1)) {
    result = session.invoke(callable, [result, item]);
  }
  return result;
};

export const scanValue = (session: Session, callable: QValue, value: QValue, seed?: QValue): QValue => {
  if (seed !== undefined) {
    if (callableArity(callable) === 1 && value.kind === "number") {
      const count = toNumber(value);
      const outputs: QValue[] = [seed];
      let current = seed;
      for (let i = 0; i < count; i += 1) {
        current = session.invoke(callable, [current]);
        outputs.push(current);
      }
      return qList(outputs, false);
    }
    return scanValueWithSeed(session, callable, seed, value);
  }
  if (callableArity(callable) === 1) {
    return convergeValue(session, callable, value, true);
  }
  const items = asSequenceItems(value);
  if (items.length === 0) {
    return qList([], false);
  }
  let result = items[0]!;
  const outputs = [result];
  for (const item of items.slice(1)) {
    result = session.invoke(callable, [result, item]);
    outputs.push(result);
  }
  return qList(outputs, false);
};

export const reducePrimitiveAdverbValue = (session: Session, callable: QValue, value: QValue, seed?: QValue): QValue => {
  ensurePrimitiveAdverbInput(callable, value);
  return reduceValue(session, callable, value, seed);
};

export const scanPrimitiveAdverbValue = (session: Session, callable: QValue, value: QValue, seed?: QValue): QValue => {
  ensurePrimitiveAdverbInput(callable, value);
  return scanValue(session, callable, value, seed);
};

export const primitiveDerivedAdverbValue = (
  session: Session,
  base: string,
  adverb: "/" | "\\",
  args: QValue[]
): QValue => {
  const callable = session.get(base);
  const applyAdverb = adverb === "/" ? reducePrimitiveAdverbValue : scanPrimitiveAdverbValue;
  if (args.length === 1) {
    return applyAdverb(session, callable, args[0]!);
  }
  if (args.length === 2 && args[1]?.kind === "list") {
    return applyAdverb(session, callable, args[1], args[0]!);
  }
  return applyAdverb(
    session,
    callable,
    qList(args, args.every((arg) => arg.kind === args[0]?.kind))
  );
};

export const priorValue = (session: Session, callable: QValue, value: QValue): QValue => {
  if (value.kind === "string") {
    const chars = [...value.value].map((char) => qString(char));
    const result = priorValue(session, callable, qList(chars, true));
    return rebuildSequence(value, asSequenceItems(result));
  }
  const list = asList(value);
  if (list.items.length === 0) {
    return qList([], list.homogeneous ?? false);
  }
  return qList(
    list.items.map((item, index) =>
      index === 0 ? item : session.invoke(callable, [list.items[index - 1] ?? qNull(), item])
    ),
    false
  );
};

export const patternToRegex = (pattern: string) =>
  new RegExp(
    `^${[...pattern]
      .map((char) => {
        if (char === "*") {
          return ".*";
        }
        if (char === "?") {
          return ".";
        }
        return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("")}$`
  );

export const likeValue = (left: QValue, right: QValue): QValue =>
  mapBinary(left, right, (value, pattern) => {
    if (value.kind !== "string" || pattern.kind !== "string") {
      throw new QRuntimeError("type", "like expects string arguments");
    }
    return qBool(patternToRegex(pattern.value).test(value.value));
  });

export const ssValue = (left: QValue, right: QValue): QValue => {
  if (left.kind !== "string" || right.kind !== "string") {
    throw new QRuntimeError("type", "ss expects string arguments");
  }
  if (right.value.length === 0) {
    return qList([], true);
  }
  const positions: QValue[] = [];
  let index = 0;
  while (index <= left.value.length - right.value.length) {
    if (left.value.slice(index, index + right.value.length) === right.value) {
      positions.push(qLong(index));
      index += right.value.length;
      continue;
    }
    index += 1;
  }
  return qList(positions, true);
};

export const stringLikeValue = (value: QValue): string | null => {
  if (value.kind === "string") {
    return value.value;
  }
  if (value.kind === "symbol") {
    return value.value;
  }
  if (value.kind === "list" && value.items.every((item) => item.kind === "string")) {
    return value.items.map((item) => (item as QString).value).join("");
  }
  return null;
};

export const svValue = (left: QValue, right: QValue): QValue => {
  if (left.kind !== "string" || right.kind !== "list") {
    throw new QRuntimeError("type", "sv expects a string separator and a list of strings");
  }
  const parts = right.items.map(stringLikeValue);
  if (parts.some((part) => part === null)) {
    throw new QRuntimeError("type", "sv expects a list of strings");
  }
  return qString((parts as string[]).join(left.value));
};

export const vsValue = (left: QValue, right: QValue): QValue => {
  if (left.kind !== "string" || right.kind !== "string") {
    throw new QRuntimeError("type", "vs expects string arguments");
  }
  if (left.value === "") {
    return qList([qString(right.value)], false);
  }
  return qList(right.value.split(left.value).map((part) => qString(part)), false);
};

export const resolveWithinBound = (bound: QValue, index: number, length: number): QValue => {
  if (bound.kind !== "list") {
    return bound;
  }
  if (bound.items.length !== length) {
    throw new QRuntimeError("length", "within bounds must match the left argument");
  }
  return bound.items[index] ?? nullLike(bound.items[0]);
};

export const withinValue = (left: QValue, right: QValue): QValue => {
  if (right.kind !== "list" || right.items.length !== 2) {
    throw new QRuntimeError("type", "within expects a two-item right argument");
  }

  const [lower, upper] = right.items;
  const withinScalar = (value: QValue, lowerBound: QValue, upperBound: QValue) =>
    qBool(compare(value, lowerBound) >= 0 && compare(value, upperBound) <= 0);

  if (left.kind === "list") {
    return qList(
      left.items.map((item, index) =>
        withinScalar(
          item,
          resolveWithinBound(lower, index, left.items.length),
          resolveWithinBound(upper, index, left.items.length)
        )
      ),
      true
    );
  }

  return withinScalar(left, resolveWithinBound(lower, 0, 1), resolveWithinBound(upper, 0, 1));
};

export const exceptValue = (left: QValue, right: QValue): QValue => {
  const rightItems = asSequenceItems(right);
  return rebuildSequence(
    left,
    asSequenceItems(left).filter(
      (item) => !rightItems.some((candidate) => equals(candidate, item))
    )
  );
};

export const interValue = (left: QValue, right: QValue): QValue => {
  const rightItems = asSequenceItems(right);
  return rebuildSequence(
    left,
    distinctItems(asSequenceItems(left)).filter((item) =>
      rightItems.some((candidate) => equals(candidate, item))
    )
  );
};

export const unionValue = (left: QValue, right: QValue): QValue =>
  rebuildSequence(left, distinctItems([...asSequenceItems(left), ...asSequenceItems(right)]));

export const lowerValue = (value: QValue): QValue => {
  if (value.kind === "string") {
    return qString(value.value.toLowerCase());
  }
  if (value.kind === "symbol") {
    return qSymbol(value.value.toLowerCase());
  }
  if (value.kind === "list") {
    return qList(value.items.map(lowerValue), value.homogeneous ?? false);
  }
  return value;
};

export const upperValue = (value: QValue): QValue => {
  if (value.kind === "string") {
    return qString(value.value.toUpperCase());
  }
  if (value.kind === "symbol") {
    return qSymbol(value.value.toUpperCase());
  }
  if (value.kind === "list") {
    return qList(value.items.map(upperValue), value.homogeneous ?? false);
  }
  return value;
};

export const trimStringValue = (value: QValue, mode: "left" | "right" | "both"): QValue => {
  if (value.kind === "list") {
    return qList(value.items.map((item) => trimStringValue(item, mode)), value.homogeneous ?? false);
  }
  if (value.kind === "symbol") {
    const trimmed = trimStringValue(qString(value.value), mode);
    if (trimmed.kind !== "string") {
      throw new QRuntimeError("type", "trim expects strings or symbols");
    }
    return qSymbol(trimmed.value);
  }
  if (value.kind !== "string") {
    throw new QRuntimeError("type", "trim expects strings or symbols");
  }
  switch (mode) {
    case "left":
      return qString(value.value.replace(/^\s+/, ""));
    case "right":
      return qString(value.value.replace(/\s+$/, ""));
    case "both":
      return qString(value.value.trim());
  }
};

export const nullValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList(value.items.map((item) => qBool(isNullish(item))), true);
  }
  return qBool(isNullish(value));
};

export const flipListValue = (value: QList): QValue => {
  if (value.items.length === 0) {
    return value;
  }

  const rows = value.items.map((item) => {
    if (item.kind === "list") {
      return item.items;
    }
    if (item.kind === "string") {
      return [...item.value].map((char) => qString(char));
    }
    throw new QRuntimeError("type", "Flip expects a dictionary or rectangular list");
  });
  const width = rows[0]?.length ?? 0;
  if (!rows.every((row) => row.length === width)) {
    throw new QRuntimeError("length", "Flip expects a rectangular list");
  }

  return qList(
    Array.from({ length: width }, (_, columnIndex) =>
      qList(
        rows.map((row) => row[columnIndex]!),
        rows.every((row) => row[columnIndex]!.kind === rows[0]?.[columnIndex]?.kind)
      )
    ),
    false
  );
};

export const flipValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return flipListValue(value);
  }
  if (value.kind !== "dictionary") {
    return value;
  }

  const columns = value.keys.map((key, index) => {
    if (key.kind !== "symbol") {
      throw new QRuntimeError("type", "Flip expects symbol keys");
    }

    const columnValue = value.values[index];
    if (!columnValue) {
      return { name: key.value, value: qList([]) };
    }
    if (columnValue.kind === "list") {
      return { name: key.value, value: columnValue };
    }
    if (columnValue.kind === "string") {
      return {
        name: key.value,
        value: qList([...columnValue.value].map((char) => qString(char)), true)
      };
    }
    throw new QRuntimeError("type", "Flip expects list-like dictionary values");
  });

  return buildTable(columns);
};

export const negateValue = (value: QValue): QValue =>
  value.kind === "list"
    ? qList(value.items.map(negateValue), true)
    : value.kind === "number"
      ? numeric(-value.value, value.numericType === "float")
      : qLong(-toNumber(value));

export const notValue = (value: QValue): QValue =>
  value.kind === "list"
    ? qList(value.items.map(notValue), true)
    : qBool(!isTruthy(value));

export const distinctValue = (value: QValue): QValue => {
  if (value.kind === "table") {
    const seen = new Set<string>();
    const positions: number[] = [];
    const rowCount = countValue(value);
    for (let index = 0; index < rowCount; index += 1) {
      const rowKey = JSON.stringify(canonicalize(rowFromTable(value, index)));
      if (seen.has(rowKey)) {
        continue;
      }
      seen.add(rowKey);
      positions.push(index);
    }

    return qTable(
      Object.fromEntries(
        Object.entries(value.columns).map(([name, column]) => [
          name,
          qList(
            positions.map((position) => column.items[position] ?? nullLike(column.items[0])),
            column.homogeneous ?? false
          )
        ])
      )
    );
  }

  if (value.kind !== "list") {
    return value;
  }
  const seen = new Set<string>();
  const items = value.items.filter((item) => {
    const key = JSON.stringify(canonicalize(item));
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  return qList(items, value.homogeneous ?? false);
};

export const namespaceKeys = (value: QValue) => {
  if (value.kind !== "namespace") {
    throw new QRuntimeError("type", "Expected a namespace");
  }
  return [...value.entries.keys()].map((name) => qSymbol(name));
};

export const whereValue = (value: QValue): QValue => {
  const list = asList(value);
  const items = list.items.flatMap((item, index) =>
    isTruthy(item) ? [qLong(index)] : []
  );
  return qList(items, true);
};

export const concatValues = (left: QValue, right: QValue): QValue => {
  if (left.kind === "table" && right.kind === "table") {
    return concatTables(left, right);
  }
  if (left.kind === "list" && right.kind === "list") {
    const items = [...left.items, ...right.items];
    return qList(items, concatItemsAreHomogeneous(items, left, right));
  }
  if (left.kind === "string" && right.kind === "string") {
    return qString(`${left.value}${right.value}`);
  }
  if (left.kind === "list") {
    const items = [...left.items, right];
    return qList(items, concatItemsAreHomogeneous(items, left));
  }
  if (right.kind === "list") {
    const items = [left, ...right.items];
    return qList(items, concatItemsAreHomogeneous(items, right));
  }
  const items = [left, right];
  return qList(items, concatItemsAreHomogeneous(items));
};

const concatItemsAreHomogeneous = (items: QValue[], ...sources: QValue[]) => {
  if (items.length === 0) return true;
  if (sources.some((source) => source.kind === "list" && source.items.length > 0 && !(source.homogeneous ?? false))) {
    return false;
  }
  return items.every((item) => item.kind === items[0]!.kind);
};

export const concatTables = (left: QTable, right: QTable): QTable => {
  const leftNames = Object.keys(left.columns);
  const rightNames = Object.keys(right.columns);

  if (
    leftNames.length !== rightNames.length ||
    leftNames.some((name, index) => name !== rightNames[index])
  ) {
    throw new QRuntimeError("type", "Cannot append tables with different schemas");
  }

  return qTable(
    Object.fromEntries(
      leftNames.map((name) => {
        const leftColumn = left.columns[name]!;
        const rightColumn = right.columns[name]!;
        return [
          name,
          qList(
            [...leftColumn.items, ...rightColumn.items],
            (leftColumn.homogeneous ?? false) && (rightColumn.homogeneous ?? false)
          )
        ];
      })
    )
  );
};

export const razeValue = (value: QValue): QValue => {
  if (value.kind !== "list") {
    return value;
  }
  const items = flattenRazeLeaves(value);
  if (items.length === 0) {
    return qList([]);
  }
  if (items.every((item) => item.kind === "string")) {
    return qString(items.map((item) => item.value).join(""));
  }
  return items.reduce((acc, item) => concatValues(acc, item));
};

export const takeValue = (left: QValue, right: QValue): QValue => {
  if (left.kind === "list") {
    const shape = left.items.map((item) => {
      if (item.kind !== "number") {
        throw new QRuntimeError("type", "Take shape must be numeric");
      }
      return item.value;
    });
    if (shape.length === 0) {
      return qList([]);
    }
    return reshapeValue(shape, right);
  }

  const count = toNumber(left);
  if (right.kind === "list") {
    if (right.items.length === 0) {
      return qList([]);
    }
    const n = Math.abs(count);
    const len = right.items.length;
    const items =
      count >= 0
        ? Array.from({ length: n }, (_, index) => right.items[index % len]!)
        : Array.from({ length: n }, (_, index) => right.items[((len - n + index) % len + len) % len]!);
    return qList(items, right.homogeneous ?? false);
  }
  if (right.kind === "string") {
    const n = Math.abs(count);
    const len = right.value.length || 1;
    const text =
      count >= 0
        ? Array.from({ length: n }, (_, index) => right.value[index % len] ?? " ").join("")
        : Array.from({ length: n }, (_, index) => right.value[((len - n + index) % len + len) % len] ?? " ").join("");
    return qString(text);
  }
  if (right.kind === "table") {
    const rowCount = tableRowCount(right);
    const n = Math.abs(count);
    const pickRow = (i: number) => (count >= 0 ? i % Math.max(rowCount, 1) : (rowCount - 1 - (i % Math.max(rowCount, 1)) + rowCount) % Math.max(rowCount, 1));
    if (rowCount === 0) return right;
    const positions = Array.from({ length: n }, (_, i) => pickRow(i));
    return selectTableRows(right, positions);
  }
  if (right.kind === "keyedTable") {
    const merged = qTable({ ...right.keys.columns, ...right.values.columns });
    return takeValue(left, merged);
  }
  if (right.kind === "dictionary") {
    const n = Math.abs(count);
    const len = right.keys.length;
    if (len === 0) return right;
    const pick = (i: number) => (count >= 0 ? i % len : (len - 1 - (i % len) + len) % len);
    const newKeys: QValue[] = [];
    const newValues: QValue[] = [];
    for (let i = 0; i < n; i += 1) {
      const idx = pick(i);
      newKeys.push(right.keys[idx]!);
      newValues.push(right.values[idx]!);
    }
    return qDictionary(newKeys, newValues);
  }
  return qList(Array.from({ length: Math.abs(count) }, () => right));
};

export const reshapeValue = (shape: number[], value: QValue): QValue => {
  const counts = shape.map((count) => Math.abs(count));
  const total = counts.reduce((product, count) => product * count, 1);

  if (value.kind === "string") {
    const flat = Array.from({ length: total }, (_, index) => value.value[index % value.value.length] ?? " ");
    return reshapeStrings(counts, flat);
  }

  const items =
    value.kind === "list"
      ? value.items
      : Array.from({ length: total }, () => value);

  if (items.length === 0) {
    return qList([]);
  }

  const flat = Array.from({ length: total }, (_, index) => items[index % items.length] ?? nullLike(items[0]));
  return reshapeItems(counts, flat, value.kind === "list" ? (value.homogeneous ?? false) : false);
};

export const reshapeStrings = (shape: number[], flat: string[]): QValue => {
  if (shape.length === 1) {
    return qString(flat.slice(0, shape[0]).join(""));
  }

  const step = shape.slice(1).reduce((product, count) => product * count, 1);
  const rows: QValue[] = [];
  for (let index = 0; index < shape[0]; index += 1) {
    rows.push(reshapeStrings(shape.slice(1), flat.slice(index * step, (index + 1) * step)));
  }
  return qList(rows, false);
};

export const reshapeItems = (shape: number[], flat: QValue[], homogeneous: boolean): QValue => {
  if (shape.length === 1) {
    return qList(flat.slice(0, shape[0]), homogeneous);
  }

  const step = shape.slice(1).reduce((product, count) => product * count, 1);
  const rows: QValue[] = [];
  for (let index = 0; index < shape[0]; index += 1) {
    rows.push(
      reshapeItems(shape.slice(1), flat.slice(index * step, (index + 1) * step), homogeneous)
    );
  }
  return qList(rows, false);
};

export const dropValue = (left: QValue, right: QValue): QValue => {
  if (left.kind === "list" && left.items.every((item) => item.kind === "number" || item.kind === "boolean")) {
    const indices = left.items.map((item) => Math.trunc(toNumber(item)));
    if (right.kind === "list") {
      const segments: QValue[] = [];
      const total = right.items.length;
      for (let i = 0; i < indices.length; i += 1) {
        const start = indices[i]!;
        const end = i + 1 < indices.length ? indices[i + 1]! : total;
        segments.push(qList(right.items.slice(start, end), right.homogeneous ?? false));
      }
      return qList(segments, false);
    }
    if (right.kind === "string") {
      const segments: QValue[] = [];
      const total = right.value.length;
      for (let i = 0; i < indices.length; i += 1) {
        const start = indices[i]!;
        const end = i + 1 < indices.length ? indices[i + 1]! : total;
        segments.push(qString(right.value.slice(start, end)));
      }
      return qList(segments, false);
    }
  }
  if (left.kind === "symbol" && right.kind === "dictionary") {
    const keyIdx = right.keys.findIndex((k) => k.kind === "symbol" && (k as QSymbol).value === (left as QSymbol).value);
    if (keyIdx < 0) return right;
    return qDictionary(
      right.keys.filter((_, i) => i !== keyIdx),
      right.values.filter((_, i) => i !== keyIdx)
    );
  }
  const count = toNumber(left);
  if (right.kind === "list") {
    if (count < 0) {
      return qList(right.items.slice(0, Math.max(0, right.items.length + count)), right.homogeneous ?? false);
    }
    return qList(right.items.slice(Math.max(0, count)), right.homogeneous ?? false);
  }
  if (right.kind === "string") {
    if (count < 0) {
      return qString(right.value.slice(0, Math.max(0, right.value.length + count)));
    }
    return qString(right.value.slice(Math.max(0, count)));
  }
  if (right.kind === "table") {
    const rowCount = tableRowCount(right);
    if (count < 0) {
      const end = Math.max(0, rowCount + count);
      return selectTableRows(right, Array.from({ length: end }, (_, i) => i));
    }
    const start = Math.min(rowCount, Math.max(0, count));
    return selectTableRows(right, Array.from({ length: rowCount - start }, (_, i) => start + i));
  }
  throw new QRuntimeError("type", "Drop expects a list or string on the right");
};

export const fillValue = (left: QValue, right: QValue): QValue => {
  if (left.kind === "list" && right.kind === "list") {
    if (left.items.length !== right.items.length) {
      throw new QRuntimeError("length", "Fill arguments must have the same length");
    }
    return qList(
      right.items.map((item, index) => (isNullish(item) ? left.items[index] : item)),
      right.homogeneous ?? false
    );
  }

  if (right.kind === "list") {
    return qList(
      right.items.map((item) => (isNullish(item) ? left : item)),
      right.homogeneous ?? false
    );
  }

  if (left.kind === "list") {
    throw new QRuntimeError("nyi", "Vector-left fill is not implemented");
  }

  return isNullish(right) ? left : right;
};

export const sampleSequence = (count: number, source: QValue): QValue => {
  const distinct = count < 0;
  const size = Math.abs(Math.trunc(count));

  if (source.kind === "number") {
    const limit = Math.max(0, Math.trunc(toNumber(source)));
    const pool = Array.from({ length: limit }, (_, index) => qLong(index));
    const picks = distinct
      ? shuffleItems(pool).slice(0, Math.min(size, pool.length))
      : Array.from({ length: size }, () => qLong(Math.floor(Math.random() * Math.max(limit, 1))));
    return qList(picks, true, "explicitInt");
  }

  const items = asSequenceItems(source);
  if (items.length === 0) {
    return rebuildSequence(source, []);
  }

  const picks = distinct
    ? shuffleItems(items).slice(0, Math.min(size, items.length))
    : Array.from({ length: size }, () => items[Math.floor(Math.random() * items.length)]!);
  return rebuildSequence(source, picks);
};

export const findMappedValues = (left: QList, right: QValue): QValue | null => {
  if (!left.items.every((item) => item.kind === "symbol")) {
    return null;
  }

  const rightItems = right.kind === "list" ? right.items : [right];
  if (!rightItems.every((item) => item.kind === "symbol")) {
    return null;
  }

  const keyCount = Math.floor(left.items.length / 2);
  if (keyCount < 2) {
    return null;
  }

  const values = left.items.slice(0, left.items.length - keyCount);
  const keys = left.items.slice(left.items.length - keyCount);
  const hasDefault = values.length === keys.length + 1;
  if (!hasDefault) {
    return null;
  }

  const lookup = (item: QValue) => {
    const index = keys.findIndex((candidate) => equals(candidate, item));
    if (index >= 0) {
      return values[index]!;
    }
    return hasDefault ? values.at(-1)! : qLong(keys.length);
  };

  if (right.kind === "list") {
    return qList(right.items.map(lookup), values.every((item) => item.kind === values[0]?.kind));
  }

  return lookup(right);
};

export const findValue = (left: QValue, right: QValue): QValue => {
  if (left.kind === "number") {
    return sampleSequence(left.value, right);
  }
  if (left.kind !== "list") {
    throw new QRuntimeError("type", "Find expects a list on the left");
  }

  const mapped = findMappedValues(left, right);
  if (mapped) {
    return mapped;
  }

  const lookup = (item: QValue) => {
    const index = left.items.findIndex((candidate) => equals(candidate, item));
    return qLong(index >= 0 ? index : left.items.length);
  };

  if (right.kind === "list") {
    return qList(right.items.map(lookup), true);
  }

  return lookup(right);
};

export type CastHandler = (value: QValue) => QValue;

export const castNameFromLeftOperand = (left: QValue) => {
  switch (left.kind) {
    case "symbol":
    case "string":
      return left.value;
    case "number":
      return left.numericType === "short" ? `${left.value}h` : null;
    default:
      return null;
  }
};

export const CAST_ALIAS_GROUPS: ReadonlyArray<{ aliases: readonly string[]; cast: CastHandler }> = [
  { aliases: ["", "symbol", "11h"], cast: (value) => castSymbolValue(value) },
  { aliases: ["boolean", "bool", "1h"], cast: (value) => castBooleanValue(value) },
  { aliases: ["byte", "x", "4h"], cast: (value) => castByteValue(value) },
  { aliases: ["short", "h", "5h"], cast: (value) => castShortValue(value) },
  { aliases: ["int", "i", "6h"], cast: (value) => castIntValue(value) },
  { aliases: ["long", "j", "7h"], cast: (value) => castLongValue(value) },
  { aliases: ["real", "e", "8h"], cast: (value) => castRealValue(value) },
  { aliases: ["float", "f", "9h"], cast: (value) => castFloatValue(value) },
  { aliases: ["10h", "char", "string"], cast: (value) => castCharValue(value) },
  { aliases: ["date", "14h"], cast: (value) => castDateValue(value) }
];

export const CAST_HANDLER_BY_NAME = new Map<string, CastHandler>(
  CAST_ALIAS_GROUPS.flatMap(({ aliases, cast }) => aliases.map((alias) => [alias, cast] as const))
);

export const castValue = (left: QValue, right: QValue): QValue => {
  const castName = castNameFromLeftOperand(left);
  if (castName === null) {
    throw new QRuntimeError("type", "Cast expects a symbol or string on the left");
  }

  const cast = CAST_HANDLER_BY_NAME.get(castName);
  if (!cast) {
    throw new QRuntimeError("nyi", `Cast ${castName}$ is not implemented yet`);
  }

  return cast(right);
};

export const tableColumnNames = (table: QTable) => Object.keys(table.columns);

export const tableRowAsDict = (table: QTable, rowIndex: number): QDictionary => {
  const keys: QValue[] = [];
  const values: QValue[] = [];
  for (const [name, col] of Object.entries(table.columns)) {
    keys.push(qSymbol(name));
    values.push(col.items[rowIndex] ?? qNull());
  }
  return qDictionary(keys, values);
};

export const asKeyedTable = (value: QValue): QKeyedTable => {
  if (value.kind === "keyedTable") return value;
  throw new QRuntimeError("type", "Expected keyed table");
};

export const asTable = (value: QValue): QTable => {
  if (value.kind === "table") return value;
  if (value.kind === "keyedTable") {
    return qTable({ ...value.keys.columns, ...value.values.columns });
  }
  throw new QRuntimeError("type", "Expected table");
};

export const asSymbolList = (value: QValue): string[] => {
  if (value.kind === "symbol") return [value.value];
  if (value.kind === "list" && value.items.every((i) => i.kind === "symbol")) {
    return value.items.map((i) => (i as QSymbol).value);
  }
  throw new QRuntimeError("type", "Expected symbol or symbol list");
};

export const xascValue = (cols: QValue, tableValue: QValue, ascending: boolean): QValue => {
  const table = asTable(tableValue);
  const names = asSymbolList(cols);
  const rowCount = tableRowCount(table);
  const positions = Array.from({ length: rowCount }, (_, i) => i);
  positions.sort((a, b) => {
    for (const name of names) {
      const col = table.columns[name];
      if (!col) continue;
      const diff = compare(col.items[a]!, col.items[b]!);
      if (diff !== 0) return ascending ? diff : -diff;
    }
    return 0;
  });
  return selectTableRows(table, positions);
};

export const xkeyValue = (cols: QValue, tableValue: QValue): QValue => {
  const table = asTable(tableValue);
  const keyNames = asSymbolList(cols);
  const allNames = tableColumnNames(table);
  const valNames = allNames.filter((n) => !keyNames.includes(n));
  const keys = qTable(Object.fromEntries(keyNames.map((k) => [k, table.columns[k]!])));
  const values = qTable(Object.fromEntries(valNames.map((k) => [k, table.columns[k]!])));
  return qKeyedTable(keys, values);
};

export const xgroupValue = (cols: QValue, tableValue: QValue): QValue => {
  const table = asTable(tableValue);
  const groupNames = asSymbolList(cols);
  const allNames = tableColumnNames(table);
  const dataNames = allNames.filter((n) => !groupNames.includes(n));
  const rowCount = tableRowCount(table);
  const buckets = new Map<string, { keyVals: QValue[]; positions: number[] }>();
  for (let i = 0; i < rowCount; i += 1) {
    const keyVals = groupNames.map((n) => table.columns[n]!.items[i]!);
    const keyId = keyVals.map((v) => JSON.stringify(canonicalize(v))).join("|");
    let bucket = buckets.get(keyId);
    if (!bucket) {
      bucket = { keyVals, positions: [] };
      buckets.set(keyId, bucket);
    }
    bucket.positions.push(i);
  }
  const keysCols: Record<string, QList> = {};
  groupNames.forEach((n, i) => {
    keysCols[n] = qList([...buckets.values()].map((b) => b.keyVals[i]!), true);
  });
  const valsCols: Record<string, QList> = {};
  for (const dn of dataNames) {
    const col = table.columns[dn]!;
    valsCols[dn] = qList(
      [...buckets.values()].map((b) =>
        qList(b.positions.map((p) => col.items[p]!), true)
      ),
      false
    );
  }
  return qKeyedTable(qTable(keysCols), qTable(valsCols));
};

export const ssrValue = (text: QValue, pattern: QValue, replacement: QValue): QValue => {
  if (text.kind !== "string") throw new QRuntimeError("type", "ssr expects a string");
  const pat = stringLikeValue(pattern);
  const rep = stringLikeValue(replacement);
  if (pat === null || rep === null) throw new QRuntimeError("type", "ssr pattern/replacement must be strings");
  if (pat === "") return text;
  return qString(text.value.split(pat).join(rep));
};

export const leftJoin = (left: QValue, right: QValue): QValue => {
  const lt = asTable(left);
  if (right.kind !== "keyedTable") {
    throw new QRuntimeError("type", "lj expects a keyed table on the right");
  }
  const keyNames = tableColumnNames(right.keys);
  const valNames = tableColumnNames(right.values);
  const rowCount = tableRowCount(lt);
  const resultCols: Record<string, QList> = {};
  for (const name of tableColumnNames(lt)) {
    resultCols[name] = qList([...lt.columns[name]!.items], true, lt.columns[name]!.attribute);
  }
  for (const name of valNames) {
    if (!(name in resultCols)) {
      resultCols[name] = qList(Array(rowCount).fill(qNull()), false);
    }
  }
  for (let i = 0; i < rowCount; i += 1) {
    const lookupVals = keyNames.map((n) => lt.columns[n]?.items[i] ?? qNull());
    let matchIdx = -1;
    const rightRows = tableRowCount(right.keys);
    for (let j = 0; j < rightRows; j += 1) {
      let ok = true;
      for (let k = 0; k < keyNames.length; k += 1) {
        if (!equals(lookupVals[k]!, right.keys.columns[keyNames[k]!]!.items[j]!)) {
          ok = false;
          break;
        }
      }
      if (ok) {
        matchIdx = j;
        break;
      }
    }
    if (matchIdx >= 0) {
      for (const vn of valNames) {
        const sourceCol = right.values.columns[vn]!.items;
        const targetList = resultCols[vn]!.items;
        targetList[i] = sourceCol[matchIdx]!;
      }
    }
  }
  return qTable(resultCols);
};

export const innerJoin = (left: QValue, right: QValue): QValue => {
  const lt = asTable(left);
  if (right.kind !== "keyedTable") {
    throw new QRuntimeError("type", "ij expects a keyed table on the right");
  }
  const keyNames = tableColumnNames(right.keys);
  const valNames = tableColumnNames(right.values);
  const rowCount = tableRowCount(lt);
  const leftCols: Record<string, number[]> = {};
  const resultPositions: number[] = [];
  const rightMatchPositions: number[] = [];
  for (let i = 0; i < rowCount; i += 1) {
    const lookupVals = keyNames.map((n) => lt.columns[n]?.items[i] ?? qNull());
    const rightRows = tableRowCount(right.keys);
    for (let j = 0; j < rightRows; j += 1) {
      let ok = true;
      for (let k = 0; k < keyNames.length; k += 1) {
        if (!equals(lookupVals[k]!, right.keys.columns[keyNames[k]!]!.items[j]!)) {
          ok = false;
          break;
        }
      }
      if (ok) {
        resultPositions.push(i);
        rightMatchPositions.push(j);
        break;
      }
    }
  }
  void leftCols;
  const resultCols: Record<string, QList> = {};
  for (const name of tableColumnNames(lt)) {
    resultCols[name] = qList(resultPositions.map((p) => lt.columns[name]!.items[p]!), true);
  }
  for (const name of valNames) {
    resultCols[name] = qList(rightMatchPositions.map((p) => right.values.columns[name]!.items[p]!), true);
  }
  return qTable(resultCols);
};

export const unionJoin = (left: QValue, right: QValue): QValue => {
  const lt = asTable(left);
  const rt = asTable(right);
  const allNames = Array.from(new Set([...tableColumnNames(lt), ...tableColumnNames(rt)]));
  const lRow = tableRowCount(lt);
  const rRow = tableRowCount(rt);
  const resultCols: Record<string, QList> = {};
  for (const name of allNames) {
    const leftItems = lt.columns[name]?.items ?? Array(lRow).fill(qNull());
    const rightItems = rt.columns[name]?.items ?? Array(rRow).fill(qNull());
    resultCols[name] = qList([...leftItems, ...rightItems], false);
  }
  return qTable(resultCols);
};

export const plusJoin = (left: QValue, right: QValue): QValue => {
  const lt = asTable(left);
  if (right.kind !== "keyedTable") {
    throw new QRuntimeError("type", "pj expects a keyed table on the right");
  }
  const keyNames = tableColumnNames(right.keys);
  const valNames = tableColumnNames(right.values);
  const rowCount = tableRowCount(lt);
  const resultCols: Record<string, QList> = {};
  for (const name of tableColumnNames(lt)) {
    resultCols[name] = qList([...lt.columns[name]!.items], true);
  }
  for (const name of valNames) {
    if (!(name in resultCols)) {
      resultCols[name] = qList(Array(rowCount).fill(qLong(0)), false);
    }
  }
  for (let i = 0; i < rowCount; i += 1) {
    const lookupVals = keyNames.map((n) => lt.columns[n]?.items[i] ?? qNull());
    const rightRows = tableRowCount(right.keys);
    for (let j = 0; j < rightRows; j += 1) {
      let ok = true;
      for (let k = 0; k < keyNames.length; k += 1) {
        if (!equals(lookupVals[k]!, right.keys.columns[keyNames[k]!]!.items[j]!)) {
          ok = false;
          break;
        }
      }
      if (ok) {
        for (const vn of valNames) {
          const existing = resultCols[vn]!.items[i];
          const addition = right.values.columns[vn]!.items[j]!;
          resultCols[vn]!.items[i] = existing ? add(existing, addition) : addition;
        }
        break;
      }
    }
  }
  return qTable(resultCols);
};

export const bangValue = (left: QValue, right: QValue): QValue => {
  if (left.kind === "list" && right.kind === "list") {
    return qDictionary(left.items, right.items);
  }
  if (right.kind === "table") {
    if (left.kind === "number" || left.kind === "boolean") {
      const n = Math.max(0, Math.trunc(toNumber(left)));
      const names = Object.keys(right.columns);
      const keyNames = names.slice(0, n);
      const valNames = names.slice(n);
      const keys = qTable(Object.fromEntries(keyNames.map((k) => [k, right.columns[k]!])));
      const values = qTable(Object.fromEntries(valNames.map((k) => [k, right.columns[k]!])));
      return qKeyedTable(keys, values);
    }
    if (
      left.kind === "symbol" ||
      (left.kind === "list" && left.items.every((i) => i.kind === "symbol"))
    ) {
      const keyNames =
        left.kind === "symbol" ? [left.value] : left.items.map((i) => (i as QSymbol).value);
      const names = Object.keys(right.columns);
      const valNames = names.filter((n) => !keyNames.includes(n));
      const keys = qTable(Object.fromEntries(keyNames.map((k) => [k, right.columns[k]!])));
      const values = qTable(Object.fromEntries(valNames.map((k) => [k, right.columns[k]!])));
      return qKeyedTable(keys, values);
    }
  }
  if (right.kind === "keyedTable") {
    if ((left.kind === "number" || left.kind === "boolean") && toNumber(left) === 0) {
      const merged: Record<string, QList> = {
        ...right.keys.columns,
        ...right.values.columns
      };
      return qTable(merged);
    }
  }
  throw new QRuntimeError("type", "Expected two lists for dictionary creation");
};

export const asofJoinValue = (
  cols: QValue,
  left: QValue,
  right: QValue,
  options: { useT2Time: boolean; fill: boolean }
): QValue => {
  const keyNames = asSymbolList(cols);
  if (keyNames.length === 0) {
    throw new QRuntimeError("type", "aj expects at least one key column");
  }
  const timeName = keyNames[keyNames.length - 1]!;
  const groupNames = keyNames.slice(0, -1);

  const lt = asTable(left);
  const rt = asTable(right);
  const leftRows = tableRowCount(lt);
  const rightRows = tableRowCount(rt);

  for (const name of keyNames) {
    if (!(name in lt.columns)) {
      throw new QRuntimeError("type", `aj: column ${name} missing from left table`);
    }
    if (!(name in rt.columns)) {
      throw new QRuntimeError("type", `aj: column ${name} missing from right table`);
    }
  }

  const groupKeyForRow = (table: QTable, row: number) =>
    groupNames.map((name) => table.columns[name]!.items[row]!);
  const groupKeyString = (keys: QValue[]) =>
    keys.map((key) => JSON.stringify(canonicalize(key))).join("\u0001");

  const groupedRight = new Map<string, { rowIndex: number; time: QValue }[]>();
  for (let j = 0; j < rightRows; j += 1) {
    const key = groupKeyString(groupKeyForRow(rt, j));
    const entry = groupedRight.get(key) ?? [];
    entry.push({ rowIndex: j, time: rt.columns[timeName]!.items[j]! });
    groupedRight.set(key, entry);
  }
  for (const entries of groupedRight.values()) {
    entries.sort((a, b) => compare(a.time, b.time));
  }

  const leftColumnNames = tableColumnNames(lt);
  const rightExtraColumns = tableColumnNames(rt).filter((name) => !leftColumnNames.includes(name));
  const resultColumns: Record<string, QValue[]> = {};
  for (const name of leftColumnNames) resultColumns[name] = [];
  for (const name of rightExtraColumns) resultColumns[name] = [];

  for (let i = 0; i < leftRows; i += 1) {
    const leftTime = lt.columns[timeName]!.items[i]!;
    const key = groupKeyString(groupKeyForRow(lt, i));
    const candidates = groupedRight.get(key) ?? [];
    let matched: { rowIndex: number; time: QValue } | null = null;
    for (const candidate of candidates) {
      if (compare(candidate.time, leftTime) <= 0) {
        matched = candidate;
      } else {
        break;
      }
    }

    for (const name of leftColumnNames) {
      let cell = lt.columns[name]!.items[i]!;
      if (name === timeName && options.useT2Time && matched) {
        cell = rt.columns[timeName]!.items[matched.rowIndex]!;
      } else if (matched && name !== timeName && !groupNames.includes(name) && name in rt.columns) {
        const rightCell = rt.columns[name]!.items[matched.rowIndex]!;
        if (!options.fill || !isNullish(rightCell)) {
          cell = rightCell;
        }
      }
      resultColumns[name]!.push(cell);
    }

    for (const name of rightExtraColumns) {
      resultColumns[name]!.push(matched ? rt.columns[name]!.items[matched.rowIndex]! : qNull());
    }
  }

  return qTable(
    Object.fromEntries(
      Object.entries(resultColumns).map(([name, items]) => [
        name,
        qList(items, items.every((item) => item.kind === items[0]?.kind))
      ])
    )
  );
};

export const equiJoinValue = (cols: QValue, left: QValue, right: QValue): QValue => {
  const keyNames = asSymbolList(cols);
  if (keyNames.length === 0) {
    throw new QRuntimeError("type", "ej expects at least one key column");
  }
  const lt = asTable(left);
  const rt = asTable(right);
  for (const name of keyNames) {
    if (!(name in lt.columns) || !(name in rt.columns)) {
      throw new QRuntimeError("type", `ej: column ${name} must be in both tables`);
    }
  }

  const rightRows = tableRowCount(rt);
  const rightIndex = new Map<string, number[]>();
  const keyString = (table: QTable, row: number) =>
    keyNames.map((name) => JSON.stringify(canonicalize(table.columns[name]!.items[row]!))).join("\u0001");

  for (let j = 0; j < rightRows; j += 1) {
    const key = keyString(rt, j);
    const bucket = rightIndex.get(key) ?? [];
    bucket.push(j);
    rightIndex.set(key, bucket);
  }

  const leftRows = tableRowCount(lt);
  const leftColumnNames = tableColumnNames(lt);
  const rightExtraColumns = tableColumnNames(rt).filter((name) => !leftColumnNames.includes(name));

  const outputColumns: Record<string, QValue[]> = {};
  for (const name of leftColumnNames) outputColumns[name] = [];
  for (const name of rightExtraColumns) outputColumns[name] = [];

  for (let i = 0; i < leftRows; i += 1) {
    const matches = rightIndex.get(keyString(lt, i)) ?? [];
    for (const j of matches) {
      for (const name of leftColumnNames) {
        outputColumns[name]!.push(lt.columns[name]!.items[i]!);
      }
      for (const name of rightExtraColumns) {
        outputColumns[name]!.push(rt.columns[name]!.items[j]!);
      }
    }
  }

  return qTable(
    Object.fromEntries(
      Object.entries(outputColumns).map(([name, items]) => [
        name,
        qList(items, items.every((item) => item.kind === items[0]?.kind))
      ])
    )
  );
};

export const windowJoinValue = (
  session: Session,
  windows: QValue,
  cols: QValue,
  left: QValue,
  rightSpec: QValue,
  mode: "prevailing" | "window"
): QValue => {
  if (windows.kind !== "list" || windows.items.length !== 2) {
    throw new QRuntimeError("type", "wj expects a 2-element windows list (starts;ends)");
  }
  const starts = windows.items[0]!;
  const ends = windows.items[1]!;
  if (starts.kind !== "list" || ends.kind !== "list" || starts.items.length !== ends.items.length) {
    throw new QRuntimeError("type", "wj windows must be equal-length lists");
  }

  const keyNames = asSymbolList(cols);
  if (keyNames.length === 0) {
    throw new QRuntimeError("type", "wj expects at least one key column");
  }
  const timeName = keyNames[keyNames.length - 1]!;
  const groupNames = keyNames.slice(0, -1);

  const lt = asTable(left);

  let rightTable: QTable;
  const aggSpecs: { name: string; aggregator: QValue; column: string }[] = [];

  if (rightSpec.kind === "list" && rightSpec.items.length === 2) {
    rightTable = asTable(rightSpec.items[0]!);
    const rawAggs = rightSpec.items[1]!;
    const isSinglePair =
      rawAggs.kind === "list" &&
      rawAggs.items.length === 2 &&
      (rawAggs.items[0]!.kind === "builtin" ||
        rawAggs.items[0]!.kind === "lambda" ||
        rawAggs.items[0]!.kind === "projection") &&
      rawAggs.items[1]!.kind === "symbol";
    const aggItems = isSinglePair
      ? [rawAggs]
      : rawAggs.kind === "list"
        ? rawAggs.items
        : [rawAggs];
    for (const item of aggItems) {
      if (
        item.kind === "list" &&
        item.items.length === 2 &&
        item.items[1]!.kind === "symbol"
      ) {
        const aggregator = item.items[0]!;
        const column = (item.items[1]! as QSymbol).value;
        aggSpecs.push({ name: column, aggregator, column });
      }
    }
  } else {
    rightTable = asTable(rightSpec);
  }

  const leftRows = tableRowCount(lt);
  if (starts.items.length !== leftRows) {
    throw new QRuntimeError("length", "wj windows must match the left table length");
  }

  const rightRows = tableRowCount(rightTable);
  const groupKeyForRow = (table: QTable, row: number) =>
    groupNames.map((name) => table.columns[name]!.items[row]!);
  const groupKeyString = (keys: QValue[]) =>
    keys.map((key) => JSON.stringify(canonicalize(key))).join("\u0001");

  const groupedRight = new Map<string, { rowIndex: number; time: QValue }[]>();
  for (let j = 0; j < rightRows; j += 1) {
    const key = groupKeyString(groupKeyForRow(rightTable, j));
    const entry = groupedRight.get(key) ?? [];
    entry.push({ rowIndex: j, time: rightTable.columns[timeName]!.items[j]! });
    groupedRight.set(key, entry);
  }
  for (const entries of groupedRight.values()) {
    entries.sort((a, b) => compare(a.time, b.time));
  }

  const leftColumnNames = tableColumnNames(lt);
  const rightExtraColumns = tableColumnNames(rightTable).filter(
    (name) => !leftColumnNames.includes(name)
  );
  const aggNames = aggSpecs.length > 0 ? aggSpecs.map((spec) => spec.name) : rightExtraColumns;

  const resultColumns: Record<string, QValue[]> = {};
  for (const name of leftColumnNames) resultColumns[name] = [];
  for (const name of aggNames) if (!(name in resultColumns)) resultColumns[name] = [];

  for (let i = 0; i < leftRows; i += 1) {
    for (const name of leftColumnNames) {
      resultColumns[name]!.push(lt.columns[name]!.items[i]!);
    }

    const key = groupKeyString(groupKeyForRow(lt, i));
    const candidates = groupedRight.get(key) ?? [];
    const startTime = starts.items[i]!;
    const endTime = ends.items[i]!;

    const rowsInWindow: number[] = [];
    let prevailing: number | null = null;
    for (const candidate of candidates) {
      if (compare(candidate.time, startTime) < 0) {
        prevailing = candidate.rowIndex;
      } else if (compare(candidate.time, endTime) <= 0) {
        rowsInWindow.push(candidate.rowIndex);
      } else {
        break;
      }
    }

    const positions =
      mode === "prevailing" && prevailing !== null
        ? [prevailing, ...rowsInWindow]
        : rowsInWindow;

    if (aggSpecs.length === 0) {
      for (const name of aggNames) {
        const matchedItems = positions.map((p) => rightTable.columns[name]!.items[p]!);
        resultColumns[name]!.push(qList(matchedItems, matchedItems.every((item) => item.kind === matchedItems[0]?.kind)));
      }
      continue;
    }

    for (const spec of aggSpecs) {
      const items = positions.map((p) => rightTable.columns[spec.column]!.items[p]!);
      const arg = qList(items, items.every((item) => item.kind === items[0]?.kind));
      try {
        if (
          spec.aggregator.kind === "builtin" ||
          spec.aggregator.kind === "lambda" ||
          spec.aggregator.kind === "projection"
        ) {
          resultColumns[spec.name]!.push(session.invoke(spec.aggregator, [arg]));
        } else {
          resultColumns[spec.name]!.push(qNull());
        }
      } catch {
        resultColumns[spec.name]!.push(qNull());
      }
    }
  }

  return qTable(
    Object.fromEntries(
      Object.entries(resultColumns).map(([name, items]) => [
        name,
        qList(items, items.every((item) => item.kind === items[0]?.kind))
      ])
    )
  );
};

export const asofValue = (left: QValue, right: QValue): QValue => {
  // Simple asof: returns last row of left where key <= right's key
  if (left.kind !== "table" && left.kind !== "keyedTable") {
    throw new QRuntimeError("type", "asof expects a table on the left");
  }
  const lt = asTable(left);
  const names = tableColumnNames(lt);
  if (names.length === 0) throw new QRuntimeError("type", "asof left has no columns");
  const keyName = names[0]!;
  const keyCol = lt.columns[keyName]!;
  const target = right.kind === "dictionary" ? right.values[0]! : right;
  let bestIdx = -1;
  for (let i = 0; i < keyCol.items.length; i += 1) {
    if (compare(keyCol.items[i]!, target) <= 0) bestIdx = i;
  }
  if (bestIdx < 0) return qNull();
  return tableRowAsDict(lt, bestIdx);
};

export const xbarValue = (left: QValue, right: QValue): QValue =>
  mapBinary(left, right, (step, value) => {
    const interval = toNumber(step);
    if (interval === 0) {
      throw new QRuntimeError("domain", "xbar expects a non-zero interval");
    }
    return numeric(Math.floor(toNumber(value) / interval) * interval, !Number.isInteger(interval));
  });

export const castSymbolValue = (value: QValue): QValue => {
  if (value.kind === "temporal") {
    return qSymbol(value.value);
  }
  if (value.kind === "string") {
    return qSymbol(value.value);
  }
  if (value.kind === "symbol") {
    return value;
  }
  if (value.kind === "list") {
    return qList(value.items.map(castSymbolAtom), true);
  }
  throw new QRuntimeError("type", "symbol$ expects strings or symbols");
};

export const castSymbolAtom = (value: QValue): QValue => {
  if (value.kind === "temporal") {
    return qSymbol(value.value);
  }
  if (value.kind === "string") {
    return qSymbol(value.value);
  }
  if (value.kind === "symbol") {
    return value;
  }
  throw new QRuntimeError("type", "symbol$ expects strings or symbols");
};

export const castBooleanValue = (value: QValue): QValue => {
  if (value.kind === "list" && value.items.some((item) => item.kind === "list")) {
    return qList(
      value.items.map((item) => (item.kind === "list" ? castBooleanValue(item) : castBooleanAtom(item))),
      true
    );
  }
  if (value.kind === "list") {
    return qList(value.items.map(castBooleanAtom), true);
  }
  return castBooleanAtom(value);
};

export const castBooleanAtom = (value: QValue): QValue => {
  if (value.kind === "null") {
    return qBool(false);
  }
  if (value.kind === "boolean") {
    return value;
  }
  if (value.kind === "number") {
    if (value.special === "null" || value.special === "intNull") {
      return qBool(false);
    }
    return qBool(value.value !== 0);
  }
  throw new QRuntimeError("type", "boolean$ expects boolean or numeric values");
};

export const castByteValue = (value: QValue): QValue => {
  if (value.kind === "string") {
    return byteListFromText(value.value);
  }
  if (value.kind === "list") {
    return qList(
      value.items.map((item) => (item.kind === "list" ? castByteValue(item) : castByteAtom(item))),
      true,
      "byte"
    );
  }
  return qList([castByteAtom(value)], true, "byte");
};

export const castByteAtom = (value: QValue): QValue => {
  if (value.kind === "number" || value.kind === "boolean") {
    const n = Math.trunc(toNumber(value));
    return qLong(((n % 256) + 256) % 256);
  }
  if (value.kind === "string" && value.value.length === 1) {
    return qLong(value.value.codePointAt(0) ?? 0);
  }
  throw new QRuntimeError("type", "byte$ expects numeric, boolean, char, or string values");
};

export const castShortValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList(
      value.items.map((item) => (item.kind === "list" ? castShortValue(item) : castShortAtom(item))),
      true
    );
  }
  return castShortAtom(value);
};

export const castShortAtom = (value: QValue): QValue => {
  if (value.kind === "null") {
    return qShort(0);
  }
  if (value.kind === "number") {
    if (value.special === "null" || value.special === "intNull") {
      return qShort(0);
    }
    return qShort(Math.trunc(value.value));
  }
  if (value.kind === "boolean") {
    return qShort(value.value ? 1 : 0);
  }
  throw new QRuntimeError("type", "short$ expects numeric values");
};

export const castCharValue = (value: QValue): QValue => {
  if (value.kind === "null") {
    return qString("");
  }
  if (value.kind === "symbol" || value.kind === "temporal") {
    return qString(value.value);
  }
  if (value.kind === "number") {
    return qString(String.fromCharCode(Math.max(0, Math.trunc(toNumber(value)))));
  }
  if (value.kind === "boolean") {
    return qString(value.value ? "1" : "0");
  }
  if (value.kind === "string") {
    return value;
  }
  if (value.kind === "list" && value.items.every((item) => item.kind === "string")) {
    return qString(
      value.items
        .map((item) => (item.kind === "string" ? item.value : ""))
        .join("")
    );
  }
  if (value.kind === "list" && value.items.every((item) => item.kind === "number")) {
    return qString(
      value.items
        .map((item) => String.fromCharCode(Math.max(0, Math.trunc(toNumber(item)))))
        .join("")
    );
  }
  throw new QRuntimeError("type", "10h$ expects a string or byte-like list");
};

export const stringAtomValue = (value: QValue): QString => {
  if (value.kind === "symbol" || value.kind === "temporal") {
    return qString(value.value);
  }
  return qString(formatValue(value, { trailingNewline: false }));
};

export const stringValue = (value: QValue): QValue => {
  if (value.kind === "string") {
    return qList([...value.value].map((char) => qString(char)), false);
  }
  if (value.kind === "list") {
    return qList(
      value.items.map((item) => (item.kind === "string" ? stringValue(item) : stringAtomValue(item))),
      false
    );
  }
  return stringAtomValue(value);
};

export const castIntValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList(
      value.items.map((item) => (item.kind === "list" ? castIntValue(item) : castIntAtom(item))),
      true,
      "int"
    );
  }
  if (value.kind === "string") {
    return qList([...value.value].map((c) => qInt(c.charCodeAt(0))), true, "int");
  }
  return castIntAtom(value);
};

export const castLongAtom = (value: QValue): QValue => {
  if (value.kind === "number") {
    if (isNumericNull(value)) return qLong(0, "longNull");
    return qLong(Math.trunc(value.value));
  }
  if (value.kind === "temporal" && value.temporalType === "date") {
    if (value.value === "0Nd") return qLong(0, "longNull");
    return qLong(parseQDateDays(value.value));
  }
  if (value.kind === "boolean") return qLong(value.value ? 1 : 0);
  if (value.kind === "null") return qLong(0, "longNull");
  if (value.kind === "string" && value.value.length === 1) {
    return qLong(value.value.charCodeAt(0));
  }
  throw new QRuntimeError("type", "long$ expects numeric values");
};

export const castLongValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList(
      value.items.map((item) => (item.kind === "list" ? castLongValue(item) : castLongAtom(item))),
      true,
      "long"
    );
  }
  if (value.kind === "string") {
    return qList([...value.value].map((c) => qLong(c.charCodeAt(0))), true, "long");
  }
  return castLongAtom(value);
};

export const castRealAtom = (value: QValue): QValue => {
  if (value.kind === "number") {
    if (value.special === "null" || isNumericNull(value)) return qReal(0, "realNull");
    return qReal(value.value);
  }
  if (value.kind === "boolean") return qReal(value.value ? 1 : 0);
  if (value.kind === "null") return qReal(0, "realNull");
  throw new QRuntimeError("type", "real$ expects numeric values");
};

export const castRealValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList(
      value.items.map((item) => (item.kind === "list" ? castRealValue(item) : castRealAtom(item))),
      true,
      "real"
    );
  }
  return castRealAtom(value);
};

export const castIntAtom = (value: QValue): QValue => {
  if (value.kind === "number") {
    if (isNumericNull(value)) return qInt(0, "intNull");
    return qInt(Math.trunc(value.value));
  }
  if (value.kind === "temporal" && value.temporalType === "date") {
    if (value.value === "0Nd") return qInt(0, "intNull");
    return qInt(parseQDateDays(value.value));
  }
  if (value.kind === "boolean") return qInt(value.value ? 1 : 0);
  if (value.kind === "null") return qInt(0, "intNull");
  if (value.kind === "string") {
    // "i"$"abc" → char codes
    if (value.value.length === 1) return qInt(value.value.charCodeAt(0));
  }
  throw new QRuntimeError("type", "int$ expects numeric values");
};

export const castFloatValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList(
      value.items.map((item) => (item.kind === "list" ? castFloatValue(item) : castFloatAtom(item))),
      true
    );
  }
  return castFloatAtom(value);
};

export const castFloatAtom = (value: QValue): QValue => {
  if (value.kind === "null") {
    return qFloat(Number.NaN, "null");
  }
  if (value.kind === "number") {
    if (value.special === "null" || value.special === "intNull") {
      return qFloat(Number.NaN, "null");
    }
    if (value.special === "intPosInf" || value.special === "posInf") {
      return qFloat(Number.POSITIVE_INFINITY, "posInf");
    }
    if (value.special === "intNegInf" || value.special === "negInf") {
      return qFloat(Number.NEGATIVE_INFINITY, "negInf");
    }
    return qFloat(value.value);
  }
  if (value.kind === "boolean") {
    return qFloat(value.value ? 1 : 0);
  }
  throw new QRuntimeError("type", "float$ expects numeric values");
};

export const castDateValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList(value.items.map(castDateAtom), true);
  }
  return castDateAtom(value);
};

export const castDateAtom = (value: QValue): QValue => {
  if (value.kind === "null") {
    return qDate("0Nd");
  }
  if (value.kind === "temporal" && value.temporalType === "date") {
    return value;
  }
  if ((value.kind === "string" || value.kind === "symbol") && isDateLiteral(value.value)) {
    return qDate(value.value);
  }
  if (value.kind === "number") {
    if (isNumericNull(value)) return qDate("0Nd");
    return qDate(formatQDateFromDays(Math.trunc(value.value)));
  }
  if (value.kind === "boolean") {
    return qDate(formatQDateFromDays(value.value ? 1 : 0));
  }
  throw new QRuntimeError("type", "date$ expects date strings or dates");
};

export const isDateLiteral = (value: string) => /^\d{4}\.\d{2}\.\d{2}$|^0Nd$/.test(value);

export const Q_DATE_EPOCH_MS = Date.UTC(2000, 0, 1);

export const parseQDateDays = (value: string) => {
  const [yearText, monthText, dayText] = value.split(".");
  const year = Number.parseInt(yearText ?? "", 10);
  const month = Number.parseInt(monthText ?? "", 10);
  const day = Number.parseInt(dayText ?? "", 10);
  const utcMs = Date.UTC(year, month - 1, day);
  return Math.round((utcMs - Q_DATE_EPOCH_MS) / 86400000);
};

export const formatQDateFromDays = (days: number) => {
  const date = new Date(Q_DATE_EPOCH_MS + days * 86400000);
  return date.toISOString().slice(0, 10).replace(/-/g, ".");
};

export const buildTable = (columns: { name: string; value: QValue }[]): QTable => {
  const listCounts = columns.flatMap((column) =>
    column.value.kind === "list" ? [column.value.items.length] : []
  );
  const counts = [...new Set(listCounts)];
  if (counts.length > 1) {
    throw new QRuntimeError("length", "Table columns must have the same length");
  }

  const rowCount = counts[0] ?? 1;
  const entries = columns.map(({ name, value }) => {
    if (value.kind === "list") {
      return [name, value] as const;
    }

    return [
      name,
      qList(Array.from({ length: rowCount }, () => value), true)
    ] as const;
  });

  return qTable(Object.fromEntries(entries));
};

export const tableRowCount = (table: QTable) => Object.values(table.columns)[0]?.items.length ?? 0;

export const selectColumnRows = (column: QList, positions: number[]) =>
  qList(
    positions.map((position) => column.items[position] ?? nullLike(column.items[0])),
    column.homogeneous ?? false
  );

export const selectTableRows = (table: QTable, positions: number[]) =>
  qTable(
    Object.fromEntries(
      Object.entries(table.columns).map(([name, column]) => [
        name,
        selectColumnRows(column, positions)
      ])
    )
  );

export const materializeTableColumn = (value: QValue, rowCount: number): QList => {
  if (value.kind === "list") {
    if (value.items.length !== rowCount) {
      throw new QRuntimeError("length", "Column length must match table rows");
    }
    return value;
  }
  return qList(Array.from({ length: rowCount }, () => value), true);
};

export const requireUnaryIndex = (args: QValue[], message: string) => {
  if (args.length !== 1) {
    throw new QRuntimeError("rank", message);
  }
  return args[0]!;
};

export const collectNumericPositions = (index: QValue, message: string) => {
  if (index.kind !== "list") {
    throw new QRuntimeError("type", message);
  }

  return index.items.map((item) => {
    if (item.kind !== "number") {
      throw new QRuntimeError("type", message);
    }
    return item.value;
  });
};

export const tableColumnByName = (table: QTable, name: string) => {
  const column = table.columns[name];
  if (!column) {
    throw new QRuntimeError("name", `Unknown column: ${name}`);
  }
  return column;
};

export const applyListIndex = (list: QList, args: QValue[]) => {
  if (args.length === 1) {
    return indexList(list, args[0]!);
  }
  if (args.length === 2) {
    return indexNestedRows(list, args);
  }
  throw new QRuntimeError("rank", "List indexing expects one or two arguments");
};

export const applyStringIndex = (text: QString, args: QValue[]) =>
  indexString(text, requireUnaryIndex(args, "String indexing expects one argument"));

export const applyDictionaryIndex = (dictionary: QDictionary, args: QValue[]) =>
  indexDictionary(dictionary, requireUnaryIndex(args, "Dictionary indexing expects one argument"));

export const applyValue = (value: QValue, args: QValue[]): QValue => {
  switch (value.kind) {
    case "list":
      return applyListIndex(value, args);
    case "string":
      return applyStringIndex(value, args);
    case "dictionary":
      return applyDictionaryIndex(value, args);
    case "table":
      return indexTable(value, args);
    case "keyedTable":
      return indexKeyedTable(value, args);
    default:
      throw new QRuntimeError("type", "Value is not callable");
  }
};

export const indexList = (list: QList, index: QValue): QValue => {
  if (index.kind === "number") {
    return list.items[index.value] ?? nullLike(list.items[0]);
  }
  if (index.kind === "list") {
    return qList(index.items.map((item) => indexList(list, item)), list.homogeneous ?? false);
  }
  throw new QRuntimeError("type", "List index must be numeric");
};

export const indexString = (text: QString, index: QValue): QValue => {
  if (index.kind === "number") {
    return qString(text.value[index.value] ?? "");
  }
  if (index.kind === "list") {
    return qString(
      index.items
        .map((item) => {
          const result = indexString(text, item);
          return result.kind === "string" ? result.value : "";
        })
        .join("")
    );
  }
  throw new QRuntimeError("type", "String index must be numeric");
};

export const indexNestedRows = (list: QList, args: QValue[]): QValue => {
  const [rowSelector, columnSelector] = args;
  const rows = rowSelector.kind === "null" ? list : indexList(list, rowSelector);

  if (columnSelector.kind === "null") {
    return rows;
  }

  const project = (row: QValue) => {
    if (row.kind === "list") {
      return indexList(row, columnSelector);
    }
    if (row.kind === "string") {
      return indexString(row, columnSelector);
    }
    throw new QRuntimeError("type", "Nested index expects row vectors");
  };

  // Only iterate when the row selector itself is a list/vector (rank-2 slice)
  if (rowSelector.kind === "list" && rows.kind === "list") {
    return qList(rows.items.map(project), false);
  }

  return project(rows);
};

export const indexDictionary = (dictionary: QDictionary, index: QValue): QValue => {
  const lookup = (key: QValue) => {
    const position = dictionary.keys.findIndex((candidate) => equals(candidate, key));
    return position >= 0 ? dictionary.values[position] : nullLike(dictionary.values[0]);
  };

  if (index.kind === "list") {
    return qList(index.items.map(lookup), dictionary.values.every((value) => value.kind === dictionary.values[0]?.kind));
  }

  return lookup(index);
};

export const isSymbolList = (value: QValue) =>
  value.kind === "list" && value.items.every((item) => item.kind === "symbol");

export const selectTableByUnaryIndex = (table: QTable, index: QValue): QValue => {
  if (index.kind === "symbol") {
    return tableColumnByName(table, index.value);
  }

  if (isSymbolList(index)) {
    return selectTableColumns(table, index);
  }

  if (index.kind === "number") {
    return rowFromTable(table, index.value);
  }

  if (index.kind === "list") {
    return selectTableRows(table, collectNumericPositions(index, "Table row index must be numeric"));
  }

  throw new QRuntimeError("type", "Unsupported table index");
};

export const projectTableSelection = (selection: QValue, columnSelector: QValue) => {
  if (columnSelector.kind === "null") {
    return selection;
  }

  if (selection.kind === "table") {
    return selectTableColumns(selection, columnSelector);
  }

  if (selection.kind === "dictionary") {
    return indexDictionary(selection, columnSelector);
  }

  throw new QRuntimeError("type", "Unexpected intermediate table selection result");
};

export const indexTable = (table: QTable, args: QValue[]): QValue => {
  if (args.length === 2) {
    const [rowSelector, columnSelector] = args;
    const rows = rowSelector.kind === "null" ? table : selectTableByUnaryIndex(table, rowSelector);
    return projectTableSelection(rows, columnSelector);
  }

  const index = requireUnaryIndex(args, "Table indexing expects one or two arguments");
  return selectTableByUnaryIndex(table, index);
};

export const rowFromTable = (table: QTable, position: number): QDictionary =>
  qDictionary(
    Object.keys(table.columns).map((name) => qSymbol(name)),
    Object.values(table.columns).map((column) => column.items[position] ?? nullLike(column.items[0]))
  );

export const indexKeyedTable = (table: QKeyedTable, args: QValue[]): QValue => {
  if (args.length !== 1) {
    throw new QRuntimeError("rank", "Keyed table indexing expects one argument");
  }

  const keyNames = Object.keys(table.keys.columns);
  const keyColumns = keyNames.map((name) => table.keys.columns[name]!);
  const lookupTuple = (key: QValue) => {
    const values =
      keyColumns.length === 1
        ? [key]
        : key.kind === "list" && key.items.length === keyColumns.length && key.items.every((item) => item.kind !== "list")
          ? key.items
          : null;
    if (!values) {
      throw new QRuntimeError("type", "Keyed table lookup expects a key tuple");
    }

    const position = keyColumns[0]!.items.findIndex((_, rowIndex) =>
      values.every((value, index) => equals(keyColumns[index]!.items[rowIndex]!, value))
    );
    if (position < 0) {
      return rowFromTable(table.values, -1);
    }
    return rowFromTable(table.values, position);
  };

  const [index] = args;
  if (keyColumns.length === 1 && index.kind === "list") {
    return qList(index.items.map(lookupTuple), false);
  }
  if (keyColumns.length > 1 && index.kind === "list" && index.items.every((item) => item.kind === "list")) {
    return qList(index.items.map(lookupTuple), false);
  }
  return lookupTuple(index);
};

export const nullLike = (sample?: QValue): QValue => {
  if (!sample) {
    return qNull();
  }

  switch (sample.kind) {
    case "number":
      return nullForType(sample.numericType);
    case "string":
      return qString(" ");
    case "temporal":
      return qTemporal(sample.temporalType, temporalNullForType(sample.temporalType));
    case "symbol":
      return qSymbol("");
    case "boolean":
      return qBool(false);
    case "list":
      return qList([]);
    default:
      return qNull();
  }
};

export const temporalNullForType = (t: TemporalType): string => {
  switch (t) {
    case "date":
      return "0Nd";
    case "month":
      return "0Nm";
    case "minute":
      return "0Nu";
    case "second":
      return "0Nv";
    case "time":
      return "0Nt";
    case "timespan":
      return "0Nn";
    default:
      return "0N";
  }
};

export const isNullish = (value: QValue) =>
  value.kind === "null" ||
  (value.kind === "symbol" && value.value === "") ||
  (value.kind === "number" &&
    (value.special === "null" ||
      value.special === "intNull" ||
      value.special === "longNull" ||
      value.special === "shortNull" ||
      value.special === "realNull")) ||
  (value.kind === "temporal" && value.value.includes("0N"));

export const selectTableColumns = (table: QTable, selector: QValue): QValue => {
  if (selector.kind === "symbol") {
    const column = table.columns[selector.value];
    if (!column) {
      throw new QRuntimeError("name", `Unknown column: ${selector.value}`);
    }
    return column;
  }

  if (selector.kind === "list" && selector.items.every((item) => item.kind === "symbol")) {
    const selected: Record<string, QList> = {};
    for (const item of selector.items) {
      const symbol = item as QSymbol;
      const column = table.columns[symbol.value];
      if (!column) {
        throw new QRuntimeError("name", `Unknown column: ${symbol.value}`);
      }
      selected[symbol.value] = column;
    }
    return qTable(selected);
  }

  throw new QRuntimeError("type", "Table column selector must be a symbol or symbol list");
};

export const formatBare = (value: QValue): string => {
  switch (value.kind) {
    case "null":
      return "::";
    case "boolean":
      return value.value ? "1b" : "0b";
    case "number":
      if (value.special === "longNull") return "0N";
      if (value.special === "longPosInf") return "0W";
      if (value.special === "longNegInf") return "-0W";
      if (value.special === "intNull") return "0Ni";
      if (value.special === "intPosInf") return "0Wi";
      if (value.special === "intNegInf") return "-0Wi";
      if (value.special === "shortNull") return "0Nh";
      if (value.special === "shortPosInf") return "0Wh";
      if (value.special === "shortNegInf") return "-0Wh";
      if (value.special === "realNull") return "0Ne";
      if (value.special === "realPosInf") return "0We";
      if (value.special === "realNegInf") return "-0We";
      if (value.special === "null") return "0n";
      if (value.special === "posInf") return "0w";
      if (value.special === "negInf") return "-0w";
      if (value.numericType === "short") return `${value.value}h`;
      if (value.numericType === "int") return `${value.value}i`;
      if (value.numericType === "real") return `${formatFloat(value.value).replace(/f$/, "")}e`;
      if (value.numericType === "float") {
        return formatFloat(value.value);
      }
      return `${value.value}`;
    case "string":
      return JSON.stringify(value.value);
    case "symbol":
      return `\`${value.value}`;
    case "temporal":
      return value.value;
    case "list":
      if (value.attribute === "byte" && value.items.every((item) => item.kind === "number")) {
        return `0x${value.items
          .map((item) => Math.max(0, Math.min(255, Math.trunc(toNumber(item)))))
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("")}`;
      }
      if (value.items.length === 0) {
        return "()";
      }
      if (value.items.length === 1 && value.attribute !== "namespaceKeys") {
        return `,${formatBare(value.items[0])}`;
      }
      if (value.items.every((item) => item.kind === "number")) {
        const nums = value.items as QNumber[];
        const types = new Set(nums.map((n) => n.numericType));
        const suffixMap: Record<string, string> = {
          short: "h",
          int: "i",
          long: "",
          real: "e",
          float: "f"
        };
        if (types.size === 1) {
          const only = [...types][0]!;
          const suffix = suffixMap[only] ?? "";
          const body = nums.map((n) => formatListNumber(n)).join(" ");
          if (!suffix) {
            return body;
          }
          if (only === "float") {
            // Only add trailing `f` if every value is an integer (no decimal in output)
            const anyDecimal = body.includes(".") || body.toLowerCase().includes("e");
            return anyDecimal ? body : `${body}f`;
          }
          if (only === "real") {
            const anyDecimal = body.includes(".") || body.toLowerCase().includes("e");
            return anyDecimal ? `${body}e` : `${body}e`;
          }
          return `${body}${suffix}`;
        }
        // Mixed — promote to float-style display
        return nums.map((n) => formatListNumber(n)).join(" ");
      }
      if (value.items.every((item) => item.kind === "boolean")) {
        return `${value.items.map((item) => (item.kind === "boolean" && item.value ? "1" : "0")).join("")}b`;
      }
      if (value.items.every((item) => item.kind === "symbol")) {
        if (value.attribute === "namespaceKeys") {
          return `\`\`${value.items
            .map((item) => (item.kind === "symbol" ? item.value : ""))
            .join("`")}`;
        }
        return value.items.map((item) => formatBare(item)).join("");
      }
      if (value.items.every((item) => item.kind === "string")) {
        return value.items
          .map((item) => (item.kind === "string" && item.value.length === 1 ? `,${formatBare(item)}` : formatBare(item)))
          .join("\n");
      }
      if (value.items.every((item) => item.kind === "list" || item.kind === "string")) {
        return value.items.map((item) => formatBare(item)).join("\n");
      }
      if (
        value.items.some(
          (item) =>
            item.kind === "list" ||
            item.kind === "string" ||
            item.kind === "dictionary" ||
            item.kind === "table" ||
            item.kind === "keyedTable"
        )
      ) {
        return value.items.map(formatBare).join("\n");
      }
      return value.items.map(formatBare).join(" ");
    case "dictionary":
      return formatDictionary(value);
    case "table":
      return formatTable(value);
    case "keyedTable":
      return formatKeyedTable(value);
    case "lambda":
      return value.source;
    case "projection":
      return `${formatBare(value.target)}[${value.args
        .map((arg) => (arg ? formatBare(arg) : ""))
        .join(";")}]`;
    case "builtin":
      return value.name;
    case "namespace":
      return value.name;
    case "error":
      return `'${value.name}: ${value.message}`;
  }
  throw new QRuntimeError("nyi", "Unhandled value kind during formatting");
};

export const trimFloat = (value: number) => {
  const text = value.toString();
  return text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text;
};

export const formatFloat = (value: number) => {
  const useScientific = Number.isFinite(value) && value !== 0 && Math.abs(value) >= 1e12;
  const text = useScientific
    ? value.toExponential(6)
    : Number.isInteger(value)
      ? `${value}`
      : value.toPrecision(7);
  const normalized = text.includes("e") || text.includes("E")
    ? text
        .replace(/(\.\d*?[1-9])0+(e.*)$/i, "$1$2")
        .replace(/\.0+(e.*)$/i, "$1")
        .replace(/\.e/i, "e")
    : text.includes(".")
      ? text.replace(/0+$/, "").replace(/\.$/, "")
      : text;

  return Number.isInteger(value) && !useScientific ? `${normalized}f` : normalized;
};

// Format a numeric list item without trailing type suffix — the outer list formatter
// emits a single trailing suffix (h/i/e/f) after joining.
export const formatListNumber = (value: QValue) => {
  if (value.kind !== "number") {
    return formatBare(value);
  }
  if (
    value.special === "longNull" ||
    value.special === "intNull" ||
    value.special === "shortNull"
  )
    return "0N";
  if (
    value.special === "longPosInf" ||
    value.special === "intPosInf" ||
    value.special === "shortPosInf"
  )
    return "0W";
  if (
    value.special === "longNegInf" ||
    value.special === "intNegInf" ||
    value.special === "shortNegInf"
  )
    return "-0W";
  if (value.special === "realNull" || value.special === "null") return "0n";
  if (value.special === "realPosInf" || value.special === "posInf") return "0w";
  if (value.special === "realNegInf" || value.special === "negInf") return "-0w";
  if (value.numericType === "float" || value.numericType === "real") {
    return formatFloat(value.value).replace(/f$/, "");
  }
  return `${value.value}`;
};

export const formatTable = (table: QTable) => {
  const layout = layoutTable(table);
  return [layout.header, layout.divider, ...layout.rows].join("\n");
};

export const layoutTable = (table: QTable) => {
  const names = Object.keys(table.columns);
  if (names.length === 0) {
    return { header: "+", divider: "", rows: [] as string[] };
  }

  const rowCount = countValue(table);
  const cellsByColumn = names.map((name) =>
    Array.from({ length: rowCount }, (_, rowIndex) =>
      formatTableCell(table.columns[name].items[rowIndex] ?? nullLike(table.columns[name].items[0]))
    )
  );
  const widths = names.map((name, index) =>
    Math.max(name.length, ...cellsByColumn[index].map((cell) => cell.length))
  );
  const padRow = (cells: string[]) =>
    cells.map((cell, index) => cell.padEnd(widths[index])).join(" ").trimEnd();
  const rows = Array.from({ length: rowCount }, (_, rowIndex) =>
    padRow(names.map((_, columnIndex) => cellsByColumn[columnIndex][rowIndex]))
  );
  const allNamesBlank = names.every((name) => name.length === 0);
  const header = allNamesBlank ? widths.map((width) => " ".repeat(width)).join(" ") : padRow(names);
  const divider = allNamesBlank ? widths.map((width) => "-".repeat(width)).join(" ") : "-".repeat(header.length);
  return { header, divider, rows };
};

export const formatKeyedTable = (table: QKeyedTable) => {
  const keys = layoutTable(table.keys);
  const values = layoutTable(table.values);
  const header = `${keys.header}| ${values.header}`;
  const divider = `${keys.divider}| ${values.divider}`;
  const rowCount = Math.max(keys.rows.length, values.rows.length);
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const left = keys.rows[index] ?? "";
    const right = values.rows[index] ?? "";
    return `${left.padEnd(keys.header.length)}| ${right}`.trimEnd();
  });
  return [header, divider, ...rows].join("\n");
};

export const formatTableCell = (value: QValue) => {
  if (isNullish(value)) {
    return "";
  }
  if (value.kind === "symbol") {
    return value.value;
  }
  if (value.kind === "string" && value.value.length === 1) {
    return value.value;
  }
  return formatBare(value);
};

export const formatDictionary = (dictionary: QDictionary) => {
  const keys = dictionary.keys.map((key) =>
    key.kind === "symbol" ? key.value : formatBare(key)
  );
  const width = Math.max(0, ...keys.map((key) => key.length));
  const typedSymbols = dictionary.values.every((value) => value.kind === "symbol");
  return keys
    .map(
      (key, index) => {
        const value = dictionary.values[index] ?? qNull();
        const rendered =
          value.kind === "null"
            ? ""
            : typedSymbols
              ? formatTableCell(value)
              : formatBare(value);
        return `${key.padEnd(width)}| ${rendered}`;
      }
    )
    .join("\n");
};
