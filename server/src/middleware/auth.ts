import jwt from 'jsonwebtoken';
import { GraphQLError } from 'graphql';
import { env } from '../config/env.js';

const JWT_SECRET = env.JWT_SECRET;

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

const JWT_OPTIONS = {
  issuer: 'oci-visualizer',
  audience: 'oci-visualizer-client',
};

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '24h', ...JWT_OPTIONS });
}

export function signMfaToken(userId: string): string {
  return jwt.sign({ userId, purpose: 'mfa' }, JWT_SECRET, { expiresIn: '5m', ...JWT_OPTIONS });
}

export function verifyMfaToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET, JWT_OPTIONS) as any;
    if (payload.purpose !== 'mfa') return null;
    return payload.userId;
  } catch {
    return null;
  }
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET, JWT_OPTIONS) as AuthUser;
  } catch {
    return null;
  }
}

export function getUserFromRequest(req: Request): AuthUser | null {
  const authHeader =
    (req as any).headers?.authorization ||
    (req as any).headers?.get?.('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

export function requireAuth(user: AuthUser | null): AuthUser {
  if (!user) throw new GraphQLError('Authentication required.', { extensions: { code: 'UNAUTHENTICATED' } });
  return user;
}

export function requireAdmin(user: AuthUser | null): AuthUser {
  const authed = requireAuth(user);
  if (authed.role !== 'admin') throw new GraphQLError('Admin access required.', { extensions: { code: 'FORBIDDEN' } });
  return authed;
}
