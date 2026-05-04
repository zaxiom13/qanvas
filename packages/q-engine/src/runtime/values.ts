import { canonicalize, isTruthy, qBool, qDate, qDictionary, qError, qFloat, qInt, qKeyedTable, qList, qLong, qNull, qProjection, qReal, qShort, qString, qSymbol, qTable, type QDictionary, type QError, type QKeyedTable, type QList, type QNumber, type QString, type QSymbol, type QTable, type QValue } from "@qpad/core";
import { CX_USAGE, Q_INT_MAX, Q_LONG_MAX, Q_RESERVED_SET, Q_SHORT_MAX, type AstNode, type LambdaValue, type StoredFileFormat, type TemporalType, QRuntimeError } from "./types.js";
import type { Session } from "./session.js";
import { tryPrimitiveEachPair, tryPrimitiveOver, tryPrimitiveScan } from "./kernel.js";

export const formatValue = (value: QValue, options: { trailingNewline?: boolean } = { trailingNewline: true }): string => {
  const text = formatBare(value);
  return options.trailingNewline === false ? text : `${text}\n`;
};

const formatNestedListItem = (value: QValue, options: { symbolsAsColumns?: boolean } = {}): string => {
  if (value.kind === "list" && value.attribute === "tokTuple") {
    return `(${value.items.map(formatBare).join(";")})`;
  }
  if (
    value.kind === "list" &&
    value.items.length > 0 &&
    value.items.every((item) => item.kind === "temporal")
  ) {
    const temporalItems = value.items.filter((item): item is Extract<QValue, { kind: "temporal" }> => item.kind === "temporal");
    if (new Set(temporalItems.map((item) => item.temporalType)).size > 1) {
      return `(${temporalItems.map((item) => item.value).join(";")})`;
    }
  }
  if (options.symbolsAsColumns && value.kind === "list" && value.items.every((item) => item.kind === "symbol")) {
    return value.items.map((item) => (item.kind === "symbol" ? item.value : "")).join(" ");
  }
  return formatBare(value);
};

const Q_LONG_MAX_BIGINT = 9223372036854775807n;

const qLongExact = (exact: bigint): QNumber => ({
  kind: "number",
  value: Number(exact),
  numericType: "long",
  exactText: exact.toString()
});

export const displayWithoutFloatSuffix = (value: QValue): QValue => {
  if (
    value.kind === "number" &&
    (value.numericType === "float" || value.numericType === "real") &&
    !value.special &&
    Number.isInteger(value.value)
  ) {
    return { ...value, exactText: formatListNumber(value) };
  }
  if (value.kind === "list") {
    return qList(
      value.items.map(displayWithoutFloatSuffix),
      value.homogeneous ?? false,
      value.attribute
    );
  }
  return value;
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
  const type = ra >= rb ? a : b;
  return type === "short" ? "int" : type;
};

