/**
 * Database resource parsers.
 *
 * Handles OCI CLI JSON output for:
 *   - DB Systems
 *   - Autonomous Databases
 *   - DB Homes
 *   - MySQL DB Systems
 *   - NoSQL Tables
 *   - DB Backups
 *   - Autonomous DB Backups
 *   - Autonomous Container Databases
 *   - Databases
 *   - Pluggable Databases
 *   - DB Nodes
 *   - Exadata Infrastructures
 *   - Cloud VM Clusters
 *   - Cloud Exa Infras
 *   - DB Software Images
 *   - DB Key Stores
 *   - Maintenance Runs
 *   - Data Guard Associations
 *   - Redis Clusters
 *   - OpenSearch Clusters
 *   - PostgreSQL DB Systems
 *   - PostgreSQL Backups
 */

import { ParsedResource } from './index.js';
import { unwrap, str, tags, freeform, deepCamelCase } from './helpers.js';

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

export function parseNoSqlTables(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'database/nosql-table',
    displayName: str(item['name'] ?? item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      tableLimits: item['table-limits'] ?? null,
      ddlStatement: item['ddl-statement'] ?? null,
      schema: item['schema'] ?? null,
      timeUpdated: item['time-updated'] ?? null,
    }),
  }));
}

export function parseDbBackups(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'database/db-backup',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: str(item['availability-domain']),
    regionKey: null,
    timeCreated: str(item['time-started'] ?? item['time-created']),
    definedTags: null,
    freeformTags: null,
    rawData: deepCamelCase({
      databaseId: item['database-id'] ?? null,
      dbSystemId: item['db-system-id'] ?? null,
      type: item['type'] ?? null,
      databaseSizeInGBs: item['database-size-in-gbs'] ?? null,
      timeEnded: item['time-ended'] ?? null,
    }),
  }));
}

export function parseAutonomousDbBackups(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'database/autonomous-db-backup',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-started'] ?? item['time-created']),
    definedTags: null,
    freeformTags: null,
    rawData: deepCamelCase({
      autonomousDatabaseId: item['autonomous-database-id'] ?? null,
      type: item['type'] ?? null,
      isAutomatic: item['is-automatic'] ?? null,
      databaseSizeInTBs: item['database-size-in-tbs'] ?? null,
      timeEnded: item['time-ended'] ?? null,
    }),
  }));
}

export function parseAutonomousContainerDatabases(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'database/autonomous-container-database',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: str(item['availability-domain']),
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      autonomousExadataInfrastructureId: item['autonomous-exadata-infrastructure-id'] ?? null,
      cloudAutonomousVmClusterId: item['cloud-autonomous-vm-cluster-id'] ?? null,
      patchModel: item['patch-model'] ?? null,
      serviceLevel: item['service-level-agreement-type'] ?? null,
      dbVersion: item['db-version'] ?? null,
    }),
  }));
}

export function parseDatabases(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'database/database',
    displayName: str(item['db-name'] ?? item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      dbHomeId: item['db-home-id'] ?? null,
      dbName: item['db-name'] ?? null,
      dbUniqueName: item['db-unique-name'] ?? null,
      dbWorkload: item['db-workload'] ?? null,
      characterSet: item['character-set'] ?? null,
      ncharacterSet: item['ncharacter-set'] ?? null,
      pdbName: item['pdb-name'] ?? null,
    }),
  }));
}

export function parsePluggableDatabases(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'database/pluggable-database',
    displayName: str(item['pdb-name'] ?? item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      containerDatabaseId: item['container-database-id'] ?? null,
      pdbName: item['pdb-name'] ?? null,
      openMode: item['open-mode'] ?? null,
      isRestricted: item['is-restricted'] ?? null,
    }),
  }));
}

export function parseDbNodes(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'database/db-node',
    displayName: str(item['hostname'] ?? item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: null,
    freeformTags: null,
    rawData: deepCamelCase({
      dbSystemId: item['db-system-id'] ?? null,
      hostname: item['hostname'] ?? null,
      vnicId: item['vnic-id'] ?? null,
      backupVnicId: item['backup-vnic-id'] ?? null,
      faultDomain: item['fault-domain'] ?? null,
      cpuCoreCount: item['cpu-core-count'] ?? null,
      memorySizeInGBs: item['memory-size-in-gbs'] ?? null,
      softwareStorageSizeInGB: item['software-storage-size-in-gb'] ?? null,
    }),
  }));
}

export function parseExadataInfrastructures(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'database/exadata-infrastructure',
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
      computeCount: item['compute-count'] ?? null,
      storageCount: item['storage-count'] ?? null,
      cpusEnabled: item['cpus-enabled'] ?? null,
      maxCpuCount: item['max-cpu-count'] ?? null,
      memorySizeInGBs: item['memory-size-in-gbs'] ?? null,
      maxMemoryInGBs: item['max-memory-in-gbs'] ?? null,
      dbNodeStorageSizeInGBs: item['db-node-storage-size-in-gbs'] ?? null,
      dataStorageSizeInTBs: item['data-storage-size-in-tbs'] ?? null,
    }),
  }));
}

export function parseCloudVmClusters(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'database/cloud-vm-cluster',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: str(item['availability-domain']),
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      cloudExadataInfrastructureId: item['cloud-exadata-infrastructure-id'] ?? null,
      subnetId: item['subnet-id'] ?? null,
      hostname: item['hostname'] ?? null,
      cpuCoreCount: item['cpu-core-count'] ?? null,
      nodeCount: item['node-count'] ?? null,
      shape: item['shape'] ?? null,
      giVersion: item['gi-version'] ?? null,
      licenseModel: item['license-model'] ?? null,
    }),
  }));
}

