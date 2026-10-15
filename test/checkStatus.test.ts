import { expect, test } from "vitest";
import { checkLine } from "../src/lib/checkStatus";

test("a passing check says Passed", () => {
  expect(checkLine(true, "The dot product of a and b is 70.")).toBe("Passed: The dot product of a and b is 70.");
});

test("a failing check says Not yet, and keeps the q error", () => {
  expect(checkLine(false, "The dot product of a and b is 70.")).toBe("Not yet: The dot product of a and b is 70.");
  expect(checkLine(false, "answer should be 0.2 0.6 1 0.4 0.8.", "'type")).toBe(
    "Not yet: answer should be 0.2 0.6 1 0.4 0.8. ('type)",
  );
});
