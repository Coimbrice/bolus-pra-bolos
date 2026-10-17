import { describe, expect, it } from 'vitest';
import { BolusInputError } from '../src/errors.js';
import {
  carbRatioFromTotalDailyDose,
  carbRatioFromWeight,
  sensitivityFromTotalDailyDose,
} from '../src/estimates.js';

describe('starting estimates', () => {
  it('applies the 500 rule', () => {
    expect(carbRatioFromTotalDailyDose(25)).toBe(20);
  });

  it('estimates the carb ratio from weight', () => {
    expect(carbRatioFromWeight(85)).toBe(10);
  });

  it('applies the 1700 rule and rounds up', () => {
    expect(sensitivityFromTotalDailyDose(30, 'mg/dL')).toBe(57);
    expect(sensitivityFromTotalDailyDose(30, 'mmol/L')).toBe(3.2);
  });

  it('rejects a non-positive daily dose', () => {
    expect(() => carbRatioFromTotalDailyDose(0)).toThrow(BolusInputError);
  });
});
