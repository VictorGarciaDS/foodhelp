import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './index';

afterEach(() => vi.unstubAllGlobals());

describe('cliente API same-origin', () => {
  it('lists and deletes prescriptions using the selected person and CSRF header', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ prescriptions: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api.listPrescriptions('person-id')).resolves.toEqual([]);
    await expect(api.deletePrescription('person-id', 'prescription-id')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenLastCalledWith('/api/people/person-id/prescriptions/prescription-id', expect.objectContaining({ method: 'DELETE', headers: { 'x-foodhelp-request': '1' } }));
  });

  it('saves recipe edits and requests a deterministic shopping calculation', async () => {
    const recipe = { id: 'recipe-id', name: 'Receta', verifiedAt: null, personId: 'person-id', personName: 'Patricia', mealTime: 'Comida' as const, sourceText: 'Texto', reviewNotes: [], instructions: [], ingredients: [] };
    const result = { days: 3, participantCount: 1, usage: [], items: [{ foodId: 'food-id', name: 'Tortilla', unit: 'pieza', quantity: '18' }] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ recipe }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(result), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api.updateRecipe('recipe-id', { ...recipe, verify: false })).resolves.toMatchObject({ id: 'recipe-id' });
    await expect(api.calculateShopping({ days: 3, participants: [{ personId: 'person-id', meals: ['Desayuno', 'Almuerzo', 'Comida', 'Cena'].map((mealTime) => ({ mealTime: mealTime as 'Desayuno' | 'Almuerzo' | 'Comida' | 'Cena', recipeIds: ['recipe-id'] })) }] })).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenLastCalledWith('/api/shopping-list/calculate', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'x-foodhelp-request': '1' }) }));
  });
  it('carga alimentos del backend sin cambiar de origen', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.listFoods()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith('/api/foods', expect.objectContaining({ credentials: 'same-origin' }));
  });

  it('envía mutaciones al mismo origen con el encabezado CSRF acordado', async () => {
    const item = { id: '00000000-0000-4000-8000-000000000001', name: 'Dato familiar', group: 'Frutas', baseQuantity: '1', unit: 'unidad', verifiedAt: null };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ item }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    await api.createFood({ name: 'Dato familiar', group: 'Frutas', baseQuantity: '1', unit: 'unidad', isFreeConsumption: false, verified: false });
    expect(fetchMock).toHaveBeenCalledWith('/api/foods', expect.objectContaining({
      credentials: 'same-origin',
      headers: expect.objectContaining({ 'x-foodhelp-request': '1', 'Content-Type': 'application/json' }),
    }));
  });

  it('creates a recipe manually and searches saved matches before any AI request', async () => {
    const recipe = { id: 'recipe-id', name: 'Receta', verifiedAt: null, personId: 'person-id', personName: 'Patricia', mealTime: 'Comida', sourceText: 'Texto', reviewNotes: [], instructions: [], ingredients: [] };
    const matches = [{ ...recipe, matchCount: 1, matchedFoodIds: ['food-id'] }];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ recipe }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ matches }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api.createRecipe({ ...recipe, mealTime: 'Comida' as const, verify: false })).resolves.toMatchObject({ id: 'recipe-id' });
    await expect(api.findRecipeMatches({ personId: 'person-id', mealTime: 'Comida', mainFoodIds: ['food-id'] })).resolves.toEqual(matches);
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/recipes', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/recipes/matches', expect.objectContaining({ method: 'POST' }));
  });
});