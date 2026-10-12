export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Pixels to add to `box` so it sits inside `bounds`, with a margin.
 *  A box already inside does not move. A box larger than the bounds sticks to the top-left margin. */
export function nudgeInto(box: Box, bounds: Bounds, margin = 8): [number, number] {
  const minL = bounds.left + margin;
  const maxL = Math.max(minL, bounds.right - margin - box.width);
  const minT = bounds.top + margin;
  const maxT = Math.max(minT, bounds.bottom - margin - box.height);
  const left = Math.min(maxL, Math.max(minL, box.left));
  const top = Math.min(maxT, Math.max(minT, box.top));
  return [left - box.left, top - box.top];
}
