import { describe, expect, it } from 'vitest';
import { BolusInputError } from '../src/errors.js';
import { valueAt } from '../src/schedule.js';

const at = (hours: number, minutes = 0) => new Date(2026, 9, 22, hours, minutes);

describe('valueAt', () => {
  it('returns a fixed value as is', () => {
    expect(valueAt(12, at(8))).toBe(12);
  });

  it('picks the entry in effect at the given time', () => {
    const ratios = [
      { start: '06:00', value: 8 },
      { start: '11:00', value: 15 },
      { start: '17:00', value: 12 },
    ];
    expect(valueAt(ratios, at(7, 30))).toBe(8);
    expect(valueAt(ratios, at(11))).toBe(15);
    expect(valueAt(ratios, at(20))).toBe(12);
  });

  it('wraps around midnight to the last entry', () => {
    const ratios = [
      { start: '17:00', value: 12 },
      { start: '06:00', value: 8 },
    ];
    expect(valueAt(ratios, at(3))).toBe(12);
  });

  it('rejects empty schedules and malformed times', () => {
    expect(() => valueAt([], at(8))).toThrow(BolusInputError);
    expect(() => valueAt([{ start: '25:00', value: 1 }], at(8))).toThrow(BolusInputError);
    expect(() => valueAt([{ start: '8:00', value: 1 }], at(8))).toThrow(BolusInputError);
  });
});
