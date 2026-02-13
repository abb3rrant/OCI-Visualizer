import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { createYoga } from 'graphql-yoga';
import { PrismaClient } from '@prisma/client';
import Busboy from 'busboy';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

import { schema } from './schema/index.js';
import { getUserFromRequest, verifyToken, type AuthUser } from './middleware/auth.js';
import { generateExportScript } from './utils/exportScript.js';
import { importZipBuffer, importJsonString, FILENAME_TO_TYPE } from './services/import.js';
import { buildRelationships } from './services/relationship.js';
import { createImportJob, addSseConnection, removeSseConnection } from './services/jobQueue.js';
import { exportSnapshot, importSnapshotBundle } from './utils/snapshotExport.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '4000', 10);

// ---------------------------------------------------------------------------
// TLS configuration
// ---------------------------------------------------------------------------

const TLS_ENABLED = (process.env.TLS_ENABLED || 'true').toLowerCase() !== 'false';
const TLS_CERT_PATH = process.env.TLS_CERT || '';
const TLS_KEY_PATH = process.env.TLS_KEY || '';

function getTlsOptions(): { key: Buffer; cert: Buffer } | null {
  if (!TLS_ENABLED) return null;

  // Use user-provided certs if specified
  if (TLS_CERT_PATH && TLS_KEY_PATH) {
    try {
      return {
        key: readFileSync(TLS_KEY_PATH),
        cert: readFileSync(TLS_CERT_PATH),
      };
    } catch (err) {
      console.error(`Failed to read TLS cert/key: ${err}`);
      process.exit(1);
    }
  }

  // Generate self-signed certs
  const certsDir = path.resolve(__dirname, '../../certs');
  const certFile = path.join(certsDir, 'server.crt');
  const keyFile = path.join(certsDir, 'server.key');

  if (existsSync(certFile) && existsSync(keyFile)) {
    return { key: readFileSync(keyFile), cert: readFileSync(certFile) };
  }

  console.log('Generating self-signed TLS certificate...');
  mkdirSync(certsDir, { recursive: true });

  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${keyFile}" -out "${certFile}" ` +
      `-days 365 -nodes -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"`,
      { stdio: 'pipe' },
    );
    console.log(`Self-signed certificate generated in ${certsDir}`);
    return { key: readFileSync(keyFile), cert: readFileSync(certFile) };
  } catch (err) {
    console.warn(`Could not generate self-signed cert (openssl not found?): ${err}`);
    console.warn('Falling back to plain HTTP.');
    return null;
  }
}
const prisma = new PrismaClient();
const MAX_UPLOAD_SIZE = (parseInt(process.env.MAX_UPLOAD_SIZE_MB || '100', 10)) * 1024 * 1024;

// ---------------------------------------------------------------------------
// Rate limiter for auth endpoints (login/register)
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 10;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Periodically clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now >= entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }
  return false;
}

function getClientIp(req: import('http').IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

// SQLite performance tuning (skipped when using PostgreSQL)
async function tuneSQLite() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.startsWith('postgresql') || dbUrl.startsWith('postgres')) return;
  try {
    await prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL');
    await prisma.$executeRawUnsafe('PRAGMA synchronous = NORMAL');
    await prisma.$executeRawUnsafe('PRAGMA cache_size = -64000'); // 64MB
    await prisma.$executeRawUnsafe('PRAGMA busy_timeout = 5000');
  } catch {
    // Non-fatal — skip if not using SQLite
  }
}
tuneSQLite();

// ---------------------------------------------------------------------------
// GraphQL Yoga
// ---------------------------------------------------------------------------

const yoga = createYoga({
  schema: schema as any,
  context: async ({ request }) => ({
    prisma,
    user: getUserFromRequest(request),
  }),
  graphqlEndpoint: '/graphql',
  maskedErrors: false,
});

// ---------------------------------------------------------------------------
// HTTP Server (handles both GraphQL and REST endpoints)
// ---------------------------------------------------------------------------

const tlsOptions = getTlsOptions();
const useHttps = !!tlsOptions;
const protocol = useHttps ? 'https' : 'http';

