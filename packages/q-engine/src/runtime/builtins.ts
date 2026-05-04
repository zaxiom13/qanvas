import { qBool, qDate, qDictionary, qFloat, qInt, qKeyedTable, qList, qLong, qNull, qParseTree, qReal, qShort, qString, qSymbol, qTable, qTypeNumber, type QSymbol, type QTable, type QValue } from "@qpad/core";
import { Q_LONG_MAX, Q_RESERVED_WORDS, Q_X10_ALPHABET, Q_X12_ALPHABET, type BuiltinEntry, type BuiltinImpl, QRuntimeError } from "./types.js";
import type { Session } from "./session.js";
import { primitiveNamesBy } from "./primitive-manifest.js";
import { COMPLEX_HANDLERS, SIMPLE_DYAD_HANDLERS, SIMPLE_MONAD_HANDLERS } from "./primitive-handlers.js";
import { parseTreeDisplay } from "./parser.js";
import * as V from "./values.js";
const { ungroupValue } = V;
const { xprevValue } = V;
const { xrankValue } = V;
const { formatValue, parseNumericLiteral, parseTemporalLiteral, qTemporal, lambdaArity, collectImplicitParams, asList, toNumber, numeric, NUMERIC_RANK, numericTypeOf, promoteNumericType, numericOf, nullForType, isNumericNull, unaryNumeric, roundHalfAwayFromZero, qComplex, complexDictionaryField, complexParts, qComplexFromValue, complexArg, positiveModulo, complexModulo, dictionaryKeysMatch, applyDictionaryBinary, arithBinary, addTemporal, subtractTemporal, add, subtract, multiply, divide, divValue, modValue, compare, compareValue, equals, numericUnary, mapBinary, countValue, absValue, allValue, anyValue, ceilingValue, colsValue, firstValue, lastValue, ascValue, descValue, attrValue, sumValue, sampleNumericType, minValue, maxValue, medianValue, minPair, maxPair, avgValue, avgsValue, productValue, prdsValue, prevValue, nextValue, sumsValue, minsValue, maxsValue, ratiosValue, varianceValue, deviationValue, covarianceValue, correlationValue, emaValue, movingCountValue, movingValue, deltasValue, reverseValue, differValue, fillsValue, reciprocalValue, signumValue, floorValue, cutValue, rotateValue, sublistValue, chunkValue, cutByIndices, addMonthsValue, parseQOpt, defineDefaults, formatQNumber, atobValue, btoaValue, encodeFixedBase, decodeFixedBase, sanitizeQIdentifier, uniquifyQIdentifiers, qsqlExpressionName, QSQL_AGGREGATES, isQsqlAggregateExpression, qsqlColumnNames, renameTableColumns, qIdValue, xcolValue, asMatrix, fromMatrix, mmuValue, invValue, wsumValue, wavgValue, binarySearchValue, rankValue, randValue, hsymValue, fileHandlePath, loadScriptFromFs, textLines, byteListFromBytes, byteListFromText, inferFormatFromExt, isDelimitedFormat, delimiterForDelimitedFormat, delimiterForFormat, variableNameFromFilePath, escapeCsvField, cellToCsvText, tableToCsv, tableForDelimitedSave, parseCsvLine, inferCellValue, csvToTable, writeQValueToFs, readQValueFromFs, hydrateCanonical, xcolsValue, insertValue, upsertValue, inValue, gradeValue, asSequenceItems, shuffleItems, rebuildSequence, distinctItems, crossValue, applyEachValue, groupValue, callableArity, convergeValue, reduceValueWithSeed, scanValueWithSeed, flattenRazeLeaves, PRIMITIVE_ADVERB_TYPECHECK_NAMES, ensurePrimitiveAdverbInput, reduceValue, scanValue, reducePrimitiveAdverbValue, scanPrimitiveAdverbValue, primitiveDerivedAdverbValue, priorValue, patternToRegex, likeValue, ssValue, stringLikeValue, svValue, vsValue, resolveWithinBound, withinValue, exceptValue, interValue, unionValue, lowerValue, upperValue, trimStringValue, nullValue, flipListValue, flipValue, negateValue, notValue, distinctValue, namespaceKeys, whereValue, concatValues, concatTables, razeValue, takeValue, reshapeValue, reshapeStrings, reshapeItems, dropValue, fillValue, sampleSequence, findMappedValues, findValue, castNameFromLeftOperand, CAST_ALIAS_GROUPS, CAST_HANDLER_BY_NAME, castValue, tableColumnNames, tableRowAsDict, asKeyedTable, asTable, asSymbolList, xascValue, xkeyValue, xgroupValue, ssrValue, leftJoin, innerJoin, unionJoin, plusJoin, bangValue, asofJoinValue, equiJoinValue, windowJoinValue, asofValue, xbarValue, castSymbolValue, castSymbolAtom, castBooleanValue, castBooleanAtom, castByteValue, castByteAtom, castShortValue, castShortAtom, castCharValue, stringAtomValue, stringValue, castIntValue, castLongAtom, castLongValue, castRealAtom, castRealValue, castIntAtom, castFloatValue, castFloatAtom, castDateValue, castDateAtom, isDateLiteral, Q_DATE_EPOCH_MS, parseQDateDays, formatQDateFromDays, buildTable, tableRowCount, selectColumnRows, selectTableRows, materializeTableColumn, requireUnaryIndex, collectNumericPositions, tableColumnByName, applyListIndex, applyStringIndex, applyDictionaryIndex, applyValue, indexList, indexString, indexNestedRows, indexDictionary, isSymbolList, selectTableByUnaryIndex, projectTableSelection, indexTable, rowFromTable, indexKeyedTable, nullLike, temporalNullForType, isNullish, selectTableColumns, formatBare, trimFloat, formatFloat, formatListNumber, formatTable, layoutTable, formatKeyedTable, formatTableCell, formatDictionary } = V;

