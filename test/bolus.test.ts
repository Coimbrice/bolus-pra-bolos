import { describe, expect, it } from 'vitest';
import { calculateBolus, type BolusSettings } from '../src/bolus.js';
import { BolusInputError } from '../src/errors.js';

const at = (hours: number, minutes = 0) => new Date(2026, 9, 22, hours, minutes);

const settings: BolusSettings = {
  unit: 'mg/dL',
  carbRatio: 10,
  sensitivity: 50,
  target: 100,
};

describe('calculateBolus', () => {
  it('covers carbs with the carb ratio', () => {
    const result = calculateBolus({ settings, carbs: 65, now: at(12) });
    expect(result.foodDose).toBe(6.5);
    expect(result.units).toBe(6.5);
  });

  it('adds a correction when above target', () => {
    const result = calculateBolus({
      settings: { ...settings, sensitivity: 65, target: 110 },
      carbs: 0,
      glucose: 210,
      now: at(12),
    });
    expect(result.correctionDose).toBeCloseTo(1.54, 2);
    expect(result.units).toBe(1.5);
  });

  it('takes a negative correction off the food dose when below target', () => {
    const result = calculateBolus({ settings, carbs: 40, glucose: 75, now: at(12) });
    expect(result.correctionDose).toBe(-0.5);
    expect(result.units).toBe(3.5);
  });

  it('uses the values scheduled for the current time', () => {
    const result = calculateBolus({
      settings: {
        ...settings,
        carbRatio: [
          { start: '06:00', value: 8 },
          { start: '11:00', value: 15 },
        ],
      },
      carbs: 60,
      now: at(7),
    });
    expect(result.units).toBe(7.5);
  });

  it('rounds down to the dose step', () => {
    const result = calculateBolus({
      settings: { ...settings, doseStep: 1 },
      carbs: 38,
      now: at(12),
    });
    expect(result.unroundedUnits).toBeCloseTo(3.8);
    expect(result.units).toBe(3);
  });

  it('applies the activity factor to the whole bolus', () => {
    const result = calculateBolus({
      settings,
      carbs: 60,
      glucose: 150,
      activityFactor: 0.5,
      now: at(12),
    });
    expect(result.units).toBe(3.5);
  });

  it('caps at the maximum bolus', () => {
    const result = calculateBolus({
      settings: { ...settings, maxBolus: 10 },
      carbs: 150,
    });
    expect(result.units).toBe(10);
    expect(result.warnings).toContain('capped-at-max');
  });

  it('warns about low glucose', () => {
    const result = calculateBolus({ settings, carbs: 30, glucose: 62, now: at(12) });
    expect(result.warnings).toContain('low-glucose');
  });

  it('rejects invalid input', () => {
    expect(() => calculateBolus({ settings, carbs: -10 })).toThrow(BolusInputError);
    expect(() =>
      calculateBolus({ settings: { ...settings, carbRatio: 0 }, carbs: 10 }),
    ).toThrow(BolusInputError);
    expect(() => calculateBolus({ settings, carbs: 10, activityFactor: 0 })).toThrow(
      BolusInputError,
    );
  });
});

describe('insulin on board', () => {
  // Correction bolus two hours ago, no food involved.
  const correction = { doses: [{ time: at(10), units: 2 }], now: at(12) };

  it('is subtracted from the bolus', () => {
    const result = calculateBolus({ settings, carbs: 30, glucose: 100, ...correction });
    expect(result.insulinOnBoard).toBeCloseTo(1);
    expect(result.units).toBe(2);
  });

  it('suggests carbs when it is more than what is needed', () => {
    const result = calculateBolus({ settings, carbs: 0, glucose: 100, ...correction });
    expect(result.units).toBe(0);
    expect(result.suggestedCarbs).toBe(10);
    expect(result.warnings).toContain('insulin-on-board-exceeds-need');
  });

  it('only offsets the correction with the correction-only strategy', () => {
    const result = calculateBolus({
      settings: { ...settings, iobStrategy: 'correction-only' },
      carbs: 30,
      glucose: 125,
      ...correction,
    });
    expect(result.iobApplied).toBeCloseTo(0.5);
    expect(result.units).toBe(3);
  });
});

describe('eating again shortly after a bolused meal', () => {
  // 60 g lunch at noon covered by 6 U. At 13:00, 30 g of dessert at target glucose.
  const request = {
    carbs: 30,
    glucose: 100,
    doses: [{ time: at(12), units: 6 }],
    meals: [{ time: at(12), carbs: 60 }],
    now: at(13),
  };

  it('only subtracts the insulin not already covering the lunch', () => {
    const result = calculateBolus({ settings, ...request });
    // 4.5 U still active, 40 g of lunch still absorbing need 4 U of it.
    expect(result.insulinOnBoard).toBeCloseTo(4.5);
    expect(result.carbsOnBoard).toBeCloseTo(40);
    expect(result.iobApplied).toBeCloseTo(0.5);
    expect(result.units).toBe(2.5);
  });

  it('would skip the dessert bolus entirely if all IOB were subtracted', () => {
    const result = calculateBolus({
      settings: { ...settings, iobStrategy: 'subtract-from-total' },
      ...request,
    });
    expect(result.units).toBe(0);
  });

  it('does not add insulin for carbs that were never bolused', () => {
    const result = calculateBolus({ settings, ...request, doses: [] });
    expect(result.iobApplied).toBe(0);
    expect(result.units).toBe(3);
  });

  it('uses the carb ratio in effect when the earlier meal was eaten', () => {
    const result = calculateBolus({
      settings: {
        ...settings,
        carbRatio: [
          { start: '11:00', value: 10 },
          { start: '12:30', value: 15 },
        ],
      },
      ...request,
    });
    // Dessert at 1:15 needs 2 U; the lunch carbs still need 4 U at its 1:10 ratio.
    expect(result.foodDose).toBe(2);
    expect(result.iobApplied).toBeCloseTo(0.5);
    expect(result.units).toBe(1.5);
  });
});