const requestHandler = async (req: import('http').IncomingMessage, res: import('http').ServerResponse) => {
  const url = new URL(req.url || '/', `${protocol}://${req.headers.host}`);

  // CORS headers
  const origin = req.headers.origin || '';
  const defaultOrigins = [
    'http://localhost:5173', 'https://localhost:5173',
    'http://localhost:4000', 'https://localhost:4000',
  ];
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : defaultOrigins;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- REST: Health check ---
  if (req.method === 'GET' && url.pathname === '/health') {
    handleHealth(req, res);
    return;
  }

  // --- REST: SSE for import job progress ---
  if (req.method === 'GET' && url.pathname.match(/^\/api\/import-job\/[^/]+\/stream$/)) {
    const jobId = url.pathname.split('/')[3];
    handleImportJobStream(req, res, jobId);
    return;
  }

  // --- GraphQL endpoint ---
  if (url.pathname === '/graphql') {
    // Rate-limit login/register mutations
    if (req.method === 'POST') {
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
          const ip = getClientIp(req);
          if (isRateLimited(ip)) {
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Too many attempts. Please try again later.' }));
            return;
          }
        }

        // Re-create a readable stream from the already-consumed body so Yoga can parse it
        const { Readable } = await import('stream');
        const syntheticReq = Object.assign(Readable.from(Buffer.from(body)), {
          headers: req.headers,
          method: req.method,
          url: req.url,
          socket: req.socket,
          connection: req.connection,
        });
        yoga.handle(syntheticReq as any, res);
        return;
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad request' }));
        return;
      }
    }

    yoga.handle(req, res);
    return;
  }

  // --- REST: File upload ---
  if (req.method === 'POST' && url.pathname.startsWith('/api/upload/')) {
    const snapshotId = url.pathname.split('/').pop() || '';
    handleUpload(req, res, snapshotId);
    return;
  }

  // --- REST: Poll import job status ---
  if (req.method === 'GET' && url.pathname.startsWith('/api/import-job/')) {
    const jobId = url.pathname.split('/').pop() || '';
    handleImportJobStatus(req, res, jobId);
    return;
  }

  // --- REST: Export snapshot bundle ---
  if (req.method === 'GET' && url.pathname.match(/^\/api\/snapshot\/[^/]+\/export$/)) {
    const snapshotId = url.pathname.split('/')[3];
    handleSnapshotExport(req, res, snapshotId);
    return;
  }

  // --- REST: Import snapshot bundle ---
  if (req.method === 'POST' && url.pathname === '/api/snapshot/import') {
    handleSnapshotImport(req, res);
    return;
  }

  // --- REST: Export script ---
  if (req.method === 'GET' && url.pathname === '/api/export-script') {
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Content-Disposition': 'attachment; filename="oci-export.sh"',
    });
    res.end(generateExportScript());
    return;
  }

  // --- Static files (production) ---
  if (process.env.NODE_ENV === 'production') {
    const clientDist = path.resolve(__dirname, '../../client/dist');
    try {
      let filePath = path.join(clientDist, url.pathname === '/' ? 'index.html' : url.pathname);
      const content = readFileSync(filePath);
      const ext = path.extname(filePath);
      const mimeTypes: Record<string, string> = {
        '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
        '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(content);
      return;
    } catch {
      // SPA fallback
      try {
        const content = readFileSync(path.join(clientDist, 'index.html'));
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
        return;
      } catch {
        // Fall through to 404
      }
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
};

const server = useHttps
  ? createHttpsServer(tlsOptions!, requestHandler)
  : createHttpServer(requestHandler);

// ---------------------------------------------------------------------------
// File upload handler
// ---------------------------------------------------------------------------

function handleUpload(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  snapshotId: string,
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Authentication required.' }));
    return;
  }
  const user = verifyToken(authHeader.slice(7));
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid or expired token.' }));
    return;
  }

  prisma.snapshot
    .findUnique({ where: { id: snapshotId } })
    .then((snapshot) => {
      if (!snapshot) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Snapshot not found.' }));
        return;
      }
      if (snapshot.userId !== user.userId) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not authorized.' }));
        return;
      }

      const busboy = Busboy({
        headers: req.headers,
        limits: { fileSize: MAX_UPLOAD_SIZE },
      });
      const fileBuffers: Array<{ filename: string; buffer: Buffer }> = [];
      let totalBytes = 0;
      let sizeLimitExceeded = false;

      busboy.on('file', (_fieldname: string, file: any, info: { filename: string }) => {
        const chunks: Buffer[] = [];
        file.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > MAX_UPLOAD_SIZE) {
            sizeLimitExceeded = true;
            file.destroy();
            req.unpipe(busboy);
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              error: `Upload exceeds maximum size of ${process.env.MAX_UPLOAD_SIZE_MB || '100'} MB.`,
            }));
            return;
          }
          chunks.push(chunk);
        });
        file.on('end', () => {
          if (!sizeLimitExceeded) {
            fileBuffers.push({ filename: info.filename, buffer: Buffer.concat(chunks) });
          }
        });
      });

      busboy.on('finish', async () => {
        if (sizeLimitExceeded) return;
        if (fileBuffers.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No file provided.' }));
          return;
        }

        try {
          // Create a background job and return immediately
          const jobId = await createImportJob(prisma, snapshotId, fileBuffers);
          res.writeHead(202, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jobId }));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Failed to create import job: ${message}` }));
        }
      });

      busboy.on('error', (err: Error) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Upload failed: ${err.message}` }));
      });

      req.pipe(busboy);
    })
    .catch((err: Error) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Server error: ${err.message}` }));
    });
}

// ---------------------------------------------------------------------------
// Import job status polling endpoint
// ---------------------------------------------------------------------------

async function handleImportJobStatus(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  jobId: string,
) {
  try {
    const job = await prisma.importJob.findUnique({ where: { id: jobId } });
    if (!job) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Job not found.' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: job.id,
      snapshotId: job.snapshotId,
      status: job.status,
      progress: job.progress,
      total: job.total,
      resourceTypes: job.resourceTypes ? JSON.parse(job.resourceTypes) : [],
      errors: job.errors ? JSON.parse(job.errors) : [],
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: message }));
  }
}

// ---------------------------------------------------------------------------
// Snapshot export handler
// ---------------------------------------------------------------------------

async function handleSnapshotExport(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  snapshotId: string,
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Authentication required.' }));
    return;
  }
  const user = verifyToken(authHeader.slice(7));
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid or expired token.' }));
    return;
  }

  try {
    const bundle = await exportSnapshot(prisma, snapshotId, user.userId);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="snapshot-${snapshotId}.json"`,
    });
    res.end(JSON.stringify(bundle));
  } catch (err: any) {
    const status = err.message === 'Not authorized' ? 403 : err.message === 'Snapshot not found' ? 404 : 500;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// ---------------------------------------------------------------------------
// Snapshot import handler
// ---------------------------------------------------------------------------

async function handleSnapshotImport(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Authentication required.' }));
    return;
  }
  const user = verifyToken(authHeader.slice(7));
  if (!user) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid or expired token.' }));
    return;
  }

  const bodyChunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => bodyChunks.push(chunk));
  req.on('end', async () => {
    try {
      const body = Buffer.concat(bodyChunks).toString('utf-8');
      const bundle = JSON.parse(body);
      const snapshotId = await importSnapshotBundle(prisma, user.userId, bundle);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ snapshotId }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Import failed' }));
    }
  });
  req.on('error', (err: Error) => {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });
}