export const numericOf = (value: number, type: string): QNumber => {
  if (type === "float" || !Number.isInteger(value)) {
    if (value === Number.POSITIVE_INFINITY) return qFloat(value, "posInf");
    if (value === Number.NEGATIVE_INFINITY) return qFloat(value, "negInf");
    return qFloat(value);
  }
  switch (type) {
    case "short":
      return qShort(value);
    case "int":
      if (value === Q_INT_MAX) return qInt(value, "intPosInf");
      if (value === -Q_INT_MAX) return qInt(value, "intNegInf");
      if (value > Q_INT_MAX || value < -Q_INT_MAX) return qInt(0, "intNull");
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

const numericDelta = (value: QValue): number | null => {
  if (value.kind === "boolean") return value.value ? 1 : 0;
  if (value.kind !== "number" || value.numericType !== "long" || value.special) return null;
  return value.value;
};

const longInfinityBoundaryResult = (a: QValue, b: QValue, sign: 1 | -1): QValue | null => {
  const leftSpecial = a.kind === "number" && a.numericType === "long" ? a.special : undefined;
  const rightSpecial = b.kind === "number" && b.numericType === "long" ? b.special : undefined;
  const rightDelta = numericDelta(b);
  const leftDelta = numericDelta(a);

  if (leftSpecial === "longPosInf" && rightDelta !== null) {
    const signedDelta = sign * rightDelta;
    if (signedDelta === 0) return qLong(Q_LONG_MAX, "longPosInf");
    if (signedDelta > 0) return qLong(0, "longNull");
    return qLongExact(Q_LONG_MAX_BIGINT + BigInt(signedDelta));
  }
  if (leftSpecial === "longNegInf" && rightDelta !== null) {
    const signedDelta = sign * rightDelta;
    if (signedDelta === 0) return qLong(-Q_LONG_MAX, "longNegInf");
    if (signedDelta < 0) return qLong(0, "longNull");
    return qLongExact(-Q_LONG_MAX_BIGINT + BigInt(signedDelta));
  }
  if (sign === 1 && rightSpecial === "longPosInf" && leftDelta !== null) {
    if (leftDelta === 0) return qLong(Q_LONG_MAX, "longPosInf");
    if (leftDelta > 0) return qLong(0, "longNull");
    return null;
  }
  if (sign === 1 && rightSpecial === "longNegInf" && leftDelta !== null) {
    if (leftDelta === 0) return qLong(-Q_LONG_MAX, "longNegInf");
    if (leftDelta < 0) return qLong(0, "longNull");
    return null;
  }

  return null;
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
  if (forceFloat) {
    if (result === Number.POSITIVE_INFINITY) return qFloat(result, "posInf");
    if (result === Number.NEGATIVE_INFINITY) return qFloat(result, "negInf");
    return qFloat(result);
  }
  return numericOf(result, type);
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
      if (a.value === "0Nd" || b.value === "0Nd") return qInt(0, "intNull");
      return qInt(parseQDateDays(a.value) - parseQDateDays(b.value));
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
  longInfinityBoundaryResult(a, b, 1) ??
  arithBinary(a, b, (x, y) => x + y);
export const subtract = (a: QValue, b: QValue): QValue =>
  applyDictionaryBinary(a, b, subtract) ??
  subtractTemporal(a, b) ??
  longInfinityBoundaryResult(a, b, -1) ??
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

export const allValue = (value: QValue): QValue => {
  if (value.kind === "table") return tableColumnAggregate(value, allValue);
  if (value.kind === "dictionary") {
    const aggregated = dictionaryPositionAggregate(value, allValue);
    return aggregated ?? allValue(qList(value.values, false));
  }
  return qBool(value.kind === "list" ? value.items.every(isTruthy) : isTruthy(value));
};

export const anyValue = (value: QValue): QValue => {
  if (value.kind === "table") return tableColumnAggregate(value, anyValue);
  if (value.kind === "dictionary") {
    const aggregated = dictionaryPositionAggregate(value, anyValue);
    return aggregated ?? anyValue(qList(value.values, false));
  }
  return qBool(value.kind === "list" ? value.items.some(isTruthy) : isTruthy(value));
};

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
  if (value.kind === "table") {
    return tableRowCount(value) === 0 ? qDictionary([], []) : rowFromTable(value, 0);
  }
  if (value.kind === "keyedTable") {
    const table = qTable({ ...value.keys.columns, ...value.values.columns });
    return tableRowCount(table) === 0 ? qDictionary([], []) : rowFromTable(table, 0);
  }
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
  if (value.kind === "table") {
    const rowCount = tableRowCount(value);
    return rowCount === 0 ? qDictionary([], []) : rowFromTable(value, rowCount - 1);
  }
  if (value.kind === "keyedTable") {
    const table = qTable({ ...value.keys.columns, ...value.values.columns });
    const rowCount = tableRowCount(table);
    return rowCount === 0 ? qDictionary([], []) : rowFromTable(table, rowCount - 1);
  }
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
  if (value.kind === "dictionary") {
    const positions = gradePositions(value.values, true);
    return qDictionary(
      positions.map((index) => value.keys[index]!),
      positions.map((index) => value.values[index]!)
    );
  }
  if (value.kind === "table") {
    return sortTableByColumns(value, Object.keys(value.columns), true);
  }
  if (value.kind === "keyedTable") {
    const names = Object.keys(value.values.columns);
    const positions = tableGradePositions(value.values, names, true);
    return qKeyedTable(selectTableRows(value.keys, positions), sortSelectedTableRows(value.values, positions, names, true));
  }
  if (value.kind === "list") {
    return qList([...value.items].sort(compareValue), value.homogeneous ?? false, "s");
  }
  if (value.kind === "string") {
    return qString([...value.value].sort((a, b) => a.localeCompare(b)).join(""));
  }
  return value;
};

export const descValue = (value: QValue): QValue => {
  if (value.kind === "dictionary") {
    const positions = gradePositions(value.values, false);
    return qDictionary(
      positions.map((index) => value.keys[index]!),
      positions.map((index) => value.values[index]!)
    );
  }
  if (value.kind === "table") {
    return sortTableByColumns(value, Object.keys(value.columns).slice(0, 1), false);
  }
  if (value.kind === "keyedTable") {
    const positions = tableGradePositions(value.values, Object.keys(value.values.columns).slice(0, 1), false);
    return qKeyedTable(selectTableRows(value.keys, positions), selectTableRows(value.values, positions));
  }
  if (value.kind === "list") {
    return qList([...value.items].sort((a, b) => compareValue(b, a)), value.homogeneous ?? false);
  }
  if (value.kind === "string") {
    return qString([...value.value].sort((a, b) => b.localeCompare(a)).join(""));
  }
  return value;
};

export const attrValue = (value: QValue): QValue =>
  value.kind === "list" && value.attribute
    ? qSymbol(value.attribute)
    : value.kind === "table" && Object.values(value.columns)[0]?.attribute === "p"
      ? qSymbol("s")
      : value.kind === "keyedTable" && Object.values(value.keys.columns)[0]?.attribute === "p"
        ? qSymbol("s")
        : qSymbol("");

const setAttributeValue = (left: QSymbol, right: QValue): QValue => {
  const attribute = left.value;
  if (!["", "s", "u", "p", "g"].includes(attribute)) {
    throw new QRuntimeError("type", "set attribute expects `, `s, `u, `p or `g");
  }
  if (right.kind === "list") {
    if (attribute === "s" && !right.items.every((item, index) => index === 0 || compare(right.items[index - 1]!, item) <= 0)) {
      throw new QRuntimeError("s-fail", "not sorted");
    }
    return qList(right.items, right.homogeneous ?? false, attribute || undefined);
  }
  if (right.kind === "table") {
    if (attribute !== "s" && attribute !== "") {
      throw new QRuntimeError("type", "table attributes support sorted or clear");
    }
    const names = Object.keys(right.columns);
    return qTable(
      Object.fromEntries(
        names.map((name, index) => {
          const column = right.columns[name]!;
          return [
            name,
            qList(column.items, column.homogeneous ?? false, attribute === "s" && index === 0 ? "p" : undefined)
          ];
        })
      )
    );
  }
  if (right.kind === "keyedTable") {
    return qKeyedTable(setAttributeValue(left, right.keys) as QTable, right.values);
  }
  throw new QRuntimeError("type", "set attribute expects a list, table or keyed table");
};

const tableColumnAggregate = (value: QTable, reducer: (value: QValue) => QValue): QDictionary =>
  qDictionary(
    Object.keys(value.columns).map((name) => qSymbol(name)),
    Object.values(value.columns).map((column) => displayWithoutFloatSuffix(reducer(column)))
  );

const dictionaryPositionAggregate = (
  value: QDictionary,
  reducer: (value: QValue) => QValue
): QValue | null => {
  if (!value.values.every((item) => item.kind === "list")) return null;
  const rows = value.values as QList[];
  const count = rows[0]?.items.length ?? 0;
  if (!rows.every((row) => row.items.length === count)) return null;
  return qList(
    Array.from({ length: count }, (_, index) =>
      reducer(qList(rows.map((row) => row.items[index]!), false))
    ),
    false
  );
};

const mappedDictionary = (value: QDictionary, mapper: (value: QValue) => QValue): QDictionary =>
  qDictionary(value.keys, value.values.map(mapper));

const mappedTable = (value: QTable, mapper: (value: QValue) => QValue): QTable =>
  qTable(
    Object.fromEntries(
      Object.entries(value.columns).map(([name, column]) => {
        const mapped = mapper(column);
        const displayed = displayWithoutFloatSuffix(mapped);
        return [name, displayed.kind === "list" ? displayed : qList([displayed], false)];
      })
    )
  );

export const sumValue = (value: QValue): QValue => {
  if (value.kind === "table") return tableColumnAggregate(value, sumValue);
  if (value.kind === "dictionary") {
    const aggregated = dictionaryPositionAggregate(value, sumValue);
    if (aggregated) return aggregated;
  }
  if (value.kind !== "list") {
    return value;
  }
  const items = (value.homogeneous ?? false)
    ? value.items.filter((item) => !isNullish(item))
    : value.items;
  if (items.every((item) => item.kind === "list")) {
    const lists = items as QList[];
    return lists.slice(1).reduce(
      (acc: QValue, item) => mapBinary(acc, item, (a, b) => add(a, b)),
      lists[0]!
    );
  }
  const seed = value.items.some((item) => item.kind === "number" && item.numericType === "float")
    ? qFloat(0)
    : qLong(0);
  return items.reduce((acc, item) => (isNullish(item) ? acc : add(acc, item)), seed);
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
  if (value.kind === "table") return tableColumnAggregate(value, minValue);
  if (value.kind === "dictionary") {
    const aggregated = dictionaryPositionAggregate(value, minValue);
    if (aggregated) return aggregated;
  }
  if (value.kind === "string") {
    return qString([...value.value].sort((a, b) => a.localeCompare(b))[0] ?? "");
  }
  if (value.kind !== "list") {
    return value;
  }
  const list = asList(value);
  const nestedItems = list.items.length > 0 && list.items.every((item) => item.kind === "list")
    ? (list.items as QList[])
    : null;
  if (nestedItems) {
    return nestedItems.slice(1).reduce(
      (acc: QValue, item) => mapBinary(acc, item, (a, b) => minPair(a, b)),
      nestedItems[0]!
    );
  }
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
  if (value.kind === "table") return tableColumnAggregate(value, maxValue);
  if (value.kind === "dictionary") {
    const aggregated = dictionaryPositionAggregate(value, maxValue);
    if (aggregated) return aggregated;
  }
  if (value.kind === "string") {
    return qString([...value.value].sort((a, b) => a.localeCompare(b)).at(-1) ?? "");
  }
  if (value.kind !== "list") {
    return value;
  }
  const list = asList(value);
  const nestedItems = list.items.length > 0 && list.items.every((item) => item.kind === "list")
    ? (list.items as QList[])
    : null;
  if (nestedItems) {
    return nestedItems.slice(1).reduce(
      (acc: QValue, item) => mapBinary(acc, item, (a, b) => maxPair(a, b)),
      nestedItems[0]!
    );
  }
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
  if (value.kind === "table") {
    const rowCount = tableRowCount(value);
    if (rowCount === 0) return qDictionary([], []);
    const rows = Array.from({ length: rowCount }, (_, index) => rowFromTable(value, index)).sort((left, right) => {
      const primary = compare(left.values[0] ?? qNull(), right.values[0] ?? qNull());
      return primary === 0 ? compare(left, right) : primary;
    });
    const middle = Math.floor(rows.length / 2);
    if (rows.length % 2 === 1) {
      return rows[middle]!;
    }
    const left = rows[middle - 1]!;
    const right = rows[middle]!;
    return qDictionary(
      left.keys,
      left.values.map((item, index) =>
        displayWithoutFloatSuffix(medianValue(qList([item, right.values[index]!], false)))
      )
    );
  }
  if (value.kind === "keyedTable") return medianValue(value.values);
  if (value.kind === "dictionary") {
    const aggregated = dictionaryPositionAggregate(value, medianValue);
    if (aggregated) return aggregated;
  }
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

const qFloatResult = (value: number): QNumber => {
  if (Number.isNaN(value)) return qFloat(Number.NaN, "null");
  if (value === Number.POSITIVE_INFINITY) return qFloat(value, "posInf");
  if (value === Number.NEGATIVE_INFINITY) return qFloat(value, "negInf");
  return qFloat(value);
};

export const avgValue = (value: QValue): QValue => {
  if (value.kind === "table") return tableColumnAggregate(value, avgValue);
  if (value.kind === "dictionary") {
    const aggregated = dictionaryPositionAggregate(value, avgValue);
    if (aggregated) return aggregated;
  }
  const list = asList(value);
  const items = (list.homogeneous ?? false)
    ? list.items.filter((item) => !isNullish(item))
    : list.items;
  if (items.length === 0) {
    return qFloat(Number.NaN, "null");
  }
  if (!(list.homogeneous ?? false) && items.every((item) => isNullish(item))) {
    return qFloat(Number.NaN, "null");
  }
  const total = sumValue(qList(items, list.homogeneous ?? false));
  if (total.kind === "list") {
    return qList(
      total.items.map((item) =>
        item.kind === "number" ? (isNullish(item) ? qFloat(Number.NaN, "null") : qFloatResult(toNumber(item) / items.length)) : item
      ),
      false
    );
  }
  return qFloatResult(toNumber(total) / items.length);
};

export const avgsValue = (value: QValue): QValue => {
  if (value.kind === "table") return mappedTable(value, avgsValue);
  if (value.kind === "dictionary") {
    return qDictionary(
      value.keys,
      value.values.map((_, index) => avgValue(qList(value.values.slice(0, index + 1), false)))
    );
  }
  const list = asList(value);
  let running: QValue = qLong(0);
  let count = 0;
  return qList(
    list.items.map((item) => {
      if (!isNullish(item)) {
        running = add(running, item);
        count += 1;
      }
      return count === 0 ? qFloat(Number.NaN, "null") : qFloatResult(toNumber(running) / count);
    }),
    false
  );
};

export const productValue = (value: QValue): QValue => {
  if (value.kind === "table") return tableColumnAggregate(value, productValue);
  if (value.kind === "dictionary") {
    const aggregated = dictionaryPositionAggregate(value, productValue);
    if (aggregated) return aggregated;
  }
  if (value.kind !== "list") {
    return value;
  }
  const items = value.items.filter((item) => !isNullish(item));
  if (items.every((item) => item.kind === "list")) {
    const lists = items as QList[];
    return lists.slice(1).reduce(
      (acc: QValue, item) => mapBinary(acc, item, (a, b) => multiply(a, b)),
      lists[0]!
    );
  }
  return items.reduce((acc, item) => multiply(acc, item), qLong(1));
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

export const xprevValue = (offsetValue: QValue, value: QValue): QValue => {
  const offset = Math.trunc(toNumber(offsetValue));
  if (value.kind === "string") {
    return qString([...value.value].map((_, index) => value.value[index - offset] ?? " ").join(""));
  }
  const list = asList(value);
  if (list.items.length === 0) {
    return qList([], list.homogeneous ?? false);
  }
  return qList(
    list.items.map((_, index) => list.items[index - offset] ?? nullLike(list.items[offset >= 0 ? 0 : list.items.length - 1])),
    list.homogeneous ?? false
  );
};

export const sumsValue = (value: QValue): QValue => {
  if (value.kind === "table") return mappedTable(value, sumsValue);
  if (value.kind === "dictionary") {
    return qDictionary(
      value.keys,
      value.values.map((_, index) => sumValue(qList(value.values.slice(0, index + 1), false)))
    );
  }
  const list = asList(value);
  let running: QValue = qLong(0);
  return qList(
    list.items.map((item) => {
      if (!isNullish(item)) {
        running =
          item.kind === "list" && running.kind === "number" && toNumber(running) === 0
            ? item
            : item.kind === "list" || running.kind === "list"
              ? mapBinary(running, item, (a, b) => add(a, b))
              : add(running, item);
      }
      return running;
    }),
    list.homogeneous ?? false
  );
};

export const minsValue = (value: QValue): QValue => {
  if (value.kind === "table") return mappedTable(value, minsValue);
  if (value.kind === "dictionary") {
    return qDictionary(
      value.keys,
      value.values.map((_, index) => minValue(qList(value.values.slice(0, index + 1), false)))
    );
  }
  const list = asList(value);
  let running: QValue | null = null;
  return qList(
    list.items.map((item) => {
      if (!isNullish(item)) {
        running =
          running === null
            ? item
            : item.kind === "list" || running.kind === "list"
              ? mapBinary(running, item, (a, b) => minPair(a, b))
              : minPair(running, item);
      }
      return running ?? minValue(qList([item], list.homogeneous ?? false, list.attribute));
    }),
    list.homogeneous ?? false
  );
};

export const maxsValue = (value: QValue): QValue => {
  if (value.kind === "table") return mappedTable(value, maxsValue);
  if (value.kind === "dictionary") {
    return qDictionary(
      value.keys,
      value.values.map((_, index) => maxValue(qList(value.values.slice(0, index + 1), false)))
    );
  }
  const list = asList(value);
  let running: QValue | null = null;
  return qList(
    list.items.map((item) => {
      if (!isNullish(item)) {
        running =
          running === null
            ? item
            : item.kind === "list" || running.kind === "list"
              ? mapBinary(running, item, (a, b) => maxPair(a, b))
              : maxPair(running, item);
      }
      return running ?? maxValue(qList([item], list.homogeneous ?? false, list.attribute));
    }),
    list.homogeneous ?? false
  );
};

const ratioFirstValue = (value: QValue): QValue =>
  value.kind === "list"
    ? qList(value.items.map((item) => ratioFirstValue(item)), value.homogeneous ?? false)
    : qFloat(toNumber(value));

export const ratiosValue = (value: QValue): QValue => {
  if (value.kind === "table") return mappedTable(value, ratiosValue);
  if (value.kind === "keyedTable") return qKeyedTable(value.keys, mappedTable(value.values, ratiosValue));
  if (value.kind === "dictionary") {
    return qDictionary(
      value.keys,
      value.values.map((item, index) => {
        if (isNullish(item)) {
          return qFloat(Number.NaN, "null");
        }
        if (index === 0) {
          return ratioFirstValue(item);
        }
        const previous = value.values[index - 1] ?? qNull();
        return isNullish(previous) ? qFloat(Number.NaN, "null") : mapBinary(item, previous, divide);
      })
    );
  }
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
  if (value.kind === "table") {
    return tableColumnAggregate(value, (column) => varianceValue(column, sample));
  }
  const list = asList(value);
  if (list.items.length > 0 && list.items.every((item) => item.kind === "list")) {
    const rows = list.items as QList[];
    const count = rows[0]?.items.length ?? 0;
    if (!rows.every((row) => row.items.length === count)) {
      throw new QRuntimeError("length", "variance expects conforming nested lists");
    }
    return qList(
      Array.from({ length: count }, (_, index) =>
        varianceValue(qList(rows.map((row) => row.items[index]!), false), sample)
      ),
      false
    );
  }
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
  if (value.kind === "table") {
    return tableColumnAggregate(value, (column) => deviationValue(column, sample));
  }
  const variance = varianceValue(value, sample);
  if (variance.kind === "list") {
    return qList(
      variance.items.map((item) =>
        item.kind === "number" && item.special !== "null"
          ? qFloat(Math.sqrt(toNumber(item)))
          : item
      ),
      false
    );
  }
  return variance.kind === "number" && variance.special === "null"
    ? variance
    : qFloat(Math.sqrt(toNumber(variance)));
};

const numericItems = (value: QValue): QValue[] => asList(value).items.filter((item) => !isNullish(item));

export const covarianceValue = (left: QValue, right: QValue, sample: boolean): QValue => {
  const leftItems = numericItems(left);
  const rightItems = numericItems(right);
  if (leftItems.length !== rightItems.length) {
    throw new QRuntimeError("length", "covariance arguments must conform");
  }
  if (leftItems.length === 0 || (sample && leftItems.length < 2)) {
    return qFloat(Number.NaN, "null");
  }

  const xs = leftItems.map(toNumber);
  const ys = rightItems.map(toNumber);
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  const divisor = sample ? xs.length - 1 : xs.length;
  return qFloat(
    xs.reduce((sum, value, index) => sum + (value - meanX) * (ys[index]! - meanY), 0) / divisor
  );
};

export const correlationValue = (left: QValue, right: QValue): QValue => {
  const cov = covarianceValue(left, right, false);
  const leftDev = deviationValue(left, false);
  const rightDev = deviationValue(right, false);
  const denominator = toNumber(leftDev) * toNumber(rightDev);
  if (denominator === 0 || Number.isNaN(denominator)) {
    return qFloat(Number.NaN, "null");
  }
  const result = toNumber(cov) / denominator;
  if (Math.abs(result - 1) < 1e-12) {
    return { ...qFloat(1), exactText: "1f" };
  }
  return Math.abs(result + 1) < 1e-12
    ? { ...qFloat(-1), exactText: "-1f" }
    : qFloat(result);
};

export const emaValue = (alphaValue: QValue, values: QValue): QValue => {
  const list = asList(values);
  const alphas =
    alphaValue.kind === "list"
      ? alphaValue.items.map(toNumber)
      : Array.from({ length: list.items.length }, () => toNumber(alphaValue));
  if (alphas.length !== list.items.length) {
    throw new QRuntimeError("length", "ema smoothing values must conform");
  }
  if (list.items.length === 0) {
    return qList([], false);
  }

  let previous = toNumber(list.items[0]!);
  const results = list.items.map((item, index) => {
    const current = toNumber(item);
    previous = index === 0 ? current : alphas[index]! * current + (1 - alphas[index]!) * previous;
    return qFloat(previous);
  });
  return qList(results, false);
};

export const movingCountValue = (value: QValue): QValue => {
  const list = asList(value);
  if (list.items.length > 0 && list.items.every((item) => item.kind === "list")) {
    const rows = list.items as QList[];
    const count = rows[0]?.items.length ?? 0;
    if (rows.every((row) => row.items.length === count)) {
      return qList(
        Array.from({ length: count }, (_, index) =>
          movingCountValue(qList(rows.map((row) => row.items[index]!), false))
        ),
        true,
        "explicitInt"
      );
    }
  }
  return qInt(list.items.filter((item) => !isNullish(item)).length);
};

export const movingValue = (
  windowSize: QValue,
  value: QValue,
  reducer: (value: QValue) => QValue,
  homogeneous: boolean,
  nonPositive: "zero" | "intZero" | "floatNull" | "source" = "source"
): QValue => {
  const rawSize = Math.trunc(toNumber(windowSize));
  if (rawSize <= 0) {
    if (value.kind === "dictionary") {
      return mappedDictionary(value, (item) => movingValue(windowSize, item, reducer, homogeneous, nonPositive));
    }
    if (value.kind === "table") {
      return mappedTable(value, (column) => movingValue(windowSize, column, reducer, homogeneous, nonPositive));
    }
    if (nonPositive === "source") return value;
    const list = asList(value);
    const replacement =
      nonPositive === "floatNull"
        ? () => qFloat(Number.NaN, "null")
        : nonPositive === "intZero"
          ? () => qInt(0)
          : () => qLong(0);
    const values = list.items.map(replacement);
    return qList(
      values,
      nonPositive === "intZero" || (nonPositive === "zero" && (list.homogeneous ?? false)),
      nonPositive === "intZero" ? "explicitInt" : undefined
    );
  }
  if (value.kind === "dictionary") {
    const size = rawSize;
    return qDictionary(
      value.keys,
      value.values.map((_, index) => {
        const start = Math.max(0, index - size + 1);
        return reducer(qList(value.values.slice(start, index + 1), false));
      })
    );
  }
  if (value.kind === "table") {
    return mappedTable(value, (column) => movingValue(windowSize, column, reducer, homogeneous, nonPositive));
  }
  const size = rawSize;
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
  const fast = tryPrimitiveEachPair("-", value, seed);
  if (fast) return fast;
  if (value.kind === "table") return mappedTable(value, (column) => deltasValue(column, seed));
  if (value.kind === "keyedTable") return qKeyedTable(value.keys, mappedTable(value.values, (column) => deltasValue(column, seed)));
  if (value.kind === "dictionary") {
    return qDictionary(
      value.keys,
      value.values.map((item, index) => {
        if (index === 0) {
          return seed === undefined ? item : mapBinary(item, seed, subtract);
        }
        return mapBinary(item, value.values[index - 1] ?? qNull(), subtract);
      })
    );
  }
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
  if (value.kind === "dictionary") {
    return qDictionary([...value.keys].reverse(), [...value.values].reverse());
  }
  if (value.kind === "table") {
    const rowCount = tableRowCount(value);
    return selectTableRows(value, Array.from({ length: rowCount }, (_, index) => rowCount - 1 - index));
  }
  if (value.kind === "keyedTable") {
    const rowCount = tableRowCount(value.keys);
    const positions = Array.from({ length: rowCount }, (_, index) => rowCount - 1 - index);
    return qKeyedTable(selectTableRows(value.keys, positions), selectTableRows(value.values, positions));
  }
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
  const rotatedPositions = (length: number) => {
    if (length === 0) return [];
    const shift = ((count % length) + length) % length;
    return [...Array.from({ length: length - shift }, (_, index) => index + shift), ...Array.from({ length: shift }, (_, index) => index)];
  };
  if (right.kind === "string") {
    const chars = [...right.value];
    if (chars.length === 0) {
      return right;
    }
    const positions = rotatedPositions(chars.length);
    return qString(positions.map((position) => chars[position]!).join(""));
  }
  if (right.kind === "table") {
    return selectTableRows(right, rotatedPositions(tableRowCount(right)));
  }
  if (right.kind === "keyedTable") {
    const positions = rotatedPositions(tableRowCount(right.keys));
    return qKeyedTable(selectTableRows(right.keys, positions), selectTableRows(right.values, positions));
  }
  const list = asList(right);
  const positions = rotatedPositions(list.items.length);
  return qList(
    positions.map((position) => list.items[position]!),
    list.homogeneous ?? false
  );
};

export const sublistValue = (left: QValue, right: QValue): QValue => {
  const start = left.kind === "list" ? toNumber(left.items[0] ?? qLong(0)) : 0;
  const count = left.kind === "list" ? toNumber(left.items[1] ?? qLong(0)) : toNumber(left);
  const sublistPositions = (length: number) => {
    if (count >= 0) {
      const begin = Math.max(0, Math.trunc(start));
      const end = Math.min(length, begin + Math.trunc(count));
      return Array.from({ length: Math.max(0, end - begin) }, (_, index) => begin + index);
    }
    const begin = Math.max(0, length + Math.trunc(count));
    return Array.from({ length: length - begin }, (_, index) => begin + index);
  };
  if (right.kind === "string") {
    const chars = [...right.value];
    return qString(sublistPositions(chars.length).map((position) => chars[position]!).join(""));
  }
  if (right.kind === "dictionary") {
    const positions = sublistPositions(right.keys.length);
    return qDictionary(
      positions.map((position) => right.keys[position]!),
      positions.map((position) => right.values[position]!)
    );
  }
  if (right.kind === "table") {
    return selectTableRows(right, sublistPositions(tableRowCount(right)));
  }
  if (right.kind === "keyedTable") {
    const positions = sublistPositions(tableRowCount(right.keys));
    return qKeyedTable(selectTableRows(right.keys, positions), selectTableRows(right.values, positions));
  }
  const list = asList(right);
  const positions = sublistPositions(list.items.length);
  return qList(positions.map((position) => list.items[position]!), list.homogeneous ?? false);
};

const emptyAttributeForList = (list: QList): string | undefined => {
  if (list.attribute && list.attribute !== "s" && list.attribute !== "namespaceKeys") {
    return list.attribute === "explicitInt" ? "int" : list.attribute;
  }
  if (list.items.length === 0) return undefined;
  if (list.items.every((item) => item.kind === "number")) {
    const type = (list.items[0] as QNumber).numericType;
    return list.items.every((item) => item.kind === "number" && item.numericType === type) ? type : undefined;
  }
  if (list.items.every((item) => item.kind === "symbol")) return "symbol";
  if (list.items.every((item) => item.kind === "boolean")) return "boolean";
  return undefined;
};

const attributeForAtom = (value: QValue): string | undefined => {
  if (value.kind === "boolean") return "boolean";
  if (value.kind === "number") return value.numericType;
  if (value.kind === "symbol") return "symbol";
  if (value.kind === "temporal") return value.temporalType;
  return undefined;
};

const listWithPreservedEmptyType = (items: QValue[], source: QList): QList =>
  qList(items, source.homogeneous ?? false, items.length === 0 ? emptyAttributeForList(source) : source.attribute);

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
      if (node.op === "wsum" || node.op === "wavg") {
        return qsqlExpressionName(node.right) ?? qsqlExpressionName(node.left);
      }
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
  "svar",
  "wsum",
  "wavg"
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
    (node.kind === "call" &&
      node.callee.kind === "identifier" &&
      node.args.length === 1 &&
      QSQL_AGGREGATES.has(node.callee.name)) ||
    (node.kind === "binary" && QSQL_AGGREGATES.has(node.op))
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
      entries.map(([name, column], index) => [names[index] ?? name, column])
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
  if (namesValue.kind === "dictionary") {
    if (!namesValue.keys.every((item) => item.kind === "symbol") || !namesValue.values.every((item) => item.kind === "symbol")) {
      throw new QRuntimeError("type", "xcol dictionary expects symbol keys and values");
    }
    const renameMap = new Map(
      namesValue.keys.map((key, index) => [(key as QSymbol).value, (namesValue.values[index] as QSymbol).value])
    );
    const renameWithMap = (table: QTable) =>
      qTable(
        Object.fromEntries(
          Object.entries(table.columns).map(([name, column]) => [renameMap.get(name) ?? name, column])
        )
      );
    if (tableValue.kind === "table") return renameWithMap(tableValue);
    if (tableValue.kind === "keyedTable") {
      return qKeyedTable(renameWithMap(tableValue.keys), renameWithMap(tableValue.values));
    }
    throw new QRuntimeError("type", "xcol expects a table");
  }

  const nameItems = namesValue.kind === "symbol" ? [namesValue] : namesValue.kind === "list" ? namesValue.items : null;
  if (nameItems === null || !nameItems.every((item) => item.kind === "symbol")) {
    throw new QRuntimeError("type", "xcol expects a symbol list on the left");
  }

  const baseNames = nameItems.map((item) => (item as QSymbol).value);

  if (tableValue.kind === "table") {
    const columnCount = Object.keys(tableValue.columns).length;
    if (baseNames.length > columnCount) {
      throw new QRuntimeError("length", "xcol name count must not exceed table columns");
    }
    return renameTableColumns(tableValue, baseNames);
  }

  if (tableValue.kind === "keyedTable") {
    const keyNames = Object.keys(tableValue.keys.columns);
    const valueNames = Object.keys(tableValue.values.columns);
    const columnCount = keyNames.length + valueNames.length;
    if (baseNames.length > columnCount) {
      throw new QRuntimeError("length", "xcol name count must not exceed keyed table columns");
    }
    return qKeyedTable(
      renameTableColumns(tableValue.keys, baseNames.slice(0, keyNames.length)),
      renameTableColumns(tableValue.values, baseNames.slice(keyNames.length))
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

export const fromMatrix = (rows: number[][], rowAttribute?: string): QValue =>
  qList(
    rows.map((row) => qList(row.map((value) => qFloat(value)), true, rowAttribute)),
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

const transposeMatrix = (matrix: number[][]): number[][] => {
  const cols = matrix[0]?.length ?? 0;
  if (!matrix.every((row) => row.length === cols)) {
    throw new QRuntimeError("length", "matrix rows must have equal length");
  }
  return Array.from({ length: cols }, (_, col) => matrix.map((row) => row[col]!));
};

const multiplyMatrices = (left: number[][], right: number[][]): number[][] => {
  const rows = left.length;
  if (rows === 0) return [];
  const inner = left[0]!.length;
  if (!left.every((row) => row.length === inner) || right.length !== inner) {
    throw new QRuntimeError("length", "matrix inner dimensions must match");
  }
  const cols = right[0]?.length ?? 0;
  if (!right.every((row) => row.length === cols)) {
    throw new QRuntimeError("length", "matrix rows must have equal length");
  }
  return left.map((row) =>
    Array.from({ length: cols }, (_, col) =>
      row.reduce((sum, value, index) => sum + value * right[index]![col]!, 0)
    )
  );
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

export const lsqValue = (left: QValue, right: QValue): QValue => {
  const x = asMatrix(left);
  const y = asMatrix(right);
  const cols = x[0]?.length ?? 0;
  if (cols === 0 || !x.every((row) => row.length === cols) || !y.every((row) => row.length === cols)) {
    throw new QRuntimeError("length", "lsq expects matrices with matching column counts");
  }
  if (y.length > cols) {
    throw new QRuntimeError("length", "lsq expects right rows not to exceed column count");
  }
  const yt = transposeMatrix(y);
  const yyT = multiplyMatrices(y, yt);
  const result = multiplyMatrices(multiplyMatrices(x, yt), asMatrix(invValue(fromMatrix(yyT))));
  return result.length === 1 && result[0]?.length === 1 ? qFloat(result[0][0]!) : fromMatrix(result, "matrixRow");
};

export const wsumValue = (weights: QValue, values: QValue): QValue => {
  if (values.kind === "dictionary") {
    const dictionaryWeights = weights.kind === "dictionary" ? qList(weights.values, false) : weights;
    return wsumValue(dictionaryWeights, qList(values.values, false));
  }
  return sumValue(mapBinary(weights, values, (a, b) => multiply(a, b)));
};

export const wavgValue = (weights: QValue, values: QValue): QValue => {
  if (values.kind === "dictionary") {
    const dictionaryWeights = weights.kind === "dictionary" ? qList(weights.values, false) : weights;
    return wavgValue(dictionaryWeights, qList(values.values, false));
  }
  const numerator = sumValue(mapBinary(weights, values, (a, b) => multiply(a, b)));
  const eligibleWeights = mapBinary(weights, values, (weight, value) =>
    isNullish(weight) || isNullish(value) ? nullForType(numericTypeOf(weight)) : weight
  );
  const denominator = sumValue(eligibleWeights);
  return mapBinary(numerator, denominator, (total, weightTotal) =>
    weightTotal.kind === "number" && toNumber(weightTotal) === 0
      ? qFloat(Number.NaN, "null")
      : divide(total, weightTotal)
  );
};

export const binarySearchValue = (list: QValue, target: QValue, mode: "bin" | "binr"): QValue => {
  if (list.kind === "dictionary") {
    const values = qList(list.values, false);
    const indexes = binarySearchValue(values, target, mode);
    const keyAt = (indexValue: QValue): QValue => {
      if (indexValue.kind !== "number") return qSymbol("");
      const index = Math.trunc(toNumber(indexValue));
      if (index < 0 || index >= list.keys.length) return qSymbol("");
      return list.keys[index] ?? qSymbol("");
    };
    if (indexes.kind === "list") {
      return qList(indexes.items.map(keyAt), true, list.keys.every((key) => key.kind === "symbol") ? "symbol" : undefined);
    }
    return keyAt(indexes);
  }
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

export const xrankValue = (bucketValue: QValue, value: QValue): QValue => {
  const bucketCount = Math.trunc(toNumber(bucketValue));
  const items = asSequenceItems(value);
  if (items.length === 0) {
    return qList([], true);
  }
  if (bucketCount <= 0) {
    return qList(items.map(() => qLong(0)), true);
  }
  const ranked = gradeValue(gradeValue(value, true), true);
  if (ranked.kind !== "list") {
    return qLong(0);
  }
  return qList(
    ranked.items.map((item) => qLong(Math.floor((bucketCount * toNumber(item)) / items.length))),
    true
  );
};

export const randValue = (arg: QValue): QValue => {
  if (arg.kind === "list") {
    if (arg.items.length === 0) return qNull();
    return arg.items[Math.floor(Math.random() * arg.items.length)]!;
  }
  if (arg.kind === "symbol") {
    const length = Number.parseInt(arg.value, 10);
    if (!Number.isFinite(length) || length < 0) {
      throw new QRuntimeError("type", "rand symbol expects a numeric symbol length");
    }
    const alphabet = "abcdefghijklmnop";
    return qSymbol(
      Array.from({ length: Math.min(Math.trunc(length), 8) }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")
    );
  }
  if (arg.kind === "temporal") {
    if (arg.temporalType === "date") {
      const days = Math.max(0, parseQDateDays(arg.value));
      return qDate(formatQDateFromDays(Math.floor(Math.random() * (days + 1))));
    }
    if (arg.temporalType === "month") {
      return qTemporal("month", formatMonthFromMonths(randNatural(parseMonthMonths(arg.value))));
    }
    if (arg.temporalType === "minute") {
      return qTemporal("minute", formatClockFromUnits(randNatural(parseMinuteUnits(arg.value)), 1 / 60, "minute"));
    }
    if (arg.temporalType === "second") {
      return qTemporal("second", formatClockFromUnits(randNatural(parseSecondUnits(arg.value)), 1, "second"));
    }
    if (arg.temporalType === "time") {
      return qTemporal("time", formatClockFromUnits(randNatural(parseTimeMillis(arg.value)), 1000, "millisecond"));
    }
    if (arg.temporalType === "timespan") {
      return qTemporal("timespan", formatTimespanFromNanos(randNatural(parseTimespanNanos(arg.value))));
    }
    if (arg.temporalType === "timestamp") {
      return qTemporal("timestamp", formatTimestampFromNanos(randNatural(parseTimestampNanos(arg.value))));
    }
    if (arg.temporalType === "datetime") {
      return qTemporal("datetime", formatDatetimeFromMillis(randNatural(parseDatetimeMillis(arg.value))));
    }
  }
  if (arg.kind === "string") {
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    return qString(alphabet[Math.floor(Math.random() * alphabet.length)] ?? "a");
  }
  if (arg.kind === "number") {
    const n = arg.value;
    if (arg.numericType === "short") {
      return qShort(Math.floor(Math.random() * Math.max(Math.trunc(n), 1)));
    }
    if (arg.numericType === "int") {
      return qInt(Math.floor(Math.random() * Math.max(Math.trunc(n), 1)));
    }
    if (Number.isInteger(n) && n > 0) {
      return qLong(Math.floor(Math.random() * n));
    }
    return arg.numericType === "real" ? qReal(Math.random() * n) : qFloat(Math.random() * n);
  }
  if (arg.kind === "boolean") {
    return qBool(Math.random() < 0.5);
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

const md5Shift = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
];

const md5Table = Array.from({ length: 64 }, (_, index) =>
  Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) >>> 0
);

const rotateLeft32 = (value: number, bits: number) =>
  ((value << bits) | (value >>> (32 - bits))) >>> 0;

export const md5Value = (value: QValue): QValue => {
  if (value.kind !== "string") {
    throw new QRuntimeError("type", "md5 expects a string");
  }

  const input = new TextEncoder().encode(value.value);
  const paddedLength = (((input.length + 8) >>> 6) + 1) << 6;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.length] = 0x80;
  const bitLength = input.length * 8;
  for (let offset = 0; offset < 8; offset += 1) {
    padded[paddedLength - 8 + offset] = Math.floor(bitLength / 2 ** (8 * offset)) & 0xff;
  }

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  const words = new Uint32Array(16);

  for (let chunk = 0; chunk < padded.length; chunk += 64) {
    for (let index = 0; index < 16; index += 1) {
      const base = chunk + index * 4;
      words[index] =
        (padded[base]! |
          (padded[base + 1]! << 8) |
          (padded[base + 2]! << 16) |
          (padded[base + 3]! << 24)) >>> 0;
    }

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let index = 0; index < 64; index += 1) {
      let f = 0;
      let g = 0;
      if (index < 16) {
        f = (b & c) | (~b & d);
        g = index;
      } else if (index < 32) {
        f = (d & b) | (~d & c);
        g = (5 * index + 1) % 16;
      } else if (index < 48) {
        f = b ^ c ^ d;
        g = (3 * index + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * index) % 16;
      }

      const next = d;
      d = c;
      c = b;
      b = (b + rotateLeft32((a + f + md5Table[index]! + words[g]!) >>> 0, md5Shift[index]!)) >>> 0;
      a = next;
    }

    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  const digest = new Uint8Array(16);
  [a0, b0, c0, d0].forEach((word, wordIndex) => {
    const base = wordIndex * 4;
    digest[base] = word & 0xff;
    digest[base + 1] = (word >>> 8) & 0xff;
    digest[base + 2] = (word >>> 16) & 0xff;
    digest[base + 3] = (word >>> 24) & 0xff;
  });
  return byteListFromBytes(digest);
};

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
    if (typeof record.kind === "string" && typeof record.qType === "string" && "data" in record) {
      if (record.kind === "atom") {
        switch (record.qType) {
          case "null":
            return qNull();
          case "boolean":
            return qBool(Boolean(record.data));
          case "symbol":
            return qSymbol(String(record.data ?? ""));
          case "string":
            return qString(String(record.data ?? ""));
          case "date":
            return qDate(String(record.data ?? "0Nd"));
          case "short":
          case "int":
          case "long":
          case "real":
          case "float":
            if (typeof record.data === "string") return parseNumericLiteral(record.data);
            switch (record.qType) {
              case "short":
                return qShort(Number(record.data ?? 0));
              case "int":
                return qInt(Number(record.data ?? 0));
              case "real":
                return qReal(Number(record.data ?? 0));
              case "float":
                return qFloat(Number(record.data ?? 0));
              default:
                return qLong(Number(record.data ?? 0));
            }
          default:
            return qString(String(record.data ?? ""));
        }
      }
      if (record.kind === "list" && record.data && typeof record.data === "object") {
        const data = record.data as Record<string, unknown>;
        const rawItems = Array.isArray(data.items) ? data.items : [];
        return qList(
          rawItems.map(hydrateCanonical),
          record.qType === "vector",
          typeof data.attribute === "string" ? data.attribute : undefined
        );
      }
      if (record.kind === "dictionary" && record.data && typeof record.data === "object") {
        const data = record.data as Record<string, unknown>;
        const keys = Array.isArray(data.keys) ? data.keys : [];
        const values = Array.isArray(data.values) ? data.values : [];
        return qDictionary(keys.map(hydrateCanonical), values.map(hydrateCanonical));
      }
      if (record.kind === "table" && record.qType === "table" && record.data && typeof record.data === "object") {
        const columns: Record<string, QList> = {};
        for (const [name, rawColumn] of Object.entries(record.data as Record<string, unknown>)) {
          const column = hydrateCanonical(rawColumn);
          columns[name] = column.kind === "list" ? column : qList([column], true);
        }
        return qTable(columns);
      }
      if (record.kind === "table" && record.qType === "keyedTable" && record.data && typeof record.data === "object") {
        const data = record.data as Record<string, unknown>;
        const keys = hydrateCanonical(data.keys);
        const values = hydrateCanonical(data.values);
        if (keys.kind === "table" && values.kind === "table") {
          return qKeyedTable(keys, values);
        }
      }
    }
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
  if (current.kind !== "table" && current.kind !== "keyedTable") {
    throw new QRuntimeError("type", "insert target must be a table");
  }
  const keyed = current.kind === "keyedTable" ? current : null;
  const baseTable: QTable = current.kind === "keyedTable"
    ? qTable({ ...current.keys.columns, ...current.values.columns })
    : current;
  const columnNames = Object.keys(baseTable.columns);
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
  } else if (payload.kind === "table" || payload.kind === "keyedTable") {
    const tablePayload: QTable = payload.kind === "keyedTable" ? qTable({ ...payload.keys.columns, ...payload.values.columns }) : payload;
    const rowCount = tableRowCount(tablePayload);
    for (const name of columnNames) {
      if (!tablePayload.columns[name]) {
        throw new QRuntimeError("schema", "insert: table columns must match");
      }
    }
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      rowsToAppend.push(columnNames.map((name) => tablePayload.columns[name]!.items[rowIndex] ?? qNull()));
    }
  } else {
    throw new QRuntimeError("type", "insert expects a list or dictionary payload");
  }
  if (keyed) {
    const keyNames = Object.keys(keyed.keys.columns);
    const existingRows = tableRowCount(keyed.keys);
    const keyAt = (row: QValue[]) => keyNames.map((name) => row[columnNames.indexOf(name)] ?? qNull());
    const existingKeyAt = (rowIndex: number) => keyNames.map((name) => keyed.keys.columns[name]!.items[rowIndex] ?? qNull());
    const seenKeys: QValue[][] = [];
    for (const row of rowsToAppend) {
      const rowKey = keyAt(row);
      if (
        Array.from({ length: existingRows }, (_, index) => existingKeyAt(index)).some((existing) =>
          existing.every((item, index) => equals(item, rowKey[index] ?? qNull()))
        ) ||
        seenKeys.some((existing) => existing.every((item, index) => equals(item, rowKey[index] ?? qNull())))
      ) {
        throw new QRuntimeError("insert", "insert duplicate key");
      }
      seenKeys.push(rowKey);
    }
  }
  const nextColumns: Record<string, QList> = {};
  for (let colIndex = 0; colIndex < columnNames.length; colIndex++) {
    const name = columnNames[colIndex]!;
    const existing = baseTable.columns[name]!;
    const additions = rowsToAppend.map((row) => row[colIndex]!);
    const merged = [...existing.items, ...additions];
    nextColumns[name] = qList(merged, merged.every((item) => item.kind === merged[0]?.kind));
  }
  const updated = keyed
    ? qKeyedTable(
        qTable(Object.fromEntries(Object.keys(keyed.keys.columns).map((name) => [name, nextColumns[name]!]))),
        qTable(Object.fromEntries(Object.keys(keyed.values.columns).map((name) => [name, nextColumns[name]!])))
      )
    : qTable(nextColumns);
  session.assignGlobal(target.value, updated);
  const startIndex = Object.values(baseTable.columns)[0]?.items.length ?? 0;
  return qList(
    rowsToAppend.map((_, i) => qLong(startIndex + i)),
    true
  );
};

export const upsertValue = (session: Session, target: QValue, payload: QValue): QValue => {
  if (target.kind === "symbol") {
    const current = session.get(target.value);
    if (payload.kind === "table" || payload.kind === "keyedTable") {
      if (
        (current.kind === "table" && payload.kind !== "table") ||
        (current.kind === "keyedTable" && payload.kind !== "keyedTable") ||
        (current.kind !== "table" && current.kind !== "keyedTable")
      ) {
        throw new QRuntimeError("type", "upsert target must be a table");
      }
      session.assignGlobal(target.value, upsertValue(session, current, payload));
      return target;
    }
    insertValue(session, target, payload);
    return target;
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
  if (target.kind === "keyedTable" && payload.kind === "keyedTable") {
    return unionJoin(target, payload);
  }
  throw new QRuntimeError("type", "upsert expects a symbol or matching tables");
};

export const inValue = (left: QValue, right: QValue): QValue => {
  const contains = (value: QValue) => {
    if (right.kind === "dictionary") {
      return qBool(right.values.some((candidate) => equals(candidate, value)));
    }
    if (right.kind === "list") {
      return qBool(right.items.some((candidate) => equals(candidate, value)));
    }
    return qBool(equals(value, right));
  };

  if (left.kind === "list") {
    return qList(left.items.map((item) => inValue(item, right)), true);
  }
  if (left.kind === "string") {
    return qList([...left.value].map((char) => contains(qString(char))), true);
  }

  return contains(left);
};

const gradePositions = (values: QValue[], ascending: boolean): number[] => {
  const items = values.map((item, index) => ({ item, index }));
  items.sort((left, right) => {
    const compared = compare(left.item, right.item);
    return compared === 0 ? left.index - right.index : ascending ? compared : -compared;
  });
  return items.map(({ index }) => index);
};

const tableGradePositions = (table: QTable, names: string[], ascending: boolean): number[] => {
  const rowCount = tableRowCount(table);
  const positions = Array.from({ length: rowCount }, (_, i) => i);
  positions.sort((a, b) => {
    for (const name of names) {
      const col = table.columns[name];
      if (!col) continue;
      const diff = compare(col.items[a]!, col.items[b]!);
      if (diff !== 0) return ascending ? diff : -diff;
    }
    return a - b;
  });
  return positions;
};

const sortTableByColumns = (table: QTable, names: string[], ascending: boolean): QTable => {
  return sortSelectedTableRows(table, tableGradePositions(table, names, ascending), names, ascending);
};

const sortSelectedTableRows = (table: QTable, positions: number[], names: string[], ascending: boolean): QTable => {
  const sorted = selectTableRows(table, positions);
  if (ascending && names.length > 0) {
    const [first, ...rest] = names;
    const column = sorted.columns[first!];
    if (column) {
      sorted.columns[first!] = qList(column.items, column.homogeneous ?? false, rest.length === 0 ? "s" : "p");
    }
  }
  return sorted;
};

export const gradeValue = (value: QValue, ascending: boolean): QValue => {
  if (value.kind === "dictionary") {
    return qList(gradePositions(value.values, ascending).map((index) => value.keys[index]!), false);
  }
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

export const fbyValue = (session: Session, left: QValue, group: QValue): QValue => {
  if (left.kind !== "list" || left.items.length < 2) {
    throw new QRuntimeError("type", "fby expects (function;values) on the left");
  }

  const [callee, values] = left.items;
  if (!callee || !values) {
    throw new QRuntimeError("type", "fby expects (function;values) on the left");
  }

  const groupItems = asSequenceItems(group);
  const valueItems = asSequenceItems(values);
  if (groupItems.length !== valueItems.length) {
    throw new QRuntimeError("length", "fby group length must match value length");
  }

  const grouped = new Map<string, { positions: number[]; values: QValue[] }>();
  groupItems.forEach((key, index) => {
    const id = JSON.stringify(canonicalize(key));
    const bucket = grouped.get(id);
    if (bucket) {
      bucket.positions.push(index);
      bucket.values.push(valueItems[index]!);
      return;
    }
    grouped.set(id, { positions: [index], values: [valueItems[index]!] });
  });

  const result: QValue[] = Array.from({ length: valueItems.length }, () => qNull());
  for (const bucket of grouped.values()) {
    const aggregate = session.invoke(callee, [rebuildSequence(values, bucket.values)]);
    bucket.positions.forEach((position) => {
      result[position] = aggregate;
    });
  }

  return qList(result, result.every((item) => item.kind === result[0]?.kind));
};

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
  if (right.kind === "dictionary") {
    return qDictionary(right.keys, right.values.map((item) => session.invoke(left, [item])));
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
    const fast = adverb === "/" ? tryPrimitiveOver(base, args[0]!) : tryPrimitiveScan(base, args[0]!);
    if (fast) return fast;
    return applyAdverb(session, callable, args[0]!);
  }
  if (args.length === 2 && args[1]?.kind === "list") {
    const fast = adverb === "/" ? tryPrimitiveOver(base, args[1], args[0]!) : tryPrimitiveScan(base, args[1], args[0]!);
    if (fast) return fast;
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

const regexEscape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const qPatternToRegexSource = (pattern: string, options: { allowStar: boolean }) => {
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]!;
    if (char === "*") {
      if (!options.allowStar) throw new QRuntimeError("length", "ss/ssr patterns cannot contain *");
      source += ".*";
      continue;
    }
    if (char === "?") {
      source += ".";
      continue;
    }
    if (char === "[") {
      const end = pattern.indexOf("]", index + 1);
      if (end > index + 1) {
        const body = pattern.slice(index + 1, end);
        const negate = body.startsWith("^");
        const raw = negate ? body.slice(1) : body;
        source += `[${negate ? "^" : ""}${raw.replace(/\\/g, "\\\\")}]`;
        index = end;
        continue;
      }
    }
    source += regexEscape(char);
  }
  return source;
};

export const patternToRegex = (pattern: string) =>
  new RegExp(`^${qPatternToRegexSource(pattern, { allowStar: true })}$`);

export const likeValue = (left: QValue, right: QValue): QValue =>
  left.kind === "dictionary" && right.kind === "string"
    ? qDictionary(left.keys, left.values.map((value) => likeValue(value, right)))
    : mapBinary(left, right, (value, pattern) => {
    const text = stringLikeValue(value);
    if (text === null || pattern.kind !== "string") {
      throw new QRuntimeError("type", "like expects string arguments");
    }
    return qBool(patternToRegex(pattern.value).test(text));
  });

export const ssValue = (left: QValue, right: QValue): QValue => {
  if (left.kind !== "string" || right.kind !== "string") {
    throw new QRuntimeError("type", "ss expects string arguments");
  }
  if (right.value.length === 0) {
    throw new QRuntimeError("length", "ss pattern cannot be empty");
  }
  const matcher = new RegExp(`^(?:${qPatternToRegexSource(right.value, { allowStar: false })})`);
  const positions: QValue[] = [];
  let index = 0;
  while (index < left.value.length) {
    const match = matcher.exec(left.value.slice(index));
    if (match?.[0]) {
      positions.push(qLong(index));
      index += match[0].length;
      continue;
    }
    index += 1;
  }
  return qList(positions, true, positions.length === 0 ? "long" : undefined);
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
  if (
    left.kind === "list" &&
    left.attribute === "byte" &&
    (left.items.length === 0 ||
      (left.items.length === 1 &&
        left.items[0]?.kind === "number" &&
        toNumber(left.items[0]) === 0))
  ) {
    if (right.kind !== "list" || right.attribute !== "byte" || ![2, 4, 8].includes(right.items.length)) {
      throw new QRuntimeError("length", "0x0 sv expects 2, 4, or 8 bytes");
    }
    const bytes = right.items.map(toNumber);
    const buffer = Uint8Array.from(bytes).buffer;
    const view = new DataView(buffer);
    if (bytes.length === 2) return qShort(view.getInt16(0, false));
    if (bytes.length === 4) return qInt(view.getInt32(0, false));
    const value = view.getBigInt64(0, false);
    return qLongExact(value);
  }
  if (left.kind === "boolean" && !left.value) {
    if (right.kind !== "list" || !right.items.every((item) => item.kind === "boolean") || ![8, 16, 32, 64].includes(right.items.length)) {
      throw new QRuntimeError("length", "0b sv expects 8, 16, 32, or 64 bits");
    }
    const bytes = Array.from({ length: right.items.length / 8 }, (_, byteIndex) =>
      right.items
        .slice(byteIndex * 8, byteIndex * 8 + 8)
        .reduce((acc, bit, index) => acc | (bit.kind === "boolean" && bit.value ? 1 << (7 - index) : 0), 0)
    );
    const byteVector = qList(bytes.map((byte) => qLong(byte)), true, "byte");
    if (right.items.length === 8) return byteVector;
    return svValue(qList([], true, "byte"), byteVector);
  }
  if (left.kind === "number" || (left.kind === "list" && left.items.every((item) => item.kind === "number"))) {
    const bases = left.kind === "number" ? [toNumber(left)] : left.items.map(toNumber);
    const digits = asList(right).items.map(toNumber);
    if (bases.length === 1) {
      return qLong(digits.reduce((acc, digit) => acc * bases[0]! + digit, 0));
    }
    if (bases.length !== digits.length) {
      throw new QRuntimeError("length", "sv bases and digits must conform");
    }
    return qLong(digits.slice(1).reduce((acc, digit, index) => acc * bases[index + 1]! + digit, digits[0] ?? 0));
  }
  if (left.kind === "symbol" && left.value === "" && right.kind === "list") {
    if (right.items.every((item) => item.kind === "symbol")) {
      const parts = right.items.map((item) => (item.kind === "symbol" ? item.value : ""));
      return qSymbol(parts[0]?.startsWith(":") ? parts.join("/") : parts.join("."));
    }
    if (right.items.every((item) => item.kind === "string")) {
      const parts = right.items.map((item) => (item.kind === "string" ? item.value : ""));
      return qString(`${parts.join("\n")}\n`);
    }
  }
  if (left.kind !== "string" || right.kind !== "list") {
    throw new QRuntimeError("type", "sv expects a string separator and a list of strings");
  }
  const parts = right.items.map(stringLikeValue);
  if (parts.some((part) => part === null)) {
    throw new QRuntimeError("type", "sv expects a list of strings");
  }
  return qString((parts as string[]).join(left.value));
};

const numericBytes = (value: QNumber) => {
  const buffer = new ArrayBuffer(value.numericType === "short" || value.numericType === "real" ? 4 : 8);
  const view = new DataView(buffer);
  switch (value.numericType) {
    case "short":
      view.setInt16(0, toNumber(value), false);
      return [...new Uint8Array(buffer.slice(0, 2))];
    case "int":
      view.setInt32(0, toNumber(value), false);
      return [...new Uint8Array(buffer.slice(0, 4))];
    case "real":
      view.setFloat32(0, toNumber(value), false);
      return [...new Uint8Array(buffer.slice(0, 4))];
    case "float":
      view.setFloat64(0, toNumber(value), false);
      return [...new Uint8Array(buffer)];
    case "long": {
      const exact = value.exactText !== undefined ? BigInt(value.exactText) : BigInt(Math.trunc(toNumber(value)));
      view.setBigInt64(0, exact, false);
      return [...new Uint8Array(buffer)];
    }
  }
};

const byteRepresentationValue = (value: QValue): QValue => {
  if (value.kind !== "number") {
    throw new QRuntimeError("type", "0x0 vs expects a numeric right argument");
  }
  return qList(numericBytes(value).map((byte) => qLong(byte)), true, "byte");
};

const bitRepresentationValue = (value: QValue): QValue => {
  const bytes = byteRepresentationValue(value) as QList;
  const bits = bytes.items.flatMap((byte) => {
    const raw = toNumber(byte);
    return Array.from({ length: 8 }, (_, bit) => qBool(Boolean(raw & (1 << (7 - bit)))));
  });
  return qList(bits, true, "boolean");
};

export const vsValue = (left: QValue, right: QValue): QValue => {
  if (left.kind === "symbol" && left.value === "") {
    if (right.kind === "string") {
      const lines = right.value.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
      return qList(lines.map((line) => qString(line)), false);
    }
    if (right.kind === "symbol") {
      return qList(right.value.split(".").map((part) => qSymbol(part)), true, "symbol");
    }
  }
  if (left.kind === "boolean" && !left.value) {
    return bitRepresentationValue(right);
  }
  if (
    left.kind === "list" &&
    left.attribute === "byte" &&
    (left.items.length === 0 ||
      (left.items.length === 1 &&
        left.items[0]?.kind === "number" &&
        toNumber(left.items[0]) === 0))
  ) {
    return byteRepresentationValue(right);
  }
  if (left.kind === "number" || (left.kind === "list" && left.items.every((item) => item.kind === "number"))) {
    const bases = left.kind === "number" ? [toNumber(left)] : left.items.map(toNumber);
    const encodeOne = (value: QValue): QValue[] => {
      let remaining = Math.trunc(toNumber(value));
      const digits = bases.length === 1 ? [] as QValue[] : Array.from({ length: bases.length }, () => qLong(0));
      if (bases.length === 1) {
        const base = bases[0]!;
        if (remaining === 0) return [qLong(0)];
        const output: QValue[] = [];
        while (remaining > 0) {
          output.unshift(qLong(remaining % base));
          remaining = Math.floor(remaining / base);
        }
        return output;
      }
      for (let index = bases.length - 1; index >= 0; index -= 1) {
        const base = bases[index]!;
        digits[index] = qLong(remaining % base);
        remaining = Math.floor(remaining / base);
      }
      return digits;
    };
    if (right.kind === "list") {
      const encoded = right.items.map(encodeOne);
      const width = Math.max(0, ...encoded.map((item) => item.length));
      return qList(
        Array.from({ length: width }, (_, row) =>
          qList(encoded.map((digits) => digits[row - (width - digits.length)] ?? qLong(0)), true)
        ),
        false
      );
    }
    return qList(encodeOne(right), true);
  }
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
  const bounds =
    right.kind === "string"
      ? [...right.value].map((char) => qString(char))
      : right.kind === "list"
        ? right.items
        : null;
  if (!bounds || bounds.length !== 2) {
    throw new QRuntimeError("type", "within expects a two-item right argument");
  }

  const [lower, upper] = bounds;
  const withinScalar = (value: QValue, lowerBound: QValue, upperBound: QValue) =>
    qBool(compare(value, lowerBound) >= 0 && compare(value, upperBound) <= 0);

  if (left.kind === "list") {
    return qList(
      left.items.map((item, index) =>
        item.kind === "list" || item.kind === "string"
          ? withinValue(item, right)
          : withinScalar(
          item,
          resolveWithinBound(lower, index, left.items.length),
          resolveWithinBound(upper, index, left.items.length)
        )
      ),
      true
    );
  }
  if (left.kind === "string") {
    return qList([...left.value].map((char) => withinScalar(qString(char), lower, upper)), true);
  }

  return withinScalar(left, resolveWithinBound(lower, 0, 1), resolveWithinBound(upper, 0, 1));
};

const tableRows = (table: QTable): QDictionary[] =>
  Array.from({ length: tableRowCount(table) }, (_, index) => rowFromTable(table, index));

export const exceptValue = (left: QValue, right: QValue): QValue => {
  if (left.kind === "table" && right.kind === "table") {
    const rightRows = tableRows(right);
    return selectTableRows(
      left,
      tableRows(left)
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => !rightRows.some((candidate) => equals(candidate, row)))
        .map(({ index }) => index)
    );
  }
  const rightItems = asSequenceItems(right);
  return rebuildSequence(
    left,
    asSequenceItems(left).filter(
      (item) => !rightItems.some((candidate) => equals(candidate, item))
    )
  );
};

export const interValue = (left: QValue, right: QValue): QValue => {
  if (left.kind === "dictionary" && right.kind === "dictionary") {
    const values = left.values.filter((value) => right.values.some((candidate) => equals(candidate, value)));
    return qList(values, values.every((value) => value.kind === values[0]?.kind));
  }
  if (left.kind === "table" && right.kind === "table") {
    const rightRows = tableRows(right);
    return selectTableRows(
      left,
      tableRows(left)
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => rightRows.some((candidate) => equals(candidate, row)))
        .map(({ index }) => index)
    );
  }
  const rightItems = asSequenceItems(right);
  return rebuildSequence(
    left,
    asSequenceItems(left).filter((item) => rightItems.some((candidate) => equals(candidate, item)))
  );
};

export const unionValue = (left: QValue, right: QValue): QValue => {
  if (left.kind === "table" && right.kind === "table") {
    return distinctValue(concatTables(left, right));
  }
  return rebuildSequence(left, distinctItems([...asSequenceItems(left), ...asSequenceItems(right)]));
};

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
  if (value.kind === "table") return mappedTable(value, nullValue);
  if (value.kind === "dictionary") return mappedDictionary(value, nullValue);
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

  const sourceRowsAreStrings = value.items.every((item) => item.kind === "string");
  return qList(
    Array.from({ length: width }, (_, columnIndex) => {
      const column = rows.map((row) => row[columnIndex]!);
      if (sourceRowsAreStrings && column.every((item) => item.kind === "string")) {
        return qString(column.map((item) => (item.kind === "string" ? item.value : "")).join(""));
      }
      return qList(
        column,
        column.every((item) => item.kind === column[0]?.kind)
      );
    }),
    false
  );
};

export const flipValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return flipListValue(value);
  }
  if (value.kind === "table") {
    return qDictionary(
      Object.keys(value.columns).map((name) => qSymbol(name)),
      Object.values(value.columns)
    );
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
    if (value.kind === "string") {
      const seen = new Set<string>();
      return qString([...value.value].filter((char) => {
        if (seen.has(char)) return false;
        seen.add(char);
        return true;
      }).join(""));
    }
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
  if (value.kind === "dictionary") {
    const keys = value.keys;
    const values = value.values;
    if (values.every((item) => item.kind === "boolean")) {
      return qList(
        values.flatMap((item, index) => isTruthy(item) ? [keys[index] ?? qNull()] : []),
        true,
        keys.every((key) => key.kind === "symbol") ? "symbol" : undefined
      );
    }
    const items = values.flatMap((item, index) => {
      if (item.kind !== "number" || (item.numericType !== "int" && item.numericType !== "long")) {
        throw new QRuntimeError("type", "where expects int or long counts");
      }
      if (isNumericNull(item) || item.value < 0) {
        throw new QRuntimeError("limit", "where expects non-negative counts");
      }
      return Array.from({ length: Math.trunc(item.value) }, () => keys[index] ?? qNull());
    });
    return qList(items, items.every((item) => item.kind === items[0]?.kind));
  }

  const list = asList(value);
  if (list.items.every((item) => item.kind === "boolean")) {
    const items = list.items.flatMap((item, index) => isTruthy(item) ? [qLong(index)] : []);
    return qList(items, true);
  }
  if (list.items.every((item) => item.kind === "number")) {
    const items = list.items.flatMap((item, index) => {
      if (item.kind !== "number" || (item.numericType !== "int" && item.numericType !== "long")) {
        throw new QRuntimeError("type", "where expects int or long counts");
      }
      if (isNumericNull(item) || item.value < 0) {
        throw new QRuntimeError("limit", "where expects non-negative counts");
      }
      return Array.from({ length: Math.trunc(item.value) }, () => qLong(index));
    });
    return qList(items, true);
  }
  throw new QRuntimeError("type", "where expects booleans or int/long counts");
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
  if (value.kind === "dictionary") {
    return razeValue(qList(value.values, false));
  }
  if (value.kind === "table") {
    const rowCount = tableRowCount(value);
    return rowCount === 0 ? qDictionary([], []) : rowFromTable(value, rowCount - 1);
  }
  if (value.kind !== "list") {
    return value;
  }
  if (value.items.length === 0) {
    return qList([]);
  }
  return value.items.reduce((acc, item) => concatValues(acc, item));
};

export const takeValue = (left: QValue, right: QValue): QValue => {
  if (left.kind === "symbol") {
    return setAttributeValue(left, right);
  }
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
      return qList([], right.homogeneous ?? false, emptyAttributeForList(right));
    }
    const n = Math.abs(count);
    const len = right.items.length;
    const items =
      count >= 0
        ? Array.from({ length: n }, (_, index) => right.items[index % len]!)
        : Array.from({ length: n }, (_, index) => right.items[((len - n + index) % len + len) % len]!);
    return listWithPreservedEmptyType(items, right);
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
  const items = Array.from({ length: Math.abs(count) }, () => right);
  return qList(items, items.every((item) => item.kind === right.kind), items.length === 0 ? attributeForAtom(right) : undefined);
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
        segments.push(listWithPreservedEmptyType(right.items.slice(start, end), right));
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
      return listWithPreservedEmptyType(right.items.slice(0, Math.max(0, right.items.length + count)), right);
    }
    return listWithPreservedEmptyType(right.items.slice(Math.max(0, count)), right);
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
  if (left.kind === "dictionary" && right.kind === "dictionary") {
    const keys = [...left.keys];
    for (const key of right.keys) {
      if (!keys.some((candidate) => equals(candidate, key))) {
        keys.push(key);
      }
    }
    const lookup = (dictionary: QDictionary, key: QValue) => {
      const index = dictionary.keys.findIndex((candidate) => equals(candidate, key));
      return index < 0 ? null : dictionary.values[index] ?? qNull();
    };
    return qDictionary(
      keys,
      keys.map((key) => {
        const rightValue = lookup(right, key);
        const leftValue = lookup(left, key);
        return rightValue === null || isNullish(rightValue)
          ? (leftValue ?? qNull())
          : rightValue;
      })
    );
  }
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
  const permute = Number.isNaN(count);

  if (source.kind === "number") {
    const limit = Math.max(0, Math.trunc(toNumber(source)));
    const pool = Array.from({ length: limit }, (_, index) => qLong(index));
    if (permute) {
      return qList(shuffleItems(pool), true, "explicitInt");
    }
    if (distinct && size > pool.length) {
      throw new QRuntimeError("length", "length");
    }
    const picks = distinct
      ? shuffleItems(pool).slice(0, size)
      : Array.from({ length: size }, () => qLong(Math.floor(Math.random() * Math.max(limit, 1))));
    return qList(picks, true, "explicitInt");
  }

  const items = asSequenceItems(source);
  if (items.length === 0) {
    return rebuildSequence(source, []);
  }
  if (permute) {
    return rebuildSequence(source, shuffleItems(items));
  }
  if (distinct && size > items.length) {
    throw new QRuntimeError("length", "length");
  }

  const picks = distinct
    ? shuffleItems(items).slice(0, size)
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
    return sampleSequence(isNumericNull(left) ? Number.NaN : left.value, right);
  }
  if (left.kind === "string") {
    const lookup = (item: QValue) => {
      if (item.kind !== "string") return qLong(left.value.length);
      const char = item.value[0] ?? "";
      const index = left.value.indexOf(char);
      return qLong(index >= 0 ? index : left.value.length);
    };
    if (right.kind === "string") {
      const chars = [...right.value];
      if (chars.length === 1) return lookup(qString(chars[0]!));
      return qList(chars.map((char) => lookup(qString(char))), true);
    }
    if (right.kind === "list") return qList(right.items.map(lookup), true);
    return lookup(right);
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
  { aliases: ["*", "0h"], cast: (value) => value },
  { aliases: ["", "symbol", "11h"], cast: (value) => castSymbolValue(value) },
  { aliases: ["boolean", "bool", "1h"], cast: (value) => castBooleanValue(value) },
  { aliases: ["byte", "x", "4h"], cast: (value) => castByteValue(value) },
  { aliases: ["short", "h", "5h"], cast: (value) => castShortValue(value) },
  { aliases: ["int", "i", "6h"], cast: (value) => castIntValue(value) },
  { aliases: ["long", "j", "7h"], cast: (value) => castLongValue(value) },
  { aliases: ["real", "e", "8h"], cast: (value) => castRealValue(value) },
  { aliases: ["float", "f", "9h"], cast: (value) => castFloatValue(value) },
  { aliases: ["10h", "char", "string"], cast: (value) => castCharValue(value) },
  { aliases: ["timestamp", "p", "12h"], cast: (value) => castTemporalValue(value, "timestamp") },
  { aliases: ["month", "m", "13h"], cast: (value) => castTemporalValue(value, "month") },
  { aliases: ["date", "d", "14h"], cast: (value) => castDateValue(value) },
  { aliases: ["datetime", "z", "15h"], cast: (value) => castTemporalValue(value, "datetime") },
  { aliases: ["timespan", "n", "16h"], cast: (value) => castTemporalValue(value, "timespan") },
  { aliases: ["minute", "u", "17h"], cast: (value) => castTemporalValue(value, "minute") },
  { aliases: ["second", "v", "18h"], cast: (value) => castTemporalValue(value, "second") },
  { aliases: ["time", "t", "19h"], cast: (value) => castTemporalValue(value, "time") }
];

export const CAST_HANDLER_BY_NAME = new Map<string, CastHandler>(
  CAST_ALIAS_GROUPS.flatMap(({ aliases, cast }) => aliases.map((alias) => [alias, cast] as const))
);

const parseBigIntegerToken = (text: string) => (/^[+-]?\d+$/.test(text.trim()) ? BigInt(text.trim()) : null);
const parseIntegerToken = (text: string) => (/^[+-]?\d+$/.test(text.trim()) ? Number.parseInt(text, 10) : null);
const parseFloatToken = (text: string) => (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text.trim()) ? Number.parseFloat(text) : null);
const parseByteToken = (text: string) => (/^[0-9a-fA-F]{2}$/.test(text.trim()) ? Number.parseInt(text.trim(), 16) : 0);
const parseIpToken = (text: string) => {
  const parts = text.trim().split(".");
  if (parts.length !== 4) return null;
  const bytes = parts.map((part) => (/^\d+$/.test(part) ? Number.parseInt(part, 10) : Number.NaN));
  if (bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) return null;
  return ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) | 0;
};

