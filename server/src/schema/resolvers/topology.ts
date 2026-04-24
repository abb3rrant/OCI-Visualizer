import { PrismaClient } from '@prisma/client';
import { buildTopology, expandInstances } from '../../services/topology.js';
import { requireAuth, type AuthUser } from '../../middleware/auth.js';

interface Context {
  prisma: PrismaClient;
  user: AuthUser | null;
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
      requireAuth(ctx.user);
      return buildTopology(
        ctx.prisma,
        args.snapshotId,
        args.compartmentId ?? null,
        args.viewType,
      );
    },
    expandInstances: async (
      _parent: unknown,
      args: { snapshotId: string; parentOcids: string[] },
      ctx: Context,
    ) => {
      requireAuth(ctx.user);
      return expandInstances(ctx.prisma, args.snapshotId, args.parentOcids);
    },
  },
};
