import { assertNonNegative, assertPositive, BolusInputError } from './errors.js';

export interface NutritionLabel {
  totalCarbs: number;
  fiber?: number;
  sugarAlcohols?: number;
}

/**
 * Carbs that count toward the dose: fiber is subtracted entirely and sugar alcohols
 * by half, since they raise blood sugar less than other carbs (Think Like a Pancreas, ch. 4).
 */
export function netCarbs({
  totalCarbs,
  fiber = 0,
  sugarAlcohols = 0,
}: NutritionLabel): number {
  assertNonNegative('totalCarbs', totalCarbs);
  assertNonNegative('fiber', fiber);
  assertNonNegative('sugarAlcohols', sugarAlcohols);
  return Math.max(0, totalCarbs - fiber - sugarAlcohols / 2);
}

/**
 * Carbs in a weighed portion. The carb factor is the share of the food's weight that
 * is carbohydrate, e.g. 0.13 for an apple.
 */
export function carbsFromWeight(grams: number, carbFactor: number): number {
  assertNonNegative('grams', grams);
  if (!Number.isFinite(carbFactor) || carbFactor < 0 || carbFactor > 1) {
    throw new BolusInputError(`carbFactor must be between 0 and 1, got ${carbFactor}`);
  }
  return grams * carbFactor;
}

export interface Meal {
  time: Date;
  carbs: number;
  /** Overrides the default absorption time, e.g. longer for high-fat meals. */
  absorptionHours?: number;
}

export const DEFAULT_ABSORPTION_HOURS = 3;

/** Carbs from a past meal not yet absorbed, assuming a constant absorption rate. */
export function carbsRemaining(
  meal: Meal,
  now: Date,
  defaultAbsorptionHours = DEFAULT_ABSORPTION_HOURS,
): number {
  assertNonNegative('meal carbs', meal.carbs);
  const absorptionMinutes = (meal.absorptionHours ?? defaultAbsorptionHours) * 60;
  assertPositive('absorptionHours', absorptionMinutes);

  const elapsed = (now.getTime() - meal.time.getTime()) / 60_000;
  if (elapsed <= 0) return meal.carbs;
  if (elapsed >= absorptionMinutes) return 0;
  return meal.carbs * (1 - elapsed / absorptionMinutes);
}

export function carbsOnBoard(
  meals: readonly Meal[],
  now: Date,
  defaultAbsorptionHours = DEFAULT_ABSORPTION_HOURS,
): number {
  return meals.reduce(
    (total, meal) => total + carbsRemaining(meal, now, defaultAbsorptionHours),
    0,
  );
}
