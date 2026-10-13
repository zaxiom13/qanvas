import "fake-indexeddb/auto";
import { beforeEach, expect, test } from "vitest";
import { createStore, get, set } from "idb-keyval";
import { forgetProgressCache, getProgress, markDone, saveAnswer, type Progress } from "../src/lib/storage";

const store = createStore("qanvas-progress", "progress");

beforeEach(async () => {
  forgetProgressCache();
  await set("progress", { done: {}, code: {} }, store);
});

test("a stale cache does not drop a done bit written by another tab", async () => {
  await getProgress();
  await set("progress", { done: { lesson: 5 }, code: { kept: "1+1" } }, store);
  await markDone("dojo", 9);
  const saved = await get<Progress>("progress", store);
  expect(saved?.done).toEqual({ lesson: 5, dojo: 9 });
  expect(saved?.code).toEqual({ kept: "1+1" });
});

test("a saved answer does not drop a done bit written by another tab", async () => {
  await getProgress();
  await set("progress", { done: { lesson: 5 }, code: {} }, store);
  await saveAnswer("dojo", "sum x");
  const saved = await get<Progress>("progress", store);
  expect(saved?.done).toEqual({ lesson: 5 });
  expect(saved?.code).toEqual({ dojo: "sum x" });
});

test("overlapping writes from this tab keep every done bit and answer", async () => {
  await Promise.all([markDone("a", 1), saveAnswer("b", "sum x"), markDone("c", 2)]);
  forgetProgressCache();
  const p = await getProgress();
  expect(p.done).toEqual({ a: 1, c: 2 });
  expect(p.code).toEqual({ b: "sum x" });
});
