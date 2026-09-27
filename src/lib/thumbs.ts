// Gallery thumbnails, rendered lazily in the browser and cached for the session.
import { runHeadless } from "../qanvas/headless";

const cache = new Map<string, string>();
const queue: { key: string; code: string; resolve: (u: string) => void }[] = [];
let busy = false;

export function thumbnail(key: string, code: string): Promise<string> {
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    queue.push({ key, code, resolve });
    pump();
  });
}

function pump() {
  if (busy || !queue.length) return;
  busy = true;
  const idle = (cb: () => void) => ("requestIdleCallback" in window ? requestIdleCallback(cb, { timeout: 300 }) : setTimeout(cb, 16));
  idle(() => {
    const job = queue.shift()!;
    const size = 240;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    runHeadless(job.code, { ctx, frames: 45, scale: size / 600, budgetMs: 2500, mouse: [380, 260] });
    const url = canvas.toDataURL("image/webp", 0.82);
    cache.set(job.key, url);
    job.resolve(url);
    busy = false;
    pump();
  });
}
