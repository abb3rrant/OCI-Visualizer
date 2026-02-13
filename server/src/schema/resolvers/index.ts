import { JSONResolver } from 'graphql-scalars';
import { authResolvers } from './auth.js';
import { resourceResolvers } from './resource.js';
import { importResolvers } from './import.js';
import { topologyResolvers } from './topology.js';
import { auditResolvers } from './audit.js';
import { snapshotResolvers } from './snapshot.js';
import { reachabilityResolvers } from './reachability.js';
import { diffResolvers } from './diff.js';

/**
 * Deep-merge all resolver maps into a single object.
 *
 * Each resolver file exports an object with top-level keys like Query,
 * Mutation, Resource, Snapshot, etc.  We merge them so that all Query
 * fields from every file end up in a single Query object, and likewise
 * for Mutation and any type-level resolvers.
 */
function mergeResolvers(...maps: Record<string, any>[]): Record<string, any> {
  const merged: Record<string, any> = {};

  for (const map of maps) {
    for (const [key, value] of Object.entries(map)) {
      if (merged[key] && typeof merged[key] === 'object' && typeof value === 'object') {
        merged[key] = { ...merged[key], ...value };
      } else {
        merged[key] = value;
      }
    }
  }

  return merged;
}

export const resolvers = mergeResolvers(
  { JSON: JSONResolver },
  authResolvers,
  resourceResolvers,
  importResolvers,
  topologyResolvers,
  auditResolvers,
  snapshotResolvers,
  reachabilityResolvers,
  diffResolvers,
);
