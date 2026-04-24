import { PrismaClient } from '@prisma/client';

interface ResourceRecord {
  id: string;
  ocid: string;
  resourceType: string;
  compartmentId: string | null;
  rawData: string | null;
}

interface RelationTuple {
  fromResourceId: string;
  toResourceId: string;
  relationType: string;
  metadata: string | null;
}

/**
 * Build all discoverable relationships between resources in a snapshot.
 *
 * This function inspects rawData on each resource and collects typed edges,
 * then batch-upserts them using prisma.$transaction() for performance.
 *
 * Returns the total number of relationships created.
 */
export async function buildRelationships(
  prisma: PrismaClient,
  snapshotId: string,
): Promise<number> {
  // Step 1: Load lightweight metadata (no rawData) for all resources
  // to build the OCID→ID lookup map.  Fetching rawData for 100k+ resources
  // in one query can exceed Prisma's napi string limit.
  const lightResources = await prisma.resource.findMany({
    where: { snapshotId },
    select: {
      id: true,
      ocid: true,
      resourceType: true,
      compartmentId: true,
    },
  });

  // Build a lookup map: OCID → resource DB id
  const ocidToId = new Map<string, string>();
  for (const r of lightResources) {
    ocidToId.set(r.ocid, r.id);
  }

  // Collect all relationship tuples first, then batch-upsert
  const tuples: RelationTuple[] = [];

  function addRelation(from: string, to: string, type: string, meta?: Record<string, any>) {
    if (!from || !to) return;
    tuples.push({
      fromResourceId: from,
      toResourceId: to,
      relationType: type,
      metadata: meta ? JSON.stringify(meta) : null,
    });
  }

  // Step 2: Process resources in chunks to avoid loading all rawData at once.
  // We need rawData to discover references, but only for the current chunk.
  const CHUNK_SIZE = 5000;
  for (let offset = 0; offset < lightResources.length; offset += CHUNK_SIZE) {
    const chunkIds = lightResources.slice(offset, offset + CHUNK_SIZE).map(r => r.id);
    const chunkResources = (await prisma.resource.findMany({
      where: { id: { in: chunkIds } },
      select: {
        id: true,
        ocid: true,
        resourceType: true,
        compartmentId: true,
        rawData: true,
      },
    })) as ResourceRecord[];

  for (const resource of chunkResources) {
    let rawData: Record<string, any> = {};
    if (resource.rawData) {
      try {
        rawData = JSON.parse(resource.rawData);
      } catch {
        continue;
      }
    }

    const resId = resource.id;
    const resType = resource.resourceType;

    // ---------------------------------------------------------------
    // Compartment "contains" — every resource belongs to a compartment
    // ---------------------------------------------------------------
    if (resource.compartmentId) {
      const compartmentDbId = ocidToId.get(resource.compartmentId);
      if (compartmentDbId && compartmentDbId !== resId) {
        addRelation(compartmentDbId, resId, 'contains');
      }
    }

    // ---------------------------------------------------------------
    // Compartment parent hierarchy
    // ---------------------------------------------------------------
    if (resType === 'iam/compartment' && resource.compartmentId) {
      const parentDbId = ocidToId.get(resource.compartmentId);
      if (parentDbId && parentDbId !== resId) {
        addRelation(parentDbId, resId, 'parent');
      }
    }

    // ---------------------------------------------------------------
    // VCN contains subnet
    // ---------------------------------------------------------------
    if (resType === 'network/subnet' && rawData.vcnId) {
      const vcnDbId = ocidToId.get(rawData.vcnId);
      if (vcnDbId) {
        addRelation(vcnDbId, resId, 'contains');
      }
    }

    // ---------------------------------------------------------------
    // Subnet membership — resources with subnetId or subnetIds
    // ---------------------------------------------------------------
    if (rawData.subnetId) {
      const subnetDbId = ocidToId.get(rawData.subnetId);
      if (subnetDbId) {
        addRelation(resId, subnetDbId, 'subnet-member');
      }
    }
    if (Array.isArray(rawData.subnetIds)) {
      for (const sid of rawData.subnetIds) {
        const subnetDbId = ocidToId.get(sid);
        if (subnetDbId) {
          addRelation(resId, subnetDbId, 'subnet-member');
        }
      }
    }

    // ---------------------------------------------------------------
    // Routes-via — subnet → route table
    // ---------------------------------------------------------------
    if (resType === 'network/subnet' && rawData.routeTableId) {
      const rtDbId = ocidToId.get(rawData.routeTableId);
      if (rtDbId) {
        addRelation(resId, rtDbId, 'routes-via');
      }
    }

    // ---------------------------------------------------------------
    // Secured-by — subnet → security lists
    // ---------------------------------------------------------------
    if (resType === 'network/subnet' && Array.isArray(rawData.securityListIds)) {
      for (const slId of rawData.securityListIds) {
        const slDbId = ocidToId.get(slId);
        if (slDbId) {
          addRelation(resId, slDbId, 'secured-by');
        }
      }
    }

    // ---------------------------------------------------------------
    // NSG membership — resources with nsgIds or networkSecurityGroupIds
    // ---------------------------------------------------------------
    const nsgIdList = rawData.nsgIds ?? rawData.networkSecurityGroupIds;
    if (Array.isArray(nsgIdList)) {
      for (const nsgId of nsgIdList) {
        const nsgDbId = ocidToId.get(nsgId);
        if (nsgDbId) {
          addRelation(resId, nsgDbId, 'nsg-member');
        }
      }
    }

    // ---------------------------------------------------------------
    // Volume-attached — boot/block volume attachments
    // ---------------------------------------------------------------
    if (
      (resType === 'compute/boot-volume-attachment' || resType === 'compute/volume-attachment') &&
      rawData.instanceId
    ) {
      const instanceDbId = ocidToId.get(rawData.instanceId);
      const volumeOcid = rawData.bootVolumeId || rawData.volumeId;
      const volumeDbId = volumeOcid ? ocidToId.get(volumeOcid) : undefined;

      if (instanceDbId && volumeDbId) {
        addRelation(instanceDbId, volumeDbId, 'volume-attached');
      }
    }

    // ---------------------------------------------------------------
    // LB backend — load balancer → backend instances
    // ---------------------------------------------------------------
    if (resType === 'network/load-balancer' && rawData.backendSets) {
      const backendSets =
        typeof rawData.backendSets === 'string'
          ? JSON.parse(rawData.backendSets)
          : rawData.backendSets;

      for (const bsName of Object.keys(backendSets)) {
        const bs = backendSets[bsName];
        if (Array.isArray(bs.backends)) {
          for (const backend of bs.backends) {
            const targetOcid = backend.instanceId || backend.targetId;
            if (targetOcid) {
              const targetDbId = ocidToId.get(targetOcid);
              if (targetDbId) {
                addRelation(resId, targetDbId, 'lb-backend', { backendSet: bsName });
              }
            }
          }
        }
      }
    }

    // ---------------------------------------------------------------
    // Gateway-for — gateways linked to a VCN
    // ---------------------------------------------------------------
    const gatewayTypes = [
      'network/internet-gateway',
      'network/nat-gateway',
      'network/service-gateway',
      'network/local-peering-gateway',
      'network/drg-attachment',
    ];
    if (gatewayTypes.includes(resType) && rawData.vcnId) {
      const vcnDbId = ocidToId.get(rawData.vcnId);
      if (vcnDbId) {
        addRelation(resId, vcnDbId, 'gateway-for');
      }
    }

    // ---------------------------------------------------------------
    // Peered-with — LPG ↔ peer LPG
    // ---------------------------------------------------------------
    if (resType === 'network/local-peering-gateway' && rawData.peerId) {
      const peerDbId = ocidToId.get(rawData.peerId);
      if (peerDbId && resId < peerDbId) {
        // Only create one direction (smaller ID → larger) to avoid duplicates
        addRelation(resId, peerDbId, 'peered-with');
      }
    }

    // ---------------------------------------------------------------
    // Runs-in — function → application
    // ---------------------------------------------------------------
    if (resType === 'serverless/function' && rawData.applicationId) {
      const appDbId = ocidToId.get(rawData.applicationId);
      if (appDbId) {
        addRelation(resId, appDbId, 'runs-in');
      }
    }

    // ---------------------------------------------------------------
    // Uses-vcn — OKE cluster → VCN
    // ---------------------------------------------------------------
    if (resType === 'container/cluster' && rawData.vcnId) {
      const vcnDbId = ocidToId.get(rawData.vcnId);
      if (vcnDbId) {
        addRelation(resId, vcnDbId, 'uses-vcn');
      }
    }

    // ---------------------------------------------------------------
    // Uses-image — instance → image
    // ---------------------------------------------------------------
    if (resType === 'compute/instance' && rawData.imageId) {
      const imageDbId = ocidToId.get(rawData.imageId);
      if (imageDbId) {
        addRelation(resId, imageDbId, 'uses-image');
      }
    }

    // ---------------------------------------------------------------
    // Node pool → cluster (member-of)
    // ---------------------------------------------------------------
    if (resType === 'container/node-pool' && rawData.clusterId) {
      const clusterDbId = ocidToId.get(rawData.clusterId);
      if (clusterDbId) {
        addRelation(resId, clusterDbId, 'member-of');
      }
    }

    // ---------------------------------------------------------------
    // Container image → repository (stored-in)
    // ---------------------------------------------------------------
    if (resType === 'container/container-image' && rawData.repositoryId) {
      const repoDbId = ocidToId.get(rawData.repositoryId);
      if (repoDbId) {
        addRelation(resId, repoDbId, 'stored-in');
      }
    }

    // ---------------------------------------------------------------
    // API deployment → gateway (deployed-to)
    // ---------------------------------------------------------------
    if (resType === 'serverless/api-deployment' && rawData.gatewayId) {
      const gwDbId = ocidToId.get(rawData.gatewayId);
      if (gwDbId) {
        addRelation(resId, gwDbId, 'deployed-to');
      }
    }

    // ---------------------------------------------------------------
    // DB home → DB system (member-of)
    // ---------------------------------------------------------------
    if (resType === 'database/db-home' && rawData.dbSystemId) {
      const dbSysDbId = ocidToId.get(rawData.dbSystemId);
      if (dbSysDbId) {
        addRelation(resId, dbSysDbId, 'member-of');
      }
    }

    // ---------------------------------------------------------------
    // Volume backup → volume (backup-of)
    // ---------------------------------------------------------------
    if (resType === 'storage/volume-backup' && rawData.volumeId) {
      const volDbId = ocidToId.get(rawData.volumeId);
      if (volDbId) {
        addRelation(resId, volDbId, 'backup-of');
      }
    }

    // ---------------------------------------------------------------
    // Volume group → volumes (groups)
    // ---------------------------------------------------------------
    if (resType === 'storage/volume-group' && Array.isArray(rawData.volumeIds)) {
      for (const vid of rawData.volumeIds) {
        const volDbId = ocidToId.get(vid);
        if (volDbId) {
          addRelation(resId, volDbId, 'groups');
        }
      }
    }

    // ---------------------------------------------------------------
    // Container instance → subnet (via vnics)
    // ---------------------------------------------------------------
    if (resType === 'container/container-instance' && Array.isArray(rawData.vnics)) {
      for (const vnic of rawData.vnics) {
        if (vnic?.subnetId) {
          const subnetDbId = ocidToId.get(vnic.subnetId);
          if (subnetDbId) {
            addRelation(resId, subnetDbId, 'subnet-member');
          }
        }
      }
    }

    // ---------------------------------------------------------------
    // Node pool → subnet (via nodeConfigDetails.placementConfigs)
    // ---------------------------------------------------------------
    if (resType === 'container/node-pool' && rawData.nodeConfigDetails?.placementConfigs) {
      const configs = rawData.nodeConfigDetails.placementConfigs;
      if (Array.isArray(configs)) {
        for (const pc of configs) {
          if (pc?.subnetId) {
            const subnetDbId = ocidToId.get(pc.subnetId);
            if (subnetDbId) {
              addRelation(resId, subnetDbId, 'subnet-member');
            }
          }
        }
      }
    }

    // ---------------------------------------------------------------
    // DRG attachment → DRG (attached-to)
    // ---------------------------------------------------------------
    if (resType === 'network/drg-attachment' && rawData.drgId) {
      const drgDbId = ocidToId.get(rawData.drgId);
      if (drgDbId) {
        addRelation(resId, drgDbId, 'attached-to');
      }
    }

    // ---------------------------------------------------------------
    // DRG attachment → VCN (gateway-for)
    // ---------------------------------------------------------------
    if (resType === 'network/drg-attachment' && rawData.vcnId) {
      const vcnDbId = ocidToId.get(rawData.vcnId);
      if (vcnDbId) {
        addRelation(resId, vcnDbId, 'gateway-for');
      }
    }

    // ---------------------------------------------------------------
    // NLB backend — network load balancer → backend instances
    // ---------------------------------------------------------------
    if (resType === 'network/network-load-balancer' && rawData.backendSets) {
      const backendSets =
        typeof rawData.backendSets === 'string'
          ? JSON.parse(rawData.backendSets)
          : rawData.backendSets;

      for (const bsName of Object.keys(backendSets)) {
        const bs = backendSets[bsName];
        if (Array.isArray(bs.backends)) {
          for (const backend of bs.backends) {
            const targetOcid = backend.instanceId || backend.targetId;
            if (targetOcid) {
              const targetDbId = ocidToId.get(targetOcid);
              if (targetDbId) {
                addRelation(resId, targetDbId, 'lb-backend', { backendSet: bsName });
              }
            }
          }
        }
      }
    }

    // ---------------------------------------------------------------
    // Secret → vault (stored-in)
    // ---------------------------------------------------------------
    if (resType === 'security/secret' && rawData.vaultId) {
      const vaultDbId = ocidToId.get(rawData.vaultId);
      if (vaultDbId) {
        addRelation(resId, vaultDbId, 'stored-in');
      }
    }

    // ---------------------------------------------------------------
    // Log → log group (member-of)
    // ---------------------------------------------------------------
    if (resType === 'observability/log' && rawData.logGroupId) {
      const lgDbId = ocidToId.get(rawData.logGroupId);
      if (lgDbId) {
        addRelation(resId, lgDbId, 'member-of');
      }
    }

    // ---------------------------------------------------------------
    // Image signature → container image (signs)
    // ---------------------------------------------------------------
    if (resType === 'container/image-signature' && rawData.imageId) {
      const imgDbId = ocidToId.get(rawData.imageId);
      if (imgDbId) {
        addRelation(resId, imgDbId, 'signs');
      }
    }

    // ---------------------------------------------------------------
    // User group membership → user belongs-to group
    // ---------------------------------------------------------------
    if (resType === 'iam/user-group-membership' && rawData.userId && rawData.groupId) {
      const userDbId = ocidToId.get(rawData.userId);
      const groupDbId = ocidToId.get(rawData.groupId);
      if (userDbId && groupDbId) {
        addRelation(userDbId, groupDbId, 'belongs-to');
      }
    }

    // ---------------------------------------------------------------
    // API key → user (belongs-to)
    // ---------------------------------------------------------------
    if (resType === 'iam/api-key' && rawData.userId) {
      const userDbId = ocidToId.get(rawData.userId);
      if (userDbId) {
        addRelation(resId, userDbId, 'belongs-to');
      }
    }

    // ---------------------------------------------------------------
    // Customer secret key → user (belongs-to)
    // ---------------------------------------------------------------
    if (resType === 'iam/customer-secret-key' && rawData.userId) {
      const userDbId = ocidToId.get(rawData.userId);
      if (userDbId) {
        addRelation(resId, userDbId, 'belongs-to');
      }
    }

    // ---------------------------------------------------------------
    // NSG rule → NSG (rule-of)
    // ---------------------------------------------------------------
    if (resType === 'network/nsg-rule' && rawData.networkSecurityGroupId) {
      const nsgDbId = ocidToId.get(rawData.networkSecurityGroupId);
      if (nsgDbId) {
        addRelation(resId, nsgDbId, 'rule-of');
      }
    }

    // ---------------------------------------------------------------
    // DRG route table → DRG (member-of)
    // ---------------------------------------------------------------
    if (resType === 'network/drg-route-table' && rawData.drgId) {
      const drgDbId = ocidToId.get(rawData.drgId);
      if (drgDbId) {
        addRelation(resId, drgDbId, 'member-of');
      }
    }

    // ---------------------------------------------------------------
    // DRG route rule → DRG route table (rule-of)
    // ---------------------------------------------------------------
    if (resType === 'network/drg-route-rule' && rawData.drgRouteTableId) {
      const rtDbId = ocidToId.get(rawData.drgRouteTableId);
      if (rtDbId) {
        addRelation(resId, rtDbId, 'rule-of');
      }
    }

    // ---------------------------------------------------------------
    // Public IP → assigned resource (assigned-to)
    // ---------------------------------------------------------------
    if (resType === 'network/public-ip' && rawData.assignedEntityId) {
      const targetDbId = ocidToId.get(rawData.assignedEntityId);
      if (targetDbId) {
        addRelation(resId, targetDbId, 'assigned-to');
      }
    }

    // ---------------------------------------------------------------
    // Mount target → subnet (subnet-member)
    // ---------------------------------------------------------------
    if (resType === 'storage/mount-target' && rawData.subnetId) {
      const subnetDbId = ocidToId.get(rawData.subnetId);
      if (subnetDbId) {
        addRelation(resId, subnetDbId, 'subnet-member');
      }
    }

    // ---------------------------------------------------------------
    // Mount target → file system (via export set — indirect; link NSGs)
    // ---------------------------------------------------------------
    if (resType === 'storage/mount-target' && Array.isArray(rawData.nsgIds)) {
      for (const nsgId of rawData.nsgIds) {
        const nsgDbId = ocidToId.get(nsgId);
        if (nsgDbId) {
          addRelation(resId, nsgDbId, 'nsg-member');
        }
      }
    }

    // ---------------------------------------------------------------
    // Instance pool → instance configuration (uses-config)
    // ---------------------------------------------------------------
    if (resType === 'compute/instance-pool' && rawData.instanceConfigurationId) {
      const configDbId = ocidToId.get(rawData.instanceConfigurationId);
      if (configDbId) {
        addRelation(resId, configDbId, 'uses-config');
      }
    }

    // ---------------------------------------------------------------
    // Instance pool → subnet (via placementConfigurations)
    // ---------------------------------------------------------------
    if (resType === 'compute/instance-pool' && Array.isArray(rawData.placementConfigurations)) {
      for (const pc of rawData.placementConfigurations) {
        if (pc?.primarySubnetId) {
          const subnetDbId = ocidToId.get(pc.primarySubnetId);
          if (subnetDbId) {
            addRelation(resId, subnetDbId, 'subnet-member');
          }
        }
      }
    }

    // ---------------------------------------------------------------
    // WAF → load balancer (protects)
    // ---------------------------------------------------------------
    if (resType === 'security/waf-policy' && rawData.loadBalancerId) {
      const lbDbId = ocidToId.get(rawData.loadBalancerId);
      if (lbDbId) {
        addRelation(resId, lbDbId, 'protects');
      }
    }

    // ---------------------------------------------------------------
    // Bastion → subnet (subnet-member)
    // ---------------------------------------------------------------
    if (resType === 'security/bastion' && rawData.targetSubnetId) {
      const subnetDbId = ocidToId.get(rawData.targetSubnetId);
      if (subnetDbId) {
        addRelation(resId, subnetDbId, 'subnet-member');
      }
    }

    // ---------------------------------------------------------------
    // Bastion → VCN (uses-vcn)
    // ---------------------------------------------------------------
    if (resType === 'security/bastion' && rawData.targetVcnId) {
      const vcnDbId = ocidToId.get(rawData.targetVcnId);
      if (vcnDbId) {
        addRelation(resId, vcnDbId, 'uses-vcn');
      }
    }

    // ---------------------------------------------------------------
    // Notification subscription → topic (subscribes-to)
    // ---------------------------------------------------------------
    if (resType === 'observability/notification-subscription' && rawData.topicId) {
      const topicDbId = ocidToId.get(rawData.topicId);
      if (topicDbId) {
        addRelation(resId, topicDbId, 'subscribes-to');
      }
    }

    // ---------------------------------------------------------------
    // Alarm → notification topics (notifies)
    // ---------------------------------------------------------------
    if (resType === 'observability/alarm' && Array.isArray(rawData.destinations)) {
      for (const destOcid of rawData.destinations) {
        if (typeof destOcid === 'string') {
          const topicDbId = ocidToId.get(destOcid);
          if (topicDbId) {
            addRelation(resId, topicDbId, 'notifies');
          }
        }
      }
    }

    // ---------------------------------------------------------------
    // Events rule → notification topics (notifies, via actions)
    // ---------------------------------------------------------------
    if (resType === 'observability/events-rule' && rawData.actions?.actions) {
      const actions = Array.isArray(rawData.actions.actions) ? rawData.actions.actions : [];
      for (const action of actions) {
        if (action?.topicId) {
          const topicDbId = ocidToId.get(action.topicId);
          if (topicDbId) {
            addRelation(resId, topicDbId, 'notifies');
          }
        }
      }
    }

    // ---------------------------------------------------------------
    // DB backup → DB system (backup-of)
    // ---------------------------------------------------------------
    if (resType === 'database/db-backup' && rawData.dbSystemId) {
      const dbSysDbId = ocidToId.get(rawData.dbSystemId);
      if (dbSysDbId) addRelation(resId, dbSysDbId, 'backup-of');
    }

    // ---------------------------------------------------------------
    // Autonomous DB backup → autonomous database (backup-of)
    // ---------------------------------------------------------------
    if (resType === 'database/autonomous-db-backup' && rawData.autonomousDatabaseId) {
      const adbDbId = ocidToId.get(rawData.autonomousDatabaseId);
      if (adbDbId) addRelation(resId, adbDbId, 'backup-of');
    }

    // ---------------------------------------------------------------
    // Database → DB home (member-of)
    // ---------------------------------------------------------------
    if (resType === 'database/database' && rawData.dbHomeId) {
      const homeDbId = ocidToId.get(rawData.dbHomeId);
      if (homeDbId) addRelation(resId, homeDbId, 'member-of');
    }

    // ---------------------------------------------------------------
    // Pluggable database → container database (member-of)
    // ---------------------------------------------------------------
    if (resType === 'database/pluggable-database' && rawData.containerDatabaseId) {
      const cdbDbId = ocidToId.get(rawData.containerDatabaseId);
      if (cdbDbId) addRelation(resId, cdbDbId, 'member-of');
    }

    // ---------------------------------------------------------------
    // DB node → DB system (member-of)
    // ---------------------------------------------------------------
    if (resType === 'database/db-node' && rawData.dbSystemId) {
      const dbSysDbId = ocidToId.get(rawData.dbSystemId);
      if (dbSysDbId) addRelation(resId, dbSysDbId, 'member-of');
    }

    // ---------------------------------------------------------------
    // Data guard association → database (protects)
    // ---------------------------------------------------------------
    if (resType === 'database/data-guard-association' && rawData.databaseId) {
      const dbDbId = ocidToId.get(rawData.databaseId);
      if (dbDbId) addRelation(resId, dbDbId, 'protects');
    }

    // ---------------------------------------------------------------
    // Cloud VM cluster → exadata infrastructure (runs-on)
    // ---------------------------------------------------------------
    if (resType === 'database/cloud-vm-cluster' && rawData.cloudExadataInfrastructureId) {
      const exaDbId = ocidToId.get(rawData.cloudExadataInfrastructureId);
      if (exaDbId) addRelation(resId, exaDbId, 'runs-on');
    }

    // ---------------------------------------------------------------
    // VLAN → VCN (contains)
    // ---------------------------------------------------------------
    if (resType === 'network/vlan' && rawData.vcnId) {
      const vcnDbId = ocidToId.get(rawData.vcnId);
      if (vcnDbId) addRelation(vcnDbId, resId, 'contains');
    }

    // ---------------------------------------------------------------
    // IPSec connection → DRG + CPE (attached-to)
    // ---------------------------------------------------------------
    if (resType === 'network/ipsec-connection') {
      if (rawData.drgId) {
        const drgDbId = ocidToId.get(rawData.drgId);
        if (drgDbId) addRelation(resId, drgDbId, 'attached-to');
      }
      if (rawData.cpeId) {
        const cpeDbId = ocidToId.get(rawData.cpeId);
        if (cpeDbId) addRelation(resId, cpeDbId, 'attached-to');
      }
    }

    // ---------------------------------------------------------------
    // Virtual circuit → cross-connect group (member-of)
    // ---------------------------------------------------------------
    if (resType === 'network/virtual-circuit' && rawData.crossConnectGroupId) {
      const ccgDbId = ocidToId.get(rawData.crossConnectGroupId);
      if (ccgDbId) addRelation(resId, ccgDbId, 'member-of');
    }

    // ---------------------------------------------------------------
    // Cross-connect → cross-connect group (member-of)
    // ---------------------------------------------------------------
    if (resType === 'network/cross-connect' && rawData.crossConnectGroupId) {
      const ccgDbId = ocidToId.get(rawData.crossConnectGroupId);
      if (ccgDbId) addRelation(resId, ccgDbId, 'member-of');
    }

    // ---------------------------------------------------------------
    // Remote peering connection → DRG (attached-to)
    // ---------------------------------------------------------------
    if (resType === 'network/remote-peering-connection' && rawData.drgId) {
      const drgDbId = ocidToId.get(rawData.drgId);
      if (drgDbId) addRelation(resId, drgDbId, 'attached-to');
    }

    // ---------------------------------------------------------------
    // Network firewall → subnet (subnet-member) + policy (uses-config)
    // ---------------------------------------------------------------
    if (resType === 'network/network-firewall') {
      if (rawData.subnetId) {
        const subDbId = ocidToId.get(rawData.subnetId);
        if (subDbId) addRelation(resId, subDbId, 'subnet-member');
      }
      if (rawData.networkFirewallPolicyId) {
        const polDbId = ocidToId.get(rawData.networkFirewallPolicyId);
        if (polDbId) addRelation(resId, polDbId, 'uses-config');
      }
    }

    // ---------------------------------------------------------------
    // Volume attachment → instance + block volume (attached-to)
    // ---------------------------------------------------------------
    if (resType === 'compute/volume-attachment') {
      if (rawData.instanceId) {
        const instDbId = ocidToId.get(rawData.instanceId);
        if (instDbId) addRelation(resId, instDbId, 'attached-to');
      }
      if (rawData.volumeId) {
        const volDbId = ocidToId.get(rawData.volumeId);
        if (volDbId) addRelation(resId, volDbId, 'attached-to');
      }
    }

    // ---------------------------------------------------------------
    // Autoscaling config → instance pool (manages)
    // ---------------------------------------------------------------
    if (resType === 'compute/autoscaling-config' && rawData.resource?.id) {
      const poolDbId = ocidToId.get(rawData.resource.id);
      if (poolDbId) addRelation(resId, poolDbId, 'manages');
    }

    // ---------------------------------------------------------------
    // Auth token / SMTP credential → user (belongs-to)
    // ---------------------------------------------------------------
    if ((resType === 'iam/auth-token' || resType === 'iam/smtp-credential') && rawData.userId) {
      const userDbId = ocidToId.get(rawData.userId);
      if (userDbId) addRelation(resId, userDbId, 'belongs-to');
    }

    // ---------------------------------------------------------------
    // DevOps build/deploy pipeline/repository → project (member-of)
    // ---------------------------------------------------------------
    if ((resType === 'devops/build-pipeline' || resType === 'devops/deploy-pipeline' || resType === 'devops/repository') && rawData.projectId) {
      const projDbId = ocidToId.get(rawData.projectId);
      if (projDbId) addRelation(resId, projDbId, 'member-of');
    }

    // ---------------------------------------------------------------
    // Cloud guard target → compartment (protects)
    // ---------------------------------------------------------------
    if (resType === 'security/cloud-guard-target' && rawData.targetResourceId) {
      const targetDbId = ocidToId.get(rawData.targetResourceId);
      if (targetDbId) addRelation(resId, targetDbId, 'protects');
    }

    // ---------------------------------------------------------------
    // DRG route distribution → DRG (member-of)
    // ---------------------------------------------------------------
    if (resType === 'network/drg-route-distribution' && rawData.drgId) {
      const drgDbId = ocidToId.get(rawData.drgId);
      if (drgDbId) addRelation(resId, drgDbId, 'member-of');
    }

    // ---------------------------------------------------------------
    // PostgreSQL backup → DB system (backup-of)
    // ---------------------------------------------------------------
    if (resType === 'database/psql-backup' && rawData.dbSystemId) {
      const dbSysDbId = ocidToId.get(rawData.dbSystemId);
      if (dbSysDbId) addRelation(resId, dbSysDbId, 'backup-of');
    }

    // ---------------------------------------------------------------
    // DR protection group → peer (peered-with)
    // ---------------------------------------------------------------
    if (resType === 'security/dr-protection-group' && rawData.peerId) {
      const peerDbId = ocidToId.get(rawData.peerId);
      if (peerDbId && resId < peerDbId) {
        addRelation(resId, peerDbId, 'peered-with');
      }
    }

    // ---------------------------------------------------------------
    // DR plan → DR protection group (member-of)
    // ---------------------------------------------------------------
    if (resType === 'security/dr-plan' && rawData.drProtectionGroupId) {
      const pgDbId = ocidToId.get(rawData.drProtectionGroupId);
      if (pgDbId) addRelation(resId, pgDbId, 'member-of');
    }

    // ---------------------------------------------------------------
    // Notification subscription → topic (subscribes-to) — already above
    // Tag → tag namespace (member-of)
    // ---------------------------------------------------------------
    if (resType === 'iam/tag' && rawData.tagNamespaceId) {
      const nsDbId = ocidToId.get(rawData.tagNamespaceId);
      if (nsDbId) addRelation(resId, nsDbId, 'member-of');
    }
  }
  } // end chunk loop

  // Deduplicate tuples
  const seen = new Set<string>();
  const uniqueTuples: RelationTuple[] = [];
  for (const t of tuples) {
    const key = `${t.fromResourceId}|${t.toResourceId}|${t.relationType}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueTuples.push(t);
    }
  }

  // Batch upsert in chunks
  const BATCH_SIZE = 2000;
  let created = 0;

  for (let i = 0; i < uniqueTuples.length; i += BATCH_SIZE) {
    const chunk = uniqueTuples.slice(i, i + BATCH_SIZE);
    const ops = chunk.map(t =>
      prisma.resourceRelation.upsert({
        where: {
          fromResourceId_toResourceId_relationType: {
            fromResourceId: t.fromResourceId,
            toResourceId: t.toResourceId,
            relationType: t.relationType,
          },
        },
        update: { metadata: t.metadata },
        create: {
          fromResourceId: t.fromResourceId,
          toResourceId: t.toResourceId,
          relationType: t.relationType,
          metadata: t.metadata,
        },
      }),
    );

    try {
      await prisma.$transaction(ops);
      created += chunk.length;
    } catch {
      // Fallback: try individually to isolate failures
      for (const t of chunk) {
        try {
          await prisma.resourceRelation.upsert({
            where: {
              fromResourceId_toResourceId_relationType: {
                fromResourceId: t.fromResourceId,
                toResourceId: t.toResourceId,
                relationType: t.relationType,
              },
            },
            update: { metadata: t.metadata },
            create: {
              fromResourceId: t.fromResourceId,
              toResourceId: t.toResourceId,
              relationType: t.relationType,
              metadata: t.metadata,
            },
          });
          created++;
        } catch {
          // Skip gracefully — the referenced resource may not exist in this snapshot
        }
      }
    }
  }

  return created;
}
