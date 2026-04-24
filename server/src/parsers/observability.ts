/**
 * Observability resource parsers.
 *
 * Handles OCI CLI JSON output for:
 *   - Log Groups
 *   - Logs
 *   - Alarms
 *   - Notification Topics
 *   - Notification Subscriptions
 *   - Events Rules
 *   - Email Senders
 */

import { ParsedResource } from './index.js';
import { unwrap, str, tags, freeform, deepCamelCase } from './helpers.js';

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export function parseLogGroups(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'observability/log-group',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      description: item['description'] ?? null,
      timeLastModified: item['time-last-modified'] ?? null,
    }),
  }));
}

export function parseLogs(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'observability/log',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      logGroupId: item['log-group-id'] ?? null,
      logType: item['log-type'] ?? null,
      configuration: item['configuration'] ?? null,
      isEnabled: item['is-enabled'] ?? null,
      retentionDuration: item['retention-duration'] ?? null,
      timeLastModified: item['time-last-modified'] ?? null,
    }),
  }));
}

export function parseAlarms(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'observability/alarm',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      metricCompartmentId: item['metric-compartment-id'] ?? null,
      namespace: item['namespace'] ?? null,
      query: item['query'] ?? null,
      severity: item['severity'] ?? null,
      isEnabled: item['is-enabled'] ?? null,
      destinations: item['destinations'] ?? null,
    }),
  }));
}

export function parseNotificationTopics(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['topic-id'] ?? item['topicId'] ?? item['id'] ?? '',
    resourceType: 'observability/notification-topic',
    displayName: str(item['name'] ?? item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      apiEndpoint: item['api-endpoint'] ?? null,
      description: item['description'] ?? null,
      shortTopicId: item['short-topic-id'] ?? null,
    }),
  }));
}

export function parseNotificationSubscriptions(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'observability/notification-subscription',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['created-time'] ?? item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      topicId: item['topic-id'] ?? null,
      protocol: item['protocol'] ?? null,
      endpoint: item['endpoint'] ?? null,
      deliveryPolicy: item['delivery-policy'] ?? null,
    }),
  }));
}

export function parseEventsRules(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'observability/events-rule',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      condition: item['condition'] ?? null,
      actions: item['actions'] ?? null,
      isEnabled: item['is-enabled'] ?? null,
      description: item['description'] ?? null,
    }),
  }));
}

export function parseEmailSenders(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'observability/email-sender',
    displayName: str(item['email-address'] ?? item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      emailAddress: item['email-address'] ?? null,
      isSpf: item['is-spf'] ?? null,
      emailDomainId: item['email-domain-id'] ?? null,
    }),
  }));
}
