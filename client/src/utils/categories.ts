import type { ResourceCount } from '../types';

export interface Category {
  key: string;
  label: string;
}

export interface CategoryGroup {
  label: string;
  types: ResourceCount[];
}

export const CATEGORIES: Category[] = [
  { key: 'compute', label: 'Compute' },
  { key: 'network', label: 'Network' },
  { key: 'database', label: 'Database' },
  { key: 'storage', label: 'Storage' },
  { key: 'container', label: 'Containers' },
  { key: 'serverless', label: 'Serverless' },
  { key: 'iam', label: 'Identity & Access' },
  { key: 'security', label: 'Security' },
  { key: 'observability', label: 'Observability' },
  { key: 'dns', label: 'DNS' },
];

const categoryKeyToLabel = new Map(CATEGORIES.map((c) => [c.key, c.label]));

export function groupCountsByCategory(
  counts: ResourceCount[],
): Map<string, CategoryGroup> {
  const groups = new Map<string, CategoryGroup>();

  for (const c of counts) {
    const key = c.resourceType.split('/')[0] || 'unknown';
    const existing = groups.get(key);
    if (existing) {
      existing.types.push(c);
    } else {
      groups.set(key, {
        label: categoryKeyToLabel.get(key) || key.charAt(0).toUpperCase() + key.slice(1),
        types: [c],
      });
    }
  }

  // Sort types within each group alphabetically
  for (const group of groups.values()) {
    group.types.sort((a, b) => a.resourceType.localeCompare(b.resourceType));
  }

  return groups;
}