const tokShortInteger = (text: string) => {
  const parsed = parseBigIntegerToken(text);
  if (parsed === null) return qShort(0, "shortNull");
  if (parsed === BigInt(Q_SHORT_MAX)) return qShort(Q_SHORT_MAX, "shortPosInf");
  if (parsed <= BigInt(-Q_SHORT_MAX - 1) || parsed > BigInt(Q_SHORT_MAX)) return qShort(0, "shortNull");
  return qShort(Number(parsed));
};

const tokIntInteger = (text: string) => {
  const ip = parseIpToken(text);
  if (ip !== null) return qInt(ip);
  const parsed = parseBigIntegerToken(text);
  if (parsed === null) return qInt(0, "intNull");
  if (parsed === BigInt(Q_INT_MAX)) return qInt(Q_INT_MAX, "intPosInf");
  if (parsed <= BigInt(-Q_INT_MAX - 1) || parsed > BigInt(Q_INT_MAX)) return qInt(0, "intNull");
  return qInt(Number(parsed));
};

const tokLongInteger = (text: string) => {
  const parsed = parseBigIntegerToken(text);
  if (parsed === null) return qLong(0, "longNull");
  if (parsed === Q_LONG_MAX_BIGINT) return qLong(Q_LONG_MAX, "longPosInf");
  if (parsed === -Q_LONG_MAX_BIGINT) return qLong(-Q_LONG_MAX, "longNegInf");
  if (parsed < -Q_LONG_MAX_BIGINT || parsed > Q_LONG_MAX_BIGINT) return qLong(0, "longNull");
  return qLongExact(parsed);
};

