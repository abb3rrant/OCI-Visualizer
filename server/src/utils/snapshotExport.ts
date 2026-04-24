import { PrismaClient } from '@prisma/client';

export async function exportSnapshot(prisma: PrismaClient, snapshotId: string, userId: string) {
  const snapshot = await prisma.snapshot.findUnique({ where: { id: snapshotId } });
  if (!snapshot) throw new Error('Snapshot not found');
  if (snapshot.userId !== userId) throw new Error('Not authorized');

  const resources = await prisma.resource.findMany({
    where: { snapshotId },
    select: {
      ocid: true, resourceType: true, displayName: true, compartmentId: true,
      lifecycleState: true, availabilityDomain: true, regionKey: true,
      timeCreated: true, definedTags: true, freeformTags: true, rawData: true,
    },
  });

  const relations = await prisma.resourceRelation.findMany({
    where: { fromResource: { snapshotId } },
    select: {
      fromResource: { select: { ocid: true } },
      toResource: { select: { ocid: true } },
      relationType: true, metadata: true,
    },
  });

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    snapshot: { name: snapshot.name, description: snapshot.description },
    resources,
    relations: relations.map(r => ({
      fromOcid: r.fromResource.ocid,
      toOcid: r.toResource.ocid,
      relationType: r.relationType,
      metadata: r.metadata,
    })),
  };
}

export async function importSnapshotBundle(
  prisma: PrismaClient,
  userId: string,
  bundle: any,
): Promise<string> {
  // Create new snapshot
  const snapshot = await prisma.snapshot.create({
    data: {
      name: `${bundle.snapshot.name} (imported)`,
      description: bundle.snapshot.description,
      userId,
    },
  });

  // Bulk insert resources in chunks
  const CHUNK_SIZE = 500;
  const resources = bundle.resources || [];
  const ocidToId = new Map<string, string>();

  for (let i = 0; i < resources.length; i += CHUNK_SIZE) {
    const chunk = resources.slice(i, i + CHUNK_SIZE);
    for (const r of chunk) {
      const created = await prisma.resource.create({
        data: {
          ocid: r.ocid,
          resourceType: r.resourceType,
          displayName: r.displayName,
          compartmentId: r.compartmentId,
          lifecycleState: r.lifecycleState,
          availabilityDomain: r.availabilityDomain,
          regionKey: r.regionKey,
          timeCreated: r.timeCreated,
          definedTags: r.definedTags,
          freeformTags: r.freeformTags,
          rawData: r.rawData || '{}',
          snapshotId: snapshot.id,
        },
      });
      ocidToId.set(r.ocid, created.id);
    }
  }

  // Insert relations
  const relations = bundle.relations || [];
  for (let i = 0; i < relations.length; i += CHUNK_SIZE) {
    const chunk = relations.slice(i, i + CHUNK_SIZE);
    for (const rel of chunk) {
      const fromId = ocidToId.get(rel.fromOcid);
      const toId = ocidToId.get(rel.toOcid);
      if (fromId && toId) {
        await prisma.resourceRelation.create({
          data: {
            fromResourceId: fromId,
            toResourceId: toId,
            relationType: rel.relationType,
            metadata: rel.metadata,
          },
        }).catch(() => {}); // Skip duplicates
      }
    }
  }

  return snapshot.id;
}
