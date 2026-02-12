import { createServer } from 'http';
import { createYoga } from 'graphql-yoga';
import { PrismaClient } from '@prisma/client';
import Busboy from 'busboy';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

import { schema } from './schema/index.js';
import { getUserFromRequest, verifyToken, type AuthUser } from './middleware/auth.js';
import { generateExportScript } from './utils/exportScript.js';
import { importZipBuffer, importJsonString } from './services/import.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '4000', 10);
const prisma = new PrismaClient();

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

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // CORS headers
  const origin = req.headers.origin || '';
  const allowedOrigins = ['http://localhost:5173', 'http://localhost:4000'];
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

  // --- GraphQL endpoint ---
  if (url.pathname === '/graphql') {
    yoga.handle(req, res);
    return;
  }

  // --- REST: File upload ---
  if (req.method === 'POST' && url.pathname.startsWith('/api/upload/')) {
    const snapshotId = url.pathname.split('/').pop() || '';
    handleUpload(req, res, snapshotId);
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
});

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

      const busboy = Busboy({ headers: req.headers });
      const fileBuffers: Array<{ filename: string; buffer: Buffer }> = [];

      busboy.on('file', (_fieldname: string, file: any, info: { filename: string }) => {
        const chunks: Buffer[] = [];
        file.on('data', (chunk: Buffer) => chunks.push(chunk));
        file.on('end', () => {
          fileBuffers.push({ filename: info.filename, buffer: Buffer.concat(chunks) });
        });
      });

      busboy.on('finish', async () => {
        if (fileBuffers.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No file provided.' }));
          return;
        }

        const results = [];
        for (const { filename, buffer } of fileBuffers) {
          const ext = path.extname(filename).toLowerCase();
          try {
            if (ext === '.zip') {
              results.push(await importZipBuffer(prisma, snapshotId, buffer));
            } else if (ext === '.json') {
              results.push(await importJsonString(prisma, snapshotId, buffer.toString('utf-8')));
            } else {
              results.push({ resourceCount: 0, resourceTypes: [], errors: [`Unsupported: ${ext}`] });
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            results.push({ resourceCount: 0, resourceTypes: [], errors: [message] });
          }
        }

        const aggregated = {
          resourceCount: results.reduce((sum, r) => sum + r.resourceCount, 0),
          resourceTypes: [...new Set(results.flatMap((r) => r.resourceTypes))],
          errors: results.flatMap((r) => r.errors),
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(aggregated));
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
// Start
// ---------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
});

