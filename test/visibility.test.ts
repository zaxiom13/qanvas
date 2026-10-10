import { expect, test } from "vitest";
import { sketchHold } from "../src/lib/visibility";

test("hiding a running sketch pauses it", () => {
  expect(sketchHold("running", true, false)).toEqual({ held: true, action: "pause" });
});

test("hiding a sketch the learner already paused does not take it over", () => {
  expect(sketchHold("paused", true, false)).toEqual({ held: false, action: "none" });
  expect(sketchHold("done", true, false)).toEqual({ held: false, action: "none" });
  expect(sketchHold("error", true, false)).toEqual({ held: false, action: "none" });
});

test("showing the page resumes only the sketch we paused", () => {
  expect(sketchHold("paused", false, true)).toEqual({ held: false, action: "resume" });
  expect(sketchHold("paused", false, false)).toEqual({ held: false, action: "none" });
  expect(sketchHold("running", false, false)).toEqual({ held: false, action: "none" });
});