export const createBuiltins = (): ReadonlyMap<string, BuiltinEntry> => {
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

  SIMPLE_MONAD_HANDLERS.forEach(([name, impl]) => register(name, 1, impl));
  register("key", 1, (session, [arg]) => session.keyValue(arg));
  register("keys", 1, (session, [arg]) => {
    const value = arg.kind === "symbol" && !arg.value.startsWith(":") ? session.get(arg.value) : arg;
    if (value.kind === "dictionary") return qList(value.keys, value.keys.every((key) => key.kind === "symbol"));
    if (value.kind === "table") return qList([], true, "symbol");
    if (value.kind === "keyedTable") {
      return qList(Object.keys(value.keys.columns).map((name) => qSymbol(name)), true);
    }
    return qList([], true, "symbol");
  });
  register("meta", 1, (session, [arg]) => {
    const value = arg.kind === "symbol" && !arg.value.startsWith(":") ? session.get(arg.value) : arg;
    const table =
      value.kind === "keyedTable"
        ? { kind: "table" as const, columns: { ...value.keys.columns, ...value.values.columns } }
        : value.kind === "table"
          ? value
          : null;
    if (!table) {
      throw new QRuntimeError("type", "meta expects a table or keyed table");
    }
    const atomType = (value: QValue): string => {
      if (value.kind === "boolean") return "b";
      if (value.kind === "number") {
        switch (value.numericType) {
          case "short": return "h";
          case "int": return "i";
          case "long": return "j";
          case "real": return "e";
          case "float": return "f";
        }
      }
      if (value.kind === "temporal" && value.temporalType === "date") return "d";
      if (value.kind === "symbol") return "s";
      if (value.kind === "string") return "c";
      return " ";
    };
    const typeLetter = (column: QValue) => {
      if (column.kind !== "list" || column.items.length === 0) return " ";
      const first = column.items[0]!;
      if (first.kind === "list" && first.items.length > 0) {
        const nested = atomType(first.items[0]!);
        return nested === " " ? " " : nested.toUpperCase();
      }
      return column.items.every((item) =>
        item.kind === first.kind && (item.kind !== "number" || first.kind !== "number" || item.numericType === first.numericType)
      )
        ? atomType(first)
        : " ";
    };
    const names = Object.keys(table.columns);
    return qKeyedTable(
      buildTable([{ name: "c", value: qList(names.map((name) => qSymbol(name)), true) }]),
      buildTable([
        { name: "t", value: qList(names.map((name) => qString(typeLetter(table.columns[name]!))), true) },
        { name: "f", value: qList(names.map((name) => qSymbol(table.columns[name]!.foreignKey ?? "")), true) },
        { name: "a", value: qList(names.map((name) => qString(table.columns[name]!.attribute ?? " ")), true) }
      ])
    );
  });
  register("fkeys", 1, (session, [arg]) => {
    const value = arg.kind === "symbol" && !arg.value.startsWith(":") ? session.get(arg.value) : arg;
    if (value.kind !== "table" && value.kind !== "keyedTable") {
      throw new QRuntimeError("type", "fkeys expects a table or table name");
    }
    const table =
      value.kind === "keyedTable"
        ? { kind: "table" as const, columns: { ...value.keys.columns, ...value.values.columns } }
        : value;
    const names = Object.keys(table.columns).filter((name) => table.columns[name]!.foreignKey);
    return qDictionary(
      names.map((name) => qSymbol(name)),
      names.map((name) => qSymbol(table.columns[name]!.foreignKey!))
    );
  });
  register("ungroup", 1, (_, [arg]) => ungroupValue(arg));
  register("raze", 1, (_, args) =>
    args.length === 1 ? razeValue(args[0]!) : args.slice(1).reduce((acc, item) => razeValue(qList([acc, item])), args[0]!)
  );
  register("-':", 1, (_, [arg, maybeValues]) =>
    maybeValues === undefined ? deltasValue(arg) : deltasValue(maybeValues, arg)
  );
  registerAlias("deltas", "-':");
  register("string", 1, (_, [arg]) => stringValue(arg));
  register("sums", 1, (_, [arg]) => sumsValue(arg));
  register("trim", 1, (_, [arg]) => trimStringValue(arg, "both"));
  register("type", 1, (_, [arg]) => qShort(qTypeNumber(arg)));
  register("where", 1, (_, [arg]) => whereValue(arg));
  register("value", 1, (session, [arg]) => {
    if (arg.kind === "string") {
      return session.evaluate(arg.value).value;
    }
    if (arg.kind === "symbol") {
      return session.get(arg.value);
    }
    if (arg.kind === "list" && arg.foreignKey) {
      return qList(arg.items, arg.homogeneous ?? false, arg.attribute);
    }
    if (arg.kind === "list" && arg.items.length > 0) {
      const [head, ...args] = arg.items;
      let callable: QValue = head!.kind === "string" ? session.evaluate(head!.value).value : head!;
      if (head!.kind === "symbol") {
        const resolved = session.get(head!.value);
        if (resolved.kind === "lambda" || resolved.kind === "projection") {
          callable = resolved;
        }
      }
      if (callable.kind === "builtin" || callable.kind === "lambda" || callable.kind === "projection") {
        return session.invoke(callable, args);
      }
    }
    if (arg.kind === "dictionary") {
      return qList(arg.values, arg.values.every((value) => value.kind === arg.values[0]?.kind));
    }
    if (arg.kind === "keyedTable") {
      return arg.values;
    }
    return arg;
  });
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
  register(":", 2, (_, [_old, value]) => value);
  const tableWithAmendedRows = (table: QTable, rows: Map<number, QValue>) =>
    qTable(
      Object.fromEntries(
        Object.entries(table.columns).map(([name, column]) => [
          name,
          qList(
            column.items.map((cell, rowIndex) => {
              const row = rows.get(rowIndex);
              if (!row) return cell;
              if (row.kind !== "dictionary") {
                throw new QRuntimeError("type", "table amend rows must be dictionaries");
              }
              const columnPosition = row.keys.findIndex((key) => key.kind === "symbol" && key.value === name);
              return columnPosition >= 0 ? row.values[columnPosition] ?? nullLike(column.items[0]) : cell;
            }),
            column.homogeneous ?? false,
            column.attribute,
            column.foreignKey
          )
        ])
      )
    );
  const amendAt = (session: Session, target: QValue, index: QValue, handler: QValue, replacement: QValue | undefined): QValue => {
    if (index.kind === "null") {
      if (target.kind === "list" || target.kind === "string") {
        return amendAt(
          session,
          target,
          qList(asSequenceItems(target).map((_, itemIndex) => qLong(itemIndex)), true),
          handler,
          replacement
        );
      }
      return replacement === undefined
        ? session.invoke(handler, [target])
        : session.invoke(handler, [target, replacement]);
    }
    if (target.kind === "dictionary") {
      const indexItems = index.kind === "list" ? index.items : [index];
      const replacementItems =
        replacement && replacement.kind === "list" && indexItems.length === replacement.items.length
          ? replacement.items
          : null;
      const values = [...target.values];
      indexItems.forEach((key, itemIndex) => {
        const position = target.keys.findIndex((candidate) => equals(candidate, key));
        if (position < 0) return;
        const oldValue = values[position] ?? qNull();
        values[position] =
          replacement === undefined
            ? session.invoke(handler, [oldValue])
            : session.invoke(handler, [oldValue, replacementItems?.[itemIndex] ?? replacement]);
      });
      return qDictionary(target.keys, values);
    }
    if (target.kind === "table") {
      const indexItems = index.kind === "list" ? index.items : [index];
      const replacementItems =
        replacement && replacement.kind === "list" && indexItems.length === replacement.items.length
          ? replacement.items
          : null;
      const rows = new Map<number, QValue>();
      indexItems.forEach((indexValue, itemIndex) => {
        if (indexValue.kind !== "number") {
          throw new QRuntimeError("type", "table amend row indices must be numeric");
        }
        const position = Math.trunc(indexValue.value);
        const oldValue = rowFromTable(target, position);
        rows.set(
          position,
          replacement === undefined
            ? session.invoke(handler, [oldValue])
            : session.invoke(handler, [oldValue, replacementItems?.[itemIndex] ?? replacement])
        );
      });
      return tableWithAmendedRows(target, rows);
    }
    const indexItems = index.kind === "list" ? index.items : [index];
    const replacementItems =
      replacement && replacement.kind === "list" && indexItems.length === replacement.items.length
        ? replacement.items
        : replacement && target.kind === "string" && replacement.kind === "string" && replacement.value.length === indexItems.length
          ? [...replacement.value].map((char) => qString(char))
          : null;
    const source = asSequenceItems(target);
    const result = [...source];

    indexItems.forEach((indexValue, itemIndex) => {
      if (indexValue.kind !== "number") {
        throw new QRuntimeError("type", "amend indices must be numeric");
      }
      const position = Math.trunc(indexValue.value);
      const oldValue = result[position] ?? nullLike(source[0]);
      const nextValue =
        replacement === undefined
          ? session.invoke(handler, [oldValue])
          : session.invoke(handler, [oldValue, replacementItems?.[itemIndex] ?? replacement]);
      result[position] = nextValue;
    });

    return rebuildSequence(target, result);
  };
  const isApplicable = (value: QValue) => value.kind === "builtin" || value.kind === "lambda" || value.kind === "projection";
  const normalizeIndexSelector = (value: QValue) => value.kind === "builtin" && value.name === "::" ? qNull() : value;
  const applyDot = (session: Session, target: QValue, path: QValue) => {
    if (isApplicable(target)) {
      const args =
        path.kind === "list"
          ? path.items
          : path.kind === "string"
            ? [...path.value].map((char) => qString(char))
            : [path];
      const arity = callableArity(target);
      if (arity !== null && args.length > arity) {
        throw new QRuntimeError("rank", "rank");
      }
      return session.invoke(target, args);
    }
    if (path.kind === "null") {
      return target;
    }
    if (path.kind === "list") {
      const selectors = path.items.map(normalizeIndexSelector);
      if ((target.kind === "list" || target.kind === "table") && path.items.length === 2) {
        return applyValue(target, selectors);
      }
      return selectors.reduce<QValue>((value, index) => index.kind === "null" ? value : applyValue(value, [index]), target);
    }
    return applyValue(target, [normalizeIndexSelector(path)]);
  };
  const trapError = (session: Session, handler: QValue, error: QRuntimeError) =>
    isApplicable(handler) ? session.invoke(handler, [qString(error.qName)]) : handler;
  register(".", 2, (session, [target, path, handler, replacement]) => {
    if (handler === undefined) {
      return applyDot(session, target, path);
    }
    if (replacement === undefined && isApplicable(target)) {
      try {
        return applyDot(session, target, path);
      } catch (error) {
        if (!(error instanceof QRuntimeError)) {
          throw error;
        }
        return trapError(session, handler, error);
      }
    }
    if (target.kind === "symbol" && !target.value.startsWith(":")) {
      const amended = session.invoke(session.get("."), [session.get(target.value), path, handler, replacement]);
      session.assignGlobal(target.value, amended);
      return target;
    }
    if (path.kind !== "list") {
      return amendAt(session, target, path, handler, replacement);
    }
    const pathItems = path.items;
    if (pathItems.length === 0) {
      return replacement === undefined
        ? session.invoke(handler, [target])
        : session.invoke(handler, [target, replacement]);
    }
    if (pathItems.length === 1) {
      return amendAt(session, target, pathItems[0]!, handler, replacement);
    }
    if (pathItems.length === 2) {
      const [rowIndex, columnIndex] = pathItems;
      if (!rowIndex || !columnIndex) {
        throw new QRuntimeError("rank", ". amend path is empty");
      }
      if (target.kind === "table") {
        const rowPositions = rowIndex.kind === "list" ? rowIndex.items : [rowIndex];
        const rows = new Map<number, QValue>();
        rowPositions.forEach((rowPositionValue) => {
          if (rowPositionValue.kind !== "number") {
            throw new QRuntimeError("type", ". amend row indices must be numeric");
          }
          const rowPosition = Math.trunc(rowPositionValue.value);
          rows.set(rowPosition, amendAt(session, rowFromTable(target, rowPosition), columnIndex, handler, replacement));
        });
        return tableWithAmendedRows(target, rows);
      }
      const rowPositions = rowIndex.kind === "list" ? rowIndex.items : [rowIndex];
      const source = asSequenceItems(target);
      const result = [...source];
      rowPositions.forEach((rowPositionValue) => {
        if (rowPositionValue.kind !== "number") {
          throw new QRuntimeError("type", ". amend row indices must be numeric");
        }
        const rowPosition = Math.trunc(rowPositionValue.value);
        const row = result[rowPosition] ?? nullLike(source[0]);
        result[rowPosition] = amendAt(session, row, columnIndex, handler, replacement);
      });
      return rebuildSequence(target, result);
    }
    throw new QRuntimeError("rank", ". amend supports one or two path levels");
  });
  register("@", 2, (session, args) => {
    const [target, arg, handler, replacement] = args;
    if (target.kind === "symbol" && !target.value.startsWith(":") && handler !== undefined) {
      const amended = amendAt(session, session.get(target.value), arg, handler, replacement);
      session.assignGlobal(target.value, amended);
      return target;
    }
    const amendable = target.kind === "list" || target.kind === "string" || target.kind === "dictionary" || target.kind === "table";
    if (amendable && handler !== undefined) {
      return amendAt(session, target, arg, handler, replacement);
    }

    const invokeArgs = arg.kind === "list" && !(arg.homogeneous ?? false) ? arg.items : [arg];
    try {
      if (target.kind === "builtin" || target.kind === "lambda" || target.kind === "projection") {
        return session.invoke(target, invokeArgs);
      }
      return applyValue(target, invokeArgs);
    } catch (error) {
      if (handler === undefined) {
        throw error;
      }
      if (!(error instanceof QRuntimeError)) {
        throw error;
      }
      return trapError(session, handler, error);
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
  COMPLEX_HANDLERS.forEach(([name, arity, impl]) => register(name, arity, impl));
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
  register("xprev", 2, (_, [left, right]) => xprevValue(left, right));
  register("xrank", 2, (_, [left, right]) => xrankValue(left, right));
  register("xcol", 2, (_, [left, right]) => xcolValue(left, right));
  register("xexp", 2, (_, [left, right]) =>
    mapBinary(left, right, (a, b) => qFloat(Math.pow(toNumber(a), toNumber(b))))
  );
  register("like", 2, (_, [left, right]) => likeValue(left, right));
  register("within", 2, (_, [left, right]) => withinValue(left, right));
  register("except", 2, (_, [left, right]) => exceptValue(left, right));
  register("fby", 2, (session, [left, right]) => V.fbyValue(session, left, right));
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
  primitiveNamesBy("primitiveAdverbs").forEach(registerPrimitiveDerivedAdverb);

  SIMPLE_DYAD_HANDLERS.forEach(([name, impl]) => register(name, 2, impl));
  register("/", 2, (session, [callable, first, second]) => {
    if (second === undefined) return reducePrimitiveAdverbValue(session, callable, first);
    return callableArity(callable) === 1
      ? reducePrimitiveAdverbValue(session, callable, first, second)
      : reducePrimitiveAdverbValue(session, callable, second, first);
  });
  register("\\", 2, (session, [callable, first, second]) => {
    if (second === undefined) return scanPrimitiveAdverbValue(session, callable, first);
    return callableArity(callable) === 1
      ? scanPrimitiveAdverbValue(session, callable, first, second)
      : scanPrimitiveAdverbValue(session, callable, second, first);
  });

  register("xasc", 2, (_, [left, right]) => xascValue(left, right, true));
  register("xdesc", 2, (_, [left, right]) => xascValue(left, right, false));
  register("xkey", 2, (_, [left, right]) => xkeyValue(left, right));
  register("xgroup", 2, (_, [left, right]) => xgroupValue(left, right));
  register("lsq", 2, (_, [left, right]) => V.lsqValue(left, right));
  register("ssr", 3, (_, [text, pattern, replacement]) => ssrValue(text, pattern, replacement));

  register("lj", 2, (_, [left, right]) => leftJoin(left, right));
  register("ljf", 2, (_, [left, right]) => leftJoin(left, right, { fill: true }));
  register("ij", 2, (_, [left, right]) => innerJoin(left, right));
  register("ijf", 2, (_, [left, right]) => innerJoin(left, right, { fill: true }));
  register("uj", 2, (_, [left, right]) => unionJoin(left, right));
  register("ujf", 2, (_, [left, right]) => unionJoin(left, right, { fill: true }));
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
    if (arg.kind === "string") {
      return session.evaluate(arg.value).value;
    }
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
      return target;
    }
    if (target.kind === "list" && target.items.every((item) => item.kind === "symbol")) {
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
  register("rsave", 1, (session, [arg]) => {
    if (arg.kind !== "symbol" || arg.value.startsWith(":")) {
      throw new QRuntimeError("type", "rsave expects a table name symbol");
    }
    const value = session.get(arg.value);
    if (value.kind !== "table") {
      throw new QRuntimeError("type", "rsave expects an unkeyed table");
    }
    writeQValueToFs(session, `${arg.value}/.qanvas-table`, value);
    return qSymbol(`:${arg.value}/`);
  });
  register("rload", 1, (session, [arg]) => {
    if (arg.kind !== "symbol" || arg.value.startsWith(":")) {
      throw new QRuntimeError("type", "rload expects a table name symbol");
    }
    const value = readQValueFromFs(session, `${arg.value}/.qanvas-table`);
    if (value.kind !== "table") {
      throw new QRuntimeError("type", "rload expected a splayed table payload");
    }
    session.assignGlobal(arg.value, value);
    return qSymbol(arg.value);
  });
  register("dsave", 2, (session, [root, names]) => {
    const rootPath =
      root.kind === "symbol"
        ? root.value.replace(/^:/, "").replace(/\/$/, "")
        : root.kind === "list" && root.items.length > 0 && root.items[0]!.kind === "symbol"
          ? root.items[0]!.value.replace(/^:/, "").replace(/\/$/, "")
          : null;
    if (rootPath === null) {
      throw new QRuntimeError("type", "dsave expects a file-symbol root");
    }
    const nameValues =
      names.kind === "symbol"
        ? [names]
        : names.kind === "list" && names.items.every((item) => item.kind === "symbol")
          ? (names.items as QSymbol[])
          : null;
    if (nameValues === null) {
      throw new QRuntimeError("type", "dsave expects symbol table names");
    }
    for (const name of nameValues) {
      const value = session.get(name.value);
      if (value.kind !== "table") {
        throw new QRuntimeError("type", "dsave expects unkeyed table globals");
      }
      writeQValueToFs(session, `${rootPath}/${name.value}/.qanvas-table`, value);
    }
    return names;
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

  register("parse", 1, (session, [arg]) => {
    if (arg.kind === "string") {
      const trimmed = arg.value.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        return session.evaluate(arg.value).value;
      }
      return qParseTree(arg.value, parseTreeDisplay(arg.value));
    }
    return arg;
  });
  register("eval", 1, (session, [arg]) => {
    if (arg.kind === "parseTree") {
      return session.evaluate(arg.source).value;
    }
    if (arg.kind === "list" && arg.items.length > 0) {
      const [head, ...args] = arg.items;
      if (head!.kind === "builtin" || head!.kind === "lambda" || head!.kind === "projection") {
        const evalArg = (value: typeof arg.items[number]): typeof arg.items[number] =>
          value.kind === "list" &&
          value.items.length > 0 &&
          (value.items[0]!.kind === "builtin" ||
            value.items[0]!.kind === "lambda" ||
            value.items[0]!.kind === "projection")
            ? session.invoke(value.items[0]!, value.items.slice(1).map(evalArg))
            : value;
        return session.invoke(head!, args.map(evalArg));
      }
    }
    return arg;
  });
  register("reval", 1, (session, [arg]) => session.invoke(session.get("eval"), [arg]));
  register("view", 1, (session, [arg]) => session.viewValue(arg));
  register("md5", 1, (_, [arg]) => V.md5Value(arg));

  register("tables", 0, (session, [arg]) => {
    const ns = arg?.kind === "symbol" ? arg.value : "";
    return session.listTables(ns);
  });
  register("views", 0, (session, [arg]) => {
    const ns = arg?.kind === "symbol" ? arg.value : "";
    return session.listViews(ns);
  });

  register("in", 2, (_, [left, right]) => inValue(left, right));
  register("each", 2, (session, [callable, arg]) => {
    if (arg.kind === "dictionary") {
      return qDictionary(arg.keys, arg.values.map((item) => session.invoke(callable, [item])));
    }
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
  register("exit", 1, () => qNull());

  return builtins;
};

export const SHARED_BUILTINS = createBuiltins();
