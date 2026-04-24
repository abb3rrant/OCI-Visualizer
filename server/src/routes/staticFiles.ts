import path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { sendJson, type Req, type Res } from './_common.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '../../../client/dist');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

export function handleStaticFile(req: Req, res: Res, url: URL): boolean {
  try {
    const filePath = path.join(CLIENT_DIST, url.pathname === '/' ? 'index.html' : url.pathname);
    // Prevent path traversal out of CLIENT_DIST
    if (!path.resolve(filePath).startsWith(CLIENT_DIST)) {
      sendJson(res, 400, { error: 'Bad path' });
      return true;
    }
    const content = readFileSync(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
    return true;
  } catch {
    try {
      const content = readFileSync(path.join(CLIENT_DIST, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
      return true;
    } catch {
      return false;
    }
  }
}
