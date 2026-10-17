import { assertPositive } from './errors.js';
import type { GlucoseUnit } from './units.js';

// Starting points from Think Like a Pancreas, ch. 7. Real values have to be worked out
// and fine-tuned with a doctor or diabetes educator.

/** The "500 rule": grams of carbs covered by one unit. */
export function carbRatioFromTotalDailyDose(totalDailyDose: number): number {
  assertPositive('totalDailyDose', totalDailyDose);
  return 500 / totalDailyDose;
}

export function carbRatioFromWeight(weightKg: number): number {
  assertPositive('weightKg', weightKg);
  return 850 / weightKg;
}

/** The "1700 rule" (94 in mmol/L), rounded up since a larger factor is the safer side. */
export function sensitivityFromTotalDailyDose(
  totalDailyDose: number,
  unit: GlucoseUnit,
): number {
  assertPositive('totalDailyDose', totalDailyDose);
  const rule = unit === 'mg/dL' ? 1700 : 94;
  const precision = unit === 'mg/dL' ? 1 : 10;
  return Math.ceil((rule / totalDailyDose) * precision) / precision;
}
