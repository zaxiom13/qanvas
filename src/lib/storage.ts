// Local persistence (IndexedDB). Everything stays on this device.
import { createStore, del, get, keys, set, update } from "idb-keyval";
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
  share?: string; // shareKey of the link it was opened from
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

// An IndexedDB write started in pagehide can be dropped when the page is torn down, so an
// unsaved edit is also stashed synchronously in localStorage and recovered on the next load.
const PENDING = "qanvas:pendingSketch";

export function stashPending(s: Sketch) {
  try {
    localStorage.setItem(PENDING, JSON.stringify({ id: s.id, name: s.name, code: s.code, updated: s.updated }));
  } catch {
    /* storage unavailable */
  }
}

export function clearPending(id: string) {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING) ?? "null");
    if (p?.id === id) localStorage.removeItem(PENDING);
  } catch {
    /* storage unavailable */
  }
}

export function readPending(): Pick<Sketch, "id" | "name" | "code" | "updated"> | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING) ?? "null");
    return p && typeof p.id === "string" && typeof p.code === "string" && typeof p.updated === "number" ? p : null;
  } catch {
    return null;
  }
}

/** The stored sketch with a newer stashed edit applied, or null if there's nothing to recover for `id`. */
export function recoverPending(id: string, stored: Sketch | undefined, pending = readPending()): Sketch | null {
  if (!pending || pending.id !== id) return null;
  if (stored && stored.updated >= pending.updated) return null;
  const base = stored ?? { id, name: pending.name, code: "", created: pending.updated, updated: pending.updated };
  return { ...base, name: String(pending.name || base.name), code: pending.code, updated: pending.updated };
}

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

/** Drop the in-memory copy so the next read comes from the database. */
export function forgetProgressCache() {
  progressCache = null;
}

function copyProgress(old: Progress | undefined): Progress {
  return { ...old, done: { ...(old?.done ?? {}) }, code: { ...(old?.code ?? {}) } };
}

function withDone(old: Progress | undefined, id: string, at: number): Progress {
  const base = copyProgress(old);
  base.done[id] = at;
  return base;
}

function withAnswer(old: Progress | undefined, id: string, code: string): Progress {
  const base = copyProgress(old);
  base.code[id] = code;
  return base;
}

// Read and write inside one IndexedDB transaction. Two tabs (or a stale cache in this tab)
// must not replace the whole record and drop each other's done bits or saved answers.
async function commitProgress(next: (old: Progress | undefined) => Progress): Promise<void> {
  if (!progressDB) {
    progressCache = next(progressCache ?? undefined);
    return;
  }
  let written!: Progress;
  await update<Progress>("progress", (old) => {
    written = next(old);
    return written;
  }, progressDB);
  progressCache = written;
}

export async function markDone(id: string, at = Date.now()) {
  await commitProgress((old) => withDone(old, id, at));
}

export async function saveAnswer(id: string, code: string) {
  await commitProgress((old) => withAnswer(old, id, code));
}

// ---------- sharing (all in the URL, works offline) ----------
export const encodeShare = (name: string, code: string) => compressToEncodedURIComponent(JSON.stringify({ n: name, c: code }));

/** Share URLs longer than this are likely to be cut off by a chat app or an in-app browser.
 *  Assumption: Chrome allows roughly 2 million characters, and Discord messages stop at 2,000,
 *  which would warn on ordinary sketches. 8,000 sits between those. */
export const SHARE_LINK_WARN = 8000;

export const shareUrl = (origin: string, pathname: string, name: string, code: string) =>
  `${origin}${pathname}#/s/${encodeShare(name, code)}`;

export function shareWarning(url: string): string | null {
  if (url.length <= SHARE_LINK_WARN) return null;
  const n = url.length.toLocaleString("en-US");
  return `This link is ${n} characters. Some chat apps and mobile browsers cut off links this long, so the sketch may not open.`;
}
export function decodeShare(data: string): { name: string; code: string } | null {
  try {
    const j = JSON.parse(decompressFromEncodedURIComponent(data) ?? "");
    return { name: String(j.n ?? "Shared sketch"), code: String(j.c ?? "") };
  } catch {
    return null;
  }
}

/** Short stable key for a shared sketch, so reopening the same link finds the copy it made. */
export function shareKey(name: string, code: string): string {
  let h = 0x811c9dc5;
  const s = name + "\u0000" + code;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36) + s.length.toString(36);
}

/** The copy an earlier open of this link made, if the learner hasn't edited it since. */
export const findSharedCopy = (list: Sketch[], key: string, code: string) => list.find((s) => s.share === key && s.code === code);