export function parseCloudExaInfras(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'database/cloud-exa-infra',
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
      computeCount: item['compute-count'] ?? null,
      storageCount: item['storage-count'] ?? null,
      totalStorageSizeInGBs: item['total-storage-size-in-gbs'] ?? null,
      availableStorageSizeInGBs: item['available-storage-size-in-gbs'] ?? null,
      cpuCount: item['cpu-count'] ?? null,
      maxCpuCount: item['max-cpu-count'] ?? null,
    }),
  }));
}

export function parseDbSoftwareImages(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'database/db-software-image',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      databaseVersion: item['database-version'] ?? null,
      imageType: item['image-type'] ?? null,
      imageShapeFamily: item['image-shape-family'] ?? null,
      patchSet: item['patch-set'] ?? null,
      isUpgradeSupported: item['is-upgrade-supported'] ?? null,
    }),
  }));
}

export function parseDbKeyStores(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'database/db-key-store',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      typeDetails: item['type-details'] ?? null,
      associatedDatabases: item['associated-databases'] ?? null,
    }),
  }));
}

export function parseMaintenanceRuns(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'database/maintenance-run',
    displayName: str(item['display-name'] ?? item['description']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-scheduled'] ?? item['time-created']),
    definedTags: null,
    freeformTags: null,
    rawData: deepCamelCase({
      targetResourceId: item['target-resource-id'] ?? null,
      targetResourceType: item['target-resource-type'] ?? null,
      maintenanceType: item['maintenance-type'] ?? null,
      maintenanceSubtype: item['maintenance-subtype'] ?? null,
      patchingMode: item['patching-mode'] ?? null,
      timeScheduled: item['time-scheduled'] ?? null,
      timeStarted: item['time-started'] ?? null,
      timeEnded: item['time-ended'] ?? null,
    }),
  }));
}

export function parseDataGuardAssociations(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'database/data-guard-association',
    displayName: str(item['display-name'] ?? `DataGuard-${(item['id'] ?? '').slice(-8)}`),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: null,
    freeformTags: null,
    rawData: deepCamelCase({
      databaseId: item['database-id'] ?? null,
      peerDatabaseId: item['peer-database-id'] ?? null,
      peerDbSystemId: item['peer-db-system-id'] ?? null,
      peerDbHomeId: item['peer-db-home-id'] ?? null,
      role: item['role'] ?? null,
      peerRole: item['peer-role'] ?? null,
      protectionMode: item['protection-mode'] ?? null,
      transportType: item['transport-type'] ?? null,
      applyLag: item['apply-lag'] ?? null,
      applyRate: item['apply-rate'] ?? null,
    }),
  }));
}

export function parseRedisClusters(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'database/redis-cluster',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      subnetId: item['subnet-id'] ?? null,
      nodeCount: item['node-count'] ?? null,
      nodeMemoryInGBs: item['node-memory-in-gbs'] ?? null,
      softwareVersion: item['software-version'] ?? null,
      primaryEndpoint: item['primary-endpoint'] ?? null,
      primaryFqdn: item['primary-fqdn'] ?? null,
      replicasEndpoint: item['replicas-endpoint'] ?? null,
      replicasFqdn: item['replicas-fqdn'] ?? null,
      nsgIds: item['nsg-ids'] ?? null,
    }),
  }));
}

export function parseOpensearchClusters(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'database/opensearch-cluster',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      subnetId: item['subnet-id'] ?? null,
      softwareVersion: item['software-version'] ?? null,
      totalStorageGB: item['total-storage-gb'] ?? null,
      masterNodeCount: item['master-node-count'] ?? null,
      dataNodeCount: item['data-node-count'] ?? null,
      opendashboardNodeCount: item['opendashboard-node-count'] ?? null,
      vcnId: item['vcn-id'] ?? null,
      opensearchFqdn: item['opensearch-fqdn'] ?? null,
      opendashboardFqdn: item['opendashboard-fqdn'] ?? null,
      nsgIds: item['nsg-ids'] ?? null,
    }),
  }));
}

export function parsePsqlDbSystems(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'database/psql-db-system',
    displayName: str(item['display-name']),
    compartmentId: str(item['compartment-id']),
    lifecycleState: str(item['lifecycle-state']),
    availabilityDomain: null,
    regionKey: null,
    timeCreated: str(item['time-created']),
    definedTags: tags(item['defined-tags']),
    freeformTags: freeform(item['freeform-tags']),
    rawData: deepCamelCase({
      dbVersion: item['db-version'] ?? null,
      shape: item['shape'] ?? null,
      instanceCount: item['instance-count'] ?? null,
      storageDetails: item['storage-details'] ?? null,
      networkDetails: item['network-details'] ?? null,
      adminUsername: item['admin-username'] ?? null,
      configId: item['config-id'] ?? null,
    }),
  }));
}

export function parsePsqlBackups(json: any): ParsedResource[] {
  return unwrap(json).map((item: any) => ({
    ocid: item['id'] ?? item['ocid'] ?? '',
    resourceType: 'database/psql-backup',
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
      sourceType: item['source-type'] ?? null,
      backupSize: item['backup-size'] ?? null,
      retentionPeriod: item['retention-period'] ?? null,
      timeUpdated: item['time-updated'] ?? null,
    }),
  }));
}
