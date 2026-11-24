import { describe, expect, it } from 'vitest';
import { mergeRecipeIngredients } from './ingredients';

const tortilla = { foodId: 'tortilla', group: 'Cereales y leguminosas', unit: 'piezas', quantity: '1', isFreeConsumption: false };
describe('recipe ingredient consolidation', () => {
  it('adds quantities without changing the input', () => {
    expect(mergeRecipeIngredients([tortilla, tortilla])).toEqual([{ ...tortilla, quantity: '2' }]);
    expect(tortilla.quantity).toBe('1');
    expect(mergeRecipeIngredients([{ ...tortilla, quantity: '1/3' }, { ...tortilla, quantity: '1/6' }])[0].quantity).toBe('1/2');
  });
  it('does not merge incompatible units', () => {
    expect(mergeRecipeIngredients([tortilla, { ...tortilla, unit: 'g' }])).toHaveLength(2);
  });
});