import { describe, expect, it } from 'vitest';
import { REFERENCE_ROWS, runReferenceRow } from './reference-catalog';

describe('reference catalog', () => {
  it('verifies every runnable reference row against its expected output', () => {
    expect(REFERENCE_ROWS.length).toBeGreaterThan(50);

    for (const row of REFERENCE_ROWS) {
      const result = runReferenceRow(row);
      expect(result.status, row.name).toBe('pass');
    }
  });

  it('uses concrete runnable examples for every primitive row', () => {
    const fallbackRows = REFERENCE_ROWS.filter((row) => row.kind === 'primitive' && row.expression === row.name);

    expect(fallbackRows.map((row) => row.name)).toEqual([]);
  });
});
