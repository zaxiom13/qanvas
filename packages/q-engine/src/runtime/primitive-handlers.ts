import { qBool, qDictionary, qFloat, qList, qLong, qString, qSymbol, type QValue } from "@qpad/core";
import { QRuntimeError, type BuiltinImpl } from "./types.js";
import * as V from "./values.js";

const { absValue, allValue, anyValue, avgsValue, toNumber, ceilingValue, colsValue, countValue, descValue, differValue, numericUnary, fillsValue, firstValue, lastValue, gradeValue, ascValue, minValue, minsValue, maxValue, maxsValue, medianValue, sumValue, avgValue, floorValue, nullValue, reciprocalValue, reverseValue, signumValue, negateValue, notValue, distinctValue, attrValue, flipValue, groupValue, trimStringValue, nextValue, productValue, prdsValue, prevValue, ratiosValue, varianceValue, deviationValue, mapBinary, add, subtract, multiply, divide, divValue, movingValue, movingCountValue, covarianceValue, correlationValue, emaValue, modValue, equals, compare, concatValues, bangValue, takeValue, dropValue, fillValue, findValue, castValue, maxPair, minPair, qComplex, qComplexFromValue, complexParts, complexArg, complexModulo, roundHalfAwayFromZero, formatFloat } = V;

export const SIMPLE_MONAD_HANDLERS: Array<[string, BuiltinImpl]> = [
  ["abs", (_, [arg]) => absValue(arg)],
  ["all", (_, [arg]) => allValue(arg)],
  ["any", (_, [arg]) => anyValue(arg)],
  ["avgs", (_, [arg]) => avgsValue(arg)],
  ["til", (_, [arg]) => qList(Array.from({ length: toNumber(arg) }, (_, i) => qLong(i)), true)],
  ["ceiling", (_, [arg]) => ceilingValue(arg)],
  ["cols", (session, [arg]) => colsValue(arg.kind === "symbol" && !arg.value.startsWith(":") ? session.get(arg.value) : arg)],
  ["count", (_, [arg]) => qLong(countValue(arg))],
  ["desc", (_, [arg]) => descValue(arg)],
  ["differ", (_, [arg]) => differValue(arg)],
  ["exp", (_, [arg]) => numericUnary(arg, Math.exp)],
  ["fills", (_, [arg]) => fillsValue(arg)],
  ["first", (_, [arg]) => firstValue(arg)],
  ["last", (_, [arg]) => lastValue(arg)],
  ["log", (_, [arg]) => numericUnary(arg, Math.log)],
  ["iasc", (_, [arg]) => gradeValue(arg, true)],
  ["idesc", (_, [arg]) => gradeValue(arg, false)],
  ["asc", (_, [arg]) => ascValue(arg)],
  ["asin", (_, [arg]) => numericUnary(arg, Math.asin)],
  ["acos", (_, [arg]) => numericUnary(arg, Math.acos)],
  ["atan", (_, [arg]) => numericUnary(arg, Math.atan)],
  ["min", (_, [arg]) => minValue(arg)],
  ["mins", (_, [arg]) => minsValue(arg)],
  ["max", (_, [arg]) => maxValue(arg)],
  ["maxs", (_, [arg]) => maxsValue(arg)],
  ["med", (_, [arg]) => medianValue(arg)],
  ["sum", (_, [arg]) => sumValue(arg)],
  ["avg", (_, [arg]) => avgValue(arg)],
  ["sin", (_, [arg]) => numericUnary(arg, Math.sin)],
  ["cos", (_, [arg]) => numericUnary(arg, Math.cos)],
  ["tan", (_, [arg]) => numericUnary(arg, Math.tan)],
  ["floor", (_, [arg]) => floorValue(arg)],
  ["null", (_, [arg]) => nullValue(arg)],
  ["reciprocal", (_, [arg]) => reciprocalValue(arg)],
  ["reverse", (_, [arg]) => reverseValue(arg)],
  ["signum", (_, [arg]) => signumValue(arg)],
  ["sqrt", (_, [arg]) => numericUnary(arg, Math.sqrt)],
  ["neg", (_, [arg]) => negateValue(arg)],
  ["not", (_, [arg]) => notValue(arg)],
  ["enlist", (_, [arg]) => qList([arg])],
  ["distinct", (_, [arg]) => distinctValue(arg)],
  ["attr", (_, [arg]) => attrValue(arg)],
  ["flip", (_, [arg]) => flipValue(arg)],
  ["group", (_, [arg]) => groupValue(arg)],
  ["lower", (_, [arg]) => V.lowerValue(arg)],
  ["ltrim", (_, [arg]) => trimStringValue(arg, "left")],
  ["next", (_, [arg]) => nextValue(arg)],
  ["upper", (_, [arg]) => V.upperValue(arg)],
  ["prd", (_, [arg]) => productValue(arg)],
  ["prds", (_, [arg]) => prdsValue(arg)],
  ["prev", (_, [arg]) => prevValue(arg)],
  ["ratios", (_, [arg]) => ratiosValue(arg)],
  ["rtrim", (_, [arg]) => trimStringValue(arg, "right")],
  ["var", (_, [arg]) => varianceValue(arg, false)],
  ["svar", (_, [arg]) => varianceValue(arg, true)],
  ["dev", (_, [arg]) => deviationValue(arg, false)],
  ["sdev", (_, [arg]) => deviationValue(arg, true)]
];