const TOK_NAME_BY_NEGATIVE_SHORT: Record<string, string> = {
  "-1h": "B",
  "-4h": "X",
  "-5h": "H",
  "-6h": "I",
  "-7h": "J",
  "-8h": "E",
  "-9h": "F",
  "-10h": "C",
  "-11h": "S",
  "-12h": "P",
  "-13h": "M",
  "-14h": "D",
  "-15h": "Z",
  "-16h": "N",
  "-17h": "U",
  "-18h": "V",
  "-19h": "T"
};

const tokTemporalPatterns: Record<TemporalType, RegExp> = {
  timestamp: /^\d{4}\.\d{2}\.\d{2}D\d{1,2}:\d{2}:\d{2}\.\d{9}$/,
  month: /^\d{4}\.\d{2}m?$/,
  date: /^\d{4}\.\d{2}\.\d{2}$|^0Nd$/,
  datetime: /^\d{4}\.\d{2}\.\d{2}T\d{1,2}:\d{2}:\d{2}\.\d{3}$/,
  timespan: /^-?\d+D\d{1,2}:\d{2}:\d{2}\.\d{9}$/,
  minute: /^\d{1,2}:\d{2}$/,
  second: /^\d{1,2}:\d{2}:\d{2}$/,
  time: /^\d{1,2}:\d{2}:\d{2}\.\d{3}$/
};

