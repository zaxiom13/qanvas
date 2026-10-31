import { SketchController, type SketchPorts } from "../sketches/controller";
import type { Sketch } from "../sketches/model";
import { clearPending, saveSketch, stashPending } from "../adapters/browser/persistence";

type ViewPorts = Pick<SketchPorts, "changed" | "saveFailed" | "autoRun" | "validate" | "run">;

/** Browser composition lives here; the controller itself has no platform imports. */
export function createSketchWorkflow(initial: Sketch, view: ViewPorts) {
  return new SketchController(initial, {
    ...view,
    save: saveSketch,
    stash: stashPending,
    clearPending,
    // Wrapped: browsers throw "Illegal invocation" if timers are called with `this` = ports.
    now: () => Date.now(),
    schedule: (action, delay) => setTimeout(action, delay),
    cancel: (timer) => clearTimeout(timer),
    remember(id) {
      try { localStorage.setItem("qanvas:lastSketch", id); } catch { /* Storage unavailable. */ }
    },
  });
}
