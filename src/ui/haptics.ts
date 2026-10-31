// A small physical "click" when keys are pressed on phones that support vibration (Android).
// iPhones ignore it. People can switch it off; the choice is remembered.
const KEY = "qanvas:haptics";

let enabled = (() => {
  try {
    return localStorage.getItem(KEY) !== "false";
  } catch {
    return true;
  }
})();

export const hapticsOn = () => enabled;

export function setHaptics(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(KEY, String(on));
  } catch {
    /* storage unavailable */
  }
}

export function buzz(ms = 8) {
  if (!enabled || typeof navigator === "undefined") return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}

/** Every .btn press gives a tiny tick on touch screens. */
export function installKeyHaptics() {
  if (typeof window === "undefined" || !matchMedia("(pointer: coarse)").matches) return;
  window.addEventListener(
    "pointerdown",
    (e) => {
      const el = (e.target as HTMLElement | null)?.closest?.(".btn, nav.dock button, .rail button");
      if (el && !(el as HTMLButtonElement).disabled) buzz(6);
    },
    { passive: true },
  );
}
