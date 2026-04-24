import DataLoader from 'dataloader';
import type { PrismaClient } from '@prisma/client';

export function createLoaders(prisma: PrismaClient) {
  return {
    relationsByFromId: new DataLoader<string, any[]>(async (ids) => {
      const rows = await prisma.resourceRelation.findMany({
        where: { fromResourceId: { in: ids as string[] } },
      });
      const map = new Map<string, any[]>();
      for (const id of ids) map.set(id, []);
      for (const r of rows) map.get(r.fromResourceId)!.push(r);
      return ids.map((id) => map.get(id)!);
    }),

    relationsByToId: new DataLoader<string, any[]>(async (ids) => {
      const rows = await prisma.resourceRelation.findMany({
        where: { toResourceId: { in: ids as string[] } },
      });
      const map = new Map<string, any[]>();
      for (const id of ids) map.set(id, []);
      for (const r of rows) map.get(r.toResourceId)!.push(r);
      return ids.map((id) => map.get(id)!);
    }),

    blobsByResourceId: new DataLoader<string, any[]>(async (ids) => {
      const rows = await prisma.resourceBlob.findMany({
        where: { resourceId: { in: ids as string[] } },
      });
      const map = new Map<string, any[]>();
      for (const id of ids) map.set(id, []);
      for (const r of rows) map.get(r.resourceId)!.push(r);
      return ids.map((id) => map.get(id)!);
    }),

    resourceById: new DataLoader<string, any>(async (ids) => {
      const rows = await prisma.resource.findMany({
        where: { id: { in: ids as string[] } },
        select: {
          id: true, ocid: true, displayName: true, resourceType: true,
          lifecycleState: true, compartmentId: true, availabilityDomain: true,
          regionKey: true, snapshotId: true,
        },
      });
      const map = new Map<string, any>();
      for (const r of rows) map.set(r.id, r);
      return ids.map((id) => map.get(id) ?? null);
    }),

    resourceByOcidSnapshot: new DataLoader<string, any>(async (keys) => {
      // Keys are compound strings: `${ocid}|${snapshotId}`
      const pairs = (keys as string[]).map((k) => {
        const idx = k.indexOf('|');
        return { ocid: k.slice(0, idx), snapshotId: k.slice(idx + 1) };
      });
      const ocids = [...new Set(pairs.map((p) => p.ocid))];
      const snapshotIds = [...new Set(pairs.map((p) => p.snapshotId))];

      const rows = await prisma.resource.findMany({
        where: { ocid: { in: ocids }, snapshotId: { in: snapshotIds } },
      });

      const map = new Map<string, any>();
      for (const r of rows) map.set(`${r.ocid}|${r.snapshotId}`, r);
      return keys.map((k) => map.get(k as string) ?? null);
    }),
  };
}

export type Loaders = ReturnType<typeof createLoaders>;
