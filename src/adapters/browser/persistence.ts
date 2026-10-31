import { createStore, del, get, keys, set } from "idb-keyval";
import type { Sketch, SketchStore } from "../../sketches/model";
import type { Progress } from "../../learning/progress";

const sketchDB = typeof indexedDB !== "undefined" ? createStore("qanvas", "sketches") : null;
const progressDB = typeof indexedDB !== "undefined" ? createStore("qanvas-progress", "progress") : null;


export async function listSketches(): Promise<Sketch[]> {
  if (!sketchDB) return [];
  const ks = await keys(sketchDB);
  const all = await Promise.all(ks.map((k) => get<Sketch>(k, sketchDB)));
  return (all.filter(Boolean) as Sketch[]).sort((a, b) => b.updated - a.updated);
}

export const getSketch = (id: string) => (sketchDB ? get<Sketch>(id, sketchDB) : Promise.resolve(undefined));
export const saveSketch = (s: Sketch) => (sketchDB ? set(s.id, s, sketchDB) : Promise.resolve());
export const deleteSketch = (id: string) => {
  clearPending(id);
  return sketchDB ? del(id, sketchDB) : Promise.resolve();
};

// An IndexedDB write started in pagehide can be dropped when the page is torn down, so an
// unsaved edit is also stashed synchronously in localStorage and recovered on the next load.
const PENDING = "qanvas:pendingSketch";

export function stashPending(s: Sketch) {
  const old = readPending(s.id);
  if (old && old.updated > s.updated) return;
  try {
    const data = JSON.stringify({ id: s.id, name: s.name, code: s.code, updated: s.updated });
    localStorage.setItem(PENDING + ":" + s.id, data);
    localStorage.setItem(PENDING, data);
  } catch {
    /* storage unavailable */
  }
}

export function clearPending(id: string, throughUpdated = Infinity) {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING) ?? "null");
    if (p?.id === id && p.updated <= throughUpdated) localStorage.removeItem(PENDING);
    const own = JSON.parse(localStorage.getItem(PENDING + ":" + id) ?? "null");
    if (own?.updated <= throughUpdated) localStorage.removeItem(PENDING + ":" + id);
  } catch {
    /* storage unavailable */
  }
}

export function readPending(id?: string): Pick<Sketch, "id" | "name" | "code" | "updated"> | null {
  try {
    const p = JSON.parse((id ? localStorage.getItem(PENDING + ":" + id) : null) ?? localStorage.getItem(PENDING) ?? "null");
    return p && (!id || p.id === id) && typeof p.id === "string" && typeof p.code === "string" && typeof p.updated === "number" ? p : null;
  } catch {
    return null;
  }
}

// ---------- learning progress ----------
let progressCache: Progress | null = null;
let progressLoad: Promise<Progress> | null = null;
let progressWrites: Promise<unknown> = Promise.resolve();

function persistProgress(p: Progress) {
  const snapshot = { done: { ...p.done }, code: { ...p.code } };
  const write = progressWrites.catch(() => {}).then(() => progressDB ? set("progress", snapshot, progressDB) : undefined);
  progressWrites = write;
  return write;
}

export async function getProgress(): Promise<Progress> {
  if (progressCache) return progressCache;
  if (!progressLoad) progressLoad = (async () => {
    const p = progressDB ? await get<Progress>("progress", progressDB) : undefined;
    return progressCache = p ?? { done: {}, code: {} };
  })().catch((error) => { progressLoad = null; throw error; });
  return progressLoad;
}

export async function markDone(id: string) {
  const p = await getProgress();
  p.done[id] = Date.now();
  await persistProgress(p);
}

export async function saveAnswer(id: string, code: string) {
  const p = await getProgress();
  p.code[id] = code;
  await persistProgress(p);
}


export const sketchStore: SketchStore = { list: listSketches, get: getSketch, save: saveSketch, delete: deleteSketch };
