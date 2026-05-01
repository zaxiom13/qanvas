import { describe, expect, it } from 'vitest';
import { StructuredConsoleFormatter } from './value-format';

describe('StructuredConsoleFormatter', () => {
  it('keeps multiple scalar show outputs as separate console entries', () => {
    const formatter = new StructuredConsoleFormatter();

    expect(formatter.push('3\n5\n')).toEqual(['3', '5']);
  });

  it('still formats multi-column q-native arrays as arrays', () => {
    const formatter = new StructuredConsoleFormatter();

    expect(formatter.push('3 5\n')).toEqual(['[3 5]']);
  });
});
