import { PrismaClient } from '@prisma/client';
import { runIamAnalysis } from '../../services/iamAnalysis.js';
import { requireAuth, type AuthUser } from '../../middleware/auth.js';

interface Context {
  prisma: PrismaClient;
  user: AuthUser | null;
}

export const iamAnalysisResolvers = {
  Query: {
    iamAnalysis: async (
      _parent: unknown,
      args: { snapshotId: string },
      ctx: Context,
    ) => {
      requireAuth(ctx.user);
      return runIamAnalysis(ctx.prisma, args.snapshotId);
    },
  },
};