const eachPair = (left: QValue, right: QValue, mapper: (a: QValue, b: QValue) => QValue) =>
  mapBinary(left, right, mapper);

export const SIMPLE_DYAD_HANDLERS: Array<[string, BuiltinImpl]> = [
  ["+", (_, [left, right]) => eachPair(left, right, (a, b) => add(a, b))],
  ["-", (_, [left, right]) => eachPair(left, right, (a, b) => subtract(a, b))],
  ["*", (_, [left, right]) => eachPair(left, right, (a, b) => multiply(a, b))],
  ["%", (_, [left, right]) => eachPair(left, right, (a, b) => divide(a, b))],
  ["div", (_, [left, right]) => eachPair(left, right, (a, b) => divValue(a, b))],
  ["mavg", (_, [left, right]) => movingValue(left, right, avgValue, false, "floatNull")],
  ["mcount", (_, [left, right]) => movingValue(left, right, movingCountValue, true, "intZero")],
  ["mdev", (_, [left, right]) => movingValue(left, right, (window) => deviationValue(window, false), false, "floatNull")],
  ["mmin", (_, [left, right]) => movingValue(left, right, minValue, false, "source")],
  ["mmax", (_, [left, right]) => movingValue(left, right, maxValue, false, "source")],
  ["msum", (_, [left, right]) => movingValue(left, right, sumValue, false, "zero")],
  ["cov", (_, [left, right]) => covarianceValue(left, right, false)],
  ["scov", (_, [left, right]) => covarianceValue(left, right, true)],
  ["cor", (_, [left, right]) => correlationValue(left, right)],
  ["ema", (_, [left, right]) => emaValue(left, right)],
  ["mod", (_, [left, right]) => eachPair(left, right, (a, b) => modValue(a, b))],
  ["=", (_, [left, right]) => eachPair(left, right, (a, b) => qBool(equals(a, b)))],
  ["<", (_, [left, right]) => eachPair(left, right, (a, b) => qBool(compare(a, b) < 0))],
  [">", (_, [left, right]) => eachPair(left, right, (a, b) => qBool(compare(a, b) > 0))],
  ["<=", (_, [left, right]) => eachPair(left, right, (a, b) => qBool(compare(a, b) <= 0))],
  [">=", (_, [left, right]) => eachPair(left, right, (a, b) => qBool(compare(a, b) >= 0))],
  [",", (_, [left, right]) => concatValues(left, right)],
  ["!", (_, [left, right]) => bangValue(left, right)],
  ["#", (_, [left, right]) => takeValue(left, right)],
  ["_", (_, [left, right]) => dropValue(left, right)],
  ["~", (_, [left, right]) => qBool(equals(left, right))],
  ["^", (_, [left, right]) => fillValue(left, right)],
  ["?", (_, [left, right]) => findValue(left, right)],
  ["$", (_, [left, right]) => castValue(left, right)],
  ["|", (_, [left, right]) => eachPair(left, right, (a, b) => maxPair(a, b))],
  ["&", (_, [left, right]) => eachPair(left, right, (a, b) => minPair(a, b))]
];

