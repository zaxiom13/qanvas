import { StreamLanguage, type StringStream } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { lexKdbLex, type KdbLexToken } from '@qpad/language';
import { classifyMobileQIdent } from '$lib/editor/q-language';

/** Maps CodeMirror stream token names → Lezer highlight tags (via tokenTable). */
export const qHighlightStyle = {
  keyword: t.keyword,
  builtin: t.standard(t.variableName),
  qanvas: t.special(t.variableName),
  identifier: t.variableName,
  symbol: t.atom,
  number: t.number,
  string: t.string,
  comment: t.comment,
  operator: t.operator,
  bracket: t.bracket,
};

type QStreamState = {
  /** Multi-line string: opened on a previous line without a closing `"` yet. */
  inString: boolean;
};

function mapLexToken(kind: KdbLexToken['kind'], value: string): string | null {
  switch (kind) {
    case 'whitespace':
    case 'newline':
    case 'eof':
      return null;
    case 'separator':
      return 'operator';
    case 'identifier':
      return classifyMobileQIdent(value);
    case 'symbol':
      return 'symbol';
    case 'bracket':
      return 'bracket';
    case 'operator':
      return 'operator';
    case 'date':
      return 'number';
    case 'number':
    case 'boolean':
    case 'boolvector':
      return 'number';
    case 'string':
      return 'string';
    case 'comment':
    case 'directive':
      return 'comment';
    default:
      return null;
  }
}

function stringLiteralStillOpen(value: string) {
  if (!value.length || value[0] !== '"') return false;
  let escaped = false;
  for (let i = 1; i < value.length; i += 1) {
    const ch = value[i]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') return false;
  }
  return true;
}

export const qLanguage = StreamLanguage.define<QStreamState>({
  name: 'q',
  startState: () => ({ inString: false }),
  copyState: (s) => ({ ...s }),
  tokenTable: qHighlightStyle,
  token(stream: StringStream, state: QStreamState) {
    const line = stream.string;

    if (state.inString) {
      stream.start = stream.pos;
      if (stream.eol()) {
        stream.skipToEnd();
        return 'string';
      }
      let escaped = false;
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === '"' && !escaped) {
          state.inString = false;
          break;
        }
        escaped = ch === '\\' && !escaped;
        if (ch !== '\\') escaped = false;
      }
      return 'string';
    }

    if (stream.eatSpace()) return null;

    const slice = line.slice(stream.pos);
    if (!slice.length) return null;

    if (slice[0] === '"') {
      stream.start = stream.pos;
      let escaped = false;
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === '"' && !escaped) break;
        escaped = ch === '\\' && !escaped;
        if (ch !== '\\') escaped = false;
      }
      const raw = line.slice(stream.start, stream.pos);
      if (stringLiteralStillOpen(raw)) state.inString = true;
      return 'string';
    }

    let tokens: KdbLexToken[];
    try {
      tokens = lexKdbLex(slice);
    } catch {
      stream.next();
      return null;
    }

    let i = 0;
    while (i < tokens.length) {
      const tok = tokens[i]!;
      i += 1;
      if (tok.kind === 'eof') break;
      if (tok.kind === 'whitespace' || tok.kind === 'newline') continue;

      const absStart = stream.pos + tok.start;
      const absEnd = stream.pos + tok.end;
      if (absEnd <= stream.pos) continue;

      stream.start = absStart;
      stream.pos = absEnd;

      if (tok.kind === 'string') {
        if (stringLiteralStillOpen(tok.value)) state.inString = true;
        return 'string';
      }

      return mapLexToken(tok.kind, tok.value);
    }

    stream.skipToEnd();
    return null;
  },
});
