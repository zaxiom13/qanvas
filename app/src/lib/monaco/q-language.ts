import type * as Monaco from 'monaco-editor';
import { KDBLex } from '@qpad/language';
import { QANVAS_COLORS } from '$lib/runtime/compiled-runtime-helpers';

const registeredMonacoInstances = new WeakSet<object>();

const Q_KEYWORDS = [
  'select',
  'from',
  'where',
  'by',
  'update',
  'delete',
  'exec',
  'insert',
  'upsert',
  'each',
  'over',
  'scan',
  'prior',
  'flip',
  'enlist',
  'count',
  'first',
  'last',
  'avg',
  'sum',
  'min',
  'max',
  'all',
  'any',
  'not',
  'neg',
  'abs',
  'sqrt',
  'exp',
  'log',
  'sin',
  'cos',
  'tan',
  'string',
  'value',
  'key',
  'type',
  'null',
  'inf',
  'asc',
  'desc',
  'iasc',
  'idesc',
  'distinct',
  'group',
  'ungroup',
  'cols',
  'meta',
  'tables',
  'views',
  'load',
  'save',
  'get',
  'set',
  'til',
  'do',
  'while',
  'if',
  'and',
  'or',
  'like',
  'ss',
  'sv',
  'vs',
  'in',
  'within',
  'bin',
  'binr',
  'asof',
  'aj',
  'aj0',
  'lj',
  'lj0',
  'ij',
  'ij0',
  'pj',
  'uj',
  'wj',
  'wj1',
  'fby',
  'xasc',
  'xdesc',
  'xgroup',
  'xcols',
  'xcept',
  'inter',
  'union',
  'diff',
  'except',
];

const Q_BUILTIN_FUNCTIONS = [
  'neg',
  'not',
  'null',
  'string',
  'reciprocal',
  'floor',
  'ceiling',
  'signum',
  'mod',
  'xbar',
  'xlog',
  'and',
  'or',
  'each',
  'scan',
  'over',
  'prior',
  'mmu',
  'lsq',
  'inv',
  'md5',
  'ltime',
  'gtime',
  'count',
  'first',
  'svar',
  'sdev',
  'scov',
  'med',
  'all',
  'any',
  'rand',
  'sums',
  'prds',
  'mins',
  'maxs',
  'fills',
  'deltas',
  'ratios',
  'avgs',
  'differ',
  'prev',
  'next',
  'rank',
  'reverse',
  'iasc',
  'idesc',
  'asc',
  'desc',
  'msum',
  'mcount',
  'mavg',
  'mdev',
  'xrank',
  'mmin',
  'mmax',
  'xprev',
  'rotate',
  'ema',
  'distinct',
  'group',
  'where',
  'flip',
  'type',
  'key',
  'til',
  'get',
  'value',
  'attr',
  'cut',
  'set',
  'upsert',
  'raze',
  'union',
  'inter',
  'except',
  'cross',
  'sv',
  'vs',
  'sublist',
  'read0',
  'read1',
  'hclose',
  'hdel',
  'hsym',
  'hcount',
  'peach',
  'system',
  'ltrim',
  'rtrim',
  'trim',
  'lower',
  'upper',
  'ssr',
  'view',
  'tables',
  'views',
  'cols',
  'xcols',
  'keys',
  'xkey',
  'xcol',
  'xasc',
  'xdesc',
  'fkeys',
  'meta',
  'lj',
  'ljf',
  'aj',
  'aj0',
  'ajf',
  'ajf0',
  'ij',
  'ijf',
  'pj',
  'asof',
  'uj',
  'ujf',
  'ww',
  'wj',
  'wj1',
  'fby',
  'xgroup',
  'ungroup',
  'ej',
  'save',
  'load',
  'rsave',
  'rload',
  'dsave',
  'show',
  'csv',
  'parse',
  'eval',
  'reval',
  'use',
];