const normalizeDateToken = (text: string) => {
  const trimmed = text.trim();
  const dashed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dashed) return `${dashed[1]}.${dashed[2]}.${dashed[3]}`;
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(trimmed);
  if (compact) return `${compact[1]}.${compact[2]}.${compact[3]}`;
  return trimmed;
};

const normalizeFraction = (text: string, width: number) => text.padEnd(width, "0").slice(0, width);

const normalizeRawTimeToken = (text: string, fractionWidth: 3 | 9, prefix = "") => {
  const raw = text.trim();
  const match = /^(\d{2})(\d{2})(\d{2})(\d*)$/.exec(raw);
  if (!match) return null;
  const fraction = normalizeFraction(match[4] ?? "", fractionWidth);
  return `${prefix}${match[1]}:${match[2]}:${match[3]}.${fraction}`;
};

const normalizeTemporalToken = (text: string, temporalType: TemporalType) => {
  const trimmed = text.trim();
  if (temporalType === "date") {
    const date = normalizeDateToken(trimmed);
    return tokTemporalPatterns.date.test(date) ? date : temporalNullForType(temporalType);
  }
  if (temporalType === "timestamp" || temporalType === "datetime") {
    const match = /^(\d{4}[-.]?\d{2}[-.]?\d{2})([DT-])(\d{1,2}:\d{2}:\d{2})(?:\.(\d{1,9}))?$/.exec(trimmed);
    if (match) {
      const date = normalizeDateToken(match[1]!);
      const separator = temporalType === "timestamp" ? "D" : "T";
      const fraction = normalizeFraction(match[4] ?? "", temporalType === "timestamp" ? 9 : 3);
      return `${date}${separator}${match[3]}.${fraction}`;
    }
  }
  if (temporalType === "time") {
    const rawTime = normalizeRawTimeToken(trimmed, 3);
    if (rawTime) return rawTime;
  }
  if (temporalType === "timespan") {
    const rawTimespan = normalizeRawTimeToken(trimmed, 9, "0D");
    if (rawTimespan) return rawTimespan;
  }
  if (temporalType === "minute" && /^\d{1,2}:\d{2}:\d{2}/.test(trimmed)) {
    return trimmed.slice(0, trimmed.indexOf(":", trimmed.indexOf(":") + 1));
  }
  if (!tokTemporalPatterns[temporalType].test(trimmed)) return temporalNullForType(temporalType);
  if (temporalType === "month" && !trimmed.endsWith("m")) return `${trimmed}m`;
  return trimmed;
};

