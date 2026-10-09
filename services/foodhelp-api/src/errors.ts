import type { ErrorRequestHandler, Request, Response } from 'express';
import type { ZodType } from 'zod';
import type { ErrorCode } from '@foodhelp/contracts';
import { ApiError } from './http-error';

export { ApiError };

export function parseRequest<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(422, 'VALIDATION_ERROR', 'Revisa los datos ingresados.', result.error.flatten());
  return result.data;
}

export function fail(response: Response, status: number, code: ErrorCode, message: string, details: unknown = null): void {
  response.status(status).json({ error: { code, message, details } });
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _request: Request, response: Response, _next) => {
  if (error instanceof ApiError) return fail(response, error.status, error.code, error.message, error.details);
  if (error instanceof Error && error.message === 'DATABASE_UNAVAILABLE') return fail(response, 503, 'DATABASE_UNAVAILABLE', 'La base de datos no esta configurada.');
  console.error('Error interno FoodHelp', error instanceof Error ? error.name : 'unknown');
  return fail(response, 500, 'INTERNAL_ERROR', 'Ocurrio un error inesperado.');
};