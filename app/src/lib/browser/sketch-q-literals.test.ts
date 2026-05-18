import { describe, expect, it } from 'vitest';
import { toQLiteral } from './sketch-q-literals';

describe('toQLiteral', () => {
  it('uses enlist for single-key dictionaries', () => {
    expect(toQLiteral({ mouse: [320, 240] })).toBe('enlist `mouse!enlist (320;240)');
  });

  it('uses keyed form for multi-key dictionaries', () => {
    const literal = toQLiteral({
      mouse: [320, 240],
      mouseButtons: { left: false, right: false },
    });
    expect(literal).toContain('`mouse');
    expect(literal).toContain('`mouseButtons');
    expect(literal).toContain('!(');
  });
});
