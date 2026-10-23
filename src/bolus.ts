import { carbsRemaining, DEFAULT_ABSORPTION_HOURS, type Meal } from './carbs.js';
import { assertNonNegative, assertPositive } from './errors.js';
import {
  DEFAULT_INSULIN_MODEL,
  insulinOnBoard,
  type Dose,
  type InsulinModel,
} from './insulin.js';
import { valueAt, type Scheduled } from './schedule.js';
import { suggestTiming, type BolusTiming, type Digestion } from './timing.js';
import { hypoThreshold, type GlucoseUnit } from './units.js';

/**
 * How insulin on board (IOB) is taken off the new bolus.
 *
 * - `carb-aware`: only the IOB not already committed to carbs still being absorbed is
 *   subtracted. Handles eating again shortly after a bolused meal.
 * - `subtract-from-total`: the book's default, IOB comes off food and correction alike.
 * - `correction-only`: IOB only offsets the correction, as the book suggests after
 *   slow-digesting or very large meals.
 */
export type IobStrategy = 'carb-aware' | 'subtract-from-total' | 'correction-only';

export interface BolusSettings {
  unit: GlucoseUnit;
  /** Grams of carbs covered by one unit of insulin. */
  carbRatio: Scheduled;
  /** Glucose drop per unit of insulin, in `unit`. */
  sensitivity: Scheduled;
  /** Target glucose, in `unit`. */
  target: Scheduled;
  insulinModel?: InsulinModel;
  carbAbsorptionHours?: number;
  /** Smallest increment the pen or pump can deliver. Results are rounded down to it. */
  doseStep?: number;
  maxBolus?: number;
  iobStrategy?: IobStrategy;
}

export interface BolusRequest {
  settings: BolusSettings;
  /** Carbs about to be eaten. */
  carbs: number;
  /** Current glucose in `settings.unit`. Without it no correction is made. */
  glucose?: number;
  /** Recent boluses, used to work out insulin on board. */
  doses?: readonly Dose[];
  /** Recent meals, not including the one being bolused for now. */
  meals?: readonly Meal[];
  /** Multiplier for exercise (below 1) or long periods sitting still (above 1). */
  activityFactor?: number;
  /** How fast the meal digests. When given, the result includes when to bolus. */
  digestion?: Digestion;
  now?: Date;
}

export type BolusWarning =
  'low-glucose' | 'insulin-on-board-exceeds-need' | 'capped-at-max';

/** A dose split in two, for slow-digesting or very large meals. */
export interface BolusSplit {
  now: number;
  later: number;
  /** When to take the second part, in minutes after the start of the meal. */
  laterFromMinutes: number;
  laterToMinutes: number;
}

export interface BolusResult {
  /** Dose to take, rounded down to the dose step and capped at the maximum. */
  units: number;
  unroundedUnits: number;
  foodDose: number;
  correctionDose: number;
  insulinOnBoard: number;
  carbsOnBoard: number;
  /** Part of the insulin on board actually subtracted, depending on the strategy. */
  iobApplied: number;
  activityFactor: number;
  /** Carbs to eat when insulin on board is more than what is needed. */
  suggestedCarbs: number;
  /** When to bolus relative to the meal, or null if `digestion` was not given. */
  timing: BolusTiming | null;
  /** Set for slow-digesting meals when the dose is big enough to split. */
  split: BolusSplit | null;
  warnings: BolusWarning[];
}

/**
 * Bolus = (food dose + correction dose - insulin on board) x activity factor,
 * following chapter 7 of Think Like a Pancreas.
 *
 * Not a medical device and not meant for real dosing decisions, see the README.
 */
export function calculateBolus(request: BolusRequest): BolusResult {
  const {
    settings,
    carbs,
    glucose,
    doses = [],
    meals = [],
    activityFactor = 1,
  } = request;
  const now = request.now ?? new Date();
  const doseStep = settings.doseStep ?? 0.5;
  const absorptionHours = settings.carbAbsorptionHours ?? DEFAULT_ABSORPTION_HOURS;

  assertNonNegative('carbs', carbs);
  assertPositive('activityFactor', activityFactor);
  assertPositive('doseStep', doseStep);
  if (glucose !== undefined) assertPositive('glucose', glucose);
  if (settings.maxBolus !== undefined) assertPositive('maxBolus', settings.maxBolus);

  const carbRatio = valueAt(settings.carbRatio, now);
  const sensitivity = valueAt(settings.sensitivity, now);
  const target = valueAt(settings.target, now);
  assertPositive('carbRatio', carbRatio);
  assertPositive('sensitivity', sensitivity);
  assertPositive('target', target);

  const foodDose = carbs / carbRatio;
  const correctionDose = glucose === undefined ? 0 : (glucose - target) / sensitivity;
  const iob = insulinOnBoard(doses, now, settings.insulinModel ?? DEFAULT_INSULIN_MODEL);

  let carbsOnBoard = 0;
  let insulinForCarbsOnBoard = 0;
  for (const meal of meals) {
    const remaining = carbsRemaining(meal, now, absorptionHours);
    carbsOnBoard += remaining;
    // Use the ratio in effect when the meal was eaten, which is what it was bolused with.
    insulinForCarbsOnBoard += remaining / valueAt(settings.carbRatio, meal.time);
  }

  let iobApplied: number;
  switch (settings.iobStrategy ?? 'carb-aware') {
    case 'carb-aware':
      // Clamped at zero so unbolused carbs never add insulin on their own.
      iobApplied = Math.max(0, iob - insulinForCarbsOnBoard);
      break;
    case 'subtract-from-total':
      iobApplied = iob;
      break;
    case 'correction-only':
      iobApplied = Math.min(iob, Math.max(0, correctionDose));
      break;
  }

  const warnings: BolusWarning[] = [];
  const isLow = glucose !== undefined && glucose < hypoThreshold(settings.unit);
  if (isLow) {
    warnings.push('low-glucose');
  }

  const needed = foodDose + correctionDose - iobApplied;
  let suggestedCarbs = 0;
  if (needed < 0) {
    suggestedCarbs = Math.ceil(-needed * carbRatio);
    warnings.push('insulin-on-board-exceeds-need');
  }

  const unroundedUnits = Math.max(0, needed * activityFactor);
  let units = roundDown(unroundedUnits, doseStep);
  if (settings.maxBolus !== undefined && units > settings.maxBolus) {
    units = settings.maxBolus;
    warnings.push('capped-at-max');
  }

  return {
    units,
    unroundedUnits,
    foodDose,
    correctionDose,
    insulinOnBoard: iob,
    carbsOnBoard,
    iobApplied,
    activityFactor,
    suggestedCarbs,
    timing: request.digestion
      ? suggestTiming(request.digestion, { correctionDose, isLow })
      : null,
    split: request.digestion === 'slow' ? splitDose(units, doseStep) : null,
    warnings,
  };
}

// Half now and half 1-2 hours later, as Think Like a Pancreas suggests for slow or very
// large meals. Pump users would do the same with an extended or dual-wave bolus.
function splitDose(units: number, doseStep: number): BolusSplit | null {
  const now = roundDown(units / 2, doseStep);
  if (now === 0) return null;
  return {
    now,
    later: Number((units - now).toFixed(4)),
    laterFromMinutes: 60,
    laterToMinutes: 120,
  };
}

function roundDown(value: number, step: number): number {
  // The epsilon keeps values like 2.9999999 (floating point noise for 3) from dropping a step.
  const steps = Math.floor(value / step + 1e-9);
  return Number((steps * step).toFixed(4));
}
