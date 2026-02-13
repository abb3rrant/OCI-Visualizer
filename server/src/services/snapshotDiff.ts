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

export async function computeSnapshotDiff(
  prisma: PrismaClient,
  snapshotIdA: string,
  snapshotIdB: string,
): Promise<SnapshotDiff> {
  // Load OCIDs + metadata from both snapshots
  const [resourcesA, resourcesB] = await Promise.all([
    prisma.resource.findMany({
      where: { snapshotId: snapshotIdA },
      select: { ocid: true, displayName: true, resourceType: true, rawData: true },
    }),
    prisma.resource.findMany({
      where: { snapshotId: snapshotIdB },
      select: { ocid: true, displayName: true, resourceType: true, rawData: true },
    }),
  ]);

  const mapA = new Map(resourcesA.map(r => [r.ocid, r]));
  const mapB = new Map(resourcesB.map(r => [r.ocid, r]));

  const added: SnapshotDiff['added'] = [];
  const removed: SnapshotDiff['removed'] = [];
  const changed: ChangedResource[] = [];

  // Find added (in B but not A) and changed
  for (const [ocid, resB] of mapB) {
    const resA = mapA.get(ocid);
    if (!resA) {
      if (added.length < DIFF_LIMIT) {
        added.push({ ocid, displayName: resB.displayName, resourceType: resB.resourceType });
      }
    } else {
      // Compare rawData hashes
      const hashA = crypto.createHash('md5').update(resA.rawData || '').digest('hex');
      const hashB = crypto.createHash('md5').update(resB.rawData || '').digest('hex');
      if (hashA !== hashB && changed.length < DIFF_LIMIT) {
        // Find specific field changes
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

  // Find removed (in A but not B)
  for (const [ocid, resA] of mapA) {
    if (!mapB.has(ocid) && removed.length < DIFF_LIMIT) {
      removed.push({ ocid, displayName: resA.displayName, resourceType: resA.resourceType });
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
