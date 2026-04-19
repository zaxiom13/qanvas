export type CopySegment = { kind: 'text'; value: string } | { kind: 'code'; value: string };

/**
 * Splits a tagline on single-backtick code spans so consumers can render
 * them as `<code>` elements without pulling in a full markdown renderer.
 * Handles backslash-escaped backticks (e.g. `` `input\`mouseButtons` ``).
 */
export function parseInlineCode(source: string): CopySegment[] {
  const segments: CopySegment[] = [];
  let buffer = '';
  let inCode = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '\\' && source[i + 1] === '`') {
      buffer += '`';
      i += 1;
      continue;
    }
    if (ch === '`') {
      if (buffer.length > 0) {
        segments.push({ kind: inCode ? 'code' : 'text', value: buffer });
        buffer = '';
      }
      inCode = !inCode;
      continue;
    }
    buffer += ch;
  }
  if (buffer.length > 0) {
    segments.push({ kind: inCode ? 'code' : 'text', value: buffer });
  }
  return segments;
}
