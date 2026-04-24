import { PrismaClient } from '@prisma/client';
import { generateExportScript } from '../../utils/exportScript.js';
import { requireAuth, type AuthUser } from '../../middleware/auth.js';
import { validateRegexPattern } from '../../utils/regexGuard.js';
import type { Loaders } from '../../utils/dataloaders.js';

interface Context {
  prisma: PrismaClient;
  user: AuthUser | null;
  loaders: Loaders;
}

interface ResourceFilter {
  snapshotId: string;
  resourceType?: string;
  compartmentId?: string;
  lifecycleState?: string;
  search?: string;
  isRegex?: boolean;
  first?: number;
  after?: string;
  skip?: number;
}

/**
 * Build a regex-aware search snippet from content around the first match.
 */
function extractSnippet(content: string, query: string, isRegex: boolean, context = 100): string {
  let idx = -1;
  let matchLen = query.length;
  if (isRegex) {
    try {
      const re = new RegExp(query.replace(/\(\?[imsx]+\)/g, ''), 'i');
      const m = re.exec(content);
      if (m) { idx = m.index; matchLen = m[0].length; }
    } catch { /* invalid regex */ }
  } else {
    idx = content.toLowerCase().indexOf(query.toLowerCase());
  }
  if (idx === -1) return content.slice(0, 200);
  const start = Math.max(0, idx - context);
  const end = Math.min(content.length, idx + matchLen + context);
  return (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '');
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
      requireAuth(ctx.user);
      const { snapshotId, resourceType, compartmentId, lifecycleState, search, isRegex, first, after, skip } =
        args.filter;

      const take = Math.min(first ?? 50, 200);

      // Build Prisma where clause
      const where: Record<string, any> = { snapshotId };
      if (resourceType) where.resourceType = resourceType;
      if (compartmentId) where.compartmentId = compartmentId;
      if (lifecycleState) where.lifecycleState = lifecycleState;
      if (search) {
        if (isRegex) {
          where.OR = [
            { displayName: { not: null } },
            { ocid: { not: null } },
          ];
          // We'll use raw query for regex
        } else {
          where.OR = [
            { displayName: { contains: search } },
            { ocid: { contains: search } },
            { freeformTags: { contains: search } },
            { definedTags: { contains: search } },
            { rawData: { contains: search } },
          ];
        }
      }

      if (search && isRegex) {
        validateRegexPattern(search);
        // Use raw SQL for regex search with PostgreSQL ~* operator
        // Build parameterized query dynamically
        const params: any[] = [];
        const conditions: string[] = [];

        params.push(snapshotId);
        conditions.push(`"snapshotId" = $${params.length}`);

        if (resourceType) { params.push(resourceType); conditions.push(`"resourceType" = $${params.length}`); }
        if (compartmentId) { params.push(compartmentId); conditions.push(`"compartmentId" = $${params.length}`); }
        if (lifecycleState) { params.push(lifecycleState); conditions.push(`"lifecycleState" = $${params.length}`); }

        params.push(search);
        const searchIdx = params.length;
        conditions.push(`(COALESCE("displayName",'') ~* $${searchIdx} OR "ocid" ~* $${searchIdx} OR COALESCE("freeformTags",'') ~* $${searchIdx} OR COALESCE("definedTags",'') ~* $${searchIdx} OR COALESCE("rawData",'') ~* $${searchIdx})`);

        const baseSql = conditions.join(' AND ');

        const countResult: any[] = await ctx.prisma.$queryRawUnsafe(
          `SELECT COUNT(*)::int as count FROM "Resource" WHERE ${baseSql}`,
          ...params,
        );
        const totalCount = countResult[0]?.count ?? 0;

        let offsetVal = 0;
        if (skip != null && skip > 0) offsetVal = skip;

        if (after) {
          const cursorParams = [...params, after];
          const cursorResult: any[] = await ctx.prisma.$queryRawUnsafe(
            `SELECT COUNT(*)::int as pos FROM "Resource" WHERE ${baseSql} AND "id" <= $${cursorParams.length}`,
            ...cursorParams,
          );
          offsetVal = cursorResult[0]?.pos ?? 0;
        }

        // Fetch matching resource IDs, then load via Prisma for correct typing
        const idRows: any[] = await ctx.prisma.$queryRawUnsafe(
          `SELECT "id" FROM "Resource" WHERE ${baseSql} ORDER BY "id" ASC LIMIT ${take + 1} OFFSET ${offsetVal}`,
          ...params,
        );
        const matchIds = idRows.map((r: any) => r.id);
        const resources = matchIds.length > 0
          ? await ctx.prisma.resource.findMany({ where: { id: { in: matchIds } }, orderBy: { id: 'asc' } })
          : [];

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
      }

      // Total count (unaffected by cursor/take)
      const totalCount = await ctx.prisma.resource.count({ where });

      // Pagination: offset-based (skip) or cursor-based (after)
      const findArgs: any = {
        where,
        take: take + 1, // fetch one extra to determine hasNextPage
        orderBy: { id: 'asc' as const },
      };
      if (after) {
        findArgs.cursor = { id: after };
        findArgs.skip = 1; // skip the cursor element itself
      } else if (skip != null && skip > 0) {
        findArgs.skip = skip;
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
      requireAuth(ctx.user);
      return ctx.prisma.resource.findUnique({ where: { id: args.id } });
    },

    resourceByOcid: async (
      _parent: unknown,
      args: { ocid: string; snapshotId: string },
      ctx: Context,
    ) => {
      requireAuth(ctx.user);
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
      requireAuth(ctx.user);
      // First try: explicit iam/compartment resources (best — have display names)
      const compartmentResources = await ctx.prisma.resource.findMany({
        where: {
          snapshotId: args.snapshotId,
          resourceType: 'iam/compartment',
        },
        orderBy: { displayName: 'asc' },
      });

      if (compartmentResources.length > 0) return compartmentResources;

      // Fallback: extract distinct compartmentId values from all resources
      // and return synthetic compartment objects so the dropdown still works
      const distinct = await ctx.prisma.resource.findMany({
        where: { snapshotId: args.snapshotId, compartmentId: { not: null } },
        select: { compartmentId: true },
        distinct: ['compartmentId'],
      });

      return distinct
        .filter((d: any) => d.compartmentId)
        .map((d: any, i: number) => ({
          id: `synthetic-compartment-${i}`,
          ocid: d.compartmentId,
          resourceType: 'iam/compartment',
          displayName: d.compartmentId, // show OCID when no name available
          compartmentId: null,
          lifecycleState: null,
          availabilityDomain: null,
          regionKey: null,
          timeCreated: null,
          definedTags: null,
          freeformTags: null,
          rawData: null,
          snapshotId: args.snapshotId,
        }));
    },

    searchResources: async (
      _parent: unknown,
      args: { snapshotId: string; query: string; isRegex?: boolean; limit?: number },
      ctx: Context,
    ) => {
      requireAuth(ctx.user);
      const limit = Math.min(args.limit ?? 20, 50);

      if (args.isRegex) {
        validateRegexPattern(args.query);
        const idRows: any[] = await ctx.prisma.$queryRawUnsafe(
          `SELECT "id" FROM "Resource" WHERE "snapshotId" = $1 AND (COALESCE("displayName",'') ~* $2 OR "ocid" ~* $2 OR COALESCE("freeformTags",'') ~* $2 OR COALESCE("definedTags",'') ~* $2) ORDER BY "displayName" ASC NULLS LAST LIMIT ${limit}`,
          args.snapshotId,
          args.query,
        );
        if (idRows.length === 0) return [];
        return ctx.prisma.resource.findMany({
          where: { id: { in: idRows.map((r: any) => r.id) } },
          orderBy: { displayName: 'asc' },
        });
      }

      return ctx.prisma.resource.findMany({
        where: {
          snapshotId: args.snapshotId,
          OR: [
            { displayName: { contains: args.query } },
            { ocid: { contains: args.query } },
            { freeformTags: { contains: args.query } },
            { definedTags: { contains: args.query } },
          ],
        },
        take: limit,
        orderBy: { displayName: 'asc' },
      });
    },

    exportScript: () => generateExportScript(),

    compartmentCounts: async (
      _parent: unknown,
      args: { snapshotId: string },
      ctx: Context,
    ) => {
      requireAuth(ctx.user);
      const groups: any[] = await (ctx.prisma.resource.groupBy as any)({
        by: ['compartmentId'],
        where: { snapshotId: args.snapshotId, compartmentId: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      });

      // Look up compartment names
      const compartmentOcids = groups.map((g: any) => g.compartmentId).filter(Boolean);
      const compartments = await ctx.prisma.resource.findMany({
        where: {
          snapshotId: args.snapshotId,
          resourceType: 'iam/compartment',
          ocid: { in: compartmentOcids },
        },
        select: { ocid: true, displayName: true },
      });
      const nameMap = new Map(compartments.map((c: any) => [c.ocid, c.displayName]));

      return groups.map((g: any) => ({
        compartmentId: g.compartmentId || '',
        compartmentName: nameMap.get(g.compartmentId) || null,
        count: g._count.id,
      }));
    },

    lifecycleStateCounts: async (
      _parent: unknown,
      args: { snapshotId: string },
      ctx: Context,
    ) => {
      requireAuth(ctx.user);
      const groups = await ctx.prisma.resource.groupBy({
        by: ['lifecycleState'],
        where: { snapshotId: args.snapshotId },
        _count: { id: true },
      });

      return groups.map((g: any) => ({
        name: g.lifecycleState || 'Unknown',
        count: g._count.id,
      }));
    },

    tagSummary: async (
      _parent: unknown,
      args: { snapshotId: string },
      ctx: Context,
    ) => {
      requireAuth(ctx.user);
      const CHUNK = 5000;
      const tagMap = new Map<string, { values: Set<string>; count: number }>();

      let cursor: string | undefined;
      while (true) {
        const findArgs: any = {
          where: { snapshotId: args.snapshotId },
          select: { id: true, freeformTags: true },
          take: CHUNK,
          orderBy: { id: 'asc' as const },
        };
        if (cursor) {
          findArgs.cursor = { id: cursor };
          findArgs.skip = 1;
        }

        const chunk = await ctx.prisma.resource.findMany(findArgs);
        if (chunk.length === 0) break;

        for (const r of chunk) {
          if (!r.freeformTags) continue;
          let tags: Record<string, string>;
          try {
            tags = JSON.parse(r.freeformTags as string);
          } catch {
            continue;
          }
          for (const [key, value] of Object.entries(tags)) {
            let entry = tagMap.get(key);
            if (!entry) {
              entry = { values: new Set(), count: 0 };
              tagMap.set(key, entry);
            }
            entry.count++;
            if (entry.values.size < 100) {
              entry.values.add(String(value));
            }
          }
        }

        cursor = chunk[chunk.length - 1].id;
        if (chunk.length < CHUNK) break;
      }

      return Array.from(tagMap.entries())
        .map(([tagKey, data]) => ({
          tagKey,
          values: Array.from(data.values).sort(),
          resourceCount: data.count,
        }))
        .sort((a, b) => b.resourceCount - a.resourceCount);
    },

    listBlobs: async (
      _parent: unknown,
      args: { snapshotId: string; blobKey: string; query?: string; isRegex?: boolean; first?: number; after?: string },
      ctx: Context,
    ) => {
      requireAuth(ctx.user);
      const take = Math.min(args.first ?? 50, 200);

      const where: Record<string, any> = {
        blobKey: args.blobKey,
        resource: {
          snapshotId: args.snapshotId,
          resourceType: 'compute/instance',
        },
      };

      if (args.query && args.isRegex) {
        validateRegexPattern(args.query);
        // Use PostgreSQL ~* for regex filtering at DB level (avoids loading huge blobs into JS)
        const countResult: any[] = await ctx.prisma.$queryRawUnsafe(
          `SELECT COUNT(*)::int as count FROM "ResourceBlob" b JOIN "Resource" r ON b."resourceId" = r."id" WHERE b."blobKey" = $1 AND r."snapshotId" = $2 AND r."resourceType" = 'compute/instance' AND b."content" ~* $3`,
          args.blobKey, args.snapshotId, args.query,
        );
        const totalCount = countResult[0]?.count ?? 0;

        let afterClause = '';
        if (args.after) afterClause = ` AND b."id" > '${args.after}'`;

        const idRows: any[] = await ctx.prisma.$queryRawUnsafe(
          `SELECT b."id" FROM "ResourceBlob" b JOIN "Resource" r ON b."resourceId" = r."id" WHERE b."blobKey" = $1 AND r."snapshotId" = $2 AND r."resourceType" = 'compute/instance' AND b."content" ~* $3${afterClause} ORDER BY b."id" ASC LIMIT ${take + 1}`,
          args.blobKey, args.snapshotId, args.query,
        );

        const matchIds = idRows.map((r: any) => r.id);
        const hasNextPage = matchIds.length > take;
        const slicedIds = hasNextPage ? matchIds.slice(0, take) : matchIds;

        const blobs = slicedIds.length > 0
          ? await ctx.prisma.resourceBlob.findMany({
              where: { id: { in: slicedIds } },
              orderBy: { id: 'asc' },
              include: { resource: true },
            })
          : [];

        return {
          edges: blobs.map((b: any) => ({ cursor: b.id, node: b })),
          pageInfo: {
            hasNextPage,
            endCursor: blobs.length > 0 ? blobs[blobs.length - 1].id : null,
          },
          totalCount,
        };
      }

      if (args.query) {
        where.content = { contains: args.query };
      }

      const totalCount = await ctx.prisma.resourceBlob.count({ where });

      const findArgs: any = {
        where,
        take: take + 1,
        orderBy: { id: 'asc' as const },
        include: { resource: true },
      };
      if (args.after) {
        findArgs.cursor = { id: args.after };
        findArgs.skip = 1;
      }

      const blobs = await ctx.prisma.resourceBlob.findMany(findArgs);

      const hasNextPage = blobs.length > take;
      const sliced = hasNextPage ? blobs.slice(0, take) : blobs;

      const edges = sliced.map((b: any) => ({
        cursor: b.id,
        node: b,
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

    searchBlobs: async (
      _parent: unknown,
      args: { snapshotId: string; query: string; isRegex?: boolean; blobKey?: string },
      ctx: Context,
    ) => {
      requireAuth(ctx.user);

      const where: Record<string, any> = {
        resource: {
          snapshotId: args.snapshotId,
          resourceType: 'compute/instance',
        },
      };
      if (args.blobKey) {
        where.blobKey = args.blobKey;
      }

      if (args.isRegex) {
        validateRegexPattern(args.query);
        // Use PostgreSQL ~* at DB level to avoid loading huge blobs into JS
        const blobKeyClause = args.blobKey ? ` AND b."blobKey" = $3` : '';
        const params: any[] = [args.snapshotId, args.query];
        if (args.blobKey) params.push(args.blobKey);

        const matchRows: any[] = await ctx.prisma.$queryRawUnsafe(
          `SELECT b."id", b."blobKey", b."content", r."id" as "resourceId", r."displayName" as "resourceName"
           FROM "ResourceBlob" b
           JOIN "Resource" r ON b."resourceId" = r."id"
           WHERE r."snapshotId" = $1 AND r."resourceType" = 'compute/instance'
             AND b."content" ~* $2${blobKeyClause}
           LIMIT 100`,
          ...params,
        );

        return matchRows.map((row: any) => ({
          resourceId: row.resourceId,
          resourceName: row.resourceName,
          blobKey: row.blobKey,
          snippet: extractSnippet(row.content, args.query, true),
        }));
      }

      where.content = { contains: args.query };

      const blobs = await ctx.prisma.resourceBlob.findMany({
        where,
        include: { resource: { select: { id: true, displayName: true } } },
        take: 100,
      });

      return blobs.map(blob => ({
        resourceId: blob.resource.id,
        resourceName: blob.resource.displayName,
        blobKey: blob.blobKey,
        snippet: extractSnippet(blob.content, args.query, false),
      }));
    },

    resourceCounts: async (
      _parent: unknown,
      args: { snapshotId: string },
      ctx: Context,
    ) => {
      requireAuth(ctx.user);
      const groups = await ctx.prisma.resource.groupBy({
        by: ['resourceType'],
        where: { snapshotId: args.snapshotId },
        _count: { id: true },
        orderBy: { resourceType: 'asc' as const },
      });

      return groups.map((g: any) => ({
        resourceType: g.resourceType,
        count: g._count.id,
      }));
    },

    deepSearch: async (
      _parent: unknown,
      args: { snapshotId: string; query: string; isRegex?: boolean; limit?: number },
      ctx: Context,
    ) => {
      requireAuth(ctx.user);
      const limit = Math.min(args.limit ?? 50, 200);

      if (args.isRegex) {
        validateRegexPattern(args.query);
        const rows: any[] = await ctx.prisma.$queryRawUnsafe(
          `SELECT "id", "resourceType", "displayName", "ocid", "rawData" FROM "Resource" WHERE "snapshotId" = $1 AND COALESCE("rawData",'') ~* $2 LIMIT ${limit}`,
          args.snapshotId,
          args.query,
        );
        return rows.map((r: any) => ({
          resourceId: r.id,
          resourceType: r.resourceType,
          displayName: r.displayName,
          ocid: r.ocid,
          snippet: extractSnippet(r.rawData || '', args.query, true),
          field: 'rawData',
        }));
      }

      const resources = await ctx.prisma.resource.findMany({
        where: {
          snapshotId: args.snapshotId,
          rawData: { contains: args.query },
        },
        select: { id: true, resourceType: true, displayName: true, ocid: true, rawData: true },
        take: limit,
      });

      return resources.map((r: any) => ({
        resourceId: r.id,
        resourceType: r.resourceType,
        displayName: r.displayName,
        ocid: r.ocid,
        snippet: extractSnippet(r.rawData || '', args.query, false),
        field: 'rawData',
      }));
    },

    exportResources: async (
      _parent: unknown,
      args: { filter: ResourceFilter },
      ctx: Context,
    ) => {
      requireAuth(ctx.user);
      const { snapshotId, resourceType, compartmentId, lifecycleState, search, isRegex } = args.filter;

      if (search && isRegex) {
        validateRegexPattern(search);
        const conditions: string[] = [`"snapshotId" = $1`];
        const params: any[] = [snapshotId];
        let paramIdx = 2;
        if (resourceType) { conditions.push(`"resourceType" = $${paramIdx}`); params.push(resourceType); paramIdx++; }
        if (compartmentId) { conditions.push(`"compartmentId" = $${paramIdx}`); params.push(compartmentId); paramIdx++; }
        if (lifecycleState) { conditions.push(`"lifecycleState" = $${paramIdx}`); params.push(lifecycleState); paramIdx++; }
        conditions.push(`(COALESCE("displayName",'') ~* $${paramIdx} OR "ocid" ~* $${paramIdx} OR COALESCE("freeformTags",'') ~* $${paramIdx} OR COALESCE("definedTags",'') ~* $${paramIdx} OR COALESCE("rawData",'') ~* $${paramIdx})`);
        params.push(search);

        return ctx.prisma.$queryRawUnsafe(
          `SELECT * FROM "Resource" WHERE ${conditions.join(' AND ')} ORDER BY "id" ASC LIMIT 50000`,
          ...params,
        );
      }

      const where: Record<string, any> = { snapshotId };
      if (resourceType) where.resourceType = resourceType;
      if (compartmentId) where.compartmentId = compartmentId;
      if (lifecycleState) where.lifecycleState = lifecycleState;
      if (search) {
        where.OR = [
          { displayName: { contains: search } },
          { ocid: { contains: search } },
          { freeformTags: { contains: search } },
          { definedTags: { contains: search } },
          { rawData: { contains: search } },
        ];
      }

      return ctx.prisma.resource.findMany({
        where,
        orderBy: { id: 'asc' as const },
        take: 50000,
      });
    },
    exportComputeInstances: async (
      _parent: unknown,
      args: { filter: ResourceFilter },
      ctx: Context,
    ) => {
      requireAuth(ctx.user);
      const { snapshotId, compartmentId, lifecycleState, search, isRegex } = args.filter;

      const where: Record<string, any> = { snapshotId, resourceType: 'compute/instance' };
      if (compartmentId) where.compartmentId = compartmentId;
      if (lifecycleState) where.lifecycleState = lifecycleState;
      if (search) {
        if (isRegex) {
          // fall through to raw SQL path below
        } else {
          where.OR = [
            { displayName: { contains: search } },
            { ocid: { contains: search } },
            { freeformTags: { contains: search } },
            { rawData: { contains: search } },
          ];
        }
      }

      let instances: any[];
      if (search && isRegex) {
        validateRegexPattern(search);
        const conditions: string[] = [`"snapshotId" = $1`, `"resourceType" = 'compute/instance'`];
        const params: any[] = [snapshotId];
        let paramIdx = 2;
        if (compartmentId) { conditions.push(`"compartmentId" = $${paramIdx}`); params.push(compartmentId); paramIdx++; }
        if (lifecycleState) { conditions.push(`"lifecycleState" = $${paramIdx}`); params.push(lifecycleState); paramIdx++; }
        conditions.push(`(COALESCE("displayName",'') ~* $${paramIdx} OR "ocid" ~* $${paramIdx} OR COALESCE("rawData",'') ~* $${paramIdx})`);
        params.push(search);
        instances = await ctx.prisma.$queryRawUnsafe(
          `SELECT * FROM "Resource" WHERE ${conditions.join(' AND ')} ORDER BY "displayName" ASC NULLS LAST`,
          ...params,
        );
      } else {
        instances = await ctx.prisma.resource.findMany({
          where,
          orderBy: { displayName: 'asc' as const },
        });
      }

      // Batch-load image resources (chunked to stay under SQLite's 999-variable limit)
      const imageOcids = new Set<string>();
      for (const inst of instances) {
        const raw = parseJsonField(typeof inst.rawData === 'string' ? inst.rawData : JSON.stringify(inst.rawData ?? ''));
        const imageId = raw?.imageId || raw?.sourceDetails?.imageId;
        if (imageId) imageOcids.add(imageId);
      }

      const imageOcidArray = Array.from(imageOcids);
      const IMAGE_CHUNK = 500;
      const imageResources: any[] = [];
      for (let i = 0; i < imageOcidArray.length; i += IMAGE_CHUNK) {
        const chunk = imageOcidArray.slice(i, i + IMAGE_CHUNK);
        const rows = await ctx.prisma.resource.findMany({
          where: { snapshotId, ocid: { in: chunk } },
          select: { ocid: true, displayName: true, rawData: true },
        });
        imageResources.push(...rows);
      }
      const imageMap = new Map(imageResources.map((img: any) => [img.ocid, img]));

      return instances.map((inst: any) => {
        const raw = parseJsonField(typeof inst.rawData === 'string' ? inst.rawData : JSON.stringify(inst.rawData ?? ''));
        const imageId = raw?.imageId || raw?.sourceDetails?.imageId;
        const image = imageId ? imageMap.get(imageId) : null;
        const imageRaw = parseJsonField(image?.rawData ?? null);
        return {
          ocid: inst.ocid,
          displayName: inst.displayName,
          shape: raw?.shape ?? null,
          lifecycleState: inst.lifecycleState,
          availabilityDomain: inst.availabilityDomain,
          regionKey: inst.regionKey,
          compartmentId: inst.compartmentId,
          faultDomain: raw?.faultDomain ?? null,
          imageOcid: imageId ?? null,
          imageDisplayName: image?.displayName ?? null,
          imageOs: imageRaw?.operatingSystem ?? null,
          imageOsVersion: imageRaw?.operatingSystemVersion ?? null,
          sysInitImage: (() => {
            const ft = parseJsonField(typeof inst.freeformTags === 'string' ? inst.freeformTags : JSON.stringify(inst.freeformTags ?? ''));
            return ft?.['sys_init_image'] ?? ft?.['sys-init-image'] ?? raw?.metadata?.sysInitImage ?? raw?.metadata?.sys_init_image ?? null;
          })(),
          timeCreated: inst.timeCreated,
        };
      });
    },
  },

  Resource: {
    definedTags: (parent: any) => parseJsonField(parent.definedTags),
    freeformTags: (parent: any) => parseJsonField(parent.freeformTags),
    rawData: (parent: any) => parseJsonField(parent.rawData),

    relationsFrom: (parent: any, _args: unknown, ctx: Context) => {
      if (parent.relationsFrom) return parent.relationsFrom;
      return ctx.loaders.relationsByFromId.load(parent.id);
    },

    relationsTo: (parent: any, _args: unknown, ctx: Context) => {
      if (parent.relationsTo) return parent.relationsTo;
      return ctx.loaders.relationsByToId.load(parent.id);
    },

    blobs: (parent: any, _args: unknown, ctx: Context) => {
      if (parent.blobs) return parent.blobs;
      return ctx.loaders.blobsByResourceId.load(parent.id);
    },

    imageResource: (parent: any, _args: unknown, ctx: Context) => {
      if (parent.resourceType !== 'compute/instance') return null;
      const raw = typeof parent.rawData === 'string'
        ? parseJsonField(parent.rawData)
        : parent.rawData;
      if (!raw) return null;
      const imageId = raw.imageId || raw.sourceDetails?.imageId;
      if (!imageId) return null;
      return ctx.loaders.resourceByOcidSnapshot.load(`${imageId}|${parent.snapshotId}`);
    },
  },

  ResourceRelation: {
    metadata: (parent: any) => parseJsonField(parent.metadata),
    fromResource: (parent: any, _args: unknown, ctx: Context) => {
      if (parent.fromResource) return parent.fromResource;
      return ctx.loaders.resourceById.load(parent.fromResourceId);
    },
    toResource: (parent: any, _args: unknown, ctx: Context) => {
      if (parent.toResource) return parent.toResource;
      return ctx.loaders.resourceById.load(parent.toResourceId);
    },
  },
};
