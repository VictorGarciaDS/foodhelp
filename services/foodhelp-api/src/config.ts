import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env'), quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().optional().default(''),
  APP_AUTH_USERNAME: z.string().optional().default(''),
  APP_AUTH_PASSWORD_HASH: z.string().optional().default(''),
  AI_API_BASE_URL: z.string().url().default('https://api.artesaniadigital.org/v1/completions'),
  AI_MODEL: z.string().default('gpt-5'),
  AI_STUDENT_KEY: z.string().optional().default(''),
  AI_RESPONSE_CONTRACT_CONFIRMED: z.enum(['true', 'false']).default('false'),
});

const parsed = schema.parse(process.env);
const authEnabled = Boolean(parsed.APP_AUTH_USERNAME && parsed.APP_AUTH_PASSWORD_HASH);
if (parsed.NODE_ENV === 'production' && !authEnabled) throw new Error('APP_AUTH_USERNAME y APP_AUTH_PASSWORD_HASH son obligatorios en produccion.');

export const config = {
  ...parsed,
  authEnabled,
  aiEnabled: Boolean(parsed.AI_STUDENT_KEY) && parsed.AI_RESPONSE_CONTRACT_CONFIRMED === 'true',
};