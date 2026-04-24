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

const MAX_DEPTH = 50;

export function deepCamelCase(value: any): any {
  const seen = new WeakSet();

  function recurse(val: any, depth: number): any {
    if (val === null || val === undefined) return val;
    if (Array.isArray(val)) {
      if (depth >= MAX_DEPTH) return [];
      return val.map(item => recurse(item, depth + 1));
    }
    if (typeof val === 'object' && !(val instanceof Date)) {
      if (seen.has(val) || depth >= MAX_DEPTH) return {};
      seen.add(val);
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(val)) {
        result[kebabToCamel(k)] = recurse(v, depth + 1);
      }
      return result;
    }
    return val;
  }

  return recurse(value, 0);
}
