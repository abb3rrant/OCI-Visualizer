import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname_env = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname_env, '../../../.env') });
dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

function fatal(msg: string): never {
  process.stderr.write(`FATAL: ${msg}\n`);
  process.exit(1);
}

function parseIntOr(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  const v = value.toLowerCase().trim();
  if (v === 'false' || v === '0' || v === 'no') return false;
  if (v === 'true' || v === '1' || v === 'yes') return true;
  return fallback;
}

const DATABASE_URL = process.env.DATABASE_URL || '';
if (isProd) {
  if (!DATABASE_URL.startsWith('postgresql://') && !DATABASE_URL.startsWith('postgres://')) {
    fatal('DATABASE_URL must be a postgresql:// URL in production');
  }
} else if (!DATABASE_URL) {
  process.stderr.write('Warning: DATABASE_URL is not set. Database connections will fail.\n');
}

let JWT_SECRET = process.env.JWT_SECRET || '';
if (isProd) {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    fatal('JWT_SECRET must be set to at least 32 characters in production');
  }
} else if (!JWT_SECRET) {
  JWT_SECRET = randomBytes(48).toString('base64');
  process.stderr.write('Warning: JWT_SECRET not set — generated an ephemeral dev secret. Tokens will not survive restart.\n');
}

const defaultCorsOrigins = [
  'http://localhost:5173', 'https://localhost:5173',
  'http://localhost:4000', 'https://localhost:4000',
];

const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : defaultCorsOrigins;

const LOG_LEVEL = (process.env.LOG_LEVEL || (isProd ? 'info' : 'debug')) as 'debug' | 'info' | 'warn' | 'error';

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  isProd,
  DATABASE_URL,
  JWT_SECRET,
  PORT: parseIntOr(process.env.PORT, 4000),
  HOST: process.env.HOST || '0.0.0.0',
  TLS_ENABLED: parseBool(process.env.TLS_ENABLED, true),
  TLS_CERT: process.env.TLS_CERT || '',
  TLS_KEY: process.env.TLS_KEY || '',
  MAX_UPLOAD_SIZE_MB: parseIntOr(process.env.MAX_UPLOAD_SIZE_MB, 500),
  CORS_ORIGINS,
  LOG_LEVEL,
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
  RATE_LIMIT_MAX: 10,
} as const;

export type Env = typeof env;
