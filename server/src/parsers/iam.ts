/**
 * IAM resource parsers.
 *
 * Handles OCI CLI JSON output for:
 *   - Compartments
 *   - Users
 *   - Groups
 *   - Policies
 *   - Dynamic Groups
 *   - API Keys
 *   - Customer Secret Keys
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

export function parseCompartments(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'iam/compartment',
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
      isAccessible: item['is-accessible'] ?? null,
    }),
  }));
}

export function parseUsers(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'iam/user',
    displayName: str(item['name'] ?? item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      email: item['email'] ?? null,
      emailVerified: item['email-verified'] ?? null,
      description: item['description'] ?? null,
      identityProviderId: item['identity-provider-id'] ?? null,
      externalIdentifier: item['external-identifier'] ?? null,
      isMfaActivated: item['is-mfa-activated'] ?? null,
      capabilities: item['capabilities'] ?? null,
      lastSuccessfulLoginTime: item['last-successful-login-time'] ?? null,
    }),
  }));
}

export function parseGroups(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'iam/group',
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
    }),
  }));
}

export function parsePolicies(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'iam/policy',
    displayName: str(item['name'] ?? item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      statements: item['statements'] ?? null,
      description: item['description'] ?? null,
      versionDate: item['version-date'] ?? null,
    }),
  }));
}

export function parseDynamicGroups(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'iam/dynamic-group',
    displayName: str(item['name'] ?? item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      matchingRule: item['matching-rule'] ?? null,
      description: item['description'] ?? null,
    }),
  }));
}

export function parseApiKeys(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['key-id'] ?? item['id'] ?? item['ocid'] ?? '',
    resourceType: 'iam/api-key',
    displayName: str(item['fingerprint']),
    compartmentId: null,
    lifecycleState: str(item['lifecycle-state'] ?? item['state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: null,
    freeformTags: null,
    rawData: deepCamelCase({
      fingerprint: item['fingerprint'] ?? null,
      keyValue: item['key-value'] ?? null,
      userId: item['user-id'] ?? null,
    }),
  }));
}

export function parseCustomerSecretKeys(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'iam/customer-secret-key',
    displayName: str(item['display-name']),
    compartmentId: null,
    lifecycleState: str(item['lifecycle-state'] ?? item['state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: null,
    freeformTags: null,
    rawData: deepCamelCase({
      userId: item['user-id'] ?? null,
      timeExpires: item['time-expires'] ?? null,
      inactiveStatus: item['inactive-status'] ?? null,
    }),
  }));
}
