import { timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { config } from '../config';

function equalStrings(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

export function createBasicAuth(enabled: boolean, username: string, passwordHash: string): RequestHandler {
  return async (request, response, next) => {
    if (!enabled) return next();
    const encoded = request.header('authorization')?.match(/^Basic\s+([A-Za-z0-9+/=]+)$/i)?.[1];
    if (!encoded) {
      response.setHeader('WWW-Authenticate', 'Basic realm="FoodHelp", charset="UTF-8"');
      response.status(401).end();
      return;
    }
    const credentials = Buffer.from(encoded, 'base64').toString('utf8');
    const separator = credentials.indexOf(':');
    const candidateUser = separator < 0 ? '' : credentials.slice(0, separator);
    const candidatePassword = separator < 0 ? '' : credentials.slice(separator + 1);
    const userMatches = equalStrings(candidateUser, username);
    const passwordMatches = await bcrypt.compare(candidatePassword, passwordHash).catch(() => false);
    if (!userMatches || !passwordMatches) {
      response.setHeader('WWW-Authenticate', 'Basic realm="FoodHelp", charset="UTF-8"');
      response.status(401).end();
      return;
    }
    next();
  };
}

export const requirePrivateAccess = createBasicAuth(config.authEnabled, config.APP_AUTH_USERNAME, config.APP_AUTH_PASSWORD_HASH);