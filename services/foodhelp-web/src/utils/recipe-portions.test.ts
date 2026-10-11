import { describe, expect, it } from 'vitest';
import type { Food } from '@foodhelp/contracts';
import { defaultIngredientQuantity, prescriptionAlerts } from './recipe-portions';

const chicken: Food = { id: 'chicken', name: 'Pechuga de pollo', group: 'Proteinas', baseQuantity: '30', unit: 'g', isFreeConsumption: false, verifiedAt: null };
const meals = [{ mealTime: 'Comida', group: 'Proteinas' as const, equivalents: '4', requirementKind: 'exact' as const }];
const ingredient = (quantity: string) => ({ foodId: chicken.id, quantity, unit: 'g', group: chicken.group, isFreeConsumption: false });

describe('recipe portion defaults and advisory alerts', () => {
  it('fills the prescribed group budget and subtracts existing quantities', () => {
    expect(defaultIngredientQuantity(chicken, meals, [], 0, [chicken])).toBe('120');
    expect(defaultIngredientQuantity(chicken, meals, [ingredient('30')], 1, [chicken])).toBe('90');
    const egg: Food = { ...chicken, id: 'egg', name: 'Huevo', baseQuantity: '1', unit: 'piezas' };
    expect(defaultIngredientQuantity(chicken, meals, [{ ...ingredient('2'), foodId: egg.id, unit: 'piezas' }], 1, [chicken, egg])).toBe('60');
  });
  it('reports exact excess and shortfall without rejecting the draft', () => {
    expect(prescriptionAlerts(meals, [ingredient('150')], [chicken])[0]).toContain('excede 1 porciones');
    expect(prescriptionAlerts(meals, [ingredient('50')], [chicken])[0]).toContain('faltan 7/3 porciones');
    expect(prescriptionAlerts(meals, [ingredient('120')], [chicken])).toEqual([]);
  });
});