import { PrismaClient } from '@prisma/client';
import { importJsonString } from '../../services/import.js';

interface Context {
  prisma: PrismaClient;
  user: { userId: string; email: string } | null;
}

export const importResolvers = {
  Mutation: {
    importJson: async (
      _parent: unknown,
      args: { snapshotId: string; resourceType?: string; jsonData: string },
      ctx: Context,
    ) => {
      if (!ctx.user) {
        throw new Error('Authentication required.');
      }

      // Verify the snapshot exists and belongs to the current user
      const snapshot = await ctx.prisma.snapshot.findUnique({
        where: { id: args.snapshotId },
      });
      if (!snapshot) {
        throw new Error('Snapshot not found.');
      }
      if (snapshot.userId !== ctx.user.userId) {
        throw new Error('Not authorized to import into this snapshot.');
      }

      const result = await importJsonString(
        ctx.prisma,
        args.snapshotId,
        args.jsonData,
        args.resourceType ?? undefined,
      );

      return result;
    },
  },
};