const Q_CANVAS_FUNCTIONS = [
  {
    label: 'background',
    detail: 'Qanvas draw helper',
    documentation: 'Fills the canvas background for the current frame.',
    insertText: 'background[${1:Color.CREAM}];',
  },
  {
    label: 'circle',
    detail: 'Qanvas draw helper',
    documentation: 'Draws circles from a q table of positions, radii, and styles.',
    insertText: 'circle[${1:data}];',
  },
  {
    label: 'rect',
    detail: 'Qanvas draw helper',
    documentation: 'Draws rectangles from a q table of positions, sizes, and styles.',
    insertText: 'rect[${1:data}];',
  },
  {
    label: 'pixel',
    detail: 'Qanvas draw helper',
    documentation: 'Draws single-pixel fills from a q table of positions and styles.',
    insertText: 'pixel[${1:data}];',
  },
  {
    label: 'line',
    detail: 'Qanvas draw helper',
    documentation: 'Draws lines from a q table with p and p2 coordinates.',
    insertText: 'line[${1:data}];',
  },
  {
    label: 'text',
    detail: 'Qanvas draw helper',
    documentation: 'Draws text labels from a q table of positions and strings.',
    insertText: 'text[${1:data}];',
  },
  {
    label: 'image',
    detail: 'Qanvas draw helper',
    documentation: 'Draws images from a q table of source paths and positions.',
    insertText: 'image[${1:data}];',
  },
  {
    label: 'generic',
    detail: 'Qanvas draw helper',
    documentation: 'Pushes already-shaped draw commands directly into the render queue.',
    insertText: 'generic[${1:cmds}];',
  },
  {
    label: 'push',
    detail: 'Qanvas transform helper',
    documentation: 'Saves the current canvas transform state.',
    insertText: 'push[];',
  },
  {
    label: 'pop',
    detail: 'Qanvas transform helper',
    documentation: 'Restores the previous canvas transform state.',
    insertText: 'pop[];',
  },
  {
    label: 'translate',
    detail: 'Qanvas transform helper',
    documentation: 'Translates the drawing origin by x and y.',
    insertText: 'translate[${1:0 0}];',
  },
  {
    label: 'scale',
    detail: 'Qanvas transform helper',
    documentation: 'Scales the drawing space uniformly or per axis.',
    insertText: 'scale[${1:1}];',
  },
  {
    label: 'cursor',
    detail: 'Qanvas input helper',
    documentation: 'Sets the canvas cursor for the current frame.',
    insertText: 'cursor[${1:`crosshair}];',
  },
];

const Q_CONTEXT_SYMBOLS = [
  {
    label: 'setup',
    detail: 'Sketch lifecycle',
    documentation: 'Runs once when the sketch starts and returns the initial config/state.',
    insertText: 'setup:{\n  `size`bg!(${1:800 600};${2:Color.CREAM})\n}',
  },
  {
    label: 'draw',
    detail: 'Sketch lifecycle',
    documentation: 'Runs every frame and must return the next state.',
    insertText:
      'draw:{[state;frameInfo;input;canvas]\n  ${1:background[Color.CREAM];}\n  ${2:state}\n}',
  },
  {
    label: 'state',
    detail: 'draw arg',
    documentation: 'The current sketch state that draw should evolve and return.',
    insertText: 'state',
  },
  {
    label: 'frameInfo',
    detail: 'draw arg',
    documentation: 'Per-frame timing data with frameNum, time, and dt.',
    insertText: 'frameInfo',
  },
  {
    label: 'input',
    detail: 'draw arg',
    documentation: 'Current mouse, keyboard, and scroll input for this frame.',
    insertText: 'input',
  },
  {
    label: 'canvas',
    detail: 'draw arg',
    documentation: 'Canvas metadata including size and pixelRatio.',
    insertText: 'canvas',
  },
  {
    label: 'frameInfo`frameNum',
    detail: 'frame field',
    documentation: 'The zero-based frame counter.',
    insertText: 'frameInfo`frameNum',
  },
  {
    label: 'frameInfo`time',
    detail: 'frame field',
    documentation: 'Elapsed time in milliseconds.',
    insertText: 'frameInfo`time',
  },
  {
    label: 'frameInfo`dt',
    detail: 'frame field',
    documentation: 'Delta time for the current frame.',
    insertText: 'frameInfo`dt',
  },
  {
    label: 'input`mouse',
    detail: 'input field',
    documentation: 'Mouse position as x y.',
    insertText: 'input`mouse',
  },
  {
    label: 'input`mouseButtons',
    detail: 'input field',
    documentation: 'Mouse button state for left, middle, and right.',
    insertText: 'input`mouseButtons',
  },
  {
    label: 'input`scroll',
    detail: 'input field',
    documentation: 'Current scroll delta.',
    insertText: 'input`scroll',
  },
  {
    label: 'input`key',
    detail: 'input field',
    documentation: 'Most recent key pressed.',
    insertText: 'input`key',
  },
  {
    label: 'input`keys',
    detail: 'input field',
    documentation: 'List of currently pressed keys.',
    insertText: 'input`keys',
  },
  {
    label: 'canvas`size',
    detail: 'canvas field',
    documentation: 'Canvas width and height.',
    insertText: 'canvas`size',
  },
  {
    label: 'canvas`pixelRatio',
    detail: 'canvas field',
    documentation: 'Device pixel ratio used by the renderer.',
    insertText: 'canvas`pixelRatio',
  },
];

