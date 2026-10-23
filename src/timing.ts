/**
 * How quickly the meal's carbs raise blood sugar. Use `slow` for low glycemic index foods
 * and also for long or very large meals.
 */
export type Digestion = 'fast' | 'moderate' | 'slow';

/** When to bolus, in minutes relative to the start of the meal. Negative is before. */
export interface BolusTiming {
  fromMinutes: number;
  toMinutes: number;
}

// From earliest to latest. The first three follow Think Like a Pancreas, ch. 7 (20-30 min
// before high GI foods, 5-10 min before moderate GI, at the meal for low GI). The last one
// is for when glucose is low and the bolus should wait until food is in.
const STEPS: readonly BolusTiming[] = [
  { fromMinutes: -30, toMinutes: -20 },
  { fromMinutes: -10, toMinutes: -5 },
  { fromMinutes: 0, toMinutes: 0 },
  { fromMinutes: 15, toMinutes: 30 },
];

const BASE_STEP: Record<Digestion, number> = { fast: 0, moderate: 1, slow: 2 };

export interface TimingContext {
  /** Correction dose for the current glucose: positive above target, negative below. */
  correctionDose: number;
  isLow: boolean;
}

/**
 * Suggests when to bolus. The book advises bolusing earlier when high before the meal and
 * later when low; here that means one step earlier when the correction is at least 1 U,
 * one step later when below target, and after eating when low.
 */
export function suggestTiming(digestion: Digestion, context: TimingContext): BolusTiming {
  let step = BASE_STEP[digestion];
  if (context.isLow) {
    step = STEPS.length - 1;
  } else if (context.correctionDose >= 1) {
    step = Math.max(0, step - 1);
  } else if (context.correctionDose < 0) {
    step = Math.min(STEPS.length - 2, step + 1);
  }
  return { ...STEPS[step]! };
}
