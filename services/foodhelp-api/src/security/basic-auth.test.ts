import { describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { createBasicAuth } from './basic-auth';

describe('family access protection', () => {
  it('challenges requests without credentials', async () => {
    const response = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), end: vi.fn() } as unknown as Response;
    const next = vi.fn();
    await createBasicAuth(true, 'family', '$2b$12$invalid')({ header: () => undefined } as unknown as Request, response, next);
    expect(response.setHeader).toHaveBeenCalledWith('WWW-Authenticate', expect.stringContaining('FoodHelp'));
    expect(response.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts only the configured username and bcrypt-verified password', async () => {
    const passwordHash = await bcrypt.hash('local-test-password', 4);
    const next = vi.fn();
    const response = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), end: vi.fn() } as unknown as Response;
    const request = { header: () => `Basic ${Buffer.from('family:local-test-password').toString('base64')}` } as unknown as Request;
    await createBasicAuth(true, 'family', passwordHash)(request, response, next);
    expect(next).toHaveBeenCalledOnce();
  });
});