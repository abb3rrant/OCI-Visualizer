/**
 * Database resource parsers.
 *
 * Handles OCI CLI JSON output for:
 *   - DB Systems
 *   - Autonomous Databases
 *   - DB Homes
 *   - MySQL DB Systems
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

export function parseDbSystems(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'database/db-system',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: str(item['availability-domain']),
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      shape: item['shape'] ?? null,
      subnetId: item['subnet-id'] ?? null,
      hostname: item['hostname'] ?? null,
      cpuCoreCount: item['cpu-core-count'] ?? null,
      dataStorageSizeInGBs: item['data-storage-size-in-gbs'] ?? null,
      databaseEdition: item['database-edition'] ?? null,
      diskRedundancy: item['disk-redundancy'] ?? null,
      nodeCount: item['node-count'] ?? null,
      licenseModel: item['license-model'] ?? null,
      dbVersion: item['version'] ?? null,
    }),
  }));
}

export function parseAutonomousDatabases(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'database/autonomous-database',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      dbName: item['db-name'] ?? null,
      dbWorkload: item['db-workload'] ?? null,
      dbVersion: item['db-version'] ?? null,
      cpuCoreCount: item['cpu-core-count'] ?? null,
      dataStorageSizeInTBs: item['data-storage-size-in-tbs'] ?? null,
      isAutoScalingEnabled: item['is-auto-scaling-enabled'] ?? null,
      isDedicated: item['is-dedicated'] ?? null,
      isFreeTier: item['is-free-tier'] ?? null,
      licenseModel: item['license-model'] ?? null,
      connectionStrings: item['connection-strings'] ?? null,
      subnetId: item['subnet-id'] ?? null,
      nsgIds: item['nsg-ids'] ?? null,
    }),
  }));
}

export function parseMysqlDbSystems(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'database/mysql-db-system',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: str(item['availability-domain']),
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      mysqlVersion: item['mysql-version'] ?? null,
      shapeName: item['shape-name'] ?? null,
      subnetId: item['subnet-id'] ?? null,
      configurationId: item['configuration-id'] ?? null,
      isHeatWaveClusterAttached: item['is-heat-wave-cluster-attached'] ?? null,
      isHighlyAvailable: item['is-highly-available'] ?? null,
      port: item['port'] ?? null,
      portX: item['port-x'] ?? null,
      ipAddress: item['ip-address'] ?? null,
      hostnameLabel: item['hostname-label'] ?? null,
      dataStorageSizeInGBs: item['data-storage-size-in-gbs'] ?? null,
      endpoints: item['endpoints'] ?? null,
      crashRecovery: item['crash-recovery'] ?? null,
      databaseManagement: item['database-management'] ?? null,
      nsgIds: item['nsg-ids'] ?? null,
    }),
  }));
}

export function parseDbHomes(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'database/db-home',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      dbSystemId: item['db-system-id'] ?? null,
      dbVersion: item['db-version'] ?? null,
      lastPatchHistoryEntryId: item['last-patch-history-entry-id'] ?? null,
    }),
  }));
}
