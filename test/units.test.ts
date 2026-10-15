import { describe, expect, it } from 'vitest';
import { mgdlToMmol, mmolToMgdl } from '../src/units.js';

describe('glucose unit conversion', () => {
  it('converts between mg/dL and mmol/L', () => {
    expect(mgdlToMmol(180)).toBeCloseTo(10, 1);
    expect(mmolToMgdl(5.5)).toBeCloseTo(99, 0);
  });

  it('round-trips', () => {
    expect(mmolToMgdl(mgdlToMmol(123))).toBeCloseTo(123, 10);
  });
});
