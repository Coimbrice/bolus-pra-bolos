import { describe, expect, it } from 'vitest';
import { carbsFromWeight, carbsOnBoard, carbsRemaining, netCarbs } from '../src/carbs.js';
import { BolusInputError } from '../src/errors.js';

const at = (hours: number, minutes = 0) => new Date(2026, 9, 22, hours, minutes);

describe('netCarbs', () => {
  it('subtracts fiber', () => {
    expect(netCarbs({ totalCarbs: 31, fiber: 8 })).toBe(23);
  });

  it('subtracts half of the sugar alcohols', () => {
    expect(netCarbs({ totalCarbs: 20, sugarAlcohols: 10 })).toBe(15);
  });

  it('never goes below zero', () => {
    expect(netCarbs({ totalCarbs: 5, fiber: 8 })).toBe(0);
  });

  it('rejects negative values', () => {
    expect(() => netCarbs({ totalCarbs: -1 })).toThrow(BolusInputError);
  });
});

describe('carbsFromWeight', () => {
  it('multiplies weight by the carb factor', () => {
    expect(carbsFromWeight(120, 0.13)).toBeCloseTo(15.6);
  });

  it('rejects factors outside 0..1', () => {
    expect(() => carbsFromWeight(100, 13)).toThrow(BolusInputError);
  });
});

describe('carbs on board', () => {
  const lunch = { time: at(12), carbs: 60 };

  it('absorbs linearly over the absorption time', () => {
    expect(carbsRemaining(lunch, at(12))).toBe(60);
    expect(carbsRemaining(lunch, at(13))).toBeCloseTo(40);
    expect(carbsRemaining(lunch, at(15))).toBe(0);
  });

  it('respects a per-meal absorption time', () => {
    const pizza = { time: at(20), carbs: 80, absorptionHours: 5 };
    expect(carbsRemaining(pizza, at(22, 30))).toBeCloseTo(40);
  });

  it('adds up several meals', () => {
    const snack = { time: at(13, 30), carbs: 15 };
    expect(carbsOnBoard([lunch, snack], at(14))).toBeCloseTo(20 + 12.5);
  });
});
