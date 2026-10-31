import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { Sketch } from "./model";

// ---------- sharing (all in the URL, works offline) ----------
export const encodeShare = (name: string, code: string) => compressToEncodedURIComponent(JSON.stringify({ n: name, c: code }));

/** Share URLs longer than this are likely to be cut off by a chat app or an in-app browser.
 *  Assumption: Chrome allows roughly 2 million characters, and Discord messages stop at 2,000,
 *  which would warn on ordinary sketches. 8,000 sits between those. */
export const SHARE_LINK_WARN = 8000;

export const shareUrl = (origin: string, pathname: string, name: string, code: string) =>
  `${origin}${pathname}#/s/${encodeShare(name, code)}`;

/** One line shown when a `#/s/` link has just been opened. The picture is drawn locally. */
export function shareOpenedNote(name: string): string {
  const n = name.trim() || "this sketch";
  return `Opened shared sketch “${n}”.`;
}

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
