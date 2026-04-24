import { PrismaClient } from '@prisma/client';
import { parseResources, ParsedResource } from '../parsers/index.js';
import JSZip from 'jszip';
import { buildRelationships } from './relationship.js';
import { sanitizeRawData } from '../parsers/helpers.js';
import { logger } from '../utils/logger.js';
import { unwrap } from '../parsers/helpers.js';
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
  'user-group-memberships': 'iam/user-group-membership',

  // Compute
  'instances': 'compute/instance',
  'images': 'compute/image',
  'vnic-attachments': 'compute/vnic-attachment',
  'boot-volume-attachments': 'compute/boot-volume-attachment',
  'instance-pools': 'compute/instance-pool',

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
  'nsg-rules': 'network/nsg-rule',
  'drg-route-tables': 'network/drg-route-table',
  'drg-route-rules': 'network/drg-route-rule',
  'public-ips': 'network/public-ip',

  // Load Balancer
  'load-balancers': 'network/load-balancer',

  // Storage
  'block-volumes': 'storage/block-volume',
  'boot-volumes': 'storage/boot-volume',
  'volume-backups': 'storage/volume-backup',
  'volume-groups': 'storage/volume-group',
  'file-systems': 'storage/file-system',
  'buckets': 'storage/bucket',
  'mount-targets': 'storage/mount-target',

  // Database
  'db-systems': 'database/db-system',
  'autonomous-databases': 'database/autonomous-database',
  'mysql-db-systems': 'database/mysql-db-system',
  'db-homes': 'database/db-home',
  'nosql-tables': 'database/nosql-table',

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
  'dns-records': 'dns/record',
  'dns-views': 'dns/view',
  'dns-resolvers': 'dns/resolver',
  'dns-resolver-endpoints': 'dns/resolver-endpoint',
  'dns-steering-policies': 'dns/steering-policy',
  'dns-steering-policy-attachments': 'dns/steering-policy-attachment',
  'dns-tsig-keys': 'dns/tsig-key',

  // Network (continued)
  'network-load-balancers': 'network/network-load-balancer',

  // Compute (continued)
  'instance-configurations': 'compute/instance-configuration',

  // Security
  'vaults': 'security/vault',
  'secrets': 'security/secret',
  'container-scan-results': 'security/container-scan-result',
  'waf-policies': 'security/waf-policy',
  'bastions': 'security/bastion',
  'certificates': 'security/certificate',

  // Observability
  'log-groups': 'observability/log-group',
  'logs': 'observability/log',
  'alarms': 'observability/alarm',
  'notification-topics': 'observability/notification-topic',
  'notification-subscriptions': 'observability/notification-subscription',
  'events-rules': 'observability/events-rule',

  // Container (continued)
  'image-signatures': 'container/image-signature',

  // IAM (continued)
  'api-keys': 'iam/api-key',
  'customer-secret-keys': 'iam/customer-secret-key',
  'auth-tokens': 'iam/auth-token',
  'smtp-credentials': 'iam/smtp-credential',
  'network-sources': 'iam/network-source',
  'region-subscriptions': 'iam/region-subscription',
  'tag-namespaces': 'iam/tag-namespace',
  'tag-defaults': 'iam/tag-default',
  'tags': 'iam/tag',

  // Compute (continued)
  'volume-attachments': 'compute/volume-attachment',
  'dedicated-vm-hosts': 'compute/dedicated-vm-host',
  'capacity-reservations': 'compute/capacity-reservation',
  'compute-clusters': 'compute/compute-cluster',
  'console-histories': 'compute/console-history',
  'autoscaling-configs': 'compute/autoscaling-config',

  // Network (continued)
  'vlans': 'network/vlan',
  'cpes': 'network/cpe',
  'ipsec-connections': 'network/ipsec-connection',
  'cross-connect-groups': 'network/cross-connect-group',
  'cross-connects': 'network/cross-connect',
  'virtual-circuits': 'network/virtual-circuit',
  'remote-peering-connections': 'network/remote-peering-connection',
  'private-ips': 'network/private-ip',
  'vtaps': 'network/vtap',
  'capture-filters': 'network/capture-filter',
  'byoip-ranges': 'network/byoip-range',
  'public-ip-pools': 'network/public-ip-pool',
  'network-firewalls': 'network/network-firewall',
  'network-firewall-policies': 'network/network-firewall-policy',
  'drg-route-distributions': 'network/drg-route-distribution',

  // Database (continued)
  'db-backups': 'database/db-backup',
  'autonomous-db-backups': 'database/autonomous-db-backup',
  'autonomous-container-databases': 'database/autonomous-container-database',
  'databases': 'database/database',
  'pluggable-databases': 'database/pluggable-database',
  'db-nodes': 'database/db-node',
  'exadata-infrastructures': 'database/exadata-infrastructure',
  'cloud-vm-clusters': 'database/cloud-vm-cluster',
  'cloud-exa-infras': 'database/cloud-exa-infra',
  'db-software-images': 'database/db-software-image',
  'db-key-stores': 'database/db-key-store',
  'maintenance-runs': 'database/maintenance-run',
  'data-guard-associations': 'database/data-guard-association',
  'redis-clusters': 'database/redis-cluster',
  'opensearch-clusters': 'database/opensearch-cluster',
  'psql-db-systems': 'database/psql-db-system',
  'psql-backups': 'database/psql-backup',

  // Storage (continued)
  'preauth-requests': 'storage/preauth-request',
  'lifecycle-policies': 'storage/lifecycle-policy',
  'replication-policies': 'storage/replication-policy',

  // Security (continued)
  'cloud-guard-targets': 'security/cloud-guard-target',
  'cloud-guard-detector-recipes': 'security/cloud-guard-detector-recipe',
  'waas-policies': 'security/waas-policy',
  'waas-certificates': 'security/waas-certificate',
  'dr-protection-groups': 'security/dr-protection-group',
  'dr-plans': 'security/dr-plan',

  // Observability (continued)
  'email-senders': 'observability/email-sender',

  // Messaging
  'streams': 'messaging/stream',
  'connect-harnesses': 'messaging/connect-harness',
  'service-connectors': 'messaging/service-connector',
  'queues': 'messaging/queue',

  // Governance
  'resource-manager-stacks': 'governance/resource-manager-stack',
  'budgets': 'governance/budget',
  'quotas': 'governance/quota',

  // DevOps
  'devops-projects': 'devops/project',
  'devops-build-pipelines': 'devops/build-pipeline',
  'devops-deploy-pipelines': 'devops/deploy-pipeline',
  'devops-repositories': 'devops/repository',

  // Monitoring / Health
  'health-checks-http': 'monitoring/health-check-http',
  'health-checks-ping': 'monitoring/health-check-ping',
  'apm-domains': 'monitoring/apm-domain',
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

