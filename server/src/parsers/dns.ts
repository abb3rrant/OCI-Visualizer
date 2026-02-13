/**
 * DNS resource parsers.
 *
 * Handles OCI CLI JSON output for:
 *   - DNS Zones
 */

import { ParsedResource } from './index.js';
import { unwrap, str, tags, freeform, deepCamelCase } from './helpers.js';

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export function parseDnsZones(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'dns/zone',
    displayName: str(item['name'] ?? item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      zoneType: item['zone-type'] ?? null,
      name: item['name'] ?? null,
      serial: item['serial'] ?? null,
      version: item['version'] ?? null,
      scope: item['scope'] ?? null,
      selfUri: item['self'] ?? null,
      isProtected: item['is-protected'] ?? null,
      nameservers: item['nameservers'] ?? null,
      externalMasters: item['external-masters'] ?? null,
      viewId: item['view-id'] ?? null,
    }),
  }));
}
