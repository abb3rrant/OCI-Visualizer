import { PrismaClient } from '@prisma/client';

interface Context {
  prisma: PrismaClient;
  user: { userId: string; email: string } | null;
}

export const snapshotResolvers = {
  Query: {
    snapshots: async (_parent: unknown, _args: unknown, ctx: Context) => {
      if (!ctx.user) {
        throw new Error('Authentication required.');
      }
      return ctx.prisma.snapshot.findMany({
        where: { userId: ctx.user.userId },
        orderBy: { importedAt: 'desc' as const },
      });
    },

    snapshot: async (_parent: unknown, args: { id: string }, ctx: Context) => {
      if (!ctx.user) {
        throw new Error('Authentication required.');
      }
      const snapshot = await ctx.prisma.snapshot.findUnique({
        where: { id: args.id },
      });
      if (!snapshot) return null;
      if (snapshot.userId !== ctx.user.userId) {
        throw new Error('Not authorized to view this snapshot.');
      }
      return snapshot;
    },
  },

  Mutation: {
    createSnapshot: async (
      _parent: unknown,
      args: { name: string; description?: string },
      ctx: Context,
    ) => {
      if (!ctx.user) {
        throw new Error('Authentication required.');
      }
      return ctx.prisma.snapshot.create({
        data: {
          name: args.name,
          description: args.description ?? null,
          userId: ctx.user.userId,
        },
      });
    },

    deleteSnapshot: async (
      _parent: unknown,
      args: { id: string },
      ctx: Context,
    ) => {
      if (!ctx.user) {
        throw new Error('Authentication required.');
      }

      const snapshot = await ctx.prisma.snapshot.findUnique({
        where: { id: args.id },
      });
      if (!snapshot) {
        throw new Error('Snapshot not found.');
      }
      if (snapshot.userId !== ctx.user.userId) {
        throw new Error('Not authorized to delete this snapshot.');
      }

      // Cascade delete: resources and relations are deleted via Prisma onDelete: Cascade
      await ctx.prisma.snapshot.delete({ where: { id: args.id } });
      return true;
    },
  },

  Snapshot: {
    resourceCount: async (parent: any, _args: unknown, ctx: Context) => {
      return ctx.prisma.resource.count({
        where: { snapshotId: parent.id },
      });
    },
  },
};
