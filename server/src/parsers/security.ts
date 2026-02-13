/**
 * Security resource parsers.
 *
 * Handles OCI CLI JSON output for:
 *   - Vaults
 *   - Secrets
 *   - Container Scan Results
 */

import { ParsedResource } from './index.js';
import { deepCamelCase } from '../utils/camelCase.js';

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

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export function parseVaults(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'security/vault',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      vaultType: item['vault-type'] ?? null,
      cryptoEndpoint: item['crypto-endpoint'] ?? null,
      managementEndpoint: item['management-endpoint'] ?? null,
      externalKeyManagerMetadataSummary: item['external-key-manager-metadata-summary'] ?? null,
    }),
  }));
}

export function parseSecrets(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'security/secret',
    displayName: str(item['display-name'] ?? item['secret-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      secretName: item['secret-name'] ?? null,
      vaultId: item['vault-id'] ?? null,
      keyId: item['key-id'] ?? null,
      description: item['description'] ?? null,
      timeOfCurrentVersionExpiry: item['time-of-current-version-expiry'] ?? null,
      timeOfDeletion: item['time-of-deletion'] ?? null,
      lastRotationTime: item['last-rotation-time'] ?? null,
      nextRotationTime: item['next-rotation-time'] ?? null,
      rotationConfig: item['rotation-config'] ?? null,
      rotationStatus: item['rotation-status'] ?? null,
      isAutoGenerationEnabled: item['is-auto-generation-enabled'] ?? null,
    }),
  }));
}

export function parseContainerScanResults(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'security/container-scan-result',
    displayName: str(item['display-name'] ?? ((item['repository'] ?? '') + ':' + (item['image'] ?? ''))),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-started'] ?? item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      repository: item['repository'] ?? null,
      image: item['image'] ?? null,
      containerScanTargetId: item['container-scan-target-id'] ?? null,
      highestProblemSeverity: item['highest-problem-severity'] ?? null,
      problemCount: item['problem-count'] ?? null,
      timeStarted: item['time-started'] ?? null,
      timeFinished: item['time-finished'] ?? null,
    }),
  }));
}
