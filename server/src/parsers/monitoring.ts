/**
 * Monitoring & Disaster Recovery resource parsers.
 *
 * Handles OCI CLI JSON output for:
 *   - Health Checks HTTP
 *   - Health Checks Ping
 *   - APM Domains
 *   - DR Protection Groups
 *   - DR Plans
 */

import { ParsedResource } from './index.js';
import { unwrap, str, tags, freeform, deepCamelCase } from './helpers.js';

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export function parseHealthChecksHttp(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'monitoring/health-check-http',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      protocol: item['protocol'] ?? null,
      targets: item['targets'] ?? null,
      port: item['port'] ?? null,
      path: item['path'] ?? null,
      method: item['method'] ?? null,
      intervalInSeconds: item['interval-in-seconds'] ?? null,
      isEnabled: item['is-enabled'] ?? null,
      homeRegion: item['home-region'] ?? null,
    }),
  }));
}

export function parseHealthChecksPing(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'monitoring/health-check-ping',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      protocol: item['protocol'] ?? null,
      targets: item['targets'] ?? null,
      port: item['port'] ?? null,
      intervalInSeconds: item['interval-in-seconds'] ?? null,
      isEnabled: item['is-enabled'] ?? null,
      homeRegion: item['home-region'] ?? null,
    }),
  }));
}

export function parseApmDomains(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'monitoring/apm-domain',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      description: item['description'] ?? null,
      dataUploadEndpoint: item['data-upload-endpoint'] ?? null,
      isFreeTier: item['is-free-tier'] ?? null,
    }),
  }));
}

export function parseDrProtectionGroups(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'security/dr-protection-group',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      role: item['role'] ?? null,
      peerId: item['peer-id'] ?? null,
      peerRegion: item['peer-region'] ?? null,
      members: item['members'] ?? null,
    }),
  }));
}

export function parseDrPlans(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'security/dr-plan',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      drProtectionGroupId: item['dr-protection-group-id'] ?? null,
      peerDrProtectionGroupId: item['peer-dr-protection-group-id'] ?? null,
      peerRegion: item['peer-region'] ?? null,
      type: item['type'] ?? null,
      planGroups: item['plan-groups'] ?? null,
    }),
  }));
}