const Q_COLOR_SYMBOLS = Object.entries(QANVAS_COLORS).map(([name, value]) => ({
  label: `Color.${name}`,
  detail: 'Qanvas color',
  documentation: `Built-in color constant, equivalent to 0x${value.toString(16).toUpperCase().padStart(6, '0')}.`,
  insertText: `Color.${name}`,
}));

const Q_QANVAS_IDENTIFIERS = [
  ...Q_CANVAS_FUNCTIONS.map((item) => item.label),
  ...Q_COLOR_SYMBOLS.map((item) => item.label),
  ...Q_CONTEXT_SYMBOLS.map((item) => item.label).filter((label) => /^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(label)),
];

const Q_KEYWORD_SET = new Set(Q_KEYWORDS.map((w) => w.toLowerCase()));
const Q_BUILTIN_SET = new Set(Q_BUILTIN_FUNCTIONS.map((w) => w.toLowerCase()));
const Q_QANVAS_SET = new Set(Q_QANVAS_IDENTIFIERS.map((w) => w.toLowerCase()));

/**
 * Classify a q identifier token the same way as the desktop Monarch grammar
 * (qanvas API / colors → builtins → keywords → default identifier).
 */
export function classifyMobileQIdent(raw: string): 'qanvas' | 'builtin' | 'keyword' | 'identifier' {
  if (!/^[a-zA-Z_.][a-zA-Z0-9_.]*$/.test(raw)) return 'identifier';
  const lower = raw.toLowerCase();
  const leaf = raw.includes('.') ? raw.slice(raw.lastIndexOf('.') + 1).toLowerCase() : lower;

  if (Q_QANVAS_SET.has(lower)) return 'qanvas';
  // Same order as desktop Monarch: builtins before keywords (many verbs appear in both lists).
  if (Q_BUILTIN_SET.has(lower) || Q_BUILTIN_SET.has(leaf)) return 'builtin';
  if (Q_KEYWORD_SET.has(lower) || Q_KEYWORD_SET.has(leaf)) return 'keyword';
  return 'identifier';
}

const Q_SLASH_SNIPPETS = [
  {
    label: '/sketch',
    detail: 'Snippet',
    documentation: 'Creates a complete setup/draw sketch scaffold.',
    insertText:
      'setup:{\n  `size`bg!(${1:800 600};${2:Color.CREAM})\n}\n\ndraw:{[state;frameInfo;input;canvas]\n  background[${2:Color.CREAM}];\n  ${3:state}\n}\n',
  },
  {
    label: '/setup',
    detail: 'Snippet',
    documentation: 'Creates a setup function scaffold.',
    insertText: 'setup:{\n  `size`bg!(${1:800 600};${2:Color.CREAM})\n}',
  },
  {
    label: '/draw',
    detail: 'Snippet',
    documentation: 'Creates a draw function scaffold.',
    insertText:
      'draw:{[state;frameInfo;input;canvas]\n  ${1:background[Color.CREAM];}\n  ${2:state}\n}',
  },
  {
    label: '/function',
    detail: 'Snippet',
    documentation: 'Creates a niladic (zero-argument) function in q style: name:{[] …}.',
    insertText: '${1:fn}:{[]\n  ${2:1+1}\n}',
  },
  {
    label: '/background',
    detail: 'Snippet',
    documentation: 'Inserts a background command.',
    insertText: 'background[${1:Color.CREAM}];',
  },
  {
    label: '/circle',
    detail: 'Snippet',
    documentation: 'Inserts a circle command scaffold.',
    insertText:
      'circle[([]\n  p:enlist ${1:0.5*canvas`size};\n  r:enlist ${2:44};\n  fill:enlist ${3:Color.BLUE};\n  alpha:enlist ${4:0.92}\n)];',
  },
  {
    label: '/rect',
    detail: 'Snippet',
    documentation: 'Inserts a rectangle command scaffold.',
    insertText:
      'rect[([]\n  p:enlist ${1:0 0};\n  s:enlist ${2:120 80};\n  fill:enlist ${3:Color.GOLD};\n  alpha:enlist ${4:1}\n)];',
  },
  {
    label: '/pixel',
    detail: 'Snippet',
    documentation: 'Inserts a pixel command scaffold.',
    insertText:
      'pixel[([]\n  p:enlist ${1:0 0};\n  fill:enlist ${2:Color.BLUE};\n  alpha:enlist ${3:1}\n)];',
  },
  {
    label: '/line',
    detail: 'Snippet',
    documentation: 'Inserts a line command scaffold.',
    insertText:
      'line[([]\n  p:enlist ${1:0 0};\n  p2:enlist ${2:100 100};\n  stroke:enlist ${3:Color.INK};\n  width:enlist ${4:2}\n)];',
  },
  {
    label: '/text',
    detail: 'Snippet',
    documentation: 'Inserts a text command scaffold.',
    insertText:
      'text[([]\n  p:enlist ${1:40 40};\n  text:enlist ${2:"hello"};\n  fill:enlist ${3:Color.INK};\n  alpha:enlist ${4:1}\n)];',
  },
  {
    label: '/image',
    detail: 'Snippet',
    documentation: 'Inserts an image command scaffold.',
    insertText:
      'image[([]\n  src:enlist ${1:"assets/example.png"};\n  p:enlist ${2:0 0};\n  s:enlist ${3:128 128};\n  alpha:enlist ${4:1}\n)];',
  },
  {
    label: '/translate',
    detail: 'Snippet',
    documentation: 'Inserts a translate transform command.',
    insertText: 'translate[${1:0 0}];',
  },
  {
    label: '/scale',
    detail: 'Snippet',
    documentation: 'Inserts a scale transform command.',
    insertText: 'scale[${1:1}];',
  },
  {
    label: '/pushpop',
    detail: 'Snippet',
    documentation: 'Wraps drawing commands in push/pop.',
    insertText: 'push[];\n${1:/ drawing commands}\npop[];',
  },
];

