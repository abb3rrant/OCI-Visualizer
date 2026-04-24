import { PrismaClient } from '@prisma/client';
import { GraphQLError } from 'graphql';
import type { AuthUser } from '../../middleware/auth.js';

interface Context {
  prisma: PrismaClient;
  user: AuthUser | null;
}

export const snapshotResolvers = {
  Query: {
    snapshots: async (_parent: unknown, _args: unknown, ctx: Context) => {
      if (!ctx.user) {
        throw new GraphQLError('Authentication required.', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      // Get user's team members for team snapshot visibility
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.user.userId },
        select: { teamId: true },
      });

      const orConditions: any[] = [
        { userId: ctx.user.userId },
        { isShared: true },
      ];

      // If user has a team, also show snapshots from team members
      if (user?.teamId) {
        const teamMembers = await ctx.prisma.user.findMany({
          where: { teamId: user.teamId },
          select: { id: true },
        });
        const memberIds = teamMembers.map(m => m.id);
        orConditions.push({ userId: { in: memberIds } });
      }

      return ctx.prisma.snapshot.findMany({
        where: { OR: orConditions },
        orderBy: { importedAt: 'desc' as const },
        include: { _count: { select: { resources: true } } },
      });
    },

    snapshot: async (_parent: unknown, args: { id: string }, ctx: Context) => {
      if (!ctx.user) {
        throw new GraphQLError('Authentication required.', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      const snapshot = await ctx.prisma.snapshot.findUnique({
        where: { id: args.id },
        include: { _count: { select: { resources: true } } },
      });
      if (!snapshot) return null;
      if (snapshot.userId !== ctx.user.userId && !snapshot.isShared) {
        throw new GraphQLError('Not authorized to view this snapshot.', { extensions: { code: 'FORBIDDEN' } });
      }
      return snapshot;
    },
  },

  Mutation: {
    createSnapshot: async (
      _parent: unknown,
      args: { name: string; description?: string; importedAt?: string },
      ctx: Context,
    ) => {
      if (!ctx.user) {
        throw new GraphQLError('Authentication required.', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      if (ctx.user.role === 'viewer') {
        throw new GraphQLError('Viewers cannot create snapshots.', { extensions: { code: 'FORBIDDEN' } });
      }
      const data: any = {
        name: args.name,
        description: args.description ?? null,
        userId: ctx.user.userId,
      };
      if (args.importedAt) {
        // Validate ISO 8601 format before parsing
        if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(args.importedAt)) {
          throw new GraphQLError('importedAt must be a valid ISO 8601 date string', { extensions: { code: 'BAD_USER_INPUT' } });
        }
        const parsed = new Date(args.importedAt);
        if (isNaN(parsed.getTime())) {
          throw new GraphQLError('importedAt must be a valid ISO 8601 date string', { extensions: { code: 'BAD_USER_INPUT' } });
        }
        data.importedAt = parsed;
      }
      return ctx.prisma.snapshot.create({ data });
    },

    deleteSnapshot: async (
      _parent: unknown,
      args: { id: string },
      ctx: Context,
    ) => {
      if (!ctx.user) {
        throw new GraphQLError('Authentication required.', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      if (ctx.user.role === 'viewer') {
        throw new GraphQLError('Viewers cannot delete snapshots.', { extensions: { code: 'FORBIDDEN' } });
      }

      const snapshot = await ctx.prisma.snapshot.findUnique({
        where: { id: args.id },
      });
      if (!snapshot) {
        throw new GraphQLError('Snapshot not found.', { extensions: { code: 'NOT_FOUND' } });
      }
      if (snapshot.userId !== ctx.user.userId && ctx.user.role !== 'admin') {
        throw new GraphQLError('Not authorized to delete this snapshot.', { extensions: { code: 'FORBIDDEN' } });
      }

      // Cascade delete: resources and relations are deleted via Prisma onDelete: Cascade
      await ctx.prisma.snapshot.delete({ where: { id: args.id } });
      return true;
    },
  },

  Snapshot: {
    importedAt: (parent: any) => {
      // Prisma returns a Date object; ensure we serialize as ISO string
      if (parent.importedAt instanceof Date) return parent.importedAt.toISOString();
      return String(parent.importedAt);
    },
    resourceCount: (parent: any) => {
      // Use pre-loaded _count if available (batch-loaded from parent query), else fallback
      return parent._count?.resources ?? parent.resourceCount ?? 0;
    },
  },
};
