import { PrismaClient } from '@prisma/client';
import { parseResources, ParsedResource } from '../parsers/index.js';
import JSZip from 'jszip';
import { buildRelationships } from './relationship.js';
import { sanitizeRawData } from '../parsers/helpers.js';
import { streamJsonItems, toReadable, detectFormat } from '../utils/streamJsonItems.js';

// ---------------------------------------------------------------------------
// Filename → resource type mapping for ZIP imports
// Maps the base filename (without .json) produced by the export scripts
// to the explicit parser type, so auto-detection is not required.
// ---------------------------------------------------------------------------
export const FILENAME_TO_TYPE: Record<string, string> = {
  // IAM
  'compartments': 'iam/compartment',
  'users': 'iam/user',
  'groups': 'iam/group',
  'policies': 'iam/policy',
  'dynamic-groups': 'iam/dynamic-group',

  // Compute
  'instances': 'compute/instance',
  'images': 'compute/image',
  'vnic-attachments': 'compute/vnic-attachment',
  'boot-volume-attachments': 'compute/boot-volume-attachment',

  // Network
  'vcns': 'network/vcn',
  'subnets': 'network/subnet',
  'security-lists': 'network/security-list',
  'route-tables': 'network/route-table',
  'nsgs': 'network/nsg',
  'internet-gateways': 'network/internet-gateway',
  'nat-gateways': 'network/nat-gateway',
  'service-gateways': 'network/service-gateway',
  'drgs': 'network/drg',
  'drg-attachments': 'network/drg-attachment',
  'local-peering-gateways': 'network/local-peering-gateway',
  'dhcp-options': 'network/dhcp-options',

  // Load Balancer
  'load-balancers': 'network/load-balancer',

  // Storage
  'block-volumes': 'storage/block-volume',
  'boot-volumes': 'storage/boot-volume',
  'volume-backups': 'storage/volume-backup',
  'volume-groups': 'storage/volume-group',
  'file-systems': 'storage/file-system',
  'buckets': 'storage/bucket',

  // Database
  'db-systems': 'database/db-system',
  'autonomous-databases': 'database/autonomous-database',
  'mysql-db-systems': 'database/mysql-db-system',
  'db-homes': 'database/db-home',

  // Container / OKE
  'oke-clusters': 'container/cluster',
  'node-pools': 'container/node-pool',
  'container-instances': 'container/container-instance',
  'container-repos': 'container/container-repository',
  'container-images': 'container/container-image',

  // Serverless
  'functions-applications': 'serverless/application',
  'functions': 'serverless/function',
  'api-gateways': 'serverless/api-gateway',
  'api-deployments': 'serverless/api-deployment',

  // DNS
  'dns-zones': 'dns/zone',

  // Network (continued)
  'network-load-balancers': 'network/network-load-balancer',

  // Compute (continued)
  'instance-configurations': 'compute/instance-configuration',

  // Security
  'vaults': 'security/vault',
  'secrets': 'security/secret',
  'container-scan-results': 'security/container-scan-result',

  // Observability
  'log-groups': 'observability/log-group',
  'logs': 'observability/log',

  // Container (continued)
  'image-signatures': 'container/image-signature',

  // IAM (continued)
  'api-keys': 'iam/api-key',
  'customer-secret-keys': 'iam/customer-secret-key',
};

/**
 * Extract the base filename (without extension and directory path) from a ZIP entry name.
 * e.g. "oci-export/oke-clusters.json" → "oke-clusters"
 */
function baseNameFromEntry(entryName: string): string {
  // Strip directory path
  const lastSlash = entryName.lastIndexOf('/');
  const filename = lastSlash >= 0 ? entryName.substring(lastSlash + 1) : entryName;
  // Strip .json extension
  return filename.replace(/\.json$/i, '');
}

