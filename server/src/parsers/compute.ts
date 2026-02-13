/**
 * Compute resource parsers.
 *
 * Handles OCI CLI JSON output for:
 *   - Instances
 *   - Images
 *   - VNIC Attachments
 *   - Boot Volume Attachments
 *   - Instance Configurations
 */

import { ParsedResource } from './index.js';
import { unwrap, str, tags, freeform, deepCamelCase } from './helpers.js';

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export function parseInstances(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'compute/instance',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: str(item['availability-domain']),
    regionKey: str(item['region']),
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      shape: item['shape'] ?? null,
      imageId: item['image-id'] ?? null,
      faultDomain: item['fault-domain'] ?? null,
      launchMode: item['launch-mode'] ?? null,
      shapeConfig: item['shape-config'] ?? null,
      sourceDetails: item['source-details'] ?? null,
      metadata: item['metadata'] ?? null,
      agentConfig: item['agent-config'] ?? null,
    }),
  }));
}

export function parseImages(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'compute/image',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: str(item['region']),
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      operatingSystem: item['operating-system'] ?? null,
      operatingSystemVersion: item['operating-system-version'] ?? null,
      sizeInMBs: item['size-in-mbs'] ?? null,
      baseImageId: item['base-image-id'] ?? null,
      createImageAllowed: item['create-image-allowed'] ?? null,
    }),
  }));
}

export function parseVnicAttachments(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'compute/vnic-attachment',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: str(item['availability-domain']),
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: null,
    freeformTags: null,
    rawData: deepCamelCase({
      instanceId: item['instance-id'] ?? null,
      vnicId: item['vnic-id'] ?? null,
      subnetId: item['subnet-id'] ?? null,
      nicIndex: item['nic-index'] ?? null,
    }),
  }));
}

export function parseBootVolumeAttachments(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'compute/boot-volume-attachment',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: str(item['availability-domain']),
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: null,
    freeformTags: null,
    rawData: deepCamelCase({
      instanceId: item['instance-id'] ?? null,
      bootVolumeId: item['boot-volume-id'] ?? null,
      isPvEncryptionInTransitEnabled: item['is-pv-encryption-in-transit-enabled'] ?? null,
    }),
  }));
}

export function parseInstanceConfigurations(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'compute/instance-configuration',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: null,
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({}),
  }));
}
