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
  parseInstanceConfigurations,
  parseInstancePools,
  parseVolumeAttachments,
  parseDedicatedVmHosts,
  parseCapacityReservations,
  parseComputeClusters,
  parseConsoleHistories,
  parseAutoscalingConfigs,
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
  parseDrgAttachments,
  parseLocalPeeringGateways,
  parseDhcpOptions,
  parseNsgRules,
  parseDrgRouteTables,
  parseDrgRouteRules,
  parsePublicIps,
  parseVlans,
  parseCpes,
  parseIpsecConnections,
  parseCrossConnectGroups,
  parseCrossConnects,
  parseVirtualCircuits,
  parseRemotePeeringConnections,
  parsePrivateIps,
  parseVtaps,
  parseCaptureFilters,
  parseByoipRanges,
  parsePublicIpPools,
  parseNetworkFirewalls,
  parseNetworkFirewallPolicies,
  parseDrgRouteDistributions,
} from './network.js';

import {
  parseDbSystems,
  parseAutonomousDatabases,
  parseMysqlDbSystems,
  parseDbHomes,
  parseNoSqlTables,
  parseDbBackups,
  parseAutonomousDbBackups,
  parseAutonomousContainerDatabases,
  parseDatabases,
  parsePluggableDatabases,
  parseDbNodes,
  parseExadataInfrastructures,
  parseCloudVmClusters,
  parseCloudExaInfras,
  parseDbSoftwareImages,
  parseDbKeyStores,
  parseMaintenanceRuns,
  parseDataGuardAssociations,
  parseRedisClusters,
  parseOpensearchClusters,
  parsePsqlDbSystems,
  parsePsqlBackups,
} from './database.js';

import {
  parseBlockVolumes,
  parseBootVolumes,
  parseVolumeBackups,
  parseVolumeGroups,
  parseFileSystems,
  parseBuckets,
  parseMountTargets,
  parsePreauthRequests,
  parseLifecyclePolicies,
  parseReplicationPolicies,
} from './storage.js';

import { parseLoadBalancers, parseNetworkLoadBalancers } from './loadbalancer.js';

import {
  parseOkeClusters,
  parseNodePools,
  parseContainerInstances,
  parseContainerRepositories,
  parseContainerImages,
  parseContainerImageSignatures,
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
  parseUserGroupMemberships,
  parsePolicies,
  parseDynamicGroups,
  parseApiKeys,
  parseCustomerSecretKeys,
  parseAuthTokens,
  parseSmtpCredentials,
  parseNetworkSources,
  parseRegionSubscriptions,
} from './iam.js';

import { parseDnsZones, parseDnsRecords, parseDnsViews, parseDnsResolvers, parseDnsResolverEndpoints, parseDnsSteeringPolicies, parseDnsSteeringPolicyAttachments, parseDnsTsigKeys } from './dns.js';
import { parseGeneric } from './generic.js';

import { parseVaults, parseSecrets, parseContainerScanResults, parseWafPolicies, parseBastions, parseCertificates, parseCloudGuardTargets, parseCloudGuardDetectorRecipes, parseWaasPolicies, parseWaasCertificates } from './security.js';
import { parseLogGroups, parseLogs, parseAlarms, parseNotificationTopics, parseNotificationSubscriptions, parseEventsRules, parseEmailSenders } from './observability.js';

