import { PrismaClient } from '@prisma/client';
import { runAudit, runTagCompliance } from '../../services/audit.js';

interface Context {
  prisma: PrismaClient;
  user: { userId: string; email: string } | null;
}

export const auditResolvers = {
  Query: {
    auditFindings: async (
      _parent: unknown,
      args: { snapshotId: string },
      ctx: Context,
    ) => {
      return runAudit(ctx.prisma, args.snapshotId);
    },

    resourceFindings: async (
      _parent: unknown,
      args: { snapshotId: string; resourceId: string },
      ctx: Context,
    ) => {
      const report = await runAudit(ctx.prisma, args.snapshotId);
      return report.groupedFindings.filter(f =>
        f.resources.some(r => r.id === args.resourceId)
      );
    },

    auditTrend: async (_parent: unknown, _args: unknown, ctx: Context) => {
      if (!ctx.user) throw new Error('Authentication required');
      const snapshots = await ctx.prisma.snapshot.findMany({
        where: { userId: ctx.user.userId },
        orderBy: { importedAt: 'asc' },
        select: { id: true, name: true, importedAt: true },
      });

      const results = [];
      for (const snap of snapshots) {
        const report = await runAudit(ctx.prisma, snap.id);
        results.push({
          snapshotId: snap.id,
          snapshotName: snap.name,
          date: snap.importedAt.toISOString(),
          ...report.summary,
        });
      }
      return results;
    },

    tagCompliance: async (
      _parent: unknown,
      args: { snapshotId: string; requiredTags: string[] },
      ctx: Context,
    ) => {
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
