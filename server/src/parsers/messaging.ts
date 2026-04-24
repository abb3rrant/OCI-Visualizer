/**
 * Messaging resource parsers.
 *
 * Handles OCI CLI JSON output for:
 *   - Streams
 *   - Connect Harnesses
 *   - Service Connectors
 *   - Queues
 */

import { ParsedResource } from './index.js';
import { unwrap, str, tags, freeform, deepCamelCase } from './helpers.js';

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export function parseStreams(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'messaging/stream',
    displayName: str(item['name'] ?? item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      partitions: item['partitions'] ?? null,
      retentionInHours: item['retention-in-hours'] ?? null,
      streamPoolId: item['stream-pool-id'] ?? null,
      messagesEndpoint: item['messages-endpoint'] ?? null,
    }),
  }));
}

export function parseConnectHarnesses(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'messaging/connect-harness',
    displayName: str(item['name'] ?? item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({}),
  }));
}

export function parseServiceConnectors(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'messaging/service-connector',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      source: item['source'] ?? null,
      target: item['target'] ?? null,
      tasks: item['tasks'] ?? null,
      description: item['description'] ?? null,
    }),
  }));
}

export function parseQueues(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'messaging/queue',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      messagesEndpoint: item['messages-endpoint'] ?? null,
      retentionInSeconds: item['retention-in-seconds'] ?? null,
      visibilityInSeconds: item['visibility-in-seconds'] ?? null,
      timeoutInSeconds: item['timeout-in-seconds'] ?? null,
      deadLetterQueueDeliveryCount: item['dead-letter-queue-delivery-count'] ?? null,
      channelConsumptionLimit: item['channel-consumption-limit'] ?? null,
    }),
  }));
}
