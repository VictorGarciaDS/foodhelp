import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config', () => ({
  config: {
    aiEnabled: true,
    AI_API_BASE_URL: 'https://api.example.test/v1/completions',
    AI_MODEL: 'gpt-5',
    AI_STUDENT_KEY: 'test-key',
  },
}));

import { requestRecipeProposals } from './completion-api';

afterEach(() => vi.unstubAllGlobals());

const suggestions = Array.from({ length: 3 }, (_value, index) => ({
  name: `Tostada ${index + 1}`,
  instructions: ['Servir con los ingredientes.'],
  ingredients: [{
    foodId: '00000000-0000-4000-8000-000000000001',
    quantity: '1', unit: 'pieza', group: 'Frutas', isFreeConsumption: false,
  }],
}));

describe('completion API response contract', () => {
  it('sends the documented envelope and accepts a root suggestions array', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ suggestions }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestRecipeProposals('contexto')).resolves.toEqual(suggestions);
    const [url, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(request.body as string);
    expect(url).toBe('https://api.example.test/v1/completions');
    expect(request.headers['x-student-key']).toBe('test-key');
    expect(body).toMatchObject({ model: 'gpt-5', prompt: 'contexto', temperature: 1, max_tokens: 0 });
    expect(body.messages[0].role).toBe('system');
  });

  it('accepts a JSON string inside an OpenAI-compatible choices envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ suggestions }) } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestRecipeProposals('contexto')).resolves.toEqual(suggestions);
  });

  it('accepts fenced JSON only after strict candidate validation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: `\`\`\`json\n${JSON.stringify({ suggestions })}\n\`\`\`` } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(requestRecipeProposals('contexto')).resolves.toEqual(suggestions);
  });

  it('reports provider HTTP status without exposing response content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('Internal Server Error', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestRecipeProposals('contexto')).rejects.toMatchObject({
      status: 503,
      code: 'ENHANCEMENT_UNAVAILABLE',
      message: expect.stringContaining('HTTP 500'),
    });
  });

  it('reports a timeout distinctly and saves no unverified suggestions', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(requestRecipeProposals('contexto')).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('60 segundos'),
    });
  });

  it('rejects non-JSON provider output', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('not json', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(requestRecipeProposals('contexto')).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('JSON válido'),
    });
  });
});
