import { describe, expect, it } from "vitest";
import { createSession } from "../src/index";
import type { QValue } from "../src/index";
import {
  PRACTICE_CHALLENGES,
  getPracticeSolutionSource,
} from "../../../app/src/lib/practice-challenges";

function convertValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(convertValue);
  if (typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  switch (record.kind) {
    case "null":
      return null;
    case "boolean":
      return Boolean(record.value);
    case "number":
      if (record.special === "null" || record.special === "intNull") return null;
      return Number.isFinite(record.value as number)
        ? (record.value as number)
        : String(record.value);
    case "symbol":
    case "string":
    case "temporal":
      return record.value;
    case "list":
      return ((record.items as unknown[]) ?? []).map(convertValue);
    case "dictionary": {
      const keys = (record.keys as unknown[]) ?? [];
      const values = (record.values as unknown[]) ?? [];
      const entries: Array<[string, unknown]> = [];
      for (let index = 0; index < keys.length; index += 1) {
        entries.push([normalizeKey(keys[index]), convertValue(values[index])]);
      }
      return Object.fromEntries(entries);
    }
    case "table": {
      const columns = (record.columns as Record<string, unknown>) ?? {};
      const out: Record<string, unknown> = {};
      for (const name of Object.keys(columns)) out[name] = convertValue(columns[name]);
      return out;
    }
    case "keyedTable":
      return { keys: convertValue(record.keys), values: convertValue(record.values) };
    default:
      return value;
  }
}

function normalizeKey(value: unknown): string {
  const converted = convertValue(value);
  if (typeof converted === "string") return converted;
  if (typeof converted === "number" || typeof converted === "boolean") return String(converted);
  return JSON.stringify(converted);
}

function stableValue(value: unknown): string {
  return JSON.stringify(value, (_key, entry) => {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      return Object.fromEntries(
        Object.entries(entry as Record<string, unknown>).sort(([left], [right]) =>
          left.localeCompare(right)
        )
      );
    }
    return entry;
  });
}

describe("practice challenge solutions", () => {
  for (const challenge of PRACTICE_CHALLENGES) {
    it(`${challenge.id} solution produces expected answer`, () => {
      const session = createSession();
      session.evaluate(getPracticeSolutionSource(challenge.id));
      const result = session.evaluate(challenge.answerExpression);
      const actual = convertValue(result.value as unknown as QValue);
      expect(stableValue(actual)).toBe(stableValue(challenge.expected));
    });
  }
});
