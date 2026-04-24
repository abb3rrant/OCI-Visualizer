import { PrismaClient } from '@prisma/client';
import { computeSnapshotDiff } from '../../services/snapshotDiff.js';
import { requireAuth, type AuthUser } from '../../middleware/auth.js';

interface Context {
  prisma: PrismaClient;
  user: AuthUser | null;
}

export const diffResolvers = {
  Query: {
    snapshotDiff: async (
      _parent: unknown,
      args: { snapshotIdA: string; snapshotIdB: string },
      ctx: Context,
    ) => {
      requireAuth(ctx.user);
      return computeSnapshotDiff(ctx.prisma, args.snapshotIdA, args.snapshotIdB);
    },
  },
};
