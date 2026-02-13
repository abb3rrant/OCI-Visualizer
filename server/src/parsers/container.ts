/**
 * Container / OKE resource parsers.
 *
 * Handles OCI CLI JSON output for:
 *   - OKE Clusters
 *   - Node Pools
 *   - Container Instances
 *   - Container Repositories
 *   - Container Images
 *   - Container Image Signatures
 */

import { ParsedResource } from './index.js';
import { deepCamelCase } from '../utils/camelCase.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function unwrap(json: any): any[] {
  if (json && json.data !== undefined && json.data !== null) {
    if (Array.isArray(json.data)) return json.data;
    // Handle paginated collection responses: {"data": {"items": [...]}}
    if (typeof json.data === 'object' && Array.isArray(json.data.items)) return json.data.items;
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

export function parseOkeClusters(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'container/cluster',
    displayName: str(item['name'] ?? item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      vcnId: item['vcn-id'] ?? null,
      kubernetesVersion: item['kubernetes-version'] ?? null,
      endpointConfig: item['endpoint-config'] ?? null,
      options: item['options'] ?? null,
      endpoints: item['endpoints'] ?? null,
      metadata: item['metadata'] ?? null,
      clusterPodNetworkOptions: item['cluster-pod-network-options'] ?? null,
      type: item['type'] ?? null,
    }),
  }));
}

export function parseNodePools(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'container/node-pool',
    displayName: str(item['name'] ?? item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      clusterId: item['cluster-id'] ?? null,
      subnetIds: item['subnet-ids'] ?? null,
      kubernetesVersion: item['kubernetes-version'] ?? null,
      nodeShape: item['node-shape'] ?? null,
      nodeShapeConfig: item['node-shape-config'] ?? null,
      nodeSourceDetails: item['node-source-details'] ?? null,
      nodeConfigDetails: item['node-config-details'] ?? null,
      quantityPerSubnet: item['quantity-per-subnet'] ?? null,
      sshPublicKey: item['ssh-public-key'] ?? null,
      initialNodeLabels: item['initial-node-labels'] ?? null,
    }),
  }));
}

export function parseContainerInstances(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'container/container-instance',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: str(item['availability-domain']),
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      containerId: item['container-id'] ?? null,
      containers: item['containers'] ?? null,
      shape: item['shape'] ?? null,
      shapeConfig: item['shape-config'] ?? null,
      vnics: item['vnics'] ?? null,
      volumes: item['volumes'] ?? null,
      containerCount: item['container-count'] ?? null,
      gracefulShutdownTimeoutInSeconds:
        item['graceful-shutdown-timeout-in-seconds'] ?? null,
      containerRestartPolicy: item['container-restart-policy'] ?? null,
      faultDomain: item['fault-domain'] ?? null,
    }),
  }));
}

export function parseContainerRepositories(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'container/container-repository',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      namespace: item['namespace'] ?? null,
      imageCount: item['image-count'] ?? null,
      isImmutable: item['is-immutable'] ?? null,
      isPublic: item['is-public'] ?? null,
      layerCount: item['layer-count'] ?? null,
      layersSizeInBytes: item['layers-size-in-bytes'] ?? null,
      billableSizeInGbs: item['billable-size-in-gbs'] ?? null,
      createdBy: item['created-by'] ?? null,
    }),
  }));
}

export function parseContainerImages(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'container/container-image',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      repositoryId: item['repository-id'] ?? null,
      repositoryName: item['repository-name'] ?? null,
      digest: item['digest'] ?? null,
      manifestSizeInBytes: item['manifest-size-in-bytes'] ?? null,
      layersSizeInBytes: item['layers-size-in-bytes'] ?? null,
      versions: item['versions'] ?? null,
      createdBy: item['created-by'] ?? null,
    }),
  }));
}

export function parseContainerImageSignatures(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'container/image-signature',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      imageId: item['image-id'] ?? null,
      kmsKeyId: item['kms-key-id'] ?? null,
      kmsKeyVersionId: item['kms-key-version-id'] ?? null,
      signingAlgorithm: item['signing-algorithm'] ?? null,
      signature: item['signature'] ?? null,
      message: item['message'] ?? null,
    }),
  }));
}