const tokAtom = (name: string, value: QValue): QValue => {
  if (value.kind !== "string") {
    throw new QRuntimeError("type", `${name}$ expects strings`);
  }
  switch (name) {
    case "B":
      return qBool(/^[txyTXY1]$/.test(value.value.trim()));
    case "C":
      return qString(value.value.length === 1 ? value.value : " ");
    case "X":
      return qList([qLong(parseByteToken(value.value))], true, "byte");
    case "H": {
      return tokShortInteger(value.value);
    }
    case "I": {
      return tokIntInteger(value.value);
    }
    case "J": {
      return tokLongInteger(value.value);
    }
    case "E": {
      const parsed = parseFloatToken(value.value);
      return parsed === null ? qReal(0, "realNull") : qReal(parsed);
    }
    case "F": {
      const parsed = parseFloatToken(value.value);
      return parsed === null ? qFloat(Number.NaN, "null") : qFloat(parsed);
    }
    case "S":
      return qSymbol(value.value.trim());
    case "D":
      return qTemporal("date", normalizeTemporalToken(value.value, "date"));
    case "M":
      return qTemporal("month", normalizeTemporalToken(value.value, "month"));
    case "U":
      return qTemporal("minute", normalizeTemporalToken(value.value, "minute"));
    case "V":
      return qTemporal("second", normalizeTemporalToken(value.value, "second"));
    case "T":
      return qTemporal("time", normalizeTemporalToken(value.value, "time"));
    case "N":
      return qTemporal("timespan", normalizeTemporalToken(value.value, "timespan"));
    case "P":
      return qTemporal("timestamp", normalizeTemporalToken(value.value, "timestamp"));
    case "Z":
      return qTemporal("datetime", normalizeTemporalToken(value.value, "datetime"));
    default:
      throw new QRuntimeError("nyi", `Tok ${name}$ is not implemented yet`);
  }
};

const tokValue = (name: string, value: QValue): QValue => {
  if (name.length > 1) {
    if (value.kind !== "list") {
      throw new QRuntimeError("length", `${name}$ expects a list of matching tokens`);
    }
    return qList(
      [...name].map((char, index) => tokValue(char, value.items[index] ?? qNull())),
      false,
      "tokTuple"
    );
  }
  if (value.kind === "list") {
    if (name === "X") {
      return qList(
        value.items.map((item) => {
          if (item.kind !== "string") throw new QRuntimeError("type", "X$ expects strings");
          return qLong(parseByteToken(item.value));
        }),
        true,
        "byte"
      );
    }
    const items = value.items.map((item) => tokAtom(name, item));
    return qList(items, items.every((item) => item.kind === items[0]?.kind), items[0]?.kind === "temporal" ? items[0].temporalType : undefined);
  }
  return tokAtom(name, value);
};

