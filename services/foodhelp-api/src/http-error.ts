import type { ErrorCode } from '@foodhelp/contracts';

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: ErrorCode, message: string, readonly details: unknown = null) {
    super(message);
  }
}