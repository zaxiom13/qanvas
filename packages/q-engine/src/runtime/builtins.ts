import { qBool, qDate, qDictionary, qFloat, qInt, qKeyedTable, qList, qLong, qNull, qReal, qShort, qString, qSymbol, qTypeNumber, type QSymbol } from "@qpad/core";
import { Q_LONG_MAX, Q_RESERVED_WORDS, Q_X10_ALPHABET, Q_X12_ALPHABET, type BuiltinEntry, type BuiltinImpl, QRuntimeError } from "./types.js";
import type { Session } from "./session.js";
import * as V from "./values.js";
const { formatValue, parseNumericLiteral, parseTemporalLiteral, qTemporal, lambdaArity, collectImplicitParams, asList, toNumber, numeric, NUMERIC_RANK, numericTypeOf, promoteNumericType, numericOf, nullForType, isNumericNull, unaryNumeric, roundHalfAwayFromZero, qComplex, complexDictionaryField, complexParts, qComplexFromValue, complexArg, positiveModulo, complexModulo, dictionaryKeysMatch, applyDictionaryBinary, arithBinary, addTemporal, subtractTemporal, add, subtract, multiply, divide, divValue, modValue, compare, compareValue, equals, numericUnary, mapBinary, countValue, absValue, allValue, anyValue, ceilingValue, colsValue, firstValue, lastValue, ascValue, descValue, attrValue, sumValue, sampleNumericType, minValue, maxValue, medianValue, minPair, maxPair, avgValue, avgsValue, productValue, prdsValue, prevValue, nextValue, sumsValue, minsValue, maxsValue, ratiosValue, varianceValue, deviationValue, movingCountValue, movingValue, deltasValue, reverseValue, differValue, fillsValue, reciprocalValue, signumValue, floorValue, cutValue, rotateValue, sublistValue, chunkValue, cutByIndices, addMonthsValue, parseQOpt, defineDefaults, formatQNumber, atobValue, btoaValue, encodeFixedBase, decodeFixedBase, sanitizeQIdentifier, uniquifyQIdentifiers, qsqlExpressionName, QSQL_AGGREGATES, isQsqlAggregateExpression, qsqlColumnNames, renameTableColumns, qIdValue, xcolValue, asMatrix, fromMatrix, mmuValue, invValue, wsumValue, wavgValue, binarySearchValue, rankValue, randValue, hsymValue, fileHandlePath, loadScriptFromFs, textLines, byteListFromBytes, byteListFromText, inferFormatFromExt, isDelimitedFormat, delimiterForDelimitedFormat, delimiterForFormat, variableNameFromFilePath, escapeCsvField, cellToCsvText, tableToCsv, tableForDelimitedSave, parseCsvLine, inferCellValue, csvToTable, writeQValueToFs, readQValueFromFs, hydrateCanonical, xcolsValue, insertValue, upsertValue, inValue, gradeValue, asSequenceItems, shuffleItems, rebuildSequence, distinctItems, crossValue, applyEachValue, groupValue, callableArity, convergeValue, reduceValueWithSeed, scanValueWithSeed, flattenRazeLeaves, PRIMITIVE_ADVERB_TYPECHECK_NAMES, ensurePrimitiveAdverbInput, reduceValue, scanValue, reducePrimitiveAdverbValue, scanPrimitiveAdverbValue, primitiveDerivedAdverbValue, priorValue, patternToRegex, likeValue, ssValue, stringLikeValue, svValue, vsValue, resolveWithinBound, withinValue, exceptValue, interValue, unionValue, lowerValue, upperValue, trimStringValue, nullValue, flipListValue, flipValue, negateValue, notValue, distinctValue, namespaceKeys, whereValue, concatValues, concatTables, razeValue, takeValue, reshapeValue, reshapeStrings, reshapeItems, dropValue, fillValue, sampleSequence, findMappedValues, findValue, castNameFromLeftOperand, CAST_ALIAS_GROUPS, CAST_HANDLER_BY_NAME, castValue, tableColumnNames, tableRowAsDict, asKeyedTable, asTable, asSymbolList, xascValue, xkeyValue, xgroupValue, ssrValue, leftJoin, innerJoin, unionJoin, plusJoin, bangValue, asofJoinValue, equiJoinValue, windowJoinValue, asofValue, xbarValue, castSymbolValue, castSymbolAtom, castBooleanValue, castBooleanAtom, castByteValue, castByteAtom, castShortValue, castShortAtom, castCharValue, stringAtomValue, stringValue, castIntValue, castLongAtom, castLongValue, castRealAtom, castRealValue, castIntAtom, castFloatValue, castFloatAtom, castDateValue, castDateAtom, isDateLiteral, Q_DATE_EPOCH_MS, parseQDateDays, formatQDateFromDays, buildTable, tableRowCount, selectColumnRows, selectTableRows, materializeTableColumn, requireUnaryIndex, collectNumericPositions, tableColumnByName, applyListIndex, applyStringIndex, applyDictionaryIndex, applyValue, indexList, indexString, indexNestedRows, indexDictionary, isSymbolList, selectTableByUnaryIndex, projectTableSelection, indexTable, rowFromTable, indexKeyedTable, nullLike, temporalNullForType, isNullish, selectTableColumns, formatBare, trimFloat, formatFloat, formatListNumber, formatTable, layoutTable, formatKeyedTable, formatTableCell, formatDictionary } = V;

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

export const SHARED_BUILTINS = createBuiltins();
