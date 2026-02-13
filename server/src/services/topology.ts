import { PrismaClient } from '@prisma/client';

export interface TopologyNode {
  id: string;
  type: string;
  label: string;
  resourceType: string;
  ocid: string;
  lifecycleState: string | null;
  metadata: Record<string, any> | null;
  parentNode: string | null;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  label: string | null;
  relationType: string;
  animated: boolean;
}

export interface TopologyResult {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  totalCount: number;
  truncated: boolean;
}

const MAX_TOPOLOGY_NODES = 2000;

// ---------------------------------------------------------------
// Resource-type to React Flow node-type mapping
// ---------------------------------------------------------------

const RESOURCE_TYPE_TO_NODE_TYPE: Record<string, string> = {
  // Compute
  'compute/instance': 'instanceNode',
  'compute/image': 'instanceNode',
  'compute/vnic-attachment': 'instanceNode',
  'compute/boot-volume-attachment': 'instanceNode',
  // Network
  'network/vcn': 'vcnNode',
  'network/subnet': 'subnetNode',
  'network/load-balancer': 'loadBalancerNode',
  'network/network-load-balancer': 'loadBalancerNode',
  'network/internet-gateway': 'gatewayNode',
  'network/nat-gateway': 'gatewayNode',
  'network/service-gateway': 'gatewayNode',
  'network/local-peering-gateway': 'gatewayNode',
  'network/drg': 'gatewayNode',
  'network/drg-attachment': 'gatewayNode',
  'network/nsg': 'securityNode',
  'network/security-list': 'securityNode',
  'network/route-table': 'securityNode',
  'network/dhcp-options': 'securityNode',
  // Database
  'database/db-system': 'databaseNode',
  'database/autonomous-database': 'databaseNode',
  'database/mysql-db-system': 'databaseNode',
  'database/db-home': 'databaseNode',
  // Storage
  'storage/block-volume': 'storageNode',
  'storage/boot-volume': 'storageNode',
  'storage/volume-backup': 'storageNode',
  'storage/volume-group': 'storageNode',
  'storage/bucket': 'storageNode',
  'storage/file-system': 'storageNode',
  // Container / OKE
  'container/cluster': 'containerNode',
  'container/node-pool': 'containerNode',
  'container/container-instance': 'containerNode',
  'container/container-repository': 'containerNode',
  'container/container-image': 'containerNode',
  // Serverless
  'serverless/application': 'serverlessNode',
  'serverless/function': 'serverlessNode',
  'serverless/api-gateway': 'serverlessNode',
  'serverless/api-deployment': 'serverlessNode',
  // IAM
  'iam/compartment': 'compartmentNode',
  'iam/user': 'iamNode',
  'iam/group': 'iamNode',
  'iam/policy': 'iamNode',
  'iam/dynamic-group': 'iamNode',
  'iam/api-key': 'iamNode',
  'iam/customer-secret-key': 'iamNode',
  // DNS
  'dns/zone': 'gatewayNode',
  // Compute (continued)
  'compute/instance-configuration': 'instanceNode',
  // Security
  'security/vault': 'securityNode',
  'security/secret': 'securityNode',
  'security/container-scan-result': 'securityNode',
  // Observability
  'observability/log-group': 'genericNode',
  'observability/log': 'genericNode',
  // Container (continued)
  'container/image-signature': 'containerNode',
};

function nodeTypeFor(resourceType: string): string {
  if (RESOURCE_TYPE_TO_NODE_TYPE[resourceType]) {
    return RESOURCE_TYPE_TO_NODE_TYPE[resourceType];
  }
  if (resourceType.startsWith('compute/')) return 'instanceNode';
  if (resourceType.startsWith('container/')) return 'containerNode';
  if (resourceType.startsWith('serverless/')) return 'serverlessNode';
  if (resourceType.startsWith('iam/')) return 'iamNode';
  if (resourceType.startsWith('database/')) return 'databaseNode';
  if (resourceType.startsWith('storage/')) return 'storageNode';
  if (resourceType.startsWith('dns/')) return 'gatewayNode';
  if (resourceType.startsWith('security/')) return 'securityNode';
  if (resourceType.startsWith('observability/')) return 'genericNode';
  if (resourceType.endsWith('-gateway') || resourceType === 'network/drg') return 'gatewayNode';
  return 'genericNode';
}

// ---------------------------------------------------------------
// Network-view resource type whitelist
// ---------------------------------------------------------------

const NETWORK_VIEW_TYPES = new Set([
  'network/vcn',
  'network/subnet',
  'compute/instance',
  'database/db-system',
  'database/autonomous-database',
  'database/mysql-db-system',
  'network/load-balancer',
  'network/network-load-balancer',
  'network/internet-gateway',
  'network/nat-gateway',
  'network/service-gateway',
  'network/local-peering-gateway',
  'network/drg',
  'network/drg-attachment',
  'container/cluster',
  'container/node-pool',
  'container/container-instance',
  'serverless/application',
  'serverless/api-gateway',
]);

/** Network-view types that are NOT compute/instance (queried separately) */
const INFRA_NETWORK_TYPES = Array.from(NETWORK_VIEW_TYPES).filter(t => t !== 'compute/instance');

/** Priority for capping non-instance resources — lower = more important */
const INFRA_PRIORITY: Record<string, number> = {
  'network/vcn': 0,
  'network/subnet': 1,
  'network/internet-gateway': 2,
  'network/nat-gateway': 2,
  'network/service-gateway': 2,
  'network/local-peering-gateway': 2,
  'network/drg': 2,
  'network/drg-attachment': 2,
  'network/load-balancer': 3,
  'network/network-load-balancer': 3,
  'database/db-system': 4,
  'database/autonomous-database': 4,
  'database/mysql-db-system': 4,
  'container/cluster': 4,
  'container/node-pool': 5,
  'container/container-instance': 5,
  'serverless/application': 5,
  'serverless/api-gateway': 5,
};

/** Chunk size for IN queries to stay within SQLite's 999-parameter limit */
const DB_CHUNK = 500;

type ResourceMeta = {
  id: string;
  ocid: string;
  resourceType: string;
  displayName: string | null;
  lifecycleState: string | null;
  compartmentId: string | null;
};

// ---------------------------------------------------------------
// Shared: BFS child-compartment traversal (O(n) using parent map)
// ---------------------------------------------------------------

/**
 * Given a compartmentId, return the set of that OCID plus all descendant
 * compartment OCIDs found in the snapshot.  Returns null when no filter
 * is needed (compartmentId was null).
 */
