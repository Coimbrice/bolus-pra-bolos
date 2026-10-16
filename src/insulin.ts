import { assertNonNegative, assertPositive, BolusInputError } from './errors.js';

/**
 * How a rapid-acting dose wears off.
 *
 * `linear` is the straight-line estimate from Think Like a Pancreas: 3 h is aggressive,
 * 4 h traditional and 5 h conservative. `exponential` follows the activity curve used by
 * Loop and OpenAPS, which better reflects that insulin peaks before tailing off.
 */
export type InsulinModel =
  | { type: 'linear'; durationHours: number }
  | { type: 'exponential'; durationHours: number; peakMinutes: number };

export const DEFAULT_INSULIN_MODEL: InsulinModel = { type: 'linear', durationHours: 4 };

export interface Dose {
  time: Date;
  units: number;
}

/** Fraction of a dose still active `minutes` after it was given, from 1 down to 0. */
export function fractionRemaining(model: InsulinModel, minutes: number): number {
  validateModel(model);
  const duration = model.durationHours * 60;
  if (minutes <= 0) return 1;
  if (minutes >= duration) return 0;
  if (model.type === 'linear') return 1 - minutes / duration;
  return exponentialRemaining(minutes, duration, model.peakMinutes);
}

/**
 * Insulin still active from previous boluses. Only pass boluses here: basal insulin is
 * meant to cover the body's baseline needs, not food or corrections.
 */
export function insulinOnBoard(
  doses: readonly Dose[],
  now: Date,
  model: InsulinModel = DEFAULT_INSULIN_MODEL,
): number {
  return doses.reduce((total, dose) => {
    assertNonNegative('dose units', dose.units);
    const minutes = (now.getTime() - dose.time.getTime()) / 60_000;
    return total + dose.units * fractionRemaining(model, minutes);
  }, 0);
}

function validateModel(model: InsulinModel): void {
  assertPositive('durationHours', model.durationHours);
  if (model.type === 'exponential') {
    assertPositive('peakMinutes', model.peakMinutes);
    if (model.peakMinutes >= (model.durationHours * 60) / 2) {
      throw new BolusInputError(
        'peakMinutes must be less than half of the action duration',
      );
    }
  }
}

// Closed-form integral of the exponential activity curve, see
// https://github.com/LoopKit/Loop/issues/388
function exponentialRemaining(t: number, duration: number, peak: number): number {
  const tau = (peak * (1 - peak / duration)) / (1 - (2 * peak) / duration);
  const a = (2 * tau) / duration;
  const s = 1 / (1 - a + (1 + a) * Math.exp(-duration / tau));
  return (
    1 -
    s *
      (1 - a) *
      (((t * t) / (tau * duration * (1 - a)) - t / tau - 1) * Math.exp(-t / tau) + 1)
  );
}
