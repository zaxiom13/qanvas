import { newId, type Sketch } from "./storage";

const MAX_NAME = 200;

/** A new sketch with the same code. The share key is not copied, so reopening the original link still finds the untouched copy. */
export function copySketch(s: Sketch, now = Date.now(), id = newId()): Sketch {
  const name = `Copy of ${s.name}`.slice(0, MAX_NAME) || "Copy of Untitled sketch";
  const out: Sketch = { id, name, code: s.code, created: now, updated: now };
  if (s.thumb) out.thumb = s.thumb;
  if (s.from) out.from = s.from;
  return out;
}
