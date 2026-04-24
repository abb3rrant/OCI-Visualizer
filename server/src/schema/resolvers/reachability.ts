import { PrismaClient } from '@prisma/client';
import { analyzeReachability } from '../../services/reachability.js';
import { requireAuth, type AuthUser } from '../../middleware/auth.js';

interface Context {
  prisma: PrismaClient;
  user: AuthUser | null;
}

export const reachabilityResolvers = {
  Query: {
    reachabilityAnalysis: async (
      _parent: unknown,
      args: {
        snapshotId: string;
        sourceIp?: string;
        destinationIp?: string;
        protocol?: string;
        port?: number;
      },
      ctx: Context,
    ) => {
      requireAuth(ctx.user);
      return analyzeReachability(
        ctx.prisma,
        args.snapshotId,
        args.sourceIp ?? undefined,
        args.destinationIp ?? undefined,
        args.protocol ?? undefined,
        args.port ?? undefined,
      );
    },
  },
};
