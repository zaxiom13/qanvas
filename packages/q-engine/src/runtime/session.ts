import { canonicalize, isTruthy, qBool, qDate, qDictionary, qFloat, qInt, qKeyedTable, qList, qLong, qNull, qProjection, qReal, qShort, qString, qSymbol, qTable, type QBuiltin, type QList, type QNamespace, type QProjection, type QSymbol, type QTable, type QValue } from "@qpad/core";
import { createMemoryFileSystem, type HostFileSystem } from "../host-file-system.js";
import { isSilentExpression, parse } from "./parser.js";
import { SHARED_BUILTINS } from "./builtins.js";
import { CX_USAGE, Q_LONG_MAX, Q_RESERVED_WORDS, Q_X10_ALPHABET, Q_X12_ALPHABET, type AstNode, type BuiltinEntry, type EvalResult, type HostAdapter, type LambdaValue, QRuntimeError, type TableQueryScope } from "./types.js";
import * as V from "./values.js";
const { formatValue, parseNumericLiteral, parseTemporalLiteral, qTemporal, lambdaArity, collectImplicitParams, asList, toNumber, numeric, NUMERIC_RANK, numericTypeOf, promoteNumericType, numericOf, nullForType, isNumericNull, unaryNumeric, roundHalfAwayFromZero, qComplex, complexDictionaryField, complexParts, qComplexFromValue, complexArg, positiveModulo, complexModulo, dictionaryKeysMatch, applyDictionaryBinary, arithBinary, addTemporal, subtractTemporal, add, subtract, multiply, divide, divValue, modValue, compare, compareValue, equals, numericUnary, mapBinary, countValue, absValue, allValue, anyValue, ceilingValue, colsValue, firstValue, lastValue, ascValue, descValue, attrValue, sumValue, sampleNumericType, minValue, maxValue, medianValue, minPair, maxPair, avgValue, avgsValue, productValue, prdsValue, prevValue, nextValue, sumsValue, minsValue, maxsValue, ratiosValue, varianceValue, deviationValue, movingCountValue, movingValue, deltasValue, reverseValue, differValue, fillsValue, reciprocalValue, signumValue, floorValue, cutValue, rotateValue, sublistValue, chunkValue, cutByIndices, addMonthsValue, parseQOpt, defineDefaults, formatQNumber, atobValue, btoaValue, encodeFixedBase, decodeFixedBase, sanitizeQIdentifier, uniquifyQIdentifiers, qsqlExpressionName, QSQL_AGGREGATES, isQsqlAggregateExpression, qsqlColumnNames, renameTableColumns, qIdValue, xcolValue, asMatrix, fromMatrix, mmuValue, invValue, wsumValue, wavgValue, binarySearchValue, rankValue, randValue, hsymValue, fileHandlePath, loadScriptFromFs, textLines, byteListFromBytes, byteListFromText, inferFormatFromExt, isDelimitedFormat, delimiterForDelimitedFormat, delimiterForFormat, variableNameFromFilePath, escapeCsvField, cellToCsvText, tableToCsv, tableForDelimitedSave, parseCsvLine, inferCellValue, csvToTable, writeQValueToFs, readQValueFromFs, hydrateCanonical, xcolsValue, insertValue, upsertValue, inValue, gradeValue, asSequenceItems, shuffleItems, rebuildSequence, distinctItems, crossValue, applyEachValue, groupValue, callableArity, convergeValue, reduceValueWithSeed, scanValueWithSeed, flattenRazeLeaves, PRIMITIVE_ADVERB_TYPECHECK_NAMES, ensurePrimitiveAdverbInput, reduceValue, scanValue, reducePrimitiveAdverbValue, scanPrimitiveAdverbValue, primitiveDerivedAdverbValue, priorValue, patternToRegex, likeValue, ssValue, stringLikeValue, svValue, vsValue, resolveWithinBound, withinValue, exceptValue, interValue, unionValue, lowerValue, upperValue, trimStringValue, nullValue, flipListValue, flipValue, negateValue, notValue, distinctValue, namespaceKeys, whereValue, concatValues, concatTables, razeValue, takeValue, reshapeValue, reshapeStrings, reshapeItems, dropValue, fillValue, sampleSequence, findMappedValues, findValue, castNameFromLeftOperand, CAST_ALIAS_GROUPS, CAST_HANDLER_BY_NAME, castValue, tableColumnNames, tableRowAsDict, asKeyedTable, asTable, asSymbolList, xascValue, xkeyValue, xgroupValue, ssrValue, leftJoin, innerJoin, unionJoin, plusJoin, bangValue, asofJoinValue, equiJoinValue, windowJoinValue, asofValue, xbarValue, castSymbolValue, castSymbolAtom, castBooleanValue, castBooleanAtom, castByteValue, castByteAtom, castShortValue, castShortAtom, castCharValue, stringAtomValue, stringValue, castIntValue, castLongAtom, castLongValue, castRealAtom, castRealValue, castIntAtom, castFloatValue, castFloatAtom, castDateValue, castDateAtom, isDateLiteral, Q_DATE_EPOCH_MS, parseQDateDays, formatQDateFromDays, buildTable, tableRowCount, selectColumnRows, selectTableRows, materializeTableColumn, requireUnaryIndex, collectNumericPositions, tableColumnByName, applyListIndex, applyStringIndex, applyDictionaryIndex, applyValue, indexList, indexString, indexNestedRows, indexDictionary, isSymbolList, selectTableByUnaryIndex, projectTableSelection, indexTable, rowFromTable, indexKeyedTable, nullLike, temporalNullForType, isNullish, selectTableColumns, formatBare, trimFloat, formatFloat, formatListNumber, formatTable, layoutTable, formatKeyedTable, formatTableCell, formatDictionary } = V;

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

    const dottedPathStartsWithDot = name.startsWith(".");
    const parts = name.replace(/^\./, "").split(".");
    const last = parts.pop()!;
    if (parts.length === 0) {
      this.env.set(name.startsWith(".") ? `.${last}` : last, value);
      return value;
    }

    let current = this.getRootValue(parts[0]!, dottedPathStartsWithDot);

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

  /** Leading-dot paths treat the first segment as a dotted root (e.g. `.cx.new` → `.cx`). */
  private getRootValue(firstSegment: string, dottedPathStartsWithDot: boolean): QValue | undefined {
    if (dottedPathStartsWithDot) {
      return this.lookup(`.${firstSegment}`) ?? this.lookup(firstSegment);
    }
    return this.lookup(firstSegment);
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
    const dottedPathStartsWithDot = name.startsWith(".");
    const parts = name.replace(/^\./, "").split(".");
    let current: QValue | undefined = this.getRootValue(parts[0]!, dottedPathStartsWithDot);
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

