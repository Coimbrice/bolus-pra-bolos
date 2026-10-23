import { describe, expect, it } from 'vitest';
import { suggestTiming } from '../src/timing.js';

const inRange = { correctionDose: 0, isLow: false };

describe('suggestTiming', () => {
  it('follows the digestion speed', () => {
    expect(suggestTiming('fast', inRange)).toEqual({ fromMinutes: -30, toMinutes: -20 });
    expect(suggestTiming('moderate', inRange)).toEqual({
      fromMinutes: -10,
      toMinutes: -5,
    });
    expect(suggestTiming('slow', inRange)).toEqual({ fromMinutes: 0, toMinutes: 0 });
  });

  it('moves earlier when high before the meal', () => {
    const high = { correctionDose: 1.5, isLow: false };
    expect(suggestTiming('moderate', high)).toEqual({ fromMinutes: -30, toMinutes: -20 });
    expect(suggestTiming('fast', high)).toEqual({ fromMinutes: -30, toMinutes: -20 });
  });

  it('ignores small corrections', () => {
    expect(suggestTiming('moderate', { correctionDose: 0.5, isLow: false })).toEqual({
      fromMinutes: -10,
      toMinutes: -5,
    });
  });

  it('moves later when below target, but not past the meal', () => {
    const below = { correctionDose: -0.4, isLow: false };
    expect(suggestTiming('fast', below)).toEqual({ fromMinutes: -10, toMinutes: -5 });
    expect(suggestTiming('slow', below)).toEqual({ fromMinutes: 0, toMinutes: 0 });
  });

  it('waits until after eating when low', () => {
    const low = { correctionDose: -0.8, isLow: true };
    expect(suggestTiming('fast', low)).toEqual({ fromMinutes: 15, toMinutes: 30 });
  });
});
