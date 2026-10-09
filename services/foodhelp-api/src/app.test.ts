import { once } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./db/pool', () => ({ databaseReady: async () => false, getPool: () => { throw new Error('DATABASE_UNAVAILABLE'); } }));

import { createApp } from './app';

describe('API health endpoint', () => {
  let server: ReturnType<ReturnType<typeof createApp>['listen']> | undefined;

  afterEach(async () => {
    if (server) {
      server.close();
      await once(server, 'close');
      server = undefined;
    }
  });

  it('reports unavailable persistence without exposing configuration', async () => {
    server = createApp().listen(0);
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No ephemeral port assigned.');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
    const body = await response.json() as { status: string; services: Record<string, string> };
    expect(response.status).toBe(503);
    expect(body).toEqual({ status: 'unhealthy', services: { database: 'unavailable' } });
    expect(JSON.stringify(body)).not.toContain('DATABASE_URL');
  });

  it('registers every API route and returns a structured dependency error without a database', async () => {
    const personId = '00000000-0000-4000-8000-000000000001';
    const weekStart = '2026-10-05';
    const requests: { path: string; method?: string; body?: unknown }[] = [
      { path: '/api/foods' },
      { path: '/api/foods', method: 'POST', body: { name: 'Alimento ingresado por la familia', group: 'Frutas', baseQuantity: '1', unit: 'unidad', isFreeConsumption: false, verified: false } },
      { path: '/api/people' },
      { path: `/api/people/${personId}/prescriptions` },
      { path: `/api/people/${personId}/prescriptions/${personId}`, method: 'DELETE' },
      { path: '/api/people', method: 'POST', body: { name: 'Persona ingresada por la familia' } },
      { path: `/api/people/${personId}/prescription`, method: 'PUT', body: { month: '2026-10', reviewed: true, meals: [{ mealTime: 'comida', group: 'Frutas', equivalents: '1' }] } },
      { path: '/api/equivalents/calculate', method: 'POST', body: { foodId: personId, quantity: '2', unit: 'unidad' } },
      { path: '/api/recipes' },
      { path: `/api/recipes/${personId}` },
      { path: '/api/recipes/suggestions', method: 'POST', body: { weekStart, peopleIds: [personId] } },
      { path: `/api/menus/${weekStart}` },
      { path: '/api/menus/generate', method: 'POST', body: { weekStart, peopleIds: [personId] } },
      { path: `/api/shopping-list/${weekStart}?peopleIds=${personId}` },
      { path: '/api/exports/pdf', method: 'POST', body: { kind: 'menu', weekStart, peopleIds: [personId] } },
    ];
    server = createApp().listen(0);
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No ephemeral port assigned.');
    const origin = `http://127.0.0.1:${address.port}`;

    for (const request of requests) {
      const response = await fetch(`${origin}${request.path}`, {
        method: request.method ?? 'GET',
        headers: {
          origin,
          ...(request.method && request.method !== 'GET' ? { 'x-foodhelp-request': '1' } : {}),
          ...(request.body ? { 'content-type': 'application/json' } : {}),
        },
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });
      const body = await response.json() as { error?: { code?: string; message?: string; details?: unknown } };
      expect(response.status, request.path).toBe(503);
      expect(body.error?.code, request.path).toBe('DATABASE_UNAVAILABLE');
      expect(body.error?.message).toBeTypeOf('string');
    }
  });
});