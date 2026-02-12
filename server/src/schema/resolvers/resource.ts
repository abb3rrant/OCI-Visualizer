import { PrismaClient } from '@prisma/client';
import { generateExportScript } from '../../utils/exportScript.js';

interface Context {
  prisma: PrismaClient;
  user: { userId: string; email: string } | null;
}

interface ResourceFilter {
  snapshotId: string;
  resourceType?: string;
  compartmentId?: string;
  lifecycleState?: string;
  search?: string;
  first?: number;
  after?: string;
}

/**
 * Parse a JSON-serialised string field, returning the parsed value or null.
 */
function parseJsonField(value: string | null | undefined): any {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export const resourceResolvers = {
  Query: {
    resources: async (
      _parent: unknown,
      args: { filter: ResourceFilter },
      ctx: Context,
    ) => {
      const { snapshotId, resourceType, compartmentId, lifecycleState, search, first, after } =
        args.filter;

      const take = Math.min(first ?? 50, 200);

      // Build Prisma where clause
      const where: Record<string, any> = { snapshotId };
      if (resourceType) where.resourceType = resourceType;
      if (compartmentId) where.compartmentId = compartmentId;
      if (lifecycleState) where.lifecycleState = lifecycleState;
      if (search) {
        where.OR = [
          { displayName: { contains: search } },
          { ocid: { contains: search } },
        ];
      }

      // Total count (unaffected by cursor/take)
      const totalCount = await ctx.prisma.resource.count({ where });

      // Cursor-based pagination
      const findArgs: any = {
        where,
        take: take + 1, // fetch one extra to determine hasNextPage
        orderBy: { id: 'asc' as const },
      };
      if (after) {
        findArgs.cursor = { id: after };
        findArgs.skip = 1; // skip the cursor element itself
      }

      const resources = await ctx.prisma.resource.findMany(findArgs);

      const hasNextPage = resources.length > take;
      const sliced = hasNextPage ? resources.slice(0, take) : resources;

      const edges = sliced.map((r: any) => ({
        cursor: r.id,
        node: r,
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage,
          endCursor: sliced.length > 0 ? sliced[sliced.length - 1].id : null,
        },
        totalCount,
      };
    },

    resource: async (_parent: unknown, args: { id: string }, ctx: Context) => {
      return ctx.prisma.resource.findUnique({ where: { id: args.id } });
    },

    resourceByOcid: async (
      _parent: unknown,
      args: { ocid: string; snapshotId: string },
      ctx: Context,
    ) => {
      return ctx.prisma.resource.findUnique({
        where: {
          ocid_snapshotId: {
            ocid: args.ocid,
            snapshotId: args.snapshotId,
          },
        },
      });
    },

    compartments: async (
      _parent: unknown,
      args: { snapshotId: string },
      ctx: Context,
    ) => {
      return ctx.prisma.resource.findMany({
        where: {
          snapshotId: args.snapshotId,
          resourceType: 'iam/compartment',
        },
        orderBy: { displayName: 'asc' },
      });
    },

    exportScript: () => generateExportScript(),

    resourceCounts: async (
      _parent: unknown,
      args: { snapshotId: string },
      ctx: Context,
    ) => {
      const groups = await ctx.prisma.resource.groupBy({
        by: ['resourceType'],
        where: { snapshotId: args.snapshotId },
        _count: { _all: true },
        orderBy: { resourceType: 'asc' as const },
      });

      return groups.map((g: any) => ({
        resourceType: g.resourceType,
        count: g._count._all,
      }));
    },
  },

  Resource: {
    definedTags: (parent: any) => parseJsonField(parent.definedTags),
    freeformTags: (parent: any) => parseJsonField(parent.freeformTags),
    rawData: (parent: any) => parseJsonField(parent.rawData),

    relationsFrom: (parent: any, _args: unknown, ctx: Context) => {
      return ctx.prisma.resourceRelation.findMany({
        where: { fromResourceId: parent.id },
      });
    },

    relationsTo: (parent: any, _args: unknown, ctx: Context) => {
      return ctx.prisma.resourceRelation.findMany({
        where: { toResourceId: parent.id },
      });
    },
  },

  ResourceRelation: {
    metadata: (parent: any) => parseJsonField(parent.metadata),
    fromResource: (parent: any, _args: unknown, ctx: Context) => {
      return ctx.prisma.resource.findUnique({ where: { id: parent.fromResourceId } });
    },
    toResource: (parent: any, _args: unknown, ctx: Context) => {
      return ctx.prisma.resource.findUnique({ where: { id: parent.toResourceId } });
    },
  },
};