function buildWordBoundaryPattern(words: string[]) {
  return new RegExp(`\\b(${words.join('|')})\\b`);
}

function translateKdbLexToken(token: string) {
  switch (token) {
    case 'variable':
      return 'identifier';
    case 'delimiter':
      return 'operator';
    default:
      return token;
  }
}

function translateKdbLexRule(rule: unknown): Monaco.languages.IMonarchLanguageRule {
  if (!Array.isArray(rule)) {
    return rule as Monaco.languages.IMonarchLanguageRule;
  }

  const [pattern, action] = rule;
  if (typeof action === 'string') {
    return [pattern, translateKdbLexToken(action)] as Monaco.languages.IMonarchLanguageRule;
  }

  if (action && typeof action === 'object' && 'cases' in action) {
    const cases = Object.fromEntries(
      Object.entries(action.cases as Record<string, string>).map(([key, value]) => [key, translateKdbLexToken(value)])
    );
    return [pattern, { ...action, cases }] as Monaco.languages.IMonarchLanguageRule;
  }

  return rule as Monaco.languages.IMonarchLanguageRule;
}

function buildMonacoKdbLexLanguage(): Monaco.languages.IMonarchLanguage {
  const canonicalRoot = KDBLex.tokenizer.root as readonly unknown[];
  const canonicalString = KDBLex.tokenizer.string as readonly unknown[];
  const identifierRule = canonicalRoot[0];
  const trailingRules = canonicalRoot.slice(1).map(translateKdbLexRule);

  return {
    ...KDBLex,
    qanvasIdentifiers: Q_QANVAS_IDENTIFIERS,
    builtinFunctions: Q_BUILTIN_FUNCTIONS,
    tokenizer: {
      root: [
        [
          (identifierRule as [RegExp])[0],
          {
            cases: {
              '@qanvasIdentifiers': 'qanvas',
              '@builtinFunctions': 'builtin',
              '@keywords': 'keyword',
              '@default': 'identifier',
            },
          },
        ],
        ...trailingRules,
      ] as Monaco.languages.IMonarchLanguageRule[],
      whitespace: [
        [/[ \t\r\n]+/, ''],
        [/\/(?=\s).*$/, 'comment'],
      ] as Monaco.languages.IMonarchLanguageRule[],
      string: canonicalString.map(translateKdbLexRule),
    },
  } as Monaco.languages.IMonarchLanguage;
}

function dedupeSuggestions<T extends { label: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.label)) return false;
    seen.add(item.label);
    return true;
  });
}

function getSlashSnippetRange(monaco: typeof Monaco, model: Monaco.editor.ITextModel, position: Monaco.Position) {
  const lineContent = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
  const match = lineContent.match(/\/[a-zA-Z]*$/);
  if (!match) {
    const word = model.getWordUntilPosition(position);
    return new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
  }

  return new monaco.Range(position.lineNumber, position.column - match[0].length, position.lineNumber, position.column);
}

function getColorCompletionRange(monaco: typeof Monaco, model: Monaco.editor.ITextModel, position: Monaco.Position, fallback: Monaco.Range) {
  const lineContent = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
  const match = lineContent.match(/Color\.[A-Z_]*$/);
  if (!match) return fallback;
  return new monaco.Range(position.lineNumber, position.column - match[0].length, position.lineNumber, position.column);
}