async function getDescendantCompartmentOcids(
  prisma: PrismaClient,
  snapshotId: string,
  compartmentId: string | null,
): Promise<Set<string> | null> {
  if (!compartmentId) return null;

  const compartments = await prisma.resource.findMany({
    where: { snapshotId, resourceType: 'iam/compartment' },
    select: { ocid: true, compartmentId: true },
  });

  // Build parent → children map for O(n) BFS instead of O(n²)
  const childrenMap = new Map<string, string[]>();
  for (const c of compartments) {
    if (c.compartmentId) {
      let children = childrenMap.get(c.compartmentId);
      if (!children) {
        children = [];
        childrenMap.set(c.compartmentId, children);
      }
      children.push(c.ocid);
    }
  }

  const result = new Set<string>([compartmentId]);
  const queue = [compartmentId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = childrenMap.get(current);
    if (children) {
      for (const childOcid of children) {
        if (!result.has(childOcid)) {
          result.add(childOcid);
          queue.push(childOcid);
        }
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------

/**
 * Build a topology graph suitable for rendering with React Flow.
 *
 * @param prisma        - Prisma client instance
 * @param snapshotId    - Snapshot to query
 * @param compartmentId - Optional compartment filter
 * @param viewType      - NETWORK, COMPARTMENT, or DEPENDENCY
 */
export async function buildTopology(
  prisma: PrismaClient,
  snapshotId: string,
  compartmentId: string | null,
  viewType: 'NETWORK' | 'COMPARTMENT' | 'DEPENDENCY' | 'EXPOSURE',
): Promise<TopologyResult> {
  switch (viewType) {
    case 'NETWORK':
      return buildNetworkView(prisma, snapshotId, compartmentId);
    case 'COMPARTMENT':
      return buildCompartmentView(prisma, snapshotId, compartmentId);
    case 'DEPENDENCY':
      return buildDependencyView(prisma, snapshotId, compartmentId);
    case 'EXPOSURE':
      return buildExposureView(prisma, snapshotId, compartmentId);
    default:
      return { nodes: [], edges: [], totalCount: 0, truncated: false };
  }
}

// ---------------------------------------------------------------
// NETWORK view
// ---------------------------------------------------------------

async function buildNetworkView(
  prisma: PrismaClient,
  snapshotId: string,
  compartmentId: string | null,
): Promise<TopologyResult> {
  const descendantOcids = await getDescendantCompartmentOcids(prisma, snapshotId, compartmentId);

  const whereClause: Record<string, any> = { snapshotId };
  if (descendantOcids) {
    whereClause.compartmentId = { in: Array.from(descendantOcids) };
  }

  // ── Phase 1: Query infrastructure and instances SEPARATELY ──
  // Never load all 139k resources — push type filter to the DB.

  const infraResources: ResourceMeta[] = await prisma.resource.findMany({
    where: { ...whereClause, resourceType: { in: INFRA_NETWORK_TYPES } },
    select: {
      id: true, ocid: true, resourceType: true,
      displayName: true, lifecycleState: true, compartmentId: true,
    },
  });

  const instanceCount: number = await prisma.resource.count({
    where: { ...whereClause, resourceType: 'compute/instance' },
  });

  const totalCount = infraResources.length + instanceCount;
  const collapseInstances = totalCount > MAX_TOPOLOGY_NODES && instanceCount > 0;

  // ── Phase 2: Determine which resources get individual nodes ──

  let capped: ResourceMeta[];
  let instances: ResourceMeta[] = [];
  let truncated = false;

  if (collapseInstances) {
    // Priority-sort infra so VCNs and subnets survive the cap
    infraResources.sort(
      (a, b) => (INFRA_PRIORITY[a.resourceType] ?? 9) - (INFRA_PRIORITY[b.resourceType] ?? 9),
    );
    if (infraResources.length > MAX_TOPOLOGY_NODES) {
      capped = infraResources.slice(0, MAX_TOPOLOGY_NODES);
      truncated = true;
    } else {
      capped = infraResources;
    }
  } else {
    // Small enough — load instances individually
    instances = await prisma.resource.findMany({
      where: { ...whereClause, resourceType: 'compute/instance' },
      select: {
        id: true, ocid: true, resourceType: true,
        displayName: true, lifecycleState: true, compartmentId: true,
      },
    });
    const all = [...infraResources, ...instances];
    if (all.length > MAX_TOPOLOGY_NODES) {
      capped = all.slice(0, MAX_TOPOLOGY_NODES);
      truncated = true;
    } else {
      capped = all;
    }
  }

  // Build OCID→id map for parent resolution
  const ocidToDbId = new Map<string, string>();
  for (const r of capped) {
    ocidToDbId.set(r.ocid, r.id);
  }

  // ── Phase 3: Load rawData for capped resources (chunked for SQLite) ──

  const rawDataMap = new Map<string, string | null>();
  const cappedIds = capped.map(r => r.id);
  for (let i = 0; i < cappedIds.length; i += DB_CHUNK) {
    const chunk = cappedIds.slice(i, i + DB_CHUNK);
    const rows = await prisma.resource.findMany({
      where: { id: { in: chunk } },
      select: { id: true, rawData: true },
    });
    for (const row of rows) {
      rawDataMap.set(row.id, row.rawData);
    }
  }

  // ── Phase 4: Load VNIC attachments for subnet placement ──

  const vnicAttachments = await prisma.resource.findMany({
    where: { snapshotId, resourceType: 'compute/vnic-attachment' },
    select: { rawData: true },
  });

  const instanceToSubnetOcid = new Map<string, string>();
  for (const va of vnicAttachments) {
    if (!va.rawData) continue;
    try {
      const raw = JSON.parse(va.rawData as string);
      if (raw.instanceId && raw.subnetId) {
        if (!instanceToSubnetOcid.has(raw.instanceId)) {
          instanceToSubnetOcid.set(raw.instanceId, raw.subnetId);
        }
      }
    } catch {
      // ignore
    }
  }

  // ── Phase 5: Parse rawData to determine parent relationships ──

  const resourceVcnMap = new Map<string, string>(); // resource DB id → parent DB id
  const subnetVcnMap = new Map<string, string>();   // subnet DB id → VCN DB id

  for (const r of capped) {
    const rawStr = rawDataMap.get(r.id);
    let rawData: Record<string, any> = {};
    if (rawStr) {
      try { rawData = JSON.parse(rawStr as string); } catch { /* ignore */ }
    }

    if (r.resourceType === 'network/subnet' && rawData.vcnId) {
      const vcnDbId = ocidToDbId.get(rawData.vcnId);
      if (vcnDbId) subnetVcnMap.set(r.id, vcnDbId);
    }

    // Compute instances (only present when NOT collapsed)
    if (r.resourceType === 'compute/instance') {
      const subnetOcid = instanceToSubnetOcid.get(r.ocid);
      if (subnetOcid) {
        const subDbId = ocidToDbId.get(subnetOcid);
        if (subDbId) { resourceVcnMap.set(r.id, subDbId); continue; }
      }
    }

    if (rawData.subnetId && !resourceVcnMap.has(r.id)) {
      const subDbId = ocidToDbId.get(rawData.subnetId);
      if (subDbId) resourceVcnMap.set(r.id, subDbId);
    }

    if (Array.isArray(rawData.subnetIds) && rawData.subnetIds.length > 0 && !resourceVcnMap.has(r.id)) {
      const subDbId = ocidToDbId.get(rawData.subnetIds[0]);
      if (subDbId) resourceVcnMap.set(r.id, subDbId);
    }

    if (r.resourceType === 'container/container-instance' && Array.isArray(rawData.vnics) && rawData.vnics[0]?.subnetId) {
      if (!resourceVcnMap.has(r.id)) {
        const subDbId = ocidToDbId.get(rawData.vnics[0].subnetId);
        if (subDbId) resourceVcnMap.set(r.id, subDbId);
      }
    }

    if (r.resourceType === 'container/node-pool' && rawData.nodeConfigDetails?.placementConfigs) {
      const configs = rawData.nodeConfigDetails.placementConfigs;
      if (Array.isArray(configs) && configs[0]?.subnetId && !resourceVcnMap.has(r.id)) {
        const subDbId = ocidToDbId.get(configs[0].subnetId);
        if (subDbId) resourceVcnMap.set(r.id, subDbId);
      }
    }

    if (rawData.vcnId && r.resourceType !== 'network/subnet' && r.resourceType !== 'network/drg') {
      const vcnDbId = ocidToDbId.get(rawData.vcnId);
      if (vcnDbId && !resourceVcnMap.has(r.id)) resourceVcnMap.set(r.id, vcnDbId);
    }
  }

  // ── Phase 6: Build summary nodes when instances are collapsed ──

  const summaryNodes: TopologyNode[] = [];
  if (collapseInstances) {
    // Load only the OCID for each in-scope instance (minimal data)
    const instanceOcids: string[] = [];
    let cursor: string | undefined;
    while (true) {
      const batch: { id: string; ocid: string }[] = await prisma.resource.findMany({
        where: { ...whereClause, resourceType: 'compute/instance' },
        select: { id: true, ocid: true },
        take: 5000,
        orderBy: { id: 'asc' },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (batch.length === 0) break;
      for (const b of batch) instanceOcids.push(b.ocid);
      cursor = batch[batch.length - 1].id;
      if (batch.length < 5000) break;
    }

    // Build subnet OCID → DB id map (reverse of ocidToDbId, filtered to subnets)
    const subnetOcidToDbId = new Map<string, string>();
    for (const r of capped) {
      if (r.resourceType === 'network/subnet') subnetOcidToDbId.set(r.ocid, r.id);
    }

    // Build subnet OCID → VCN DB id map
    const subnetOcidToVcnDbId = new Map<string, string>();
    for (const [subDbId, vcnDbId] of subnetVcnMap) {
      const sub = capped.find(r => r.id === subDbId);
      if (sub) subnetOcidToVcnDbId.set(sub.ocid, vcnDbId);
    }

    // Count instances per placement
    const perSubnet = new Map<string, number>();
    const perVcn = new Map<string, number>();
    let unplacedCount = 0;

    for (const instOcid of instanceOcids) {
      const subnetOcid = instanceToSubnetOcid.get(instOcid);
      if (subnetOcid) {
        const subDbId = subnetOcidToDbId.get(subnetOcid);
        if (subDbId) {
          perSubnet.set(subDbId, (perSubnet.get(subDbId) || 0) + 1);
          continue;
        }
        const vcnDbId = subnetOcidToVcnDbId.get(subnetOcid);
        if (vcnDbId) {
          perVcn.set(vcnDbId, (perVcn.get(vcnDbId) || 0) + 1);
          continue;
        }
      }
      unplacedCount++;
    }

    for (const [subDbId, count] of perSubnet) {
      summaryNodes.push({
        id: `summary-instances-${subDbId}`,
        type: 'instanceSummaryNode',
        label: `${count} instance${count !== 1 ? 's' : ''}`,
        resourceType: 'compute/instance',
        ocid: '',
        lifecycleState: null,
        metadata: { instanceCount: count },
        parentNode: subDbId,
      });
    }

    for (const [vcnDbId, count] of perVcn) {
      summaryNodes.push({
        id: `summary-instances-vcn-${vcnDbId}`,
        type: 'instanceSummaryNode',
        label: `${count} instance${count !== 1 ? 's' : ''}`,
        resourceType: 'compute/instance',
        ocid: '',
        lifecycleState: null,
        metadata: { instanceCount: count },
        parentNode: vcnDbId,
      });
    }

    if (unplacedCount > 0) {
      summaryNodes.push({
        id: 'summary-instances-unplaced',
        type: 'instanceSummaryNode',
        label: `${unplacedCount} instance${unplacedCount !== 1 ? 's' : ''} (unplaced)`,
        resourceType: 'compute/instance',
        ocid: '',
        lifecycleState: null,
        metadata: { instanceCount: unplacedCount },
        parentNode: null,
      });
    }
  }

  // ── Phase 7: Build topology nodes ──

  const nodes: TopologyNode[] = [];

  for (const r of capped) {
    let parentNode: string | null = null;
    if (r.resourceType === 'network/subnet') {
      parentNode = subnetVcnMap.get(r.id) ?? null;
    } else if (r.resourceType !== 'network/vcn') {
      parentNode = resourceVcnMap.get(r.id) ?? null;
    }

    let metadata: Record<string, any> | null = null;
    const rawStr = rawDataMap.get(r.id);
    if (rawStr) {
      try {
        const raw = JSON.parse(rawStr as string);
        const base: Record<string, any> = {};
        if (raw.cidrBlock !== undefined) base.cidrBlock = raw.cidrBlock;
        if (raw.cidrBlocks !== undefined) base.cidrBlocks = raw.cidrBlocks;
        if (r.resourceType === 'network/subnet' && raw.prohibitInternetIngress !== undefined) {
          base.prohibitInternetIngress = raw.prohibitInternetIngress;
        }
        if (r.resourceType === 'compute/instance' && raw.shape) {
          base.shape = raw.shape;
        }
        if ((r.resourceType === 'network/load-balancer' || r.resourceType === 'network/network-load-balancer')) {
          if (raw.shapeName) base.shapeName = raw.shapeName;
          if (raw.isPrivate !== undefined) base.isPrivate = raw.isPrivate;
        }
        metadata = Object.keys(base).length > 0 ? base : null;
      } catch {
        // ignore
      }
    }

    nodes.push({
      id: r.id,
      type: nodeTypeFor(r.resourceType),
      label: r.displayName ?? r.ocid,
      resourceType: r.resourceType,
      ocid: r.ocid,
      lifecycleState: r.lifecycleState,
      metadata,
      parentNode,
    });
  }

  nodes.push(...summaryNodes);

  // ── Phase 8: Load edges (chunked) ──

  const resourceIds = new Set(capped.map((r) => r.id));
  const edges = await loadEdges(prisma, resourceIds);

  // ── Phase 9: Add synthetic Internet node + edges (verified connectivity only) ──
  // Only show confirmed internet paths:
  //   - IGW: enabled + subnet route table has rule pointing to it
  //   - NAT: not blocked + subnet route table has rule pointing to it
  //   - Public LB: isPrivate === false (directly internet-facing)
  // SGW connects to Oracle Services Network, NOT the internet — excluded.

  // Load route tables to verify subnet→gateway routes
  const routeTableResources = await prisma.resource.findMany({
    where: { snapshotId, resourceType: 'network/route-table' },
    select: { ocid: true, rawData: true },
  });
  const routeTableRules = new Map<string, Array<{ destination: string; networkEntityId: string }>>();
  for (const rt of routeTableResources) {
    if (!rt.rawData) continue;
    try {
      const raw = JSON.parse(rt.rawData as string);
      if (Array.isArray(raw.routeRules)) {
        routeTableRules.set(rt.ocid, raw.routeRules);
      }
    } catch {}
  }

  // Build set of gateway OCIDs that are active and routed to
  const activeGatewayOcids = new Set<string>();
  // Also collect which gateways have routes pointing to them
  const routedGatewayOcids = new Set<string>();
  for (const rules of routeTableRules.values()) {
    for (const rule of rules) {
      if (rule.networkEntityId) routedGatewayOcids.add(rule.networkEntityId);
    }
  }

  const internetEdges: TopologyEdge[] = [];
  const internetNodeId = 'internet-edge';

  for (const r of capped) {
    const rawStr = rawDataMap.get(r.id);
    let raw: Record<string, any> = {};
    if (rawStr) { try { raw = JSON.parse(rawStr as string); } catch {} }

    if (r.resourceType === 'network/internet-gateway') {
      const enabled = raw.isEnabled !== false;
      const routed = routedGatewayOcids.has(r.ocid);
      if (enabled && routed) {
        internetEdges.push({
          id: `inet-${r.id}`, source: internetNodeId, target: r.id,
          label: 'public ingress/egress',
          relationType: 'internet-edge', animated: true,
        });
        activeGatewayOcids.add(r.ocid);
      }
    } else if (r.resourceType === 'network/nat-gateway') {
      const active = raw.blockTraffic !== true;
      const routed = routedGatewayOcids.has(r.ocid);
      if (active && routed) {
        internetEdges.push({
          id: `inet-${r.id}`, source: internetNodeId, target: r.id,
          label: 'outbound NAT',
          relationType: 'internet-edge', animated: true,
        });
        activeGatewayOcids.add(r.ocid);
      }
    } else if (
      (r.resourceType === 'network/load-balancer' || r.resourceType === 'network/network-load-balancer')
      && raw.isPrivate === false
    ) {
      internetEdges.push({
        id: `inet-lb-${r.id}`, source: internetNodeId, target: r.id,
        label: 'public LB', relationType: 'internet-edge', animated: true,
      });
    }
  }

  // Only add the Internet node if there are verified connections
  if (internetEdges.length > 0) {
    nodes.push({
      id: internetNodeId,
      type: 'internetNode',
      label: 'Internet',
      resourceType: 'internet',
      ocid: '',
      lifecycleState: null,
      metadata: null,
      parentNode: null,
    });
    edges.push(...internetEdges);
  }

  // ── Phase 10: Add synthetic Oracle Services node + edges to active SGWs ──
  const oracleServicesNodeId = 'oracle-services-edge';
  const oracleServicesEdges: TopologyEdge[] = [];

  for (const r of capped) {
    if (r.resourceType !== 'network/service-gateway') continue;
    const rawStr = rawDataMap.get(r.id);
    let raw: Record<string, any> = {};
    if (rawStr) { try { raw = JSON.parse(rawStr as string); } catch {} }

    const active = raw.blockTraffic !== true;
    const routed = routedGatewayOcids.has(r.ocid);
    if (active && routed) {
      oracleServicesEdges.push({
        id: `osn-${r.id}`, source: oracleServicesNodeId, target: r.id,
        label: 'Oracle services',
        relationType: 'oracle-services-edge', animated: true,
      });
    }
  }

  if (oracleServicesEdges.length > 0) {
    nodes.push({
      id: oracleServicesNodeId,
      type: 'oracleServicesNode',
      label: 'Oracle Services',
      resourceType: 'oracle-services',
      ocid: '',
      lifecycleState: null,
      metadata: null,
      parentNode: null,
    });
    edges.push(...oracleServicesEdges);
  }

  return { nodes, edges, totalCount, truncated };
}

// ---------------------------------------------------------------
// COMPARTMENT view
// ---------------------------------------------------------------

async function buildCompartmentView(
  prisma: PrismaClient,
  snapshotId: string,
  compartmentId: string | null,
): Promise<TopologyResult> {
  const resources = await prisma.resource.findMany({
    where: { snapshotId },
    select: {
      id: true,
      ocid: true,
      resourceType: true,
      displayName: true,
      lifecycleState: true,
      compartmentId: true,
    },
  });

  // Build OCID→id for compartment lookup
  const ocidToDbId = new Map<string, string>();
  for (const r of resources) {
    ocidToDbId.set(r.ocid, r.id);
  }

  // Use shared BFS helper for descendant compartment traversal
  const relevantCompartmentOcids = await getDescendantCompartmentOcids(prisma, snapshotId, compartmentId);

  // Separate compartments from regular resources
  const compartments = resources.filter(r => r.resourceType === 'iam/compartment');
  const nonCompartments = resources.filter(r => r.resourceType !== 'iam/compartment');

  // Filter compartments by scope
  const filteredCompartments = relevantCompartmentOcids
    ? compartments.filter(c => relevantCompartmentOcids.has(c.ocid))
    : compartments;

  // Aggregate resource counts per compartment
  const compartmentOcids = new Set(filteredCompartments.map(c => c.ocid));
  const countsByCompartment = new Map<string, Record<string, number>>();

  for (const r of nonCompartments) {
    if (!r.compartmentId) continue;
    // Only count if the compartment is in our filtered set
    if (relevantCompartmentOcids && !relevantCompartmentOcids.has(r.compartmentId)) continue;
    if (!compartmentOcids.has(r.compartmentId)) continue;

    const compDbId = ocidToDbId.get(r.compartmentId);
    if (!compDbId) continue;

    if (!countsByCompartment.has(compDbId)) {
      countsByCompartment.set(compDbId, {});
    }
    const counts = countsByCompartment.get(compDbId)!;
    counts[r.resourceType] = (counts[r.resourceType] || 0) + 1;
  }

  // Only emit compartment nodes with aggregated metadata
  const nodes: TopologyNode[] = [];
  for (const c of filteredCompartments) {
    let parentNode: string | null = null;
    if (c.compartmentId) {
      const parentDbId = ocidToDbId.get(c.compartmentId);
      if (parentDbId && parentDbId !== c.id) {
        parentNode = parentDbId;
      }
    }

    const resourceCounts = countsByCompartment.get(c.id) ?? {};
    const totalResources = Object.values(resourceCounts).reduce((s, n) => s + n, 0);

    nodes.push({
      id: c.id,
      type: 'compartmentNode',
      label: c.displayName ?? c.ocid,
      resourceType: 'iam/compartment',
      ocid: c.ocid,
      lifecycleState: c.lifecycleState,
      metadata: { resourceCounts, totalResources },
      parentNode,
    });
  }

  // Load parent-hierarchy edges between compartment nodes
  const compartmentIds = new Set(filteredCompartments.map(c => c.id));
  const hierarchyEdges = await loadEdges(prisma, compartmentIds);

  // Build cross-compartment resource dependency edges:
  // Find resource relationships where source and target are in different compartments.
  const resourceIdToCompDbId = new Map<string, string>();
  for (const r of resources) {
    if (r.compartmentId) {
      const compDbId = ocidToDbId.get(r.compartmentId);
      if (compDbId && compartmentIds.has(compDbId)) {
        resourceIdToCompDbId.set(r.id, compDbId);
      }
    }
  }

  // Load cross-compartment relationships in chunks (SQLite parameter limit)
  const trackedIds = Array.from(resourceIdToCompDbId.keys());
  const trackedSet = new Set(trackedIds);
  const REL_CHUNK = 500;
  const crossMap = new Map<string, { count: number; types: Record<string, number> }>();

  for (let i = 0; i < trackedIds.length; i += REL_CHUNK) {
    const chunk = trackedIds.slice(i, i + REL_CHUNK);
    const chunkRels = await prisma.resourceRelation.findMany({
      where: { fromResourceId: { in: chunk } },
      select: { fromResourceId: true, toResourceId: true, relationType: true },
    });

    for (const rel of chunkRels) {
      if (rel.relationType === 'contains' || rel.relationType === 'parent') continue;
      if (!trackedSet.has(rel.toResourceId)) continue;

      const fromComp = resourceIdToCompDbId.get(rel.fromResourceId);
      const toComp = resourceIdToCompDbId.get(rel.toResourceId);
      if (!fromComp || !toComp || fromComp === toComp) continue;

      // Canonical key (undirected) so A→B and B→A merge into one edge
      const [a, b] = fromComp < toComp ? [fromComp, toComp] : [toComp, fromComp];
      const key = `${a}:${b}`;
      if (!crossMap.has(key)) {
        crossMap.set(key, { count: 0, types: {} });
      }
      const agg = crossMap.get(key)!;
      agg.count++;
      agg.types[rel.relationType] = (agg.types[rel.relationType] || 0) + 1;
    }
  }

  const crossEdges: TopologyEdge[] = [];
  for (const [key, data] of crossMap) {
    const [a, b] = key.split(':');
    const topType = Object.entries(data.types)
      .sort((x, y) => y[1] - x[1])[0]?.[0] ?? '';
    crossEdges.push({
      id: `cross-${a}-${b}`,
      source: a,
      target: b,
      label: `${data.count} dep${data.count > 1 ? 's' : ''} (${formatEdgeLabel(topType)})`,
      relationType: 'cross-compartment',
      animated: true,
    });
  }

  const edges = [...hierarchyEdges, ...crossEdges];
  return { nodes, edges, totalCount: nodes.length, truncated: false };
}

// ---------------------------------------------------------------
// DEPENDENCY view
// ---------------------------------------------------------------

/**
 * Dependency view types — exclude raw infrastructure that creates noise.
 * Focus on workloads, databases, LBs, and their relationships.
 */
const DEPENDENCY_VIEW_TYPES = [
  'compute/instance',
  'database/db-system',
  'database/autonomous-database',
  'database/mysql-db-system',
  'network/load-balancer',
  'network/network-load-balancer',
  'container/cluster',
  'container/node-pool',
  'container/container-instance',
  'serverless/application',
  'serverless/function',
  'serverless/api-gateway',
  'serverless/api-deployment',
  'storage/bucket',
  'storage/file-system',
  'storage/block-volume',
  'storage/boot-volume',
  'security/vault',
  'security/secret',
  'dns/zone',
  'iam/policy',
  'iam/dynamic-group',
];

async function buildDependencyView(
  prisma: PrismaClient,
  snapshotId: string,
  compartmentId: string | null,
): Promise<TopologyResult> {
  const descendantOcids = await getDescendantCompartmentOcids(prisma, snapshotId, compartmentId);

  const whereClause: Record<string, any> = { snapshotId };
  if (descendantOcids) {
    whereClause.compartmentId = { in: Array.from(descendantOcids) };
  }

  // ── Phase 1: Count to decide strategy ──
  const totalCount = await prisma.resource.count({ where: whereClause });

  // ── Phase 2: Load only workload-relevant resource types (not all 100k+) ──
  const resources = await prisma.resource.findMany({
    where: { ...whereClause, resourceType: { in: DEPENDENCY_VIEW_TYPES } },
    select: {
      id: true,
      ocid: true,
      resourceType: true,
      displayName: true,
      lifecycleState: true,
    },
  });

  let truncated = false;
  let capped = resources;

  if (resources.length > MAX_TOPOLOGY_NODES) {
    // Find connected resources using chunked relation queries
    const allIds = resources.map(r => r.id);
    const connectedIds = new Set<string>();

    for (let i = 0; i < allIds.length; i += DB_CHUNK) {
      const chunk = allIds.slice(i, i + DB_CHUNK);
      const rels = await prisma.resourceRelation.findMany({
        where: {
          OR: [
            { fromResourceId: { in: chunk } },
            { toResourceId: { in: chunk } },
          ],
        },
        select: { fromResourceId: true, toResourceId: true },
      });
      for (const rel of rels) {
        connectedIds.add(rel.fromResourceId);
        connectedIds.add(rel.toResourceId);
      }
    }

    const connected = resources.filter(r => connectedIds.has(r.id));
    capped = connected.length > MAX_TOPOLOGY_NODES
      ? connected.slice(0, MAX_TOPOLOGY_NODES)
      : connected;
    truncated = true;
  }

  const nodes: TopologyNode[] = capped.map((r) => ({
    id: r.id,
    type: nodeTypeFor(r.resourceType),
    label: r.displayName ?? r.ocid,
    resourceType: r.resourceType,
    ocid: r.ocid,
    lifecycleState: r.lifecycleState,
    metadata: null,
    parentNode: null,
  }));

  const resourceIds = new Set(capped.map((r) => r.id));
  const edges = await loadEdges(prisma, resourceIds);

  // Filter out hierarchy edges (contains/parent) — dependency view cares about real relationships
  const depEdges = edges.filter(e => e.relationType !== 'contains' && e.relationType !== 'parent');

  return { nodes, edges: depEdges, totalCount, truncated };
}

// ---------------------------------------------------------------
// EXPOSURE view — internet-facing / public edge resources
// ---------------------------------------------------------------

/** Internet-facing gateway types (SGW excluded — it connects to Oracle Services, not internet) */
const INTERNET_GATEWAY_TYPES = new Set([
  'network/internet-gateway',
  'network/nat-gateway',
]);

async function buildExposureView(
  prisma: PrismaClient,
  snapshotId: string,
  compartmentId: string | null,
): Promise<TopologyResult> {
  const descendantOcids = await getDescendantCompartmentOcids(prisma, snapshotId, compartmentId);

  const whereClause: Record<string, any> = { snapshotId };
  if (descendantOcids) {
    whereClause.compartmentId = { in: Array.from(descendantOcids) };
  }

  // ── Phase 1: Load network infra + route tables ──
  const infraTypes = [
    'network/vcn',
    'network/subnet',
    'network/internet-gateway',
    'network/nat-gateway',
    'network/service-gateway',
    'network/route-table',
    'network/load-balancer',
    'network/network-load-balancer',
  ];

  const infraResources = await prisma.resource.findMany({
    where: { ...whereClause, resourceType: { in: infraTypes } },
    select: { id: true, ocid: true, resourceType: true, displayName: true, lifecycleState: true, rawData: true },
  });

  type InfraRes = { id: string; ocid: string; resourceType: string; displayName: string | null; lifecycleState: string | null; raw: Record<string, any> };
  const infra: InfraRes[] = infraResources.map(r => ({
    id: r.id, ocid: r.ocid, resourceType: r.resourceType,
    displayName: r.displayName, lifecycleState: r.lifecycleState,
    raw: (() => { try { return r.rawData ? JSON.parse(r.rawData as string) : {}; } catch { return {}; } })(),
  }));

  // ── Phase 2: Build route table → gateway map ──
  // Parse route rules to find which route tables point to which gateways
  const routeTables = infra.filter(r => r.resourceType === 'network/route-table');
  const routeTableRules = new Map<string, Array<{ destination: string; networkEntityId: string }>>();
  for (const rt of routeTables) {
    if (Array.isArray(rt.raw.routeRules)) {
      routeTableRules.set(rt.ocid, rt.raw.routeRules);
    }
  }

  // Set of all gateway OCIDs that have at least one route rule pointing to them
  const routedGatewayOcids = new Set<string>();
  for (const rules of routeTableRules.values()) {
    for (const rule of rules) {
      if (rule.networkEntityId) routedGatewayOcids.add(rule.networkEntityId);
    }
  }

  // ── Phase 3: Identify active, routed internet gateways ──
  const allGateways = infra.filter(r => INTERNET_GATEWAY_TYPES.has(r.resourceType));
  const activeGateways = allGateways.filter(gw => {
    // Must have route table rules pointing to it
    if (!routedGatewayOcids.has(gw.ocid)) return false;
    // Must be enabled/unblocked
    if (gw.resourceType === 'network/internet-gateway') return gw.raw.isEnabled !== false;
    if (gw.resourceType === 'network/nat-gateway') return gw.raw.blockTraffic !== true;
    return false;
  });
  const activeGatewayOcids = new Set(activeGateways.map(g => g.ocid));

  // Public LBs (directly internet-facing regardless of route tables)
  const publicLbs = infra.filter(r =>
    (r.resourceType === 'network/load-balancer' || r.resourceType === 'network/network-load-balancer')
    && r.raw.isPrivate === false,
  );

  if (activeGateways.length === 0 && publicLbs.length === 0) {
    return { nodes: [], edges: [], totalCount: 0, truncated: false };
  }

  // ── Phase 4: Identify subnets with verified internet routes ──
  // A subnet has internet access if its route table (or VCN default) has a rule
  // pointing to an active IGW or NAT gateway.
  const vcns = infra.filter(r => r.resourceType === 'network/vcn');
  const vcnDefaultRt = new Map<string, string>(); // vcnOcid → defaultRouteTableId
  for (const v of vcns) {
    if (v.raw.defaultRouteTableId) vcnDefaultRt.set(v.ocid, v.raw.defaultRouteTableId);
  }

  const subnets = infra.filter(r => r.resourceType === 'network/subnet');
  const internetSubnets: InfraRes[] = []; // subnets with confirmed internet routes
  const internetSubnetOcids = new Set<string>();

  for (const sub of subnets) {
    const rtOcid = sub.raw.routeTableId || (sub.raw.vcnId ? vcnDefaultRt.get(sub.raw.vcnId) : null);
    if (!rtOcid) continue;
    const rules = routeTableRules.get(rtOcid);
    if (!rules) continue;

    const hasInternetRoute = rules.some(rule => activeGatewayOcids.has(rule.networkEntityId));
    if (hasInternetRoute) {
      internetSubnets.push(sub);
      internetSubnetOcids.add(sub.ocid);
    }
  }

  // Also include subnets that house public LBs (they're internet-facing by definition)
  for (const lb of publicLbs) {
    const subOcids: string[] = lb.raw.subnetIds || [];
    for (const subOcid of subOcids) {
      if (!internetSubnetOcids.has(subOcid)) {
        const sub = subnets.find(s => s.ocid === subOcid);
        if (sub) {
          internetSubnets.push(sub);
          internetSubnetOcids.add(sub.ocid);
        }
      }
    }
  }

  // VCNs that contain internet-connected subnets or active gateways
  const exposedVcnOcids = new Set<string>();
  for (const sub of internetSubnets) {
    if (sub.raw.vcnId) exposedVcnOcids.add(sub.raw.vcnId);
  }
  for (const gw of activeGateways) {
    if (gw.raw.vcnId) exposedVcnOcids.add(gw.raw.vcnId);
  }

  // ── Phase 5: VNIC attachments for instance placement ──
  const vnicAttachments = await prisma.resource.findMany({
    where: { snapshotId, resourceType: 'compute/vnic-attachment' },
    select: { rawData: true },
  });
  const instanceToSubnet = new Map<string, string>();
  for (const va of vnicAttachments) {
    if (!va.rawData) continue;
    try {
      const raw = JSON.parse(va.rawData as string);
      if (raw.instanceId && raw.subnetId && !instanceToSubnet.has(raw.instanceId)) {
        instanceToSubnet.set(raw.instanceId, raw.subnetId);
      }
    } catch {}
  }

  // ── Phase 6: Find instances in internet-connected subnets ──
  const exposedInstanceOcids: string[] = [];
  for (const [instOcid, subOcid] of instanceToSubnet) {
    if (internetSubnetOcids.has(subOcid)) exposedInstanceOcids.push(instOcid);
  }

  const MAX_EXPOSED_INSTANCES = 500;
  const cappedInstanceOcids = exposedInstanceOcids.slice(0, MAX_EXPOSED_INSTANCES);
  const instancesTruncated = exposedInstanceOcids.length > MAX_EXPOSED_INSTANCES;

  let exposedInstances: ResourceMeta[] = [];
  if (cappedInstanceOcids.length > 0) {
    for (let i = 0; i < cappedInstanceOcids.length; i += DB_CHUNK) {
      const chunk = cappedInstanceOcids.slice(i, i + DB_CHUNK);
      const batch = await prisma.resource.findMany({
        where: { snapshotId, resourceType: 'compute/instance', ocid: { in: chunk } },
        select: { id: true, ocid: true, resourceType: true, displayName: true, lifecycleState: true, compartmentId: true },
      });
      exposedInstances.push(...batch);
    }
  }

  // ── Phase 7: Find non-instance members in internet-connected subnets ──
  const memberTypes = [
    'database/db-system',
    'database/autonomous-database',
    'database/mysql-db-system',
    'container/cluster',
    'container/node-pool',
    'container/container-instance',
    'serverless/application',
    'serverless/api-gateway',
  ];

  const memberResources = await prisma.resource.findMany({
    where: { ...whereClause, resourceType: { in: memberTypes } },
    select: { id: true, ocid: true, resourceType: true, displayName: true, lifecycleState: true, rawData: true },
  });

  type MemberRes = ResourceMeta & { raw: Record<string, any> };
  const exposedMembers: MemberRes[] = [];
  for (const r of memberResources) {
    let raw: Record<string, any> = {};
    try { raw = r.rawData ? JSON.parse(r.rawData as string) : {}; } catch {}

    let inExposedSubnet = false;
    if (raw.subnetId) inExposedSubnet = internetSubnetOcids.has(raw.subnetId);
    else if (Array.isArray(raw.subnetIds)) inExposedSubnet = raw.subnetIds.some((s: string) => internetSubnetOcids.has(s));
    else if (raw.vnics?.[0]?.subnetId) inExposedSubnet = internetSubnetOcids.has(raw.vnics[0].subnetId);
    else if (raw.nodeConfigDetails?.placementConfigs?.[0]?.subnetId) {
      inExposedSubnet = internetSubnetOcids.has(raw.nodeConfigDetails.placementConfigs[0].subnetId);
    }

    if (inExposedSubnet) {
      exposedMembers.push({ ...r, compartmentId: null, raw });
    }
  }

  // ── Phase 8: Assemble nodes ──
  const exposedVcns = vcns.filter(v => exposedVcnOcids.has(v.ocid));

  const ocidToDbId = new Map<string, string>();
  for (const r of [...exposedVcns, ...internetSubnets, ...activeGateways, ...publicLbs]) {
    ocidToDbId.set(r.ocid, r.id);
  }
  for (const r of exposedInstances) ocidToDbId.set(r.ocid, r.id);
  for (const r of exposedMembers) ocidToDbId.set(r.ocid, r.id);

  const nodes: TopologyNode[] = [];

  // Synthetic Internet node
  const internetNodeId = 'internet-edge';
  nodes.push({
    id: internetNodeId, type: 'internetNode', label: 'Internet',
    resourceType: 'internet', ocid: '', lifecycleState: null, metadata: null, parentNode: null,
  });

  // VCNs
  for (const r of exposedVcns) {
    const base: Record<string, any> = {};
    if (r.raw.cidrBlocks) base.cidrBlocks = r.raw.cidrBlocks;
    nodes.push({
      id: r.id, type: 'vcnNode', label: r.displayName ?? r.ocid,
      resourceType: r.resourceType, ocid: r.ocid, lifecycleState: r.lifecycleState,
      metadata: Object.keys(base).length > 0 ? base : null, parentNode: null,
    });
  }

  // Internet-connected subnets
  for (const r of internetSubnets) {
    nodes.push({
      id: r.id, type: 'subnetNode', label: r.displayName ?? r.ocid,
      resourceType: r.resourceType, ocid: r.ocid, lifecycleState: r.lifecycleState,
      metadata: { cidrBlock: r.raw.cidrBlock, prohibitInternetIngress: !!r.raw.prohibitInternetIngress },
      parentNode: r.raw.vcnId ? (ocidToDbId.get(r.raw.vcnId) ?? null) : null,
    });
  }

  // Active gateways only
  for (const r of activeGateways) {
    const base: Record<string, any> = {};
    if (r.raw.isEnabled !== undefined) base.isEnabled = r.raw.isEnabled;
    if (r.raw.blockTraffic !== undefined) base.blockTraffic = r.raw.blockTraffic;
    nodes.push({
      id: r.id, type: 'gatewayNode', label: r.displayName ?? r.ocid,
      resourceType: r.resourceType, ocid: r.ocid, lifecycleState: r.lifecycleState,
      metadata: Object.keys(base).length > 0 ? base : null,
      parentNode: r.raw.vcnId ? (ocidToDbId.get(r.raw.vcnId) ?? null) : null,
    });
  }

  // Public LBs
  for (const r of publicLbs) {
    const subId = r.raw.subnetIds?.[0] ? (ocidToDbId.get(r.raw.subnetIds[0]) ?? null) : null;
    nodes.push({
      id: r.id, type: 'loadBalancerNode', label: r.displayName ?? r.ocid,
      resourceType: r.resourceType, ocid: r.ocid, lifecycleState: r.lifecycleState,
      metadata: { isPrivate: false, shapeName: r.raw.shapeName ?? null },
      parentNode: subId,
    });
  }

  // Exposed instances
  for (const r of exposedInstances) {
    const subOcid = instanceToSubnet.get(r.ocid);
    nodes.push({
      id: r.id, type: 'instanceNode', label: r.displayName ?? r.ocid,
      resourceType: r.resourceType, ocid: r.ocid, lifecycleState: r.lifecycleState,
      metadata: null,
      parentNode: subOcid ? (ocidToDbId.get(subOcid) ?? null) : null,
    });
  }

  // Exposed non-instance members
  for (const r of exposedMembers) {
    let parentNode: string | null = null;
    if (r.raw.subnetId) parentNode = ocidToDbId.get(r.raw.subnetId) ?? null;
    else if (Array.isArray(r.raw.subnetIds) && r.raw.subnetIds[0]) parentNode = ocidToDbId.get(r.raw.subnetIds[0]) ?? null;
    nodes.push({
      id: r.id, type: nodeTypeFor(r.resourceType), label: r.displayName ?? r.ocid,
      resourceType: r.resourceType, ocid: r.ocid, lifecycleState: r.lifecycleState,
      metadata: null, parentNode,
    });
  }

  // Instance summary if truncated
  if (instancesTruncated) {
    const overflow = exposedInstanceOcids.length - MAX_EXPOSED_INSTANCES;
    nodes.push({
      id: 'summary-exposed-overflow', type: 'instanceSummaryNode',
      label: `+${overflow} more exposed instance${overflow !== 1 ? 's' : ''}`,
      resourceType: 'compute/instance', ocid: '', lifecycleState: null,
      metadata: { instanceCount: overflow }, parentNode: null,
    });
  }

  // ── Phase 9: Build edges (verified internet connections only) ──
  const edges: TopologyEdge[] = [];

  for (const gw of activeGateways) {
    if (gw.resourceType === 'network/internet-gateway') {
      edges.push({
        id: `inet-${gw.id}`, source: internetNodeId, target: gw.id,
        label: 'public ingress/egress', relationType: 'internet-edge', animated: true,
      });
    } else if (gw.resourceType === 'network/nat-gateway') {
      edges.push({
        id: `inet-${gw.id}`, source: internetNodeId, target: gw.id,
        label: 'outbound NAT', relationType: 'internet-edge', animated: true,
      });
    }
  }

  for (const lb of publicLbs) {
    edges.push({
      id: `inet-lb-${lb.id}`, source: internetNodeId, target: lb.id,
      label: 'public LB', relationType: 'internet-edge', animated: true,
    });
  }

  // ── Phase 10: Oracle Services node + active SGW edges ──
  const oracleServicesNodeId = 'oracle-services-edge';
  const activeSgws = infra.filter(r =>
    r.resourceType === 'network/service-gateway'
    && r.raw.blockTraffic !== true
    && routedGatewayOcids.has(r.ocid),
  );

  if (activeSgws.length > 0) {
    nodes.push({
      id: oracleServicesNodeId, type: 'oracleServicesNode', label: 'Oracle Services',
      resourceType: 'oracle-services', ocid: '', lifecycleState: null, metadata: null, parentNode: null,
    });

    for (const sgw of activeSgws) {
      // Add gateway node if not already included
      const base: Record<string, any> = {};
      if (sgw.raw.blockTraffic !== undefined) base.blockTraffic = sgw.raw.blockTraffic;
      nodes.push({
        id: sgw.id, type: 'gatewayNode', label: sgw.displayName ?? sgw.ocid,
        resourceType: sgw.resourceType, ocid: sgw.ocid, lifecycleState: sgw.lifecycleState,
        metadata: Object.keys(base).length > 0 ? base : null,
        parentNode: sgw.raw.vcnId ? (ocidToDbId.get(sgw.raw.vcnId) ?? null) : null,
      });

      edges.push({
        id: `osn-${sgw.id}`, source: oracleServicesNodeId, target: sgw.id,
        label: 'Oracle services', relationType: 'oracle-services-edge', animated: true,
      });
    }
  }

  // Relationship edges between included resources
  const allIncludedIds = new Set(nodes.map(n => n.id));
  allIncludedIds.delete(internetNodeId);
  allIncludedIds.delete(oracleServicesNodeId);
  const relEdges = await loadEdges(prisma, allIncludedIds);
  edges.push(...relEdges);

  return { nodes, edges, totalCount: nodes.length + (instancesTruncated ? exposedInstanceOcids.length - MAX_EXPOSED_INSTANCES : 0), truncated: instancesTruncated };
}

// ---------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------

/**
 * Load relationship edges for a set of resource IDs and convert them
 * to TopologyEdge objects suitable for React Flow.
 */
async function loadEdges(
  prisma: PrismaClient,
  resourceIds: Set<string>,
): Promise<TopologyEdge[]> {
  if (resourceIds.size === 0) return [];

  const idsArray = Array.from(resourceIds);
  const edges: TopologyEdge[] = [];

  // Chunk the fromResourceId IN clause to stay within SQLite's parameter limit.
  // We filter toResourceId in JS since the full set may exceed IN size.
  for (let i = 0; i < idsArray.length; i += DB_CHUNK) {
    const chunk = idsArray.slice(i, i + DB_CHUNK);
    const relations = await prisma.resourceRelation.findMany({
      where: { fromResourceId: { in: chunk } },
      select: {
        id: true,
        fromResourceId: true,
        toResourceId: true,
        relationType: true,
      },
    });

    for (const rel of relations) {
      if (!resourceIds.has(rel.toResourceId)) continue;
      edges.push({
        id: rel.id,
        source: rel.fromResourceId,
        target: rel.toResourceId,
        label: formatEdgeLabel(rel.relationType),
        relationType: rel.relationType,
        animated: rel.relationType === 'routes-via',
      });
    }
  }

  return edges;
}

/**
 * Convert a relationType slug to a human-friendly label.
 */
function formatEdgeLabel(relationType: string): string {
  const labels: Record<string, string> = {
    contains: 'contains',
    parent: 'parent',
    'subnet-member': 'in subnet',
    'routes-via': 'routes via',
    'secured-by': 'secured by',
    'nsg-member': 'NSG member',
    'volume-attached': 'volume attached',
    'lb-backend': 'backend',
    'gateway-for': 'gateway',
    'runs-in': 'runs in',
    'uses-vcn': 'uses VCN',
    'uses-image': 'uses image',
    'member-of': 'member of',
    'stored-in': 'stored in',
    'deployed-to': 'deployed to',
    'backup-of': 'backup of',
    'groups': 'groups',
    'attached-to': 'attached to',
    'signs': 'signs',
    'belongs-to': 'belongs to',
  };
  return labels[relationType] ?? relationType;
}
