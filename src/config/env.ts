import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('Invalid DATABASE_URL'),
  DATABASE_READ_URL: z.string().url('Invalid DATABASE_READ_URL').optional(),

  // JWT Secrets
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().url('Invalid FRONTEND_URL'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Cache
  CACHE_TTL: z.coerce.number().default(300),

});

const env = envSchema.parse(process.env);

export default env;