export function registerQLanguage(monaco: typeof Monaco) {
  if (registeredMonacoInstances.has(monaco)) return;
  registeredMonacoInstances.add(monaco);

  monaco.languages.register({ id: 'q' });
  monaco.languages.setLanguageConfiguration('q', {
    comments: {
      lineComment: '/',
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
  });

  monaco.languages.setMonarchTokensProvider('q', buildMonacoKdbLexLanguage());

  monaco.languages.registerCompletionItemProvider('q', {
    triggerCharacters: ['/', '\\', '`', '.'],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const wordRange = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
      const slashRange = getSlashSnippetRange(monaco, model, position);
      const colorRange = getColorCompletionRange(monaco, model, position, wordRange);

      const suggestions = dedupeSuggestions([
        ...Q_SLASH_SNIPPETS.map((item) => ({
          label: item.label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          detail: item.detail,
          documentation: { value: item.documentation },
          insertText: item.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          filterText: item.label,
          range: slashRange,
          sortText: `0_${item.label}`,
        })),
        ...Q_CANVAS_FUNCTIONS.map((item) => ({
          label: item.label,
          kind: monaco.languages.CompletionItemKind.Function,
          detail: item.detail,
          documentation: { value: item.documentation },
          insertText: item.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range: wordRange,
          sortText: `1_${item.label}`,
        })),
        ...Q_CONTEXT_SYMBOLS.map((item) => ({
          label: item.label,
          kind: monaco.languages.CompletionItemKind.Variable,
          detail: item.detail,
          documentation: { value: item.documentation },
          insertText: item.insertText,
          insertTextRules: item.insertText.includes('${')
            ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            : undefined,
          range: wordRange,
          sortText: `2_${item.label}`,
        })),
        ...Q_COLOR_SYMBOLS.map((item) => ({
          label: item.label,
          kind: monaco.languages.CompletionItemKind.Color,
          detail: item.detail,
          documentation: { value: item.documentation },
          insertText: item.insertText,
          range: colorRange,
          sortText: `2_color_${item.label}`,
        })),
        ...Q_BUILTIN_FUNCTIONS.map((label) => ({
          label,
          kind: monaco.languages.CompletionItemKind.Function,
          detail: 'q built-in',
          documentation: { value: 'Built-in q function.' },
          insertText: label,
          range: wordRange,
          sortText: `3_${label}`,
        })),
        ...Q_KEYWORDS.map((label) => ({
          label,
          kind: monaco.languages.CompletionItemKind.Keyword,
          detail: 'q keyword',
          documentation: { value: 'Core q keyword or query word.' },
          insertText: label,
          range: wordRange,
          sortText: `4_${label}`,
        })),
      ]);

      return { suggestions };
    },
  });

  monaco.editor.defineTheme('qanvas-warm', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: 'A89B8E', fontStyle: 'italic' },
      { token: 'qanvas', foreground: 'C06B2C' },
      { token: 'builtin', foreground: '2F7A6D' },
      { token: 'keyword', foreground: '7D4E2D' },
      { token: 'number', foreground: '5B6FE8' },
      { token: 'string', foreground: 'B35B3F' },
      { token: 'string.escape', foreground: 'B35B3F' },
      { token: 'string.invalid', foreground: 'C45C5C' },
      { token: 'symbol', foreground: '8B674B' },
      { token: 'variable', foreground: '2C2520' },
      { token: 'delimiter', foreground: '5C534C' },
      { token: 'date', foreground: '5B6FE8' },
      { token: 'time', foreground: '5B6FE8' },
      { token: 'type', foreground: '8B674B' },
    ],
    colors: {
      'editor.background': '#FFFDF9',
      'editor.foreground': '#2C2520',
      'editorLineNumber.foreground': '#B5A799',
      'editorLineNumber.activeForeground': '#7A6E62',
      'editorCursor.foreground': '#5B6FE8',
      'editor.selectionBackground': '#DDE2FF',
      'editor.inactiveSelectionBackground': '#EEE8DD',
      'editor.lineHighlightBackground': '#F7F1E9',
      'editorIndentGuide.background1': '#EAE0D2',
      'editorWhitespace.foreground': '#D6CABB',
      'editorWidget.background': '#FFFDF9',
      'editorWidget.border': '#E0D8CC',
      'scrollbarSlider.background': '#C9BDABAA',
      'scrollbarSlider.hoverBackground': '#B8AA96CC',
    },
  });
}
