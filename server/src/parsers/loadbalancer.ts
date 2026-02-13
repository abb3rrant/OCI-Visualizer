/**
 * Load Balancer resource parsers.
 *
 * Handles OCI CLI JSON output for:
 *   - Load Balancers
 *   - Network Load Balancers
 */

import { ParsedResource } from './index.js';
import { unwrap, str, tags, freeform, deepCamelCase } from './helpers.js';

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export function parseLoadBalancers(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/load-balancer',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      subnetIds: item['subnet-ids'] ?? null,
      backendSets: item['backend-sets'] ?? null,
      listeners: item['listeners'] ?? null,
      shapeName: item['shape-name'] ?? null,
      shapeDetails: item['shape-details'] ?? null,
      ipAddresses: item['ip-addresses'] ?? null,
      isPrivate: item['is-private'] ?? null,
      networkSecurityGroupIds: item['network-security-group-ids'] ?? null,
      certificates: item['certificates'] ?? null,
      sslCipherSuites: item['ssl-cipher-suites'] ?? null,
      pathRouteSets: item['path-route-sets'] ?? null,
      routingPolicies: item['routing-policies'] ?? null,
      ruleSets: item['rule-sets'] ?? null,
    }),
  }));
}

export function parseNetworkLoadBalancers(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'network/network-load-balancer',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      subnetId: item['subnet-id'] ?? null,
      backendSets: item['backend-sets'] ?? null,
      listeners: item['listeners'] ?? null,
      ipAddresses: item['ip-addresses'] ?? null,
      isPrivate: item['is-private'] ?? null,
      isPreserveSourceDestination: item['is-preserve-source-destination'] ?? null,
      isSymmetricHashEnabled: item['is-symmetric-hash-enabled'] ?? null,
      nlbIpVersion: item['nlb-ip-version'] ?? null,
      networkSecurityGroupIds: item['network-security-group-ids'] ?? null,
    }),
  }));
}
