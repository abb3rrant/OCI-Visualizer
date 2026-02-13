import { PrismaClient } from '@prisma/client';
import { parseResources, ParsedResource } from '../parsers/index.js';
import { extractZip } from '../utils/zipHandler.js';
import { buildRelationships } from './relationship.js';

// ---------------------------------------------------------------------------
// Filename → resource type mapping for ZIP imports
// Maps the base filename (without .json) produced by the export scripts
// to the explicit parser type, so auto-detection is not required.
// ---------------------------------------------------------------------------
const FILENAME_TO_TYPE: Record<string, string> = {
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

/**
 * Import a JSON string containing OCI resources into the database.
 *
 * Parses the JSON, upserts each resource into the snapshot, then
 * builds cross-resource relationships.
 */
export async function importJsonString(
  prisma: PrismaClient,
  snapshotId: string,
  jsonString: string,
  explicitType?: string,
): Promise<ImportResult> {
  const errors: string[] = [];
  const resourceTypesSet = new Set<string>();
  let resourceCount = 0;

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(jsonString);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { resourceCount: 0, resourceTypes: [], errors: [`Invalid JSON: ${message}`] };
  }

  let parsed: ParsedResource[];
  try {
    parsed = parseResources(rawJson, explicitType);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { resourceCount: 0, resourceTypes: [], errors: [`Parse error: ${message}`] };
  }

  if (parsed.length === 0) {
    return { resourceCount: 0, resourceTypes: [], errors: ['No resources found (unrecognised format or empty data)'] };
  }

  // Filter out resources with empty OCIDs
  const validParsed = parsed.filter((r) => r.ocid && r.ocid.length > 0);
  if (validParsed.length < parsed.length) {
    errors.push(`${parsed.length - validParsed.length} resource(s) had empty OCID and were skipped`);
  }

  for (const resource of validParsed) {
    try {
      await prisma.resource.upsert({
        where: {
          ocid_snapshotId: {
            ocid: resource.ocid,
            snapshotId,
          },
        },
        update: {
          resourceType: resource.resourceType,
          displayName: resource.displayName,
          compartmentId: resource.compartmentId,
          lifecycleState: resource.lifecycleState,
          availabilityDomain: resource.availabilityDomain,
          regionKey: resource.regionKey,
          timeCreated: resource.timeCreated,
          definedTags: resource.definedTags ? JSON.stringify(resource.definedTags) : null,
          freeformTags: resource.freeformTags ? JSON.stringify(resource.freeformTags) : null,
          rawData: JSON.stringify(resource.rawData),
        },
        create: {
          ocid: resource.ocid,
          snapshotId,
          resourceType: resource.resourceType,
          displayName: resource.displayName,
          compartmentId: resource.compartmentId,
          lifecycleState: resource.lifecycleState,
          availabilityDomain: resource.availabilityDomain,
          regionKey: resource.regionKey,
          timeCreated: resource.timeCreated,
          definedTags: resource.definedTags ? JSON.stringify(resource.definedTags) : null,
          freeformTags: resource.freeformTags ? JSON.stringify(resource.freeformTags) : null,
          rawData: JSON.stringify(resource.rawData),
        },
      });

      resourceCount++;
      resourceTypesSet.add(resource.resourceType);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to upsert resource ${resource.ocid}: ${message}`);
    }
  }

  // Build relationships across all resources in the snapshot
  try {
    await buildRelationships(prisma, snapshotId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Failed to build relationships: ${message}`);
  }

  return {
    resourceCount,
    resourceTypes: Array.from(resourceTypesSet),
    errors,
  };
}

/**
 * Import a ZIP buffer containing one or more .json files.
 *
 * Each JSON file inside the archive is processed independently and
 * the results are aggregated. Relationship building is deferred until
 * all files have been imported.
 */
export async function importZipBuffer(
  prisma: PrismaClient,
  snapshotId: string,
  buffer: Buffer,
): Promise<ImportResult> {
  const errors: string[] = [];
  const resourceTypesSet = new Set<string>();
  let totalResourceCount = 0;

  let entries: Array<{ name: string; content: string }>;
  try {
    entries = await extractZip(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { resourceCount: 0, resourceTypes: [], errors: [`Failed to extract ZIP: ${message}`] };
  }

  const jsonEntries = entries.filter((e) => e.name.toLowerCase().endsWith('.json'));

  if (jsonEntries.length === 0) {
    return { resourceCount: 0, resourceTypes: [], errors: ['No .json files found in ZIP archive'] };
  }

  // Process each JSON file. We defer relationship-building to the end so we
  // import all resources first, then resolve references in one pass.
  for (const entry of jsonEntries) {
    let rawJson: unknown;
    try {
      rawJson = JSON.parse(entry.content);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Invalid JSON in ${entry.name}: ${message}`);
      continue;
    }

    // Derive explicit type from the ZIP entry filename so we don't rely
    // solely on auto-detection (which can misfire for ambiguous schemas).
    const baseName = baseNameFromEntry(entry.name);
    const explicitType = FILENAME_TO_TYPE[baseName];

    let parsed: ParsedResource[];
    try {
      parsed = parseResources(rawJson, explicitType);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Parse error in ${entry.name}: ${message}`);
      continue;
    }

    if (parsed.length === 0) {
      errors.push(`Warning: ${entry.name} produced 0 resources (unrecognised format or empty data)`);
      continue;
    }

    // Filter out resources with empty OCIDs — they'd collide on the unique constraint
    const valid = parsed.filter((r) => r.ocid && r.ocid.length > 0);
    if (valid.length < parsed.length) {
      errors.push(
        `Warning: ${entry.name} had ${parsed.length - valid.length} resource(s) with empty OCID (skipped)`,
      );
    }

    for (const resource of valid) {
      try {
        await prisma.resource.upsert({
          where: {
            ocid_snapshotId: {
              ocid: resource.ocid,
              snapshotId,
            },
          },
          update: {
            resourceType: resource.resourceType,
            displayName: resource.displayName,
            compartmentId: resource.compartmentId,
            lifecycleState: resource.lifecycleState,
            availabilityDomain: resource.availabilityDomain,
            regionKey: resource.regionKey,
            timeCreated: resource.timeCreated,
            definedTags: resource.definedTags ? JSON.stringify(resource.definedTags) : null,
            freeformTags: resource.freeformTags ? JSON.stringify(resource.freeformTags) : null,
            rawData: JSON.stringify(resource.rawData),
          },
          create: {
            ocid: resource.ocid,
            snapshotId,
            resourceType: resource.resourceType,
            displayName: resource.displayName,
            compartmentId: resource.compartmentId,
            lifecycleState: resource.lifecycleState,
            availabilityDomain: resource.availabilityDomain,
            regionKey: resource.regionKey,
            timeCreated: resource.timeCreated,
            definedTags: resource.definedTags ? JSON.stringify(resource.definedTags) : null,
            freeformTags: resource.freeformTags ? JSON.stringify(resource.freeformTags) : null,
            rawData: JSON.stringify(resource.rawData),
          },
        });

        totalResourceCount++;
        resourceTypesSet.add(resource.resourceType);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to upsert resource ${resource.ocid} from ${entry.name}: ${message}`);
      }
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
