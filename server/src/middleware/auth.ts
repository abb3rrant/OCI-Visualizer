import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be set in production');
  }
  console.warn('WARNING: JWT_SECRET not set, using insecure default. Do NOT use in production.');
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export interface AuthUser {
  userId: string;
  email: string;
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export function getUserFromRequest(req: Request): AuthUser | null {
  // Extract from Authorization: Bearer <token> header
  const authHeader =
    (req as any).headers?.authorization ||
    (req as any).headers?.get?.('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}
