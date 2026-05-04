import { qFloat, qList, qLong, type QNumber, type QValue } from "@qpad/core";
import { primitiveNamesBy } from "./primitive-manifest.js";
import { compare, maxPair, minPair, multiply, numericOf, promoteNumericType, toNumber } from "./values.js";

const OVER_KERNELS = new Set(primitiveNamesBy("overKernel"));
const SCAN_KERNELS = new Set(primitiveNamesBy("scanKernel"));
const EACH_PAIR_KERNELS = new Set(primitiveNamesBy("eachPairKernel"));

const numericItems = (value: QValue): QNumber[] | null =>
  value.kind === "list" && (value.homogeneous ?? false) && value.items.every((item) => item.kind === "number")
    ? (value.items as QNumber[])
    : null;

const numericType = (items: QNumber[]) =>
  items.reduce((type, item) => promoteNumericType(type, item.numericType), "long");

const nullSafeNumbers = (items: QNumber[]) => items.filter((item) => !item.special?.includes("Null"));

export const tryPrimitiveOver = (base: string, value: QValue, seed?: QValue): QValue | null => {
  if (!OVER_KERNELS.has(base)) return null;
  const items = numericItems(value);
  if (!items) return null;
  const values = nullSafeNumbers(items);

  if (base === "+") {
    let total = seed?.kind === "number" ? toNumber(seed) : 0;
    for (const item of values) total += item.value;
    return numericOf(total, seed?.kind === "number" ? promoteNumericType(seed.numericType, numericType(values)) : numericType(values));
  }
  if (base === "*") {
    let total = seed?.kind === "number" ? toNumber(seed) : 1;
    for (const item of values) total *= item.value;
    return numericOf(total, seed?.kind === "number" ? promoteNumericType(seed.numericType, numericType(values)) : numericType(values));
  }
  if (base === "|") {
    const all = seed ? [seed, ...values] : values;
    return all.length === 0 ? null : all.reduce(maxPair);
  }
  if (base === "&") {
    const all = seed ? [seed, ...values] : values;
    return all.length === 0 ? null : all.reduce(minPair);
  }
  return null;
};

export const tryPrimitiveScan = (base: string, value: QValue, seed?: QValue): QValue | null => {
  if (!SCAN_KERNELS.has(base)) return null;
  const items = numericItems(value);
  if (!items) return null;
  const outputs: QValue[] = [];

  if (base === "+") {
    let total = seed?.kind === "number" ? toNumber(seed) : 0;
    for (const item of items) {
      total += item.value;
      outputs.push(numericOf(total, seed?.kind === "number" ? promoteNumericType(seed.numericType, item.numericType) : item.numericType));
    }
    return qList(outputs, false);
  }
  if (base === "*") {
    let total = seed?.kind === "number" ? toNumber(seed) : 1;
    for (const item of items) {
      total *= item.value;
      outputs.push(numericOf(total, seed?.kind === "number" ? promoteNumericType(seed.numericType, item.numericType) : item.numericType));
    }
    return qList(outputs, false);
  }
  if (base === "|") {
    let current = seed ?? items[0];
    for (const item of seed ? items : items.slice(1)) {
      current = maxPair(current, item);
      outputs.push(current);
    }
    return seed ? qList(outputs, false) : qList([items[0]!, ...outputs], false);
  }
  if (base === "&") {
    let current = seed ?? items[0];
    for (const item of seed ? items : items.slice(1)) {
      current = minPair(current, item);
      outputs.push(current);
    }
    return seed ? qList(outputs, false) : qList([items[0]!, ...outputs], false);
  }
  return null;
};

export const tryPrimitiveEachPair = (base: string, value: QValue, seed?: QValue): QValue | null => {
  if (!EACH_PAIR_KERNELS.has(base)) return null;
  const items = numericItems(value);
  if (!items || items.length < 2) return null;
  if (base !== "-") return null;

  const outputType = numericType(items);
  const results = items.slice(1).map((item, index) =>
    numericOf(item.value - items[index]!.value, outputType)
  );
  return seed
    ? qList([numericOf(items[0]!.value - toNumber(seed), outputType), ...results], false)
    : qList([items[0]!, ...results], false);
};
