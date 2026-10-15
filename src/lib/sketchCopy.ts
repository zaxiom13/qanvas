import { newId, type Sketch } from "./storage";

const MAX_NAME = 200;

/** The name of a duplicate. A second copy is "Copy 2 of …", not "Copy of Copy of …". */
export function copyName(name: string): string {
  let rest = name;
  let n = 0;
  for (;;) {
    if (rest.startsWith("Copy of ")) {
      rest = rest.slice("Copy of ".length);
      n += 1;
      continue;
    }
    const numbered = /^Copy (\d+) of (.*)$/.exec(rest);
    if (numbered) {
      const k = Number(numbered[1]);
      if (Number.isInteger(k) && k >= 2 && k < 1_000_000) {
        n += k;
        rest = numbered[2];
        continue;
      }
    }
    break;
  }
  const next = n === 0 ? `Copy of ${name}` : `Copy ${n + 1} of ${rest || "Untitled sketch"}`;
  return next.slice(0, MAX_NAME) || "Copy of Untitled sketch";
}

/** A new sketch with the same code. The share key is not copied, so reopening the original link still finds the untouched copy. */
export function copySketch(s: Sketch, now = Date.now(), id = newId()): Sketch {
  const name = copyName(s.name);
  const out: Sketch = { id, name, code: s.code, created: now, updated: now };
  if (s.thumb) out.thumb = s.thumb;
  if (s.from) out.from = s.from;
  return out;
}
