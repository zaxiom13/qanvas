// Breakpoints for the phone layouts. CSS media queries and these predicates
// must stay in step: min/max are inclusive, matching matchMedia.

/** Portrait phones and other narrow windows. The stacked phone UI. */
export const NARROW_QUERY = "(max-width: 760px)";

/**
 * A short, wide window: a phone held sideways, wider than the portrait
 * breakpoint (for example 844×390). A short desktop window is wider than
 * 1024, and a tablet is taller than 500, so both stay on the desktop layout.
 */
export const PHONE_LANDSCAPE_QUERY = "(max-height: 500px) and (min-width: 761px) and (max-width: 1024px)";

export function isNarrow(width: number): boolean {
  return width <= 760;
}

export function isPhoneLandscape(width: number, height: number): boolean {
  return height <= 500 && width >= 761 && width <= 1024;
}
