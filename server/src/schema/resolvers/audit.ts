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
