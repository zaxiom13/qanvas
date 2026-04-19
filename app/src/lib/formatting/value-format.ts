// Uiua-inspired array grid formatter.
//
// Ported from uiua-lang/uiua `src/grid_fmt.rs` (MIT licensed). The parts we
// care about for Qanvas are:
//
//   - Rank 0 (scalar)       → bare value
//   - Rank 1 (list)         → `[1 2 3]` with column alignment when embedded
//   - Rank ≥ 2 uniform arr  → wrapped in `╭─ … ╯` corners with `╷` marks on
//                             the left for each extra rank beyond 1.
//   - Rank ≥ 3              → sub-blocks are stacked horizontally for odd
//                             ranks and vertically (with blank separators)
//                             for even ranks.
//
// Everything else (JSON objects, mixed/ragged arrays) falls back to a
// conservative bracketed/braced JSON-ish layout.

type JsonScalar = null | boolean | number | string;

const INDENT = '  ';

// Whitespace gap (spaces) to put between horizontally-joined sub-blocks for a
// given rank. Uiua uses `rank.div_ceil(div)` where `div = max_width > 10 ? 1 : 2`.
function horizontalGap(rank: number, maxWidth: number): number {
  const div = maxWidth > 10 ? 1 : 2;
  return Math.ceil(rank / div);
}

// Number of blank lines Uiua inserts between vertically-joined sub-blocks for
// an even-rank array: `(rank - 2) / 2` (integer).
function verticalGap(rank: number): number {
  return Math.max(0, Math.floor((rank - 2) / 2));
}

export class StructuredConsoleFormatter {
  private pendingLines: string[] | null = null;

  push(text: string): string[] {
    const trimmed = text.trim();

    if (this.pendingLines) {
      this.pendingLines.push(trimmed);
      if (!isBalancedJsonText(this.pendingLines.join('\n'))) {
        return [];
      }

      const joined = this.pendingLines.join('\n');
      this.pendingLines = null;
      return [formatConsoleJsonValue(joined) ?? joined];
    }

    if (isStructuredJsonStart(trimmed)) {
      if (!isBalancedJsonText(trimmed)) {
        this.pendingLines = [trimmed];
        return [];
      }
      return [formatConsoleJsonValue(trimmed) ?? text];
    }

    // Not JSON — attempt to detect a q-native rectangular array and upgrade
    // it to the Uiua-style grid. Falls back to raw text when the shape is
    // ambiguous (prose, tables with `|` dividers, etc.).
    const reformatted = formatQNativeStdoutBlock(text);
    if (reformatted !== null) {
      return [reformatted];
    }

    return [text];
  }

  flush(): string[] {
    if (!this.pendingLines) {
      return [];
    }

    const joined = this.pendingLines.join('\n');
    this.pendingLines = null;
    return [joined];
  }
}

export function formatDisplayValue(value: unknown): string {
  return formatValue(value, 0, true);
}

export function formatConsoleJsonValue(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) {
    return null;
  }

  try {
    return formatDisplayValue(JSON.parse(trimmed));
  } catch {
    return null;
  }
}