import { parseStreams, parseConnectHarnesses, parseServiceConnectors, parseQueues } from './messaging.js';
import { parseResourceManagerStacks, parseBudgets, parseQuotas, parseTagNamespaces, parseTagDefaults, parseTags } from './governance.js';
import { parseDevopsProjects, parseDevopsBuildPipelines, parseDevopsDeployPipelines, parseDevopsRepositories } from './devops.js';
import { parseHealthChecksHttp, parseHealthChecksPing, parseApmDomains, parseDrProtectionGroups, parseDrPlans } from './monitoring.js';

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
  'compute/instance-configuration': parseInstanceConfigurations,
  'compute/instance-pool': parseInstancePools,
  'compute/volume-attachment': parseVolumeAttachments,
  'compute/dedicated-vm-host': parseDedicatedVmHosts,
  'compute/capacity-reservation': parseCapacityReservations,
  'compute/compute-cluster': parseComputeClusters,
  'compute/console-history': parseConsoleHistories,
  'compute/autoscaling-config': parseAutoscalingConfigs,

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
  'network/drg-attachment': parseDrgAttachments,
  'network/local-peering-gateway': parseLocalPeeringGateways,
  'network/dhcp-options': parseDhcpOptions,
  'network/nsg-rule': parseNsgRules,
  'network/drg-route-table': parseDrgRouteTables,
  'network/drg-route-rule': parseDrgRouteRules,
  'network/public-ip': parsePublicIps,
  'network/load-balancer': parseLoadBalancers,
  'network/network-load-balancer': parseNetworkLoadBalancers,
  'network/vlan': parseVlans,
  'network/cpe': parseCpes,
  'network/ipsec-connection': parseIpsecConnections,
  'network/cross-connect-group': parseCrossConnectGroups,
  'network/cross-connect': parseCrossConnects,
  'network/virtual-circuit': parseVirtualCircuits,
  'network/remote-peering-connection': parseRemotePeeringConnections,
  'network/private-ip': parsePrivateIps,
  'network/vtap': parseVtaps,
  'network/capture-filter': parseCaptureFilters,
  'network/byoip-range': parseByoipRanges,
  'network/public-ip-pool': parsePublicIpPools,
  'network/network-firewall': parseNetworkFirewalls,
  'network/network-firewall-policy': parseNetworkFirewallPolicies,
  'network/drg-route-distribution': parseDrgRouteDistributions,

  // Database
  'database/db-system': parseDbSystems,
  'database/autonomous-database': parseAutonomousDatabases,
  'database/mysql-db-system': parseMysqlDbSystems,
  'database/db-home': parseDbHomes,
  'database/nosql-table': parseNoSqlTables,
  'database/db-backup': parseDbBackups,
  'database/autonomous-db-backup': parseAutonomousDbBackups,
  'database/autonomous-container-database': parseAutonomousContainerDatabases,
  'database/database': parseDatabases,
  'database/pluggable-database': parsePluggableDatabases,
  'database/db-node': parseDbNodes,
  'database/exadata-infrastructure': parseExadataInfrastructures,
  'database/cloud-vm-cluster': parseCloudVmClusters,
  'database/cloud-exa-infra': parseCloudExaInfras,
  'database/db-software-image': parseDbSoftwareImages,
  'database/db-key-store': parseDbKeyStores,
  'database/maintenance-run': parseMaintenanceRuns,
  'database/data-guard-association': parseDataGuardAssociations,
  'database/redis-cluster': parseRedisClusters,
  'database/opensearch-cluster': parseOpensearchClusters,
  'database/psql-db-system': parsePsqlDbSystems,
  'database/psql-backup': parsePsqlBackups,

  // Storage
  'storage/block-volume': parseBlockVolumes,
  'storage/boot-volume': parseBootVolumes,
  'storage/volume-backup': parseVolumeBackups,
  'storage/volume-group': parseVolumeGroups,
  'storage/file-system': parseFileSystems,
  'storage/bucket': parseBuckets,
  'storage/mount-target': parseMountTargets,
  'storage/preauth-request': parsePreauthRequests,
  'storage/lifecycle-policy': parseLifecyclePolicies,
  'storage/replication-policy': parseReplicationPolicies,

  // Container / OKE
  'container/cluster': parseOkeClusters,
  'container/node-pool': parseNodePools,
  'container/container-instance': parseContainerInstances,
  'container/container-repository': parseContainerRepositories,
  'container/container-image': parseContainerImages,
  'container/image-signature': parseContainerImageSignatures,

  // Serverless
  'serverless/application': parseFunctionsApplications,
  'serverless/function': parseFunctions,
  'serverless/api-gateway': parseApiGateways,
  'serverless/api-deployment': parseApiDeployments,

  // IAM
  'iam/compartment': parseCompartments,
  'iam/user': parseUsers,
  'iam/group': parseGroups,
  'iam/user-group-membership': parseUserGroupMemberships,
  'iam/policy': parsePolicies,
  'iam/dynamic-group': parseDynamicGroups,
  'iam/api-key': parseApiKeys,
  'iam/customer-secret-key': parseCustomerSecretKeys,
  'iam/auth-token': parseAuthTokens,
  'iam/smtp-credential': parseSmtpCredentials,
  'iam/network-source': parseNetworkSources,
  'iam/region-subscription': parseRegionSubscriptions,

  // DNS
  'dns/zone': parseDnsZones,
  'dns/record': parseDnsRecords,
  'dns/view': parseDnsViews,
  'dns/resolver': parseDnsResolvers,
  'dns/resolver-endpoint': parseDnsResolverEndpoints,
  'dns/steering-policy': parseDnsSteeringPolicies,
  'dns/steering-policy-attachment': parseDnsSteeringPolicyAttachments,
  'dns/tsig-key': parseDnsTsigKeys,

  // Security
  'security/vault': parseVaults,
  'security/secret': parseSecrets,
  'security/container-scan-result': parseContainerScanResults,
  'security/waf-policy': parseWafPolicies,
  'security/bastion': parseBastions,
  'security/certificate': parseCertificates,
  'security/cloud-guard-target': parseCloudGuardTargets,
  'security/cloud-guard-detector-recipe': parseCloudGuardDetectorRecipes,
  'security/waas-policy': parseWaasPolicies,
  'security/waas-certificate': parseWaasCertificates,
  'security/dr-protection-group': parseDrProtectionGroups,
  'security/dr-plan': parseDrPlans,

  // Observability
  'observability/log-group': parseLogGroups,
  'observability/log': parseLogs,
  'observability/alarm': parseAlarms,
  'observability/notification-topic': parseNotificationTopics,
  'observability/notification-subscription': parseNotificationSubscriptions,
  'observability/events-rule': parseEventsRules,
  'observability/email-sender': parseEmailSenders,

  // Messaging
  'messaging/stream': parseStreams,
  'messaging/connect-harness': parseConnectHarnesses,
  'messaging/service-connector': parseServiceConnectors,
  'messaging/queue': parseQueues,

  // Governance
  'governance/resource-manager-stack': parseResourceManagerStacks,
  'governance/budget': parseBudgets,
  'governance/quota': parseQuotas,
  'iam/tag-namespace': parseTagNamespaces,
  'iam/tag-default': parseTagDefaults,
  'iam/tag': parseTags,

  // DevOps
  'devops/project': parseDevopsProjects,
  'devops/build-pipeline': parseDevopsBuildPipelines,
  'devops/deploy-pipeline': parseDevopsDeployPipelines,
  'devops/repository': parseDevopsRepositories,

  // Monitoring / Health
  'monitoring/health-check-http': parseHealthChecksHttp,
  'monitoring/health-check-ping': parseHealthChecksPing,
  'monitoring/apm-domain': parseApmDomains,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Unwrap the OCI CLI `{"data": [...]}` envelope, returning the inner array.
 * Also handles plain arrays and single objects.
 */
