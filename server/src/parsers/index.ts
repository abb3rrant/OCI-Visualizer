/**
 * Parser registry with auto-detection.
 *
 * Exports the shared ParsedResource interface and a single entry-point
 * function `parseResources` that can either auto-detect the resource type
 * from the JSON structure or accept an explicit type string.
 */

// ---------------------------------------------------------------------------
// Shared interface
// ---------------------------------------------------------------------------

export interface ParsedResource {
  ocid: string;
  resourceType: string;
  displayName: string | null;
  compartmentId: string | null;
  lifecycleState: string | null;
  availabilityDomain: string | null;
  regionKey: string | null;
  timeCreated: string | null;
  definedTags: Record<string, any> | null;
  freeformTags: Record<string, string> | null;
  rawData: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Individual parser imports
// ---------------------------------------------------------------------------

import {
  parseInstances,
  parseImages,
  parseVnicAttachments,
  parseBootVolumeAttachments,
} from './compute.js';

import {
  parseVcns,
  parseSubnets,
  parseSecurityLists,
  parseRouteTables,
  parseNetworkSecurityGroups,
  parseInternetGateways,
  parseNatGateways,
  parseServiceGateways,
  parseDrgs,
  parseLocalPeeringGateways,
  parseDhcpOptions,
} from './network.js';

import {
  parseDbSystems,
  parseAutonomousDatabases,
  parseDbHomes,
} from './database.js';

import {
  parseBlockVolumes,
  parseBootVolumes,
  parseVolumeBackups,
  parseVolumeGroups,
  parseBuckets,
} from './storage.js';

import { parseLoadBalancers } from './loadbalancer.js';

import {
  parseOkeClusters,
  parseNodePools,
  parseContainerInstances,
} from './container.js';

import {
  parseFunctionsApplications,
  parseFunctions,
  parseApiGateways,
  parseApiDeployments,
} from './serverless.js';

import {
  parseCompartments,
  parseUsers,
  parseGroups,
  parsePolicies,
  parseDynamicGroups,
} from './iam.js';

import { parseDnsZones } from './dns.js';
import { parseGeneric } from './generic.js';

// ---------------------------------------------------------------------------
// Type-to-parser mapping (used for explicit type specification)
// ---------------------------------------------------------------------------

type ParserFn = (json: any) => ParsedResource[];

const parserMap: Record<string, ParserFn> = {
  // Compute
  'compute/instance': parseInstances,
  'compute/image': parseImages,
  'compute/vnic-attachment': parseVnicAttachments,
  'compute/boot-volume-attachment': parseBootVolumeAttachments,

  // Network
  'network/vcn': parseVcns,
  'network/subnet': parseSubnets,
  'network/security-list': parseSecurityLists,
  'network/route-table': parseRouteTables,
  'network/nsg': parseNetworkSecurityGroups,
  'network/internet-gateway': parseInternetGateways,
  'network/nat-gateway': parseNatGateways,
  'network/service-gateway': parseServiceGateways,
  'network/drg': parseDrgs,
  'network/local-peering-gateway': parseLocalPeeringGateways,
  'network/dhcp-options': parseDhcpOptions,
  'network/load-balancer': parseLoadBalancers,

  // Database
  'database/db-system': parseDbSystems,
  'database/autonomous-database': parseAutonomousDatabases,
  'database/db-home': parseDbHomes,

  // Storage
  'storage/block-volume': parseBlockVolumes,
  'storage/boot-volume': parseBootVolumes,
  'storage/volume-backup': parseVolumeBackups,
  'storage/volume-group': parseVolumeGroups,
  'storage/bucket': parseBuckets,

  // Container / OKE
  'container/cluster': parseOkeClusters,
  'container/node-pool': parseNodePools,
  'container/container-instance': parseContainerInstances,

  // Serverless
  'serverless/application': parseFunctionsApplications,
  'serverless/function': parseFunctions,
  'serverless/api-gateway': parseApiGateways,
  'serverless/api-deployment': parseApiDeployments,

  // IAM
  'iam/compartment': parseCompartments,
  'iam/user': parseUsers,
  'iam/group': parseGroups,
  'iam/policy': parsePolicies,
  'iam/dynamic-group': parseDynamicGroups,

  // DNS
  'dns/zone': parseDnsZones,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Unwrap the OCI CLI `{"data": [...]}` envelope, returning the inner array.
 * Also handles plain arrays and single objects.
 */
function unwrap(json: any): any[] {
  if (json && Array.isArray(json.data)) return json.data;
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') return [json];
  return [];
}

/**
 * Check whether a field exists and is not null/undefined on a sample item.
 */
function has(item: any, key: string): boolean {
  return item[key] !== undefined && item[key] !== null;
}

// ---------------------------------------------------------------------------
// Auto-detection
// ---------------------------------------------------------------------------

/**
 * Inspect the first element of the array to determine which parser to use.
 * Returns the detected resource type string or null if unrecognised.
 */
function detectType(items: any[]): string | null {
  if (items.length === 0) return null;

  const sample = items[0];

  // --- Compute -----------------------------------------------------------

  // Instances: have "shape" + "image-id" (or "source-details")
  if (has(sample, 'shape') && (has(sample, 'image-id') || has(sample, 'source-details')) && has(sample, 'fault-domain')) {
    return 'compute/instance';
  }

  // Images: have "operating-system" + "operating-system-version"
  if (has(sample, 'operating-system') && has(sample, 'operating-system-version')) {
    return 'compute/image';
  }

  // VNIC attachments: have "vnic-id" + "instance-id"
  if (has(sample, 'vnic-id') && has(sample, 'instance-id')) {
    return 'compute/vnic-attachment';
  }

  // Boot volume attachments: have "boot-volume-id" + "instance-id"
  if (has(sample, 'boot-volume-id') && has(sample, 'instance-id')) {
    return 'compute/boot-volume-attachment';
  }

  // --- Network -----------------------------------------------------------

  // VCN: has "cidr-blocks" (or "cidr-block") + "vcn-domain-name"
  if ((has(sample, 'cidr-blocks') || has(sample, 'cidr-block')) && has(sample, 'vcn-domain-name')) {
    return 'network/vcn';
  }

  // Subnet: has "vcn-id" + "cidr-block" + "prohibit-internet-ingress"
  if (has(sample, 'vcn-id') && has(sample, 'cidr-block') && has(sample, 'prohibit-internet-ingress')) {
    return 'network/subnet';
  }

  // Security list: has "ingress-security-rules"
  if (has(sample, 'ingress-security-rules')) {
    return 'network/security-list';
  }

  // Route table: has "route-rules"
  if (has(sample, 'route-rules')) {
    return 'network/route-table';
  }

  // Load balancer: has "subnet-ids" + "backend-sets"
  if (has(sample, 'subnet-ids') && has(sample, 'backend-sets')) {
    return 'network/load-balancer';
  }

  // DHCP options: has "vcn-id" + "options" (array of DHCP option objects)
  if (has(sample, 'vcn-id') && has(sample, 'options') && Array.isArray(sample['options'])) {
    return 'network/dhcp-options';
  }

  // Internet gateway: has "vcn-id" + "is-enabled" (and no "nat-ip", "services", etc.)
  if (has(sample, 'vcn-id') && has(sample, 'is-enabled') && !has(sample, 'nat-ip') && !has(sample, 'services')) {
    return 'network/internet-gateway';
  }

  // NAT gateway: has "vcn-id" + "nat-ip"
  if (has(sample, 'vcn-id') && has(sample, 'nat-ip')) {
    return 'network/nat-gateway';
  }

  // Service gateway: has "vcn-id" + "services"
  if (has(sample, 'vcn-id') && has(sample, 'services')) {
    return 'network/service-gateway';
  }

  // Local peering gateway: has "vcn-id" + "peering-status"
  if (has(sample, 'vcn-id') && has(sample, 'peering-status')) {
    return 'network/local-peering-gateway';
  }

  // DRG: has "default-drg-route-tables" or "default-export-drg-route-distribution-id"
  if (has(sample, 'default-drg-route-tables') || has(sample, 'default-export-drg-route-distribution-id')) {
    return 'network/drg';
  }

  // NSG: has "vcn-id" but none of the other network sub-type indicators
  // (This is a broad catch — place it after more specific vcn-id checks)
  if (has(sample, 'vcn-id') && !has(sample, 'cidr-block') && !has(sample, 'route-rules') &&
      !has(sample, 'ingress-security-rules') && !has(sample, 'is-enabled') &&
      !has(sample, 'nat-ip') && !has(sample, 'services') && !has(sample, 'peering-status') &&
      !has(sample, 'options') && !has(sample, 'kubernetes-version')) {
    return 'network/nsg';
  }

  // --- Database ----------------------------------------------------------

  // Autonomous database: has "db-name" + "db-workload"
  if (has(sample, 'db-name') && has(sample, 'db-workload')) {
    return 'database/autonomous-database';
  }

  // DB system: has "shape" + "subnet-id" + "database-edition"
  if (has(sample, 'shape') && has(sample, 'subnet-id') && has(sample, 'database-edition')) {
    return 'database/db-system';
  }

  // DB home: has "db-system-id" + "db-version"
  if (has(sample, 'db-system-id') && has(sample, 'db-version')) {
    return 'database/db-home';
  }

  // --- Storage -----------------------------------------------------------

  // Boot volume: has "size-in-gbs" + "image-id" (boot volumes reference the image)
  if (has(sample, 'size-in-gbs') && has(sample, 'image-id') && !has(sample, 'shape')) {
    return 'storage/boot-volume';
  }

  // Volume group: has "volume-ids"
  if (has(sample, 'volume-ids')) {
    return 'storage/volume-group';
  }

  // Volume backup: has "volume-id" + "unique-size-in-gbs" or "source-type" with "type"
  if (has(sample, 'volume-id') && (has(sample, 'unique-size-in-gbs') || has(sample, 'source-type'))) {
    return 'storage/volume-backup';
  }

  // Block volume: has "size-in-gbs" + "vpus-per-gb" (and no image-id)
  if (has(sample, 'size-in-gbs') && has(sample, 'vpus-per-gb') && !has(sample, 'image-id')) {
    return 'storage/block-volume';
  }

  // Bucket: has "namespace" + "public-access-type"
  if (has(sample, 'namespace') && has(sample, 'public-access-type')) {
    return 'storage/bucket';
  }

  // --- Container / OKE ---------------------------------------------------

  // OKE cluster: has "kubernetes-version" + "vcn-id"
  if (has(sample, 'kubernetes-version') && has(sample, 'vcn-id')) {
    return 'container/cluster';
  }

  // Node pool: has "cluster-id" + ("subnet-ids" or "node-config-details")
  if (has(sample, 'cluster-id') && (has(sample, 'subnet-ids') || has(sample, 'node-config-details'))) {
    return 'container/node-pool';
  }

  // Container instance: has "containers" + "shape" + "container-count"
  if (has(sample, 'containers') && has(sample, 'shape') && has(sample, 'container-count')) {
    return 'container/container-instance';
  }

  // --- Serverless --------------------------------------------------------

  // Function: has "application-id" + "image"
  if (has(sample, 'application-id') && has(sample, 'image')) {
    return 'serverless/function';
  }

  // Functions application: has "subnet-ids" + no "backend-sets" (distinguishes from LB)
  if (has(sample, 'subnet-ids') && !has(sample, 'backend-sets') && !has(sample, 'cluster-id')) {
    return 'serverless/application';
  }

  // API deployment: has "gateway-id" + "path-prefix"
  if (has(sample, 'gateway-id') && has(sample, 'path-prefix')) {
    return 'serverless/api-deployment';
  }

  // API gateway: has "subnet-id" + "endpoint-type"
  if (has(sample, 'subnet-id') && has(sample, 'endpoint-type')) {
    return 'serverless/api-gateway';
  }

  // --- IAM ---------------------------------------------------------------

  // Policy: has "statements"
  if (has(sample, 'statements')) {
    return 'iam/policy';
  }

  // Dynamic group: has "matching-rule"
  if (has(sample, 'matching-rule')) {
    return 'iam/dynamic-group';
  }

  // User: has "email" (or "capabilities") + "compartment-id"
  if ((has(sample, 'email') || has(sample, 'capabilities')) && has(sample, 'compartment-id')) {
    return 'iam/user';
  }

  // Compartment: has "compartment-id" + "is-accessible"
  if (has(sample, 'compartment-id') && has(sample, 'is-accessible')) {
    return 'iam/compartment';
  }

  // Group: has "compartment-id" + "description" and no other distinguishing fields
  // (Very generic — kept last among IAM)
  if (has(sample, 'compartment-id') && has(sample, 'description') &&
      !has(sample, 'email') && !has(sample, 'capabilities') &&
      !has(sample, 'statements') && !has(sample, 'matching-rule') &&
      !has(sample, 'is-accessible')) {
    return 'iam/group';
  }

  // --- DNS ---------------------------------------------------------------

  // DNS zone: has "zone-type"
  if (has(sample, 'zone-type')) {
    return 'dns/zone';
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse an OCI CLI JSON string into an array of `ParsedResource` objects.
 *
 * @param jsonString  - Raw JSON string from OCI CLI output.
 * @param explicitType - Optional resource type (e.g. "compute/instance") to
 *                        bypass auto-detection.
 * @returns An array of parsed resources. Returns an empty array when the
 *          input cannot be parsed or the resource type is unrecognised.
 */
export function parseResources(
  input: any,
  explicitType?: string,
): ParsedResource[] {
  // Accept either a raw JSON object/array or a JSON string.
  let json: any;
  if (typeof input === 'string') {
    try {
      json = JSON.parse(input);
    } catch {
      return [];
    }
  } else {
    json = input;
  }

  // If an explicit type was provided, use the corresponding parser directly.
  if (explicitType) {
    const parser = parserMap[explicitType];
    if (!parser) return [];
    return parser(json);
  }

  // Otherwise, attempt auto-detection.
  const items = unwrap(json);
  const detectedType = detectType(items);
  if (!detectedType) {
    // Fallback: generic parser for unrecognised OCI resources.
    // Extracts common fields and infers type from OCID prefix.
    return parseGeneric(json);
  }

  const parser = parserMap[detectedType];
  if (!parser) return [];

  return parser(json);
}

// ---------------------------------------------------------------------------
// Re-exports for direct access
// ---------------------------------------------------------------------------

export { parseInstances, parseImages, parseVnicAttachments, parseBootVolumeAttachments } from './compute.js';
export { parseVcns, parseSubnets, parseSecurityLists, parseRouteTables, parseNetworkSecurityGroups, parseInternetGateways, parseNatGateways, parseServiceGateways, parseDrgs, parseLocalPeeringGateways, parseDhcpOptions } from './network.js';
export { parseDbSystems, parseAutonomousDatabases, parseDbHomes } from './database.js';
export { parseBlockVolumes, parseBootVolumes, parseVolumeBackups, parseVolumeGroups, parseBuckets } from './storage.js';
export { parseLoadBalancers } from './loadbalancer.js';
export { parseOkeClusters, parseNodePools, parseContainerInstances } from './container.js';
export { parseFunctionsApplications, parseFunctions, parseApiGateways, parseApiDeployments } from './serverless.js';
export { parseCompartments, parseUsers, parseGroups, parsePolicies, parseDynamicGroups } from './iam.js';
export { parseDnsZones } from './dns.js';
export { parseGeneric } from './generic.js';

/** All supported explicit resource type strings. */
export const supportedTypes: string[] = Object.keys(parserMap);

/** Expose the detection function for testing / diagnostics. */
export { detectType };