export function isStructuredJsonStart(text: string): boolean {
  return /^[\[{]/.test(text.trim());
}

export function isBalancedJsonText(text: string): boolean {
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (const char of text) {
    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (char === '\\') {
        escaping = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '[' || char === '{') {
      depth += 1;
    } else if (char === ']' || char === '}') {
      depth -= 1;
      if (depth < 0) {
        return false;
      }
    }
  }

  return depth === 0 && !inString && !escaping;
}

function formatValue(value: unknown, indentLevel: number, topLevel = false): string {
  if (Array.isArray(value)) {
    return formatArray(value, indentLevel, topLevel);
  }
  if (isPlainObject(value)) {
    return formatObject(value, indentLevel);
  }
  return formatScalar(value as JsonScalar);
}

function formatArray(value: unknown[], indentLevel: number, topLevel: boolean): string {
  const shape = getUniformScalarShape(value);
  if (shape) {
    return formatUniformArray(value, shape, topLevel, indentLevel);
  }

  if (value.length === 0) {
    return '[]';
  }

  const items = value.map((item) => formatValue(item, indentLevel + 1));
  const inline = `[${items.join(' ')}]`;
  if (items.every((item) => !item.includes('\n')) && inline.length <= 80) {
    return inline;
  }

  const indent = INDENT.repeat(indentLevel);
  const childIndent = INDENT.repeat(indentLevel + 1);
  return [
    '[',
    ...items.flatMap((item) => indentBlock(item, childIndent)),
    `${indent}]`,
  ].join('\n');
}

// -- Uiua-style grid formatting ---------------------------------------------

function formatUniformArray(
  value: unknown[],
  shape: number[],
  topLevel: boolean,
  indentLevel: number,
): string {
  const rank = shape.length;

  if (rank === 0) {
    return formatScalar(value as unknown as JsonScalar);
  }

  if (rank === 1) {
    const items = value.map((item) => formatScalar(item as JsonScalar));
    return `[${items.join(' ')}]`;
  }

  const lines = buildGridLines(value, shape);
  const framed = frameGrid(lines, rank);

  if (topLevel || indentLevel === 0) {
    return framed.join('\n');
  }
  const indent = INDENT.repeat(indentLevel);
  return framed.map((line) => `${indent}${line}`).join('\n');
}

// Build the inner character grid for a rank ≥ 2 uniform array, without
// surrounding corners. The grid is a list of equal-width text lines.
function buildGridLines(value: unknown[], shape: number[]): string[] {
  if (shape.length === 2) {
    return formatMatrixLines(value as JsonScalar[][]);
  }

  const rank = shape.length;
  const childShape = shape.slice(1);
  const childBlocks = (value as unknown[][]).map((child) =>
    buildGridLines(child, childShape),
  );

  if (rank % 2 === 1) {
    // Odd rank → concatenate sub-blocks horizontally.
    const maxWidth = Math.max(
      ...childBlocks.flatMap((block) => block.map((line) => line.length)),
      0,
    );
    return joinBlocksHorizontally(childBlocks, horizontalGap(rank, maxWidth));
  }
  // Even rank → stack sub-blocks vertically with `(rank-2)/2` blank lines.
  return joinBlocksVertically(childBlocks, verticalGap(rank));
}

// Surround a content grid with `╭─ … ╯` corners and `╷` markers.
//
// Matches `pad_grid_center(width + 4, max(height + 2, rank + 1), …)` followed
// by corner/marker mutation from Uiua's grid_fmt.rs.
function frameGrid(content: string[], rank: number): string[] {
  const normalized = normalizeWidth(content);
  const contentHeight = normalized.length;
  const contentWidth = normalized[0]?.length ?? 0;

  const targetHeight = Math.max(contentHeight + 2, rank + 1);
  const vertDiff = targetHeight - contentHeight;
  // Uiua: `post = diff / 2 (floor), pre = diff - post` → pre ≥ post.
  const vertPost = Math.floor(vertDiff / 2);
  const vertPre = vertDiff - vertPost;

  const paddedRows: string[] = [];
  for (let i = 0; i < vertPre; i += 1) paddedRows.push(' '.repeat(contentWidth));
  paddedRows.push(...normalized);
  for (let i = 0; i < vertPost; i += 1) paddedRows.push(' '.repeat(contentWidth));

  // Horizontal: Uiua adds 2 spaces on each side (ElemAlign::None centering
  // with diff = 4).
  const framed = paddedRows.map((row) => `  ${row}  `);

  // Mutate corner characters.
  framed[0] = replaceChar(framed[0], 0, '╭');
  framed[0] = replaceChar(framed[0], 1, '─');

  for (let i = 0; i < rank - 1; i += 1) {
    const rowIdx = i + 1;
    if (rowIdx >= framed.length) break;
    framed[rowIdx] = replaceChar(framed[rowIdx], 0, '╷');
  }

  const last = framed.length - 1;
  const lastRow = framed[last];
  framed[last] = replaceChar(lastRow, lastRow.length - 1, '╯');

  // Strip trailing whitespace for cleaner display; the corner glyph on the
  // last row and the `╷` markers on the left are preserved.
  return framed.map((line) => line.replace(/[ \t]+$/, ''));
}

function replaceChar(line: string, index: number, ch: string): string {
  if (index < 0 || index >= line.length) return line;
  return line.slice(0, index) + ch + line.slice(index + 1);
}

function normalizeWidth(lines: string[]): string[] {
  const width = Math.max(...lines.map((line) => line.length), 0);
  return lines.map((line) => line.padEnd(width, ' '));
}

function formatMatrixLines(rows: JsonScalar[][]): string[] {
  if (rows.length === 0) {
    return [''];
  }

  const textRows = rows.map((row) => row.map((item) => formatScalar(item)));
  const columnCount = textRows[0]?.length ?? 0;
  const widths = Array.from({ length: columnCount }, (_unused, columnIndex) =>
    Math.max(...textRows.map((row) => row[columnIndex]?.length ?? 0)),
  );
  const numericColumns = Array.from({ length: columnCount }, (_unused, columnIndex) =>
    rows.every((row) => typeof row[columnIndex] === 'number'),
  );

  return textRows.map((row) =>
    row
      .map((cell, columnIndex) => {
        const width = widths[columnIndex] ?? cell.length;
        return numericColumns[columnIndex] ? cell.padStart(width) : cell.padEnd(width);
      })
      .join(' '),
  );
}

function joinBlocksHorizontally(blocks: string[][], gapWidth: number): string[] {
  const widths = blocks.map((block) => Math.max(...block.map((line) => line.length), 0));
  const height = Math.max(...blocks.map((block) => block.length), 0);
  const gap = ' '.repeat(Math.max(0, gapWidth));

  return Array.from({ length: height }, (_unused, rowIndex) =>
    blocks
      .map((block, blockIndex) => (block[rowIndex] ?? '').padEnd(widths[blockIndex] ?? 0))
      .join(gap),
  );
}

function joinBlocksVertically(blocks: string[][], blankLineCount: number): string[] {
  const separator = Array.from({ length: blankLineCount }, () => '');
  const widths = blocks.map((block) => Math.max(...block.map((line) => line.length), 0));
  const maxWidth = Math.max(...widths, 0);

  const result: string[] = [];
  blocks.forEach((block, blockIndex) => {
    if (blockIndex > 0) result.push(...separator);
    for (const line of block) {
      result.push(line.padEnd(maxWidth, ' '));
    }
  });
  return result;
}

// -- Objects ----------------------------------------------------------------

function formatObject(value: Record<string, unknown>, indentLevel: number): string {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return '{}';
  }

  const rendered = entries.map(([key, entryValue]) => ({
    key: JSON.stringify(key),
    value: formatValue(entryValue, indentLevel + 1),
  }));

  const inline = `{ ${rendered.map((entry) => `${entry.key}: ${entry.value}`).join(', ')} }`;
  if (rendered.every((entry) => !entry.value.includes('\n')) && inline.length <= 100) {
    return inline;
  }

  const indent = INDENT.repeat(indentLevel);
  const childIndent = INDENT.repeat(indentLevel + 1);
  const lines = ['{'];

  for (const entry of rendered) {
    if (entry.value.includes('\n')) {
      lines.push(`${childIndent}${entry.key}:`);
      lines.push(...indentBlock(entry.value, `${childIndent}${INDENT}`));
    } else {
      lines.push(`${childIndent}${entry.key}: ${entry.value}`);
    }
  }

  lines.push(`${indent}}`);
  return lines.join('\n');
}

function indentBlock(text: string, indent: string): string[] {
  return text.split('\n').map((line) => `${indent}${line}`);
}

function formatScalar(value: JsonScalar): string {
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'NaN';
    if (!Number.isFinite(value)) return value > 0 ? '∞' : '-∞';
    if (Object.is(value, -0)) return '-0';
    return String(value);
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  return String(value);
}

function getUniformScalarShape(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    return isScalar(value) ? [] : null;
  }

  if (value.length === 0) {
    return [0];
  }

  const childShapes = value.map((item) => getUniformScalarShape(item));
  if (childShapes.some((shape) => !shape)) {
    return null;
  }

  const [firstShape, ...restShapes] = childShapes as number[][];
  if (restShapes.some((shape) => !sameShape(shape, firstShape))) {
    return null;
  }

  return [value.length, ...firstShape];
}

function sameShape(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isScalar(value: unknown): value is JsonScalar {
  return value == null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
