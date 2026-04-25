import { StreamLanguage, type StringStream } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

const KEYWORDS = new Set([
  'abs',
  'acos',
  'aj',
  'all',
  'and',
  'any',
  'asc',
  'asin',
  'atan',
  'attr',
  'avg',
  'avgs',
  'bin',
  'binr',
  'ceiling',
  'cols',
  'count',
  'cross',
  'cut',
  'deltas',
  'desc',
  'dev',
  'differ',
  'distinct',
  'div',
  'each',
  'ej',
  'enlist',
  'eval',
  'except',
  'exec',
  'exit',
  'exp',
  'fills',
  'first',
  'flip',
  'floor',
  'get',
  'group',
  'iasc',
  'idesc',
  'if',
  'ij',
  'in',
  'insert',
  'inter',
  'inv',
  'key',
  'keys',
  'last',
  'like',
  'lj',
  'log',
  'lower',
  'max',
  'maxs',
  'min',
  'mins',
  'mod',
  'neg',
  'next',
  'not',
  'null',
  'or',
  'over',
  'parse',
  'peach',
  'pj',
  'prd',
  'prds',
  'prev',
  'prior',
  'rand',
  'rank',
  'ratios',
  'raze',
  'read0',
  'read1',
  'reciprocal',
  'reverse',
  'rotate',
  'scan',
  'select',
  'set',
  'show',
  'sin',
  'sqrt',
  'string',
  'sublist',
  'sum',
  'sums',
  'sv',
  'system',
  'tables',
  'tan',
  'til',
  'trim',
  'type',
  'uj',
  'union',
  'update',
  'upper',
  'upsert',
  'value',
  'var',
  'views',
  'vs',
  'where',
  'while',
  'within',
  'xbar',
  'xcol',
  'xcols',
  'xkey',
  'xlog',
]);

export const qHighlightStyle = {
  keyword: t.keyword,
  atom: t.atom,
  variableName: t.variableName,
  number: t.number,
  string: t.string,
  comment: t.comment,
  operator: t.operator,
  bracket: t.bracket,
};

type QState = {
  string: boolean;
};

export const qLanguage = StreamLanguage.define<QState>({
  name: 'q',
  startState: () => ({ string: false }),
  token(stream: StringStream, state: QState) {
    if (state.string) {
      let escaped = false;
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === '"' && !escaped) {
          state.string = false;
          break;
        }
        escaped = ch === '\\' && !escaped;
        if (ch !== '\\') escaped = false;
      }
      return 'string';
    }

    if (stream.eatSpace()) return null;

    if (stream.peek() === '/') {
      const prev = stream.pos === 0 ? '' : stream.string[stream.pos - 1];
      const next = stream.string[stream.pos + 1] ?? '';
      if (stream.pos === 0 || prev === ';' || /\s/.test(prev)) {
        if (next !== ':') {
          stream.skipToEnd();
          return 'comment';
        }
      }
    }

    if (stream.peek() === '"') {
      stream.next();
      state.string = true;
      return 'string';
    }

    if (stream.match(/`[A-Za-z0-9_.]*/)) return 'atom';
    if (stream.match(/\d{4}\.\d{2}\.\d{2}/)) return 'number';
    if (stream.match(/\d{2}:\d{2}:\d{2}(\.\d{1,9})?/)) return 'number';
    if (stream.match(/0[NWwn]|-0[Ww]|\d+(\.\d+)?([eE][-+]?\d+)?[fij]?/)) return 'number';

    if (stream.match(/[{}()[\]]/)) return 'bracket';
    if (stream.match(/[_=><!~?:&|+\-*\/^%@,;'\\.]+/)) return 'operator';

    const word = stream.match(/[A-Za-z_.][A-Za-z0-9_.]*/);
    if (word && word !== true) return KEYWORDS.has(word[0]) ? 'keyword' : 'variableName';

    stream.next();
    return null;
  },
});
