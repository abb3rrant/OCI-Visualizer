import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  // Ensure env.ts picks up a deterministic secret for the test run.
  process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!';
  process.env.NODE_ENV = 'test';
});

describe('auth middleware', () => {
  it('round-trips a JWT', async () => {
    const { signToken, verifyToken } = await import('./auth.js');
    const user = { userId: 'u1', email: 'a@b.com', role: 'admin' };
    const token = signToken(user);
    const decoded = verifyToken(token);
    expect(decoded?.userId).toBe('u1');
    expect(decoded?.role).toBe('admin');
  });

  it('rejects a tampered token', async () => {
    const { signToken, verifyToken } = await import('./auth.js');
    const token = signToken({ userId: 'u1', email: 'a@b.com', role: 'viewer' });
    const tampered = token.slice(0, -4) + 'AAAA';
    expect(verifyToken(tampered)).toBeNull();
  });

  it('issues an MFA token with the correct purpose', async () => {
    const { signMfaToken, verifyMfaToken, verifyToken } = await import('./auth.js');
    const token = signMfaToken('u1');
    expect(verifyMfaToken(token)).toBe('u1');
    // An MFA token must not be accepted as a full auth token.
    const asAuth = verifyToken(token);
    expect(asAuth?.role).toBeUndefined();
  });
});
