import { describe, expect, it } from 'vitest';
import { classifyMobileQIdent, Q_NAMESPACE_SYMBOLS } from './q-language';

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
});
