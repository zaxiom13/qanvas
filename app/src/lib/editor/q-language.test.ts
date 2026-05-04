import { createSession, formatValue } from '../../../../packages/q-engine/src/index';
import { listBuiltins } from '@qpad/engine';
import { describe, expect, it } from 'vitest';
import { classifyMobileQIdent, Q_BUILTIN_FUNCTIONS, Q_CANVAS_FUNCTIONS, Q_NAMESPACE_SYMBOLS, Q_SLASH_SNIPPETS } from './q-language';

const BOOT_SOURCE = [
  '.qv.cmds:enlist 0N',
  '.qv.state:()',
  '.qv.config:()',
  'Color.INK:855327',
  'Color.NIGHT:329228',
  'Color.MIDNIGHT:724250',
  'Color.DEEP:528424',
  'Color.BLUE:5992424',
  'Color.SKY:8169215',
  'Color.GOLD:12883310',
  'Color.CORAL:14711378',
  'Color.RED:13723982',
  'Color.PURPLE:9202633',
  'Color.GREEN:5152658',
  'Color.CREAM:16051416',
  'Color.YELLOW:16769696',
  'Color.SOFT_YELLOW:16769720',
  'Color.LAVENDER:14989311',
  'Color.ORBIT:2500938',
  '.qv.append:{[cmd].qv.cmds,:enlist cmd;:cmd}',
  'background:{[fill].qv.append[`kind`fill!(`background;fill)]}',
  'circle:{[data].qv.append[`kind`data!(`circle;data)]}',
  'rect:{[data].qv.append[`kind`data!(`rect;data)]}',
  'triangle:{[data].qv.append[`kind`data!(`triangle;data)]}',
  'pixel:{[data].qv.append[`kind`data!(`pixel;data)]}',
  'line:{[data].qv.append[`kind`data!(`line;data)]}',
  'text:{[data].qv.append[`kind`data!(`text;data)]}',
  'image:{[data].qv.append[`kind`data!(`image;data)]}',
  'generic:{[cmds].qv.cmds,:$[0h=type cmds;cmds;enlist cmds];:cmds}',
  'push:{[].qv.append[enlist[`kind]!enlist `push]}',
  'pop:{[].qv.append[enlist[`kind]!enlist `pop]}',
  'translate:{[xy].qv.append[`kind`x`y!(`translate;first xy;last xy)]}',
  'scale:{[xy]if[1=count xy;xy:xy,xy];.qv.append[`kind`x`y!(`scale;first xy;last xy)]}',
  'cursor:{[name].qv.append[`kind`cursor!(`cursor;name)]}',
  '.qv.init:{.qv.cmds:enlist 0N;result:setup[];.qv.state:result;.qv.config:result;:result}',
  '.qv.frame:{[canvas].qv.cmds:enlist 0N;draw[();();();canvas];:1_.qv.cmds}',
].join(';\n');

const CANVAS = { size: [800, 600] };

function stripSnippetPlaceholders(source: string) {
  let stripped = source;

  for (let i = 0; i < 10; i += 1) {
    const next = stripped.replace(/\$\{\d+:([^{}]*)\}/g, '$1');
    if (next === stripped) return stripped;
    stripped = next;
  }

  return stripped;
}