export const COMPLEX_HANDLERS: Array<[string, number, BuiltinImpl]> = [
  [".cx.from", 1, (_, [arg]) => qComplexFromValue(arg)],
  [".cx.new", 2, (_, [re, im]) => qComplex(toNumber(re), toNumber(im))],
  [".cx.z", 2, (_, [re, im]) => qComplex(toNumber(re), toNumber(im))],
  [".cx.re", 1, (_, [arg]) => qFloat(complexParts(arg).re)],
  [".cx.im", 1, (_, [arg]) => qFloat(complexParts(arg).im)],
  [".cx.conj", 1, (_, [arg]) => {
    const value = complexParts(arg);
    return qComplex(value.re, -value.im);
  }],
  [".cx.neg", 1, (_, [arg]) => {
    const value = complexParts(arg);
    return qComplex(-value.re, -value.im);
  }],
  [".cx.add", 2, (_, [left, right]) => {
    const a = complexParts(left);
    const b = complexParts(right);
    return qComplex(a.re + b.re, a.im + b.im);
  }],
  [".cx.sub", 2, (_, [left, right]) => {
    const a = complexParts(left);
    const b = complexParts(right);
    return qComplex(a.re - b.re, a.im - b.im);
  }],
  [".cx.mul", 2, (_, [left, right]) => {
    const a = complexParts(left);
    const b = complexParts(right);
    return qComplex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  }],
  [".cx.div", 2, (_, [left, right]) => {
    const a = complexParts(left);
    const b = complexParts(right);
    const denominator = b.re * b.re + b.im * b.im;
    if (denominator === 0) throw new QRuntimeError("domain", "domain");
    return qComplex(
      (a.re * b.re + a.im * b.im) / denominator,
      (a.im * b.re - a.re * b.im) / denominator
    );
  }],
  [".cx.abs", 1, (_, [arg]) => qFloat(Math.hypot(complexParts(arg).re, complexParts(arg).im))],
  [".cx.modulus", 1, (_, [arg]) => qFloat(Math.hypot(complexParts(arg).re, complexParts(arg).im))],
  [".cx.floor", 1, (_, [arg]) => {
    const value = complexParts(arg);
    return qComplex(Math.floor(value.re), Math.floor(value.im));
  }],
  [".cx.ceil", 1, (_, [arg]) => {
    const value = complexParts(arg);
    return qComplex(Math.ceil(value.re), Math.ceil(value.im));
  }],
  [".cx.round", 1, (_, [arg]) => {
    const value = complexParts(arg);
    return qComplex(roundHalfAwayFromZero(value.re), roundHalfAwayFromZero(value.im));
  }],
  [".cx.frac", 1, (_, [arg]) => {
    const value = complexParts(arg);
    return qComplex(value.re - Math.floor(value.re), value.im - Math.floor(value.im));
  }],
  [".cx.mod", 2, (_, [left, right]) => complexModulo(left, right)],
  [".cx.arg", 1, (_, [arg]) => qFloat(complexArg(complexParts(arg)))],
  [".cx.recip", 1, (_, [arg]) => {
    const value = complexParts(arg);
    const denominator = value.re * value.re + value.im * value.im;
    if (denominator === 0) throw new QRuntimeError("domain", "domain");
    return qComplex(value.re / denominator, -value.im / denominator);
  }],
  [".cx.normalize", 1, (_, [arg]) => {
    const value = complexParts(arg);
    const magnitude = Math.hypot(value.re, value.im);
    if (magnitude === 0) throw new QRuntimeError("domain", "domain");
    return qComplex(value.re / magnitude, value.im / magnitude);
  }],
  [".cx.fromPolar", 2, (_, [radius, theta]) => {
    const r = toNumber(radius);
    const angle = toNumber(theta);
    return qComplex(r * Math.cos(angle), r * Math.sin(angle));
  }],
  [".cx.polar", 1, (_, [arg]) => {
    const value = complexParts(arg);
    return qDictionary(
      [qSymbol("r"), qSymbol("theta")],
      [qFloat(Math.hypot(value.re, value.im)), qFloat(complexArg(value))]
    );
  }],
  [".cx.exp", 1, (_, [arg]) => {
    const value = complexParts(arg);
    const expRe = Math.exp(value.re);
    return qComplex(expRe * Math.cos(value.im), expRe * Math.sin(value.im));
  }],
  [".cx.log", 1, (_, [arg]) => {
    const value = complexParts(arg);
    const magnitude = Math.hypot(value.re, value.im);
    if (magnitude === 0) throw new QRuntimeError("domain", "domain");
    return qComplex(Math.log(magnitude), complexArg(value));
  }],
  [".cx.pow", 2, (_, [left, right]) => {
    const base = complexParts(left);
    const exponent = complexParts(right);
    const magnitude = Math.hypot(base.re, base.im);
    if (magnitude === 0) throw new QRuntimeError("domain", "domain");
    const logBase = { re: Math.log(magnitude), im: complexArg(base) };
    const product = {
      re: exponent.re * logBase.re - exponent.im * logBase.im,
      im: exponent.re * logBase.im + exponent.im * logBase.re
    };
    const expRe = Math.exp(product.re);
    return qComplex(expRe * Math.cos(product.im), expRe * Math.sin(product.im));
  }],
  [".cx.powEach", 2, (_, [left, right]) => {
    const base = complexParts(left);
    if (right.kind === "number") return qComplex(Math.pow(base.re, right.value), Math.pow(base.im, right.value));
    const exponent = complexParts(right);
    return qComplex(Math.pow(base.re, exponent.re), Math.pow(base.im, exponent.im));
  }],
  [".cx.sqrt", 1, (_, [arg]) => {
    const value = complexParts(arg);
    const angle = complexArg(value) / 2;
    return qComplex(
      Math.sqrt(Math.hypot(value.re, value.im)) * Math.cos(angle),
      Math.sqrt(Math.hypot(value.re, value.im)) * Math.sin(angle)
    );
  }],
  [".cx.sin", 1, (_, [arg]) => {
    const value = complexParts(arg);
    return qComplex(Math.sin(value.re) * Math.cosh(value.im), Math.cos(value.re) * Math.sinh(value.im));
  }],
  [".cx.cos", 1, (_, [arg]) => {
    const value = complexParts(arg);
    return qComplex(Math.cos(value.re) * Math.cosh(value.im), -Math.sin(value.re) * Math.sinh(value.im));
  }],
  [".cx.tan", 1, (session, [arg]) => {
    const sine = session.invoke(session.get(".cx.sin"), [arg]);
    const cosine = session.invoke(session.get(".cx.cos"), [arg]);
    return session.invoke(session.get(".cx.div"), [sine, cosine]);
  }],
  [".cx.str", 1, (_, [arg]) => {
    const value = complexParts(arg);
    const sign = value.im < 0 ? "-" : "+";
    return qString(`${formatFloat(value.re)} ${sign} ${formatFloat(Math.abs(value.im))}i`);
  }]
];
