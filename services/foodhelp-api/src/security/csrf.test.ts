import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { csrfProtection } from './csrf';

function invoke(method: string, headers: Record<string, string>) {
  const request = {
    method,
    protocol: 'https',
    get: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
  const next = vi.fn();
  csrfProtection(request, response, next);
  return { response, next };
}

describe('same-origin write protection', () => {
  it('allows safe reads without a token', () => {
    expect(invoke('GET', {}).next).toHaveBeenCalledOnce();
  });
  it('rejects cross-origin or unmarked writes', () => {
    const { response, next } = invoke('POST', { origin: 'https://outside.example', host: 'foodhelp.example' });
    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
  it('allows same-origin writes with the application header', () => {
    const { next } = invoke('POST', { origin: 'https://foodhelp.example', host: 'foodhelp.example', 'x-foodhelp-request': '1' });
    expect(next).toHaveBeenCalledOnce();
  });
});