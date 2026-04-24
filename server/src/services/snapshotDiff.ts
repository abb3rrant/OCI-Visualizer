import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export interface ChangedField {
  field: string;
  oldValue: any;
  newValue: any;
}

export interface ChangedResource {
  ocid: string;
  displayName: string | null;
  resourceType: string;
  changes: ChangedField[];
}

export interface SnapshotDiff {
  added: Array<{ ocid: string; displayName: string | null; resourceType: string }>;
  removed: Array<{ ocid: string; displayName: string | null; resourceType: string }>;
  changed: ChangedResource[];
}

const DIFF_LIMIT = 500;
const CHUNK_SIZE = 5000;

export async function computeSnapshotDiff(
  prisma: PrismaClient,
  snapshotIdA: string,
  snapshotIdB: string,
): Promise<SnapshotDiff> {
  // Phase 1: Load only lightweight fields (no rawData) to find added/removed
  const [metaA, metaB] = await Promise.all([
    prisma.resource.findMany({
      where: { snapshotId: snapshotIdA },
      select: { ocid: true, displayName: true, resourceType: true },
    }),
    prisma.resource.findMany({
      where: { snapshotId: snapshotIdB },
      select: { ocid: true, displayName: true, resourceType: true },
    }),
  ]);

  const mapA = new Map(metaA.map(r => [r.ocid, r]));
  const mapB = new Map(metaB.map(r => [r.ocid, r]));

  const added: SnapshotDiff['added'] = [];
  const removed: SnapshotDiff['removed'] = [];
  const commonOcids: string[] = [];

  for (const [ocid, resB] of mapB) {
    if (!mapA.has(ocid)) {
      if (added.length < DIFF_LIMIT) {
        added.push({ ocid, displayName: resB.displayName, resourceType: resB.resourceType });
      }
    } else {
      commonOcids.push(ocid);
    }
  }

  for (const [ocid, resA] of mapA) {
    if (!mapB.has(ocid) && removed.length < DIFF_LIMIT) {
      removed.push({ ocid, displayName: resA.displayName, resourceType: resA.resourceType });
    }
  }

  // Phase 2: For common OCIDs, load rawData in chunks and compare hashes
  const changed: ChangedResource[] = [];

  for (let i = 0; i < commonOcids.length && changed.length < DIFF_LIMIT; i += CHUNK_SIZE) {
    const chunkOcids = commonOcids.slice(i, i + CHUNK_SIZE);

    const [chunkA, chunkB] = await Promise.all([
      prisma.resource.findMany({
        where: { snapshotId: snapshotIdA, ocid: { in: chunkOcids } },
        select: { ocid: true, displayName: true, resourceType: true, rawData: true },
      }),
      prisma.resource.findMany({
        where: { snapshotId: snapshotIdB, ocid: { in: chunkOcids } },
        select: { ocid: true, displayName: true, resourceType: true, rawData: true },
      }),
    ]);

    const chunkMapA = new Map(chunkA.map(r => [r.ocid, r]));
    const chunkMapB = new Map(chunkB.map(r => [r.ocid, r]));

    for (const ocid of chunkOcids) {
      if (changed.length >= DIFF_LIMIT) break;
      const resA = chunkMapA.get(ocid);
      const resB = chunkMapB.get(ocid);
      if (!resA || !resB) continue;

      const hashA = crypto.createHash('md5').update(resA.rawData || '').digest('hex');
      const hashB = crypto.createHash('md5').update(resB.rawData || '').digest('hex');
      if (hashA !== hashB) {
        const changes = compareRawData(resA.rawData, resB.rawData);
        if (changes.length > 0) {
          changed.push({
            ocid,
            displayName: resB.displayName,
            resourceType: resB.resourceType,
            changes,
          });
        }
      }
    }
  }

  return { added, removed, changed };
}

function compareRawData(rawA: string | null, rawB: string | null): ChangedField[] {
  let objA: Record<string, any> = {};
  let objB: Record<string, any> = {};
  try { if (rawA) objA = JSON.parse(rawA); } catch {}
  try { if (rawB) objB = JSON.parse(rawB); } catch {}

  const changes: ChangedField[] = [];
  const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)]);

  // Skip noisy fields
  const skipFields = new Set(['timeCreated', 'timeUpdated', 'timeModified', 'definedTags', 'freeformTags', 'systemTags']);

  for (const key of allKeys) {
    if (skipFields.has(key)) continue;
    const valA = JSON.stringify(objA[key] ?? null);
    const valB = JSON.stringify(objB[key] ?? null);
    if (valA !== valB) {
      changes.push({ field: key, oldValue: objA[key] ?? null, newValue: objB[key] ?? null });
      if (changes.length >= 20) break; // Limit fields per resource
    }
  }
  return changes;
}
