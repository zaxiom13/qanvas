import type { Sketch } from "./model";

/** The stored sketch with a newer stashed edit applied, or null if there's nothing to recover for `id`. */
export function recoverPending(id: string, stored: Sketch | undefined, pending: Pick<Sketch, "id" | "name" | "code" | "updated"> | null): Sketch | null {
  if (!pending || pending.id !== id) return null;
  if (stored && stored.updated >= pending.updated) return null;
  const base = stored ?? { id, name: pending.name, code: "", created: pending.updated, updated: pending.updated };
  return { ...base, name: String(pending.name || base.name), code: pending.code, updated: pending.updated };
}

