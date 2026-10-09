import { describe, expect, it } from 'vitest';
import { calculateEquivalentSchema, createFoodSchema, personSchema, prescriptionSchema, recipeDiscoverySchema, recipeEditSchema, shoppingPlanSchema } from './index';

describe('shared request contracts', () => {
  it('keeps the Ades portion pending rather than treating it as free or verified', () => {
    const ades = { name: 'Leche Ades sin azúcar', group: 'Lacteos', baseQuantity: null, unit: null, isFreeConsumption: false, portionPending: true, verified: false };
    expect(createFoodSchema.safeParse(ades).success).toBe(true);
    expect(createFoodSchema.safeParse({ ...ades, verified: true }).success).toBe(false);
    expect(createFoodSchema.safeParse({ ...ades, isFreeConsumption: true }).success).toBe(false);
  });
  it('rejects non-positive food portions and accepts explicit verification', () => {
    const food = { name: 'Dato manual', group: 'Frutas', baseQuantity: '0', unit: 'unidad', isFreeConsumption: false, verified: false };
    expect(createFoodSchema.safeParse(food).success).toBe(false);
    expect(createFoodSchema.safeParse({ ...food, baseQuantity: '1', verified: true }).success).toBe(true);
    expect(createFoodSchema.safeParse({ ...food, baseQuantity: '1/7', verified: true }).success).toBe(true);
  });

  it('models free-consumption foods without fabricated portions', () => {
    const freeFood = { name: 'Acelga', group: 'Verduras', baseQuantity: null, unit: null, isFreeConsumption: true, verified: true };
    expect(createFoodSchema.safeParse(freeFood).success).toBe(true);
    expect(createFoodSchema.safeParse({ ...freeFood, baseQuantity: '1', unit: 'pieza' }).success).toBe(false);
    expect(createFoodSchema.safeParse({ ...freeFood, group: 'Azucar' }).success).toBe(false);
  });

  it('accepts exact fractional quantities for equivalent calculations', () => {
    expect(calculateEquivalentSchema.safeParse({
      foodId: '00000000-0000-4000-8000-000000000001', quantity: '1/7', unit: 'piezas',
    }).success).toBe(true);
  });

  it('requires reviewed prescription data and a valid month', () => {
    const value = { month: '2026-10', reviewed: true, meals: [{ mealTime: 'Comida', group: 'Frutas', equivalents: '1' }] };
    expect(prescriptionSchema.safeParse(value).success).toBe(true);
    expect(prescriptionSchema.safeParse({ ...value, month: '2026-13' }).success).toBe(false);
    expect(prescriptionSchema.safeParse({ ...value, reviewed: false }).success).toBe(false);
  });

  it('preserves prescription metadata and rejects duplicate rows or incompatible dates', () => {
    const meal = { mealTime: 'Almuerzo', group: 'Verduras', equivalents: '1', requirementKind: 'free_guidance', preferredFoodId: null, notes: 'Libre' };
    const input = { month: '2026-10', indicatedOn: '2026-10-02', reviewed: true, meals: [meal] };
    expect(prescriptionSchema.parse(input)).toEqual(input);
    expect(prescriptionSchema.safeParse({ ...input, meals: [meal, meal] }).success).toBe(false);
    expect(prescriptionSchema.safeParse({ ...input, indicatedOn: '2026-11-02' }).success).toBe(false);
    expect(prescriptionSchema.safeParse({ ...input, indicatedOn: '2026-10-32' }).success).toBe(false);
  });

  it('accepts a person without restriction fields', () => {
    expect(personSchema.safeParse({ id: '00000000-0000-4000-8000-000000000001', name: 'Patricia', prescriptionComplete: true }).success).toBe(true);
  });

  it('requires one selected recipe per meal for up to six participants', () => {
    const participant = {
      personId: '00000000-0000-4000-8000-000000000001',
      meals: ['Desayuno', 'Almuerzo', 'Comida', 'Cena'].map((mealTime) => ({ mealTime, recipeIds: ['00000000-0000-4000-8000-000000000002'] })),
    };
    expect(shoppingPlanSchema.safeParse({ days: 3, participants: [participant] }).success).toBe(true);
    expect(shoppingPlanSchema.safeParse({ days: 6, participants: [{ ...participant, days: 4 }] }).success).toBe(true);
    expect(shoppingPlanSchema.safeParse({ days: 6, participants: [{ ...participant, days: 32 }] }).success).toBe(false);
    expect(shoppingPlanSchema.safeParse({ days: 3, participants: Array(7).fill(participant) }).success).toBe(false);
    expect(shoppingPlanSchema.safeParse({ days: 3, participants: [{ ...participant, meals: participant.meals.slice(0, 3) }] }).success).toBe(false);
  });

  it('requires recipe ingredients before confirming it for planning', () => {
    const recipe = { personId: '00000000-0000-4000-8000-000000000001', name: 'Desayuno', mealTime: 'Desayuno', sourceText: 'Texto', reviewNotes: [], instructions: [], ingredients: [], verify: true };
    expect(recipeEditSchema.safeParse(recipe).success).toBe(false);
    expect(recipeEditSchema.safeParse({ ...recipe, verify: false }).success).toBe(true);
    expect(recipeEditSchema.safeParse({ ...recipe, ingredients: [{ foodId: '00000000-0000-4000-8000-000000000001', quantity: '1', unit: 'taza', group: 'Frutas', isFreeConsumption: false }] }).success).toBe(false);
  });

  it('allows measured grocery quantities for free vegetables without making them portioned', () => {
    const ingredient = { foodId: '00000000-0000-4000-8000-000000000001', quantity: '2', unit: 'tazas', group: 'Verduras', isFreeConsumption: true };
    const recipe = { personId: '00000000-0000-4000-8000-000000000002', name: 'Ensalada', mealTime: 'Comida', sourceText: 'Ensalada al gusto', reviewNotes: [], instructions: ['Mezclar'], ingredients: [ingredient], verify: false };
    expect(recipeEditSchema.safeParse(recipe).success).toBe(true);
    expect(recipeEditSchema.safeParse({ ...recipe, ingredients: [{ ...ingredient, unit: null }] }).success).toBe(false);
  });

  it('requires a meal, profile and unique selected main ingredients for recipe discovery', () => {
    const input = { personId: '00000000-0000-4000-8000-000000000001', mealTime: 'Almuerzo', mainFoodIds: ['00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003'] };
    expect(recipeDiscoverySchema.safeParse(input).success).toBe(true);
    expect(recipeDiscoverySchema.safeParse({ ...input, mainFoodIds: [input.mainFoodIds[0], input.mainFoodIds[0]] }).success).toBe(false);
    expect(recipeDiscoverySchema.safeParse({ ...input, mainFoodIds: [] }).success).toBe(false);
  });
});