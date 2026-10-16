import { describe, expect, it } from 'vitest';
import { BolusInputError } from '../src/errors.js';
import { fractionRemaining, insulinOnBoard, type InsulinModel } from '../src/insulin.js';

const at = (hours: number, minutes = 0) => new Date(2026, 9, 22, hours, minutes);

const linear: InsulinModel = { type: 'linear', durationHours: 4 };
const exponential: InsulinModel = {
  type: 'exponential',
  durationHours: 5,
  peakMinutes: 75,
};

describe('fractionRemaining', () => {
  it('wears off in a straight line for the linear model', () => {
    expect(fractionRemaining(linear, 0)).toBe(1);
    expect(fractionRemaining(linear, 60)).toBeCloseTo(0.75);
    expect(fractionRemaining(linear, 240)).toBe(0);
  });

  it('goes from 1 to 0 for the exponential model', () => {
    expect(fractionRemaining(exponential, 0)).toBe(1);
    expect(fractionRemaining(exponential, 299.999)).toBeCloseTo(0, 4);
    expect(fractionRemaining(exponential, 300)).toBe(0);
  });

  it('decreases monotonically for the exponential model', () => {
    let previous = 1;
    for (let minute = 5; minute <= 300; minute += 5) {
      const current = fractionRemaining(exponential, minute);
      expect(current).toBeLessThanOrEqual(previous);
      previous = current;
    }
  });

  it('keeps more insulin early on than the linear model', () => {
    const linearFive: InsulinModel = { type: 'linear', durationHours: 5 };
    expect(fractionRemaining(exponential, 30)).toBeGreaterThan(
      fractionRemaining(linearFive, 30),
    );
  });

  it('rejects a peak too late for the duration', () => {
    const invalid: InsulinModel = {
      type: 'exponential',
      durationHours: 3,
      peakMinutes: 90,
    };
    expect(() => fractionRemaining(invalid, 30)).toThrow(BolusInputError);
  });
});

describe('insulinOnBoard', () => {
  it('sums what is left of each dose', () => {
    const doses = [
      { time: at(8), units: 4 },
      { time: at(10), units: 2 },
    ];
    expect(insulinOnBoard(doses, at(11), linear)).toBeCloseTo(4 * 0.25 + 2 * 0.75);
  });

  it('ignores doses past the action duration', () => {
    expect(insulinOnBoard([{ time: at(6), units: 5 }], at(11), linear)).toBe(0);
  });

  it('defaults to a 4 hour linear model', () => {
    expect(insulinOnBoard([{ time: at(10), units: 4 }], at(12))).toBeCloseTo(2);
  });
});