/**
 * Safe JSON.stringify that detects circular references instead of OOMing.
 * Uses a WeakSet replacer to replace cycles with a placeholder string.
 */
function safeJsonStringify(value: any): string {
  const seen = new WeakSet();
  return JSON.stringify(value, (_key, val) => {
    if (val !== null && typeof val === 'object') {
      if (seen.has(val)) return '[Circular]';
      seen.add(val);
    }
    return val;
  });
}

function resourceFields(resource: ParsedResource) {
  return {
    resourceType: resource.resourceType,
    displayName: resource.displayName,
    compartmentId: resource.compartmentId,
    lifecycleState: resource.lifecycleState,
    availabilityDomain: resource.availabilityDomain,
    regionKey: resource.regionKey,
    timeCreated: resource.timeCreated,
    definedTags: resource.definedTags ? safeJsonStringify(resource.definedTags) : null,
    freeformTags: resource.freeformTags ? safeJsonStringify(resource.freeformTags) : null,
    rawData: safeJsonStringify(sanitizeRawData(resource.rawData)),
  };
}

export type ProgressCallback = (processed: number, total: number) => void;

// Small delay between batches so SQLite read queries can get through
const BATCH_YIELD_MS = 50;
function yieldToReads(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, BATCH_YIELD_MS));
}

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
      // Yield between batches so read queries aren't starved
      await yieldToReads();
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
      await yieldToReads();
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
  // Map snake_case OCI metadata keys to our canonical camelCase blob keys.
  // OCI CLI metadata uses snake_case (user_data, ssh_authorized_keys) but
  // deepCamelCase only converts kebab-case, so we check both variants.
  const BLOB_KEY_ALIASES: Record<string, string[]> = {
    userData: ['userData', 'user_data'],
    sshAuthorizedKeys: ['sshAuthorizedKeys', 'ssh_authorized_keys'],
    ansibleArgs: ['ansibleArgs', 'ansible_args', 'oke-ansible-args'],
    bootstrapKubeletConfig: ['bootstrapKubeletConfig', 'bootstrap_kubelet_config', 'oke-bootstrapKubeletConfig'],
  };
  // Keys whose values are base64-encoded and should be decoded before storage
  const BASE64_ALIASES = new Set([...BLOB_KEY_ALIASES.userData]);
  const MIN_LENGTH = 64;
  const CHUNK = 200;

  // Only care about compute instances that have metadata or extendedMetadata
  const instances = parsed.filter(
    r => r.resourceType === 'compute/instance' && (
      (r.rawData?.metadata && typeof r.rawData.metadata === 'object') ||
      (r.rawData?.extendedMetadata && typeof r.rawData.extendedMetadata === 'object')
    ),
  );
  if (instances.length === 0) return;

  // Process in small chunks: extract blobs, look up IDs, upsert, then let GC
  // reclaim the decoded content before moving to the next chunk.
  for (let i = 0; i < instances.length; i += CHUNK) {
    const chunk = instances.slice(i, i + CHUNK);

    // Collect tuples for this chunk only
    const tuples: { ocid: string; blobKey: string; content: string }[] = [];
    for (const inst of chunk) {
      // Search both metadata and extendedMetadata (OKE puts config in extendedMetadata)
      const metadataSources = [inst.rawData.metadata, inst.rawData.extendedMetadata].filter(
        m => m && typeof m === 'object',
      );
      const seen = new Set<string>();
      for (const metadata of metadataSources) {
        for (const [canonicalKey, aliases] of Object.entries(BLOB_KEY_ALIASES)) {
          if (seen.has(canonicalKey)) continue; // already found in a prior source
          const matchedAlias = aliases.find(a => typeof metadata[a] === 'string' && metadata[a].length > MIN_LENGTH);
          if (!matchedAlias) continue;
          const raw = metadata[matchedAlias];

          let content = raw;
          if (BASE64_ALIASES.has(matchedAlias)) {
            try {
              content = Buffer.from(raw, 'base64').toString('utf-8');
            } catch {
              // Not valid base64 — store as-is
            }
          }
          tuples.push({ ocid: inst.ocid, blobKey: canonicalKey, content });
          seen.add(canonicalKey);
        }
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

  // Sanitize buffer before streaming to handle BOM and leading garbage
  const sanitizedInput = Buffer.isBuffer(jsonInput)
    ? sanitizeBuffer(jsonInput)
    : jsonInput;

  let resourceCount: number;
  try {
    const format = detectFormat(sanitizedInput);
    const stream = toReadable(sanitizedInput);
    resourceCount = await processStream(
      prisma, snapshotId, stream, format, explicitType, 'input',
      errors, resourceTypesSet, onProgress,
    );
  } catch (err) {
    // Streaming parser failed — fall back to direct JSON.parse
    const streamErr = err instanceof Error ? err.message : String(err);
    errors.length = 0; // clear any partial errors from stream attempt
    try {
      resourceCount = await processBufferDirect(
        prisma, snapshotId, sanitizedInput, explicitType, 'input',
        errors, resourceTypesSet, onProgress,
      );
    } catch (err2) {
      const message = err2 instanceof Error ? err2.message : String(err2);
      return { resourceCount: 0, resourceTypes: [], errors: [`Import error: ${message} (stream error: ${streamErr})`] };
    }
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
 * Process a batch of raw items: parse → upsert → extract blobs.
 * Shared by both streaming and direct (fallback) import paths.
 */
async function processItemBatch(
  prisma: PrismaClient,
  snapshotId: string,
  rawChunk: any[],
  explicitType: string | undefined,
  entryName: string,
  errors: string[],
  resourceTypesSet: Set<string>,
  onProgress?: ProgressCallback,
): Promise<{ count: number; skipped: number }> {
  let parsed: ParsedResource[];
  try {
    parsed = parseResources(rawChunk, explicitType);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Parse error in ${entryName}: ${message}`);
    return { count: 0, skipped: 0 };
  }

  const valid = parsed.filter(r => r.ocid && r.ocid.length > 0);
  const skipped = parsed.length - valid.length;
  if (valid.length === 0) return { count: 0, skipped };

  const count = await batchUpsertResources(prisma, snapshotId, valid, errors, resourceTypesSet, onProgress);

  try {
    await extractAndStoreBlobs(prisma, snapshotId, valid);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Failed to extract blobs from ${entryName}: ${message}`);
  }

  return { count, skipped };
}

/**
 * Lightweight buffer-level sanitization for the streaming path.
 * Strips UTF-8 BOM and leading garbage bytes before the first [ or {.
 * This avoids converting large buffers to string — just slices the buffer.
 */
function sanitizeBuffer(buf: Buffer): Buffer {
  let start = 0;
  // Strip UTF-8 BOM (EF BB BF)
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    start = 3;
  }
  // Skip whitespace and any leading garbage before first [ or {
  while (start < buf.length) {
    const b = buf[start];
    if (b === 0x5B /* [ */ || b === 0x7B /* { */) break;
    start++;
  }
  return start > 0 ? buf.subarray(start) : buf;
}

/**
 * Sanitize common JSON issues before parsing:
 * - Strip UTF-8 BOM
 * - Strip null bytes and other control characters (except whitespace)
 * - Remove trailing commas before ] or }
 * - Strip leading garbage before the first [ or {
 */
function sanitizeJsonText(text: string): string {
  // Strip UTF-8 BOM
  let cleaned = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;

  // Strip null bytes and non-whitespace control characters (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F)
  // but preserve \t (0x09), \n (0x0A), \r (0x0D)
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

  // Strip any leading garbage before the first [ or { (e.g. log output, bash prompts)
  const firstStructural = cleaned.search(/[\[{]/);
  if (firstStructural > 0) {
    cleaned = cleaned.slice(firstStructural);
  }

  // Remove trailing commas before ] or } (common OCI CLI output issue)
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

  return cleaned;
}

/**
 * Attempt to repair truncated JSON by finding the last complete object
 * in the array and closing the JSON structure.
 */
function repairTruncatedJson(text: string): any | null {
  // Detect the wrapping format and find where the main array starts.
  // Supports: plain arrays, {"data": [...]}, and {"data": {"items": [...]}}
  const header = text.slice(0, 500);

  // Determine wrapping depth: how many '{' must be closed after the array
  let wrapperDepth = 0;
  let arraySearchStart = 0;

  const doubleWrapped = /^\s*\{/.test(header) && /"data"\s*:\s*\{/.test(header) && /"items"\s*:\s*\[/.test(header);
  const singleWrapped = !doubleWrapped && /^\s*\{/.test(header) && /"data"\s*:\s*\[/.test(header);
  const isArray = /^\s*\[/.test(header);

  if (doubleWrapped) {
    wrapperDepth = 2; // need to close }} after ]
  } else if (singleWrapped) {
    wrapperDepth = 1; // need to close } after ]
  } else if (isArray) {
    wrapperDepth = 0;
  } else {
    return null;
  }

  // Walk through the text tracking brace/bracket depth.
  // Record positions where an object closes at exactly (wrapperDepth, 1) —
  // meaning we're inside the main array at top level.
  let braceDepth = 0;
  let bracketDepth = 0;
  let inString = false;
  let escape = false;
  let itemEndPositions: number[] = [];
  let arrayStartPos = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '[') {
      if (arrayStartPos === -1 && braceDepth === wrapperDepth) {
        arrayStartPos = i;
      }
      bracketDepth++;
    }
    else if (ch === ']') { bracketDepth--; }
    else if (ch === '{') { braceDepth++; }
    else if (ch === '}') {
      braceDepth--;
      // Object closed at (wrapperDepth, 1) = top-level item inside the main array
      if (braceDepth === wrapperDepth && bracketDepth === 1) {
        itemEndPositions.push(i);
      }
    }
  }

  if (itemEndPositions.length === 0) return null;

  const lastGoodPos = itemEndPositions[itemEndPositions.length - 1];

  // Build repaired JSON: everything up to and including the last complete object,
  // then close the array and any wrapper objects
  let repaired = text.slice(0, lastGoodPos + 1);
  repaired += ']';
  for (let i = 0; i < wrapperDepth; i++) repaired += '}';

  try {
    return JSON.parse(repaired);
  } catch {
    return null;
  }
}

/**
 * Direct (non-streaming) import: JSON.parse the full buffer, then process
 * items in batches. Used as a fallback when stream-json fails.
 */
async function processBufferDirect(
  prisma: PrismaClient,
  snapshotId: string,
  buffer: Buffer | string,
  explicitType: string | undefined,
  entryName: string,
  errors: string[],
  resourceTypesSet: Set<string>,
  onProgress?: ProgressCallback,
): Promise<number> {
  const rawText = typeof buffer === 'string' ? buffer : buffer.toString('utf-8');
  const text = sanitizeJsonText(rawText);
  let json: any;
  try {
    json = JSON.parse(text);
  } catch (err) {
    // Attempt to repair truncated JSON (sanitizeJsonText already applied above)
    json = repairTruncatedJson(text);
    if (json) {
      const items = unwrap(json);
      errors.push(`Warning: ${entryName} had truncated JSON — salvaged ${items.length} complete items`);
    } else {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`JSON parse error in ${entryName}: ${message}`);
      return 0;
    }
  }

  const items = unwrap(json);
  let totalCount = 0;
  let skippedOcids = 0;

  for (let i = 0; i < items.length; i += ITEMS_CHUNK) {
    const chunk = items.slice(i, i + ITEMS_CHUNK);
    const { count, skipped } = await processItemBatch(
      prisma, snapshotId, chunk, explicitType, entryName, errors, resourceTypesSet, onProgress,
    );
    totalCount += count;
    skippedOcids += skipped;
    onProgress?.(totalCount, items.length);
  }

  if (skippedOcids > 0) {
    errors.push(`Warning: ${entryName} had ${skippedOcids} resource(s) with empty OCID (skipped)`);
  }

  return totalCount;
}

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
    batch = [];

    const { count, skipped } = await processItemBatch(
      prisma, snapshotId, rawChunk, explicitType, entryName, errors, resourceTypesSet, onProgress,
    );
    totalCount += count;
    skippedOcids += skipped;
    onProgress?.(totalCount, 0);
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
  skipRelationships = false,
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
    logger.error('Failed to load ZIP', { bytes: buffer.length, error: message });
    return { resourceCount: 0, resourceTypes: [], errors: [`Failed to extract ZIP (${buffer.length} bytes): ${message}`] };
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
      const rawBuf = await zip.files[entryName].async('nodebuffer');
      const fileBuf = sanitizeBuffer(rawBuf);
      const format = detectFormat(fileBuf);
      let count: number;
      try {
        const readable = toReadable(fileBuf);
        count = await processStream(
          prisma, snapshotId, readable, format, explicitType, entryName,
          errors, resourceTypesSet, onProgress,
        );
      } catch {
        // Streaming parser failed — fall back to direct JSON.parse
        // Remove any partial errors added by the stream attempt for this file
        const errorsBeforeStream = errors.filter(e => !e.includes(entryName));
        errors.length = 0;
        errors.push(...errorsBeforeStream);
        count = await processBufferDirect(
          prisma, snapshotId, fileBuf, explicitType, entryName,
          errors, resourceTypesSet, onProgress,
        );
      }
      totalResourceCount += count;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to process ${entryName}: ${message}`);
    }
  }

  // Build relationships once after all resources have been imported
  if (!skipRelationships) {
    try {
      await buildRelationships(prisma, snapshotId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to build relationships: ${message}`);
    }
  }

  return {
    resourceCount: totalResourceCount,
    resourceTypes: Array.from(resourceTypesSet),
    errors,
  };
}
