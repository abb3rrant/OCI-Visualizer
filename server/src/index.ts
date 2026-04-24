import { env } from './config/env.js';
import { getTlsOptions } from './config/tls.js';
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { createYoga } from 'graphql-yoga';
import { PrismaClient } from '@prisma/client';

import { schema } from './schema/index.js';
import { getUserFromRequest } from './middleware/auth.js';
import { applyCommonHeaders } from './middleware/headers.js';
import { isRateLimited, getClientIp } from './middleware/rateLimit.js';
import { logger } from './utils/logger.js';
import { createLoaders } from './utils/dataloaders.js';

import { handleHealth } from './routes/health.js';
import { handleUpload } from './routes/upload.js';
import {
  handleImportJobStatus,
  handleImportJobDelete,
  handleImportJobList,
  handleImportJobStream,
} from './routes/importJobs.js';
import {
  handleSnapshotExport,
  handleSnapshotImport,
  handleRebuildRelationships,
} from './routes/snapshot.js';
import { handleComputeCsvExport } from './routes/csvExport.js';
import { handleStaticFile } from './routes/staticFiles.js';
import { generateExportScript } from './utils/exportScript.js';

const prisma = new PrismaClient();

async function tuneSQLite() {
  if (env.DATABASE_URL.startsWith('postgresql') || env.DATABASE_URL.startsWith('postgres')) return;
  try {
    await prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL');
    await prisma.$executeRawUnsafe('PRAGMA synchronous = NORMAL');
    await prisma.$executeRawUnsafe('PRAGMA cache_size = -64000');
    await prisma.$executeRawUnsafe('PRAGMA busy_timeout = 15000');
  } catch {
    // Non-fatal — skip if not using SQLite
  }
}
tuneSQLite();

const yoga = createYoga({
  schema: schema as any,
  context: async ({ request }) => ({
    prisma,
    user: getUserFromRequest(request),
    loaders: createLoaders(prisma),
  }),
  graphqlEndpoint: '/graphql',
  maskedErrors: true,
});

const tlsOptions = getTlsOptions();
const useHttps = !!tlsOptions;
const protocol = useHttps ? 'https' : 'http';

async function handleGraphql(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    yoga.handle(req as any, res);
    return;
  }
  const bodyChunks: Buffer[] = [];
  const bodyPromise = new Promise<string>((resolve, reject) => {
    req.on('data', (chunk: Buffer) => bodyChunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(bodyChunks).toString('utf-8')));
    req.on('error', reject);
  });

  try {
    const body = await bodyPromise;
    const lowerBody = body.toLowerCase();
    if (lowerBody.includes('login') || lowerBody.includes('register')) {
      if (isRateLimited(getClientIp(req))) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Too many attempts. Please try again later.' }));
        return;
      }
    }

    // Re-create a readable stream so Yoga can parse the already-consumed body.
    const { Readable } = await import('stream');
    const syntheticReq = Object.assign(Readable.from(Buffer.from(body)), {
      headers: req.headers,
      method: req.method,
      url: req.url,
      socket: req.socket,
      connection: req.connection,
    });
    yoga.handle(syntheticReq as any, res);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Bad request' }));
  }
}

const requestHandler = async (
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
) => {
  const url = new URL(req.url || '/', `${protocol}://${req.headers.host}`);
  applyCommonHeaders(req, res, useHttps);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const { method = 'GET' } = req;
  const p = url.pathname;

  if (method === 'GET' && p === '/health') return handleHealth(prisma, req, res);
  if (method === 'GET' && p === '/api/import-jobs') return handleImportJobList(prisma, req, res, url);

  if (method === 'GET' && /^\/api\/import-job\/[^/]+\/stream$/.test(p)) {
    return handleImportJobStream(prisma, req, res, p.split('/')[3], protocol);
  }

  if (p === '/graphql') return handleGraphql(req, res);

  if (method === 'POST' && p.startsWith('/api/upload/')) {
    return handleUpload(prisma, req, res, p.split('/').pop() || '');
  }
  if (method === 'DELETE' && /^\/api\/import-job\/[^/]+$/.test(p)) {
    return handleImportJobDelete(prisma, req, res, p.split('/').pop() || '');
  }
  if (method === 'GET' && p.startsWith('/api/import-job/')) {
    return handleImportJobStatus(prisma, req, res, p.split('/').pop() || '');
  }
  if (method === 'GET' && /^\/api\/snapshot\/[^/]+\/export$/.test(p)) {
    return handleSnapshotExport(prisma, req, res, p.split('/')[3]);
  }
  if (method === 'POST' && p === '/api/snapshot/import') {
    return handleSnapshotImport(prisma, req, res);
  }
  if (method === 'POST' && /^\/api\/snapshot\/[^/]+\/rebuild-relationships$/.test(p)) {
    return handleRebuildRelationships(prisma, req, res, p.split('/')[3]);
  }
  if (method === 'GET' && p === '/api/export-compute-csv') {
    return handleComputeCsvExport(prisma, req, res, url);
  }
  if (method === 'GET' && p === '/api/export-script') {
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Content-Disposition': 'attachment; filename="oci-export.sh"',
    });
    res.end(generateExportScript());
    return;
  }

  if (env.isProd && handleStaticFile(req, res, url)) return;

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
};

const server = useHttps
  ? createHttpsServer(tlsOptions!, requestHandler)
  : createHttpServer(requestHandler);

server.headersTimeout = 60_000;
server.requestTimeout = 10 * 60_000;
server.timeout = 10 * 60_000;

server.listen(env.PORT, env.HOST, () => {
  logger.info(`Server running at ${protocol}://${env.HOST}:${env.PORT}`);
  logger.info(`GraphQL endpoint: ${protocol}://${env.HOST}:${env.PORT}/graphql`);
  if (useHttps && !env.TLS_CERT) {
    logger.info('Using self-signed certificate. Set TLS_CERT and TLS_KEY in .env to use your own.');
  }
  if (!useHttps) {
    logger.info('TLS disabled. Set TLS_ENABLED=true to enable.');
  }
});

function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully...`);
  server.close(() => {
    prisma.$disconnect().then(() => {
      logger.info('Server closed.');
      process.exit(0);
    });
  });
  setTimeout(() => {
    logger.warn('Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
