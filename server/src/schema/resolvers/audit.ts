import { PrismaClient } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { runAudit, runTagCompliance } from '../../services/audit.js';
import { requireAuth, type AuthUser } from '../../middleware/auth.js';

interface Context {
  prisma: PrismaClient;
  user: AuthUser | null;
}

export const auditResolvers = {
  Query: {
    auditFindings: async (
      _parent: unknown,
      args: { snapshotId: string },
      ctx: Context,
    ) => {
      requireAuth(ctx.user);
      return runAudit(ctx.prisma, args.snapshotId, ctx.user?.userId);
    },

    resourceFindings: async (
      _parent: unknown,
      args: { snapshotId: string; resourceId: string },
      ctx: Context,
    ) => {
      requireAuth(ctx.user);
      const report = await runAudit(ctx.prisma, args.snapshotId, ctx.user?.userId);
      return report.groupedFindings.filter(f =>
        f.resources.some(r => r.id === args.resourceId)
      );
    },

    auditTrend: async (_parent: unknown, _args: unknown, ctx: Context) => {
      if (!ctx.user) throw new GraphQLError('Authentication required.', { extensions: { code: 'UNAUTHENTICATED' } });
      const snapshots = await ctx.prisma.snapshot.findMany({
        where: { userId: ctx.user.userId },
        orderBy: { importedAt: 'desc' },
        select: { id: true, name: true, importedAt: true },
        take: 20,
      });
      // Reverse so chart displays oldest to newest
      snapshots.reverse();

      // Process in chunks of 5 to avoid pool exhaustion
      const results: any[] = [];
      for (let i = 0; i < snapshots.length; i += 5) {
        const chunk = snapshots.slice(i, i + 5);
        const chunkResults = await Promise.all(
          chunk.map(async (snap) => {
            const report = await runAudit(ctx.prisma, snap.id, ctx.user!.userId);
            return {
              snapshotId: snap.id,
              snapshotName: snap.name,
              date: snap.importedAt.toISOString(),
              ...report.summary,
            };
          }),
        );
        results.push(...chunkResults);
      }
      return results;
    },

    tagCompliance: async (
      _parent: unknown,
      args: { snapshotId: string; requiredTags: string[] },
      ctx: Context,
    ) => {
      requireAuth(ctx.user);
      const report = await runTagCompliance(
        ctx.prisma,
        args.snapshotId,
        args.requiredTags,
      );

      // The service returns missingTagResourceIds (string[]).
      // We need to load the actual Resource objects for the GraphQL type.
      let missingTagResources: any[] = [];
      if (report.missingTagResourceIds.length > 0) {
        missingTagResources = await ctx.prisma.resource.findMany({
          where: { id: { in: report.missingTagResourceIds } },
        });
      }

      return {
        totalResources: report.totalResources,
        compliantResources: report.compliantResources,
        nonCompliantResources: report.nonCompliantResources,
        tagCoverage: report.tagCoverage,
        missingTagResources,
      };
    },
  },
};
