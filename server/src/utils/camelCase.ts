/**
 * Recursively convert all object keys from kebab-case to camelCase.
 *
 * OCI CLI outputs JSON with kebab-case keys (e.g., "tcp-options",
 * "destination-port-range"). This utility normalizes them for consistent
 * access in TypeScript.
 */

function kebabToCamel(key: string): string {
  return key.replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase());
}

export function deepCamelCase(value: any): any {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(deepCamelCase);
  if (typeof value === 'object' && !(value instanceof Date)) {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      result[kebabToCamel(k)] = deepCamelCase(v);
    }
    return result;
  }
  return value;
}
