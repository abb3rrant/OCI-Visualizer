/**
 * Load Balancer resource parsers.
 *
 * Handles OCI CLI JSON output for:
 *   - Load Balancers
 */

import { ParsedResource } from './index.js';
import { deepCamelCase } from '../utils/camelCase.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function unwrap(json: any): any[] {
  if (json && Array.isArray(json.data)) return json.data;
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') return [json];
  return [];
}

function str(value: unknown): string | null {
  return value === undefined || value === null ? null : String(value);
}

function tags(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' ? (value as Record<string, any>) : null;
}

function freeform(value: unknown): Record<string, string> | null {
  return value && typeof value === 'object' ? (value as Record<string, string>) : null;
}

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
