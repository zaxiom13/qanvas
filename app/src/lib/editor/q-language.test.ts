import { createSession } from '../../../../packages/q-engine/src/index';
import { describe, expect, it } from 'vitest';
import { classifyMobileQIdent, Q_CANVAS_FUNCTIONS, Q_NAMESPACE_SYMBOLS, Q_SLASH_SNIPPETS } from './q-language';

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

  it('offers plural draw snippets with two prefilled rows', () => {
    const snippets = new Map<string, string>(Q_SLASH_SNIPPETS.map((item) => [item.label, item.insertText]));

    for (const label of ['/circles', '/rects', '/pixels', '/lines', '/texts', '/images']) {
      const insertText = snippets.get(label);

      expect(insertText).toBeTruthy();
      expect(insertText).toMatch(/\$\{\d+:/);
      expect(insertText).not.toContain('p:enlist');
    }
  });

  it('offers plain plural draw completions with two prefilled rows', () => {
    const completions = new Map<string, string>(Q_CANVAS_FUNCTIONS.map((item) => [item.label, item.insertText]));

    for (const label of ['circles', 'rects', 'pixels', 'lines', 'texts', 'images']) {
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
});
