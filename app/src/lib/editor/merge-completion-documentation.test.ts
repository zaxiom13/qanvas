import { describe, expect, it } from 'vitest';
import { mergeCompletionDocumentationIntoDetail } from './merge-completion-documentation';

describe('mergeCompletionDocumentationIntoDetail', () => {
  it('returns completion unchanged when there is no string info', () => {
    const c = { label: 'x', detail: 'short' };
    expect(mergeCompletionDocumentationIntoDetail(c)).toEqual(c);
  });

  it('merges info after detail and removes info', () => {
    const merged = mergeCompletionDocumentationIntoDetail({
      label: 'foo',
      detail: 'kind',
      info: 'Long doc line.',
    });
    expect(merged).toEqual({
      label: 'foo',
      detail: 'kind\n\nLong doc line.',
    });
    expect('info' in merged).toBe(false);
  });

  it('uses info alone as detail when detail is missing', () => {
    expect(
      mergeCompletionDocumentationIntoDetail({
        label: 'bar',
        info: '  only doc  ',
      })
    ).toEqual({ label: 'bar', detail: 'only doc' });
  });

  it('drops empty info', () => {
    expect(
      mergeCompletionDocumentationIntoDetail({
        label: 'z',
        detail: 'd',
        info: '   ',
      })
    ).toEqual({ label: 'z', detail: 'd' });
  });
});
