/**
 * Storage resource parsers.
 *
 * Handles OCI CLI JSON output for:
 *   - Block Volumes
 *   - Boot Volumes
 *   - Volume Backups
 *   - Volume Groups
 *   - Buckets (Object Storage)
 *   - File Systems
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

export function parseBlockVolumes(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'storage/block-volume',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: str(item['availability-domain']),
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      sizeInGBs: item['size-in-gbs'] ?? null,
      sizeInMBs: item['size-in-mbs'] ?? null,
      vpusPerGB: item['vpus-per-gb'] ?? null,
      isAutoTuneEnabled: item['is-auto-tune-enabled'] ?? null,
      volumeGroupId: item['volume-group-id'] ?? null,
      sourceDetails: item['source-details'] ?? null,
      kmsKeyId: item['kms-key-id'] ?? null,
    }),
  }));
}

export function parseBootVolumes(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'storage/boot-volume',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: str(item['availability-domain']),
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      sizeInGBs: item['size-in-gbs'] ?? null,
      sizeInMBs: item['size-in-mbs'] ?? null,
      vpusPerGB: item['vpus-per-gb'] ?? null,
      imageId: item['image-id'] ?? null,
      isAutoTuneEnabled: item['is-auto-tune-enabled'] ?? null,
      volumeGroupId: item['volume-group-id'] ?? null,
      kmsKeyId: item['kms-key-id'] ?? null,
    }),
  }));
}

export function parseVolumeBackups(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'storage/volume-backup',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      volumeId: item['volume-id'] ?? null,
      type: item['type'] ?? null,
      sizeInGBs: item['size-in-gbs'] ?? null,
      sizeInMBs: item['size-in-mbs'] ?? null,
      uniqueSizeInGBs: item['unique-size-in-gbs'] ?? null,
      uniqueSizeInMBs: item['unique-size-in-mbs'] ?? null,
      sourceType: item['source-type'] ?? null,
      sourceVolumeBackupId: item['source-volume-backup-id'] ?? null,
      expirationTime: item['expiration-time'] ?? null,
    }),
  }));
}

export function parseVolumeGroups(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'storage/volume-group',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: str(item['availability-domain']),
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      volumeIds: item['volume-ids'] ?? null,
      sizeInGBs: item['size-in-gbs'] ?? null,
      sizeInMBs: item['size-in-mbs'] ?? null,
      sourceDetails: item['source-details'] ?? null,
    }),
  }));
}

export function parseFileSystems(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'storage/file-system',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: str(item['availability-domain']),
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      meteredBytes: item['metered-bytes'] ?? null,
      isCloneParent: item['is-clone-parent'] ?? null,
      isHydrated: item['is-hydrated'] ?? null,
      isTargetable: item['is-targetable'] ?? null,
      cloneCount: item['clone-count'] ?? null,
      cloneAttachStatus: item['clone-attach-status'] ?? null,
      filesystemSnapshotPolicyId: item['filesystem-snapshot-policy-id'] ?? null,
      replicationTargetId: item['replication-target-id'] ?? null,
      kmsKeyId: item['kms-key-id'] ?? null,
    }),
  }));
}

export function parseBuckets(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    // Bucket list output has no "id" field — use namespace/name as stable identifier
    ocid: item['id'] ?? item['ocid'] ?? `bucket://${item['namespace'] ?? ''}/${item['name'] ?? ''}`,
    resourceType: 'storage/bucket',
    displayName: str(item['name'] ?? item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      namespace: item['namespace'] ?? null,
      publicAccessType: item['public-access-type'] ?? null,
      storageTier: item['storage-tier'] ?? null,
      objectEventsEnabled: item['object-events-enabled'] ?? null,
      replicationEnabled: item['replication-enabled'] ?? null,
      isReadOnly: item['is-read-only'] ?? null,
      versioning: item['versioning'] ?? null,
      autoTiering: item['auto-tiering'] ?? null,
      etag: item['etag'] ?? null,
      createdBy: item['created-by'] ?? null,
    }),
  }));
}
