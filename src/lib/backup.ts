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
  skipped: number;
}

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

/** Turn a backup file into sketches to add. Existing ids are given a new id, so nothing already saved is overwritten. */
export function sketchesFromBundle(text: string, existingIds: Iterable<string>, mint: () => string = newId): ImportPlan | { error: string } {
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

  const seen = new Set(existingIds);
  const add: Sketch[] = [];
  let skipped = 0;
  const room = list.slice(0, MAX_IMPORT);
  skipped += list.length - room.length;
  for (const raw of room) {
    if (!isSketch(raw) || typeof raw.code !== "string" || typeof raw.name !== "string") {
      skipped++;
      continue;
    }
    let id = typeof raw.id === "string" && raw.id ? raw.id : mint();
    if (seen.has(id)) id = mint();
    seen.add(id);
    const created = typeof raw.created === "number" ? raw.created : Date.now();
    const updated = typeof raw.updated === "number" ? raw.updated : created;
    const s: Sketch = { id, name: raw.name.slice(0, 200) || "Untitled sketch", code: raw.code, created, updated };
    if (typeof raw.thumb === "string") s.thumb = raw.thumb;
    if (typeof raw.from === "string") s.from = raw.from;
    if (typeof raw.share === "string") s.share = raw.share;
    add.push(s);
  }
  return { add, skipped };
}
