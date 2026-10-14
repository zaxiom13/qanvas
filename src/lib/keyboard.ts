export interface ViewportSlice {
  height: number;
  offsetTop: number;
  scale: number;
}

export interface ShellFrame {
  height: number;
  offsetTop: number;
}

/**
 * The frame the app shell should fill.
 *
 * `100dvh` does not shrink when the on-screen keyboard is open: the dynamic
 * viewport excludes the keyboard, whether the browser overlays it or resizes
 * the layout viewport (`interactive-widget=resizes-content`). The visual
 * viewport does shrink. Pinch-zoom (scale above 1) returns null so the shell
 * stays on `100dvh` instead of tracking a panned slice.
 */
export function shellFrame(v: ViewportSlice): ShellFrame | null {
  if (!(v.scale > 0) || v.scale > 1.01) return null;
  if (!Number.isFinite(v.height) || v.height < 1) return null;
  const offsetTop = Number.isFinite(v.offsetTop) && v.offsetTop > 0.5 ? Math.round(v.offsetTop) : 0;
  return { height: Math.round(v.height), offsetTop };
}
