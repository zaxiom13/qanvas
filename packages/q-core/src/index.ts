export type QValue =
  | QBoolean
  | QNumber
  | QTemporal
  | QSymbol
  | QString
  | QList
  | QDictionary
  | QTable
  | QKeyedTable
  | QLambda
  | QProjection
  | QBuiltin
  | QNamespace
  | QNull
  | QError;

export type QAtom = QBoolean | QNumber | QTemporal | QSymbol | QString | QNull;

export interface QBoolean {
  kind: "boolean";
  value: boolean;
}

export interface QNumber {
  kind: "number";
  value: number;
  numericType: "short" | "int" | "long" | "real" | "float";
  special?:
    | "null"
    | "intNull"
    | "intPosInf"
    | "intNegInf"
    | "longNull"
    | "longPosInf"
    | "longNegInf"
    | "shortNull"
    | "shortPosInf"
    | "shortNegInf"
    | "realNull"
    | "realPosInf"
    | "realNegInf"
    | "posInf"
    | "negInf";
}

export interface QSymbol {
  kind: "symbol";
  value: string;
}

export interface QTemporal {
  kind: "temporal";
  temporalType: "date";
  value: string;
}

export interface QString {
  kind: "string";
  value: string;
}

export interface QList {
  kind: "list";
  items: QValue[];
  homogeneous?: boolean;
  attribute?: string;
}

export interface QDictionary {
  kind: "dictionary";
  keys: QValue[];
  values: QValue[];
}

export interface QTable {
  kind: "table";
  columns: Record<string, QList>;
}

export interface QKeyedTable {
  kind: "keyedTable";
  keys: QTable;
  values: QTable;
}

export interface QLambda {
  kind: "lambda";
  params: string[] | null;
  source: string;
  body: unknown;
}

export interface QProjection {
  kind: "projection";
  target: QValue;
  args: (QValue | null)[];
  arity: number;
}

export interface QBuiltin {
  kind: "builtin";
  name: string;
  arity: number;
}

export interface QNamespace {
  kind: "namespace";
  name: string;
  entries: Map<string, QValue>;
}

export interface QNull {
  kind: "null";
}

export interface QError {
  kind: "error";
  name: string;
  message: string;
}

export interface CanonicalNode {
  kind: string;
  qType: string;
  data: unknown;
}

export const qNull = (): QNull => ({ kind: "null" });

export const qBool = (value: boolean): QBoolean => ({ kind: "boolean", value });

export const qInt = (
  value: number,
  special?: "intNull" | "intPosInf" | "intNegInf"
): QNumber => ({
  kind: "number",
  value,
  numericType: "int",
  special
});

export const qLong = (
  value: number,
  special?: "longNull" | "longPosInf" | "longNegInf"
): QNumber => ({
  kind: "number",
  value,
  numericType: "long",
  special
});

export const qShort = (
  value: number,
  special?: "shortNull" | "shortPosInf" | "shortNegInf"
): QNumber => ({
  kind: "number",
  value,
  numericType: "short",
  special
});

export const qReal = (
  value: number,
  special?: "realNull" | "realPosInf" | "realNegInf"
): QNumber => ({
  kind: "number",
  value,
  numericType: "real",
  special
});

export const qFloat = (
  value: number,
  special?: "null" | "posInf" | "negInf"
): QNumber => ({
  kind: "number",
  value,
  numericType: "float",
  special
});

export const qSymbol = (value: string): QSymbol => ({ kind: "symbol", value });

export const qDate = (value: string): QTemporal => ({
  kind: "temporal",
  temporalType: "date",
  value
});

export const qString = (value: string): QString => ({ kind: "string", value });

export const qList = (
  items: QValue[],
  homogeneous = false,
  attribute?: string
): QList => ({
  kind: "list",
  items,
  homogeneous,
  attribute
});

export const qDictionary = (keys: QValue[], values: QValue[]): QDictionary => ({
  kind: "dictionary",
  keys,
  values
});

export const qTable = (columns: Record<string, QList>): QTable => ({
  kind: "table",
  columns
});

export const qKeyedTable = (keys: QTable, values: QTable): QKeyedTable => ({
  kind: "keyedTable",
  keys,
  values
});

export const qProjection = (
  target: QValue,
  args: (QValue | null)[],
  arity: number
): QProjection => ({
  kind: "projection",
  target,
  args,
  arity
});

export const qError = (name: string, message: string): QError => ({
  kind: "error",
  name,
  message
});

