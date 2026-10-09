import { once } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({ query: vi.fn(), transactionQuery: vi.fn(), release: vi.fn() }));
vi.mock('../db/pool', () => ({ getPool: () => ({ query: database.query, connect: async () => ({ query: database.transactionQuery, release: database.release }) }) }));

import { createApp } from '../app';

describe('catalog and prescription routes', () => {
  let server: ReturnType<ReturnType<typeof createApp>['listen']> | undefined;

  beforeEach(() => {
    vi.resetAllMocks();
    database.query.mockResolvedValue({ rows: [{ baseQuantity: '4', unit: 'pieza', isFreeConsumption: false, verifiedAt: '2026-10-05T12:00:00.000Z' }], rowCount: 1 });
    database.transactionQuery.mockResolvedValue({ rows: [{ id: '00000000-0000-4000-8000-000000000002', group: 'Lacteos' }], rowCount: 1 });
  });

  afterEach(async () => {
    if (server) {
      server.close();
      await once(server, 'close');
      server = undefined;
    }
    vi.clearAllMocks();
  });

  async function request(path: string, method = 'GET', body?: unknown) {
    server = createApp().listen(0);
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No ephemeral port assigned.');
    const origin = `http://127.0.0.1:${address.port}`;
    return fetch(`${origin}/api${path}`, {
      method,
      headers: { origin, 'x-foodhelp-request': '1', 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  async function calculate(unit: string) {
    return request('/equivalents/calculate', 'POST', { foodId: '00000000-0000-4000-8000-000000000001', quantity: '2', unit });
  }

  it('loads complete monthly prescriptions for the selected person', async () => {
    const records = [{ id: '00000000-0000-4000-8000-000000000002', month: '2026-10', meals: [{ mealTime: 'Comida', group: 'Proteinas', equivalents: '5' }] }];
    database.query.mockResolvedValueOnce({ rows: [{ id: '00000000-0000-4000-8000-000000000001' }], rowCount: 1 });
    database.query.mockResolvedValueOnce({ rows: records, rowCount: 1 });
    const response = await request('/people/00000000-0000-4000-8000-000000000001/prescriptions');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ prescriptions: records });
  });

  it('saves every row and preserves the consultation date, free guidance and preferred food', async () => {
    const preferredFoodId = '00000000-0000-4000-8000-000000000002';
    const response = await request('/people/00000000-0000-4000-8000-000000000001/prescription', 'PUT', {
      month: '2026-10', indicatedOn: '2026-10-02', reviewed: true,
      meals: [
        { mealTime: 'Desayuno', group: 'Lacteos', equivalents: '1', requirementKind: 'exact', preferredFoodId, notes: null },
        { mealTime: 'Comida', group: 'Verduras', equivalents: '2', requirementKind: 'free_guidance', notes: 'Libre' },
      ],
    });
    expect(response.status).toBe(200);
    const insertCalls = database.transactionQuery.mock.calls.filter(([sql]) => sql.includes('INSERT INTO foodhelp.prescription_items'));
    expect(insertCalls).toHaveLength(2);
    expect(insertCalls[0][1]).toEqual([preferredFoodId, 'Desayuno', 'Lacteos', '1', 'exact', preferredFoodId, null]);
    expect(insertCalls[1][1]).toEqual([preferredFoodId, 'Comida', 'Verduras', '2', 'free_guidance', null, 'Libre']);
    expect(database.transactionQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO foodhelp.prescriptions'), expect.arrayContaining(['2026-10-02']));
    expect(database.transactionQuery).toHaveBeenCalledWith('COMMIT');
    expect(database.release).toHaveBeenCalledOnce();
  });

  it('rolls back the monthly replacement if inserting a row fails', async () => {
    database.transactionQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO foodhelp.prescription_items')) throw new Error('Simulated insert failure');
      return { rows: [{ id: '00000000-0000-4000-8000-000000000002' }], rowCount: 1 };
    });
    const response = await request('/people/00000000-0000-4000-8000-000000000001/prescription', 'PUT', { month: '2026-10', reviewed: true, meals: [{ mealTime: 'Comida', group: 'Proteinas', equivalents: '5' }] });
    expect(response.status).toBe(500);
    expect(database.transactionQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(database.transactionQuery).not.toHaveBeenCalledWith('COMMIT');
    expect(database.release).toHaveBeenCalledOnce();
  });

  it('deletes a prescription only within the requested person', async () => {
    const personId = '00000000-0000-4000-8000-000000000001';
    const prescriptionId = '00000000-0000-4000-8000-000000000002';
    database.query.mockResolvedValueOnce({ rows: [{ id: prescriptionId }], rowCount: 1 });
    const response = await request(`/people/${personId}/prescriptions/${prescriptionId}`, 'DELETE');
    expect(response.status).toBe(204);
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining('AND person_id = $2'), [prescriptionId, personId]);
  });

  it('does not verify recipe ingredients that exceed the current group allowance', async () => {
    const personId = '00000000-0000-4000-8000-000000000001';
    const foodId = '00000000-0000-4000-8000-000000000002';
    const recipeId = '00000000-0000-4000-8000-000000000003';
    database.query.mockResolvedValueOnce({ rows: [{ personId }], rowCount: 1 });
    database.query.mockResolvedValueOnce({ rows: [{ id: personId }], rowCount: 1 });
    database.query.mockResolvedValueOnce({ rows: [{ id: foodId, name: 'Tortilla', group: 'Cereales y leguminosas', baseQuantity: '1', unit: 'pieza', isFreeConsumption: false, portionPending: false, verifiedAt: '2026-10-05T12:00:00Z' }], rowCount: 1 });
    database.query.mockResolvedValueOnce({ rows: [{ group: 'Cereales y leguminosas', equivalents: '1', requirementKind: 'exact' }], rowCount: 1 });
    const response = await request(`/recipes/${recipeId}`, 'PUT', {
      personId, name: 'Desayuno', mealTime: 'Desayuno', sourceText: 'Dos tortillas', reviewNotes: [], instructions: ['Servir'],
      ingredients: [{ foodId, quantity: '2', unit: 'pieza', group: 'Cereales y leguminosas', isFreeConsumption: false }], verify: true,
    });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(database.query).toHaveBeenCalledTimes(4);
  });

  it('saves a recipe edit as a draft with catalog-backed quantities', async () => {
    const personId = '00000000-0000-4000-8000-000000000001';
    const recipeId = '00000000-0000-4000-8000-000000000003';
    const foodId = '00000000-0000-4000-8000-000000000002';
    database.query.mockResolvedValueOnce({ rows: [{ personId }], rowCount: 1 });
    database.query.mockResolvedValueOnce({ rows: [{ id: personId }], rowCount: 1 });
    database.query.mockResolvedValueOnce({ rows: [{ id: foodId, name: 'Tortilla', group: 'Cereales y leguminosas', baseQuantity: '1', unit: 'pieza', isFreeConsumption: false, portionPending: false, verifiedAt: '2026-10-05T12:00:00Z' }], rowCount: 1 });
    database.query.mockResolvedValueOnce({ rows: [{ id: recipeId, name: 'Desayuno', verifiedAt: null, personId, mealTime: 'Desayuno', sourceText: 'Una tortilla', reviewNotes: ['Por revisar'], instructions: ['Calentar'], ingredients: [{ foodId, quantity: '1', unit: 'pieza', group: 'Cereales y leguminosas', isFreeConsumption: false }] }], rowCount: 1 });
    const response = await request(`/recipes/${recipeId}`, 'PUT', {
      personId, name: 'Desayuno', mealTime: 'Desayuno', sourceText: 'Una tortilla', reviewNotes: ['Por revisar'], instructions: ['Calentar'], verify: false,
      ingredients: [{ foodId, quantity: '1', unit: 'pieza', group: 'Cereales y leguminosas', isFreeConsumption: false }],
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.recipe.verifiedAt).toBeNull();
    expect(database.query.mock.calls[3][1][5]).toBe(JSON.stringify([{ foodId, quantity: '1', unit: 'pieza', group: 'Cereales y leguminosas', isFreeConsumption: false }]));
  });

  it('manually creates a recipe using the same exact prescription verification', async () => {
    const personId = '00000000-0000-4000-8000-000000000001';
    const foodId = '00000000-0000-4000-8000-000000000002';
    const recipeId = '00000000-0000-4000-8000-000000000003';
    database.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    database.query.mockResolvedValueOnce({ rows: [{ id: personId }], rowCount: 1 });
    database.query.mockResolvedValueOnce({ rows: [{ id: foodId, name: 'Tortilla', group: 'Cereales y leguminosas', baseQuantity: '1', unit: 'pieza', isFreeConsumption: false, portionPending: false, verifiedAt: '2026-10-05T12:00:00Z' }], rowCount: 1 });
    database.query.mockResolvedValueOnce({ rows: [{ group: 'Cereales y leguminosas', equivalents: '1', requirementKind: 'exact' }], rowCount: 1 });
    database.query.mockResolvedValueOnce({ rows: [{ id: recipeId, name: 'Tortilla sencilla', verifiedAt: '2026-10-06T12:00:00Z', personId, mealTime: 'Desayuno', personName: 'Patricia', sourceText: '1 tortilla', reviewNotes: [], instructions: ['Calentar'], ingredients: [{ foodId, quantity: '1', unit: 'pieza', group: 'Cereales y leguminosas', isFreeConsumption: false }] }], rowCount: 1 });
    const response = await request('/recipes', 'POST', {
      personId, name: 'Tortilla sencilla', mealTime: 'Desayuno', sourceText: '1 tortilla', reviewNotes: [], instructions: ['Calentar'], verify: true,
      ingredients: [{ foodId, quantity: '1', unit: 'pieza', group: 'Cereales y leguminosas', isFreeConsumption: false }],
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ recipe: { id: recipeId, verifiedAt: expect.any(String) } });
  });

  it('returns saved recipe matches ranked by selected main ingredients', async () => {
    const personId = '00000000-0000-4000-8000-000000000001';
    const foodA = '00000000-0000-4000-8000-000000000002';
    const foodB = '00000000-0000-4000-8000-000000000003';
    database.query.mockResolvedValueOnce({ rows: [{ id: personId }], rowCount: 1 });
    database.query.mockResolvedValueOnce({ rows: [{ id: foodA }, { id: foodB }], rowCount: 2 });
    database.query.mockResolvedValueOnce({ rows: [
      { id: '00000000-0000-4000-8000-000000000004', name: 'Coincidencia simple', ingredients: [{ foodId: foodA }], verifiedAt: null },
      { id: '00000000-0000-4000-8000-000000000005', name: 'Coincidencia completa', ingredients: [{ foodId: foodA }, { foodId: foodB }], verifiedAt: '2026-10-06T12:00:00Z' },
    ], rowCount: 2 });
    const response = await request('/recipes/matches', 'POST', { personId, mealTime: 'Almuerzo', mainFoodIds: [foodA, foodB] });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ matches: [
      { name: 'Coincidencia completa', matchCount: 2 },
      { name: 'Coincidencia simple', matchCount: 1 },
    ] });
  });

  it('creates and verifies the specified Ades, Habits, Oroweat and walnuts dinner', async () => {
    const personId = '00000000-0000-4000-8000-000000000001';
    const foodIds = {
      ades: '00000000-0000-4000-8000-000000000002',
      habits: '00000000-0000-4000-8000-000000000003',
      bread: '00000000-0000-4000-8000-000000000004',
      walnuts: '00000000-0000-4000-8000-000000000005',
    };
    database.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    database.query.mockResolvedValueOnce({ rows: [{ id: personId }], rowCount: 1 });
    database.query.mockResolvedValueOnce({ rows: [
      { id: foodIds.ades, name: 'Leche Ades sin azúcar', group: 'Lacteos', baseQuantity: '1', unit: 'taza', isFreeConsumption: false, portionPending: false, verifiedAt: '2026-10-06T12:00:00.000Z' },
      { id: foodIds.habits, name: 'Proteína vegana Habits', group: 'Proteinas', baseQuantity: '1', unit: 'cucharada', isFreeConsumption: false, portionPending: false, verifiedAt: '2026-10-06T12:00:00.000Z' },
      { id: foodIds.bread, name: 'Pan de centeno Oroweat', group: 'Cereales y leguminosas', baseQuantity: '1', unit: 'rebanada', isFreeConsumption: false, portionPending: false, verifiedAt: '2026-10-06T12:00:00.000Z' },
      { id: foodIds.walnuts, name: 'Nueces', group: 'Grasas', baseQuantity: '4', unit: 'piezas', isFreeConsumption: false, portionPending: false, verifiedAt: '2026-10-06T12:00:00.000Z' },
    ], rowCount: 4 });
    database.query.mockResolvedValueOnce({ rows: [
      { group: 'Lacteos', equivalents: '1', requirementKind: 'exact' },
      { group: 'Proteinas', equivalents: '2', requirementKind: 'exact' },
      { group: 'Cereales y leguminosas', equivalents: '1', requirementKind: 'exact' },
      { group: 'Grasas', equivalents: '1', requirementKind: 'exact' },
    ], rowCount: 4 });
    database.query.mockResolvedValueOnce({ rows: [{ id: '00000000-0000-4000-8000-000000000006', verifiedAt: '2026-10-06T12:00:00.000Z' }], rowCount: 1 });
    const ingredients = [
      { foodId: foodIds.ades, quantity: '1', unit: 'taza', group: 'Lacteos', isFreeConsumption: false },
      { foodId: foodIds.habits, quantity: '2', unit: 'cucharada', group: 'Proteinas', isFreeConsumption: false },
      { foodId: foodIds.bread, quantity: '1', unit: 'rebanada', group: 'Cereales y leguminosas', isFreeConsumption: false },
      { foodId: foodIds.walnuts, quantity: '4', unit: 'piezas', group: 'Grasas', isFreeConsumption: false },
    ];
    const response = await request('/recipes', 'POST', {
      personId, name: 'Licuado de Ades y Habits con Oroweat y nueces', mealTime: 'Cena',
      sourceText: '1 vaso de leche Ades con 2 cucharadas de proteína Habits, 1 rebanada de pan Oroweat y 4 nueces.',
      reviewNotes: [], instructions: ['Licuar la leche Ades con la proteína Habits.', 'Acompañar con el pan Oroweat y las nueces.'], ingredients, verify: true,
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ recipe: { verifiedAt: expect.any(String) } });
  });

  it('sums the same food by unit across participants and their individual day counts', async () => {
    const firstPerson = '00000000-0000-4000-8000-000000000001';
    const secondPerson = '00000000-0000-4000-8000-000000000002';
    const tortillaId = '00000000-0000-4000-8000-000000000003';
    const recipeIds = Array.from({ length: 8 }, (_value, index) => `00000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`);
    database.query.mockResolvedValueOnce({ rows: [{ id: firstPerson }, { id: secondPerson }], rowCount: 2 });
    database.query.mockResolvedValueOnce({ rows: [firstPerson, secondPerson].flatMap((personId, personIndex) =>
      ['Desayuno', 'Almuerzo', 'Comida', 'Cena'].map((mealTime, mealIndex) => ({
        id: recipeIds[personIndex * 4 + mealIndex], personId, mealTime,
        ingredients: [{ foodId: tortillaId, quantity: personIndex ? '3' : '2', unit: 'pieza', isFreeConsumption: false }],
      })),
    ), rowCount: 8 });
    database.query.mockResolvedValueOnce({ rows: [{ id: tortillaId, name: 'Tortilla de maíz' }], rowCount: 1 });
    const mealSelection = (offset: number) => ['Desayuno', 'Almuerzo', 'Comida', 'Cena'].map((mealTime, index) => ({ mealTime, recipeIds: [recipeIds[offset + index]] }));
    const response = await request('/shopping-list/calculate', 'POST', {
      days: 6,
      participants: [
        { personId: firstPerson, days: 6, meals: mealSelection(0) },
        { personId: secondPerson, days: 4, meals: mealSelection(4) },
      ],
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      participantCount: 2,
      participants: [{ personId: firstPerson, days: 6 }, { personId: secondPerson, days: 4 }],
      items: [{ foodId: tortillaId, name: 'Tortilla de maíz', unit: 'pieza', quantity: '96' }],
    });
  });

  it('returns a consolidated shopping list from verified recipes', async () => {
    const personId = '00000000-0000-4000-8000-000000000001';
    const foodId = '00000000-0000-4000-8000-000000000003';
    const freeFoodId = '00000000-0000-4000-8000-000000000004';
    const recipeIds = Array.from({ length: 4 }, (_value, index) => `00000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`);
    database.query.mockResolvedValueOnce({ rows: [{ id: personId }], rowCount: 1 });
    database.query.mockResolvedValueOnce({ rows: ['Desayuno', 'Almuerzo', 'Comida', 'Cena'].map((mealTime, index) => ({
      id: recipeIds[index], personId, mealTime, ingredients: [
        { foodId, quantity: '2', unit: 'pieza', isFreeConsumption: false },
        { foodId: freeFoodId, quantity: '1/2', unit: 'taza', isFreeConsumption: true },
      ],
    })), rowCount: 4 });
    database.query.mockResolvedValueOnce({ rows: [{ id: foodId, name: 'Tortilla' }, { id: freeFoodId, name: 'Espinaca' }], rowCount: 2 });
    const meals = ['Desayuno', 'Almuerzo', 'Comida', 'Cena'].map((mealTime, index) => ({ mealTime, recipeIds: [recipeIds[index]] }));
    const response = await request('/shopping-list/calculate', 'POST', { days: 3, participants: [{ personId, days: 3, meals }] });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      participantCount: 1,
      items: expect.arrayContaining([
        { foodId, name: 'Tortilla', quantity: '24', unit: 'pieza' },
        { foodId: freeFoodId, name: 'Espinaca', quantity: '6', unit: 'taza' },
      ]),
    });
  });

  it('returns the reduced rational result for the saved food unit', async () => {
    const response = await calculate('pieza');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ numerator: '1', denominator: '2', decimal: '0.5' });
  });

  it('rejects an incompatible unit instead of converting it', async () => {
    const response = await calculate('gramo');
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('rejects a catalog entry that has not been verified', async () => {
    database.query.mockResolvedValueOnce({ rows: [{ baseQuantity: '4', unit: 'pieza', isFreeConsumption: false, verifiedAt: null }], rowCount: 1 });
    const response = await calculate('pieza');
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('rejects equivalence calculations for free-consumption foods', async () => {
    database.query.mockResolvedValueOnce({ rows: [{ baseQuantity: null, unit: null, isFreeConsumption: true, verifiedAt: '2026-10-05T12:00:00.000Z' }], rowCount: 1 });
    const response = await calculate('pieza');
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});