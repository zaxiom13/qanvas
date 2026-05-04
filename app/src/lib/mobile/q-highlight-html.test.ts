import { describe, expect, it } from 'vitest';
import { highlightQSnippetHtml } from './q-highlight-html';
import { listBuiltins } from '@qpad/engine';

describe('q snippet highlighting', () => {
  it('does not turn adverb slashes before closing delimiters into comments', () => {
    const source = 'mandelbrot:{255*({y+.cx.mul[x;x]} /)each (.cx.new /)each til 4}';
    const html = highlightQSnippetHtml(source);

    expect(html).not.toContain('q-token-comment');
    expect(html).toContain('<span class="q-token-operator">/</span>');
    expect(html).toContain('<span class="q-token-builtin">each</span>');
  });

  it('highlights complex namespace helpers as builtins', () => {
    const html = highlightQSnippetHtml('.cx.mul[.cx.new[1;2];.cx.z[3;4]] + .cx.abs .cx.new[3;4]');

    expect(html).toContain('<span class="q-token-builtin">.cx.mul</span>');
    expect(html).toContain('<span class="q-token-builtin">.cx.new</span>');
    expect(html).toContain('<span class="q-token-builtin">.cx.z</span>');
    expect(html).toContain('<span class="q-token-builtin">.cx.abs</span>');
  });

  it('highlights .Q and .z namespace members as builtins', () => {
    const html = highlightQSnippetHtml('.Q.fmt[6;2] each 1 234; .Q.id `two words; .z.P; .z.x');

    expect(html).toContain('<span class="q-token-builtin">.Q.fmt</span>');
    expect(html).toContain('<span class="q-token-builtin">.Q.id</span>');
    expect(html).toContain('<span class="q-token-builtin">.z.P</span>');
    expect(html).toContain('<span class="q-token-builtin">.z.x</span>');
  });

  it('highlights wavg and every identifier-shaped engine builtin as builtins', () => {
    const builtins = listBuiltins();
    const names = [
      ...builtins.monads,
      ...builtins.diads,
      ...builtins.triads,
      ...builtins.quads,
      'each',
    ].filter((name) => /^[a-zA-Z.][a-zA-Z0-9_.]*$/.test(name));

    expect(highlightQSnippetHtml('100 50 25 wavg 10 12 20f')).toContain(
      '<span class="q-token-builtin">wavg</span>'
    );
    for (const name of names) {
      expect(highlightQSnippetHtml(name), name).toContain(`<span class="q-token-builtin">${name}</span>`);
    }
  });

  it('still highlights statement and trailing q comments', () => {
    expect(highlightQSnippetHtml('/ note')).toContain('q-token-comment');
    expect(highlightQSnippetHtml('show 1 2 3 / note')).toContain('q-token-comment');
  });
});
