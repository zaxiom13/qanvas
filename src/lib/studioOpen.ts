import { clearPending, readPending, recoverPending, type Sketch } from "./storage";

const LAST = "qanvas:lastSketch";

/** Drop the pointer and any stashed edit for a sketch that is gone. */
export function forgetSketchPointer(id: string) {
  clearPending(id);
  try {
    if (localStorage.getItem(LAST) === id) localStorage.removeItem(LAST);
  } catch {
    /* storage unavailable */
  }
}

export function rememberSketch(id: string) {
  try {
    localStorage.setItem(LAST, id);
  } catch {
    /* storage unavailable */
  }
}

export interface SketchChoice {
  sketch: Sketch;
  /** The sketch was rebuilt from a stashed edit and should be written. */
  persist: boolean;
  /** Replace a dead `#/sketch/<id>` with this id. Null leaves the hash alone. */
  replaceWithId: string | null;
  /** The route named an id that is gone and nothing else is saved, so go to `#/sketch`. */
  clearRoute: boolean;
  /** Set lastSketch to this id, clear it when null, or leave it when undefined. */
  rememberId: string | null | undefined;
}

/**
 * Which sketch the studio should show.
 * A missing id (deleted, or a stale lastSketch) falls through to the newest
 * sketch still on the device, then to an unsaved `fresh` canvas.
 */
export function chooseStudioSketch(req: {
  routeId: string;
  lastId: string | null;
  stored: Sketch | undefined;
  pending: ReturnType<typeof readPending>;
  newest: Sketch | undefined;
  fresh: Sketch;
}): SketchChoice {
  const requested = req.routeId || req.lastId || "";
  if (requested) {
    const recovered = recoverPending(requested, req.stored, req.pending);
    if (recovered) return { sketch: recovered, persist: true, replaceWithId: null, clearRoute: false, rememberId: undefined };
    if (req.stored) return { sketch: req.stored, persist: false, replaceWithId: null, clearRoute: false, rememberId: undefined };
  }
  const newest = req.newest && req.newest.id !== requested ? req.newest : undefined;
  if (newest) {
    return {
      sketch: newest,
      persist: false,
      replaceWithId: req.routeId ? newest.id : null,
      clearRoute: false,
      rememberId: newest.id,
    };
  }
  return {
    sketch: req.fresh,
    persist: false,
    replaceWithId: null,
    clearRoute: !!req.routeId,
    rememberId: requested ? null : undefined,
  };
}

/** The sketch to put on screen after a delete. Null means the open sketch stays. */
export function replaceDeletedSketch(openId: string, deletedId: string, remaining: Sketch[], fresh: Sketch): Sketch | null {
  if (openId !== deletedId) return null;
  return remaining.find((s) => s.id !== deletedId) ?? fresh;
}
