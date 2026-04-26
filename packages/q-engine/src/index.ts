import {
  canonicalize,
  isTruthy,
  qBool,
  qDate,
  qDictionary,
  qError,
  qFloat,
  qInt,
  qKeyedTable,
  qList,
  qLong,
  qNull,
  qProjection,
  qReal,
  qShort,
  qString,
  qSymbol,
  qTable,
  qTypeNumber,
  type CanonicalNode,
  type QBuiltin,
  type QDictionary,
  type QError,
  type QKeyedTable,
  type QList,
  type QLambda,
  type QNamespace,
  type QNumber,
  type QProjection,
  type QString,
  type QSymbol,
  type QTemporal,
  type QTable,
  type QValue
} from "@qpad/core";
export type { QValue } from "@qpad/core";
import { KdbLexError, lexKdbLex, type KdbLexToken } from "../../q-language/src/index.js";

import { createMemoryFileSystem, type HostFileSystem } from "./host-file-system.js";
import { parse as pegParse } from "./q-parser.js";

export type { HostFileSystem } from "./host-file-system.js";

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

interface Token {
  kind: string;
  value: string;
  start: number;
  end: number;
}

interface SourcePosition {
  line: number;
  column: number;
  offset: number;
}

interface SourceRange {
  start: SourcePosition;
  end: SourcePosition;
}

