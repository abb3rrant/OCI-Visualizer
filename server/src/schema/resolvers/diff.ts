import { PrismaClient } from '@prisma/client';
import { computeSnapshotDiff } from '../../services/snapshotDiff.js';

interface Context {
  prisma: PrismaClient;
  user: { userId: string; email: string } | null;
}

export const diffResolvers = {
  Query: {
    snapshotDiff: async (
      _parent: unknown,
      args: { snapshotIdA: string; snapshotIdB: string },
      ctx: Context,
    ) => {
      return computeSnapshotDiff(ctx.prisma, args.snapshotIdA, args.snapshotIdB);
    },
  },
};
