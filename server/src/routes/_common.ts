import { verifyToken, type AuthUser } from '../middleware/auth.js';

export type Req = import('http').IncomingMessage;
export type Res = import('http').ServerResponse;

export function sendJson(res: Res, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/**
 * Extract and verify the bearer token on a request. Writes a 401 and returns
 * null if the token is missing/invalid.
 */
export function requireUser(req: Req, res: Res): AuthUser | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendJson(res, 401, { error: 'Authentication required.' });
    return null;
  }
  const user = verifyToken(authHeader.slice(7));
  if (!user) {
    sendJson(res, 401, { error: 'Invalid or expired token.' });
    return null;
  }
  return user;
}
