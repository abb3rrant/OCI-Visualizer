import { PrismaClient } from '@prisma/client';
import { buildTopology } from '../../services/topology.js';

interface Context {
  prisma: PrismaClient;
  user: { userId: string; email: string } | null;
}

export const topologyResolvers = {
  Query: {
    topology: async (
      _parent: unknown,
      args: {
        snapshotId: string;
        compartmentId?: string;
        viewType: 'NETWORK' | 'COMPARTMENT' | 'DEPENDENCY' | 'EXPOSURE';
      },
      ctx: Context,
    ) => {
      return buildTopology(
        ctx.prisma,
        args.snapshotId,
        args.compartmentId ?? null,
        args.viewType,
      );
    },
  },
};