// ---------------------------------------------------------------------------
// Health check handler
// ---------------------------------------------------------------------------

async function handleHealth(
  _req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
) {
  let dbStatus = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  const health = {
    status: dbStatus === 'connected' ? 'healthy' : 'degraded',
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    database: dbStatus,
  };

  res.writeHead(dbStatus === 'connected' ? 200 : 503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(health));
}

// ---------------------------------------------------------------------------
// SSE import job stream handler
// ---------------------------------------------------------------------------

function handleImportJobStream(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  jobId: string,
) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': req.headers.origin || '*',
  });

  addSseConnection(jobId, res);

  // Send initial state
  prisma.importJob.findUnique({ where: { id: jobId } }).then(job => {
    if (job) {
      res.write(`data: ${JSON.stringify({
        status: job.status,
        progress: job.progress,
        total: job.total,
      })}\n\n`);
    }
  });

  req.on('close', () => {
    removeSseConnection(jobId, res);
  });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`Server running at ${protocol}://localhost:${PORT}`);
  console.log(`GraphQL endpoint: ${protocol}://localhost:${PORT}/graphql`);
  if (useHttps && !TLS_CERT_PATH) {
    console.log('Using self-signed certificate. Set TLS_CERT and TLS_KEY in .env to use your own.');
  }
  if (!useHttps) {
    console.log('TLS disabled. Set TLS_ENABLED=true to enable.');
  }
});