function unwrap(json: any): any[] {
  if (json && json.data !== undefined && json.data !== null) {
    if (Array.isArray(json.data)) return json.data;
    // Handle paginated collection responses: {"data": {"items": [...]}}
    if (typeof json.data === 'object' && Array.isArray(json.data.items)) return json.data.items;
    if (typeof json.data === 'object') return [json.data]; // single-resource envelope
  }
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

  // Instances: have "shape" + "image-id" (or "source-details") + "fault-domain"
  // Use `in` instead of `has()` because image-id can be null for boot-volume launches
  // Negative guards exclude DB systems (database-edition) and container instances (container-count/containers)
  if (has(sample, 'shape') && ('image-id' in sample || 'source-details' in sample) && 'fault-domain' in sample
      && !has(sample, 'database-edition') && !has(sample, 'container-count') && !has(sample, 'containers')) {
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

  // Instance pool: has "instance-configuration-id" + "size" + "placement-configurations"
  if (has(sample, 'instance-configuration-id') && has(sample, 'size') && has(sample, 'placement-configurations')) {
    return 'compute/instance-pool';
  }

  // --- Network -----------------------------------------------------------

  // NSG Rules: has "direction" + "protocol" + "network-security-group-id"
  if (has(sample, 'direction') && has(sample, 'protocol') && has(sample, 'network-security-group-id')) {
    return 'network/nsg-rule';
  }

  // DRG Route Table: has "drg-id" + "import-drg-route-distribution-id"
  if (has(sample, 'drg-id') && has(sample, 'import-drg-route-distribution-id')) {
    return 'network/drg-route-table';
  }

  // DRG Route Rule: has "drg-route-table-id" + "destination-type" + "next-hop-drg-attachment-id"
  if (has(sample, 'drg-route-table-id') && has(sample, 'destination-type') && has(sample, 'next-hop-drg-attachment-id')) {
    return 'network/drg-route-rule';
  }

  // Public IP: has "ip-address" + "scope" + "assigned-entity-type"
  if (has(sample, 'ip-address') && has(sample, 'scope') && has(sample, 'assigned-entity-type')) {
    return 'network/public-ip';
  }

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

  // Network load balancer: has "subnet-id" (singular) + "nlb-ip-version"
  if (has(sample, 'subnet-id') && has(sample, 'nlb-ip-version')) {
    return 'network/network-load-balancer';
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

  // DRG attachment: has "drg-id" + "drg-route-table-id"
  if (has(sample, 'drg-id') && has(sample, 'drg-route-table-id')) {
    return 'network/drg-attachment';
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

  // MySQL DB system: has "mysql-version" + "subnet-id" (before Oracle DB system check)
  if (has(sample, 'mysql-version') && has(sample, 'subnet-id')) {
    return 'database/mysql-db-system';
  }

  // DB system: has "shape" + "subnet-id" + "database-edition"
  if (has(sample, 'shape') && has(sample, 'subnet-id') && has(sample, 'database-edition')) {
    return 'database/db-system';
  }

  // DB home: has "db-system-id" + "db-version"
  if (has(sample, 'db-system-id') && has(sample, 'db-version')) {
    return 'database/db-home';
  }

  // NoSQL table: has "table-limits" + "ddl-statement"
  if (has(sample, 'table-limits') && has(sample, 'ddl-statement')) {
    return 'database/nosql-table';
  }

  // --- Storage -----------------------------------------------------------

  // Mount target: has "export-set-id" + "subnet-id" + NOT "metered-bytes"
  if (has(sample, 'export-set-id') && has(sample, 'subnet-id') && !has(sample, 'metered-bytes')) {
    return 'storage/mount-target';
  }

  // File system: has "metered-bytes" (unique to FSS)
  if (has(sample, 'metered-bytes')) {
    return 'storage/file-system';
  }

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

  // Container repository: has "image-count" + "is-immutable"
  if (has(sample, 'image-count') && has(sample, 'is-immutable')) {
    return 'container/container-repository';
  }

  // Container image: has "repository-id" + "digest"
  if (has(sample, 'repository-id') && has(sample, 'digest')) {
    return 'container/container-image';
  }

  // Bucket: has "namespace" + ("public-access-type" from get, or "created-by" from list)
  if (has(sample, 'namespace') && (has(sample, 'public-access-type') || has(sample, 'created-by'))) {
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

  // User group membership: has "user-id" + "group-id"
  if (has(sample, 'user-id') && has(sample, 'group-id')) {
    return 'iam/user-group-membership';
  }

  // API key: has "fingerprint" + "key-value"
  if (has(sample, 'fingerprint') && has(sample, 'key-value')) {
    return 'iam/api-key';
  }

  // Customer secret key: has "user-id" + "time-expires" + no "vault-id" + no "secret-name"
  if (has(sample, 'user-id') && has(sample, 'time-expires') && !has(sample, 'vault-id') && !has(sample, 'secret-name')) {
    return 'iam/customer-secret-key';
  }

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

  // --- Security ----------------------------------------------------------

  // Vault: has "vault-type" + "crypto-endpoint"
  if (has(sample, 'vault-type') && has(sample, 'crypto-endpoint')) {
    return 'security/vault';
  }

  // Secret: has "vault-id" + "secret-name"
  if (has(sample, 'vault-id') && has(sample, 'secret-name')) {
    return 'security/secret';
  }

  // Container scan result: has "highest-problem-severity" + "problem-count"
  if (has(sample, 'highest-problem-severity') && has(sample, 'problem-count')) {
    return 'security/container-scan-result';
  }

  // WAF policy: has "web-app-firewall-policy-id" + "backend-type"
  if (has(sample, 'web-app-firewall-policy-id') && has(sample, 'backend-type')) {
    return 'security/waf-policy';
  }

  // Bastion: has "bastion-type" + "target-subnet-id"
  if (has(sample, 'bastion-type') && has(sample, 'target-subnet-id')) {
    return 'security/bastion';
  }

  // Certificate: has "certificate-rules" OR (has "current-version" + "config-type")
  if (has(sample, 'certificate-rules') || (has(sample, 'current-version') && has(sample, 'config-type'))) {
    return 'security/certificate';
  }

  // --- Observability -----------------------------------------------------

  // Log: has "log-group-id" + "log-type"
  if (has(sample, 'log-group-id') && has(sample, 'log-type')) {
    return 'observability/log';
  }

  // Alarm: has "metric-compartment-id" + "namespace" + "query" + "severity"
  if (has(sample, 'metric-compartment-id') && has(sample, 'namespace') && has(sample, 'query') && has(sample, 'severity')) {
    return 'observability/alarm';
  }

  // Notification subscription: has "topic-id" + "protocol" + "endpoint" + "delivery-policy"
  // (Must come before notification topic since both have "topic-id")
  if (has(sample, 'topic-id') && has(sample, 'protocol') && has(sample, 'endpoint') && has(sample, 'delivery-policy')) {
    return 'observability/notification-subscription';
  }

  // Notification topic: has "topic-id" + "api-endpoint"
  if (has(sample, 'topic-id') && has(sample, 'api-endpoint')) {
    return 'observability/notification-topic';
  }

  // Events rule: has "condition" + "actions" + "is-enabled"
  if (has(sample, 'condition') && has(sample, 'actions') && has(sample, 'is-enabled')) {
    return 'observability/events-rule';
  }

  // --- Container (continued) --------------------------------------------

  // Image signature: has "signing-algorithm" + "signature"
  if (has(sample, 'signing-algorithm') && has(sample, 'signature')) {
    return 'container/image-signature';
  }

  // --- DNS ---------------------------------------------------------------

  // DNS zone: has "zone-type"
  if (has(sample, 'zone-type')) {
    return 'dns/zone';
  }

  // DNS record: has "rdata" and "rtype"
  if (has(sample, 'rdata') && has(sample, 'rtype')) return 'dns/record';

  // DNS resolver: has "attached-vcn-id"
  if (has(sample, 'attached-vcn-id')) return 'dns/resolver';

  // DNS resolver endpoint: has "endpoint-type" and "is-forwarding"
  if (has(sample, 'endpoint-type') && has(sample, 'is-forwarding')) return 'dns/resolver-endpoint';

  // DNS steering policy: has "template" and "health-check-monitor-id"
  if (has(sample, 'template') && has(sample, 'health-check-monitor-id')) return 'dns/steering-policy';

  // DNS steering policy attachment: has "steering-policy-id" and "domain-name"
  if (has(sample, 'steering-policy-id') && has(sample, 'domain-name')) return 'dns/steering-policy-attachment';

  // DNS TSIG key: has "algorithm" and "secret"
  if (has(sample, 'algorithm') && has(sample, 'secret')) return 'dns/tsig-key';

  // DNS view: has "is-protected" but no zone-type or rdata
  if (has(sample, 'is-protected') && !has(sample, 'zone-type') && !has(sample, 'rdata')) return 'dns/view';

  return null;
}

// ---------------------------------------------------------------------------
// OCID prefix → resource type fallback
// When field-based auto-detection fails, we can still identify the resource
// type from the OCID pattern: ocid1.<resource-type>.<realm>.<region>.<id>
// ---------------------------------------------------------------------------

const OCID_PREFIX_TO_TYPE: Record<string, string> = {
  // Compute
  'instance': 'compute/instance',
  'image': 'compute/image',
  'vnicattachment': 'compute/vnic-attachment',
  'bootvolumeattachment': 'compute/boot-volume-attachment',

  // Network
  'vcn': 'network/vcn',
  'subnet': 'network/subnet',
  'securitylist': 'network/security-list',
  'routetable': 'network/route-table',
  'networksecuritygroup': 'network/nsg',
  'internetgateway': 'network/internet-gateway',
  'natgateway': 'network/nat-gateway',
  'servicegateway': 'network/service-gateway',
  'drg': 'network/drg',
  'drgattachment': 'network/drg-attachment',
  'drgroutetable': 'network/drg-route-table',
  'publicip': 'network/public-ip',
  'localpeeringgateway': 'network/local-peering-gateway',
  'dhcpoptions': 'network/dhcp-options',
  'loadbalancer': 'network/load-balancer',
  'networkloadbalancer': 'network/network-load-balancer',

  // Database
  'dbsystem': 'database/db-system',
  'autonomousdatabase': 'database/autonomous-database',
  'mysqldbsystem': 'database/mysql-db-system',
  'dbhome': 'database/db-home',

  // Storage
  'volume': 'storage/block-volume',
  'bootvolume': 'storage/boot-volume',
  'volumebackup': 'storage/volume-backup',
  'volumegroup': 'storage/volume-group',
  'filesystem': 'storage/file-system',
  'mounttarget': 'storage/mount-target',
  'bucket': 'storage/bucket',

  // Compute (continued)
  'instanceconfiguration': 'compute/instance-configuration',
  'instancepool': 'compute/instance-pool',

  // Container / OKE
  'cluster': 'container/cluster',
  'nodepool': 'container/node-pool',
  'computecontainerinstance': 'container/container-instance',
  'containerrepo': 'container/container-repository',
  'containerimage': 'container/container-image',
  'containerimagesignature': 'container/image-signature',

  // Serverless
  'fnapp': 'serverless/application',
  'fnfunc': 'serverless/function',
  'apigateway': 'serverless/api-gateway',
  'apideployment': 'serverless/api-deployment',

  // IAM
  'compartment': 'iam/compartment',
  'user': 'iam/user',
  'group': 'iam/group',
  'groupmembership': 'iam/user-group-membership',
  'policy': 'iam/policy',
  'dynamicgroup': 'iam/dynamic-group',
  'apikey': 'iam/api-key',
  'customersecretkey': 'iam/customer-secret-key',

  // DNS
  'dns-zone': 'dns/zone',
  'dnszone': 'dns/zone',
  'dnsresolver': 'dns/resolver',
  'dnsresolverendpoint': 'dns/resolver-endpoint',
  'dnspolicy': 'dns/steering-policy',
  'dnspolicyattachment': 'dns/steering-policy-attachment',
  'tsig': 'dns/tsig-key',
  'dnsview': 'dns/view',

  // Security
  'vault': 'security/vault',
  'secret': 'security/secret',
  'containerscanresult': 'security/container-scan-result',
  'webappfirewall': 'security/waf-policy',
  'bastion': 'security/bastion',
  'certificate': 'security/certificate',
  'cloudguardtarget': 'security/cloud-guard-target',
  'detectorrecipe': 'security/cloud-guard-detector-recipe',
  'waaspolicy': 'security/waas-policy',
  'waascertificate': 'security/waas-certificate',
  'drprotectiongroup': 'security/dr-protection-group',
  'drplan': 'security/dr-plan',

  // Observability
  'loggroup': 'observability/log-group',
  'log': 'observability/log',
  'alarm': 'observability/alarm',
  'onstopic': 'observability/notification-topic',
  'onssubscription': 'observability/notification-subscription',
  'eventrule': 'observability/events-rule',
  'nosqltable': 'database/nosql-table',
  'emailsender': 'observability/email-sender',

  // Compute (continued)
  'volumeattachment': 'compute/volume-attachment',
  'dedicatedvmhost': 'compute/dedicated-vm-host',
  'capacityreservation': 'compute/capacity-reservation',
  'computecluster': 'compute/compute-cluster',
  'consolehistory': 'compute/console-history',
  'autoscalingconfiguration': 'compute/autoscaling-config',

  // Network (continued)
  'vlan': 'network/vlan',
  'cpe': 'network/cpe',
  'ipsecconnection': 'network/ipsec-connection',
  'crossconnectgroup': 'network/cross-connect-group',
  'crossconnect': 'network/cross-connect',
  'virtualcircuit': 'network/virtual-circuit',
  'remotepeeringconnection': 'network/remote-peering-connection',
  'privateip': 'network/private-ip',
  'vtap': 'network/vtap',
  'capturefilter': 'network/capture-filter',
  'byoiprange': 'network/byoip-range',
  'publicippool': 'network/public-ip-pool',
  'networkfirewall': 'network/network-firewall',
  'networkfirewallpolicy': 'network/network-firewall-policy',
  'drgroutedistribution': 'network/drg-route-distribution',

  // Database (continued)
  'dbbackup': 'database/db-backup',
  'autonomousdatabasebackup': 'database/autonomous-db-backup',
  'autonomouscontainerdatabase': 'database/autonomous-container-database',
  'database': 'database/database',
  'pluggabledatabase': 'database/pluggable-database',
  'dbnode': 'database/db-node',
  'exadatainfrastructure': 'database/exadata-infrastructure',
  'cloudvmcluster': 'database/cloud-vm-cluster',
  'cloudexadatainfrastructure': 'database/cloud-exa-infra',
  'databasesoftwareimage': 'database/db-software-image',
  'keystore': 'database/db-key-store',
  'maintenancerun': 'database/maintenance-run',
  'dataguardassociation': 'database/data-guard-association',
  'rediscluster': 'database/redis-cluster',
  'opensearchcluster': 'database/opensearch-cluster',
  'psqldbsystem': 'database/psql-db-system',
  'psqlbackup': 'database/psql-backup',

  // Storage (continued)
  'preauthrequest': 'storage/preauth-request',

  // IAM (continued)
  'authtoken': 'iam/auth-token',
  'smtpcredential': 'iam/smtp-credential',
  'networksource': 'iam/network-source',
  'tagnamespace': 'iam/tag-namespace',
  'tagdefault': 'iam/tag-default',
  'tag': 'iam/tag',

  // Messaging
  'stream': 'messaging/stream',
  'connectharness': 'messaging/connect-harness',
  'serviceconnector': 'messaging/service-connector',
  'queue': 'messaging/queue',

  // Governance
  'ormstack': 'governance/resource-manager-stack',
  'budget': 'governance/budget',
  'quota': 'governance/quota',

  // DevOps
  'devopsproject': 'devops/project',
  'buildpipeline': 'devops/build-pipeline',
  'deploypipeline': 'devops/deploy-pipeline',
  'devopsrepository': 'devops/repository',

  // Monitoring / Health
  'httpmonitor': 'monitoring/health-check-http',
  'pingmonitor': 'monitoring/health-check-ping',
  'apmdomain': 'monitoring/apm-domain',
};

/**
 * Try to determine the resource type from the OCID prefix of the first item.
 * OCID format: ocid1.<resource-type>.<realm>.<region>.<unique-id>
 */
function detectTypeFromOcid(items: any[]): string | null {
  if (items.length === 0) return null;

  const sample = items[0];
  const ocid: string = sample['id'] ?? sample['ocid'] ?? '';
  if (!ocid || !ocid.startsWith('ocid1.')) return null;

  const parts = ocid.split('.');
  if (parts.length < 2) return null;

  const ocidType = parts[1]; // e.g. "vcn", "instance", "fnapp"
  return OCID_PREFIX_TO_TYPE[ocidType] ?? null;
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

  // Otherwise, attempt auto-detection using field signatures first,
  // then OCID prefix as a second-pass fallback.
  const items = unwrap(json);

  const detectedType = detectType(items) ?? detectTypeFromOcid(items);
  if (!detectedType) {
    // Last resort: generic parser for truly unrecognised OCI resources.
    return parseGeneric(json);
  }

  const parser = parserMap[detectedType];
  if (!parser) return [];

  return parser(json);
}

// ---------------------------------------------------------------------------
// Re-exports for direct access
// ---------------------------------------------------------------------------

export { parseInstances, parseImages, parseVnicAttachments, parseBootVolumeAttachments, parseInstanceConfigurations, parseInstancePools, parseVolumeAttachments, parseDedicatedVmHosts, parseCapacityReservations, parseComputeClusters, parseConsoleHistories, parseAutoscalingConfigs } from './compute.js';
export { parseVcns, parseSubnets, parseSecurityLists, parseRouteTables, parseNetworkSecurityGroups, parseInternetGateways, parseNatGateways, parseServiceGateways, parseDrgs, parseDrgAttachments, parseLocalPeeringGateways, parseDhcpOptions, parseNsgRules, parseDrgRouteTables, parseDrgRouteRules, parsePublicIps, parseVlans, parseCpes, parseIpsecConnections, parseCrossConnectGroups, parseCrossConnects, parseVirtualCircuits, parseRemotePeeringConnections, parsePrivateIps, parseVtaps, parseCaptureFilters, parseByoipRanges, parsePublicIpPools, parseNetworkFirewalls, parseNetworkFirewallPolicies, parseDrgRouteDistributions } from './network.js';
export { parseDbSystems, parseAutonomousDatabases, parseMysqlDbSystems, parseDbHomes, parseNoSqlTables, parseDbBackups, parseAutonomousDbBackups, parseAutonomousContainerDatabases, parseDatabases, parsePluggableDatabases, parseDbNodes, parseExadataInfrastructures, parseCloudVmClusters, parseCloudExaInfras, parseDbSoftwareImages, parseDbKeyStores, parseMaintenanceRuns, parseDataGuardAssociations, parseRedisClusters, parseOpensearchClusters, parsePsqlDbSystems, parsePsqlBackups } from './database.js';
export { parseBlockVolumes, parseBootVolumes, parseVolumeBackups, parseVolumeGroups, parseFileSystems, parseBuckets, parseMountTargets, parsePreauthRequests, parseLifecyclePolicies, parseReplicationPolicies } from './storage.js';
export { parseLoadBalancers, parseNetworkLoadBalancers } from './loadbalancer.js';
export { parseOkeClusters, parseNodePools, parseContainerInstances, parseContainerRepositories, parseContainerImages, parseContainerImageSignatures } from './container.js';
export { parseFunctionsApplications, parseFunctions, parseApiGateways, parseApiDeployments } from './serverless.js';
export { parseCompartments, parseUsers, parseGroups, parseUserGroupMemberships, parsePolicies, parseDynamicGroups, parseApiKeys, parseCustomerSecretKeys, parseAuthTokens, parseSmtpCredentials, parseNetworkSources, parseRegionSubscriptions } from './iam.js';
export { parseDnsZones, parseDnsRecords, parseDnsViews, parseDnsResolvers, parseDnsResolverEndpoints, parseDnsSteeringPolicies, parseDnsSteeringPolicyAttachments, parseDnsTsigKeys } from './dns.js';
export { parseGeneric } from './generic.js';
export { parseVaults, parseSecrets, parseContainerScanResults, parseWafPolicies, parseBastions, parseCertificates, parseCloudGuardTargets, parseCloudGuardDetectorRecipes, parseWaasPolicies, parseWaasCertificates } from './security.js';
export { parseLogGroups, parseLogs, parseAlarms, parseNotificationTopics, parseNotificationSubscriptions, parseEventsRules, parseEmailSenders } from './observability.js';
export { parseStreams, parseConnectHarnesses, parseServiceConnectors, parseQueues } from './messaging.js';
export { parseResourceManagerStacks, parseBudgets, parseQuotas, parseTagNamespaces, parseTagDefaults, parseTags } from './governance.js';
export { parseDevopsProjects, parseDevopsBuildPipelines, parseDevopsDeployPipelines, parseDevopsRepositories } from './devops.js';
export { parseHealthChecksHttp, parseHealthChecksPing, parseApmDomains, parseDrProtectionGroups, parseDrPlans } from './monitoring.js';

/** All supported explicit resource type strings. */
export const supportedTypes: string[] = Object.keys(parserMap);

/** Expose the detection function for testing / diagnostics. */
export { detectType };
