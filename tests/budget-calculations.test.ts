import { describe, expect, it } from 'vitest';
import { calculateLineAmount, sumLineAmounts } from '../lib/budget-calculations';

describe('budget calculations', () => {
  it('rounds each line to cents before summing', () => {
    expect(calculateLineAmount(3, 10.555)).toBe(31.67);
    expect(calculateLineAmount(0.5, 0.01)).toBe(0.01);
    expect(sumLineAmounts([
      { quantity: 3, unitValue: 10.555 },
      { quantity: 2, unitValue: 0.105 },
    ])).toBe(31.88);
    expect(sumLineAmounts([
      { quantity: 0.5, unitValue: 0.01 },
      { quantity: 0.5, unitValue: 0.01 },
    ])).toBe(0.02);
  });

  it('ignores invalid values instead of producing NaN', () => {
    expect(calculateLineAmount(Number.NaN, 10)).toBe(0);
    expect(calculateLineAmount(2, -1)).toBe(0);
    expect(sumLineAmounts([{ quantity: 1, unitValue: Number.POSITIVE_INFINITY }])).toBe(0);
  });

  it('returns zero for an empty budget', () => {
    expect(sumLineAmounts([])).toBe(0);
  });
});
