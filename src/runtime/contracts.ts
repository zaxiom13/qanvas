import type { QError } from "../q/errors";

export type RunState = "idle" | "running" | "paused" | "done" | "error";
export interface RuntimeEvents {
  output(kind: "out" | "err" | "info", text: string): void;
  error(err: QError, src: string): void;
  state(state: RunState): void;
  fps?(fps: number): void;
}
export interface RuntimeOptions {
  /** Maximum time for top-level code or setup. */
  runBudget?: number;
  /** Maximum time for a single draw callback. */
  frameBudget?: number;
}
