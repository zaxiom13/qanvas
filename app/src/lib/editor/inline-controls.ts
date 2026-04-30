export type InlineControlLiteral = ColorInlineControlLiteral;

export type ColorInlineControlLiteral = {
  kind: 'color';
  raw: string;
  startColumn: number;
  endColumn: number;
  value: string;
};

const HEX_COLOR_PATTERN = /0x[0-9a-fA-F]{6}\b/g;

export function findInlineControlLiteral(lineText: string, column: number): InlineControlLiteral | null {
  if (/^\s*\//.test(lineText)) {
    return null;
  }

  const columnIndex = Math.max(0, column - 1);
  const colorMatches = collectMatches(lineText, HEX_COLOR_PATTERN, createColorLiteral);

  for (const literal of colorMatches) {
    const startIndex = literal.startColumn - 1;
    const endIndex = literal.endColumn - 1;
    if (columnIndex >= startIndex && columnIndex < endIndex) {
      return literal;
    }
  }

  return null;
}

export function formatInlineControlValue(literal: InlineControlLiteral, nextValue: number | string) {
  const value = typeof nextValue === 'string' ? nextValue : String(nextValue);
  const hex = value.startsWith('#') ? value.slice(1) : value;
  return `0x${hex.slice(0, 6).toUpperCase()}`;
}

function collectMatches<T extends InlineControlLiteral>(
  lineText: string,
  pattern: RegExp,
  builder: (raw: string, startIndex: number, lineText: string) => T | null,
  existingMatches: InlineControlLiteral[] = []
) {
  const matches: T[] = [];
  pattern.lastIndex = 0;

  for (const match of lineText.matchAll(pattern)) {
    const raw = match[0];
    const startIndex = match.index ?? 0;
    const endIndex = startIndex + raw.length;

    if (isIndexInsideString(lineText, startIndex)) continue;
    if (!hasLiteralBoundary(lineText, startIndex, endIndex)) continue;
    if (existingMatches.some((entry) => overlaps(startIndex, endIndex, entry.startColumn - 1, entry.endColumn - 1))) continue;

    const literal = builder(raw, startIndex, lineText);
    if (literal) {
      matches.push(literal);
    }
  }

  return matches;
}

function createColorLiteral(raw: string, startIndex: number): ColorInlineControlLiteral {
  return {
    kind: 'color',
    raw,
    startColumn: startIndex + 1,
    endColumn: startIndex + raw.length + 1,
    value: `#${raw.slice(2).toLowerCase()}`,
  };
}

function hasLiteralBoundary(lineText: string, startIndex: number, endIndex: number) {
  const prev = lineText[startIndex - 1];
  const next = lineText[endIndex];
  return !isLiteralNeighbor(prev) && !isLiteralNeighbor(next);
}

function isLiteralNeighbor(char: string | undefined) {
  return typeof char === 'string' && /[A-Za-z0-9_.`"]/.test(char);
}

function isIndexInsideString(lineText: string, index: number) {
  let inString = false;

  for (let cursor = 0; cursor < index; cursor += 1) {
    if (lineText[cursor] === '"') {
      inString = !inString;
    }
  }

  return inString;
}

function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}