const MONAD_KEYWORDS = new Set([
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

const WORD_DIAD_KEYWORDS = new Set([
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
const Q_LONG_MAX = 9223372036854775807;
const Q_INT_MAX = 2147483647;
const Q_SHORT_MAX = 32767;
const Q_X10_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const Q_X12_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CX_USAGE =
  "usage: complex must be a numeric scalar, numeric pair (re im), or `re`im dictionary";

const Q_RESERVED_WORDS = [
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

const Q_RESERVED_SET = new Set<string>(Q_RESERVED_WORDS);

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

type BuiltinImpl = (session: Session, args: QValue[]) => QValue;
type TemporalType = "date" | "month" | "minute" | "second" | "time" | "timespan";
type StoredFileFormat = "csv" | "tsv" | "txt" | "json" | "q";

interface BuiltinEntry extends QBuiltin {
  impl: BuiltinImpl;
}

interface LambdaValue extends QLambda {
  body: AstNode[];
}

interface TableQueryScope {
  source: QTable;
  positions: number[];
  filtered: QTable;
  context: Session;
}

const createHostAdapter = (host: HostAdapter): Required<HostAdapter> => ({
  now: host.now ?? (() => new Date()),
  timezone: host.timezone ?? (() => Intl.DateTimeFormat().resolvedOptions().timeZone),
  env: host.env ?? (() => ({})),
  consoleSize: host.consoleSize ?? (() => ({ rows: 40, columns: 120 })),
  unsupported:
    host.unsupported ??
    ((name: string) => {
      throw new QRuntimeError("nyi", `${name} is not available in the browser host`);
    }),
  fs: host.fs ?? createMemoryFileSystem()
});

const builtinRef = (name: string, arity: number): QBuiltin => ({
  kind: "builtin",
  name,
  arity
});

const namespaceValue = (name: string, entries: [string, QValue][]): QNamespace => ({
  kind: "namespace",
  name,
  entries: new Map<string, QValue>(entries)
});

export class Session {
  private readonly env = new Map<string, QValue>();
  private readonly builtins: ReadonlyMap<string, BuiltinEntry>;
  private readonly host: Required<HostAdapter>;
  private readonly root: Session;
  private readonly parent: Session | null;
  private outputBuffer = "";

  constructor(host: HostAdapter = {}, root?: Session, parent?: Session | null) {
    this.parent = parent ?? null;
    this.host = parent?.host ?? createHostAdapter(host);
    this.root = root ?? this;
    this.builtins = parent?.builtins ?? SHARED_BUILTINS;

    if (!parent) {
      this.seedNamespaces();
    }
  }

  evaluate(source: string): EvalResult {
    const ast = parse(source);
    this.outputBuffer = "";
    const value = this.eval(ast);
    const isEmptyProgram = ast.kind === "program" && ast.statements.length === 0;
    const finalStatement = ast.kind === "program" ? ast.statements.at(-1) ?? ast : ast;
    const shouldPrintFinal = !isSilentExpression(finalStatement);
    return {
      value,
      formatted: isEmptyProgram
        ? this.outputBuffer
        : `${this.outputBuffer}${shouldPrintFinal ? formatValue(value) : ""}`,
      canonical: canonicalize(value)
    };
  }

  get(name: string): QValue {
    this.root.refreshDynamicNamespaces();
    if (name.includes(".")) {
      return this.getDotted(name);
    }
    const value = this.lookup(name);
    if (value !== undefined) {
      return value;
    }
    const builtin = this.builtins.get(name);
    if (builtin) {
      return {
        kind: "builtin",
        name: builtin.name,
        arity: builtin.arity
      };
    }

    const derived = name.match(/^(.*)([\/\\])$/);
    if (derived && derived[1]) {
      return qProjection(this.get(derived[2]!), [this.get(derived[1]!)], 2);
    }

    throw new QRuntimeError("name", `Unknown identifier: ${name}`);
  }

  assign(name: string, value: QValue): QValue {
    if (!name.includes(".")) {
      this.env.set(name, value);
      return value;
    }

    const parts = name.replace(/^\./, "").split(".");
    const last = parts.pop()!;
    if (parts.length === 0) {
      this.env.set(name.startsWith(".") ? `.${last}` : last, value);
      return value;
    }

    let current = this.getRootValue(parts[0]!);

    if (!current) {
      current = {
        kind: "namespace",
        name: parts[0],
        entries: new Map()
      } satisfies QNamespace;
      this.env.set(name.startsWith(".") ? `.${parts[0]}` : parts[0], current);
    }

    for (const part of parts.slice(1)) {
      if (current.kind !== "namespace") {
        throw new QRuntimeError("type", `Cannot assign into non-namespace ${name}`);
      }
      let next = current.entries.get(part);
      if (!next) {
        next = {
          kind: "namespace",
          name: part,
          entries: new Map()
        } satisfies QNamespace;
        current.entries.set(part, next);
      }
      current = next;
    }

    if (current.kind !== "namespace") {
      throw new QRuntimeError("type", `Cannot assign into non-namespace ${name}`);
    }
    current.entries.set(last, value);
    return value;
  }

  assignGlobal(name: string, value: QValue): QValue {
    this.root.assign(name, value);
    if (this !== this.root) {
      this.assign(name, value);
    }
    return value;
  }

  emit(value: QValue) {
    this.root.outputBuffer += formatValue(value);
  }

  unsupported(name: string): never {
    return this.host.unsupported(name);
  }

  hostEnv(): Record<string, string> {
    return this.host.env();
  }

  fs(): HostFileSystem {
    return this.host.fs;
  }

  listTables(namespace: string): QValue {
    const names: string[] = [];
    if (namespace === "" || namespace === ".") {
      for (const [key, value] of this.root.env.entries()) {
        if (!key.startsWith(".") && (value.kind === "table" || value.kind === "keyedTable")) {
          names.push(key);
        }
      }
    } else {
      const normalized = namespace.startsWith(".") ? namespace : `.${namespace}`;
      const container = this.root.env.get(normalized);
      if (container && container.kind === "namespace") {
        for (const [key, value] of container.entries.entries()) {
          if (value.kind === "table" || value.kind === "keyedTable") {
            names.push(key);
          }
        }
      }
    }
    names.sort();
    return qList(names.map((name) => qSymbol(name)), true);
  }

  private createChildScope() {
    return new Session({}, this.root, this);
  }

  private eval(node: AstNode): QValue {
    switch (node.kind) {
      case "program": {
        return this.evalStatements(node.statements);
      }
      case "assign":
        return this.assign(node.name, this.eval(node.value));
      case "assignGlobal":
        return this.assignGlobal(node.name, this.eval(node.value));
      case "return":
        return this.eval(node.value);
      case "identifier":
        return this.get(node.name);
      case "number":
        return parseNumericLiteral(node.value);
      case "date":
        return parseTemporalLiteral(node.value);
      case "boolean":
        return qBool(node.value);
      case "string":
        return qString(node.value);
      case "symbol":
        return qSymbol(node.value);
      case "null":
        return qNull();
      case "placeholder":
        return qNull();
      case "vector": {
        const items = node.items.map((item) => this.eval(item));
        if (
          node.items.length > 0 &&
          node.items.every((item) => item.kind === "number") &&
          items.every((item) => item.kind === "number")
        ) {
          const lastRaw = node.items[node.items.length - 1]!.value;
          if (lastRaw.endsWith("i")) {
            return qList(items.map((item) => qInt(toNumber(item))), true);
          }
          if (lastRaw.endsWith("h")) {
            return qList(items.map((item) => qShort(toNumber(item))), true);
          }
          if (lastRaw.endsWith("j")) {
            return qList(items.map((item) => qLong(toNumber(item))), true);
          }
          if (lastRaw.endsWith("e")) {
            return qList(items.map((item) => qReal(toNumber(item))), true);
          }
          if (lastRaw.endsWith("f")) {
            return qList(items.map((item) => qFloat(toNumber(item))), true);
          }
        }
        return qList(items, true);
      }
      case "list":
        return qList(
          node.items.reduceRight<QValue[]>((items, item) => {
            items.unshift(this.eval(item));
            return items;
          }, []),
          false
        );
      case "table":
        return buildTable(node.columns.map((column) => ({
          name: column.name,
          value: this.eval(column.value)
        })));
      case "keyedTable":
        return qKeyedTable(
          buildTable(node.keys.map((column) => ({
            name: column.name,
            value: this.eval(column.value)
          }))),
          buildTable(node.values.map((column) => ({
            name: column.name,
            value: this.eval(column.value)
          })))
        );
      case "select":
        return this.evalSelect(node);
      case "exec":
        return this.evalExec(node);
      case "update":
        return this.evalUpdate(node);
      case "delete":
        return this.evalDelete(node);
      case "if":
        return isTruthy(this.eval(node.condition)) ? this.evalBranchBody(node.body) : qNull();
      case "while": {
        while (isTruthy(this.eval(node.condition))) {
          this.evalBranchBody(node.body);
        }
        return qNull();
      }
      case "do": {
        const count = toNumber(this.eval(node.count));
        for (let i = 0; i < count; i++) {
          this.evalBranchBody(node.body);
        }
        return qNull();
      }
      case "cond":
        return this.evalConditional(node);
      case "group":
        return this.eval(node.value);
      case "each": {
        const callee = this.eval(node.callee);
        const arg = this.eval(node.arg);
        const items =
          arg.kind === "list"
            ? arg.items
            : arg.kind === "string"
              ? [...arg.value].map((char) => qString(char))
              : [arg];
        return qList(items.map((item) => this.invoke(callee, [item])), false);
      }
      case "eachCall": {
        const callee = this.eval(node.callee);
        const args = node.args.map((arg) => this.eval(arg));
        const sizes = args
          .map((arg) => (arg.kind === "list" ? arg.items.length : arg.kind === "string" ? arg.value.length : null))
          .filter((size): size is number => size !== null);
        if (sizes.length === 0) {
          return this.invoke(callee, args);
        }
        if (!sizes.every((size) => size === sizes[0])) {
          throw new QRuntimeError("length", "Each arguments must have the same length");
        }
        return qList(
          Array.from({ length: sizes[0] }, (_, index) =>
            this.invoke(
              callee,
              args.map((arg) => {
                if (arg.kind === "list") {
                  return arg.items[index] ?? qNull();
                }
                if (arg.kind === "string") {
                  return qString(arg.value[index] ?? "");
                }
                return arg;
              })
            )
          ),
          false
        );
      }
      case "binary": {
        // Handle dyadic-each pattern: `left-vector f' right-vector`
        // where the trailing element of the left vector is a callable.
        if (
          node.op === "'" &&
          node.left.kind === "vector" &&
          node.left.items.length >= 2
        ) {
          const leftItems = node.left.items;
          const lastItem = leftItems[leftItems.length - 1]!;
          const calleeVal = this.eval(lastItem);
          if (calleeVal.kind === "lambda" || calleeVal.kind === "builtin") {
            const leftArg = this.eval(
              leftItems.length === 2
                ? leftItems[0]!
                : { kind: "vector", items: leftItems.slice(0, -1) }
            );
            const rightArg = this.eval(node.right);
            return this.evalBinary(node.op, leftArg, rightArg, calleeVal);
          }
        }
        const right = this.eval(node.right);
        const left = this.eval(node.left);
        return this.evalBinary(node.op, left, right);
      }
      case "call": {
        const callee = this.eval(node.callee);
        const args = node.args.map((arg) => (arg.kind === "placeholder" ? null : this.eval(arg)));
        return this.invokeCall(callee, args);
      }
      case "lambda":
        return {
          kind: "lambda",
          params: node.params,
          source: node.source,
          body: node.body
        } satisfies LambdaValue;
    }
  }

  invoke(callee: QValue, args: QValue[]): QValue {
    if (callee.kind === "projection") {
      return this.invokeProjection(callee, args);
    }

    if (callee.kind === "builtin") {
      const builtin = this.builtins.get(callee.name);
      if (!builtin) {
        throw new QRuntimeError("nyi", `Builtin not found: ${callee.name}`);
      }
      if (args.length < builtin.arity) {
        return qProjection(callee, [...args], builtin.arity);
      }
      return builtin.impl(this, args);
    }

    if (callee.kind === "lambda") {
      return this.invokeLambda(callee as LambdaValue, args);
    }

    return applyValue(callee, args);
  }

  private invokeCall(callee: QValue, args: (QValue | null)[]): QValue {
    if (args.every((arg): arg is QValue => arg !== null)) {
      return this.invoke(callee, args);
    }

    if (callee.kind === "projection") {
      const merged = this.mergeProjectionArgs(callee.args, args, callee.arity);
      return qProjection(callee.target, merged, Math.max(callee.arity, merged.length));
    }

    if (callee.kind === "builtin") {
      return qProjection(callee, [...args], Math.max(callee.arity, args.length));
    }

    if (callee.kind === "lambda") {
      return qProjection(callee, [...args], Math.max(lambdaArity(callee as LambdaValue), args.length));
    }

    return applyValue(
      callee,
      args.map((arg) => arg ?? qNull())
    );
  }

  private mergeProjectionArgs(
    baseArgs: (QValue | null)[],
    newArgs: (QValue | null)[],
    arity: number
  ) {
    const merged = [...baseArgs];
    let argIndex = 0;

    for (let index = 0; index < merged.length && argIndex < newArgs.length; index += 1) {
      if (merged[index] === null) {
        merged[index] = newArgs[argIndex] ?? null;
        argIndex += 1;
      }
    }

    while (argIndex < newArgs.length && merged.length < arity) {
      merged.push(newArgs[argIndex] ?? null);
      argIndex += 1;
    }

    return merged;
  }

  private invokeProjection(projection: QProjection, args: QValue[]): QValue {
    const boundCount = projection.args.filter((value) => value !== null).length;
    const isDerivedAdverbProjection =
      projection.target.kind === "builtin" &&
      (projection.target.name === "/" ||
        projection.target.name === "\\" ||
        projection.target.name === "over" ||
        projection.target.name === "scan") &&
      boundCount === 1;
    if (projection.arity - boundCount === 1 && args.length > 1 && !isDerivedAdverbProjection) {
      args = [qList(args, args.every((arg) => arg.kind === args[0]?.kind))];
    }

    const merged = [...projection.args];
    let argIndex = 0;
    for (let index = 0; index < merged.length && argIndex < args.length; index += 1) {
      if (merged[index] === null) {
        merged[index] = args[argIndex] ?? null;
        argIndex += 1;
      }
    }
    while (argIndex < args.length && merged.length < projection.arity) {
      merged.push(args[argIndex]);
      argIndex += 1;
    }

    const completeArgs = merged.filter((value): value is QValue => value !== null);
    if (completeArgs.length < projection.arity) {
      return qProjection(projection.target, merged, projection.arity);
    }

    let result = this.invoke(projection.target, completeArgs);
    while (argIndex < args.length) {
      result = applyValue(result, [args[argIndex]]);
      argIndex += 1;
    }
    return result;
  }

  private invokeLambda(lambda: LambdaValue, args: QValue[]): QValue {
    const arity = lambdaArity(lambda);
    if (arity === 1 && args.length > 1) {
      args = [qList(args, args.every((arg) => arg.kind === args[0]?.kind))];
    }
    if (args.length < arity) {
      return qProjection(lambda, [...args], arity);
    }

    const child = this.createChildScope();

    const params = lambda.params ?? ["x", "y", "z"].slice(0, Math.max(arity, args.length));
    params.forEach((param, index) => {
      child.assign(param, args[index] ?? qNull());
    });

    return child.evalStatements(lambda.body);
  }

  private evalStatements(body: AstNode[]) {
    let last: QValue = qNull();
    for (const statement of body) {
      if (statement.kind === "return") {
        return this.eval(statement.value);
      }
      last = this.eval(statement);
    }
    return last;
  }

  createTableContext(table: QTable, positions?: number[]) {
    const child = this.createChildScope();
    for (const [name, column] of Object.entries(table.columns)) {
      child.assign(name, column);
    }
    const rowPositions =
      positions ?? Array.from({ length: tableRowCount(table) }, (_, index) => index);
    child.assign("i", qList(rowPositions.map((index) => qLong(index)), true));
    return child;
  }

  private requireTableSource(source: AstNode, action: string): QTable {
    const value = this.eval(source);
    if (value.kind === "table") return value;
    if (value.kind === "keyedTable") {
      return qTable({ ...value.keys.columns, ...value.values.columns });
    }
    throw new QRuntimeError("type", `${action} expects a table source`);
  }

  private createTableQueryScope(source: AstNode, where: AstNode | null, action: string): TableQueryScope {
    const table = this.requireTableSource(source, action);
    const positions = this.resolveTableRows(table, where);
    const filtered = selectTableRows(table, positions);
    return {
      source: table,
      positions,
      filtered,
      context: this.createTableContext(filtered, positions)
    };
  }

  private resolveTableRows(table: QTable, where: AstNode | null) {
    if (!where) {
      return Array.from({ length: tableRowCount(table) }, (_, index) => index);
    }

    const context = this.createTableContext(table);
    const result = context.eval(where);
    if (result.kind === "boolean") {
      return result.value ? Array.from({ length: tableRowCount(table) }, (_, index) => index) : [];
    }
    if (result.kind !== "list") {
      throw new QRuntimeError("type", "where expects a boolean vector");
    }
    if (!result.items.every((item) => item.kind === "boolean")) {
      throw new QRuntimeError("type", "where expects a boolean vector");
    }

    return result.items.flatMap((item, index) =>
      item.kind === "boolean" && item.value ? [index] : []
    );
  }

  private groupTableRows(
    table: QTable,
    positions: number[],
    by: { name: string | null; value: AstNode }[]
  ) {
    const rowCount = tableRowCount(table);
    const context = this.createTableContext(table, positions);
    const names = qsqlColumnNames(by);
    const keyColumns = by.map((column, index) => ({
      name: names[index]!,
      value: materializeTableColumn(context.eval(column.value), rowCount)
    }));

    const groups: { keyValues: QValue[]; positions: number[] }[] = [];
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const keyValues = keyColumns.map(
        (column) => column.value.items[rowIndex] ?? nullLike(column.value.items[0])
      );
      const existing = groups.find((group) =>
        group.keyValues.every((candidate, index) => equals(candidate, keyValues[index]!))
      );
      if (existing) {
        existing.positions.push(rowIndex);
        continue;
      }
      groups.push({ keyValues, positions: [rowIndex] });
    }

    return { keyColumns, groups };
  }

  private buildGroupedKeyTable(
    columns: { name: string; value: QList }[],
    groups: { keyValues: QValue[] }[]
  ) {
    return buildTable(
      columns.map((column, index) => ({
        name: column.name,
        value: qList(
          groups.map((group) => group.keyValues[index]!),
          column.value.homogeneous ?? false,
          column.value.attribute
        )
      }))
    );
  }

  private buildSelectColumns(
    columns: { name: string | null; value: AstNode }[],
    context: Session,
    rowCount: number
  ) {
    const names = qsqlColumnNames(columns);
    const values = columns.map((column) => context.eval(column.value));
    const aggregateMode = isQsqlAggregateExpression(columns[0]?.value ?? null);

    if (!aggregateMode && !values.some((value) => value.kind === "list" && value.items.length === rowCount)) {
      throw new QRuntimeError("rank", "select result must be row-wise or aggregate");
    }

    return columns.map((_, index) => ({
      name: names[index]!,
      value: aggregateMode ? qList([values[index]!], false) : materializeTableColumn(values[index]!, rowCount)
    }));
  }

  private cloneTableColumns(table: QTable) {
    return Object.fromEntries(
      Object.entries(table.columns).map(([name, column]) => [name, [...column.items]])
    ) as Record<string, QValue[]>;
  }

  private applyUpdateColumn(
    updatedColumns: Record<string, QValue[]>,
    source: QTable,
    positions: number[],
    updateName: string,
    column: QList
  ) {
    const sample = column.items[0] ?? source.columns[updateName]?.items[0];
    const targetColumn =
      updatedColumns[updateName] ??
      (updatedColumns[updateName] = Array.from({ length: tableRowCount(source) }, () =>
        nullLike(sample)
      ));
    positions.forEach((position, index) => {
      targetColumn[position] = column.items[index] ?? nullLike(sample);
    });
  }

  private evalGroupedSelect(
    source: QTable,
    sourcePositions: number[],
    columns: { name: string | null; value: AstNode }[] | null,
    by: { name: string | null; value: AstNode }[]
  ): QValue {
    const grouping = this.groupTableRows(source, sourcePositions, by);
    const selectColumns =
      columns ??
      Object.keys(source.columns)
        .filter(
          (name) =>
            !by.some(
              (column) =>
                column.name === name ||
                (column.value.kind === "identifier" && column.value.name === name)
            )
        )
        .map((name) => ({ name: null, value: { kind: "identifier", name } as AstNode }));
    const valueNames = qsqlColumnNames(selectColumns);
    const resultCells = selectColumns.map(() => [] as QValue[]);

    for (const group of grouping.groups) {
      const subgroup = selectTableRows(source, group.positions);
      const subgroupPositions = group.positions.map((index) => sourcePositions[index]!);
      const context = this.createTableContext(subgroup, subgroupPositions);
      selectColumns.forEach((column, index) => {
        resultCells[index]!.push(context.eval(column.value));
      });
    }

    return qKeyedTable(
      this.buildGroupedKeyTable(grouping.keyColumns, grouping.groups),
      buildTable(
        selectColumns.map((_, index) => ({
          name: valueNames[index]!,
          value: qList(
            resultCells[index]!,
            resultCells[index]!.every((item) => item.kind === resultCells[index]?.[0]?.kind)
          )
        }))
      )
    );
  }

  private evalGroupedExec(
    source: QTable,
    sourcePositions: number[],
    valueNode: AstNode,
    by: { name: string | null; value: AstNode }[]
  ): QValue {
    const grouping = this.groupTableRows(source, sourcePositions, by);
    const valueExpression =
      valueNode.kind === "assign" || valueNode.kind === "assignGlobal" ? valueNode.value : valueNode;
    const valueName =
      valueNode.kind === "assign" || valueNode.kind === "assignGlobal" ? valueNode.name : "";
    const values: QValue[] = [];

    for (const group of grouping.groups) {
      const subgroup = selectTableRows(source, group.positions);
      const subgroupPositions = group.positions.map((index) => sourcePositions[index]!);
      const context = this.createTableContext(subgroup, subgroupPositions);
      values.push(context.eval(valueExpression));
    }

    if (grouping.keyColumns.length === 1) {
      return qDictionary(
        grouping.groups.map((group) => group.keyValues[0]!),
        values
      );
    }

    return qKeyedTable(
      this.buildGroupedKeyTable(grouping.keyColumns, grouping.groups),
      buildTable([
        {
          name: valueName,
          value: qList(values, values.every((item) => item.kind === values[0]?.kind))
        }
      ])
    );
  }

  private evalSelect(node: Extract<AstNode, { kind: "select" }>): QValue {
    const { filtered, positions, context } = this.createTableQueryScope(node.source, node.where, "select");
    if (node.by && node.by.length > 0) {
      return this.evalGroupedSelect(filtered, positions, node.columns, node.by);
    }
    if (!node.columns) {
      return filtered;
    }
    return buildTable(this.buildSelectColumns(node.columns, context, tableRowCount(filtered)));
  }

  private evalExec(node: Extract<AstNode, { kind: "exec" }>): QValue {
    const { filtered, positions, context } = this.createTableQueryScope(node.source, node.where, "exec");
    if (node.by && node.by.length > 0) {
      return this.evalGroupedExec(filtered, positions, node.value, node.by);
    }
    return context.eval(node.value);
  }

  private evalUpdate(node: Extract<AstNode, { kind: "update" }>): QValue {
    const { source, positions, context } = this.createTableQueryScope(node.source, node.where, "update");
    const updatedColumns = this.cloneTableColumns(source);

    for (const update of node.updates) {
      const value = context.eval(update.value);
      const column = materializeTableColumn(value, positions.length);
      this.applyUpdateColumn(updatedColumns, source, positions, update.name, column);
      context.assign(update.name, column);
    }

    return qTable(
      Object.fromEntries(
        Object.entries(updatedColumns).map(([name, items]) => [
          name,
          qList(items, items.every((item) => item.kind === items[0]?.kind))
        ])
      )
    );
  }

  private evalDelete(node: Extract<AstNode, { kind: "delete" }>): QValue {
    const source = this.requireTableSource(node.source, "delete");

    if (node.columns) {
      if (node.where) {
        throw new QRuntimeError("nyi", "delete column where is not implemented yet");
      }
      return qTable(
        Object.fromEntries(
          Object.entries(source.columns).filter(([name]) => !node.columns!.includes(name))
        )
      );
    }

    const positionsToDelete = new Set(this.resolveTableRows(source, node.where));
    const keep = Array.from({ length: tableRowCount(source) }, (_, index) => index).filter(
      (index) => !positionsToDelete.has(index)
    );
    return selectTableRows(source, keep);
  }

  private evalBranchBody(body: AstNode[]) {
    return this.evalStatements(body);
  }

  private evalConditional(node: Extract<AstNode, { kind: "cond" }>) {
    for (const branch of node.branches) {
      if (isTruthy(this.eval(branch.condition))) {
        return this.eval(branch.value);
      }
    }
    return node.elseValue ? this.eval(node.elseValue) : qNull();
  }

  private evalBinary(op: string, left: QValue, right: QValue, callee?: QValue): QValue {
    if (op.length > 2 && op.endsWith("/:")) {
      const base = op.slice(0, -2);
      const rightItems =
        right.kind === "list"
          ? right.items
          : right.kind === "string"
            ? [...right.value].map((char) => qString(char))
            : [right];
      return qList(
        rightItems.map((item) => this.evalBinary(base, left, item)),
        false
      );
    }
    if (op.length > 2 && op.endsWith("\\:")) {
      const base = op.slice(0, -2);
      const leftItems =
        left.kind === "list"
          ? left.items
          : left.kind === "string"
            ? [...left.value].map((char) => qString(char))
            : [left];
      return qList(
        leftItems.map((item) => this.evalBinary(base, item, right)),
        false
      );
    }
    if (op.length > 1 && op.endsWith("'") && !op.endsWith(":'") && op !== "':") {
      const base = op.slice(0, -1);
      const getItems = (value: QValue): QValue[] | null =>
        value.kind === "list"
          ? value.items
          : value.kind === "string"
            ? [...value.value].map((char) => qString(char))
            : null;
      const leftItems = getItems(left);
      const rightItems = getItems(right);
      if (leftItems === null && rightItems === null) {
        return this.evalBinary(base, left, right);
      }
      const n = leftItems?.length ?? rightItems?.length ?? 0;
      if (leftItems !== null && rightItems !== null && leftItems.length !== rightItems.length) {
        throw new QRuntimeError("length", "each-both: length mismatch");
      }
      const pickLeft = (idx: number) => (leftItems ? leftItems[idx]! : left);
      const pickRight = (idx: number) => (rightItems ? rightItems[idx]! : right);
      return qList(
        Array.from({ length: n }, (_, i) => this.evalBinary(base, pickLeft(i), pickRight(i))),
        false
      );
    }
    if (op === "'" && callee) {
      const leftLen = left.kind === "list" ? left.items.length : left.kind === "string" ? left.value.length : null;
      const rightLen = right.kind === "list" ? right.items.length : right.kind === "string" ? right.value.length : null;
      if (leftLen === null && rightLen === null) {
        return this.invoke(callee, [left, right]);
      }
      const n = leftLen ?? rightLen ?? 0;
      if (leftLen !== null && rightLen !== null && leftLen !== rightLen) {
        throw new QRuntimeError("length", "each: length mismatch");
      }
      const getItem = (val: QValue, idx: number) => {
        if (val.kind === "list") return val.items[idx] ?? qNull();
        if (val.kind === "string") return qString(val.value[idx] ?? "");
        return val;
      };
      return qList(
        Array.from({ length: n }, (_, i) => this.invoke(callee, [getItem(left, i), getItem(right, i)])),
        false
      );
    }
    const primitiveDerivedAdverb = op.match(/^(.*)([\/\\])$/);
    if (
      primitiveDerivedAdverb?.[1] &&
      PRIMITIVE_ADVERB_TYPECHECK_NAMES.has(primitiveDerivedAdverb[1])
    ) {
      const callable = this.get(primitiveDerivedAdverb[1]);
      return primitiveDerivedAdverb[2] === "/"
        ? reducePrimitiveAdverbValue(this, callable, right, left)
        : scanPrimitiveAdverbValue(this, callable, right, left);
    }
    switch (op) {
      case "+":
        return mapBinary(left, right, (a, b) => add(a, b));
      case "-":
        return mapBinary(left, right, (a, b) => subtract(a, b));
      case "*":
        return mapBinary(left, right, (a, b) => multiply(a, b));
      case "%":
        return mapBinary(left, right, (a, b) => divide(a, b));
      case "=":
        return mapBinary(left, right, (a, b) => qBool(equals(a, b)));
      case "<":
        return mapBinary(left, right, (a, b) => qBool(compare(a, b) < 0));
      case ">":
        return mapBinary(left, right, (a, b) => qBool(compare(a, b) > 0));
      case "<=":
        return mapBinary(left, right, (a, b) => qBool(compare(a, b) <= 0));
      case ">=":
        return mapBinary(left, right, (a, b) => qBool(compare(a, b) >= 0));
      case ",":
        return concatValues(left, right);
      case "!":
        return bangValue(left, right);
      case "#":
        return takeValue(left, right);
      case "_":
        return dropValue(left, right);
      case "~":
        return qBool(equals(left, right));
      case "^":
        return fillValue(left, right);
      case "?":
        return findValue(left, right);
      case "$":
        return castValue(left, right);
      case "@": {
        const args = right.kind === "list" && !(right.homogeneous ?? false) ? right.items : [right];
        if (left.kind === "builtin" || left.kind === "lambda" || left.kind === "projection") {
          return this.invoke(left, args);
        }
        return applyValue(left, args);
      }
      case "@'":
        return applyEachValue(this, left, right);
      case "\\":
        return scanPrimitiveAdverbValue(this, left, right);
      case ",/":
        return concatValues(left, right);
      case "in":
        return inValue(left, right);
      case "and":
        return mapBinary(left, right, (a, b) => minPair(a, b));
      case "like":
        return likeValue(left, right);
      case "or":
        return mapBinary(left, right, (a, b) => maxPair(a, b));
      case "over":
        return reduceValue(this, left, right);
      case "prior":
        return priorValue(this, left, right);
      case "scan":
        return scanValue(this, left, right);
      case "ss":
        return ssValue(left, right);
      case "sv":
        return svValue(left, right);
      case "vs":
        return vsValue(left, right);
      case "cross":
        return crossValue(left, right);
      case "within":
        return withinValue(left, right);
      case "except":
        return exceptValue(left, right);
      case "inter":
        return interValue(left, right);
      case "union":
        return unionValue(left, right);
      case "cut":
        return cutValue(left, right);
      case "div":
        return mapBinary(left, right, (a, b) => divValue(a, b));
      case "mavg":
        return movingValue(left, right, avgValue, false);
      case "mcount":
        return movingValue(left, right, movingCountValue, true);
      case "mdev":
        return movingValue(left, right, (window) => deviationValue(window, false), false);
      case "msum":
        return movingValue(left, right, sumValue, false);
      case "mod":
        return mapBinary(left, right, (a, b) => modValue(a, b));
      case "rotate":
        return rotateValue(left, right);
      case "sublist":
        return sublistValue(left, right);
      case "xcol":
        return xcolValue(left, right);
      case "xbar":
        return xbarValue(left, right);
      case "xexp":
        return mapBinary(left, right, (a, b) => qFloat(Math.pow(toNumber(a), toNumber(b))));
      case "xlog":
        return mapBinary(left, right, (a, b) => qFloat(Math.log(toNumber(b)) / Math.log(toNumber(a))));
      case "xasc":
        return xascValue(left, right, true);
      case "xdesc":
        return xascValue(left, right, false);
      case "xkey":
        return xkeyValue(left, right);
      case "xgroup":
        return xgroupValue(left, right);
      case "lj":
      case "ljf":
        return leftJoin(left, right);
      case "ij":
        return innerJoin(left, right);
      case "uj":
        return unionJoin(left, right);
      case "pj":
        return plusJoin(left, right);
      case "asof":
        return asofValue(left, right);
      case "|":
        return mapBinary(left, right, (a, b) => maxPair(a, b));
      case "&":
        return mapBinary(left, right, (a, b) => minPair(a, b));
      default: {
        const builtin = this.builtins.get(op);
        if (builtin && builtin.arity === 2) {
          return builtin.impl(this, [left, right]);
        }
        throw new QRuntimeError("nyi", `Operator ${op} is not implemented yet`);
      }
    }
  }

  keyValue(arg: QValue): QValue {
    if (arg.kind === "dictionary") {
      return qList(arg.keys, arg.keys.every((key) => key.kind === "symbol"));
    }
    if (arg.kind === "table") {
      return qList(Object.keys(arg.columns).map((name) => qSymbol(name)), true);
    }
    if (arg.kind === "keyedTable") {
      return arg.keys;
    }
    if (arg.kind === "namespace") {
      return qList(namespaceKeys(arg), true, "namespaceKeys");
    }
    if (arg.kind === "symbol") {
      if (arg.value === "") {
        const roots = [...this.collectEnvKeys()]
          .filter((name) => name.startsWith("."))
          .map((name) => qSymbol(name));
        return qList(roots, true, "namespaceKeys");
      }
      if (arg.value.startsWith(":")) {
        const entries = this.fs().list(arg.value.slice(1));
        return qList(entries.map((entry) => qSymbol(entry)), true);
      }
      return qList(
        namespaceKeys(this.get(arg.value.startsWith(".") ? arg.value : `.${arg.value}`)),
        true,
        "namespaceKeys"
      );
    }
    throw new QRuntimeError("type", "key expects a dictionary, table, or namespace");
  }

  private seedNamespaces() {
    const env = this.host.env();
    const now = this.host.now();
    const timezone = this.host.timezone();
    const size = this.host.consoleSize();

    this.env.set(
      ".Q",
      namespaceValue(".Q", [
        ["n", qString("0123456789")],
        ["A", qString("ABCDEFGHIJKLMNOPQRSTUVWXYZ")],
        ["a", qString("abcdefghijklmnopqrstuvwxyz")],
        ["an", qString("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_0123456789")],
        ["opt", builtinRef(".Q.opt", 1)],
        ["def", builtinRef(".Q.def", 3)],
        ["f", builtinRef(".Q.f", 2)],
        ["fmt", builtinRef(".Q.fmt", 3)],
        ["addmonths", builtinRef(".Q.addmonths", 2)],
        ["atob", builtinRef(".Q.atob", 1)],
        ["btoa", builtinRef(".Q.btoa", 1)],
        ["s", builtinRef(".Q.s", 1)],
        ["id", builtinRef(".Q.id", 1)],
        ["x10", builtinRef(".Q.x10", 1)],
        ["j10", builtinRef(".Q.j10", 1)],
        ["x12", builtinRef(".Q.x12", 1)],
        ["j12", builtinRef(".Q.j12", 1)],
        ["res", qList(Q_RESERVED_WORDS.map((name) => qSymbol(name)), true)],
        ["b6", qString(Q_X10_ALPHABET)],
        ["nA", qString(Q_X12_ALPHABET)],
        ["K", qDate("0Nd")],
        ["M", qLong(Q_LONG_MAX, "longPosInf")],
        ["k", qFloat(5)],
        ["rows", qInt(size.rows)],
        ["cols", qLong(size.columns)]
      ])
    );

    this.env.set(
      ".z",
      namespaceValue(".z", [
        ["K", qFloat(5)],
        ["D", qString(now.toISOString().slice(0, 10).replace(/-/g, "."))],
        ["T", qString(now.toTimeString().slice(0, 8))],
        ["P", qString(now.toISOString())],
        ["Z", qString(timezone)],
        ["o", qString(typeof navigator !== "undefined" ? navigator.userAgent : "node")],
        ["x", qList([])],
        ["e", qList(Object.entries(env).map(([k, v]) => qString(`${k}=${v}`)))]
      ])
    );

    this.env.set(
      ".cx",
      namespaceValue(".cx", [
        ["_usage", qString(CX_USAGE)],
        ["from", builtinRef(".cx.from", 1)],
        ["new", builtinRef(".cx.new", 2)],
        ["z", builtinRef(".cx.z", 2)],
        ["zero", qComplex(0, 0)],
        ["one", qComplex(1, 0)],
        ["i", qComplex(0, 1)],
        ["re", builtinRef(".cx.re", 1)],
        ["im", builtinRef(".cx.im", 1)],
        ["conj", builtinRef(".cx.conj", 1)],
        ["neg", builtinRef(".cx.neg", 1)],
        ["add", builtinRef(".cx.add", 2)],
        ["sub", builtinRef(".cx.sub", 2)],
        ["mul", builtinRef(".cx.mul", 2)],
        ["div", builtinRef(".cx.div", 2)],
        ["abs", builtinRef(".cx.abs", 1)],
        ["modulus", builtinRef(".cx.modulus", 1)],
        ["floor", builtinRef(".cx.floor", 1)],
        ["ceil", builtinRef(".cx.ceil", 1)],
        ["round", builtinRef(".cx.round", 1)],
        ["frac", builtinRef(".cx.frac", 1)],
        ["mod", builtinRef(".cx.mod", 2)],
        ["arg", builtinRef(".cx.arg", 1)],
        ["recip", builtinRef(".cx.recip", 1)],
        ["normalize", builtinRef(".cx.normalize", 1)],
        ["fromPolar", builtinRef(".cx.fromPolar", 2)],
        ["polar", builtinRef(".cx.polar", 1)],
        ["exp", builtinRef(".cx.exp", 1)],
        ["log", builtinRef(".cx.log", 1)],
        ["pow", builtinRef(".cx.pow", 2)],
        ["powEach", builtinRef(".cx.powEach", 2)],
        ["sqrt", builtinRef(".cx.sqrt", 1)],
        ["sin", builtinRef(".cx.sin", 1)],
        ["cos", builtinRef(".cx.cos", 1)],
        ["tan", builtinRef(".cx.tan", 1)],
        ["str", builtinRef(".cx.str", 1)]
      ])
    );
  }

  private lookup(name: string): QValue | undefined {
    const local = this.env.get(name);
    if (local !== undefined) {
      return local;
    }
    return this.parent?.lookup(name);
  }

  private collectEnvKeys() {
    const names = new Set<string>();
    let current: Session | null = this;
    while (current) {
      for (const key of current.env.keys()) {
        names.add(key);
      }
      current = current.parent;
    }
    return names;
  }

  private getRootValue(name: string): QValue | undefined {
    return this.lookup(`.${name}`) ?? this.lookup(name);
  }

  private refreshDynamicNamespaces() {
    const now = this.host.now();
    const z = this.getDotted(".z");
    if (z.kind !== "namespace") {
      return;
    }
    z.entries.set("D", qString(now.toISOString().slice(0, 10).replace(/-/g, ".")));
    z.entries.set("T", qString(now.toTimeString().slice(0, 8)));
    z.entries.set("P", qString(now.toISOString()));
  }

  private getDotted(name: string): QValue {
    const parts = name.replace(/^\./, "").split(".");
    let current: QValue | undefined = this.getRootValue(parts[0]!);
    if (!current) {
      throw new QRuntimeError("name", `Unknown identifier: ${name}`);
    }
    for (const part of parts.slice(1)) {
      if (current.kind !== "namespace") {
        throw new QRuntimeError("type", `Cannot index into ${name}`);
      }
      const next = current.entries.get(part);
      if (!next) {
        throw new QRuntimeError("name", `Unknown identifier: ${name}`);
      }
      current = next;
    }
    return current;
  }
}

const createBuiltins = (): ReadonlyMap<string, BuiltinEntry> => {
  const builtins = new Map<string, BuiltinEntry>();
  const register = (name: string, arity: number, impl: BuiltinImpl) => {
    builtins.set(name, {
      kind: "builtin",
      name,
      arity,
      impl
    });
  };
  const registerAlias = (alias: string, target: string) => {
    builtins.set(alias, builtins.get(target)!);
  };
  const registerUnsupported = (...names: string[]) => {
    for (const name of names) {
      register(name, 1, (session) => session.unsupported(name));
    }
  };
  const registerPrimitiveDerivedAdverb = (base: string) => {
    register(`${base}/`, 1, (session, args) => primitiveDerivedAdverbValue(session, base, "/", args));
    register(`${base}\\`, 1, (session, args) => primitiveDerivedAdverbValue(session, base, "\\", args));
  };

  register("abs", 1, (_, [arg]) => absValue(arg));
  register("all", 1, (_, [arg]) => allValue(arg));
  register("any", 1, (_, [arg]) => anyValue(arg));
  register("avgs", 1, (_, [arg]) => avgsValue(arg));
  register("til", 1, (_, [arg]) => qList(Array.from({ length: toNumber(arg) }, (_, i) => qLong(i)), true));
  register("ceiling", 1, (_, [arg]) => ceilingValue(arg));
  register("cols", 1, (_, [arg]) => colsValue(arg));
  register("count", 1, (_, [arg]) => qLong(countValue(arg)));
  register("desc", 1, (_, [arg]) => descValue(arg));
  register("differ", 1, (_, [arg]) => differValue(arg));
  register("exp", 1, (_, [arg]) => numericUnary(arg, Math.exp));
  register("fills", 1, (_, [arg]) => fillsValue(arg));
  register("first", 1, (_, [arg]) => firstValue(arg));
  register("last", 1, (_, [arg]) => lastValue(arg));
  register("log", 1, (_, [arg]) => numericUnary(arg, Math.log));
  register("iasc", 1, (_, [arg]) => gradeValue(arg, true));
  register("idesc", 1, (_, [arg]) => gradeValue(arg, false));
  register("asc", 1, (_, [arg]) => ascValue(arg));
  register("asin", 1, (_, [arg]) => numericUnary(arg, Math.asin));
  register("acos", 1, (_, [arg]) => numericUnary(arg, Math.acos));
  register("atan", 1, (_, [arg]) => numericUnary(arg, Math.atan));
  register("min", 1, (_, [arg]) => minValue(arg));
  register("mins", 1, (_, [arg]) => minsValue(arg));
  register("max", 1, (_, [arg]) => maxValue(arg));
  register("maxs", 1, (_, [arg]) => maxsValue(arg));
  register("med", 1, (_, [arg]) => medianValue(arg));
  register("sum", 1, (_, [arg]) => sumValue(arg));
  register("avg", 1, (_, [arg]) => avgValue(arg));
  register("sin", 1, (_, [arg]) => numericUnary(arg, Math.sin));
  register("cos", 1, (_, [arg]) => numericUnary(arg, Math.cos));
  register("tan", 1, (_, [arg]) => numericUnary(arg, Math.tan));
  register("floor", 1, (_, [arg]) => floorValue(arg));
  register("null", 1, (_, [arg]) => nullValue(arg));
  register("reciprocal", 1, (_, [arg]) => reciprocalValue(arg));
  register("reverse", 1, (_, [arg]) => reverseValue(arg));
  register("signum", 1, (_, [arg]) => signumValue(arg));
  register("sqrt", 1, (_, [arg]) => numericUnary(arg, Math.sqrt));
  register("neg", 1, (_, [arg]) => negateValue(arg));
  register("not", 1, (_, [arg]) => notValue(arg));
  register("enlist", 1, (_, [arg]) => qList([arg]));
  register("distinct", 1, (_, [arg]) => distinctValue(arg));
  register("attr", 1, (_, [arg]) => attrValue(arg));
  register("flip", 1, (_, [arg]) => flipValue(arg));
  register("group", 1, (_, [arg]) => groupValue(arg));
  register("key", 1, (session, [arg]) => session.keyValue(arg));
  registerAlias("keys", "key");
  register("lower", 1, (_, [arg]) => lowerValue(arg));
  register("ltrim", 1, (_, [arg]) => trimStringValue(arg, "left"));
  register("next", 1, (_, [arg]) => nextValue(arg));
  register("upper", 1, (_, [arg]) => upperValue(arg));
  register("prd", 1, (_, [arg]) => productValue(arg));
  register("prds", 1, (_, [arg]) => prdsValue(arg));
  register("prev", 1, (_, [arg]) => prevValue(arg));
  register("raze", 1, (_, args) =>
    args.length === 1 ? razeValue(args[0]!) : args.slice(1).reduce((acc, item) => razeValue(qList([acc, item])), args[0]!)
  );
  register("ratios", 1, (_, [arg]) => ratiosValue(arg));
  register("rtrim", 1, (_, [arg]) => trimStringValue(arg, "right"));
  register("var", 1, (_, [arg]) => varianceValue(arg, false));
  register("svar", 1, (_, [arg]) => varianceValue(arg, true));
  register("dev", 1, (_, [arg]) => deviationValue(arg, false));
  register("sdev", 1, (_, [arg]) => deviationValue(arg, true));
  register("-':", 1, (_, [arg, maybeValues]) =>
    maybeValues === undefined ? deltasValue(arg) : deltasValue(maybeValues, arg)
  );
  registerAlias("deltas", "-':");
  register("string", 1, (_, [arg]) => stringValue(arg));
  register("sums", 1, (_, [arg]) => sumsValue(arg));
  register("trim", 1, (_, [arg]) => trimStringValue(arg, "both"));
  register("type", 1, (_, [arg]) => qShort(qTypeNumber(arg)));
  register("where", 1, (_, [arg]) => whereValue(arg));
  register("value", 1, (_, [arg]) => arg);
  register("::", 1, (_, [arg]) => arg);
  register("show", 1, (session, [arg]) => {
    session.emit(arg);
    return arg;
  });
  register("system", 1, (session, [arg]) => {
    const text = arg.kind === "string" ? arg.value : formatValue(arg, { trailingNewline: false });
    const trimmed = text.trim();
    if (trimmed.startsWith("P ")) {
      return qNull();
    }
    if (trimmed.startsWith("l ")) {
      const path = trimmed.slice(2).trim();
      return loadScriptFromFs(session, path);
    }
    if (trimmed === "cd" || trimmed.startsWith("cd ")) {
      return qNull();
    }
    if (trimmed === "pwd") {
      return qString("/");
    }
    if (trimmed === "ls" || trimmed.startsWith("ls ")) {
      const dir = trimmed === "ls" ? "" : trimmed.slice(3).trim();
      const entries = session.fs().list(dir);
      return qList(entries.map((entry) => qString(entry)), true);
    }
    return session.unsupported(`system "${trimmed}"`);
  });
  register("read0", 1, (session, [arg]) => {
    const path = fileHandlePath(arg, "read0");
    const contents = session.fs().readText(path);
    if (contents === null) {
      throw new QRuntimeError("io", `read0: ${path} not found`);
    }
    return qList(textLines(contents).map((line) => qString(line)), true);
  });
  register("read1", 1, (session, [arg]) => {
    const path = fileHandlePath(arg, "read1");
    const fs = session.fs();
    if (fs.readBinary) {
      const bytes = fs.readBinary(path);
      if (bytes) {
        return byteListFromBytes(bytes);
      }
    }
    const text = fs.readText(path);
    if (text === null) {
      throw new QRuntimeError("io", `read1: ${path} not found`);
    }
    return byteListFromText(text);
  });
  register("hcount", 1, (session, [arg]) => {
    const path = fileHandlePath(arg, "hcount");
    const size = session.fs().size?.(path) ?? -1;
    if (size < 0) {
      throw new QRuntimeError("io", `hcount: ${path} not found`);
    }
    return qLong(size);
  });
  register("hdel", 1, (session, [arg]) => {
    const path = fileHandlePath(arg, "hdel");
    session.fs().deletePath(path);
    return arg;
  });
  register("hopen", 1, (_, [arg]) => {
    if (arg.kind !== "symbol") {
      throw new QRuntimeError("type", "hopen expects a file-handle symbol");
    }
    return qLong(1);
  });
  register("hclose", 1, (_, [_arg]) => qNull());
  register("@", 2, (session, [target, arg, handler]) => {
    const args = arg.kind === "list" && !(arg.homogeneous ?? false) ? arg.items : [arg];
    try {
      if (target.kind === "builtin" || target.kind === "lambda" || target.kind === "projection") {
        return session.invoke(target, args);
      }
      return applyValue(target, args);
    } catch (error) {
      if (handler === undefined) {
        throw error;
      }
      if (!(error instanceof QRuntimeError)) {
        throw error;
      }
      if (handler.kind === "builtin" || handler.kind === "lambda" || handler.kind === "projection") {
        return session.invoke(handler, [qString(error.message)]);
      }
      return applyValue(handler, [qString(error.message)]);
    }
  });
  register("|:", 1, (_, [arg]) => reverseValue(arg));
  register("#:", 1, (_, [arg]) => qLong(countValue(arg)));
  register(".Q.opt", 1, (_, [arg]) => parseQOpt(arg));
  register(".Q.def", 3, (_, [defaults, parser, raw]) => defineDefaults(defaults, parser, raw));
  register(".Q.f", 2, (_, [decimals, value]) => qString(toNumber(value).toFixed(toNumber(decimals))));
  register(".Q.fmt", 3, (_, [width, decimals, value]) => formatQNumber(width, decimals, value));
  register(".Q.addmonths", 2, (_, [dateValue, monthsValue]) =>
    mapBinary(dateValue, monthsValue, (dateArg, monthArg) => addMonthsValue(dateArg, monthArg))
  );
  register(".Q.atob", 1, (_, [arg]) => atobValue(arg));
  register(".Q.btoa", 1, (_, [arg]) => btoaValue(arg));
  register(".Q.s", 1, (_, [arg]) => qString(formatValue(arg)));
  register(".Q.id", 1, (_, [arg]) => qIdValue(arg));
  register(".Q.x10", 1, (_, [arg]) => encodeFixedBase(arg, 10, Q_X10_ALPHABET));
  register(".Q.j10", 1, (_, [arg]) => decodeFixedBase(arg, Q_X10_ALPHABET));
  register(".Q.x12", 1, (_, [arg]) => encodeFixedBase(arg, 12, Q_X12_ALPHABET));
  register(".Q.j12", 1, (_, [arg]) => decodeFixedBase(arg, Q_X12_ALPHABET));
  register(".cx.from", 1, (_, [arg]) => qComplexFromValue(arg));
  register(".cx.new", 2, (_, [re, im]) => qComplex(toNumber(re), toNumber(im)));
  register(".cx.z", 2, (_, [re, im]) => qComplex(toNumber(re), toNumber(im)));
  register(".cx.re", 1, (_, [arg]) => qFloat(complexParts(arg).re));
  register(".cx.im", 1, (_, [arg]) => qFloat(complexParts(arg).im));
  register(".cx.conj", 1, (_, [arg]) => {
    const value = complexParts(arg);
    return qComplex(value.re, -value.im);
  });
  register(".cx.neg", 1, (_, [arg]) => {
    const value = complexParts(arg);
    return qComplex(-value.re, -value.im);
  });
  register(".cx.add", 2, (_, [left, right]) => {
    const a = complexParts(left);
    const b = complexParts(right);
    return qComplex(a.re + b.re, a.im + b.im);
  });
  register(".cx.sub", 2, (_, [left, right]) => {
    const a = complexParts(left);
    const b = complexParts(right);
    return qComplex(a.re - b.re, a.im - b.im);
  });
  register(".cx.mul", 2, (_, [left, right]) => {
    const a = complexParts(left);
    const b = complexParts(right);
    return qComplex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  });
  register(".cx.div", 2, (_, [left, right]) => {
    const a = complexParts(left);
    const b = complexParts(right);
    const denominator = b.re * b.re + b.im * b.im;
    if (denominator === 0) {
      throw new QRuntimeError("domain", "domain");
    }
    return qComplex(
      (a.re * b.re + a.im * b.im) / denominator,
      (a.im * b.re - a.re * b.im) / denominator
    );
  });
  register(".cx.abs", 1, (_, [arg]) => qFloat(Math.hypot(complexParts(arg).re, complexParts(arg).im)));
  register(".cx.modulus", 1, (_, [arg]) => qFloat(Math.hypot(complexParts(arg).re, complexParts(arg).im)));
  register(".cx.floor", 1, (_, [arg]) => {
    const value = complexParts(arg);
    return qComplex(Math.floor(value.re), Math.floor(value.im));
  });
  register(".cx.ceil", 1, (_, [arg]) => {
    const value = complexParts(arg);
    return qComplex(Math.ceil(value.re), Math.ceil(value.im));
  });
  register(".cx.round", 1, (_, [arg]) => {
    const value = complexParts(arg);
    return qComplex(roundHalfAwayFromZero(value.re), roundHalfAwayFromZero(value.im));
  });
  register(".cx.frac", 1, (_, [arg]) => {
    const value = complexParts(arg);
    return qComplex(value.re - Math.floor(value.re), value.im - Math.floor(value.im));
  });
  register(".cx.mod", 2, (_, [left, right]) => complexModulo(left, right));
  register(".cx.arg", 1, (_, [arg]) => qFloat(complexArg(complexParts(arg))));
  register(".cx.recip", 1, (_, [arg]) => {
    const value = complexParts(arg);
    const denominator = value.re * value.re + value.im * value.im;
    if (denominator === 0) {
      throw new QRuntimeError("domain", "domain");
    }
    return qComplex(value.re / denominator, -value.im / denominator);
  });
  register(".cx.normalize", 1, (_, [arg]) => {
    const value = complexParts(arg);
    const magnitude = Math.hypot(value.re, value.im);
    if (magnitude === 0) {
      throw new QRuntimeError("domain", "domain");
    }
    return qComplex(value.re / magnitude, value.im / magnitude);
  });
  register(".cx.fromPolar", 2, (_, [radius, theta]) => {
    const r = toNumber(radius);
    const angle = toNumber(theta);
    return qComplex(r * Math.cos(angle), r * Math.sin(angle));
  });
  register(".cx.polar", 1, (_, [arg]) => {
    const value = complexParts(arg);
    return qDictionary(
      [qSymbol("r"), qSymbol("theta")],
      [qFloat(Math.hypot(value.re, value.im)), qFloat(complexArg(value))]
    );
  });
  register(".cx.exp", 1, (_, [arg]) => {
    const value = complexParts(arg);
    const expRe = Math.exp(value.re);
    return qComplex(expRe * Math.cos(value.im), expRe * Math.sin(value.im));
  });
  register(".cx.log", 1, (_, [arg]) => {
    const value = complexParts(arg);
    const magnitude = Math.hypot(value.re, value.im);
    if (magnitude === 0) {
      throw new QRuntimeError("domain", "domain");
    }
    return qComplex(Math.log(magnitude), complexArg(value));
  });
  register(".cx.pow", 2, (_, [left, right]) => {
    const base = complexParts(left);
    const exponent = complexParts(right);
    const magnitude = Math.hypot(base.re, base.im);
    if (magnitude === 0) {
      throw new QRuntimeError("domain", "domain");
    }
    const logBase = { re: Math.log(magnitude), im: complexArg(base) };
    const product = {
      re: exponent.re * logBase.re - exponent.im * logBase.im,
      im: exponent.re * logBase.im + exponent.im * logBase.re
    };
    const expRe = Math.exp(product.re);
    return qComplex(expRe * Math.cos(product.im), expRe * Math.sin(product.im));
  });
  register(".cx.powEach", 2, (_, [left, right]) => {
    const base = complexParts(left);
    if (right.kind === "number") {
      return qComplex(Math.pow(base.re, right.value), Math.pow(base.im, right.value));
    }
    const exponent = complexParts(right);
    return qComplex(Math.pow(base.re, exponent.re), Math.pow(base.im, exponent.im));
  });
  register(".cx.sqrt", 1, (_, [arg]) => {
    const value = complexParts(arg);
    const angle = complexArg(value) / 2;
    return qComplex(
      Math.sqrt(Math.hypot(value.re, value.im)) * Math.cos(angle),
      Math.sqrt(Math.hypot(value.re, value.im)) * Math.sin(angle)
    );
  });
  register(".cx.sin", 1, (_, [arg]) => {
    const value = complexParts(arg);
    return qComplex(Math.sin(value.re) * Math.cosh(value.im), Math.cos(value.re) * Math.sinh(value.im));
  });
  register(".cx.cos", 1, (_, [arg]) => {
    const value = complexParts(arg);
    return qComplex(Math.cos(value.re) * Math.cosh(value.im), -Math.sin(value.re) * Math.sinh(value.im));
  });
  register(".cx.tan", 1, (session, [arg]) => {
    const sine = session.invoke(session.get(".cx.sin"), [arg]);
    const cosine = session.invoke(session.get(".cx.cos"), [arg]);
    return session.invoke(session.get(".cx.div"), [sine, cosine]);
  });
  register(".cx.str", 1, (_, [arg]) => {
    const value = complexParts(arg);
    const sign = value.im < 0 ? "-" : "+";
    return qString(`${formatFloat(value.re)} ${sign} ${formatFloat(Math.abs(value.im))}i`);
  });
  register("cut", 2, (_, [left, right]) => cutValue(left, right));
  register("and", 2, (_, [left, right]) => mapBinary(left, right, (a, b) => minPair(a, b)));
  register("cross", 2, (_, [left, right]) => crossValue(left, right));
  register("over", 2, (session, [callable, arg, seed]) => reduceValue(session, callable, arg, seed));
  register("or", 2, (_, [left, right]) => mapBinary(left, right, (a, b) => maxPair(a, b)));
  register("prior", 2, (session, [callable, arg]) => priorValue(session, callable, arg));
  register("rotate", 2, (_, [left, right]) => rotateValue(left, right));
  register("scan", 2, (session, [callable, arg, seed]) => scanValue(session, callable, arg, seed));
  register("ss", 2, (_, [left, right]) => ssValue(left, right));
  register("sublist", 2, (_, [left, right]) => sublistValue(left, right));
  register("sv", 2, (_, [left, right]) => svValue(left, right));
  register("vs", 2, (_, [left, right]) => vsValue(left, right));
  register("xbar", 2, (_, [left, right]) => xbarValue(left, right));
  register("xcol", 2, (_, [left, right]) => xcolValue(left, right));
  register("xexp", 2, (_, [left, right]) =>
    mapBinary(left, right, (a, b) => qFloat(Math.pow(toNumber(a), toNumber(b))))
  );
  register("like", 2, (_, [left, right]) => likeValue(left, right));
  register("within", 2, (_, [left, right]) => withinValue(left, right));
  register("except", 2, (_, [left, right]) => exceptValue(left, right));
  register("inter", 2, (_, [left, right]) => interValue(left, right));
  register("union", 2, (_, [left, right]) => unionValue(left, right));
  register("xlog", 2, (_, [left, right]) =>
    mapBinary(left, right, (a, b) => qFloat(Math.log(toNumber(b)) / Math.log(toNumber(a))))
  );
  register(",/", 1, (session, args) => {
    if (args.length === 1) {
      return razeValue(args[0]!);
    }
    const items = args.length === 2 && args[1]?.kind === "list" ? [args[0]!, ...args[1].items] : args;
    return items.slice(1).reduce((acc, item) => session.invoke(session.get(","), [acc, item]), items[0]!);
  });
  registerPrimitiveDerivedAdverb("+");

  register("+", 2, (_, [left, right]) => mapBinary(left, right, (a, b) => add(a, b)));
  register("-", 2, (_, [left, right]) => mapBinary(left, right, (a, b) => subtract(a, b)));
  register("*", 2, (_, [left, right]) => mapBinary(left, right, (a, b) => multiply(a, b)));
  register("%", 2, (_, [left, right]) => mapBinary(left, right, (a, b) => divide(a, b)));
  register("div", 2, (_, [left, right]) => mapBinary(left, right, (a, b) => divValue(a, b)));
  register("mavg", 2, (_, [left, right]) => movingValue(left, right, avgValue, false));
  register("mcount", 2, (_, [left, right]) => movingValue(left, right, movingCountValue, true));
  register("mdev", 2, (_, [left, right]) =>
    movingValue(left, right, (window) => deviationValue(window, false), false)
  );
  register("msum", 2, (_, [left, right]) => movingValue(left, right, sumValue, false));
  register("mod", 2, (_, [left, right]) => mapBinary(left, right, (a, b) => modValue(a, b)));
  register("=", 2, (_, [left, right]) => mapBinary(left, right, (a, b) => qBool(equals(a, b))));
  register("<", 2, (_, [left, right]) => mapBinary(left, right, (a, b) => qBool(compare(a, b) < 0)));
  register(">", 2, (_, [left, right]) => mapBinary(left, right, (a, b) => qBool(compare(a, b) > 0)));
  register("<=", 2, (_, [left, right]) => mapBinary(left, right, (a, b) => qBool(compare(a, b) <= 0)));
  register(">=", 2, (_, [left, right]) => mapBinary(left, right, (a, b) => qBool(compare(a, b) >= 0)));
  register(",", 2, (_, [left, right]) => concatValues(left, right));
  register("!", 2, (_, [left, right]) => bangValue(left, right));
  register("#", 2, (_, [left, right]) => takeValue(left, right));
  register("_", 2, (_, [left, right]) => dropValue(left, right));
  register("~", 2, (_, [left, right]) => qBool(equals(left, right)));
  register("^", 2, (_, [left, right]) => fillValue(left, right));
  register("?", 2, (_, [left, right]) => findValue(left, right));
  register("$", 2, (_, [left, right]) => castValue(left, right));
  register("|", 2, (_, [left, right]) => mapBinary(left, right, (a, b) => maxPair(a, b)));
  register("&", 2, (_, [left, right]) => mapBinary(left, right, (a, b) => minPair(a, b)));
  ["-", "*", "%", "=", "<", ">", "<=", ">=", "!", "#", "_", "~", "^", "?", "$", "|", "&"].forEach(
    registerPrimitiveDerivedAdverb
  );
  register("/", 2, (session, [callable, arg, seed]) => reducePrimitiveAdverbValue(session, callable, arg, seed));
  register("\\", 2, (session, [callable, arg, seed]) => scanPrimitiveAdverbValue(session, callable, arg, seed));

  register("xasc", 2, (_, [left, right]) => xascValue(left, right, true));
  register("xdesc", 2, (_, [left, right]) => xascValue(left, right, false));
  register("xkey", 2, (_, [left, right]) => xkeyValue(left, right));
  register("xgroup", 2, (_, [left, right]) => xgroupValue(left, right));
  register("ssr", 3, (_, [text, pattern, replacement]) => ssrValue(text, pattern, replacement));

  register("lj", 2, (_, [left, right]) => leftJoin(left, right));
  register("ljf", 2, (_, [left, right]) => leftJoin(left, right));
  register("ij", 2, (_, [left, right]) => innerJoin(left, right));
  register("uj", 2, (_, [left, right]) => unionJoin(left, right));
  register("pj", 2, (_, [left, right]) => plusJoin(left, right));

  register("asof", 2, (_, [left, right]) => asofValue(left, right));
  register("wj", 4, (session, [wins, cols, left, rightSpec]) =>
    windowJoinValue(session, wins, cols, left, rightSpec, "prevailing")
  );
  register("wj1", 4, (session, [wins, cols, left, rightSpec]) =>
    windowJoinValue(session, wins, cols, left, rightSpec, "window")
  );

  register("mmu", 2, (_, [left, right]) => mmuValue(left, right));
  register("inv", 1, (_, [arg]) => invValue(arg));
  register("wsum", 2, (_, [left, right]) => wsumValue(left, right));
  register("wavg", 2, (_, [left, right]) => wavgValue(left, right));
  register("bin", 2, (_, [left, right]) => binarySearchValue(left, right, "bin"));
  register("binr", 2, (_, [left, right]) => binarySearchValue(left, right, "binr"));
  register("rank", 1, (_, [arg]) => rankValue(arg));
  register("rand", 1, (_, [arg]) => randValue(arg));
  register("hsym", 1, (_, [arg]) => hsymValue(arg));
  register("xcols", 2, (_, [left, right]) => xcolsValue(left, right));
  register("insert", 2, (session, [left, right]) => insertValue(session, left, right));
  register("upsert", 2, (session, [left, right]) => upsertValue(session, left, right));

  register("peach", 2, (session, [callable, arg]) => {
    const items =
      arg.kind === "list"
        ? arg.items
        : arg.kind === "string"
          ? [...arg.value].map((char) => qString(char))
          : [arg];
    return qList(items.map((item) => session.invoke(callable, [item])), false);
  });

  register("get", 1, (session, [arg]) => {
    if (arg.kind === "symbol") {
      if (arg.value.startsWith(":")) {
        return readQValueFromFs(session, arg.value.slice(1));
      }
      return session.get(arg.value);
    }
    return arg;
  });
  register("set", 2, (session, [target, value]) => {
    if (target.kind === "symbol") {
      if (target.value.startsWith(":")) {
        writeQValueToFs(session, target.value.slice(1), value);
        return target;
      }
      session.assignGlobal(target.value, value);
      return value;
    }
    if (target.kind === "list" && target.items.every((item) => item.kind === "symbol")) {
      const names = target.items.map((item) => (item as QSymbol).value);
      const values =
        value.kind === "list" && value.items.length === names.length
          ? value.items
          : names.map(() => value);
      for (let i = 0; i < names.length; i++) {
        session.assignGlobal(names[i]!, values[i]!);
      }
      return value;
    }
    throw new QRuntimeError("type", "set expects a symbol (or symbol list) target");
  });
  register("save", 1, (session, [arg]) => {
    if (arg.kind !== "symbol" || !arg.value.startsWith(":")) {
      throw new QRuntimeError("type", "save expects a file-handle symbol like `:foo.csv");
    }
    const path = arg.value.slice(1);
    const varName = variableNameFromFilePath(path);
    const value = session.get(varName);
    writeQValueToFs(session, path, value);
    return arg;
  });
  register("load", 1, (session, [arg]) => {
    if (arg.kind !== "symbol" || !arg.value.startsWith(":")) {
      throw new QRuntimeError("type", "load expects a file-handle symbol like `:foo.csv");
    }
    const path = arg.value.slice(1);
    const varName = variableNameFromFilePath(path);
    const value = readQValueFromFs(session, path);
    session.assignGlobal(varName, value);
    return qSymbol(varName);
  });

  register("getenv", 1, (session, [arg]) => {
    const name = arg.kind === "symbol" ? arg.value : arg.kind === "string" ? arg.value : "";
    const env = session.hostEnv();
    return qString(env[name] ?? "");
  });
  register("setenv", 2, (_, [key, value]) => {
    if (key.kind !== "symbol") {
      throw new QRuntimeError("type", "setenv expects a symbol key");
    }
    return value;
  });

  register("gtime", 1, (_, [arg]) => arg);
  register("ltime", 1, (_, [arg]) => arg);

  register("parse", 1, (_, [arg]) => arg);
  register("eval", 1, (session, [arg]) => {
    if (arg.kind === "string") {
      return session.evaluate(arg.value).value;
    }
    return arg;
  });

  register("tables", 1, (session, [arg]) => {
    const ns = arg.kind === "symbol" ? arg.value : "";
    return session.listTables(ns);
  });
  register("views", 1, () => qList([], true));

  register("while", 2, (session) => session.unsupported("while (expression form)"));

  register("in", 2, (_, [left, right]) => inValue(left, right));
  register("each", 2, (session, [callable, arg]) => {
    const items =
      arg.kind === "list"
        ? arg.items
        : arg.kind === "string"
          ? [...arg.value].map((char) => qString(char))
          : [arg];
    return qList(items.map((item) => session.invoke(callable, [item])), false);
  });

  register("aj", 3, (_, [cols, left, right]) => asofJoinValue(cols, left, right, { useT2Time: false, fill: false }));
  register("aj0", 3, (_, [cols, left, right]) => asofJoinValue(cols, left, right, { useT2Time: true, fill: false }));
  register("ajf", 3, (_, [cols, left, right]) => asofJoinValue(cols, left, right, { useT2Time: false, fill: true }));
  register("ajf0", 3, (_, [cols, left, right]) => asofJoinValue(cols, left, right, { useT2Time: true, fill: true }));
  register("ej", 3, (_, [cols, left, right]) => equiJoinValue(cols, left, right));
  register("exit", 1, (session) => session.unsupported("exit"));

  return builtins;
};

const SHARED_BUILTINS = createBuiltins();

export const createSession = (host?: HostAdapter) => new Session(host);

export const evaluate = (source: string, session = createSession()): EvalResult =>
  session.evaluate(source);

export const formatValue = (
  value: QValue,
  options: FormatOptions = { trailingNewline: true }
): string => {
  const text = formatBare(value);
  return options.trailingNewline === false ? text : `${text}\n`;
};

export const listBuiltins = () => ({
  monads: [
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
    "show",
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
  ],
  diads: [
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
    "div",
    "mavg",
    "mcount",
    "mdev",
    "msum",
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
    "inter",
    "union",
    "xbar",
    "xexp",
    "xlog",
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
    "ij",
    "uj",
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
    "set"
  ],
  triads: ["aj", "aj0", "ajf", "ajf0", "ej"],
  quads: ["wj", "wj1"]
});

const buildTokenTape = (tokens: Token[]) => "x".repeat(tokens.length);

export const parsePeggyExpressionForTests = (source: string): AstNode => {
  let tokens: Token[] = [];
  try {
    tokens = tokenize(source);
    return pegParse(buildTokenTape(tokens), {
      tokens,
      Parser,
      source,
      startRule: "ExpressionStart"
    } as Parameters<typeof pegParse>[1] & { startRule: string }) as AstNode;
  } catch (error) {
    throw enrichParseError(error, source, tokens);
  }
};

export const parse = (source: string): AstNode => {
  let tokens: Token[] = [];
  try {
    tokens = tokenize(source);
    return pegParse(buildTokenTape(tokens), { tokens, Parser, source }) as AstNode;
  } catch (error) {
    throw enrichParseError(error, source, tokens);
  }
};

export class Parser {
  index = 0;
  private readonly tokens: Token[];
  private readonly source: string;
  private readonly stopIdentifiers: Set<string>[] = [];
  private readonly stopOperators: Set<string>[] = [];

  constructor(tokens: Token[], source = "") {
    this.tokens = tokens;
    this.source = source;
  }

  parseProgram(source: string): AstNode {
    const statements: AstNode[] = [];
    while (!this.match("eof")) {
      this.skipSeparators();
      if (this.peek().kind === "eof") {
        break;
      }
      statements.push(this.parseStatement());
      this.skipSeparators();
    }
    return { kind: "program", statements, source };
  }

  parseStatement(): AstNode {
    if (
      this.peek().kind === "operator" &&
      this.peek().value === ":" &&
      this.peek(1).kind !== "lbracket" &&
      !(this.peek(1).kind === "operator" && this.peek(1).value === ":")
    ) {
      this.consume("operator", ":");
      return { kind: "return", value: this.parseExpression() };
    }
    return this.parseExpression();
  }

  parseExpression(): AstNode {
    if (this.peek().kind === "identifier") {
      switch (this.peek().value) {
        case "select":
          return this.parseSelectExpression();
        case "exec":
          return this.parseExecExpression();
        case "update":
          return this.parseUpdateExpression();
        case "delete":
          return this.parseDeleteExpression();
      }
    }
    return this.parseAssignment();
  }

  parseSelectExpression(): AstNode {
    this.consume("identifier", "select");
    const columns =
      this.peek().kind === "identifier" &&
      (this.peek().value === "from" || this.peek().value === "by")
      ? null
      : this.parseSelectColumns(["by", "from"]);
    const by = this.parseOptionalByClause();
    this.consume("identifier", "from");
    const source = this.withStopIdentifiers(["where"], () => this.parseAssignment());
    const where = this.parseOptionalWhereClause();
    return { kind: "select", columns, by, source, where };
  }

  parseExecExpression(): AstNode {
    this.consume("identifier", "exec");
    const value = this.withStopIdentifiers(["by", "from"], () => this.parseAssignment());
    const by = this.parseOptionalByClause();
    this.consume("identifier", "from");
    const source = this.withStopIdentifiers(["where"], () => this.parseAssignment());
    const where = this.parseOptionalWhereClause();
    return { kind: "exec", value, by, source, where };
  }

  parseUpdateExpression(): AstNode {
    this.consume("identifier", "update");
    const updates = this.parseUpdateClauses();
    this.consume("identifier", "from");
    const source = this.withStopIdentifiers(["where"], () => this.parseAssignment());
    const where = this.parseOptionalWhereClause();
    return { kind: "update", updates, source, where };
  }

  parseDeleteExpression(): AstNode {
    this.consume("identifier", "delete");
    const columns =
      this.peek().kind === "identifier" && this.peek().value === "from"
        ? null
        : this.parseDeleteColumns();
    this.consume("identifier", "from");
    const source = this.withStopIdentifiers(["where"], () => this.parseAssignment());
    const where = this.parseOptionalWhereClause();
    return { kind: "delete", columns, source, where };
  }

  private parseSelectColumns(stopIdentifiers: string[] = ["from"]) {
    const columns: { name: string | null; value: AstNode }[] = [];
    while (!this.match("eof")) {
      const value = this.withStopOperators([","], () =>
        this.withStopIdentifiers(stopIdentifiers, () => this.parseAssignment())
      );
      columns.push(value.kind === "assign" ? { name: value.name, value: value.value } : { name: null, value });
      if (this.peek().kind === "operator" && this.peek().value === ",") {
        this.consume("operator", ",");
        continue;
      }
      break;
    }
    return columns;
  }

  private parseUpdateClauses() {
    const updates: { name: string; value: AstNode }[] = [];
    while (!this.match("eof")) {
      const update = this.withStopOperators([","], () =>
        this.withStopIdentifiers(["from"], () => this.parseAssignment())
      );
      if (update.kind !== "assign") {
        this.parseError("update expects assignment clauses");
      }
      updates.push({ name: update.name, value: update.value });
      if (this.peek().kind === "operator" && this.peek().value === ",") {
        this.consume("operator", ",");
        continue;
      }
      break;
    }
    return updates;
  }

  private parseDeleteColumns() {
    const columns: string[] = [];
    while (!this.match("eof")) {
      if (this.peek().kind !== "identifier") {
        this.parseError("delete expects column names");
      }
      columns.push(this.consume("identifier").value);
      if (this.peek().kind === "operator" && this.peek().value === ",") {
        this.consume("operator", ",");
        continue;
      }
      break;
    }
    return columns;
  }

  private parseOptionalWhereClause() {
    if (this.peek().kind === "identifier" && this.peek().value === "where") {
      this.consume("identifier", "where");
      return this.parseAssignment();
    }
    return null;
  }

  private parseOptionalByClause() {
    if (this.peek().kind === "identifier" && this.peek().value === "by") {
      this.consume("identifier", "by");
      return this.parseSelectColumns(["from"]);
    }
    return null;
  }

  private withStopIdentifiers<T>(stops: string[], fn: () => T): T {
    this.stopIdentifiers.push(new Set(stops));
    try {
      return fn();
    } finally {
      this.stopIdentifiers.pop();
    }
  }

  private withStopOperators<T>(stops: string[], fn: () => T): T {
    this.stopOperators.push(new Set(stops));
    try {
      return fn();
    } finally {
      this.stopOperators.pop();
    }
  }

  private isStopIdentifier(token: Token) {
    return token.kind === "identifier" && this.stopIdentifiers.some((stops) => stops.has(token.value));
  }

  private isStopOperator(token: Token) {
    return token.kind === "operator" && this.stopOperators.some((stops) => stops.has(token.value));
  }

  private parseAssignment(): AstNode {
    if (
      this.peek().kind === "identifier" &&
      this.peek(1).kind === "operator" &&
      this.peek(1).value === "::"
    ) {
      const name = this.consume("identifier").value;
      this.consume("operator", "::");
      return { kind: "assignGlobal", name, value: this.parseExpression() };
    }
    if (
      this.peek().kind === "identifier" &&
      this.peek(1).kind === "operator" &&
      this.peek(1).value === ":"
    ) {
      const name = this.consume("identifier").value;
      this.consume("operator", ":");
      return { kind: "assign", name, value: this.parseExpression() };
    }
    if (
      this.peek().kind === "identifier" &&
      this.peek(1).kind === "operator" &&
      isAssignmentOperator(this.peek(1).value)
    ) {
      const name = this.consume("identifier").value;
      const op = this.consume("operator").value;
      return {
        kind: "assign",
        name,
        value: {
          kind: "binary",
          op: op.slice(0, -1),
          left: { kind: "identifier", name },
          right: this.parseExpression()
        }
      };
    }
    return this.parseBinary();
  }

  private parseBinary(): AstNode {
    return this.parseBinaryTail(this.parseApplication());
  }

  private parseApplication(): AstNode {
    let callee = this.parsePrimary();

    while (true) {
      if (this.peek().kind === "lbracket") {
        const args = this.parseBracketArgs();
        if (callee.kind === "identifier") {
          if (callee.name === "if") {
            return this.buildIfExpression(args);
          }
          if (callee.name === "while") {
            return this.buildWhileExpression(args);
          }
          if (callee.name === "do") {
            return this.buildDoExpression(args);
          }
          if (callee.name === "$") {
            return this.buildCondExpression(args);
          }
        }
        callee = { kind: "call", callee, args };
        continue;
      }
      if (
        this.peek().kind === "operator" &&
        this.peek().value === "'" &&
        this.peek(1).kind === "lbracket"
      ) {
        this.consume("operator", "'");
        const args = this.parseBracketArgs();
        callee = { kind: "eachCall", callee, args };
        continue;
      }
      if (
        this.peek().kind === "operator" &&
        (this.peek().value === "/" || this.peek().value === "\\") &&
        this.peek(1).kind === "lbracket"
      ) {
        const adverb = this.consume("operator").value;
        const args = this.parseBracketArgs();
        callee = {
          kind: "call",
          callee: { kind: "identifier", name: adverb },
          args: [callee, ...args]
        };
        continue;
      }
      break;
    }

    if (this.peek().kind === "identifier" && this.peek().value === "each") {
      this.consume("identifier", "each");
      return { kind: "each", callee, arg: this.parseAssignment() };
    }

    const isDerivedAdverbName = (name: string) =>
      /^[^a-zA-Z_\s]+[/\\]$/.test(name) && name.length >= 2;
    const monadName =
      callee.kind === "identifier"
        ? callee.name
        : callee.kind === "group" &&
            callee.value.kind === "identifier" &&
            isDerivedAdverbName(callee.value.name)
          ? callee.value.name
          : null;

    if (
      monadName !== null &&
      (MONAD_KEYWORDS.has(monadName) || isDerivedAdverbName(monadName)) &&
      this.canStartPrimary(this.peek()) &&
      !this.isStopIdentifier(this.peek()) &&
      !(this.peek().kind === "identifier" && WORD_DIAD_KEYWORDS.has(this.peek().value))
    ) {
      const arg = this.parseAssignment();
      return {
        kind: "call",
        callee,
        args: callee.kind === "group" && arg.kind === "list" ? arg.items : [arg]
      };
    }

    if (
      callee.kind === "identifier" &&
      WORD_DIAD_KEYWORDS.has(callee.name) &&
      this.canStartPrimary(this.peek()) &&
      !this.isStopIdentifier(this.peek())
    ) {
      return callee;
    }

    const adjacent: AstNode[] = [];
    while (this.canStartPrimary(this.peek()) && !this.isStopIdentifier(this.peek())) {
      if (this.peek().kind === "identifier" && WORD_DIAD_KEYWORDS.has(this.peek().value)) {
        break;
      }
      if (
        this.peek().kind === "identifier" &&
        MONAD_KEYWORDS.has(this.peek().value) &&
        isCallableAst(callee)
      ) {
        adjacent.push(this.parseBinary());
        break;
      }
      if (
        adjacent.length === 0 &&
        isCallableAst(callee) &&
        (this.peek().kind === "lparen" || this.peek().kind === "lbrace")
      ) {
        adjacent.push(this.parseBinary());
        continue;
      }
      adjacent.push(this.parseAdjacentArgument());
      while (this.peek().kind === "lbracket") {
        const last = adjacent[adjacent.length - 1]!;
        if (!isCallableAst(last)) {
          // A bracket following a non-callable atom in a vector context should
          // apply to the whole vector, not the trailing atom. Break out so the
          // outer parser can attach it after the vector is constructed.
          break;
        }
        const nestedArgs = this.parseBracketArgs();
        adjacent.pop();
        adjacent.push({ kind: "call", callee: last, args: nestedArgs });
      }
      if (
        this.peek().kind === "lbracket" &&
        adjacent.length > 0 &&
        !isCallableAst(adjacent[adjacent.length - 1]!)
      ) {
        break;
      }
    }

    if (adjacent.length === 0) {
      return callee;
    }

    if (adjacent.length === 1 && (callee.kind === "string" || isCallableAst(callee))) {
      adjacent[0] = this.parseBinaryTail(adjacent[0]!);
    }

    if (callee.kind === "string") {
      return {
        kind: "call",
        callee,
        args: [adjacent.length === 1 ? adjacent[0] : { kind: "vector", items: adjacent }]
      };
    }

    if (isCallableAst(callee)) {
      if (callee.kind === "group" && adjacent.length === 1 && adjacent[0]?.kind === "list") {
        return { kind: "call", callee, args: adjacent[0].items };
      }
      if (
        adjacent.length > 1 &&
        !this.isStopIdentifier(this.peek()) &&
        !this.isStopOperator(this.peek()) &&
        ((this.peek().kind === "identifier" && WORD_DIAD_KEYWORDS.has(this.peek().value)) ||
          (this.peek().kind === "operator" &&
            this.peek().value !== ":" &&
            this.peek().value !== ";"))
      ) {
        const vectorArg: AstNode = { kind: "vector", items: adjacent };
        const binaryArg = this.parseBinaryTail(vectorArg);
        if (binaryArg !== vectorArg) {
          return { kind: "call", callee, args: [binaryArg] };
        }
      }
      const chained =
        callee.kind === "identifier" || callee.kind === "lambda" || callee.kind === "group"
          ? this.collapseAdjacentCallChain(adjacent)
          : null;
      if (chained) {
        return { kind: "call", callee, args: [chained] };
      }
      return { kind: "call", callee, args: adjacent };
    }

    let result: AstNode = { kind: "vector", items: [callee, ...adjacent] };
    while (this.peek().kind === "lbracket") {
      const args = this.parseBracketArgs();
      result = { kind: "call", callee: result, args };
    }
    return result;
  }

  private parseAdjacentArgument(): AstNode {
    if (
      this.peek().kind === "identifier" &&
      this.peek(1).kind === "operator" &&
      this.peek(1).value === ":"
    ) {
      return this.parseAssignment();
    }
    const left = this.parsePrimary();
    if (left.kind === "identifier" && left.name === "flip" && this.canStartPrimary(this.peek())) {
      return {
        kind: "call",
        callee: left,
        args: [this.parseBinary()]
      };
    }
    if (this.peek().kind === "operator" && this.peek().value === "$") {
      const op = this.consume("operator").value;
      const right = this.parseBinary();
      return { kind: "binary", op, left, right };
    }
    return left;
  }

  private collapseAdjacentCallChain(items: AstNode[]): AstNode | null {
    if (items.length < 2 || !isCallableAst(items[0]!)) {
      return null;
    }

    const [head, ...rest] = items;
    const nested = this.collapseAdjacentCallChain(rest);
    const arg =
      nested ?? (rest.length === 1 ? rest[0]! : { kind: "vector", items: rest });

    return { kind: "call", callee: head, args: [arg] };
  }

  private buildIfExpression(args: AstNode[]): AstNode {
    if (args.length < 2) {
      this.parseError("if expects a condition and at least one body expression");
    }

    return {
      kind: "if",
      condition: args[0]!,
      body: args.slice(1)
    };
  }

  private buildWhileExpression(args: AstNode[]): AstNode {
    if (args.length < 2) {
      this.parseError("while expects a condition and at least one body expression");
    }
    return {
      kind: "while",
      condition: args[0]!,
      body: args.slice(1)
    };
  }

  private buildDoExpression(args: AstNode[]): AstNode {
    if (args.length < 2) {
      this.parseError("do expects a count and at least one body expression");
    }
    return {
      kind: "do",
      count: args[0]!,
      body: args.slice(1)
    };
  }

  private buildCondExpression(args: AstNode[]): AstNode {
    if (args.length < 2) {
      this.parseError("$ expects at least a condition and a result");
    }

    const elseValue = args.length % 2 === 1 ? args[args.length - 1]! : null;
    const branchArgs = elseValue ? args.slice(0, -1) : args;
    const branches: { condition: AstNode; value: AstNode }[] = [];

    for (let index = 0; index < branchArgs.length; index += 2) {
      const condition = branchArgs[index];
      const value = branchArgs[index + 1];
      if (!condition || !value) {
        this.parseError("$ expects condition/result pairs");
      }
      branches.push({ condition, value });
    }

    return {
      kind: "cond",
      branches,
      elseValue
    };
  }

  private parsePrimary(): AstNode {
    const token = this.peek();
    if (this.isStopIdentifier(token)) {
      this.parseError(`Unexpected identifier ${token.value}`, token);
    }
    switch (token.kind) {
      case "number":
        return { kind: "number", value: this.consume("number").value };
      case "date":
        return { kind: "date", value: this.consume("date").value };
      case "string":
        return { kind: "string", value: this.consume("string").value };
      case "symbol":
        return { kind: "symbol", value: this.consume("symbol").value };
      case "boolean":
        return { kind: "boolean", value: this.consume("boolean").value === "1b" };
      case "boolvector": {
        const value = this.consume("boolvector").value;
        return {
          kind: "vector",
          items: [...value.slice(0, -1)].map<AstNode>((digit) => ({
            kind: "boolean",
            value: digit === "1"
          }))
        };
      }
      case "null":
        this.consume("null");
        return { kind: "null" };
      case "identifier":
        if (token.value === "select") return this.parseSelectExpression();
        if (token.value === "exec") return this.parseExecExpression();
        if (token.value === "update") return this.parseUpdateExpression();
        if (token.value === "delete") return this.parseDeleteExpression();
        return { kind: "identifier", name: this.consume("identifier").value };
      case "operator":
        return this.parseOperatorValue();
      case "lparen": {
        this.consume("lparen");
        if (this.peek().kind === "rparen") {
          this.consume("rparen");
          return { kind: "list", items: [] };
        }
        if (this.peek().kind === "lbracket") {
          return this.peek(1).kind === "rbracket"
            ? this.parseTableLiteral()
            : this.parseKeyedTableLiteral();
        }
        const first = this.parseExpression();
        if (this.peek().kind === "separator") {
          const items = [first];
          while (this.peek().kind === "separator") {
            this.consume("separator");
            if (this.peek().kind === "rparen") {
              break;
            }
            items.push(this.parseExpression());
          }
          this.consume("rparen");
          return { kind: "list", items };
        }
        this.consume("rparen");
        return { kind: "group", value: first };
      }
      case "lbrace":
        return this.parseLambda();
      default:
        this.parseError(`Unexpected token: ${token.kind} ${token.value}`, token);
    }
  }

  private parseOperatorValue(): AstNode {
    const base = this.consume("operator").value;
    if (
      base === ";" ||
      (base === ":" &&
        this.peek().kind !== "lbracket" &&
        !(this.peek().kind === "operator" && this.peek().value === ":"))
    ) {
      this.parseError(`Unexpected token: operator ${base}`);
    }

    return { kind: "identifier", name: this.extendOperatorName(base) };
  }

  private parseTableLiteral(): AstNode {
    this.consume("lbracket");
    this.consume("rbracket");
    const columns = this.parseColumnDefinitions("rparen");
    this.consume("rparen");
    return { kind: "table", columns };
  }

  private parseKeyedTableLiteral(): AstNode {
    this.consume("lbracket");
    const keys = this.parseColumnDefinitions("rbracket");
    this.consume("rbracket");
    if (this.peek().kind === "separator") {
      this.consume("separator");
    }
    const values = this.parseColumnDefinitions("rparen");
    this.consume("rparen");
    return { kind: "keyedTable", keys, values };
  }

  private parseColumnDefinitions(endToken: "rparen" | "rbracket") {
    const columns: { name: string; value: AstNode }[] = [];
    while (this.peek().kind !== endToken && this.peek().kind !== "eof") {
      this.skipSeparators();
      if (this.peek().kind === endToken) {
        break;
      }

      if (this.peek().kind === "identifier") {
        const name = this.consume("identifier").value;
        if (this.peek().kind === "operator" && this.peek().value === ":") {
          this.consume("operator", ":");
          columns.push({ name, value: this.parseExpression() });
        } else {
          columns.push({ name, value: { kind: "identifier", name } });
        }
      } else {
        const autoName = columns.length === 0 ? "x" : `x${columns.length}`;
        columns.push({ name: autoName, value: this.parseExpression() });
      }

      if (this.peek().kind === "separator") {
        this.consume("separator");
      }
    }
    return columns;
  }

  private parseLambda(): AstNode {
    const sourceTokens: string[] = [];
    this.consume("lbrace");
    sourceTokens.push("{");

    let params: string[] | null = null;
    if (this.peek().kind === "lbracket") {
      this.consume("lbracket");
      sourceTokens.push("[");
      params = [];
      while (this.peek().kind !== "rbracket") {
        if (this.peek().kind === "identifier") {
          params.push(this.consume("identifier").value);
          sourceTokens.push(params[params.length - 1]);
        } else if (this.peek().kind === "separator") {
          this.consume("separator");
          sourceTokens.push(";");
        } else {
          this.parseError("Invalid lambda parameter list");
        }
      }
      this.consume("rbracket");
      sourceTokens.push("]");
    }

    const body: AstNode[] = [];
    while (this.peek().kind !== "rbrace" && this.peek().kind !== "eof") {
      this.skipSeparators();
      if (this.peek().kind === "rbrace") {
        break;
      }
      const statement = this.parseStatement();
      body.push(statement);
      sourceTokens.push(renderAst(statement));
      this.skipSeparators();
      if (this.peek().kind === "separator") {
        this.consume("separator");
        sourceTokens.push(";");
      }
    }
    this.consume("rbrace");
    sourceTokens.push("}");
    return {
      kind: "lambda",
      params,
      body,
      source: sourceTokens.join("")
    };
  }

  private parseBracketArgs(): AstNode[] {
    this.consume("lbracket");
    const args: AstNode[] = [];
    while (this.peek().kind !== "rbracket") {
      this.skipNewlines();
      if (this.peek().kind === "rbracket") {
        break;
      }
      if (this.peek().kind === "separator") {
        args.push({ kind: "placeholder" });
        this.consume("separator");
        this.skipNewlines();
        continue;
      }
      args.push(this.parseExpression());
      this.skipNewlines();
      if (this.peek().kind === "separator") {
        this.consume("separator");
        this.skipNewlines();
        if (this.peek().kind === "rbracket") {
          args.push({ kind: "placeholder" });
        }
      }
    }
    this.consume("rbracket");
    return args;
  }

  private skipSeparators() {
    while (this.peek().kind === "newline" || this.peek().kind === "separator") {
      this.index += 1;
    }
  }

  private skipNewlines() {
    while (this.peek().kind === "newline") {
      this.index += 1;
    }
  }

  private canStartPrimary(token: Token): boolean {
    return [
      "number",
      "date",
      "string",
      "symbol",
      "boolean",
      "boolvector",
      "null",
      "identifier",
      "lparen",
      "lbrace"
    ].includes(token.kind);
  }

  private peek(offset = 0): Token {
    return this.tokens[this.index + offset] ?? { kind: "eof", value: "", start: 0, end: 0 };
  }

  private match(kind: string): boolean {
    return this.peek().kind === kind;
  }

  private consume(kind: string, value?: string): Token {
    const token = this.peek();
    if (token.kind !== kind || (value !== undefined && token.value !== value)) {
      this.parseError(`Expected ${kind}${value ? ` ${value}` : ""} but found ${token.kind} ${token.value}`, token);
    }
    this.index += 1;
    return token;
  }

  private parseError(message: string, token = this.peek()): never {
    throw new QRuntimeError("parse", message, tokenToRange(this.source, token));
  }

  private parseBinaryTail(left: AstNode): AstNode {
    if (this.isStopIdentifier(this.peek())) {
      return left;
    }
    if (this.isStopOperator(this.peek())) {
      return left;
    }
    if (this.peek().kind === "identifier" && WORD_DIAD_KEYWORDS.has(this.peek().value)) {
      const op = this.consume("identifier").value;
      const right = this.parseAssignment();
      return { kind: "binary", op, left, right };
    }
    if (this.peek().kind === "operator" && this.peek().value !== ":" && this.peek().value !== ";") {
      const op = this.extendOperatorName(this.consume("operator").value);
      if (["separator", "rparen", "rbracket", "rbrace", "eof"].includes(this.peek().kind)) {
        return { kind: "call", callee: { kind: "identifier", name: op }, args: [left] };
      }
      const right = this.parseAssignment();
      return { kind: "binary", op, left, right };
    }
    return left;
  }

  private extendOperatorName(base: string) {
    let name = base;
    while (this.peek().kind === "operator") {
      const suffix = this.peek().value;
      if (suffix === "':" && !name.endsWith(":")) {
        name += this.consume("operator").value;
        continue;
      }
      if (suffix === "'" && !name.endsWith("'") && !name.endsWith(":")) {
        name += this.consume("operator").value;
        continue;
      }
      if (suffix === ":" && !name.endsWith(":")) {
        name += this.consume("operator").value;
        continue;
      }
      if ((suffix === "/" || suffix === "\\") && !name.endsWith("/") && !name.endsWith("\\")) {
        name += this.consume("operator").value;
        continue;
      }
      if (suffix === "/:" || suffix === "\\:") {
        name += this.consume("operator").value;
        continue;
      }
      break;
    }
    return name;
  }
}

export const tokenize = (source: string): Token[] => {
  return lexKdbLex(source).flatMap(adaptKdbLexToken);
};

const adaptKdbLexToken = (token: KdbLexToken): Token[] => {
  switch (token.kind) {
    case "whitespace":
    case "comment":
    case "directive":
      return [];
    case "newline":
      return [{ kind: "newline", value: token.value, start: token.start, end: token.end }];
    case "separator":
      return [{ kind: "separator", value: token.value, start: token.start, end: token.end }];
    case "identifier":
      return [{ kind: "identifier", value: token.value, start: token.start, end: token.end }];
    case "symbol":
      return [{ kind: "symbol", value: token.value.slice(1), start: token.start, end: token.end }];
    case "operator":
      if (
        token.value.length === 2 &&
        (token.value === "+/" || token.value === "+\\" || token.value === ",/" || token.value === ",\\")
      ) {
        return [{ kind: "operator", value: token.value, start: token.start, end: token.end }];
      }
      return [{ kind: "operator", value: token.value, start: token.start, end: token.end }];
    case "date":
      return [{ kind: "date", value: token.value, start: token.start, end: token.end }];
    case "number":
      return [{ kind: "number", value: token.value, start: token.start, end: token.end }];
    case "boolean":
      return [{ kind: "boolean", value: token.value, start: token.start, end: token.end }];
    case "boolvector":
      return [{ kind: "boolvector", value: token.value.replace(/[ \t]+/g, ""), start: token.start, end: token.end }];
    case "string":
      return [
        {
          kind: "string",
          value:
            token.value.length >= 2 && token.value.startsWith("\"") && token.value.endsWith("\"")
              ? token.value.slice(1, -1).replace(/\\(.)/g, "$1")
              : token.value.replace(/^"/, "").replace(/\\(.)/g, "$1"),
          start: token.start,
          end: token.end
        }
      ];
    case "bracket":
      return [{ kind: bracketKind(token.value), value: token.value, start: token.start, end: token.end }];
    case "eof":
      return [{ kind: "eof", value: "", start: token.start, end: token.end }];
  }
};

const enrichParseError = (error: unknown, source: string, tokens: Token[]): Error => {
  if (error instanceof KdbLexError) {
    return buildLocatedError(error, source, createSourceRange(source, error.offset, error.offset + 1), "KDBLex");
  }

  if (hasSourceLocation(error)) {
    return buildLocatedError(error, source, error.location);
  }

  if (error instanceof QRuntimeError && error.qName === "parse" && error.location) {
    return buildLocatedError(error, source, error.location);
  }

  if (isPeggySyntaxError(error)) {
    return buildLocatedError(error, source, tokenIndexRangeToSourceRange(source, tokens, error.location?.start?.offset ?? 0));
  }

  return error instanceof Error ? error : new Error(String(error));
};

const isPeggySyntaxError = (
  error: unknown
): error is Error & { location?: { start?: { offset?: number } } } => {
  return error instanceof Error && error.name === "SyntaxError";
};

const hasSourceLocation = (error: unknown): error is Error & { location: SourceRange } => {
  return error instanceof Error && typeof (error as { location?: unknown }).location === "object" && (error as { location?: unknown }).location !== null;
};

const buildLocatedError = (
  error: Error,
  source: string,
  range: SourceRange,
  prefix?: string
): Error => {
  const label = prefix ? `${prefix}: ${error.message}` : error.message;
  const near = describeSourceSnippet(source, range.start.offset);
  const message = `${label} at line ${range.start.line}, char ${range.start.column} (offset ${range.start.offset})${near ? ` near ${near}` : ""}`;
  const next = new Error(message);
  next.name = error.name;
  next.stack = `${next.name}: ${message}`;
  return next;
};

const tokenToRange = (source: string, token: Token): SourceRange => ({
  start: offsetToPosition(token.start, source),
  end: offsetToPosition(token.end, source)
});

const tokenIndexRangeToSourceRange = (source: string, tokens: Token[], tokenIndex: number): SourceRange => {
  const token = tokens[Math.min(tokenIndex, Math.max(tokens.length - 1, 0))];
  if (!token) {
    return createSourceRange(source, source.length, source.length);
  }
  return createSourceRange(source, token.start, token.end);
};

const createSourceRange = (source: string, startOffset: number, endOffset: number): SourceRange => ({
  start: offsetToPosition(Math.max(0, Math.min(startOffset, source.length)), source),
  end: offsetToPosition(Math.max(0, Math.min(endOffset, source.length)), source)
});

const offsetToPosition = (offset: number, source = ""): SourcePosition => {
  let line = 1;
  let column = 1;
  for (let index = 0; index < offset && index < source.length; index += 1) {
    if (source[index] === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column, offset };
};

const describeSourceSnippet = (source: string, offset: number) => {
  if (!source) return "";
  const lineStart = source.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const rawLineEnd = source.indexOf("\n", offset);
  const lineEnd = rawLineEnd === -1 ? source.length : rawLineEnd;
  const line = source.slice(lineStart, lineEnd).trim();
  if (!line) return "";

  const relativeOffset = Math.max(0, offset - lineStart);
  const snippetStart = Math.max(0, relativeOffset - 12);
  const snippetEnd = Math.min(line.length, relativeOffset + 12);
  const snippet = line.slice(snippetStart, snippetEnd).trim();
  return snippet ? `\`${snippet}\`` : "";
};

const bracketKind = (value: string): Token["kind"] => {
  switch (value) {
    case "(":
      return "lparen";
    case ")":
      return "rparen";
    case "[":
      return "lbracket";
    case "]":
      return "rbracket";
    case "{":
      return "lbrace";
    case "}":
      return "rbrace";
    default:
      throw new QRuntimeError("parse", `Unexpected bracket token: ${value}`);
  }
};

const isCallableAst = (node: AstNode) =>
  node.kind === "identifier" ||
  node.kind === "lambda" ||
  node.kind === "call" ||
  node.kind === "group" ||
  node.kind === "list" ||
  node.kind === "table" ||
  node.kind === "keyedTable";

const isAssignmentOperator = (value: string) =>
  value.length > 1 && value.endsWith(":") && value !== "::";

const isShowExpression = (node: AstNode): boolean =>
  node.kind === "call" &&
  node.callee.kind === "identifier" &&
  node.callee.name === "show";

const isSilentExpression = (node: AstNode): boolean =>
  node.kind === "assign" || node.kind === "assignGlobal" || isShowExpression(node);

const renderAst = (node: AstNode): string => {
  switch (node.kind) {
    case "return":
      return `:${renderAst(node.value)}`;
    case "identifier":
      return node.name;
    case "number":
    case "date":
    case "string":
    case "symbol":
      return node.value;
    case "boolean":
      return node.value ? "1b" : "0b";
    case "null":
      return "0N";
    case "placeholder":
      return "";
    case "vector":
      return node.items.map(renderAst).join(" ");
    case "list":
      return `(${node.items.map(renderAst).join(";")})`;
    case "table":
      return `([] ${node.columns
        .map((column) => `${column.name}:${renderAst(column.value)}`)
        .join(";")})`;
    case "keyedTable":
      return `([${node.keys
        .map((column) => `${column.name}:${renderAst(column.value)}`)
        .join(";")}]; ${node.values
        .map((column) => `${column.name}:${renderAst(column.value)}`)
        .join(";")})`;
    case "select":
      return `select ${node.columns ? node.columns.map((column) => column.name ? `${column.name}:${renderAst(column.value)}` : renderAst(column.value)).join(",") : ""}${node.by ? ` by ${node.by.map((column) => column.name ? `${column.name}:${renderAst(column.value)}` : renderAst(column.value)).join(",")}` : ""} from ${renderAst(node.source)}${node.where ? ` where ${renderAst(node.where)}` : ""}`;
    case "exec":
      return `exec ${renderAst(node.value)}${node.by ? ` by ${node.by.map((column) => column.name ? `${column.name}:${renderAst(column.value)}` : renderAst(column.value)).join(",")}` : ""} from ${renderAst(node.source)}${node.where ? ` where ${renderAst(node.where)}` : ""}`;
    case "update":
      return `update ${node.updates.map((update) => `${update.name}:${renderAst(update.value)}`).join(",")} from ${renderAst(node.source)}${node.where ? ` where ${renderAst(node.where)}` : ""}`;
    case "delete":
      return `delete ${node.columns ? node.columns.join(",") : ""} from ${renderAst(node.source)}${node.where ? ` where ${renderAst(node.where)}` : ""}`;
    case "if":
      return `if[${[renderAst(node.condition), ...node.body.map(renderAst)].join(";")}]`;
    case "while":
      return `while[${[renderAst(node.condition), ...node.body.map(renderAst)].join(";")}]`;
    case "do":
      return `do[${[renderAst(node.count), ...node.body.map(renderAst)].join(";")}]`;
    case "cond": {
      const items = node.branches.flatMap((branch) => [
        renderAst(branch.condition),
        renderAst(branch.value)
      ]);
      if (node.elseValue) {
        items.push(renderAst(node.elseValue));
      }
      return `$[${items.join(";")}]`;
    }
    case "each":
      return `${renderAst(node.callee)}each ${renderAst(node.arg)}`;
    case "eachCall":
      return `${renderAst(node.callee)}'[${node.args.map(renderAst).join(";")}]`;
    case "group":
      return `(${renderAst(node.value)})`;
    case "binary":
      return `${renderAst(node.left)}${node.op}${renderAst(node.right)}`;
    case "assign":
      return `${node.name}:${renderAst(node.value)}`;
    case "assignGlobal":
      return `${node.name}::${renderAst(node.value)}`;
    case "call":
      return `${renderAst(node.callee)}[${node.args.map(renderAst).join(";")}]`;
    case "lambda":
      return node.source;
    case "program":
      return node.statements.map(renderAst).join(";");
  }
  throw new QRuntimeError("nyi", `Cannot render AST node ${(node as AstNode).kind}`);
};

const parseNumericLiteral = (raw: string): QValue => {
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

const parseTemporalLiteral = (raw: string): QValue => {
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

const qTemporal = (temporalType: TemporalType, value: string): QValue =>
  ({
    kind: "temporal",
    temporalType,
    value
  } as QValue);

const lambdaArity = (lambda: LambdaValue): number => {
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

const collectImplicitParams = (node: AstNode, used: Set<string>) => {
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

const asList = (value: QValue): QList => {
  if (value.kind !== "list") {
    throw new QRuntimeError("type", "Expected list");
  }
  return value;
};

const toNumber = (value: QValue): number => {
  if (value.kind === "boolean") {
    return value.value ? 1 : 0;
  }
  if (value.kind !== "number") {
    throw new QRuntimeError("type", "Expected numeric value");
  }
  return value.value;
};

const numeric = (value: number, float = false): QNumber =>
  float || !Number.isInteger(value) ? qFloat(value) : qLong(value);

// Type-preserving arithmetic result: picks the "highest" type between two operands.
// short < int < long < real < float, bool gets promoted to long.
const NUMERIC_RANK: Record<string, number> = {
  short: 1,
  int: 2,
  long: 3,
  real: 4,
  float: 5
};

const numericTypeOf = (value: QValue): string => {
  if (value.kind === "boolean") return "long";
  if (value.kind === "number") return value.numericType;
  return "long";
};

const promoteNumericType = (a: string, b: string): string => {
  const ra = NUMERIC_RANK[a] ?? 3;
  const rb = NUMERIC_RANK[b] ?? 3;
  return ra >= rb ? a : b;
};

const numericOf = (value: number, type: string): QNumber => {
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

const nullForType = (type: string): QNumber => {
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

const isNumericNull = (value: QValue) => {
  if (value.kind !== "number") return false;
  if (value.special === "null") return true;
  if (value.special === "intNull") return true;
  if (value.special === "longNull") return true;
  if (value.special === "shortNull") return true;
  if (value.special === "realNull") return true;
  return false;
};

const unaryNumeric = (value: QValue, mapper: (input: number) => number): QValue =>
  value.kind === "list"
    ? qList(value.items.map((item) => unaryNumeric(item, mapper)), value.homogeneous ?? false)
    : qFloat(mapper(toNumber(value)));

const roundHalfAwayFromZero = (value: number) =>
  value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);

const qComplex = (re: number, im: number): QDictionary =>
  qDictionary([qSymbol("re"), qSymbol("im")], [qFloat(re), qFloat(im)]);

const complexDictionaryField = (value: QDictionary, field: "re" | "im") => {
  const index = value.keys.findIndex((key) => key.kind === "symbol" && key.value === field);
  return index >= 0 ? value.values[index] : undefined;
};

const complexParts = (value: QValue): { re: number; im: number } => {
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

const qComplexFromValue = (value: QValue) => {
  const parts = complexParts(value);
  return qComplex(parts.re, parts.im);
};

const complexArg = (value: { re: number; im: number }) => {
  if (value.re === 0 && value.im === 0) {
    return 0;
  }
  return Math.atan2(value.im, value.re);
};

const positiveModulo = (left: number, right: number) =>
  left - right * Math.floor(left / right);

const complexModulo = (left: QValue, right: QValue) => {
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

const dictionaryKeysMatch = (left: QDictionary, right: QDictionary) =>
  left.keys.length === right.keys.length &&
  left.keys.every((key, index) => equals(key, right.keys[index]!));

const applyDictionaryBinary = (
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

const arithBinary = (
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

const addTemporal = (a: QValue, b: QValue): QValue | null => {
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

const subtractTemporal = (a: QValue, b: QValue): QValue | null => {
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

const add = (a: QValue, b: QValue): QValue =>
  applyDictionaryBinary(a, b, add) ??
  addTemporal(a, b) ??
  arithBinary(a, b, (x, y) => x + y);
const subtract = (a: QValue, b: QValue): QValue =>
  applyDictionaryBinary(a, b, subtract) ??
  subtractTemporal(a, b) ??
  arithBinary(a, b, (x, y) => x - y);
const multiply = (a: QValue, b: QValue): QValue =>
  applyDictionaryBinary(a, b, multiply) ?? arithBinary(a, b, (x, y) => x * y);
const divide = (a: QValue, b: QValue): QValue =>
  applyDictionaryBinary(a, b, divide) ?? arithBinary(a, b, (x, y) => x / y, true);
const divValue = (a: QValue, b: QValue): QValue => {
  if (isNumericNull(a) || isNumericNull(b)) return qLong(0, "longNull");
  return qLong(Math.floor(toNumber(a) / toNumber(b)));
};
const modValue = (a: QValue, b: QValue): QValue => {
  if (isNumericNull(a) || isNumericNull(b)) return qLong(0, "longNull");
  const left = toNumber(a);
  const right = toNumber(b);
  return qLong(left - right * Math.floor(left / right));
};

const compare = (a: QValue, b: QValue): number => {
  if (a.kind === "number" && b.kind === "number") {
    return toNumber(a) - toNumber(b);
  }
  const left = formatBare(a);
  const right = formatBare(b);
  return left.localeCompare(right);
};

const compareValue = (a: QValue, b: QValue) => compare(a, b);

const equals = (a: QValue, b: QValue): boolean =>
  JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));

const numericUnary = (value: QValue, fn: (input: number) => number): QValue => {
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

const mapBinary = (left: QValue, right: QValue, mapper: (a: QValue, b: QValue) => QValue): QValue => {
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

const countValue = (value: QValue) => {
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

const absValue = (value: QValue): QValue => {
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

const allValue = (value: QValue): QValue =>
  qBool(value.kind === "list" ? value.items.every(isTruthy) : isTruthy(value));

const anyValue = (value: QValue): QValue =>
  qBool(value.kind === "list" ? value.items.some(isTruthy) : isTruthy(value));

const ceilingValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList(value.items.map(ceilingValue), value.homogeneous ?? false);
  }
  return qLong(Math.ceil(toNumber(value)));
};

const colsValue = (value: QValue): QValue => {
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

const firstValue = (value: QValue): QValue => {
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

const lastValue = (value: QValue): QValue => {
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

const ascValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList([...value.items].sort(compareValue), value.homogeneous ?? false, "s");
  }
  if (value.kind === "string") {
    return qString([...value.value].sort((a, b) => a.localeCompare(b)).join(""));
  }
  return value;
};

const descValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList([...value.items].sort((a, b) => compareValue(b, a)), value.homogeneous ?? false, "s");
  }
  if (value.kind === "string") {
    return qString([...value.value].sort((a, b) => b.localeCompare(a)).join(""));
  }
  return value;
};

const attrValue = (value: QValue): QValue =>
  value.kind === "list" && value.attribute ? qSymbol(value.attribute) : qSymbol("");

const sumValue = (value: QValue): QValue => {
  if (value.kind !== "list") {
    return value;
  }
  const items = value.items.filter((item) => !isNullish(item));
  return items.reduce((acc, item) => add(acc, item), qLong(0));
};

const sampleNumericType = (list: QList): string => {
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

const minValue = (value: QValue): QValue => {
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

const maxValue = (value: QValue): QValue => {
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

const medianValue = (value: QValue): QValue => {
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

const minPair = (left: QValue, right: QValue): QValue =>
  compare(left, right) <= 0 ? left : right;

const maxPair = (left: QValue, right: QValue): QValue =>
  compare(left, right) >= 0 ? left : right;

const avgValue = (value: QValue): QValue => {
  const list = asList(value);
  const items = list.items.filter((item) => !isNullish(item));
  if (items.length === 0) {
    return qFloat(Number.NaN, "null");
  }
  const total = sumValue(qList(items, list.homogeneous ?? false));
  return qFloat(toNumber(total) / items.length);
};

const avgsValue = (value: QValue): QValue => {
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

const productValue = (value: QValue): QValue => {
  if (value.kind !== "list") {
    return value;
  }
  return value.items.reduce((acc, item) => multiply(acc, item), qLong(1));
};

const prdsValue = (value: QValue): QValue => {
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

const prevValue = (value: QValue): QValue => {
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

const nextValue = (value: QValue): QValue => {
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

const sumsValue = (value: QValue): QValue => {
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

const minsValue = (value: QValue): QValue => {
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

const maxsValue = (value: QValue): QValue => {
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

const ratiosValue = (value: QValue): QValue => {
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

const varianceValue = (value: QValue, sample: boolean): QValue => {
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

const deviationValue = (value: QValue, sample: boolean): QValue => {
  const variance = varianceValue(value, sample);
  return variance.kind === "number" && variance.special === "null"
    ? variance
    : qFloat(Math.sqrt(toNumber(variance)));
};

const movingCountValue = (value: QValue): QValue => {
  const list = asList(value);
  return qLong(list.items.filter((item) => !isNullish(item)).length);
};

const movingValue = (
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

const deltasValue = (value: QValue, seed?: QValue): QValue => {
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

const reverseValue = (value: QValue): QValue => {
  if (value.kind === "string") {
    return qString([...value.value].reverse().join(""));
  }
  if (value.kind === "list") {
    return qList([...value.items].reverse(), value.homogeneous ?? false);
  }
  return value;
};

const differValue = (value: QValue): QValue => {
  const list = asList(value);
  return qList(
    list.items.map((item, index) =>
      qBool(index === 0 ? true : !equals(item, list.items[index - 1] ?? qNull()))
    ),
    true
  );
};

const fillsValue = (value: QValue): QValue => {
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

const reciprocalValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList(value.items.map(reciprocalValue), value.homogeneous ?? false);
  }
  return qFloat(1 / toNumber(value));
};

const signumValue = (value: QValue): QValue => {
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

const floorValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList(value.items.map((item) => floorValue(item)), value.homogeneous ?? false);
  }
  return qLong(Math.floor(toNumber(value)));
};

const cutValue = (left: QValue, right: QValue): QValue => {
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

const rotateValue = (left: QValue, right: QValue): QValue => {
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

const sublistValue = (left: QValue, right: QValue): QValue => {
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

const chunkValue = (size: number, right: QValue): QValue => {
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

const cutByIndices = (starts: number[], right: QValue): QValue => {
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

const addMonthsValue = (dateValue: QValue, monthsValue: QValue): QValue => {
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

const parseQOpt = (value: QValue): QValue => {
  if (value.kind === "list" && value.items.length === 0) {
    return qDictionary([], []);
  }
  if (value.kind === "dictionary") {
    return value;
  }
  throw new QRuntimeError("type", ".Q.opt expects argv-style input");
};

const defineDefaults = (defaults: QValue, parser: QValue, raw: QValue): QValue => {
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

const formatQNumber = (widthValue: QValue, decimalsValue: QValue, value: QValue): QValue => {
  const width = toNumber(widthValue);
  const decimals = toNumber(decimalsValue);
  const numericValue = toNumber(value);
  return qString(numericValue.toFixed(decimals).padStart(width, " "));
};

const atobValue = (value: QValue): QValue => {
  if (value.kind !== "string") {
    throw new QRuntimeError("type", ".Q.atob expects a string");
  }

  if (typeof atob === "function") {
    return qString(atob(value.value));
  }

  return qString(Buffer.from(value.value, "base64").toString("utf8"));
};

const btoaValue = (value: QValue): QValue => {
  const text = value.kind === "string" ? value.value : formatValue(value, { trailingNewline: false });

  if (typeof btoa === "function") {
    return qString(btoa(text));
  }

  return qString(Buffer.from(text, "utf8").toString("base64"));
};

const encodeFixedBase = (value: QValue, width: number, alphabet: string): QValue => {
  let remaining = BigInt(Math.max(0, Math.trunc(toNumber(value))));
  const base = BigInt(alphabet.length);
  const chars = Array.from({ length: width }, () => alphabet[0]!);

  for (let index = width - 1; index >= 0 && remaining > 0n; index -= 1) {
    chars[index] = alphabet[Number(remaining % base)]!;
    remaining /= base;
  }

  return qString(chars.join(""));
};

const decodeFixedBase = (value: QValue, alphabet: string): QValue => {
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

const sanitizeQIdentifier = (name: string) => {
  const stripped = name.replace(/[^A-Za-z0-9_]/g, "");
  return stripped === "" || /^[0-9_]/.test(stripped) ? `a${stripped}` : stripped;
};

const uniquifyQIdentifiers = (names: string[]) => {
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

const qsqlExpressionName = (node: AstNode | null): string | null => {
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

const QSQL_AGGREGATES = new Set([
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

const isQsqlAggregateExpression = (node: AstNode | null): boolean => {
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

const qsqlColumnNames = (columns: { name: string | null; value: AstNode }[]) =>
  uniquifyQIdentifiers(
    columns.map((column, index) => column.name ?? qsqlExpressionName(column.value) ?? (index === 0 ? "x" : `x${index}`))
  );

const renameTableColumns = (table: QTable, names: string[]) => {
  const entries = Object.entries(table.columns);
  return qTable(
    Object.fromEntries(
      entries.map(([_, column], index) => [names[index]!, column])
    )
  );
};

const qIdValue = (value: QValue): QValue => {
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

const xcolValue = (namesValue: QValue, tableValue: QValue): QValue => {
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

const asMatrix = (value: QValue): number[][] => {
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

const fromMatrix = (rows: number[][]): QValue =>
  qList(
    rows.map((row) => qList(row.map((value) => qFloat(value)), true)),
    false
  );

const mmuValue = (left: QValue, right: QValue): QValue => {
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

const invValue = (value: QValue): QValue => {
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

const wsumValue = (weights: QValue, values: QValue): QValue =>
  sumValue(mapBinary(weights, values, (a, b) => multiply(a, b)));

const wavgValue = (weights: QValue, values: QValue): QValue => {
  const numerator = sumValue(mapBinary(weights, values, (a, b) => multiply(a, b)));
  const denominator = sumValue(weights);
  return divide(numerator, denominator);
};

const binarySearchValue = (list: QValue, target: QValue, mode: "bin" | "binr"): QValue => {
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

const rankValue = (value: QValue): QValue => gradeValue(gradeValue(value, true), true);

const randValue = (arg: QValue): QValue => {
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

const hsymValue = (value: QValue): QValue => {
  if (value.kind === "symbol") {
    return qSymbol(value.value.startsWith(":") ? value.value : `:${value.value}`);
  }
  if (value.kind === "list") {
    return qList(value.items.map(hsymValue), value.homogeneous ?? false);
  }
  throw new QRuntimeError("type", "hsym expects a symbol");
};

const fileHandlePath = (value: QValue, caller: string): string => {
  if (value.kind !== "symbol") {
    throw new QRuntimeError("type", `${caller} expects a file-handle symbol`);
  }
  return value.value.startsWith(":") ? value.value.slice(1) : value.value;
};

const loadScriptFromFs = (session: Session, rawPath: string): QValue => {
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

const textLines = (contents: string): string[] => {
  const lines = contents.split(/\r?\n/);
  return lines.length > 0 && lines[lines.length - 1] === "" ? lines.slice(0, -1) : lines;
};

const byteListFromBytes = (bytes: Uint8Array): QList =>
  qList([...bytes].map((byte) => qLong(byte)), true, "byte");

const byteListFromText = (text: string): QList =>
  qList([...text].map((char) => qLong(char.codePointAt(0)!)), true, "byte");

const inferFormatFromExt = (path: string): StoredFileFormat => {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return "q";
  const ext = path.slice(dot + 1).toLowerCase();
  if (ext === "csv") return "csv";
  if (ext === "tsv") return "tsv";
  if (ext === "txt") return "txt";
  if (ext === "json") return "json";
  return "q";
};

const isDelimitedFormat = (format: StoredFileFormat): format is "csv" | "tsv" =>
  format === "csv" || format === "tsv";

const delimiterForDelimitedFormat = (format: "csv" | "tsv"): "," | "\t" =>
  format === "csv" ? "," : "\t";

const delimiterForFormat = (format: StoredFileFormat): "," | "\t" | null =>
  isDelimitedFormat(format) ? delimiterForDelimitedFormat(format) : null;

const variableNameFromFilePath = (path: string): string => {
  const slash = path.lastIndexOf("/");
  const file = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = file.lastIndexOf(".");
  return dot >= 0 ? file.slice(0, dot) : file;
};

const escapeCsvField = (text: string, delimiter: string): string => {
  if (text.includes(delimiter) || text.includes("\"") || text.includes("\n") || text.includes("\r")) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
};

const cellToCsvText = (value: QValue): string => {
  if (value.kind === "null") return "";
  if (value.kind === "string") return value.value;
  if (value.kind === "symbol") return value.value;
  if (value.kind === "boolean") return value.value ? "1" : "0";
  return formatValue(value, { trailingNewline: false });
};

const tableToCsv = (table: QTable, delimiter: string): string => {
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

const tableForDelimitedSave = (value: QValue, format: "csv" | "tsv"): QTable => {
  if (value.kind === "keyedTable") {
    return qTable({ ...value.keys.columns, ...value.values.columns });
  }
  if (value.kind === "table") {
    return value;
  }
  throw new QRuntimeError("type", `save ${format}: expected a table value`);
};

const parseCsvLine = (line: string, delimiter: string): string[] => {
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

const inferCellValue = (text: string): QValue => {
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

const csvToTable = (text: string, delimiter: string): QTable => {
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

const writeQValueToFs = (session: Session, path: string, value: QValue): void => {
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

const readQValueFromFs = (session: Session, path: string): QValue => {
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

const hydrateCanonical = (value: unknown): QValue => {
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

const xcolsValue = (namesValue: QValue, tableValue: QValue): QValue => {
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

const insertValue = (session: Session, target: QValue, payload: QValue): QValue => {
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

const upsertValue = (session: Session, target: QValue, payload: QValue): QValue => {
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

const inValue = (left: QValue, right: QValue): QValue => {
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

const gradeValue = (value: QValue, ascending: boolean): QValue => {
  const items = asSequenceItems(value).map((item, index) => ({ item, index }));
  items.sort((left, right) => {
    const compared = compare(left.item, right.item);
    return compared === 0 ? left.index - right.index : ascending ? compared : -compared;
  });
  return qList(items.map(({ index }) => qLong(index)), true);
};

const asSequenceItems = (value: QValue): QValue[] => {
  if (value.kind === "list") {
    return value.items;
  }
  if (value.kind === "string") {
    return [...value.value].map((char) => qString(char));
  }
  return [value];
};

const shuffleItems = <T>(items: T[]) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex]!, copy[index]!];
  }
  return copy;
};

const rebuildSequence = (prototype: QValue, items: QValue[]): QValue => {
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

const distinctItems = (items: QValue[]) =>
  items.filter((item, index) => items.findIndex((candidate) => equals(candidate, item)) === index);

const crossValue = (left: QValue, right: QValue): QValue =>
  qList(
    asSequenceItems(left).flatMap((leftItem) =>
      asSequenceItems(right).map((rightItem) => qList([leftItem, rightItem]))
    ),
    false
  );

const applyEachValue = (session: Session, left: QValue, right: QValue): QValue => {
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

const groupValue = (value: QValue): QValue => {
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

const callableArity = (value: QValue): number | null => {
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

const convergeValue = (session: Session, callable: QValue, value: QValue, scan: boolean): QValue => {
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

const reduceValueWithSeed = (session: Session, callable: QValue, seed: QValue, value: QValue): QValue => {
  let result = seed;
  for (const item of asSequenceItems(value)) {
    result = session.invoke(callable, [result, item]);
  }
  return result;
};

const scanValueWithSeed = (session: Session, callable: QValue, seed: QValue, value: QValue): QValue => {
  const outputs: QValue[] = [];
  let result = seed;
  for (const item of asSequenceItems(value)) {
    result = session.invoke(callable, [result, item]);
    outputs.push(result);
  }
  return qList(outputs, false);
};

const flattenRazeLeaves = (value: QValue): QValue[] => {
  if (value.kind !== "list") {
    return [value];
  }
  return value.items.flatMap((item) => flattenRazeLeaves(item));
};

const PRIMITIVE_ADVERB_TYPECHECK_NAMES = new Set([
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

const ensurePrimitiveAdverbInput = (callable: QValue, value: QValue) => {
  if (
    callable.kind === "builtin" &&
    PRIMITIVE_ADVERB_TYPECHECK_NAMES.has(callable.name) &&
    value.kind === "list" &&
    !(value.homogeneous ?? false)
  ) {
    throw new QRuntimeError("type", "Primitive adverb expects a simple list");
  }
};

const reduceValue = (session: Session, callable: QValue, value: QValue, seed?: QValue): QValue => {
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

const scanValue = (session: Session, callable: QValue, value: QValue, seed?: QValue): QValue => {
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

const reducePrimitiveAdverbValue = (session: Session, callable: QValue, value: QValue, seed?: QValue): QValue => {
  ensurePrimitiveAdverbInput(callable, value);
  return reduceValue(session, callable, value, seed);
};

const scanPrimitiveAdverbValue = (session: Session, callable: QValue, value: QValue, seed?: QValue): QValue => {
  ensurePrimitiveAdverbInput(callable, value);
  return scanValue(session, callable, value, seed);
};

const primitiveDerivedAdverbValue = (
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

const priorValue = (session: Session, callable: QValue, value: QValue): QValue => {
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

const patternToRegex = (pattern: string) =>
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

const likeValue = (left: QValue, right: QValue): QValue =>
  mapBinary(left, right, (value, pattern) => {
    if (value.kind !== "string" || pattern.kind !== "string") {
      throw new QRuntimeError("type", "like expects string arguments");
    }
    return qBool(patternToRegex(pattern.value).test(value.value));
  });

const ssValue = (left: QValue, right: QValue): QValue => {
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

const stringLikeValue = (value: QValue): string | null => {
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

const svValue = (left: QValue, right: QValue): QValue => {
  if (left.kind !== "string" || right.kind !== "list") {
    throw new QRuntimeError("type", "sv expects a string separator and a list of strings");
  }
  const parts = right.items.map(stringLikeValue);
  if (parts.some((part) => part === null)) {
    throw new QRuntimeError("type", "sv expects a list of strings");
  }
  return qString((parts as string[]).join(left.value));
};

const vsValue = (left: QValue, right: QValue): QValue => {
  if (left.kind !== "string" || right.kind !== "string") {
    throw new QRuntimeError("type", "vs expects string arguments");
  }
  if (left.value === "") {
    return qList([qString(right.value)], false);
  }
  return qList(right.value.split(left.value).map((part) => qString(part)), false);
};

const resolveWithinBound = (bound: QValue, index: number, length: number): QValue => {
  if (bound.kind !== "list") {
    return bound;
  }
  if (bound.items.length !== length) {
    throw new QRuntimeError("length", "within bounds must match the left argument");
  }
  return bound.items[index] ?? nullLike(bound.items[0]);
};

const withinValue = (left: QValue, right: QValue): QValue => {
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

const exceptValue = (left: QValue, right: QValue): QValue => {
  const rightItems = asSequenceItems(right);
  return rebuildSequence(
    left,
    asSequenceItems(left).filter(
      (item) => !rightItems.some((candidate) => equals(candidate, item))
    )
  );
};

const interValue = (left: QValue, right: QValue): QValue => {
  const rightItems = asSequenceItems(right);
  return rebuildSequence(
    left,
    distinctItems(asSequenceItems(left)).filter((item) =>
      rightItems.some((candidate) => equals(candidate, item))
    )
  );
};

const unionValue = (left: QValue, right: QValue): QValue =>
  rebuildSequence(left, distinctItems([...asSequenceItems(left), ...asSequenceItems(right)]));

const lowerValue = (value: QValue): QValue => {
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

const upperValue = (value: QValue): QValue => {
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

const trimStringValue = (value: QValue, mode: "left" | "right" | "both"): QValue => {
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

const nullValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList(value.items.map((item) => qBool(isNullish(item))), true);
  }
  return qBool(isNullish(value));
};

const flipListValue = (value: QList): QValue => {
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

const flipValue = (value: QValue): QValue => {
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

const negateValue = (value: QValue): QValue =>
  value.kind === "list"
    ? qList(value.items.map(negateValue), true)
    : value.kind === "number"
      ? numeric(-value.value, value.numericType === "float")
      : qLong(-toNumber(value));

const notValue = (value: QValue): QValue =>
  value.kind === "list"
    ? qList(value.items.map(notValue), true)
    : qBool(!isTruthy(value));

const distinctValue = (value: QValue): QValue => {
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

const namespaceKeys = (value: QValue) => {
  if (value.kind !== "namespace") {
    throw new QRuntimeError("type", "Expected a namespace");
  }
  return [...value.entries.keys()].map((name) => qSymbol(name));
};

const whereValue = (value: QValue): QValue => {
  const list = asList(value);
  const items = list.items.flatMap((item, index) =>
    isTruthy(item) ? [qLong(index)] : []
  );
  return qList(items, true);
};

const concatValues = (left: QValue, right: QValue): QValue => {
  if (left.kind === "table" && right.kind === "table") {
    return concatTables(left, right);
  }
  if (left.kind === "list" && right.kind === "list") {
    return qList([...left.items, ...right.items], left.homogeneous && right.homogeneous);
  }
  if (left.kind === "string" && right.kind === "string") {
    return qString(`${left.value}${right.value}`);
  }
  if (left.kind === "list") {
    return qList([...left.items, right], false);
  }
  if (right.kind === "list") {
    return qList([left, ...right.items], false);
  }
  return qList([left, right]);
};

const concatTables = (left: QTable, right: QTable): QTable => {
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

const razeValue = (value: QValue): QValue => {
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

const takeValue = (left: QValue, right: QValue): QValue => {
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

const reshapeValue = (shape: number[], value: QValue): QValue => {
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

const reshapeStrings = (shape: number[], flat: string[]): QValue => {
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

const reshapeItems = (shape: number[], flat: QValue[], homogeneous: boolean): QValue => {
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

const dropValue = (left: QValue, right: QValue): QValue => {
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

const fillValue = (left: QValue, right: QValue): QValue => {
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

const sampleSequence = (count: number, source: QValue): QValue => {
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

const findMappedValues = (left: QList, right: QValue): QValue | null => {
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

const findValue = (left: QValue, right: QValue): QValue => {
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

type CastHandler = (value: QValue) => QValue;

const castNameFromLeftOperand = (left: QValue) => {
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

const CAST_ALIAS_GROUPS: ReadonlyArray<{ aliases: readonly string[]; cast: CastHandler }> = [
  { aliases: ["", "symbol", "11h"], cast: (value) => castSymbolValue(value) },
  { aliases: ["boolean", "bool", "1h"], cast: (value) => castBooleanValue(value) },
  { aliases: ["short", "h", "5h"], cast: (value) => castShortValue(value) },
  { aliases: ["int", "i", "6h"], cast: (value) => castIntValue(value) },
  { aliases: ["long", "j", "7h"], cast: (value) => castLongValue(value) },
  { aliases: ["real", "e", "8h"], cast: (value) => castRealValue(value) },
  { aliases: ["float", "f", "9h"], cast: (value) => castFloatValue(value) },
  { aliases: ["10h", "char", "string"], cast: (value) => castCharValue(value) },
  { aliases: ["date", "14h"], cast: (value) => castDateValue(value) }
];

const CAST_HANDLER_BY_NAME = new Map<string, CastHandler>(
  CAST_ALIAS_GROUPS.flatMap(({ aliases, cast }) => aliases.map((alias) => [alias, cast] as const))
);

const castValue = (left: QValue, right: QValue): QValue => {
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

const tableColumnNames = (table: QTable) => Object.keys(table.columns);

const tableRowAsDict = (table: QTable, rowIndex: number): QDictionary => {
  const keys: QValue[] = [];
  const values: QValue[] = [];
  for (const [name, col] of Object.entries(table.columns)) {
    keys.push(qSymbol(name));
    values.push(col.items[rowIndex] ?? qNull());
  }
  return qDictionary(keys, values);
};

const asKeyedTable = (value: QValue): QKeyedTable => {
  if (value.kind === "keyedTable") return value;
  throw new QRuntimeError("type", "Expected keyed table");
};

const asTable = (value: QValue): QTable => {
  if (value.kind === "table") return value;
  if (value.kind === "keyedTable") {
    return qTable({ ...value.keys.columns, ...value.values.columns });
  }
  throw new QRuntimeError("type", "Expected table");
};

const asSymbolList = (value: QValue): string[] => {
  if (value.kind === "symbol") return [value.value];
  if (value.kind === "list" && value.items.every((i) => i.kind === "symbol")) {
    return value.items.map((i) => (i as QSymbol).value);
  }
  throw new QRuntimeError("type", "Expected symbol or symbol list");
};

const xascValue = (cols: QValue, tableValue: QValue, ascending: boolean): QValue => {
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

const xkeyValue = (cols: QValue, tableValue: QValue): QValue => {
  const table = asTable(tableValue);
  const keyNames = asSymbolList(cols);
  const allNames = tableColumnNames(table);
  const valNames = allNames.filter((n) => !keyNames.includes(n));
  const keys = qTable(Object.fromEntries(keyNames.map((k) => [k, table.columns[k]!])));
  const values = qTable(Object.fromEntries(valNames.map((k) => [k, table.columns[k]!])));
  return qKeyedTable(keys, values);
};

const xgroupValue = (cols: QValue, tableValue: QValue): QValue => {
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

const ssrValue = (text: QValue, pattern: QValue, replacement: QValue): QValue => {
  if (text.kind !== "string") throw new QRuntimeError("type", "ssr expects a string");
  const pat = stringLikeValue(pattern);
  const rep = stringLikeValue(replacement);
  if (pat === null || rep === null) throw new QRuntimeError("type", "ssr pattern/replacement must be strings");
  if (pat === "") return text;
  return qString(text.value.split(pat).join(rep));
};

const leftJoin = (left: QValue, right: QValue): QValue => {
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

const innerJoin = (left: QValue, right: QValue): QValue => {
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

const unionJoin = (left: QValue, right: QValue): QValue => {
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

const plusJoin = (left: QValue, right: QValue): QValue => {
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

const bangValue = (left: QValue, right: QValue): QValue => {
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

const asofJoinValue = (
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

const equiJoinValue = (cols: QValue, left: QValue, right: QValue): QValue => {
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

const windowJoinValue = (
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

const asofValue = (left: QValue, right: QValue): QValue => {
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

const xbarValue = (left: QValue, right: QValue): QValue =>
  mapBinary(left, right, (step, value) => {
    const interval = toNumber(step);
    if (interval === 0) {
      throw new QRuntimeError("domain", "xbar expects a non-zero interval");
    }
    return numeric(Math.floor(toNumber(value) / interval) * interval, !Number.isInteger(interval));
  });

const castSymbolValue = (value: QValue): QValue => {
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

const castSymbolAtom = (value: QValue): QValue => {
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

const castBooleanValue = (value: QValue): QValue => {
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

const castBooleanAtom = (value: QValue): QValue => {
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

const castShortValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList(
      value.items.map((item) => (item.kind === "list" ? castShortValue(item) : castShortAtom(item))),
      true
    );
  }
  return castShortAtom(value);
};

const castShortAtom = (value: QValue): QValue => {
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

const castCharValue = (value: QValue): QValue => {
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

const stringAtomValue = (value: QValue): QString => {
  if (value.kind === "symbol" || value.kind === "temporal") {
    return qString(value.value);
  }
  return qString(formatValue(value, { trailingNewline: false }));
};

const stringValue = (value: QValue): QValue => {
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

const castIntValue = (value: QValue): QValue => {
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

const castLongAtom = (value: QValue): QValue => {
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

const castLongValue = (value: QValue): QValue => {
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

const castRealAtom = (value: QValue): QValue => {
  if (value.kind === "number") {
    if (value.special === "null" || isNumericNull(value)) return qReal(0, "realNull");
    return qReal(value.value);
  }
  if (value.kind === "boolean") return qReal(value.value ? 1 : 0);
  if (value.kind === "null") return qReal(0, "realNull");
  throw new QRuntimeError("type", "real$ expects numeric values");
};

const castRealValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList(
      value.items.map((item) => (item.kind === "list" ? castRealValue(item) : castRealAtom(item))),
      true,
      "real"
    );
  }
  return castRealAtom(value);
};

const castIntAtom = (value: QValue): QValue => {
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

const castFloatValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList(
      value.items.map((item) => (item.kind === "list" ? castFloatValue(item) : castFloatAtom(item))),
      true
    );
  }
  return castFloatAtom(value);
};

const castFloatAtom = (value: QValue): QValue => {
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

const castDateValue = (value: QValue): QValue => {
  if (value.kind === "list") {
    return qList(value.items.map(castDateAtom), true);
  }
  return castDateAtom(value);
};

const castDateAtom = (value: QValue): QValue => {
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

const isDateLiteral = (value: string) => /^\d{4}\.\d{2}\.\d{2}$|^0Nd$/.test(value);

const Q_DATE_EPOCH_MS = Date.UTC(2000, 0, 1);

const parseQDateDays = (value: string) => {
  const [yearText, monthText, dayText] = value.split(".");
  const year = Number.parseInt(yearText ?? "", 10);
  const month = Number.parseInt(monthText ?? "", 10);
  const day = Number.parseInt(dayText ?? "", 10);
  const utcMs = Date.UTC(year, month - 1, day);
  return Math.round((utcMs - Q_DATE_EPOCH_MS) / 86400000);
};

const formatQDateFromDays = (days: number) => {
  const date = new Date(Q_DATE_EPOCH_MS + days * 86400000);
  return date.toISOString().slice(0, 10).replace(/-/g, ".");
};

const buildTable = (columns: { name: string; value: QValue }[]): QTable => {
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

const tableRowCount = (table: QTable) => Object.values(table.columns)[0]?.items.length ?? 0;

const selectColumnRows = (column: QList, positions: number[]) =>
  qList(
    positions.map((position) => column.items[position] ?? nullLike(column.items[0])),
    column.homogeneous ?? false
  );

const selectTableRows = (table: QTable, positions: number[]) =>
  qTable(
    Object.fromEntries(
      Object.entries(table.columns).map(([name, column]) => [
        name,
        selectColumnRows(column, positions)
      ])
    )
  );

const materializeTableColumn = (value: QValue, rowCount: number): QList => {
  if (value.kind === "list") {
    if (value.items.length !== rowCount) {
      throw new QRuntimeError("length", "Column length must match table rows");
    }
    return value;
  }
  return qList(Array.from({ length: rowCount }, () => value), true);
};

const requireUnaryIndex = (args: QValue[], message: string) => {
  if (args.length !== 1) {
    throw new QRuntimeError("rank", message);
  }
  return args[0]!;
};

const collectNumericPositions = (index: QValue, message: string) => {
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

const tableColumnByName = (table: QTable, name: string) => {
  const column = table.columns[name];
  if (!column) {
    throw new QRuntimeError("name", `Unknown column: ${name}`);
  }
  return column;
};

const applyListIndex = (list: QList, args: QValue[]) => {
  if (args.length === 1) {
    return indexList(list, args[0]!);
  }
  if (args.length === 2) {
    return indexNestedRows(list, args);
  }
  throw new QRuntimeError("rank", "List indexing expects one or two arguments");
};

const applyStringIndex = (text: QString, args: QValue[]) =>
  indexString(text, requireUnaryIndex(args, "String indexing expects one argument"));

const applyDictionaryIndex = (dictionary: QDictionary, args: QValue[]) =>
  indexDictionary(dictionary, requireUnaryIndex(args, "Dictionary indexing expects one argument"));

const applyValue = (value: QValue, args: QValue[]): QValue => {
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

const indexList = (list: QList, index: QValue): QValue => {
  if (index.kind === "number") {
    return list.items[index.value] ?? nullLike(list.items[0]);
  }
  if (index.kind === "list") {
    return qList(index.items.map((item) => indexList(list, item)), list.homogeneous ?? false);
  }
  throw new QRuntimeError("type", "List index must be numeric");
};

const indexString = (text: QString, index: QValue): QValue => {
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

const indexNestedRows = (list: QList, args: QValue[]): QValue => {
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

const indexDictionary = (dictionary: QDictionary, index: QValue): QValue => {
  const lookup = (key: QValue) => {
    const position = dictionary.keys.findIndex((candidate) => equals(candidate, key));
    return position >= 0 ? dictionary.values[position] : nullLike(dictionary.values[0]);
  };

  if (index.kind === "list") {
    return qList(index.items.map(lookup), dictionary.values.every((value) => value.kind === dictionary.values[0]?.kind));
  }

  return lookup(index);
};

const isSymbolList = (value: QValue) =>
  value.kind === "list" && value.items.every((item) => item.kind === "symbol");

const selectTableByUnaryIndex = (table: QTable, index: QValue): QValue => {
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

const projectTableSelection = (selection: QValue, columnSelector: QValue) => {
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

const indexTable = (table: QTable, args: QValue[]): QValue => {
  if (args.length === 2) {
    const [rowSelector, columnSelector] = args;
    const rows = rowSelector.kind === "null" ? table : selectTableByUnaryIndex(table, rowSelector);
    return projectTableSelection(rows, columnSelector);
  }

  const index = requireUnaryIndex(args, "Table indexing expects one or two arguments");
  return selectTableByUnaryIndex(table, index);
};

const rowFromTable = (table: QTable, position: number): QDictionary =>
  qDictionary(
    Object.keys(table.columns).map((name) => qSymbol(name)),
    Object.values(table.columns).map((column) => column.items[position] ?? nullLike(column.items[0]))
  );

const indexKeyedTable = (table: QKeyedTable, args: QValue[]): QValue => {
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

const nullLike = (sample?: QValue): QValue => {
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

const temporalNullForType = (t: TemporalType): string => {
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

const isNullish = (value: QValue) =>
  value.kind === "null" ||
  (value.kind === "symbol" && value.value === "") ||
  (value.kind === "number" &&
    (value.special === "null" ||
      value.special === "intNull" ||
      value.special === "longNull" ||
      value.special === "shortNull" ||
      value.special === "realNull")) ||
  (value.kind === "temporal" && value.value.includes("0N"));

const selectTableColumns = (table: QTable, selector: QValue): QValue => {
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

const formatBare = (value: QValue): string => {
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

const trimFloat = (value: number) => {
  const text = value.toString();
  return text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text;
};

const formatFloat = (value: number) => {
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
const formatListNumber = (value: QValue) => {
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

const formatTable = (table: QTable) => {
  const layout = layoutTable(table);
  return [layout.header, layout.divider, ...layout.rows].join("\n");
};

const layoutTable = (table: QTable) => {
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

const formatKeyedTable = (table: QKeyedTable) => {
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

const formatTableCell = (value: QValue) => {
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

const formatDictionary = (dictionary: QDictionary) => {
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
