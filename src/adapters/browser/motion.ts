// Phone tilt and shake, published to sketches as `tilt` (x y, each -1..1) and `shake` (0 = still).
// One listener is shared by every canvas on the page.

type PermissionEvent = { requestPermission?: () => Promise<"granted" | "denied"> };

let tilt: [number, number] = [0, 0];
let shake = 0;
let lastShakeAt = 0;
let listening = false;

const clamp = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v);

function onOrientation(e: DeviceOrientationEvent) {
  if (e.gamma == null || e.beta == null) return;
  // Portrait phone held comfortably (about 30° back) reads as level.
  tilt = [clamp(e.gamma / 45), clamp((e.beta - 30) / 45)];
}

function onMotion(e: DeviceMotionEvent) {
  const a = e.acceleration ?? e.accelerationIncludingGravity;
  if (!a || a.x == null || a.y == null || a.z == null) return;
  const g = e.acceleration ? 0 : 9.81;
  const m = Math.abs(Math.hypot(a.x, a.y, a.z) - g);
  if (m > 2) {
    shake = Math.min(3, shake + m / 25);
    lastShakeAt = performance.now();
  }
}

function listen() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("deviceorientation", onOrientation);
  window.addEventListener("devicemotion", onMotion);
}

/** True when the browser needs a tap before it will share motion (iOS Safari). */
export function motionNeedsPermission(): boolean {
  if (typeof window === "undefined" || listening) return false;
  return typeof (globalThis.DeviceOrientationEvent as unknown as PermissionEvent | undefined)?.requestPermission === "function";
}

/** Start listening. On iOS this must run inside a tap. */
export async function enableMotion(): Promise<boolean> {
  const asks = [globalThis.DeviceOrientationEvent, globalThis.DeviceMotionEvent] as unknown as (PermissionEvent | undefined)[];
  for (const ev of asks) {
    if (typeof ev?.requestPermission === "function") {
      try {
        if ((await ev.requestPermission()) !== "granted") return false;
      } catch {
        return false;
      }
    }
  }
  listen();
  return true;
}

/** Called each frame: shake energy fades out shortly after the movement stops. */
export function readMotion(): { tilt: [number, number]; shake: number } {
  if (!listening && !motionNeedsPermission()) listen();
  if (shake > 0 && performance.now() - lastShakeAt > 60) shake *= 0.9;
  if (shake < 0.01) shake = 0;
  return { tilt, shake };
}

export const usesMotion = (src: string) => /\b(tilt|shake)\b/.test(src);