export const isTruthy = (value: QValue): boolean => {
  switch (value.kind) {
    case "boolean":
      return value.value;
    case "null":
      return false;
    case "number":
      if (value.special === "null") {
        return false;
      }
      return value.value !== 0;
    case "list":
      return value.items.length > 0;
    case "string":
      return value.value.length > 0;
    case "symbol":
      return value.value.length > 0;
    default:
      return true;
  }
};

export const canonicalize = (value: QValue): CanonicalNode => {
  switch (value.kind) {
    case "null":
      return { kind: "atom", qType: "null", data: null };
    case "boolean":
      return { kind: "atom", qType: "boolean", data: value.value };
    case "number": {
      const specialText =
        value.special === "null"
          ? "0n"
          : value.special === "intNull"
            ? "0Ni"
          : value.special === "intPosInf"
            ? "0Wi"
          : value.special === "intNegInf"
            ? "-0Wi"
          : value.special === "longNull"
            ? "0N"
          : value.special === "longPosInf"
            ? "0W"
          : value.special === "longNegInf"
            ? "-0W"
          : value.special === "shortNull"
            ? "0Nh"
          : value.special === "shortPosInf"
            ? "0Wh"
          : value.special === "shortNegInf"
            ? "-0Wh"
          : value.special === "realNull"
            ? "0Ne"
          : value.special === "realPosInf"
            ? "0We"
          : value.special === "realNegInf"
            ? "-0We"
          : value.special === "posInf"
            ? "0w"
          : value.special === "negInf"
            ? "-0w"
          : null;
      return {
        kind: "atom",
        qType: value.numericType,
        data: specialText !== null ? specialText : value.value
      };
    }
    case "symbol":
      return { kind: "atom", qType: "symbol", data: value.value };
    case "temporal":
      return { kind: "atom", qType: value.temporalType, data: value.value };
    case "string":
      return { kind: "atom", qType: "string", data: value.value };
    case "list":
      return {
        kind: "list",
        qType: value.homogeneous ? "vector" : "list",
        data: {
          items: value.items.map(canonicalize),
          attribute: value.attribute ?? null
        }
      };
    case "dictionary":
      return {
        kind: "dictionary",
        qType: "dictionary",
        data: {
          keys: value.keys.map(canonicalize),
          values: value.values.map(canonicalize)
        }
      };
    case "table":
      return {
        kind: "table",
        qType: "table",
        data: Object.fromEntries(
          Object.entries(value.columns).map(([name, col]) => [
            name,
            canonicalize(col)
          ])
        )
      };
    case "keyedTable":
      return {
        kind: "table",
        qType: "keyedTable",
        data: {
          keys: canonicalize(value.keys),
          values: canonicalize(value.values)
        }
      };
    case "lambda":
      return {
        kind: "callable",
        qType: "lambda",
        data: { params: value.params, source: value.source }
      };
    case "projection":
      return {
        kind: "callable",
        qType: "projection",
        data: {
          target: canonicalize(value.target),
          args: value.args.map((arg) => (arg ? canonicalize(arg) : null)),
          arity: value.arity
        }
      };
    case "builtin":
      return {
        kind: "callable",
        qType: "builtin",
        data: { name: value.name, arity: value.arity }
      };
    case "namespace":
      return {
        kind: "namespace",
        qType: "namespace",
        data: Object.fromEntries(
          [...value.entries.entries()].map(([name, entry]) => [
            name,
            canonicalize(entry)
          ])
        )
      };
    case "error":
      return {
        kind: "error",
        qType: value.name,
        data: value.message
      };
  }
};

export const qTypeNumber = (value: QValue): number => {
  switch (value.kind) {
    case "boolean":
      return -1;
    case "number":
      switch (value.numericType) {
        case "short":
          return -5;
        case "int":
          return -6;
        case "long":
          return -7;
        case "real":
          return -8;
        case "float":
          return -9;
      }
    case "symbol":
      return -11;
    case "temporal":
      return -14;
    case "string":
      return 10;
    case "list":
      if (value.items.length === 0) {
        return 0;
      }
      return Math.abs(qTypeNumber(value.items[0]));
    case "dictionary":
      return 99;
    case "table":
      return 98;
    case "keyedTable":
      return 99;
    case "lambda":
      return 100;
    case "projection":
      return 104;
    case "builtin":
      return 101;
    case "namespace":
      return 97;
    case "null":
      return 0;
    case "error":
      return -128;
  }
};