function toQLiteral(value: unknown): string {
  if (value === null || value === undefined) return '()';
  if (typeof value === 'number') return Number.isFinite(value) ? `${value}` : '0n';
  if (typeof value === 'string') return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
  if (Array.isArray(value)) return value.length ? `(${value.map((entry) => toQLiteral(entry)).join(';')})` : '()';

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 1) {
    const [key, entry] = entries[0]!;
    return `(enlist \`${key})!enlist ${toQLiteral(entry)}`;
  }

  return `${entries.map(([key]) => `\`${key}`).join('')}!(${entries.map(([, entry]) => toQLiteral(entry)).join(';')})`;
}

function convertValue(value: any): unknown {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map((entry) => convertValue(entry));
  if (typeof value !== 'object') return value;

  switch (value.kind) {
    case 'number':
    case 'symbol':
    case 'string':
      return value.value;
    case 'list':
      return (value.items ?? []).map((entry: unknown) => convertValue(entry));
    case 'dictionary':
      return Object.fromEntries((value.keys ?? []).map((key: any, index: number) => [String(convertValue(key)), convertValue(value.values?.[index])]));
    case 'table':
      return convertTableRows(value);
    default:
      return value;
  }
}

function convertTableRows(value: any) {
  const columns = value.columns ?? {};
  const names = Object.keys(columns);
  const rowCount = names.length > 0 ? getColumnLength(columns[names[0]]) : 0;

  return Array.from({ length: rowCount }, (_, rowIndex) =>
    Object.fromEntries(names.map((name) => [name, getColumnItem(columns[name], rowIndex)]))
  );
}

function getColumnLength(value: any) {
  if (value?.kind === 'list' && Array.isArray(value.items)) return value.items.length;
  return Array.isArray(value) ? value.length : 0;
}

function getColumnItem(value: any, index: number) {
  if (value?.kind === 'list' && Array.isArray(value.items)) return convertValue(value.items[index]);
  return Array.isArray(value) ? convertValue(value[index]) : convertValue(value);
}

function renderSnippet(insertText: string) {
  const session = createSession();
  const source = stripSnippetPlaceholders(insertText);

  try {
    session.evaluate(BOOT_SOURCE);
  } catch (error) {
    throw new Error(`boot failed: ${(error as Error).message}`);
  }

  try {
    session.evaluate(`draw:{[state;frameInfo;input;canvas]\n${source}\n  state\n}`);
  } catch (error) {
    throw new Error(`draw definition failed: ${(error as Error).message}`);
  }

  try {
    return convertValue(session.evaluate(`.qv.frame[${toQLiteral(CANVAS)}]`).value) as Array<{ kind: string; data?: unknown[] }>;
  } catch (error) {
    throw new Error(`frame failed: ${(error as Error).message}`);
  }
}

function runCanvasExpression(source: string, setup = '', rootSetup = '') {
  const session = createSession();

  try {
    session.evaluate(BOOT_SOURCE);
    if (rootSetup) session.evaluate(rootSetup);
  } catch (error) {
    throw new Error(`boot failed: ${(error as Error).message}`);
  }

  try {
    session.evaluate([
      'draw:{[state;frameInfo;input;canvas]',
      ...(setup ? setup.split('\n').map((line) => `  ${line}`) : []),
      `  .qv.state:${source}`,
      '  .qv.state',
      '}',
    ].join('\n'));
  } catch (error) {
    throw new Error(`draw definition failed for ${source}: ${(error as Error).message}`);
  }

  try {
    session.evaluate(`.qv.frame[${toQLiteral(CANVAS)}]`);
    return formatValue(session.evaluate('.qv.state').value);
  } catch (error) {
    throw new Error(`frame failed for ${source}: ${(error as Error).message}`);
  }
}

describe('q editor language catalogs', () => {
  it('offers namespace completions for complex, .Q, and .z members', () => {
    const labels = new Set<string>(Q_NAMESPACE_SYMBOLS.map((item) => item.label));

    for (const label of ['.cx.mul', '.cx.new', '.cx.fromPolar', '.Q.fmt', '.Q.id', '.Q.opt', '.z.P', '.z.x']) {
      expect(labels.has(label)).toBe(true);
    }
  });

  it('classifies namespace members as builtins for highlighting', () => {
    expect(classifyMobileQIdent('.cx.mul')).toBe('builtin');
    expect(classifyMobileQIdent('.Q.fmt')).toBe('builtin');
    expect(classifyMobileQIdent('.z.P')).toBe('builtin');
  });

  it('offers and highlights every identifier-shaped engine builtin', () => {
    const builtins = listBuiltins();
    const expected = [
      ...builtins.monads,
      ...builtins.diads,
      ...builtins.triads,
      ...builtins.quads,
      'each',
    ].filter((name) => /^[a-zA-Z_.][a-zA-Z0-9_.]*$/.test(name));
    const completions = new Set(Q_BUILTIN_FUNCTIONS);

    expect(completions.has('wavg')).toBe(true);
    expect(classifyMobileQIdent('wavg')).toBe('builtin');
    for (const name of expected) {
      expect(completions.has(name), name).toBe(true);
      expect(classifyMobileQIdent(name), name).toBe('builtin');
    }
    for (const name of Q_BUILTIN_FUNCTIONS) {
      expect(expected.includes(name), name).toBe(true);
    }
    for (const pending of ['use']) {
      expect(completions.has(pending), pending).toBe(false);
    }
    for (const nonQKeyword of ['diff', 'xcept']) {
      expect(classifyMobileQIdent(nonQKeyword), nonQKeyword).toBe('identifier');
    }
    for (const nonQJoin of ['lj0', 'ij0']) {
      expect(classifyMobileQIdent(nonQJoin), nonQJoin).toBe('identifier');
    }
    expect(classifyMobileQIdent('fby')).toBe('builtin');
    expect(completions.has('fby')).toBe(true);
    expect(classifyMobileQIdent('csv')).toBe('keyword');
    expect(completions.has('csv')).toBe(false);
  });

  it('offers plural draw snippets with two prefilled rows', () => {
    const snippets = new Map<string, string>(Q_SLASH_SNIPPETS.map((item) => [item.label, item.insertText]));

    for (const label of ['/circles', '/rects', '/triangles', '/pixels', '/lines', '/texts', '/images']) {
      const insertText = snippets.get(label);

      expect(insertText).toBeTruthy();
      expect(insertText).toMatch(/\$\{\d+:/);
      expect(insertText).not.toContain('p:enlist');
    }
  });

  it('offers plain plural draw completions with two prefilled rows', () => {
    const completions = new Map<string, string>(Q_CANVAS_FUNCTIONS.map((item) => [item.label, item.insertText]));

    for (const label of ['circles', 'rects', 'triangles', 'pixels', 'lines', 'texts', 'images']) {
      const insertText = completions.get(label);

      expect(insertText).toBeTruthy();
      expect(insertText).toMatch(/\$\{\d+:/);
      expect(insertText).not.toContain('p:enlist');
    }
  });

  it('renders every plural draw primitive snippet as two rows', () => {
    const snippets = new Map<string, string>(Q_SLASH_SNIPPETS.map((item) => [item.label, item.insertText]));

    for (const [label, kind] of [
      ['/circles', 'circle'],
      ['/rects', 'rect'],
      ['/triangles', 'triangle'],
      ['/pixels', 'pixel'],
      ['/lines', 'line'],
      ['/texts', 'text'],
      ['/images', 'image'],
    ] as const) {
      let commands: Array<{ kind: string; data?: unknown[] }>;

      try {
        commands = renderSnippet(snippets.get(label)!);
      } catch (error) {
        throw new Error(`${label} failed to render: ${(error as Error).message}\n${stripSnippetPlaceholders(snippets.get(label)!)}`);
      }

      const command = commands.find((entry) => entry.kind === kind);

      expect(command, label).toBeTruthy();
      expect(command?.data, label).toHaveLength(2);
    }
  });

  it('offers generic slash snippets that render mixed ordered commands', () => {
    const snippets = new Map<string, string>(Q_SLASH_SNIPPETS.map((item) => [item.label, item.insertText]));

    for (const label of ['/generic', '/generics']) {
      const insertText = snippets.get(label);

      expect(insertText).toBeTruthy();
      const commands = renderSnippet(insertText!);

      expect(commands, label).toHaveLength(5);
      expect(commands.find((entry) => entry.kind === 'circle'), label).toBeTruthy();
    }
  });

  it('evaluates each-prior deltas inside canvas draw code', () => {
    const commands = renderSnippet([
      'xs:-\':[10 15 27 93]',
      'circle ([] x:xs; y:4#20; r:4#3; fill:4#Color.BLUE)',
    ].join('\n'));

    const circleCommand = commands.find((entry) => entry.kind === 'circle');

    expect(circleCommand?.data).toEqual([
      { x: 10, y: 20, r: 3, fill: 5992424 },
      { x: 5, y: 20, r: 3, fill: 5992424 },
      { x: 12, y: 20, r: 3, fill: 5992424 },
      { x: 66, y: 20, r: 3, fill: 5992424 },
    ]);
  });

  it('keeps engine parity expressions working inside canvas draw code', () => {
    for (const { source, expected, setup = '', rootSetup = '' } of [
      { source: '2+2  /I know this one', expected: '4\n' },
      { source: '3 /atom', expected: '3\n' },
      { source: 'med 3 1 4 2', expected: '2.5\n' },
      { source: 'med 1 0N 3', expected: '1f\n' },
      { source: 'med ([]a:10 -21 3;b:4 5 -6)', expected: 'a| 3\nb| -6\n' },
      { source: 'med `a`b!(10 -21 3;4 5 -6)', expected: '7 -8 -1.5\n' },
      { source: 'avg (1;0n;2;3)', expected: '1.5\n' },
      { source: 'avg (1 2;0N 4)', expected: '0n 3\n' },
      { source: 'avgs ([]a:10 21 3;b:4 5 6)', expected: 'a        b\n----------\n10       4\n15.5     4.5\n11.33333 5\n' },
      { source: 'sum (1 2;0N 4)', expected: '0N 6\n' },
      { source: 'sums 2 3 0N 7', expected: '2 5 5 12\n' },
      { source: 'sums ([]a:10 21 3;b:4 5 6)', expected: 'a  b\n----\n10 4\n31 9\n34 15\n' },
      { source: 'min (1 2;0N 4)', expected: '0N 2\n' },
      { source: 'max (1 2;0N 4)', expected: '1 4\n' },
      { source: 'mins 0N 5 0N 1 3', expected: '0W 5 5 1 1\n' },
      { source: 'maxs 0N 5 0N 1 3', expected: '-0W 5 5 5 5\n' },
      { source: 'maxs ([]a:10 21 3;b:4 5 6)', expected: 'a  b\n----\n10 4\n21 5\n21 6\n' },
      { source: 'null ([]a:1 0N 3;b:0n 2 0n;c:`a``c)', expected: 'a b c\n-----\n0 1 0\n1 0 1\n0 1 0\n' },
      { source: 'where all null ([] c1:`a`b`c; c2:0n 0n 0n; c3:10 0N 30)', expected: ',`c2\n' },
      { source: 'distinct ([]a:1 2 1;b:2 3 2;c:"aba")', expected: 'a b c\n-----\n1 2 a\n2 3 b\n' },
      { source: 'distinct "mississippi"', expected: '"misp"\n' },
      { source: '"a good time" union "was had by all"', expected: '"a godtimewshbyl"\n' },
      { source: '1 2 3 1 4 inter 4 1 4', expected: '1 1 4\n' },
      { source: '"mississippi" inter "sp"', expected: '"sssspp"\n' },
      { source: '([]a:`x`y`z`t;b:10 20 30 40) except ([]a:`y`t`x;b:50 40 10)', expected: 'a b\n---\ny 20\nz 30\n' },
      { source: 'asc `a`b`c!2 1 3', expected: 'b| 1\na| 2\nc| 3\n' },
      { source: 'idesc `a`c`b!1 2 3', expected: '`b`c`a\n' },
      { source: 'asc ([]a:4 3 4;b:`s`a`d)', expected: 'a b\n---\n3 a\n4 d\n4 s\n' },
      { source: 'desc ([]a:3 4 1;b:`a`d`s)', expected: 'a b\n---\n4 d\n3 a\n1 s\n' },
      { source: 'asc ([c1:`a`b]c2:2 1;c3:01b)', expected: 'c1| c2 c3\n--| -----\nb | 1  1\na | 2  0\n' },
      { source: 'count each group "mississippi"', expected: 'm| 1\ni| 4\ns| 4\np| 2\n' },
      { source: '(`a`b`c!1 2 3)^`b`c!0N 30', expected: 'a| 1\nb| 2\nc| 30\n' },
      { source: 'fills `x``y```z', expected: '`x`x`y`y`y`z\n' },
      { source: 'raze (1 2;enlist 3 4)', expected: '1\n2\n3 4\n' },
      { source: 'raze ([]a:1 2;b:3 4)', expected: 'a| 2\nb| 4\n' },
      { source: 'flip ([]a:1 2;b:3 4)', expected: 'a| 1 2\nb| 3 4\n' },
      { source: 'flip ("abc";"def")', expected: '"ad"\n"be"\n"cf"\n' },
      { source: '5#"abc"', expected: '"abcab"\n' },
      { source: '2 3#"abcdef"', expected: '"abc"\n"def"\n' },
      { source: '3#([]a:1 2;b:3 4)', expected: 'a b\n---\n1 3\n2 4\n1 3\n' },
      { source: '(`b)_(`a`b`c!10 20 30)', expected: 'a| 10\nc| 30\n' },
      { source: '0 2_"abcd"', expected: '"ab"\n"cd"\n' },
      { source: '2 cut 1 2 3 4 5', expected: '1 2\n3 4\n,5\n' },
      { source: 'reverse `a`b`c!10 20 30', expected: 'c| 30\nb| 20\na| 10\n' },
      { source: 'reverse ([]c1:`a`b`c;c2:10 20 30)', expected: 'c1 c2\n-----\nc  30\nb  20\na  10\n' },
      { source: 'first ([]a:1 2;b:3 4)', expected: 'a| 1\nb| 3\n' },
      { source: 'last ([]a:1 2;b:3 4)', expected: 'a| 2\nb| 4\n' },
      { source: 'count each `a`b`c!(1 2;3 4 5;"hello")', expected: 'a| 2\nb| 3\nc| 5\n' },
      { source: '2 mcount ([]a:10 21 3;b:4 5 6)', expected: 'a b\n---\n1 1\n2 2\n2 2\n' },
      { source: 'var (2 3;4 0N;1 7)', expected: '1.555556 4\n' },
      { source: 'dev (2 3;4 0N;1 7)', expected: '1.247219 2\n' },
      { source: '2 3 5 7 cov 4 3 0 2', expected: '-1.8125\n' },
      { source: '1000101000b cor 0010011001b', expected: '-0.08908708\n' },
      { source: '2 mdev ([]a:10 21 3;b:4 5 6)', expected: 'a   b\n-----\n0   0\n5.5 0.5\n9   0.5\n' },
      { source: '2 mavg 1 2 3 4', expected: '1 1.5 2.5 3.5\n' },
      { source: '2 mcount 1 2 3 4', expected: '1 2 2 2i\n' },
      { source: '2 msum 1 2 3 4', expected: '1 3 5 7\n' },
      { source: '2 mdev 1 2 3 4', expected: '0 0.5 0.5 0.5\n' },
      { source: '0 msum 10 20 30', expected: '0 0 0\n' },
      { source: '0 mavg 10 20 30', expected: '0n 0n 0n\n' },
      { source: '0 mcount 10 0N 30', expected: '0 0 0i\n' },
      { source: '0 mdev 10 20 30', expected: '0n 0n 0n\n' },
      { source: '0 mmin 10 20 30', expected: '10 20 30\n' },
      { source: '0 mmax 10 20 30', expected: '10 20 30\n' },
      { source: '-2 msum 10 20 30', expected: '0 0 0\n' },
      { source: '-2 mavg 10 20 30', expected: '0n 0n 0n\n' },
      { source: '-2 mcount 10 0N 30', expected: '0 0 0i\n' },
      { source: '-2 mdev 10 20 30', expected: '0n 0n 0n\n' },
      { source: '-2 mmin 10 20 30', expected: '10 20 30\n' },
      { source: '-2 mmax 10 20 30', expected: '10 20 30\n' },
      { source: 'prd 2 0N 4', expected: '8\n' },
      { source: 'prd each (2 3;4 5)', expected: '6 20\n' },
      { source: '2 0N 4 5 wavg 1 2 0N 8', expected: '6f\n' },
      { source: '(1 2;3 4) wavg (500 400;300 200)', expected: '350 266.6667\n' },
      { source: '1 2 wavg `a`b!(10 21 3;4 5 6)', expected: '6 10.33333 5\n' },
      { source: '`int$1.5 2.7', expected: '2 3i\n' },
      { source: '`int$-1.5 -2.7', expected: '-2 -3i\n' },
      { source: '`long$1.5 2.7', expected: '2 3\n' },
      { source: '`short$1.5 2.7', expected: '2 3h\n' },
      { source: '"m"$42 43', expected: '2003.07 2003.08m\n' },
      { source: '"t"$42 43', expected: '00:00:00.042 00:00:00.043\n' },
      { source: '(12h;"m";`date)$42 43 44', expected: '2000.01.01D00:00:00.000000042\n2003.08m\n2000.02.14\n' },
      { source: '"I"$("42";"43")', expected: '42 43i\n' },
      { source: '"S"$"hello world"', expected: '`hello world\n' },
      { source: '"D"$"2026.05.04"', expected: '2026.05.04\n' },
      { source: '"X"$("0a";"ff")', expected: '0x0aff\n' },
      { source: '-6h$"42"', expected: '42i\n' },
      { source: '(`year`mm`dd)$(2026.05.04;2026.05.04;2026.05.04)', expected: '2026 5 4i\n' },
      { source: '(`hh`uu`ss)$(12:34:56.789;12:34:56.789;12:34:56.789)', expected: '12 34 56i\n' },
      { source: 'where 0 2 3', expected: '1 1 2 2 2\n' },
      { source: 'where `a`b!2 0', expected: '`a`a\n' },
      { source: '10 20 30 40 where 1010b', expected: '10 30\n' },
      { source: '"abcd" where 1010b', expected: '"ac"\n' },
      { source: '.[+;2 3]', expected: '5\n' },
      { source: '.[+;"ab";`ouch]', expected: '`ouch\n' },
      { source: '.[count;"ab";{"Wrong ",x}]', expected: '"Wrong rank"\n' },
      { source: '.[(10 20;30 40);(::;1)]', expected: '20 40\n' },
      { source: '.[([]a:1 2;b:3 4);(::;`b)]', expected: '3 4\n' },
      { source: '@[2+;"42";`err]', expected: '`err\n' },
      { source: '@[1010b;where 1010b;not]', expected: '0000b\n' },
      { source: '@[1 2 3;1 2;:;99 100]', expected: '1 99 100\n' },
      { setup: 'x:1 2 3', source: '@[`x;1;:;99]', expected: '`x\n' },
      { setup: 'x:1 2 3;@[`x;1;:;99]', source: 'x', expected: '1 99 3\n' },
      { source: '@[`a`b!10 20;`b;+;5]', expected: 'a| 10\nb| 25\n' },
      { setup: 'd:`a`b!10 20;@[`d;`b;+;5]', source: 'd', expected: 'a| 10\nb| 25\n' },
      { source: '@[([]a:1 2;b:3 4);1;:;`a`b!99 100]', expected: 'a  b\n----\n1  3\n99 100\n' },
      { setup: 't:([]a:1 2;b:3 4)', source: '@[`t;1;:;`a`b!99 100]', expected: '`t\n' },
      { setup: 't:([]a:1 2;b:3 4);@[`t;1;:;`a`b!99 100]', source: 't', expected: 'a  b\n----\n1  3\n99 100\n' },
      { source: '.[1 2;();:;3 4 5]', expected: '3 4 5\n' },
      { source: '@[1 2;::;*;3 4]', expected: '3 8\n' },
      { source: '@[(1 2;4 5);::;,;3 6]', expected: '1 2 3\n4 5 6\n' },
      { source: '.[1 2 3;enlist 1;+;10]', expected: '1 12 3\n' },
      { source: '.[(1 2 3;4 5 6);(1;2);:;99]', expected: '1 2 3\n4 5 99\n' },
      { setup: 'x:(1 2 3;4 5 6)', source: '.[`x;(1;2);:;99]', expected: '`x\n' },
      { setup: 'x:(1 2 3;4 5 6);.[`x;(1;2);:;99]', source: 'x', expected: '1 2 3\n4 5 99\n' },
      { source: '.[([]a:1 2;b:3 4);(1;`b);:;99]', expected: 'a b\n---\n1 3\n2 99\n' },
      { setup: 't:([]a:1 2;b:3 4);.[`t;(1;`b);:;99]', source: 't', expected: 'a b\n---\n1 3\n2 99\n' },
      { setup: 'f:{$[x<2;1;x*.z.s x-1]}', source: 'f 5', expected: '120\n' },
      { source: 'meta ([]a:1 2;b:`x`y;c:1.5 2.5)', expected: 'c| t f a\n-| -----\na| j\nb| s\nc| f\n' },
      { source: 'key ([k:`x`y]a:1 2;b:3 4)', expected: 'k\n-\nx\ny\n' },
      { setup: 'D:`q`w`e!(1 2;3 4;5 6)', source: 'key `D', expected: '`q`w`e\n' },
      { setup: 'a:42', source: 'key `a', expected: '`a\n' },
      { setup: 'T:([]a:1 2;b:3 4)', source: 'key `T', expected: '`T\n' },
      { setup: 'KT:([k:`x`y]a:1 2)', source: 'key `KT', expected: 'k\n-\nx\ny\n' },
      { source: 'key 10', expected: '0 1 2 3 4 5 6 7 8 9\n' },
      { source: 'key 0', expected: '`long$()\n' },
      { source: 'key each ("abc";101b;1 2 3h;1 2 3i;1 2 3;1 2 3f)', expected: '`char`boolean`short`int`long`float\n' },
      { source: 'key 0#5', expected: '`long\n' },
      { source: 'key 0#5i', expected: '`int\n' },
      { source: 'key 0#5h', expected: '`short\n' },
      { source: 'key 0#`a', expected: '`symbol\n' },
      { source: 'key 0#`real$1', expected: '`real\n' },
      { source: 'key 0#2026.05.04', expected: '`date\n' },
      { setup: 't:([]a:1 2;b:3 4)', source: 'cols `t', expected: '`a`b\n' },
      { setup: 'kt:([k:`x`y]a:1 2;b:3 4)', source: 'cols `kt', expected: '`k`a`b\n' },
      { source: 'keys ([]a:1 2;b:3 4)', expected: '`symbol$()\n' },
      { source: 'keys ([k:`x`y]a:1 2;b:3 4)', expected: ',`k\n' },
      { setup: 't:([]a:1 2;b:3 4)', source: 'keys `t', expected: '`symbol$()\n' },
      { setup: 'kt:([k:`x`y]a:1 2)', source: 'keys `kt', expected: ',`k\n' },
      { setup: 't:([]a:1 2;b:3 4)', source: 'meta `t', expected: 'c| t f a\n-| -----\na| j\nb| j\n' },
      { setup: 'kt:([k:`x`y]a:1 2)', source: 'meta `kt', expected: 'c| t f a\n-| -----\nk| s\na| j\n' },
      { source: '`a`b xkey ([]a:1 2;b:3 4;c:5 6)', expected: 'a b| c\n---| -\n1 3| 5\n2 4| 6\n' },
      { source: 'key `a`b xkey ([]a:1 2;b:3 4;c:5 6)', expected: 'a b\n---\n1 3\n2 4\n' },
      { source: 'keys `a`b xkey ([]a:1 2;b:3 4;c:5 6)', expected: '`a`b\n' },
      { setup: 't:([]sym:`a`b;v:10 20)', source: '`sym xkey `t', expected: '`t\n' },
      { setup: 't:([]sym:`a`b;v:10 20);`sym xkey `t', source: 'keys t', expected: ',`sym\n' },
      { setup: 't:([]sym:`a`b;v:10 20);`sym xkey `t', source: 't', expected: 'sym| v\n---| -\na  | 10\nb  | 20\n' },
      { source: '`X xcol ([]a:1 2;b:3 4)', expected: 'X b\n---\n1 3\n2 4\n' },
      { source: '`X`Y xcol ([]a:1 2;b:3 4)', expected: 'X Y\n---\n1 3\n2 4\n' },
      { source: '`X xcol ([k:`x`y]a:1 2;b:3 4)', expected: 'X| a b\n-| ---\nx| 1 3\ny| 2 4\n' },
      { source: '(`a`c!`A`C)xcol([]a:1 2;b:3 4;c:5 6)', expected: 'A b C\n-----\n1 3 5\n2 4 6\n' },
      { source: 'fkeys ([]a:1 2;b:`x`y)', expected: '\n' },
      { setup: 'p:([sym:`a`b]name:("alpha";"beta"))', source: '`p$`a`b`a', expected: '`p$`a`b`a\n' },
      { setup: 'p:([sym:`a`b]name:("alpha";"beta"));t:([]sym:`p$`a`b`a;qty:10 20 30)', source: 'fkeys t', expected: 'sym| p\n' },
      { setup: 'p:([sym:`a`b]name:("alpha";"beta"));t:([]sym:`p$`a`b;qty:10 20)', source: 'fkeys `t', expected: 'sym| p\n' },
      { setup: 'p:([sym:`a`b]name:("alpha";"beta"));t:([]sym:`p$`a`b`a;qty:10 20 30)', source: 'meta t', expected: 'c  | t f a\n-| -----\nsym| s p\nqty| j\n' },
      { setup: 'p:([sym:`a`b]name:("alpha";"beta"));t:([]sym:`p$`a`b`a;qty:10 20 30)', source: 't', expected: 'sym qty\n-------\na   10\nb   20\na   30\n' },
      { setup: 'p:([sym:`a`b]name:("alpha";"beta"));t:([]sym:`p$`a`b`a;qty:10 20 30)', source: 'key t`sym', expected: '`p\n' },
      { setup: 'p:([sym:`a`b]name:("alpha";"beta"));t:([]sym:`p$`a`b`a;qty:10 20 30)', source: 'value t`sym', expected: '`a`b`a\n' },
      { setup: 'p:([sym:`a`b]name:("alpha";"beta"));t:([]sym:`p$`a`b`a;qty:10 20 30)', source: 't[`sym]', expected: '`p$`a`b`a\n' },
      { setup: 'p:([sym:`a`b]name:("alpha";"beta"));t:([]sym:`p$`a`b`a;qty:10 20 30)', source: 'select from t where sym=`a', expected: 'sym qty\n-------\na   10\na   30\n' },
      { source: '`a set 42', expected: '`a\n' },
      { setup: '`a set 42', source: 'a', expected: '42\n' },
      { source: '`a`b set 1 2', expected: '1 2\n' },
      { setup: 't:([]a:1 2;b:3 4)', source: '`t insert (5;6)', expected: ',2\n' },
      { setup: 't:([]a:1 2;b:3 4);`t insert (5;6)', source: 't', expected: 'a b\n---\n1 3\n2 4\n5 6\n' },
      { setup: 't:([]a:1 2;b:3 4)', source: '`t insert `a`b!5 6', expected: ',2\n' },
      { setup: 't:([]a:1 2;b:3 4)', source: '`t insert ([]a:enlist 5;b:enlist 6)', expected: ',2\n' },
      { setup: 'kt:([a:1 2]b:10 20)', source: '`kt insert (3;30)', expected: ',2\n' },
      { setup: 'kt:([a:1 2]b:10 20);`kt insert (3;30)', source: 'kt', expected: 'a| b\n-| -\n1| 10\n2| 20\n3| 30\n' },
      { setup: 'kt:([a:1 2]b:10 20)', source: '`kt insert `a`b!3 30', expected: ',2\n' },
      { setup: 'kt:([a:1 2]b:10 20)', source: '`kt insert ([]a:enlist 3;b:enlist 30)', expected: ',2\n' },
      { setup: 't:([]a:1 2;b:3 4)', source: '`t upsert (5;6)', expected: '`t\n' },
      { setup: 't:([]a:1 2;b:3 4);`t upsert (5;6)', source: 't', expected: 'a b\n---\n1 3\n2 4\n5 6\n' },
      { setup: 't:([]a:1 2;b:3 4)', source: '`t upsert ([]a:enlist 5;b:enlist 6)', expected: '`t\n' },
      { source: '([a:1 2]b:10 20) upsert ([a:2 3]b:200 300)', expected: 'a| b\n-| -\n1| 10\n2| 200\n3| 300\n' },
      { setup: 'kt:([a:1 2]b:10 20)', source: '`kt upsert ([a:2 3]b:200 300)', expected: '`kt\n' },
      { setup: 'kt:([a:1 2]b:10 20);`kt upsert ([a:2 3]b:200 300)', source: 'kt', expected: 'a| b\n-| -\n1| 10\n2| 200\n3| 300\n' },
      { source: '(sum;2 5 4 1 7) fby "abbac"', expected: '3 9 9 3 7\n' },
      { source: 'csv', expected: '","\n' },
      { source: 'views[]', expected: '`symbol$()\n' },
      { rootSetup: 'a:([]x:enlist 1)\nb:([]y:enlist 2)', source: 'tables[]', expected: '`s#`a`b\n' },
      { rootSetup: '.foo.a:([]x:enlist 1)\n.foo.b:([]y:enlist 2)', source: 'tables `.foo', expected: '`s#`a`b\n' },
      { rootSetup: '.foo.t:([]a:1 2)', source: 'tables `.foo', expected: ',`t\n' },
      { rootSetup: '.foo.t:([]a:1 2)', source: 'key `.foo', expected: '``t\n' },
      { rootSetup: 'a::5\nv::2+a*3', source: 'views[]', expected: '`s#`a`v\n' },
      { rootSetup: 'a::5\nv::2+a*3', source: 'views `.', expected: '`s#`a`v\n' },
      { rootSetup: 'a::5\nv::2+a*3', source: 'view `v', expected: '"2+a*3"\n' },
      { rootSetup: 'a::5\nv::2+a*3\na::7', source: 'v', expected: '23\n' },
      { source: '(::) 42', expected: '42\n' },
      { source: '(::)[42]', expected: '42\n' },
      { source: 'ungroup ([]s:`a`b;p:(enlist 2;5 7);q:10 20;r:(enlist "A";"BC"))', expected: 's p q  r\n--------\na 2 10 A\nb 5 20 B\nb 7 20 C\n' },
      { setup: 'g:+/[100;]', source: 'g 2 3 4 5', expected: '114\n' },
      { source: 'string `v2', expected: '"v2"\n' },
      { setup: 'v:`v1`v2`v3', source: '`r1`r2`default `v1`v2?v', expected: '`r1`r2`default\n' },
      { setup: 'v:`v1`v2`v3', source: '`r1`r2`default `v1`v2?`oops', expected: '`default\n' },
      { source: '"abcde"?"da"', expected: '3 0\n' },
      { source: '1 2 3 in `a`b!2 3', expected: '011b\n' },
      { source: '(1 2;3 4) in 2 4', expected: '01b\n01b\n' },
      { source: '(2 3 4;(5;6 7;8)) within 3 6', expected: '0  1   1\n1b 10b 0b\n' },
      { source: '"0123456789" within "27"', expected: '0011111100b\n' },
      { source: 'deltas[15 27 93]', expected: '15 12 66\n' },
      { source: 'deltas[10;15 27 93]', expected: '5 12 66\n' },
      { source: 'deltas ([]a:10 21 3;b:4 5 6)', expected: 'a   b\n-----\n10  4\n11  1\n-18 1\n' },
      { source: 'ratios ([]a:10 20 5;b:4 8 2)', expected: 'a    b\n------\n10   4\n2    2\n0.25 0.25\n' },
      { source: "-':[10 15 27 93]", expected: '10 5 12 66\n' },
      { source: "-':[10;15 27 93]", expected: '5 12 66\n' },
      { source: '{[]x:0;while[x<5;x+:1];x}[]', expected: '5\n' },
      { source: '{[]y:0;do[4;y+:3];y}[]', expected: '12\n' },
      { source: '{[]z:0;if[1;z:7];z}[]', expected: '7\n' },
      { source: '{[]z:0;if[0;z:7];z}[]', expected: '0\n' },
      { source: '|[2;til 5]', expected: '2 2 2 3 4\n' },
      { source: '&[2;til 5]', expected: '0 1 2 2 2\n' },
      { source: '|:[til 5]', expected: '4 3 2 1 0\n' },
      { source: '2 xprev 2 7 5 3 11', expected: '0N 0N 2 7 5\n' },
      { source: '-1 xprev "abcde"', expected: '"bcde "\n' },
      { source: 'rank 10 20 10 30', expected: '0 2 1 3\n' },
      { source: 'rank "banana"', expected: '3 0 4 1 5 2\n' },
      { source: '3 xrank 1 37 5 4 0 3', expected: '0 2 2 1 0 1\n' },
      { source: '2 xrank 3 3 4 4 4 4 4', expected: '0 0 0 0 1 1 1\n' },
      { source: '4 xrank 10 20 10 30', expected: '0 2 1 3\n' },
      { source: '0 2 4 6 8 10 bin -10 0 4 5 6 20', expected: '-1 0 2 2 3 5\n' },
      { source: '0 1 1 2 binr 0 1 2', expected: '0 1 3\n' },
      { source: '(`a`b`c!0 2 4) bin -1 3', expected: '``b\n' },
      { source: '1 rotate ([]a:1 2 3;b:"xyz")', expected: 'a b\n---\n2 y\n3 z\n1 x\n' },
      { source: '-1 rotate ([]a:1 2 3;b:"xyz")', expected: 'a b\n---\n3 z\n1 x\n2 y\n' },
      { source: '2 sublist `a`b`c!(1 2 3;"xyz";2 3 5)', expected: 'a| 1 2 3\nb| x y z\n' },
      { source: '-2 sublist ([]a:1 2 3;b:"xyz")', expected: 'a b\n---\n2 y\n3 z\n' },
      { source: '1 2 sublist ([]a:1 2 3;b:"xyz")', expected: 'a b\n---\n2 y\n3 z\n' },
      { source: 'attr `s#1 2 3', expected: '`s\n' },
      { source: 'attr `#`s#1 2 3', expected: '`\n' },
      { source: 'attr `s#([]a:1 2 3;b:`x`y`z)', expected: '`s\n' },
      { source: 'meta `s#([]a:1 2 3;b:`x`y`z)', expected: 'c| t f a\n-| -----\na| j   p\nb| s\n' },
      { source: 'type each (`boolean$();`short$();`int$();`long$();`real$();`float$();`symbol$())', expected: '1 5 6 7 8 9 11h\n' },
      { source: 'type each ((1;2;3);(1;`a);(1 2;3 4);enlist "abc")', expected: '7 0 0 0h\n' },
      { source: 'type rand 10i', expected: '-6h\n' },
      { source: 'type rand 10h', expected: '-5h\n' },
      { source: 'type rand `6', expected: '-11h\n' },
      { source: 'type rand 2026.05m', expected: '-13h\n' },
      { source: 'type rand 12:34', expected: '-17h\n' },
      { source: 'type rand 12:34:56', expected: '-18h\n' },
      { source: 'type rand 12:34:56.789', expected: '-19h\n' },
      { source: 'type rand 0D12:34:56.789123456', expected: '-16h\n' },
      { source: 'type rand 2026.05.04D12:34:56.789123456', expected: '-12h\n' },
      { source: 'type rand 2026.05.04T12:34:56.789', expected: '-15h\n' },
      { source: '(rand 2026.05.04) within 2000.01.01 2026.05.04', expected: '1b\n' },
      { source: '(rand 12:34) within 00:00 12:34', expected: '1b\n' },
      { source: '(rand 12:34:56) within 00:00:00 12:34:56', expected: '1b\n' },
      { source: '(rand 12:34:56.789) within 00:00:00.000 12:34:56.789', expected: '1b\n' },
      { source: 'count 5?3', expected: '5\n' },
      { source: 'all (5?3) within 0 2', expected: '1b\n' },
      { source: 'count distinct -3?10', expected: '3\n' },
      { source: 'count 0N?5', expected: '5\n' },
      { source: 'count distinct 0N?5', expected: '5\n' },
      { source: 'all (0N?5) within 0 4', expected: '1b\n' },
      { source: 'asc 0N?"abcde"', expected: '"abcde"\n' },
      { source: '9$"foo"', expected: '"foo      "\n' },
      { source: '-9$"foo"', expected: '"      foo"\n' },
      { source: '3$"foobar"', expected: '"foo"\n' },
      { source: '-3$"foobar"', expected: '"bar"\n' },
      { source: '0$"foo"', expected: '""\n' },
      { source: '-4$`a`b`c!("abcdef";"xy";"longer")', expected: 'a| "cdef"\nb| "  xy"\nc| "nger"\n' },
      { source: '3$string([]a:`abcdef`xy;b:`q`longer)', expected: 'a     b\n-------\n"abc" "q  "\n"xy " "lon"\n' },
      { source: '-4$string([]a:`abcdef`xy;b:`q`longer)', expected: 'a      b\n--------\n"cdef" "   q"\n"  xy" "nger"\n' },
      { source: '-9$`a`b`c!("quick";"brown";"fox")', expected: 'a| "    quick"\nb| "    brown"\nc| "      fox"\n' },
      { source: '"B"$"   Y  "', expected: '1b\n' },
      { source: '"B"$(" Y ";"    N ";"t";"x";"1";"0")', expected: '101110b\n' },
      { source: '"S"$"   IBM   "', expected: '`IBM\n' },
      { source: '`$"   IBM   "', expected: '`IBM\n' },
      { source: '"I"$"192.168.1.34"', expected: '-1062731486i\n' },
      { source: '"T"$"123456789"', expected: '12:34:56.789\n' },
      { source: '"N"$"123456123987654"', expected: '0D12:34:56.123987654\n' },
      { source: '"P"$"2015-10-28D03:55:58.6542"', expected: '2015.10.28D03:55:58.654200000\n' },
      { source: '"D"$"2000-12-12"', expected: '2000.12.12\n' },
      { source: '"D"$"20001212"', expected: '2000.12.12\n' },
      { source: '"H"$"32768"', expected: '0Nh\n' },
      { source: '"I"$"2147483648"', expected: '0Ni\n' },
      { source: '"H"$"32767"', expected: '0Wh\n' },
      { source: '"I"$"2147483647"', expected: '0Wi\n' },
      { source: '"J"$"9223372036854775807"', expected: '0W\n' },
      { source: '"J"$"-9223372036854775807"', expected: '-0W\n' },
      { source: '"J"$"9223372036854775808"', expected: '0N\n' },
      { source: '"BXH"$("42";"42";"42")', expected: '0b\n0x42\n42h\n' },
      { source: '("B";"XHI")$("42";("42";"42";"42"))', expected: '0b\n(0x42;42h;42i)\n' },
      { source: '"PZ"$\\:"20191122-11:11:11.123"', expected: '2019.11.22D11:11:11.123000000\n2019.11.22T11:11:11.123\n' },
      { source: '(#:)"zero"', expected: '4\n' },
      { source: 'count each string floor 1.2 123 1.23445 -1234578.5522', expected: '1 3 1 8\n' },
      { source: 'value "1+2"', expected: '3\n' },
      { source: 'value "a:10;a+2"', expected: '12\n' },
      { source: '"toronto ontario" ss "[ir]o"', expected: '2 13\n' },
      { source: '"toronto ontario" ss "t?r"', expected: '0 10\n' },
      { source: '"ab" ss "z"', expected: '`long$()\n' },
      { source: 'ssr["toronto ontario";"t?r";"XXX"]', expected: '"XXXonto onXXXio"\n' },
      { source: '`brawn`brown like "br[^o]wn"', expected: '10b\n' },
      { source: '(`a`b`c!`quick`brown`fox) like "brown"', expected: 'a| 0\nb| 1\nc| 0\n' },
      { setup: 'a:42', source: 'value `a', expected: '42\n' },
      { setup: 'D:`q`w`e!(1 2;3 4;5 6)', source: 'value `D', expected: 'q| 1 2\nw| 3 4\ne| 5 6\n' },
      { setup: 'KT:([k:`x`y]a:1 2)', source: 'value `KT', expected: 'k| a\n-| -\nx| 1\ny| 2\n' },
      { setup: 'D:`q`w`e!(1 2;3 4;5 6)', source: 'get `D', expected: 'q| 1 2\nw| 3 4\ne| 5 6\n' },
      { setup: 'a:42', source: 'get "a"', expected: '42\n' },
      { source: 'get "1+2"', expected: '3\n' },
      { source: 'ref:([]a:1 2);save `:ref.csv;ref:();load `:ref.csv;ref', expected: 'a\n-\n1\n2\n' },
      { source: 't:([]a:1 2;b:3 4);rsave `t;t:();rload `t;t', expected: 'a b\n---\n1 3\n2 4\n' },
      { source: '{[]t:([]a:1 2;b:3 4);`:/db dsave `t}[]', expected: '`t\n' },
      { source: 'setenv[`QANVAS_REFERENCE;"ok"]', expected: '"ok"\n' },
      { source: 'value(sum;1 2 3)', expected: '6\n' },
      { source: 'eval(sum;1 2 3)', expected: '6\n' },
      { source: 'value("sum";1 2 3)', expected: '6\n' },
      { setup: 'f:{x+1}', source: 'value(`f;4)', expected: '5\n' },
      { setup: 'f:{x+1}', source: 'value("f";4)', expected: '5\n' },
      { setup: 'g:+[10;]', source: 'value(`g;4)', expected: '14\n' },
      { setup: 'g:+[10;]', source: 'value("g";4)', expected: '14\n' },
      { source: 'eval(+;7;(+;2;1))', expected: '10\n' },
      { source: 'eval(neg;(+;2;1))', expected: '-3\n' },
      { source: 'reval parse "2+3"', expected: '5\n' },
      { source: 'md5 "hello"', expected: '0x5d41402abc4b2a76b9719d911017c592\n' },
      { source: '(enlist 2 3f) lsq enlist 1 1f', expected: '2.5\n' },
      { source: 'eval parse "1+2"', expected: '3\n' },
      { source: 'eval "1+2"', expected: '"1+2"\n' },
      { source: 'parse "1+2"', expected: '+\n1\n2\n' },
      { source: 'parse "1 2 3 +/: 5 7"', expected: '(/:;+)\n1 2 3\n5 7\n' },
      { source: 'parse "1 2 3 +neg 5 7"', expected: '+\n1 2 3\n(-:;5 7)\n' },
      { source: 'type parse "{x*x}"', expected: '100h\n' },
      { source: '(parse "{x*x}") 5', expected: '25\n' },
      { source: 'parse "{[x;y]a:x+y;:a}"', expected: '{[x;y]a:x+y;:a}\n' },
      { source: '(parse "{[x;y]a:x+y;:a}")[2;3]', expected: '5\n' },
      { source: '10 sv 1 9 9 5', expected: '1995\n' },
      { source: '` sv ("one";"two";"three")', expected: '"one\\ntwo\\nthree\\n"\n' },
      { source: '` sv `quick`brown`fox', expected: '`quick.brown.fox\n' },
      { source: '` sv `:/home/kdb/q`data`2010.03.22`trade', expected: '`:/home/kdb/q/data/2010.03.22/trade\n' },
      { source: '0x0 sv "x"$0 255', expected: '255h\n' },
      { source: '0x0 sv "x"$128 255', expected: '-32513h\n' },
      { source: '0x0 sv "x"$0 64 128 255', expected: '4227327i\n' },
      { source: '0x0 sv "x"$til 8', expected: '283686952306183\n' },
      { source: '0b sv 8#1b', expected: '0xff\n' },
      { source: '0b sv 16#1b', expected: '-1h\n' },
      { source: '0b sv 32#1b', expected: '-1i\n' },
      { source: '0b sv 64#1b', expected: '-1\n' },
      { source: '0 24 60 60 sv 2 3 5 7', expected: '183907\n' },
      { source: '0b vs 23173h', expected: '0101101010000101b\n' },
      { source: '0b vs 9i', expected: '00000000000000000000000000001001b\n' },
      { source: '0x0 vs 2413h', expected: '0x096d\n' },
      { source: '0x0 vs 2413i', expected: '0x0000096d\n' },
      { source: '0x0 vs `real$2413', expected: '0x4516d000\n' },
      { source: '0x0 vs 2413f', expected: '0x40a2da0000000000\n' },
      { source: '10 vs 1995', expected: '1 9 9 5\n' },
      { source: '24 60 60 vs 3805', expected: '1 3 25\n' },
      { source: '` vs `mywork.dat', expected: '`mywork`dat\n' },
    ] as const) {
      expect(runCanvasExpression(source, setup, rootSetup), source).toBe(expected);
    }
  });
});