export interface ImportResult {
  resourceCount: number;
  resourceTypes: string[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Shared helper: batch upsert resources in chunks of 500
// ---------------------------------------------------------------------------

function resourceFields(resource: ParsedResource) {
  return {
    resourceType: resource.resourceType,
    displayName: resource.displayName,
    compartmentId: resource.compartmentId,
    lifecycleState: resource.lifecycleState,
    availabilityDomain: resource.availabilityDomain,
    regionKey: resource.regionKey,
    timeCreated: resource.timeCreated,
    definedTags: resource.definedTags ? JSON.stringify(resource.definedTags) : null,
    freeformTags: resource.freeformTags ? JSON.stringify(resource.freeformTags) : null,
    rawData: JSON.stringify(sanitizeRawData(resource.rawData)),
  };
}

export type ProgressCallback = (processed: number, total: number) => void;

async function batchUpsertResources(
  prisma: PrismaClient,
  snapshotId: string,
  parsed: ParsedResource[],
  errors: string[],
  resourceTypesSet: Set<string>,
  onProgress?: ProgressCallback,
): Promise<number> {
  const BATCH_SIZE = 500;
  let count = 0;

  for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
    const chunk = parsed.slice(i, i + BATCH_SIZE);
    const ops = chunk.map(resource =>
      prisma.resource.upsert({
        where: { ocid_snapshotId: { ocid: resource.ocid, snapshotId } },
        update: { ...resourceFields(resource) },
        create: { ocid: resource.ocid, snapshotId, ...resourceFields(resource) },
      }),
    );

    try {
      await prisma.$transaction(ops);
      count += chunk.length;
      chunk.forEach(r => resourceTypesSet.add(r.resourceType));
    } catch {
      // Fallback: try individually for this batch to isolate failures
      for (const resource of chunk) {
        try {
          await prisma.resource.upsert({
            where: { ocid_snapshotId: { ocid: resource.ocid, snapshotId } },
            update: { ...resourceFields(resource) },
            create: { ocid: resource.ocid, snapshotId, ...resourceFields(resource) },
          });
          count++;
          resourceTypesSet.add(resource.resourceType);
        } catch (err2) {
          const message = err2 instanceof Error ? err2.message : String(err2);
          errors.push(`Failed to upsert ${resource.ocid}: ${message}`);
        }
      }
    }

    onProgress?.(count, parsed.length);
  }

  return count;
}

// ---------------------------------------------------------------------------
// Extract large blobs (user_data, SSH keys) from compute instances and store
// them separately in ResourceBlob so the main rawData can be safely truncated.
// ---------------------------------------------------------------------------

/**
 * Extract large blobs from compute instances and write them to ResourceBlob
 * in a streaming fashion — processes small chunks at a time to avoid holding
 * all decoded blob content in memory simultaneously.
 */
async function extractAndStoreBlobs(
  prisma: PrismaClient,
  snapshotId: string,
  parsed: ParsedResource[],
): Promise<void> {
  const BLOB_KEYS = ['userData', 'sshAuthorizedKeys'] as const;
  const MIN_LENGTH = 1024;
  const CHUNK = 200;

  // Only care about compute instances that have metadata
  const instances = parsed.filter(
    r => r.resourceType === 'compute/instance' && r.rawData?.metadata && typeof r.rawData.metadata === 'object',
  );
  if (instances.length === 0) return;

  // Process in small chunks: extract blobs, look up IDs, upsert, then let GC
  // reclaim the decoded content before moving to the next chunk.
  for (let i = 0; i < instances.length; i += CHUNK) {
    const chunk = instances.slice(i, i + CHUNK);

    // Collect tuples for this chunk only
    const tuples: { ocid: string; blobKey: string; content: string }[] = [];
    for (const inst of chunk) {
      const metadata = inst.rawData.metadata;
      for (const key of BLOB_KEYS) {
        const raw = metadata[key];
        if (typeof raw !== 'string' || raw.length <= MIN_LENGTH) continue;

        let content = raw;
        if (key === 'userData') {
          try {
            content = Buffer.from(raw, 'base64').toString('utf-8');
          } catch {
            // Not valid base64 — store as-is
          }
        }
        tuples.push({ ocid: inst.ocid, blobKey: key, content });
      }
    }

    if (tuples.length === 0) continue;

    // Look up DB IDs for this chunk's OCIDs
    const ocids = [...new Set(tuples.map(t => t.ocid))];
    const resources = await prisma.resource.findMany({
      where: { snapshotId, ocid: { in: ocids } },
      select: { id: true, ocid: true },
    });
    const ocidToId = new Map(resources.map(r => [r.ocid, r.id]));

    const ops = tuples
      .filter(t => ocidToId.has(t.ocid))
      .map(t => {
        const resourceId = ocidToId.get(t.ocid)!;
        return prisma.resourceBlob.upsert({
          where: { resourceId_blobKey: { resourceId, blobKey: t.blobKey } },
          update: { content: t.content },
          create: { resourceId, blobKey: t.blobKey, content: t.content },
        });
      });
    if (ops.length > 0) {
      await prisma.$transaction(ops);
    }
    // tuples and decoded content go out of scope here → GC eligible
  }
}

/**
 * Import a JSON string (or Buffer) containing OCI resources into the database.
 *
 * Uses a streaming JSON parser to avoid loading the entire parsed tree into
 * memory — items are processed in batches of ITEMS_CHUNK as they are parsed.
 */
export async function importJsonString(
  prisma: PrismaClient,
  snapshotId: string,
  jsonInput: string | Buffer,
  explicitType?: string,
  skipRelationships = false,
  onProgress?: ProgressCallback,
): Promise<ImportResult> {
  const errors: string[] = [];
  const resourceTypesSet = new Set<string>();

  let resourceCount: number;
  try {
    const format = detectFormat(jsonInput);
    const stream = toReadable(jsonInput);
    resourceCount = await processStream(
      prisma, snapshotId, stream, format, explicitType, 'input',
      errors, resourceTypesSet, onProgress,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { resourceCount: 0, resourceTypes: [], errors: [`Import error: ${message}`] };
  }

  if (resourceCount === 0 && errors.length === 0) {
    errors.push('No resources found (unrecognised format or empty data)');
  }

  // Build relationships across all resources in the snapshot
  if (!skipRelationships) {
    try {
      await buildRelationships(prisma, snapshotId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to build relationships: ${message}`);
    }
  }

  return {
    resourceCount,
    resourceTypes: Array.from(resourceTypesSet),
    errors,
  };
}

// ---------------------------------------------------------------------------
// Streaming import: reads JSON items one at a time via stream-json, batches
// them into chunks, and processes each chunk (parse → upsert → blobs).
// Peak memory is proportional to one batch (~1000 items) not the full file.
// ---------------------------------------------------------------------------

const ITEMS_CHUNK = 1000;

/**
 * Stream raw JSON items from a readable stream, batch them, and process
 * each batch through parseResources → batchUpsertResources → extractAndStoreBlobs.
 */
async function processStream(
  prisma: PrismaClient,
  snapshotId: string,
  readable: NodeJS.ReadableStream,
  format: 'array' | 'object',
  explicitType: string | undefined,
  entryName: string,
  errors: string[],
  resourceTypesSet: Set<string>,
  onProgress?: ProgressCallback,
): Promise<number> {
  let totalCount = 0;
  let skippedOcids = 0;
  let batch: any[] = [];

  const processBatch = async () => {
    if (batch.length === 0) return;
    const rawChunk = batch;
    batch = []; // release reference before async work

    let parsed: ParsedResource[];
    try {
      parsed = parseResources(rawChunk, explicitType);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Parse error in ${entryName}: ${message}`);
      return;
    }

    const valid = parsed.filter(r => r.ocid && r.ocid.length > 0);
    skippedOcids += parsed.length - valid.length;
    if (valid.length === 0) return;

    const count = await batchUpsertResources(prisma, snapshotId, valid, errors, resourceTypesSet);
    totalCount += count;

    try {
      await extractAndStoreBlobs(prisma, snapshotId, valid);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to extract blobs from ${entryName}: ${message}`);
    }

    onProgress?.(totalCount, 0);
    // valid, parsed, rawChunk all go out of scope → GC eligible
  };

  for await (const item of streamJsonItems(readable, format)) {
    batch.push(item);
    if (batch.length >= ITEMS_CHUNK) {
      await processBatch();
    }
  }
  // Flush remaining items
  await processBatch();

  if (skippedOcids > 0) {
    errors.push(`Warning: ${entryName} had ${skippedOcids} resource(s) with empty OCID (skipped)`);
  }

  return totalCount;
}

/**
 * Import a ZIP buffer containing one or more .json files.
 *
 * Uses JSZip + streaming JSON parser to avoid loading the entire decompressed
 * file or parsed JSON tree into memory. Each file is streamed directly from
 * the zip, parsed item-by-item, and processed in batches of ITEMS_CHUNK.
 */
export async function importZipBuffer(
  prisma: PrismaClient,
  snapshotId: string,
  buffer: Buffer,
  onProgress?: ProgressCallback,
): Promise<ImportResult> {
  const errors: string[] = [];
  const resourceTypesSet = new Set<string>();
  let totalResourceCount = 0;

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { resourceCount: 0, resourceTypes: [], errors: [`Failed to extract ZIP: ${message}`] };
  }

  // Collect JSON entry names (metadata only — no content loaded yet)
  const jsonEntryNames = Object.keys(zip.files).filter(
    name => !zip.files[name].dir && name.toLowerCase().endsWith('.json'),
  );

  if (jsonEntryNames.length === 0) {
    return { resourceCount: 0, resourceTypes: [], errors: ['No .json files found in ZIP archive'] };
  }

  // Process one file at a time using streaming JSON parser.
  // nodeStream decompresses on-the-fly; stream-json parses item-by-item.
  for (const entryName of jsonEntryNames) {
    const baseName = baseNameFromEntry(entryName);
    const explicitType = FILENAME_TO_TYPE[baseName];

    try {
      const nodeStream = zip.files[entryName].nodeStream('nodebuffer');
      // OCI CLI exports always produce {"data": [...]} format
      const count = await processStream(
        prisma, snapshotId, nodeStream, 'object', explicitType, entryName,
        errors, resourceTypesSet, onProgress,
      );
      totalResourceCount += count;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to process ${entryName}: ${message}`);
    }
  }

  // Build relationships once after all resources have been imported
  try {
    await buildRelationships(prisma, snapshotId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Failed to build relationships: ${message}`);
  }

  return {
    resourceCount: totalResourceCount,
    resourceTypes: Array.from(resourceTypesSet),
    errors,
  };
}
