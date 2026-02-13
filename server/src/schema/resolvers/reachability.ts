import { PrismaClient } from '@prisma/client';
import { analyzeReachability } from '../../services/reachability.js';

interface Context {
  prisma: PrismaClient;
  user: { userId: string; email: string } | null;
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
