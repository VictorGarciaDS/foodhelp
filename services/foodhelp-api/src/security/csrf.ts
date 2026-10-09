import type { RequestHandler } from 'express';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export const csrfProtection: RequestHandler = (request, response, next) => {
  if (safeMethods.has(request.method)) return next();
  const origin = request.get('origin');
  const expectedOrigin = `${request.protocol}://${request.get('host')}`;
  const sameOriginHeader = request.get('x-foodhelp-request') === '1';
  if (origin !== expectedOrigin || !sameOriginHeader) {
    response.status(403).json({
      error: { code: 'UNAUTHORIZED', message: 'La solicitud no pasó la validación de origen.', details: null },
    });
    return;
  }
  next();
};