import { describe, expect, it } from 'vitest';
import { shouldAutoRunLoadedExample } from './example-load-policy';

describe('shouldAutoRunLoadedExample', () => {
  it('does not auto-run when picking from the examples browser', () => {
    expect(shouldAutoRunLoadedExample('browse')).toBe(false);
  });

  it('auto-runs during guided tour navigation', () => {
    expect(shouldAutoRunLoadedExample('guidedTour')).toBe(true);
  });
});
