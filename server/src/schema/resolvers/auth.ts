import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { GraphQLError } from 'graphql';
import { generateSecret, generateURI, verify as otpVerify } from 'otplib';
import QRCode from 'qrcode';
import { signToken, signMfaToken, verifyMfaToken, requireAuth, type AuthUser } from '../../middleware/auth.js';
import { logger } from '../../utils/logger.js';

interface Context {
  prisma: PrismaClient;
  user: AuthUser | null;
}

export const authResolvers = {
  Query: {
    me: async (_parent: unknown, _args: unknown, ctx: Context) => {
      if (!ctx.user) return null;
      return ctx.prisma.user.findUnique({
        where: { id: ctx.user.userId },
        include: { team: true },
      });
    },
  },

  Mutation: {
    register: async (
      _parent: unknown,
      args: { email: string; password: string; name?: string },
      ctx: Context,
    ) => {
      try {
        if (args.password.length < 10) {
          throw new GraphQLError('Password must be at least 10 characters long.', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }
        if (!/[a-z]/.test(args.password) || !/[A-Z]/.test(args.password) || !/[0-9]/.test(args.password)) {
          throw new GraphQLError('Password must contain at least one uppercase letter, one lowercase letter, and one digit.', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        const existing = await ctx.prisma.user.findUnique({
          where: { email: args.email },
        });
        if (existing) {
          throw new GraphQLError('A user with that email already exists.', {
            extensions: { code: 'BAD_USER_INPUT' },
          });
        }

        // First user gets admin role + auto-approved; subsequent get viewer + pending
        const userCount = await ctx.prisma.user.count();
        const isFirstUser = userCount === 0;
        const role = isFirstUser ? 'admin' : 'viewer';

        const passwordHash = await bcrypt.hash(args.password, 12);
        const user = await ctx.prisma.user.create({
          data: {
            email: args.email,
            passwordHash,
            name: args.name ?? null,
            role,
            approved: isFirstUser,
          },
        });

        if (isFirstUser) {
          const token = signToken({ userId: user.id, email: user.email, role: user.role });
          return { token, user, message: 'Registration successful.' };
        }

        return { token: null, user, message: 'Registration successful. Your account is pending admin approval.' };
      } catch (err) {
        logger.error('Registration error', { error: String(err) });
        if (err instanceof GraphQLError) throw err;
        throw new GraphQLError(
          err instanceof Error ? err.message : 'Registration failed',
          { extensions: { code: 'BAD_USER_INPUT' } },
        );
      }
    },

    login: async (
      _parent: unknown,
      args: { email: string; password: string },
      ctx: Context,
    ) => {
      try {
        const user = await ctx.prisma.user.findUnique({
          where: { email: args.email },
        });
        if (!user) {
          throw new GraphQLError('Invalid email or password.', {
            extensions: { code: 'UNAUTHENTICATED' },
          });
        }

        const valid = await bcrypt.compare(args.password, user.passwordHash);
        if (!valid) {
          throw new GraphQLError('Invalid email or password.', {
            extensions: { code: 'UNAUTHENTICATED' },
          });
        }

        if (!user.approved) {
          throw new GraphQLError('Your account is pending admin approval.', {
            extensions: { code: 'FORBIDDEN' },
          });
        }

        if (user.mfaEnabled) {
          const mfaToken = signMfaToken(user.id);
          return { token: null, user: null, mfaRequired: true, mfaSetupRequired: false, mfaToken };
        }

        // If admin requires MFA but user hasn't set it up yet, issue a full token
        // but flag that setup is required so the client can redirect to settings
        if (user.mfaRequired && !user.mfaEnabled) {
          const token = signToken({ userId: user.id, email: user.email, role: user.role });
          return { token, user, mfaRequired: false, mfaSetupRequired: true, mfaToken: null };
        }

        const token = signToken({ userId: user.id, email: user.email, role: user.role });
        return { token, user, mfaRequired: false, mfaSetupRequired: false, mfaToken: null };
      } catch (err) {
        logger.error('Login error', { error: String(err) });
        if (err instanceof GraphQLError) throw err;
        throw new GraphQLError(
          err instanceof Error ? err.message : 'Login failed',
          { extensions: { code: 'UNAUTHENTICATED' } },
        );
      }
    },

    changePassword: async (
      _parent: unknown,
      args: { currentPassword: string; newPassword: string },
      ctx: Context,
    ) => {
      const authed = requireAuth(ctx.user);
      const user = await ctx.prisma.user.findUnique({ where: { id: authed.userId } });
      if (!user) throw new GraphQLError('User not found.', { extensions: { code: 'NOT_FOUND' } });

      const valid = await bcrypt.compare(args.currentPassword, user.passwordHash);
      if (!valid) {
        throw new GraphQLError('Current password is incorrect.', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      if (args.newPassword.length < 10) {
        throw new GraphQLError('Password must be at least 10 characters long.', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      if (!/[a-z]/.test(args.newPassword) || !/[A-Z]/.test(args.newPassword) || !/[0-9]/.test(args.newPassword)) {
        throw new GraphQLError('Password must contain at least one uppercase letter, one lowercase letter, and one digit.', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      const passwordHash = await bcrypt.hash(args.newPassword, 12);
      await ctx.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      return true;
    },

    setupMfa: async (_parent: unknown, _args: unknown, ctx: Context) => {
      const authed = requireAuth(ctx.user);
      const user = await ctx.prisma.user.findUnique({ where: { id: authed.userId } });
      if (!user) throw new GraphQLError('User not found.', { extensions: { code: 'NOT_FOUND' } });

      const secret = generateSecret();
      const otpauth = generateURI({ secret, issuer: 'OCI Visualizer', label: user.email });
      const qrCodeDataUri = await QRCode.toDataURL(otpauth);

      // Generate 10 backup codes
      const backupCodes: string[] = [];
      const hashedCodes: string[] = [];
      for (let i = 0; i < 10; i++) {
        const code = crypto.randomBytes(4).toString('hex');
        backupCodes.push(code);
        hashedCodes.push(await bcrypt.hash(code, 10));
      }

      await ctx.prisma.user.update({
        where: { id: user.id },
        data: {
          mfaSecret: secret,
          mfaBackupCodes: JSON.stringify(hashedCodes),
        },
      });

      return { secret, qrCodeDataUri, backupCodes };
    },

    verifyMfaSetup: async (_parent: unknown, args: { code: string }, ctx: Context) => {
      const authed = requireAuth(ctx.user);
      const user = await ctx.prisma.user.findUnique({ where: { id: authed.userId } });
      if (!user || !user.mfaSecret) {
        throw new GraphQLError('MFA setup not initiated.', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      const verifyResult = await otpVerify({ token: args.code, secret: user.mfaSecret });
      const isValid = verifyResult.valid;
      if (!isValid) {
        throw new GraphQLError('Invalid verification code.', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      await ctx.prisma.user.update({
        where: { id: user.id },
        data: { mfaEnabled: true },
      });

      return true;
    },

    disableMfa: async (_parent: unknown, args: { password: string }, ctx: Context) => {
      const authed = requireAuth(ctx.user);
      const user = await ctx.prisma.user.findUnique({ where: { id: authed.userId } });
      if (!user) throw new GraphQLError('User not found.', { extensions: { code: 'NOT_FOUND' } });

      const valid = await bcrypt.compare(args.password, user.passwordHash);
      if (!valid) {
        throw new GraphQLError('Invalid password.', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      await ctx.prisma.user.update({
        where: { id: user.id },
        data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: null },
      });

      return true;
    },

    verifyMfaLogin: async (
      _parent: unknown,
      args: { mfaToken: string; code: string },
      ctx: Context,
    ) => {
      const userId = verifyMfaToken(args.mfaToken);
      if (!userId) {
        throw new GraphQLError('Invalid or expired MFA token.', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      const user = await ctx.prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.mfaSecret) {
        throw new GraphQLError('User not found or MFA not configured.', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      // Try TOTP first
      const verifyResult = await otpVerify({ token: args.code, secret: user.mfaSecret });
      const isValid = verifyResult.valid;
      if (isValid) {
        const token = signToken({ userId: user.id, email: user.email, role: user.role });
        return { token, user };
      }

      // Try backup codes
      if (user.mfaBackupCodes) {
        const hashedCodes: string[] = JSON.parse(user.mfaBackupCodes);
        for (let i = 0; i < hashedCodes.length; i++) {
          const match = await bcrypt.compare(args.code, hashedCodes[i]);
          if (match) {
            // Consume the backup code
            hashedCodes.splice(i, 1);
            await ctx.prisma.user.update({
              where: { id: user.id },
              data: { mfaBackupCodes: JSON.stringify(hashedCodes) },
            });
            const token = signToken({ userId: user.id, email: user.email, role: user.role });
            return { token, user };
          }
        }
      }

      throw new GraphQLError('Invalid MFA code.', { extensions: { code: 'UNAUTHENTICATED' } });
    },
  },
};
