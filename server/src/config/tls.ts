import path from 'path';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getTlsOptions(): { key: Buffer; cert: Buffer } | null {
  if (!env.TLS_ENABLED) return null;

  if (env.TLS_CERT && env.TLS_KEY) {
    try {
      return {
        key: readFileSync(env.TLS_KEY),
        cert: readFileSync(env.TLS_CERT),
      };
    } catch (err) {
      logger.error('Failed to read TLS cert/key', { error: String(err) });
      process.exit(1);
    }
  }

  const certsDir = path.resolve(__dirname, '../../../certs');
  const certFile = path.join(certsDir, 'server.crt');
  const keyFile = path.join(certsDir, 'server.key');

  if (existsSync(certFile) && existsSync(keyFile)) {
    return { key: readFileSync(keyFile), cert: readFileSync(certFile) };
  }

  logger.info('Generating self-signed TLS certificate...');
  mkdirSync(certsDir, { recursive: true });

  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${keyFile}" -out "${certFile}" ` +
      `-days 365 -nodes -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"`,
      { stdio: 'pipe' },
    );
    logger.info(`Self-signed certificate generated in ${certsDir}`);
    return { key: readFileSync(keyFile), cert: readFileSync(certFile) };
  } catch (err) {
    logger.warn('Could not generate self-signed cert (openssl not found?)', { error: String(err) });
    logger.warn('Falling back to plain HTTP.');
    return null;
  }
}
