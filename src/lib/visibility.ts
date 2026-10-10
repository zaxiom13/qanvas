import type { RunState } from "../qanvas/runtime";

export interface Hold {
  held: boolean;
  action: "pause" | "resume" | "none";
}

/**
 * A running sketch should stop spending frames while the page is hidden, and
 * come back when the page does. A sketch the learner paused themselves stays paused.
 */
export function sketchHold(state: RunState, hidden: boolean, held: boolean): Hold {
  if (hidden) return state === "running" ? { held: true, action: "pause" } : { held, action: "none" };
  return held ? { held: false, action: "resume" } : { held: false, action: "none" };
}
