/**
 * Container / OKE resource parsers.
 *
 * Handles OCI CLI JSON output for:
 *   - OKE Clusters
 *   - Node Pools
 *   - Container Instances
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
