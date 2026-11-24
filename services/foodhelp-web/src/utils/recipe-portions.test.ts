import { describe, expect, it } from 'vitest';
import type { Food } from '@foodhelp/contracts';
import { dailyPrescriptionTotals, defaultIngredientQuantity, prescriptionAlerts } from './recipe-portions';

const chicken: Food = { id: 'chicken', name: 'Pechuga de pollo', group: 'Proteinas', baseQuantity: '30', unit: 'g', isFreeConsumption: false, verifiedAt: null, purchaseUnits: [] };
const meals = [{ mealTime: 'Comida', group: 'Proteinas' as const, equivalents: '4', requirementKind: 'exact' as const }];
const ingredient = (quantity: string) => ({ foodId: chicken.id, quantity, unit: 'g', group: chicken.group, isFreeConsumption: false });

describe('recipe portion defaults and advisory alerts', () => {
  it('sums daily group totals exactly, including zero Colacion', () => {
    const totals = dailyPrescriptionTotals([
      { ...meals[0], mealTime: 'Almuerzo', equivalents: '1' },
      { ...meals[0], equivalents: '2' },
      { ...meals[0], mealTime: 'Colacion', equivalents: '0' },
      { ...meals[0], group: 'Frutas', equivalents: '0.1' },
      { ...meals[0], mealTime: 'Almuerzo', group: 'Frutas', equivalents: '0.2' },
    ]);
    expect(totals.get('Proteinas')).toBe('3');
    expect(totals.get('Frutas')).toBe('0.3');
  });
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