const temporalDateText = (value: QValue) => {
  if (value.kind !== "temporal") return null;
  if (value.temporalType === "date" || value.temporalType === "month") return value.value;
  if (value.temporalType === "timestamp") return value.value.split("D")[0] ?? null;
  if (value.temporalType === "datetime") return value.value.split("T")[0] ?? null;
  return null;
};

const temporalTimeText = (value: QValue) => {
  if (value.kind !== "temporal") return null;
  if (value.temporalType === "minute" || value.temporalType === "second" || value.temporalType === "time") return value.value;
  if (value.temporalType === "timespan") return value.value.split("D")[1] ?? null;
  if (value.temporalType === "timestamp") return value.value.split("D")[1] ?? null;
  if (value.temporalType === "datetime") return value.value.split("T")[1] ?? null;
  return null;
};

const temporalExtractorAtom = (name: string, value: QValue): QValue => {
  const dateText = temporalDateText(value);
  if ((name === "year" || name === "mm" || name === "dd") && dateText) {
    const clean = dateText.replace(/m$/, "");
    const [year, month, day] = clean.split(".").map((part) => Number.parseInt(part, 10));
    if (name === "year") return qInt(year || 0);
    if (name === "mm") return qInt(month || 0);
    return qInt(day || 0);
  }

  const timeText = temporalTimeText(value);
  if ((name === "hh" || name === "uu" || name === "ss") && timeText) {
    const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(timeText);
    if (!match) return qInt(0, "intNull");
    if (name === "hh") return qInt(Number.parseInt(match[1]!, 10));
    if (name === "uu") return qInt(Number.parseInt(match[2]!, 10));
    return qInt(Number.parseInt(match[3] ?? "0", 10));
  }

  throw new QRuntimeError("type", `${name}$ expects temporal values`);
};

const temporalExtractorValue = (name: string, value: QValue): QValue => {
  if (value.kind === "list") {
    return qList(value.items.map((item) => temporalExtractorAtom(name, item)), true, "int");
  }
  return temporalExtractorAtom(name, value);
};

const TEMPORAL_EXTRACT_CASTS = new Set(["year", "mm", "dd", "hh", "uu", "ss"]);

const padString = (width: number, value: string) => {
  const size = Math.abs(Math.trunc(width));
  if (value.length >= size) return width < 0 ? value.slice(value.length - size) : value.slice(0, size);
  const padding = " ".repeat(size - value.length);
  return width < 0 ? `${padding}${value}` : `${value}${padding}`;
};

const qPaddedString = (value: string): QString => ({ ...qString(value), displayAsString: true } as QString);

export const padValue = (widthValue: QNumber, value: QValue): QValue => {
  const width = toNumber(widthValue);
  if (value.kind === "string") {
    return qPaddedString(padString(width, value.value));
  }
  if (value.kind === "list") {
    return qList(value.items.map((item) => padValue(widthValue, item)), false);
  }
  if (value.kind === "dictionary") {
    return qDictionary(value.keys, value.values.map((item) => padValue(widthValue, item)));
  }
  if (value.kind === "table") {
    return qTable(
      Object.fromEntries(
        Object.entries(value.columns).map(([name, column]) => [
          name,
          qList(column.items.map((item) => padValue(widthValue, item)), false)
        ])
      )
    );
  }
  if (value.kind === "keyedTable") {
    return qKeyedTable(padValue(widthValue, value.keys) as QTable, padValue(widthValue, value.values) as QTable);
  }
  return padValue(widthValue, stringValue(value));
};

export const castValue = (left: QValue, right: QValue): QValue => {
  if (left.kind === "list") {
    if (right.kind === "list" && right.items.length === left.items.length) {
      return qList(
        left.items.map((castSpec, index) => castValue(castSpec, right.items[index]!)),
        false
      );
    }
    return qList(left.items.map((castSpec) => castValue(castSpec, right)), false);
  }
  if (left.kind === "number" && left.numericType === "long" && Number.isInteger(left.value)) {
    return padValue(left, right);
  }

  const castName = castNameFromLeftOperand(left);
  if (castName === null) {
    throw new QRuntimeError("type", "Cast expects a symbol or string on the left");
  }

  const cast = CAST_HANDLER_BY_NAME.get(castName);
  if (cast) {
    return cast(right);
  }
  if (TEMPORAL_EXTRACT_CASTS.has(castName)) {
    return temporalExtractorValue(castName, right);
  }
  const tokName = TOK_NAME_BY_NEGATIVE_SHORT[castName] ?? castName;
  if (/^[A-Z]+$/.test(tokName)) {
    return tokValue(tokName, right);
  }
  throw new QRuntimeError("nyi", `Cast ${castName}$ is not implemented yet`);
};

export const foreignKeyValue = (name: string, parent: QValue, value: QValue): QValue => {
  if (parent.kind !== "keyedTable") {
    throw new QRuntimeError("type", "Foreign-key casts expect a keyed table");
  }
  const keyNames = tableColumnNames(parent.keys);
  if (keyNames.length !== 1) {
    throw new QRuntimeError("type", "Foreign-key casts expect a single-key table");
  }
  const domain = parent.keys.columns[keyNames[0]!]!.items;
  const ensureInDomain = (item: QValue) => {
    if (item.kind !== "symbol") {
      throw new QRuntimeError("type", "Foreign-key casts expect symbols");
    }
    if (!domain.some((candidate) => equals(candidate, item))) {
      throw new QRuntimeError("cast", item.value);
    }
    return item;
  };
  if (value.kind === "list") {
    return { ...value, items: value.items.map(ensureInDomain), homogeneous: true, foreignKey: name };
  }
  return { ...qList([ensureInDomain(value)], true), foreignKey: name };
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
  for (const name of keyNames) {
    if (!table.columns[name]) {
      throw new QRuntimeError("name", name);
    }
  }
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
  if (pat === "") throw new QRuntimeError("length", "ssr pattern cannot be empty");
  const matcher = new RegExp(qPatternToRegexSource(pat, { allowStar: false }), "g");
  return qString(text.value.replace(matcher, rep));
};

export const leftJoin = (left: QValue, right: QValue, options: { fill?: boolean } = {}): QValue => {
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
        const candidate = sourceCol[matchIdx]!;
        if (!options.fill || !isNullish(candidate)) {
          targetList[i] = candidate;
        }
      }
    }
  }
  return qTable(resultCols);
};

export const innerJoin = (left: QValue, right: QValue, options: { fill?: boolean } = {}): QValue => {
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
    resultCols[name] = qList(
      rightMatchPositions.map((p, index) => {
        const candidate = right.values.columns[name]!.items[p]!;
        const leftItem = lt.columns[name]?.items[resultPositions[index]!];
        return options.fill && leftItem && isNullish(candidate) ? leftItem : candidate;
      }),
      true
    );
  }
  return qTable(resultCols);
};

export const unionJoin = (left: QValue, right: QValue, options: { fill?: boolean } = {}): QValue => {
  if (left.kind === "keyedTable" && right.kind === "keyedTable") {
    const keyNames = tableColumnNames(left.keys);
    const rightKeyNames = tableColumnNames(right.keys);
    if (keyNames.length !== rightKeyNames.length || keyNames.some((name, index) => name !== rightKeyNames[index])) {
      throw new QRuntimeError("type", "uj expects matching key columns for keyed tables");
    }

    const leftValNames = tableColumnNames(left.values);
    const rightValNames = tableColumnNames(right.values);
    const valNames = Array.from(new Set([...leftValNames, ...rightValNames]));
    const keyCols: Record<string, QValue[]> = Object.fromEntries(
      keyNames.map((name) => [name, [...left.keys.columns[name]!.items]])
    );
    const valCols: Record<string, QValue[]> = Object.fromEntries(
      valNames.map((name) => {
        const source = left.values.columns[name];
        return [name, source ? [...source.items] : Array(tableRowCount(left.keys)).fill(nullLike(right.values.columns[name]?.items[0]))];
      })
    );

    const leftRows = tableRowCount(left.keys);
    const rightRows = tableRowCount(right.keys);
    const findMatch = (rightRow: number) => {
      for (let leftRow = 0; leftRow < leftRows; leftRow += 1) {
        if (keyNames.every((name) => equals(left.keys.columns[name]!.items[leftRow]!, right.keys.columns[name]!.items[rightRow]!))) {
          return leftRow;
        }
      }
      return -1;
    };

    for (let rightRow = 0; rightRow < rightRows; rightRow += 1) {
      const match = findMatch(rightRow);
      if (match >= 0) {
        for (const name of rightValNames) {
          const candidate = right.values.columns[name]!.items[rightRow]!;
          if (!options.fill || !isNullish(candidate)) {
            valCols[name]![match] = candidate;
          }
        }
        continue;
      }

      for (const name of keyNames) {
        keyCols[name]!.push(right.keys.columns[name]!.items[rightRow]!);
      }
      for (const name of valNames) {
        valCols[name]!.push(right.values.columns[name]?.items[rightRow] ?? nullLike(left.values.columns[name]?.items[0]));
      }
    }

    return qKeyedTable(
      qTable(Object.fromEntries(keyNames.map((name) => [name, qList(keyCols[name]!, true)]))),
      qTable(Object.fromEntries(valNames.map((name) => [name, qList(valCols[name]!, false)])))
    );
  }

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
    return qSymbol(value.value.trim());
  }
  if (value.kind === "symbol") {
    return value;
  }
  if (value.kind === "list") {
    return qList(value.items.map(castSymbolAtom), true, value.items.length === 0 ? "symbol" : undefined);
  }
  throw new QRuntimeError("type", "symbol$ expects strings or symbols");
};

export const castSymbolAtom = (value: QValue): QValue => {
  if (value.kind === "temporal") {
    return qSymbol(value.value);
  }
  if (value.kind === "string") {
    return qSymbol(value.value.trim());
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
    return qList(value.items.map(castBooleanAtom), true, value.items.length === 0 ? "boolean" : undefined);
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
      true,
      value.items.length === 0 ? "short" : undefined
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
    return qShort(roundHalfAwayFromZero(value.value));
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
  if (value.kind === "dictionary") {
    return qDictionary(value.keys, value.values.map((item) => stringValue(item)));
  }
  if (value.kind === "table") {
    return qTable(
      Object.fromEntries(
        Object.entries(value.columns).map(([name, column]) => [
          name,
          qList(column.items.map((item) => stringValue(item)), false)
        ])
      )
    );
  }
  if (value.kind === "keyedTable") {
    return qKeyedTable(stringValue(value.keys) as QTable, stringValue(value.values) as QTable);
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
    return qLong(roundHalfAwayFromZero(value.value));
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
    return qInt(roundHalfAwayFromZero(value.value));
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
      true,
      value.items.length === 0 ? "float" : undefined
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

const pad2 = (value: number) => String(value).padStart(2, "0");
const pad3 = (value: number) => String(value).padStart(3, "0");
const pad9 = (value: number) => String(value).padStart(9, "0");

const positiveMod = (value: number, modulus: number) => ((value % modulus) + modulus) % modulus;

const randNatural = (upperInclusive: number) =>
  Math.floor(Math.random() * (Math.max(0, Math.trunc(upperInclusive)) + 1));

const formatMonthFromMonths = (months: number) => {
  const year = 2000 + Math.floor(months / 12);
  const month = positiveMod(months, 12) + 1;
  return `${year}.${pad2(month)}m`;
};

const parseMonthMonths = (value: string) => {
  const [yearText, monthText] = value.replace(/m$/, "").split(".");
  return (Number.parseInt(yearText ?? "2000", 10) - 2000) * 12 + Number.parseInt(monthText ?? "1", 10) - 1;
};

const parseClockParts = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,9}))?$/.exec(value);
  if (!match) return { hours: 0, minutes: 0, seconds: 0, fraction: "" };
  return {
    hours: Number.parseInt(match[1]!, 10),
    minutes: Number.parseInt(match[2]!, 10),
    seconds: Number.parseInt(match[3] ?? "0", 10),
    fraction: match[4] ?? ""
  };
};

const parseMinuteUnits = (value: string) => {
  const parts = parseClockParts(value);
  return parts.hours * 60 + parts.minutes;
};

const parseSecondUnits = (value: string) => {
  const parts = parseClockParts(value);
  return parts.hours * 3600 + parts.minutes * 60 + parts.seconds;
};

const parseTimeMillis = (value: string) => {
  const parts = parseClockParts(value);
  const millis = Number.parseInt(parts.fraction.padEnd(3, "0").slice(0, 3) || "0", 10);
  return parseSecondUnits(value) * 1000 + millis;
};

const parseClockNanos = (value: string) => {
  const parts = parseClockParts(value);
  const nanos = Number.parseInt(parts.fraction.padEnd(9, "0").slice(0, 9) || "0", 10);
  return parseSecondUnits(value) * 1_000_000_000 + nanos;
};

const parseTimespanNanos = (value: string) => {
  const match = /^(-?\d+)D(.+)$/.exec(value);
  if (!match) return parseClockNanos(value);
  return Number.parseInt(match[1]!, 10) * 24 * 60 * 60 * 1_000_000_000 + parseClockNanos(match[2]!);
};

const parseTimestampNanos = (value: string) => {
  const [date, time = "00:00:00.000000000"] = value.split("D");
  return parseQDateDays(date ?? "2000.01.01") * 24 * 60 * 60 * 1_000_000_000 + parseClockNanos(time);
};

const parseDatetimeMillis = (value: string) => {
  const [date, time = "00:00:00.000"] = value.split("T");
  return parseQDateDays(date ?? "2000.01.01") * 24 * 60 * 60 * 1000 + parseTimeMillis(time);
};

