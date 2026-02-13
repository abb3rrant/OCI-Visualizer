/**
 * Generic/fallback parser for unrecognised OCI CLI JSON output.
 *
 * When auto-detection cannot identify a specific resource type, this
 * parser extracts common OCI fields and infers a resource type from
 * the OCID prefix (e.g. "ocid1.vcn.oc1..." -> "generic/vcn").
 *
 * This ensures ANY OCI CLI "list" output can be imported, even for
 * services that don't have a dedicated parser.
 */

import { ParsedResource } from './index.js';
import { deepCamelCase } from '../utils/camelCase.js';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function unwrap(json: any): any[] {
  if (json && json.data !== undefined && json.data !== null) {
    if (Array.isArray(json.data)) return json.data;
    if (typeof json.data === 'object') return [json.data];
  }
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

/**
 * Extract a resource type slug from an OCID string.
 * OCI OCIDs follow the pattern: ocid1.<resource-type>.<realm>.<region>.<unique>
 */
function typeFromOcid(ocid: string): string {
  if (!ocid || !ocid.startsWith('ocid1.')) return 'unknown';
  const parts = ocid.split('.');
  return parts.length >= 2 ? parts[1] : 'unknown';
}

/**
 * Generate a stable synthetic OCID for resources that don't have one
 * (e.g. bucket list output uses name+namespace, not OCID).
 */
function syntheticOcid(item: any, index: number): string {
  // Try to build a meaningful identifier from common fields
  const name = item['name'] ?? item['display-name'] ?? '';
  const namespace = item['namespace'] ?? '';
  const compartment = item['compartment-id'] ?? '';

  if (name) {
    const key = `${namespace}/${compartment}/${name}`;
    const hash = createHash('sha256').update(key).digest('hex').slice(0, 16);
    return `synthetic.${hash}`;
  }

  // Last resort: hash the entire item
  const hash = createHash('sha256').update(JSON.stringify(item) + index).digest('hex').slice(0, 16);
  return `synthetic.${hash}`;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export function parseGeneric(json: any): ParsedResource[] {
  const items = unwrap(json);
  if (items.length === 0) return [];

  const results: ParsedResource[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    // Get OCID or generate a synthetic one
    let ocid = item['id'] ?? item['ocid'] ?? '';
    if (!ocid) {
      ocid = syntheticOcid(item, i);
    }

    const ocidType = typeFromOcid(ocid);
    const resourceType = `generic/${ocidType}`;

    // Build rawData from all fields, converting kebab-case to camelCase
    const rawData = deepCamelCase(item);

    results.push({
      ocid,
      resourceType,
      displayName: str(item['display-name'] ?? item['name'] ?? item['display_name']),
      compartmentId: str(item['compartment-id'] ?? item['compartment_id']),
      lifecycleState: str(item['lifecycle-state'] ?? item['lifecycle_state'] ?? item['status']),
      availabilityDomain: str(item['availability-domain'] ?? item['availability_domain']),
      regionKey: str(item['region']),
      timeCreated: str(item['time-created'] ?? item['time_created']),
      definedTags: tags(item['defined-tags'] ?? item['defined_tags']),
      freeformTags: freeform(item['freeform-tags'] ?? item['freeform_tags']),
      rawData,
    });
  }

  return results;
}
