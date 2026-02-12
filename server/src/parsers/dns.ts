/**
 * DNS resource parsers.
 *
 * Handles OCI CLI JSON output for:
 *   - DNS Zones
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
