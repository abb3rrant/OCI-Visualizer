/**
 * Governance resource parsers.
 *
 * Handles OCI CLI JSON output for:
 *   - Resource Manager Stacks
 *   - Budgets
 *   - Quotas
 *   - Tag Namespaces
 *   - Tag Defaults
 *   - Tags
 */

import { ParsedResource } from './index.js';
import { unwrap, str, tags, freeform, deepCamelCase } from './helpers.js';

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export function parseResourceManagerStacks(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'governance/resource-manager-stack',
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
      terraformVersion: item['terraform-version'] ?? null,
      stackDriftStatus: item['stack-drift-status'] ?? null,
    }),
  }));
}

export function parseBudgets(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'governance/budget',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      amount: item['amount'] ?? null,
      resetPeriod: item['reset-period'] ?? null,
      targetType: item['target-type'] ?? null,
      targets: item['targets'] ?? null,
      actualSpend: item['actual-spend'] ?? null,
      forecastedSpend: item['forecasted-spend'] ?? null,
      alertRuleCount: item['alert-rule-count'] ?? null,
      description: item['description'] ?? null,
    }),
  }));
}

export function parseQuotas(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'governance/quota',
    displayName: str(item['name'] ?? item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      description: item['description'] ?? null,
      statements: item['statements'] ?? null,
    }),
  }));
}

export function parseTagNamespaces(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'iam/tag-namespace',
    displayName: str(item['name'] ?? item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      description: item['description'] ?? null,
      isRetired: item['is-retired'] ?? null,
    }),
  }));
}

export function parseTagDefaults(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'iam/tag-default',
    displayName: str(item['tag-definition-name'] ?? item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: null,
    freeformTags: null,
    rawData: deepCamelCase({
      tagNamespaceId: item['tag-namespace-id'] ?? null,
      tagDefinitionId: item['tag-definition-id'] ?? null,
      tagDefinitionName: item['tag-definition-name'] ?? null,
      value: item['value'] ?? null,
      isRequired: item['is-required'] ?? null,
    }),
  }));
}

export function parseTags(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'iam/tag',
    displayName: str(item['name'] ?? item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      tagNamespaceId: item['tag-namespace-id'] ?? null,
      description: item['description'] ?? null,
      isRetired: item['is-retired'] ?? null,
      isCostTracking: item['is-cost-tracking'] ?? null,
      type: item['type'] ?? null,
      validator: item['validator'] ?? null,
    }),
  }));
}
