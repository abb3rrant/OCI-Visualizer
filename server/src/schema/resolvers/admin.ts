import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { GraphQLError } from 'graphql';
import { requireAdmin, requireAuth, type AuthUser } from '../../middleware/auth.js';

interface Context {
  prisma: PrismaClient;
  user: AuthUser | null;
}

export const adminResolvers = {
  Query: {
    users: async (_parent: unknown, _args: unknown, ctx: Context) => {
      requireAdmin(ctx.user);
      return ctx.prisma.user.findMany({
        include: { team: true },
        orderBy: { createdAt: 'asc' },
      });
    },

    pendingUsers: async (_parent: unknown, _args: unknown, ctx: Context) => {
      requireAdmin(ctx.user);
      return ctx.prisma.user.findMany({
        where: { approved: false },
        include: { team: true },
        orderBy: { createdAt: 'asc' },
      });
    },

    teams: async (_parent: unknown, _args: unknown, ctx: Context) => {
      requireAdmin(ctx.user);
      return ctx.prisma.team.findMany({
        include: {
          members: {
            select: { id: true, email: true, name: true, role: true, approved: true, createdAt: true, teamId: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    },
  },

  Mutation: {
    approveUser: async (
      _parent: unknown,
      args: { userId: string },
      ctx: Context,
    ) => {
      requireAdmin(ctx.user);
      return ctx.prisma.user.update({
        where: { id: args.userId },
        data: { approved: true },
        include: { team: true },
      });
    },

    rejectUser: async (
      _parent: unknown,
      args: { userId: string },
      ctx: Context,
    ) => {
      const admin = requireAdmin(ctx.user);
      if (args.userId === admin.userId) {
        throw new GraphQLError('Cannot reject your own account.', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      await ctx.prisma.user.delete({ where: { id: args.userId } });
      return true;
    },

    updateUserRole: async (
      _parent: unknown,
      args: { userId: string; role: string },
      ctx: Context,
    ) => {
      requireAdmin(ctx.user);

      if (!['admin', 'viewer'].includes(args.role)) {
        throw new GraphQLError('Invalid role. Must be "admin" or "viewer".', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      return ctx.prisma.user.update({
        where: { id: args.userId },
        data: { role: args.role },
      });
    },

    createTeam: async (
      _parent: unknown,
      args: { name: string },
      ctx: Context,
    ) => {
      requireAdmin(ctx.user);

      return ctx.prisma.team.create({
        data: { name: args.name },
        include: { members: true },
      });
    },

    addUserToTeam: async (
      _parent: unknown,
      args: { userId: string; teamId: string },
      ctx: Context,
    ) => {
      requireAdmin(ctx.user);

      return ctx.prisma.user.update({
        where: { id: args.userId },
        data: { teamId: args.teamId },
        include: { team: true },
      });
    },

    removeUserFromTeam: async (
      _parent: unknown,
      args: { userId: string },
      ctx: Context,
    ) => {
      requireAdmin(ctx.user);

      return ctx.prisma.user.update({
        where: { id: args.userId },
        data: { teamId: null },
        include: { team: true },
      });
    },

    resetPasswordForUser: async (
      _parent: unknown,
      args: { userId: string; newPassword: string },
      ctx: Context,
    ) => {
      requireAdmin(ctx.user);

      if (args.newPassword.length < 10) {
        throw new GraphQLError('Password must be at least 10 characters long.', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      if (!/[a-z]/.test(args.newPassword) || !/[A-Z]/.test(args.newPassword) || !/[0-9]/.test(args.newPassword)) {
        throw new GraphQLError('Password must contain at least one uppercase letter, one lowercase letter, and one digit.', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      const passwordHash = await bcrypt.hash(args.newPassword, 12);
      return ctx.prisma.user.update({
        where: { id: args.userId },
        data: { passwordHash },
        include: { team: true },
      });
    },

    disableMfaForUser: async (
      _parent: unknown,
      args: { userId: string },
      ctx: Context,
    ) => {
      requireAdmin(ctx.user);
      return ctx.prisma.user.update({
        where: { id: args.userId },
        data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: null },
        include: { team: true },
      });
    },

    setMfaRequired: async (
      _parent: unknown,
      args: { userId: string; required: boolean },
      ctx: Context,
    ) => {
      requireAdmin(ctx.user);
      return ctx.prisma.user.update({
        where: { id: args.userId },
        data: { mfaRequired: args.required },
        include: { team: true },
      });
    },

    shareSnapshot: async (
      _parent: unknown,
      args: { snapshotId: string; isShared: boolean },
      ctx: Context,
    ) => {
      const user = requireAuth(ctx.user);

      const snapshot = await ctx.prisma.snapshot.findUnique({
        where: { id: args.snapshotId },
      });
      if (!snapshot) throw new GraphQLError('Snapshot not found.', { extensions: { code: 'NOT_FOUND' } });
      if (snapshot.userId !== user.userId && user.role !== 'admin') {
        throw new GraphQLError('Not authorized.', { extensions: { code: 'FORBIDDEN' } });
      }

      return ctx.prisma.snapshot.update({
        where: { id: args.snapshotId },
        data: { isShared: args.isShared },
      });
    },
  },

  Team: {
    members: (parent: any, _args: unknown, ctx: Context) => {
      // Use pre-loaded members if available from parent query; fallback to query
      if (parent.members) return parent.members;
      return ctx.prisma.user.findMany({
        where: { teamId: parent.id },
        select: { id: true, email: true, name: true, role: true, approved: true, createdAt: true, teamId: true },
      });
    },
  },
};
