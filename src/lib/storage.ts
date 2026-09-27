// Local persistence (IndexedDB). Everything stays on this device.
import { createStore, del, get, keys, set } from "idb-keyval";
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

const sketchDB = typeof indexedDB !== "undefined" ? createStore("qanvas", "sketches") : null;
const progressDB = typeof indexedDB !== "undefined" ? createStore("qanvas-progress", "progress") : null;

export interface Sketch {
  id: string;
  name: string;
  code: string;
  created: number;
  updated: number;
  thumb?: string;
  from?: string; // example id it was forked from
}

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export async function listSketches(): Promise<Sketch[]> {
  if (!sketchDB) return [];
  const ks = await keys(sketchDB);
  const all = await Promise.all(ks.map((k) => get<Sketch>(k, sketchDB)));
  return (all.filter(Boolean) as Sketch[]).sort((a, b) => b.updated - a.updated);
}

export const getSketch = (id: string) => (sketchDB ? get<Sketch>(id, sketchDB) : Promise.resolve(undefined));
export const saveSketch = (s: Sketch) => (sketchDB ? set(s.id, s, sketchDB) : Promise.resolve());
export const deleteSketch = (id: string) => (sketchDB ? del(id, sketchDB) : Promise.resolve());

// ---------- learning progress ----------
export interface Progress {
  done: Record<string, number>; // lesson/dojo id -> timestamp
  code: Record<string, string>; // saved answers
}

let progressCache: Progress | null = null;

export async function getProgress(): Promise<Progress> {
  if (progressCache) return progressCache;
  const p = progressDB ? await get<Progress>("progress", progressDB) : undefined;
  progressCache = p ?? { done: {}, code: {} };
  return progressCache;
}

export async function markDone(id: string) {
  const p = await getProgress();
  p.done[id] = Date.now();
  if (progressDB) await set("progress", p, progressDB);
}

export async function saveAnswer(id: string, code: string) {
  const p = await getProgress();
  p.code[id] = code;
  if (progressDB) await set("progress", p, progressDB);
}

// ---------- sharing (all in the URL, works offline) ----------
export const encodeShare = (name: string, code: string) => compressToEncodedURIComponent(JSON.stringify({ n: name, c: code }));
export function decodeShare(data: string): { name: string; code: string } | null {
  try {
    const j = JSON.parse(decompressFromEncodedURIComponent(data) ?? "");
    return { name: String(j.n ?? "Shared sketch"), code: String(j.c ?? "") };
  } catch {
    return null;
  }
}