const formatClockFromUnits = (units: number, unitsPerSecond: number, precision: "minute" | "second" | "millisecond" | "nanosecond") => {
  const dayUnits = 24 * 60 * 60 * unitsPerSecond;
  const wrapped = positiveMod(Math.trunc(units), dayUnits);
  const hours = Math.floor(wrapped / (60 * 60 * unitsPerSecond));
  const minutes = Math.floor((wrapped % (60 * 60 * unitsPerSecond)) / (60 * unitsPerSecond));
  const seconds = Math.floor((wrapped % (60 * unitsPerSecond)) / unitsPerSecond);
  const subsecond = wrapped % unitsPerSecond;
  if (precision === "minute") return `${pad2(hours)}:${pad2(minutes)}`;
  if (precision === "second") return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  if (precision === "millisecond") return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}.${pad3(subsecond)}`;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}.${pad9(subsecond)}`;
};

const formatTimespanFromNanos = (nanos: number) => {
  const dayNanos = 24 * 60 * 60 * 1_000_000_000;
  const whole = Math.trunc(nanos);
  const days = Math.trunc(whole / dayNanos);
  const rem = Math.abs(whole - days * dayNanos);
  return `${days}D${formatClockFromUnits(rem, 1_000_000_000, "nanosecond")}`;
};

const formatTimestampFromNanos = (nanos: number) => {
  const dayNanos = 24 * 60 * 60 * 1_000_000_000;
  const whole = Math.trunc(nanos);
  const days = Math.floor(whole / dayNanos);
  const rem = whole - days * dayNanos;
  return `${formatQDateFromDays(days)}D${formatClockFromUnits(rem, 1_000_000_000, "nanosecond")}`;
};

const formatDatetimeFromDays = (days: number) => `${formatQDateFromDays(Math.trunc(days))}T00:00:00.000`;

const formatDatetimeFromMillis = (millis: number) => {
  const dayMillis = 24 * 60 * 60 * 1000;
  const whole = Math.trunc(millis);
  const days = Math.floor(whole / dayMillis);
  const rem = whole - days * dayMillis;
  return `${formatQDateFromDays(days)}T${formatClockFromUnits(rem, 1000, "millisecond")}`;
};

export const castTemporalValue = (value: QValue, temporalType: TemporalType): QValue => {
  if (value.kind === "list") {
    return qList(value.items.map((item) => castTemporalAtom(item, temporalType)), true, temporalType);
  }
  return castTemporalAtom(value, temporalType);
};

export const castTemporalAtom = (value: QValue, temporalType: TemporalType): QValue => {
  if (temporalType === "date") return castDateAtom(value);
  if (value.kind === "temporal" && value.temporalType === temporalType) return value;
  if (value.kind === "null" || (value.kind === "number" && isNumericNull(value))) {
    return qTemporal(temporalType, temporalNullForType(temporalType));
  }
  const raw =
    value.kind === "number" ? Math.trunc(value.value) :
    value.kind === "boolean" ? (value.value ? 1 : 0) :
    null;
  if (raw === null) {
    throw new QRuntimeError("type", `${temporalType}$ expects numeric values`);
  }
  switch (temporalType) {
    case "timestamp":
      return qTemporal("timestamp", formatTimestampFromNanos(raw));
    case "month":
      return qTemporal("month", formatMonthFromMonths(raw));
    case "datetime":
      return qTemporal("datetime", formatDatetimeFromDays(raw));
    case "timespan":
      return qTemporal("timespan", formatTimespanFromNanos(raw));
    case "minute":
      return qTemporal("minute", formatClockFromUnits(raw, 1 / 60, "minute"));
    case "second":
      return qTemporal("second", formatClockFromUnits(raw, 1, "second"));
    case "time":
      return qTemporal("time", formatClockFromUnits(raw, 1000, "millisecond"));
  }
};

export const castDateValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList(value.items.map(castDateAtom), true, value.items.length === 0 ? "date" : undefined);
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
    column.value.kind === "list"
      ? [column.value.items.length]
      : column.value.kind === "string"
        ? [column.value.value.length]
        : []
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
    if (value.kind === "string") {
      return [
        name,
        qList([...value.value].map((char) => qString(char)), true)
      ] as const;
    }

    return [
      name,
      qList(Array.from({ length: rowCount }, () => value), true)
    ] as const;
  });

  return qTable(Object.fromEntries(entries));
};

export const tableRowCount = (table: QTable) => Object.values(table.columns)[0]?.items.length ?? 0;

export const ungroupValue = (value: QValue): QValue => {
  const table =
    value.kind === "keyedTable"
      ? qTable({ ...value.keys.columns, ...value.values.columns })
      : value.kind === "table"
        ? value
        : null;
  if (!table) {
    throw new QRuntimeError("type", "ungroup expects a table or keyed table");
  }

  const names = Object.keys(table.columns);
  const output: Record<string, QValue[]> = Object.fromEntries(names.map((name) => [name, []]));
  const rows = tableRowCount(table);

  for (let row = 0; row < rows; row += 1) {
    const cells = names.map((name) => table.columns[name]!.items[row] ?? nullLike(table.columns[name]!.items[0]));
    const listLengths = cells
      .filter((cell) => cell.kind === "list" || cell.kind === "string")
      .map((cell) => cell.kind === "list" ? cell.items.length : cell.value.length);
    const repeat = listLengths[0] ?? 1;
    if (!listLengths.every((length) => length === repeat)) {
      throw new QRuntimeError("length", "ungroup row list cells must have the same length");
    }

    for (let offset = 0; offset < repeat; offset += 1) {
      for (let columnIndex = 0; columnIndex < names.length; columnIndex += 1) {
        const name = names[columnIndex]!;
        const cell = cells[columnIndex]!;
        output[name]!.push(
          cell.kind === "list"
            ? cell.items[offset] ?? nullLike(cell.items[0])
            : cell.kind === "string"
              ? qString(cell.value[offset] ?? "")
              : cell
        );
      }
    }
  }

  return qTable(
    Object.fromEntries(
      names.map((name) => [
        name,
        qList(output[name]!, output[name]!.every((item) => item.kind === output[name]![0]?.kind))
      ])
    )
  );
};

export const selectColumnRows = (column: QList, positions: number[]) =>
  qList(
    positions.map((position) => column.items[position] ?? nullLike(column.items[0])),
    column.homogeneous ?? false,
    column.attribute,
    column.foreignKey
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
    case "null":
      if (args.length === 1) return args[0]!;
      throw new QRuntimeError("rank", ":: identity expects one argument");
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
    return qList(
      index.items.map((item) => indexList(list, item)),
      list.homogeneous ?? false,
      list.attribute,
      list.foreignKey
    );
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

  // Iterate for rank-2 slices and whole-row column projection.
  if ((rowSelector.kind === "list" || rowSelector.kind === "null") && rows.kind === "list") {
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
      if (value.exactText !== undefined) return value.exactText;
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
        if (value.attribute === "byte") return "0x";
        if (value.attribute === "boolean") return "`boolean$()";
        if (value.attribute === "symbol") return "`symbol$()";
        if (["short", "int", "long", "real", "float"].includes(value.attribute ?? "")) {
          return `\`${value.attribute}$()`;
        }
        return "()";
      }
      if (value.items.length === 1 && value.attribute !== "namespaceKeys") {
        return value.items[0]?.kind === "list" ? formatBare(value.items[0]) : `,${formatBare(value.items[0])}`;
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
          if (value.attribute === "matrixRow" && only === "float") {
            return body;
          }
          if (!suffix) {
            return value.attribute === "s" ? `\`s#${body}` : body;
          }
          if (only === "float") {
            // Only add trailing `f` if every value is an integer (no decimal in output)
            const anyDecimal = body.includes(".") || body.toLowerCase().includes("e");
            const hasSpecial = nums.some((n) => n.special !== undefined);
            return anyDecimal || hasSpecial ? body : `${body}f`;
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
      if (
        value.items.every(
          (item) =>
            item.kind === "list" &&
            item.items.every((nested) => nested.kind === "boolean")
        )
      ) {
        const rows = value.items as QList[];
        const lengths = new Set(rows.map((row) => row.items.length));
        if (lengths.size === 1) {
          return rows.map(formatBare).join("\n");
        }
        const cells = rows.map((row) => [formatBare(row)]);
        const width = Math.max(0, ...cells.flat().map((cell) => cell.length));
        return cells.map((row) => row.map((cell) => cell.padEnd(width)).join(" ")).join("\n");
      }
      if (
        value.items.every(
          (item) =>
            item.kind === "list" &&
            item.items.every(
              (nested) =>
                nested.kind === "boolean" ||
                (nested.kind === "list" && nested.items.every((leaf) => leaf.kind === "boolean"))
            )
        )
      ) {
        const rows = value.items as QList[];
        const cells = rows.map((row) => {
          const mixedRow = row.items.some((cell) => cell.kind === "list");
          return row.items.map((cell) =>
            cell.kind === "boolean"
              ? mixedRow
                ? formatBare(cell)
                : cell.value ? "1" : "0"
              : formatBare(cell)
          );
        });
        const columnCount = Math.max(0, ...cells.map((row) => row.length));
        const widths = Array.from({ length: columnCount }, (_, column) =>
          Math.max(...cells.map((row) => row[column]?.length ?? 0))
        );
        return cells
          .map((row) => row.map((cell, column) => cell.padEnd(widths[column]!)).join(" ").trimEnd())
          .join("\n");
      }
      if (value.items.every((item) => item.kind === "temporal")) {
        const temporalItems = value.items.filter((item): item is Extract<QValue, { kind: "temporal" }> => item.kind === "temporal");
        const temporalTypes = new Set(temporalItems.map((item) => item.temporalType));
        if (temporalTypes.size === 1 && temporalTypes.has("month")) {
          return `${temporalItems.map((item) => item.value.replace(/m$/, "")).join(" ")}m`;
        }
        return temporalItems.map((item) => item.value).join(temporalTypes.size === 1 ? " " : "\n");
      }
      if (value.items.every((item) => item.kind === "symbol")) {
        if (value.foreignKey) {
          return `\`${value.foreignKey}$${value.items.map((item) => formatBare(item)).join("")}`;
        }
        if (value.attribute === "namespaceKeys") {
          return `\`\`${value.items
            .map((item) => (item.kind === "symbol" ? item.value : ""))
            .join("`")}`;
        }
        const body = value.items.map((item) => formatBare(item)).join("");
        return value.attribute === "s" && value.items.length > 1 ? `\`s#${body}` : body;
      }
      if (value.items.every((item) => item.kind === "string")) {
        return value.items
          .map((item) => (item.kind === "string" && item.value.length === 1 ? `,${formatBare(item)}` : formatBare(item)))
          .join("\n");
      }
      if (value.items.every((item) => item.kind === "list" || item.kind === "string")) {
        const hasNonSymbolList = value.items.some(
          (item) => item.kind === "list" && !item.items.every((nested) => nested.kind === "symbol")
        );
        return value.items.map((item) => formatNestedListItem(item, { symbolsAsColumns: hasNonSymbolList })).join("\n");
      }
      if (
        value.items.some(
          (item) =>
            item.kind === "list" ||
            item.kind === "string" ||
            item.kind === "dictionary" ||
            item.kind === "table" ||
            item.kind === "keyedTable" ||
            item.kind === "null"
        )
      ) {
        return value.items.map((item) => formatNestedListItem(item)).join("\n");
      }
      if (!value.items.every((item) => item.kind === value.items[0]?.kind)) {
        return value.items.map((item) => formatNestedListItem(item)).join("\n");
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
    case "parseTree":
      return value.display;
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
  const keyWidth = Math.max(keys.header.length, ...keys.rows.map((row) => row.length));
  const header = `${keys.header.padEnd(keyWidth)}| ${values.header}`;
  const divider = `${keys.divider}| ${values.divider}`;
  const rowCount = Math.max(keys.rows.length, values.rows.length);
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const left = keys.rows[index] ?? "";
    const right = values.rows[index] ?? "";
    return `${left.padEnd(keyWidth)}| ${right}`.trimEnd();
  });
  return [header, divider, ...rows].join("\n");
};

export const formatTableCell = (value: QValue) => {
  if (isNullish(value)) {
    return "";
  }
  if (value.kind === "boolean") {
    return value.value ? "1" : "0";
  }
  if (value.kind === "number") {
    return formatListNumber(value);
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
    key.kind === "symbol"
      ? key.value
      : key.kind === "string" && key.value.length === 1
        ? key.value
        : formatBare(key)
  );
  const width = Math.max(0, ...keys.map((key) => key.length));
  const numericListValues = dictionary.values.every(
    (value) => value.kind === "list" && value.items.every((item) => item.kind === "number")
  )
    ? (dictionary.values as QList[])
    : null;
  const symbolColumnValues = dictionary.values.length > 0 && dictionary.values.every((value) => value.kind === "symbol");
  const numericListWidths =
    numericListValues &&
    numericListValues.length > 0 &&
    numericListValues.every((value) => value.items.length === numericListValues[0]!.items.length) &&
    (numericListValues[0]?.items.length ?? 0) > 1
      ? Array.from({ length: numericListValues[0]!.items.length }, (_, column) =>
          Math.max(
            ...numericListValues.map((value) =>
              formatListNumber(value.items[column] ?? qLong(0)).length
            )
          )
        )
      : null;
  return keys
    .map(
      (key, index) => {
        const value = dictionary.values[index] ?? qNull();
        const rendered =
          value.kind === "null"
            ? ""
            : value.kind === "boolean"
              ? value.value ? "1" : "0"
            : value.kind === "string"
              ? (value as QString & { displayAsString?: boolean }).displayAsString
                ? formatBare(value)
                : [...value.value].join(" ")
            : value.kind === "symbol" && symbolColumnValues
              ? value.value
            : value.kind !== "list"
              ? formatBare(value)
              : numericListWidths && value.items.every((item) => item.kind === "number")
                ? value.items
                    .map((item, column) => formatListNumber(item).padEnd(numericListWidths[column]!))
                    .join(" ")
              : formatBare(value);
        return `${key.padEnd(width)}| ${rendered}`;
      }
    )
    .join("\n");
};
