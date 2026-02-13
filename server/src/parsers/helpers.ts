/**
 * Shared helper functions for all OCI resource parsers.
 */

import { deepCamelCase } from '../utils/camelCase.js';

export { deepCamelCase };

/**
 * Unwrap the OCI CLI JSON envelope.
 * Handles: {"data": [...]}, {"data": {"items": [...]}}, {"data": {...}}, [...], {...}
 */
export function unwrap(json: any): any[] {
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

export function str(value: unknown): string | null {
  return value === undefined || value === null ? null : String(value);
}

export function tags(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' ? (value as Record<string, any>) : null;
}

export function freeform(value: unknown): Record<string, string> | null {
  return value && typeof value === 'object' ? (value as Record<string, string>) : null;
}

/**
 * Maximum length for any single string value stored in rawData.
 * Base64 blobs (cloud-init user_data, certificates, etc.) can be
 * hundreds of KB per instance — multiplied by 30k instances that
 * exceeds V8's string limit when JSON-stringified.
 */
const MAX_RAW_STRING_LENGTH = 1024;

/**
 * Recursively walk a value and truncate any string that exceeds
 * MAX_RAW_STRING_LENGTH.  This prevents enormous base64 blobs
 * (user_data, ssh keys, certificates) from bloating the DB and
 * crashing JSON.stringify on large exports.
 */
export function sanitizeRawData<T>(value: T): T {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    if (value.length > MAX_RAW_STRING_LENGTH) {
      return `${value.slice(0, MAX_RAW_STRING_LENGTH)}... (truncated, ${value.length} chars)` as unknown as T;
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeRawData) as unknown as T;
  }

  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) {
      out[k] = sanitizeRawData(v);
    }
    return out as T;
  }

  return value;
}
