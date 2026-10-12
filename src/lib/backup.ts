import { newId, type Sketch } from "./storage";

/** How many sketches one backup file may add. The rest are skipped so a huge file can't freeze the tab. */
export const MAX_IMPORT = 500;

export interface SketchBundle {
  kind: "qanvas-sketches";
  version: 1;
  sketches: Sketch[];
}

export interface ImportPlan {
  add: Sketch[];
  /** Malformed entries, or sketches past the import cap. */
  skipped: number;
  /** Same id, name and code as a sketch already on this device, or earlier in this file. */
  already: number;
}

/** An id that is taken. A full sketch lets a second import of that same backup be skipped. */
export type ExistingSketch = string | Pick<Sketch, "id" | "name" | "code">;

const isSketch = (v: unknown): v is Partial<Sketch> => !!v && typeof v === "object";

export function sketchesToBundle(sketches: Sketch[]): string {
  const bundle: SketchBundle = {
    kind: "qanvas-sketches",
    version: 1,
    sketches: sketches.map((s) => {
      const out: Sketch = { id: s.id, name: s.name, code: s.code, created: s.created, updated: s.updated };
      if (s.thumb) out.thumb = s.thumb;
      if (s.from) out.from = s.from;
      if (s.share) out.share = s.share;
      return out;
    }),
  };
  return JSON.stringify(bundle);
}

const sketchName = (name: string) => name.slice(0, 200) || "Untitled sketch";

/**
 * Turn a backup file into sketches to add.
 * An id that is already taken is given a new id, so nothing saved is overwritten.
 * When the taken id belongs to a sketch with the same name and code, that entry is
 * skipped instead. A second import of the same file then adds nothing.
 * Passing only ids (no name or code) still mints a new id on every collision.
 */
export function sketchesFromBundle(text: string, existing: Iterable<ExistingSketch>, mint: () => string = newId): ImportPlan | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "That file isn't JSON." };
  }
  if (!isSketch(data) || (data as { kind?: unknown }).kind !== "qanvas-sketches") {
    return { error: "That file isn't a Qanvas sketch backup." };
  }
  const version = (data as { version?: unknown }).version;
  if (version !== undefined && version !== 1) return { error: "That backup was made by a newer Qanvas. This one can only read version 1." };
  const list = (data as { sketches?: unknown }).sketches;
  if (!Array.isArray(list)) return { error: "That backup has no sketches." };

  // `true` means the id is taken but the name and code are unknown, so a collision must be copied.
  const known = new Map<string, { name: string; code: string } | true>();
  for (const item of existing) {
    if (typeof item === "string") {
      if (item) known.set(item, known.get(item) ?? true);
    } else if (item && typeof item.id === "string" && item.id) {
      known.set(item.id, { name: sketchName(item.name), code: item.code });
    }
  }
  const add: Sketch[] = [];
  let skipped = 0;
  let already = 0;
  const room = list.slice(0, MAX_IMPORT);
  skipped += list.length - room.length;
  for (const raw of room) {
    if (!isSketch(raw) || typeof raw.code !== "string" || typeof raw.name !== "string") {
      skipped++;
      continue;
    }
    const name = sketchName(raw.name);
    const code = raw.code;
    let id = typeof raw.id === "string" && raw.id ? raw.id : mint();
    const held = known.get(id);
    if (held) {
      if (held !== true && held.name === name && held.code === code) {
        already++;
        continue;
      }
      id = mint();
    }
    known.set(id, { name, code });
    const created = typeof raw.created === "number" ? raw.created : Date.now();
    const updated = typeof raw.updated === "number" ? raw.updated : created;
    const s: Sketch = { id, name, code, created, updated };
    if (typeof raw.thumb === "string") s.thumb = raw.thumb;
    if (typeof raw.from === "string") s.from = raw.from;
    if (typeof raw.share === "string") s.share = raw.share;
    add.push(s);
  }
  return { add, skipped, already };
}
