import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { ApiError, errorHandler } from './errors';
import { databaseReady } from './db/pool';
import { config } from './config';
import { createApiRouter } from './routes/api';
import { authLimiter, requirePrivateAccess } from './security/basic-auth';
import { csrfProtection } from './security/csrf';

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], fontSrc: ["'self'", 'data:'],
  } } }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_request, response) => {
    const ready = await databaseReady();
    response.status(ready ? 200 : 503).json({
      status: ready ? 'healthy' : 'unhealthy',
      services: { database: ready ? 'healthy' : 'unavailable' },
    });
  });

  app.use(authLimiter);
  app.use(requirePrivateAccess);
  app.use('/api', csrfProtection);
  app.use('/api', createApiRouter());
  app.use('/api', (_request, _response, next) => next(new ApiError(404, 'NOT_FOUND', 'Ruta de API no encontrada.')));

  const webDist = path.resolve(__dirname, '../../foodhelp-web/dist');
  app.use(express.static(webDist, { index: false }));
  app.get('/{*path}', (_request, response, next) => {
    response.sendFile(path.join(webDist, 'index.html'), (error) => { if (error) next(); });
  });
  app.use((_request, response) => response.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Ruta no encontrada.', details: null },
  }));
  app.use(errorHandler);

  if (config.NODE_ENV === 'development' && !config.authEnabled) {
    console.warn('FoodHelp: autenticacion desactivada solo para desarrollo local.');
  }
  return app;
}