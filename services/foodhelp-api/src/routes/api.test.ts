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
    database.transactionQuery.mockImplementation(async (sql: string) => sql.includes('FROM foodhelp.recipes r')
      ? { rows: [], rowCount: 0 }
      : { rows: [{ id: '00000000-0000-4000-8000-000000000002', group: 'Lacteos' }], rowCount: 1 });
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

  function sharedShoppingFixture(menuCount = 1) {
    const profiles = ['Patricia', 'Laura', 'Victor'].map((name, index) => ({ id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, name }));
    const foodId = '00000000-0000-4000-8000-000000000004';
    const bases = ['Desayuno', 'Almuerzo', 'Comida', 'Cena'].flatMap((mealTime, index) => Array.from({ length: menuCount }, (_value, day) => ({
      id: `00000000-0000-4000-8000-${String(index * 3 + day + 10).padStart(12, '0')}`,
      name: `${mealTime} base ${day + 1}`, personId: null, mealTime, verifiedAt: '2026-10-05T12:00:00Z',
      instructions: ['Pasos base'], ingredients: [{ foodId, quantity: '999', unit: 'piezas', group: 'Cereales y leguminosas', isFreeConsumption: false }],
    })));
    const quantities = [['1/3', '2/3'], ['1/2', '1'], ['1', '2']];
    const copies = profiles.flatMap((person, profileIndex) => bases.map((base, baseIndex) => ({
      ...base, id: `00000000-0000-4000-8000-${String(profileIndex * 30 + baseIndex + 100).padStart(12, '0')}`,
      name: `Nombre personalizado ${profileIndex}`, personId: person.id, baseRecipeId: base.id,
      instructions: [`Pasos de ${person.name}`], ingredients: [{ ...base.ingredients[0], quantity: quantities[profileIndex][baseIndex % menuCount] }],
    })));
    const meals = ['Desayuno', 'Almuerzo', 'Comida', 'Cena'].map((mealTime) => ({ mealTime, recipeIds: bases.filter((base) => base.mealTime === mealTime).map((base) => base.id) }));
    return { profiles, bases, copies, meals, foodId };
  }

  function mockSharedShopping(fixture: ReturnType<typeof sharedShoppingFixture>, recipeRows = [...fixture.bases, ...fixture.copies]) {
    database.query.mockResolvedValueOnce({ rows: fixture.profiles, rowCount: fixture.profiles.length });
    database.query.mockResolvedValueOnce({ rows: recipeRows, rowCount: recipeRows.length });
    database.query.mockResolvedValueOnce({ rows: [{ id: fixture.foodId, name: 'Ingrediente comun', group: 'Cereales y leguminosas', purchaseUnits: [
      { unitName: 'paquetes', quantity: '12', unit: 'piezas', purchaseQuantity: '1', purchaseUnit: 'paquetes', isConfirmed: true, isApproximate: false, roundUp: true },
    ] }], rowCount: 1 });
  }

  it.each([
    { counts: [1, 1, 1], menus: 1, duration: 1, total: '22/3', packages: '1' },
    { counts: [3, 1, 1], menus: 1, duration: 2, total: '20', packages: '2' },
    { counts: [1, 2, 1], menus: 1, duration: 2, total: '56/3', packages: '2' },
    { counts: [1, 1, 1], menus: 2, duration: 2, total: '44', packages: '4' },
  ])('sums adapted copies for shared menus and profile counts $counts over $duration days', async ({ counts, menus, duration, total, packages }) => {
    const fixture = sharedShoppingFixture(menus);
    mockSharedShopping(fixture);
    const response = await request('/shopping-list/calculate', 'POST', {
      days: menus, daysPerDish: duration, meals: fixture.meals,
      participants: fixture.profiles.map((profile, index) => ({ personId: profile.id, peopleCount: counts[index] })),
    });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.items[0]).toMatchObject({ quantity: total, purchaseOptions: [{ quantity: packages }] });
    expect(result.peopleCount).toBe(counts.reduce((sum, count) => sum + count, 0));
    expect(result.usage).toHaveLength(12 * menus);
    expect(result.menu).toHaveLength(4 * menus * duration);
    expect(result.participants.map((profile: { peopleCount: number }) => profile.peopleCount)).toEqual(counts);
    expect(result.recipes[0]).toMatchObject({ personName: 'Patricia', instructions: ['Pasos de Patricia'] });
    expect(database.query.mock.calls.some(([sql]) => /INSERT|UPDATE|DELETE/.test(sql))).toBe(false);
  });

  it('defaults all profiles to one diner when no profile list is provided', async () => {
    const fixture = sharedShoppingFixture();
    mockSharedShopping(fixture);
    const response = await request('/shopping-list/calculate', 'POST', { days: 1, meals: fixture.meals });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.peopleCount).toBe(3);
    expect(result.items[0].quantity).toBe('22/3');
    expect(result.participants.every((profile: { peopleCount: number }) => profile.peopleCount === 1)).toBe(true);
  });

  it.each(['missing', 'draft', 'unlinked'])('blocks an unavailable adapted copy instead of using base quantities: %s', async (problem) => {
    const fixture = sharedShoppingFixture();
    const first = fixture.copies[0];
    const copies = fixture.copies.filter((copy) => copy.id !== first.id);
    if (problem === 'draft') copies.push({ ...first, verifiedAt: '' });
    if (problem === 'unlinked') copies.push({ ...first, name: fixture.bases[0].name, baseRecipeId: '' });
    mockSharedShopping(fixture, [...fixture.bases, ...copies]);
    const response = await request('/shopping-list/calculate', 'POST', { days: 1, meals: fixture.meals });
    expect(response.status).toBe(409);
    const result = await response.json();
    expect(result.error.message).toContain('Patricia');
    expect(result.error.message).toContain(fixture.bases[0].name);
    expect(database.query).toHaveBeenCalledTimes(2);
  });

  it('does not require an adapted copy for a profile excluded with zero diners', async () => {
    const fixture = sharedShoppingFixture();
    mockSharedShopping(fixture, [...fixture.bases, ...fixture.copies.filter((copy) => copy.personId !== fixture.profiles[2].id)]);
    const response = await request('/shopping-list/calculate', 'POST', {
      days: 1, meals: fixture.meals,
      participants: fixture.profiles.map((profile, index) => ({ personId: profile.id, peopleCount: index === 2 ? 0 : 1 })),
    });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.peopleCount).toBe(2);
    expect(result.items[0].quantity).toBe('10/3');
    expect(result.participants).toHaveLength(2);
  });

  it('creates a profile with base copies in draft without requiring a source profile or prescription', async () => {
    const personId = '00000000-0000-4000-8000-000000000001';
    const foodId = '00000000-0000-4000-8000-000000000002';
    const baseId = '00000000-0000-4000-8000-000000000003';
    const ingredients = [{ foodId, quantity: '90', unit: 'g', group: 'Proteinas', isFreeConsumption: false }];
    database.transactionQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO foodhelp.people') || sql.includes('SELECT id FROM foodhelp.people')) return { rows: [{ id: personId, name: 'Nuevo' }], rowCount: 1 };
      if (sql.includes('FROM foodhelp.recipes r')) return { rows: [{ id: baseId, name: 'Base', mealTime: 'Comida', instructions: ['Cocinar'], ingredients, reviewNotes: [], verifiedAt: '2026-10-05T12:00:00Z' }], rowCount: 1 };
      if (sql.includes('FROM foodhelp.foods')) return { rows: [{ id: foodId, baseQuantity: '30' }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const response = await request('/people', 'POST', { name: 'Nuevo' });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ person: { id: personId, prescriptionComplete: false }, inheritance: { copied: 1, verified: 0, drafts: 1 } });
    const insert = database.transactionQuery.mock.calls.find(([sql]) => sql.includes('INSERT INTO foodhelp.recipes'))!;
    expect(JSON.parse(insert[1][1])[0]).toMatchObject({ ingredients, verify: false, baseRecipeId: baseId });
    expect(database.query).not.toHaveBeenCalled();
    expect(database.transactionQuery.mock.calls.at(-1)?.[0]).toBe('COMMIT');
  });

  it.each(['2', '4'])('recalculates existing copies directly from bases when the prescription becomes %s portions', async (equivalents) => {
    const personId = '00000000-0000-4000-8000-000000000001';
    const foodId = '00000000-0000-4000-8000-000000000002';
    const baseId = '00000000-0000-4000-8000-000000000003';
    const ingredients = [{ foodId, quantity: '90', unit: 'g', group: 'Proteinas', isFreeConsumption: false }];
    const catalogFood = { id: foodId, group: 'Proteinas', baseQuantity: '30', unit: 'g', isFreeConsumption: false, portionPending: false, verifiedAt: '2026-10-05T12:00:00Z' };
    database.transactionQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM foodhelp.people')) return { rows: [{ id: personId, basePersonId: baseId }], rowCount: 1 };
      if (sql.includes('INSERT INTO foodhelp.prescriptions')) return { rows: [{ id: personId }], rowCount: 1 };
      if (sql.includes('FROM foodhelp.recipes r')) return { rows: [{ id: baseId, name: 'Base', mealTime: 'Comida', instructions: ['Cocinar'], ingredients, reviewNotes: [], verifiedAt: '2026-10-05T12:00:00Z' }], rowCount: 1 };
      if (sql.includes('FROM foodhelp.foods')) return { rows: [catalogFood], rowCount: 1 };
      if (sql.includes('FROM foodhelp.prescription_items')) return { rows: [{ mealTime: 'Comida', group: 'Proteinas', equivalents, requirementKind: 'exact' }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const response = await request(`/people/${personId}/prescription`, 'PUT', {
      month: '2026-11', reviewed: true, meals: [{ mealTime: 'Comida', group: 'Proteinas', equivalents }],
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ inheritance: { copied: 1, verified: 1 } });
    const insert = database.transactionQuery.mock.calls.find(([sql]) => sql.includes('INSERT INTO foodhelp.recipes'))!;
    expect(JSON.parse(insert[1][1])[0].ingredients).toEqual([{ ...ingredients[0], quantity: String(Number(equivalents) * 30) }]);
    expect(insert[0]).toContain('DO UPDATE SET');
    expect(ingredients[0].quantity).toBe('90');
    expect(database.transactionQuery.mock.calls.some(([sql]) => /(?:UPDATE|INSERT INTO) foodhelp\.foods/.test(sql))).toBe(false);
    expect(database.query).not.toHaveBeenCalled();
  });

  it('rolls back prescription changes if synchronizing the recipes fails', async () => {
    const implementation = database.transactionQuery.getMockImplementation()!;
    database.transactionQuery.mockImplementation(async (sql: string, values: unknown[]) => {
      if (sql.includes('FROM foodhelp.recipes r')) throw new Error('Synchronizing failed');
      return implementation(sql, values);
    });
    const response = await request('/people/00000000-0000-4000-8000-000000000001/prescription', 'PUT', {
      month: '2026-11', reviewed: true, meals: [{ mealTime: 'Comida', group: 'Proteinas', equivalents: '2' }],
    });
    expect(response.status).toBe(500);
    expect(database.transactionQuery).toHaveBeenCalledWith('ROLLBACK');
    expect(database.transactionQuery).not.toHaveBeenCalledWith('COMMIT');
  });

  it('rejects a duplicate food instead of introducing a replacement equivalence', async () => {
    database.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const response = await request('/foods', 'POST', { name: 'Alimento existente', group: 'Proteinas', baseQuantity: '999', unit: 'g', isFreeConsumption: false, verified: true });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'CONFLICT' } });
    expect(database.query.mock.calls[0][0]).toContain('ON CONFLICT DO NOTHING');
    expect(database.query.mock.calls.some(([sql]) => sql.includes('UPDATE foodhelp.foods'))).toBe(false);
  });

  it('copies an independent base proportionally and verifies it against the target prescription', async () => {
    const personId = '00000000-0000-4000-8000-000000000001';
    const foodId = '00000000-0000-4000-8000-000000000002';
    const recipeId = '00000000-0000-4000-8000-000000000003';
    const ingredient = { foodId, quantity: '30', unit: 'g', group: 'Proteinas', isFreeConsumption: false };
    const catalogFood = { id: foodId, group: 'Proteinas', baseQuantity: '30', unit: 'g', isFreeConsumption: false, portionPending: false, verifiedAt: '2026-10-05T12:00:00Z' };
    database.transactionQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    database.transactionQuery.mockResolvedValueOnce({ rows: [{ id: personId }], rowCount: 1 });
    database.transactionQuery.mockResolvedValueOnce({ rows: [{ mealTime: 'Comida', group: 'Proteinas', equivalents: '2', requirementKind: 'exact' }], rowCount: 1 });
    database.transactionQuery.mockResolvedValueOnce({ rows: [{ id: recipeId, name: 'Base', mealTime: 'Comida', sourceText: 'Base', reviewNotes: [], instructions: ['Cocinar'], ingredients: [ingredient], verifiedAt: '2026-10-05T12:00:00Z' }], rowCount: 1 });
    database.transactionQuery.mockResolvedValueOnce({ rows: [catalogFood], rowCount: 1 });
    database.transactionQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const response = await request(`/people/${personId}/inherit-recipes`, 'POST', { basePersonId: null });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ inheritance: { copied: 1, proportional: 1, verified: 1 } });
    const insert = database.transactionQuery.mock.calls.find(([sql]) => sql.includes('INSERT INTO foodhelp.recipes'))!;
    expect(JSON.parse(insert[1][1])[0]).toMatchObject({ ingredients: [{ ...ingredient, quantity: '60' }], baseRecipeId: recipeId });
    expect(insert[0]).toContain('DO UPDATE SET');
    expect(database.transactionQuery.mock.calls.at(-1)?.[0]).toBe('COMMIT');
  });

  it('synchronizes many verified recipes with one catalog read and one batch write', async () => {
    const personId = '00000000-0000-4000-8000-000000000001';
    const foodId = '00000000-0000-4000-8000-000000000002';
    const bases = Array.from({ length: 50 }, (_value, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`,
      name: `Base ${index}`, mealTime: 'Comida', instructions: ['Cocinar'], reviewNotes: [], verifiedAt: '2026-10-05T12:00:00Z',
      ingredients: [{ foodId, quantity: '30', unit: 'g', group: 'Proteinas', isFreeConsumption: false }],
    }));
    database.transactionQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM foodhelp.people') || sql.includes('INSERT INTO foodhelp.prescriptions')) return { rows: [{ id: personId }], rowCount: 1 };
      if (sql.includes('FROM foodhelp.recipes r')) return { rows: bases, rowCount: bases.length };
      if (sql.includes('FROM foodhelp.foods')) return { rows: [{ id: foodId, group: 'Proteinas', baseQuantity: '30', unit: 'g', isFreeConsumption: false, portionPending: false, verifiedAt: '2026-10-05T12:00:00Z' }], rowCount: 1 };
      if (sql.includes('FROM foodhelp.prescription_items')) return { rows: [{ mealTime: 'Comida', group: 'Proteinas', equivalents: '2', requirementKind: 'exact' }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const response = await request(`/people/${personId}/prescription`, 'PUT', {
      month: '2026-12', reviewed: true, meals: [{ mealTime: 'Comida', group: 'Proteinas', equivalents: '2' }],
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ inheritance: { copied: 50, verified: 50 } });
    const writes = database.transactionQuery.mock.calls.filter(([sql]) => sql.includes('INSERT INTO foodhelp.recipes'));
    expect(writes).toHaveLength(1);
    expect(JSON.parse(writes[0][1][1])).toHaveLength(50);
    expect(database.transactionQuery.mock.calls.filter(([sql]) => sql.includes('FROM foodhelp.foods'))).toHaveLength(1);
  });
    it('does not verify a synchronized copy when the shared catalog contains an unverified ingredient', async () => {
      const personId = '00000000-0000-4000-8000-000000000001';
      const foodId = '00000000-0000-4000-8000-000000000002';
      database.transactionQuery.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM foodhelp.people') || sql.includes('INSERT INTO foodhelp.prescriptions')) return { rows: [{ id: personId }], rowCount: 1 };
        if (sql.includes('FROM foodhelp.recipes r')) return { rows: [{
          id: '00000000-0000-4000-8000-000000000003', name: 'Base', mealTime: 'Comida', instructions: ['Cocinar'], reviewNotes: [], verifiedAt: '2026-10-05T12:00:00Z',
          ingredients: [{ foodId, quantity: '30', unit: 'g', group: 'Proteinas', isFreeConsumption: false }],
        }], rowCount: 1 };
        if (sql.includes('FROM foodhelp.foods')) return { rows: [{ id: foodId, group: 'Proteinas', baseQuantity: '30', unit: 'g', isFreeConsumption: false, portionPending: false, verifiedAt: null }], rowCount: 1 };
        if (sql.includes('FROM foodhelp.prescription_items')) return { rows: [{ mealTime: 'Comida', group: 'Proteinas', equivalents: '1', requirementKind: 'exact' }], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      });
      const response = await request(`/people/${personId}/prescription`, 'PUT', {
        month: '2026-12', reviewed: true, meals: [{ mealTime: 'Comida', group: 'Proteinas', equivalents: '1' }],
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ inheritance: { verified: 0, drafts: 1 } });
      const write = database.transactionQuery.mock.calls.find(([sql]) => sql.includes('INSERT INTO foodhelp.recipes'))!;
      expect(JSON.parse(write[1][1])[0]).toMatchObject({ verify: false, reviewNotes: [expect.stringContaining('verificado')] });
    });

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
    expect(insertCalls).toHaveLength(9);
    expect(insertCalls[0][1]).toEqual([preferredFoodId, 'Desayuno', 'Lacteos', '1', 'exact', preferredFoodId, null]);
    expect(insertCalls[1][1]).toEqual([preferredFoodId, 'Comida', 'Verduras', '2', 'free_guidance', null, 'Libre']);
    expect(insertCalls.slice(2).every((call) => call[1][1] === 'Colacion' && call[1][3] === '0')).toBe(true);
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
      expect(database.transactionQuery).toHaveBeenCalledWith(expect.stringContaining('AND person_id = $2'), [prescriptionId, personId]);
      expect(database.transactionQuery.mock.calls.at(-1)?.[0]).toBe('COMMIT');
  });

  it('saves package conversions for a catalog food transactionally', async () => {
    const foodId = '00000000-0000-4000-8000-000000000001';
    database.query.mockResolvedValueOnce({ rows: [{ isFreeConsumption: false, unit: 'rebanada' }], rowCount: 1 });
    const response = await request(`/foods/${foodId}/purchase-units`, 'PUT', {
      purchaseUnits: [{ unitName: 'paquetes', quantity: '12', unit: 'rebanadas', purchaseQuantity: '1', purchaseUnit: 'paquetes', isConfirmed: true, isApproximate: false, roundUp: true }],
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ purchaseUnits: [{ unitName: 'paquetes', quantity: '12', unit: 'rebanadas', purchaseQuantity: '1', purchaseUnit: 'paquetes', isConfirmed: true, isApproximate: false, roundUp: true }] });
    expect(database.transactionQuery).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(database.transactionQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO foodhelp.food_purchase_units'),
      [foodId, 'paquetes', '12', 'rebanadas', '1', 'paquetes', true, false, true],
    );
    expect(database.transactionQuery).toHaveBeenLastCalledWith('COMMIT');
    expect(database.release).toHaveBeenCalledOnce();
  });

  it('rejects purchase packs that use an incompatible ingredient unit', async () => {
    const foodId = '00000000-0000-4000-8000-000000000001';
    database.query.mockResolvedValueOnce({ rows: [{ isFreeConsumption: false, unit: 'rebanada' }], rowCount: 1 });
    const response = await request(`/foods/${foodId}/purchase-units`, 'PUT', {
      purchaseUnits: [{ unitName: 'paquetes', quantity: '11', unit: 'tazas' }],
    });
    expect(response.status).toBe(422);
    expect(database.transactionQuery).not.toHaveBeenCalled();
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

  it.each([undefined, '/images/recipes/mole.jpg', 'https://example.com/mole.jpg', null])('preserves omitted images and accepts explicit image changes for base recipes: %s', async (imageUrl) => {
    const recipeId = '00000000-0000-4000-8000-000000000003';
    const foodId = '00000000-0000-4000-8000-000000000002';
    database.query.mockResolvedValueOnce({ rows: [{ personId: null, imageUrl: '/images/recipes/original.jpg' }], rowCount: 1 });
    database.query.mockResolvedValueOnce({ rows: [{ id: foodId, group: 'Cereales y leguminosas', baseQuantity: '1', unit: 'piezas', isFreeConsumption: false, portionPending: false, verifiedAt: '2026-10-05T12:00:00Z' }], rowCount: 1 });
    database.query.mockResolvedValueOnce({ rows: [{ id: recipeId }], rowCount: 1 });
    const ingredient = { foodId, quantity: '1', unit: 'piezas', group: 'Cereales y leguminosas', isFreeConsumption: false };
    const response = await request(`/recipes/${recipeId}`, 'PUT', {
      personId: null, name: 'Base', mealTime: 'Comida', imageUrl, sourceText: 'Base', reviewNotes: [], instructions: ['Servir'], ingredients: [ingredient, ingredient], verify: true,
    });
    expect(response.status).toBe(200);
    const values = database.query.mock.calls[2][1];
    expect(JSON.parse(values[5])).toEqual([{ ...ingredient, quantity: '2' }]);
    expect(values[9]).toBe(imageUrl === undefined ? '/images/recipes/original.jpg' : imageUrl);
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

  it('sums one recipe per meal and day for the selected number of diners', async () => {
    const personId = '00000000-0000-4000-8000-000000000001';
    const tortillaId = '00000000-0000-4000-8000-000000000003';
    const recipeIds = Array.from({ length: 8 }, (_value, index) => `00000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`);
    database.query.mockResolvedValueOnce({ rows: [{ id: personId }], rowCount: 1 });
    database.query.mockResolvedValueOnce({ rows: ['Desayuno', 'Almuerzo', 'Comida', 'Cena'].flatMap((mealTime, mealIndex) => [0, 1].map((day) => ({
      id: recipeIds[mealIndex * 2 + day], personId, mealTime,
      ingredients: [{ foodId: tortillaId, quantity: day ? '3' : '2', unit: 'pieza', isFreeConsumption: false }],
    }))), rowCount: 8 });
    database.query.mockResolvedValueOnce({ rows: [{ id: tortillaId, name: 'Tortilla de maíz', purchaseUnits: [{ unitName: 'paquetes', quantity: '12', unit: 'piezas', purchaseQuantity: '1', purchaseUnit: 'paquetes', isConfirmed: true, isApproximate: false, roundUp: true }] }], rowCount: 1 });
    const mealSelection = () => ['Desayuno', 'Almuerzo', 'Comida', 'Cena'].map((mealTime, index) => ({ mealTime, recipeIds: [recipeIds[index * 2], recipeIds[index * 2 + 1]] }));
    const response = await request('/shopping-list/calculate', 'POST', {
      days: 2, peopleCount: 4, participants: [{ personId, meals: mealSelection() }],
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      participantCount: 4,
      peopleCount: 4,
      participants: [{ personId, days: 2 }],
      items: [{ foodId: tortillaId, name: 'Tortilla de maíz', unit: 'piezas', quantity: '80', purchaseOptions: [{ unitName: 'paquetes', quantity: '7', contents: '12', unit: 'piezas', purchaseUnit: 'paquetes', isApproximate: false }], purchasePending: false }],
    });
  });

  it('returns a consolidated shopping list from verified recipes', async () => {
    const personId = '00000000-0000-4000-8000-000000000001';
    const foodId = '00000000-0000-4000-8000-000000000003';
    const freeFoodId = '00000000-0000-4000-8000-000000000004';
    const recipeIds = Array.from({ length: 12 }, (_value, index) => `00000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`);
    database.query.mockResolvedValueOnce({ rows: [{ id: personId }], rowCount: 1 });
    database.query.mockResolvedValueOnce({ rows: ['Desayuno', 'Almuerzo', 'Comida', 'Cena'].flatMap((mealTime, mealIndex) => [0, 1, 2].map((day) => ({
      id: recipeIds[mealIndex * 3 + day], personId, mealTime, ingredients: [
        { foodId, quantity: '2', unit: 'pieza', isFreeConsumption: false },
        { foodId: freeFoodId, quantity: '1/2', unit: 'taza', isFreeConsumption: true, group: 'Verduras' },
      ],
    }))), rowCount: 12 });
    database.query.mockResolvedValueOnce({ rows: [{ id: foodId, name: 'Tortilla', purchaseLocation: 'Supermercado', purchaseUnits: [] }, { id: freeFoodId, name: 'Espinaca', purchaseLocation: 'Mercado', purchaseUnits: [] }], rowCount: 2 });
    const meals = ['Desayuno', 'Almuerzo', 'Comida', 'Cena'].map((mealTime, index) => ({ mealTime, recipeIds: recipeIds.slice(index * 3, index * 3 + 3) }));
    const response = await request('/shopping-list/calculate', 'POST', { days: 3, peopleCount: 2, participants: [{ personId, meals }] });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      participantCount: 2,
      items: expect.arrayContaining([
        { foodId, name: 'Tortilla', group: 'Otros', quantity: '48', unit: 'piezas', purchaseLocation: 'Supermercado', purchaseOptions: [], purchasePending: true },
        { foodId: freeFoodId, name: 'Espinaca', group: 'Otros', quantity: '12', unit: 'tazas', purchaseLocation: 'Mercado', purchaseOptions: [], purchasePending: true },
      ]),
    });
  });

  it.each([1, 2, 3])('scales two menus by people and %s days per dish, exporting each recipe once', async (daysPerDish) => {
    const personId = '00000000-0000-4000-8000-000000000001';
    const foodId = '00000000-0000-4000-8000-000000000003';
    const recipeIds = Array.from({ length: 6 }, (_value, index) => `00000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`);
    const mealTimes = ['Desayuno', 'Almuerzo', 'Almuerzo', 'Comida', 'Comida', 'Cena'];
    const recipes = recipeIds.map((id, index) => ({
      id, personId, mealTime: mealTimes[index], name: `Recipe ${index}`,
      instructions: [`Prepare ${index}`], ingredients: [{ foodId, quantity: '1', unit: 'pieza', isFreeConsumption: false }],
    }));
    database.query.mockResolvedValueOnce({ rows: [{ name: 'Familia' }], rowCount: 1 });
    database.query.mockResolvedValueOnce({ rows: recipes, rowCount: 6 });
    database.query.mockResolvedValueOnce({ rows: [{ id: foodId, name: 'Tortilla', purchaseUnits: [] }], rowCount: 1 });
    const meals = [
      { mealTime: 'Desayuno', recipeIds: [recipeIds[0], recipeIds[0]] },
      { mealTime: 'Almuerzo', recipeIds: [recipeIds[1], recipeIds[2]] },
      { mealTime: 'Comida', recipeIds: [recipeIds[3], recipeIds[4]] },
      { mealTime: 'Cena', recipeIds: [recipeIds[5], recipeIds[5]] },
    ];
    const response = await request('/shopping-list/calculate', 'POST', { days: 2, daysPerDish, peopleCount: 2, participants: [{ personId, meals }] });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.usage).toHaveLength(8);
    expect(result.recipes).toHaveLength(6);
    expect(result.recipes[0]).toMatchObject({ id: recipeIds[0], instructions: ['Prepare 0'] });
    expect(result.items[0].quantity).toBe(String(16 * daysPerDish));
    expect(result.days).toBe(2 * daysPerDish);
    expect(result.menu).toHaveLength(8 * daysPerDish);
    expect(result.menu.filter((entry: { day: number }) => entry.day === 1)).toHaveLength(4);
  });

  it.each(['Almuerzo', 'Comida'])('rejects consecutive repeats for %s before querying the database', async (mealTime) => {
    const meals = ['Desayuno', 'Almuerzo', 'Comida', 'Cena'].map((time) => ({
      mealTime: time,
      recipeIds: time === mealTime
        ? ['00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000010']
        : ['00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000011'],
    }));
    const response = await request('/shopping-list/calculate', 'POST', {
      days: 2, peopleCount: 2, participants: [{ personId: '00000000-0000-4000-8000-000000000001', meals }],
    });
    expect(response.ok).toBe(false);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(database.query).not.toHaveBeenCalled();
  });

  it('converts twelve walnut pieces to sixty approximate grams for purchase', async () => {
    const personId = '00000000-0000-4000-8000-000000000001';
    const walnutId = '00000000-0000-4000-8000-000000000003';
    const recipeIds = Array.from({ length: 4 }, (_value, index) => `00000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`);
    database.query.mockResolvedValueOnce({ rows: [{ id: personId }], rowCount: 1 });
    database.query.mockResolvedValueOnce({ rows: ['Desayuno', 'Almuerzo', 'Comida', 'Cena'].map((mealTime, index) => ({
      id: recipeIds[index], personId, mealTime, ingredients: [{ foodId: walnutId, quantity: '3', unit: 'piezas', isFreeConsumption: false }],
    })), rowCount: 4 });
    database.query.mockResolvedValueOnce({ rows: [{ id: walnutId, name: 'Nueces', purchaseUnits: [{
      unitName: 'gramos aproximados', quantity: '12', unit: 'piezas', purchaseQuantity: '60', purchaseUnit: 'g',
      isConfirmed: true, isApproximate: true, roundUp: false,
    }] }], rowCount: 1 });
    const meals = ['Desayuno', 'Almuerzo', 'Comida', 'Cena'].map((mealTime, index) => ({ mealTime, recipeIds: [recipeIds[index]] }));
    const response = await request('/shopping-list/calculate', 'POST', { days: 1, peopleCount: 1, participants: [{ personId, meals }] });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [{ foodId: walnutId, quantity: '12', unit: 'piezas', purchasePending: false, purchaseOptions: [{ unitName: 'gramos aproximados', quantity: '60', contents: '12', unit: 'piezas', purchaseUnit: 'g', isApproximate: true }] }],
    });
  });

  it.each([{ people: 1, duration: 1, grams: '122', jars: '1' }, { people: 20, duration: 2, grams: '4880', jars: '5' }])('converts Habits tablespoons and rounds jars only after summing: $grams g', async ({ people, duration, grams, jars }) => {
    const personId = '00000000-0000-4000-8000-000000000001';
    const foodId = '00000000-0000-4000-8000-000000000002';
    const mealTimes = ['Desayuno', 'Almuerzo', 'Comida', 'Cena'];
    const recipes = mealTimes.map((mealTime, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`,
      personId, mealTime, ingredients: [{ foodId, quantity: '1', unit: 'cucharada', isFreeConsumption: false }],
    }));
    database.query.mockResolvedValueOnce({ rows: [{ name: 'Familia' }], rowCount: 1 });
    database.query.mockResolvedValueOnce({ rows: recipes, rowCount: 4 });
    database.query.mockResolvedValueOnce({ rows: [{ id: foodId, name: 'Habits', purchaseUnits: [
      { unitName: 'gramos', quantity: '1', unit: 'cucharadas', purchaseQuantity: '30.5', purchaseUnit: 'g', isConfirmed: true, isApproximate: false, roundUp: false },
      { unitName: 'botes de 1 kg', quantity: '2000/61', unit: 'cucharadas', purchaseQuantity: '1', purchaseUnit: 'botes de 1 kg', isConfirmed: true, isApproximate: false, roundUp: true },
    ] }], rowCount: 1 });
    const response = await request('/shopping-list/calculate', 'POST', {
      days: 1, daysPerDish: duration, peopleCount: people,
      participants: [{ personId, meals: recipes.map((recipe) => ({ mealTime: recipe.mealTime, recipeIds: [recipe.id] })) }],
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ items: [{ purchasePending: false, purchaseOptions: [
      { quantity: grams, purchaseUnit: 'g' }, { quantity: jars, purchaseUnit: 'botes de 1 kg' },
    ] }] });
  });

  it('counts unmeasured free vegetables as recipe portions in the shopping list', async () => {
    const personId = '00000000-0000-4000-8000-000000000001';
    const vegetableId = '00000000-0000-4000-8000-000000000004';
    const recipeIds = Array.from({ length: 12 }, (_value, index) => `00000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`);
    database.query.mockResolvedValueOnce({ rows: [{ id: personId }], rowCount: 1 });
    database.query.mockResolvedValueOnce({ rows: ['Desayuno', 'Almuerzo', 'Comida', 'Cena'].flatMap((mealTime, mealIndex) => [0, 1, 2].map((day) => ({
      id: recipeIds[mealIndex * 3 + day], personId, mealTime, ingredients: [
        { foodId: vegetableId, quantity: null, unit: null, isFreeConsumption: true, group: 'Verduras' },
      ],
    }))), rowCount: 12 });
    database.query.mockResolvedValueOnce({ rows: [{ id: vegetableId, name: 'Espinaca', purchaseUnits: [{ isConfirmed: true, unit: 'g', purchaseUnit: 'kg' }] }], rowCount: 1 });
    const meals = ['Desayuno', 'Almuerzo', 'Comida', 'Cena'].map((mealTime, index) => ({ mealTime, recipeIds: recipeIds.slice(index * 3, index * 3 + 3) }));
    const response = await request('/shopping-list/calculate', 'POST', { days: 3, peopleCount: 2, participants: [{ personId, meals }] });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [{ foodId: vegetableId, name: 'Espinaca', quantity: '24', unit: 'porciones', purchasePending: true }],
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