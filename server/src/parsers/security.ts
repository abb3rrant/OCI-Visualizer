/**
 * Security resource parsers.
 *
 * Handles OCI CLI JSON output for:
 *   - Vaults
 *   - Secrets
 *   - Container Scan Results
 */

import { ParsedResource } from './index.js';
import { unwrap, str, tags, freeform, deepCamelCase } from './helpers.js';

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
