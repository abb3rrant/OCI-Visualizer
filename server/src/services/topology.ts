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
}

// ---------------------------------------------------------------
// Resource-type to React Flow node-type mapping
// ---------------------------------------------------------------

const RESOURCE_TYPE_TO_NODE_TYPE: Record<string, string> = {
  'network/vcn': 'vcnNode',
  'network/subnet': 'subnetNode',
  'compute/instance': 'instanceNode',
  'database/db-system': 'databaseNode',
  'database/autonomous-database': 'databaseNode',
  'database/mysql-db-system': 'databaseNode',
  'network/load-balancer': 'loadBalancerNode',
  'network/network-load-balancer': 'loadBalancerNode',
  'storage/block-volume': 'storageNode',
  'storage/boot-volume': 'storageNode',
  'storage/bucket': 'storageNode',
  'storage/file-system': 'storageNode',
  'network/internet-gateway': 'gatewayNode',
  'network/nat-gateway': 'gatewayNode',
  'network/service-gateway': 'gatewayNode',
  'network/local-peering-gateway': 'gatewayNode',
  'network/drg': 'gatewayNode',
  'network/drg-attachment': 'gatewayNode',
  'network/nsg': 'securityNode',
  'network/security-list': 'securityNode',
  'network/route-table': 'securityNode',
  'iam/compartment': 'compartmentNode',
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
  'iam/user': 'iamNode',
  'iam/group': 'iamNode',
  'iam/policy': 'iamNode',
  'iam/dynamic-group': 'iamNode',
};

function nodeTypeFor(resourceType: string): string {
  if (RESOURCE_TYPE_TO_NODE_TYPE[resourceType]) {
    return RESOURCE_TYPE_TO_NODE_TYPE[resourceType];
  }
  if (resourceType.startsWith('container/')) return 'containerNode';
  if (resourceType.startsWith('serverless/')) return 'serverlessNode';
  if (resourceType.startsWith('iam/')) return 'iamNode';
  if (resourceType.startsWith('database/')) return 'databaseNode';
  if (resourceType.startsWith('storage/')) return 'storageNode';
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
  'network/security-list',
  'network/nsg',
  'network/route-table',
  'storage/block-volume',
  'storage/boot-volume',
  'container/cluster',
  'container/node-pool',
  'container/container-instance',
  'serverless/application',
  'serverless/api-gateway',
]);

// ---------------------------------------------------------------
// Shared: BFS child-compartment traversal
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

  const result = new Set<string>([compartmentId]);
  const queue = [compartmentId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const c of compartments) {
      if (c.compartmentId === current && !result.has(c.ocid)) {
        result.add(c.ocid);
        queue.push(c.ocid);
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
  viewType: 'NETWORK' | 'COMPARTMENT' | 'DEPENDENCY',
): Promise<TopologyResult> {
  switch (viewType) {
    case 'NETWORK':
      return buildNetworkView(prisma, snapshotId, compartmentId);
    case 'COMPARTMENT':
      return buildCompartmentView(prisma, snapshotId, compartmentId);
    case 'DEPENDENCY':
      return buildDependencyView(prisma, snapshotId, compartmentId);
    default:
      return { nodes: [], edges: [] };
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

  const resources = await prisma.resource.findMany({
    where: whereClause,
    select: {
      id: true,
      ocid: true,
      resourceType: true,
      displayName: true,
      lifecycleState: true,
      compartmentId: true,
      rawData: true,
    },
  });

  // Filter to network-related types
  const filtered = resources.filter((r) => NETWORK_VIEW_TYPES.has(r.resourceType));

  // Build OCID→id map for parent resolution
  const ocidToDbId = new Map<string, string>();
  for (const r of filtered) {
    ocidToDbId.set(r.ocid, r.id);
  }

  // Parse rawData to find VCN membership for nesting
  const resourceVcnMap = new Map<string, string>(); // resource DB id → VCN DB id
  const subnetVcnMap = new Map<string, string>();   // subnet DB id → VCN DB id

  for (const r of filtered) {
    let rawData: Record<string, any> = {};
    if (r.rawData) {
      try {
        rawData = JSON.parse(r.rawData as string);
      } catch {
        // ignore
      }
    }

    if (r.resourceType === 'network/subnet' && rawData.vcnId) {
      const vcnDbId = ocidToDbId.get(rawData.vcnId);
      if (vcnDbId) {
        subnetVcnMap.set(r.id, vcnDbId);
      }
    }

    // Resources inside a subnet
    if (rawData.subnetId) {
      const subDbId = ocidToDbId.get(rawData.subnetId);
      if (subDbId) {
        resourceVcnMap.set(r.id, subDbId); // parent = subnet
      }
    }

    // Container instances: extract subnet from first vnic
    if (r.resourceType === 'container/container-instance' && Array.isArray(rawData.vnics) && rawData.vnics.length > 0) {
      const firstSubnet = rawData.vnics[0]?.subnetId;
      if (firstSubnet && !resourceVcnMap.has(r.id)) {
        const subDbId = ocidToDbId.get(firstSubnet);
        if (subDbId) {
          resourceVcnMap.set(r.id, subDbId);
        }
      }
    }

    // Node pools: extract subnet from first placement config
    if (r.resourceType === 'container/node-pool' && rawData.nodeConfigDetails?.placementConfigs) {
      const configs = rawData.nodeConfigDetails.placementConfigs;
      if (Array.isArray(configs) && configs.length > 0 && configs[0]?.subnetId) {
        if (!resourceVcnMap.has(r.id)) {
          const subDbId = ocidToDbId.get(configs[0].subnetId);
          if (subDbId) {
            resourceVcnMap.set(r.id, subDbId);
          }
        }
      }
    }

    // Gateways attached to a VCN
    if (rawData.vcnId && r.resourceType !== 'network/subnet') {
      const vcnDbId = ocidToDbId.get(rawData.vcnId);
      if (vcnDbId && !resourceVcnMap.has(r.id)) {
        resourceVcnMap.set(r.id, vcnDbId);
      }
    }
  }

  const nodes: TopologyNode[] = [];

  for (const r of filtered) {
    let parentNode: string | null = null;
    if (r.resourceType === 'network/subnet') {
      parentNode = subnetVcnMap.get(r.id) ?? null;
    } else if (r.resourceType !== 'network/vcn') {
      parentNode = resourceVcnMap.get(r.id) ?? null;
    }

    let metadata: Record<string, any> | null = null;
    if (r.rawData) {
      try {
        const raw = JSON.parse(r.rawData as string);
        metadata = { cidrBlock: raw.cidrBlock, cidrBlocks: raw.cidrBlocks };
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

  // Load relationships between the filtered resources
  const resourceIds = new Set(filtered.map((r) => r.id));
  const edges = await loadEdges(prisma, resourceIds);

  return { nodes, edges };
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

  // Filter resources by compartment if needed
  const filtered = relevantCompartmentOcids
    ? resources.filter(
        (r) =>
          relevantCompartmentOcids.has(r.ocid) ||
          (r.compartmentId && relevantCompartmentOcids.has(r.compartmentId)),
      )
    : resources;

  const nodes: TopologyNode[] = [];

  for (const r of filtered) {
    let parentNode: string | null = null;

    if (r.resourceType === 'iam/compartment') {
      // Parent is the compartment this compartment belongs to
      if (r.compartmentId) {
        const parentDbId = ocidToDbId.get(r.compartmentId);
        if (parentDbId && parentDbId !== r.id) {
          parentNode = parentDbId;
        }
      }
    } else {
      // Regular resource → parent is its compartment
      if (r.compartmentId) {
        const compDbId = ocidToDbId.get(r.compartmentId);
        if (compDbId) {
          parentNode = compDbId;
        }
      }
    }

    nodes.push({
      id: r.id,
      type:
        r.resourceType === 'iam/compartment'
          ? 'compartmentNode'
          : nodeTypeFor(r.resourceType),
      label: r.displayName ?? r.ocid,
      resourceType: r.resourceType,
      ocid: r.ocid,
      lifecycleState: r.lifecycleState,
      metadata: null,
      parentNode,
    });
  }

  const resourceIds = new Set(filtered.map((r) => r.id));
  const edges = await loadEdges(prisma, resourceIds);

  return { nodes, edges };
}

// ---------------------------------------------------------------
// DEPENDENCY view
// ---------------------------------------------------------------

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

  const resources = await prisma.resource.findMany({
    where: whereClause,
    select: {
      id: true,
      ocid: true,
      resourceType: true,
      displayName: true,
      lifecycleState: true,
    },
  });

  const nodes: TopologyNode[] = resources.map((r) => ({
    id: r.id,
    type: nodeTypeFor(r.resourceType),
    label: r.displayName ?? r.ocid,
    resourceType: r.resourceType,
    ocid: r.ocid,
    lifecycleState: r.lifecycleState,
    metadata: null,
    parentNode: null,
  }));

  const resourceIds = new Set(resources.map((r) => r.id));
  const edges = await loadEdges(prisma, resourceIds);

  return { nodes, edges };
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

  const relations = await prisma.resourceRelation.findMany({
    where: {
      AND: [
        { fromResourceId: { in: idsArray } },
        { toResourceId: { in: idsArray } },
      ],
    },
    select: {
      id: true,
      fromResourceId: true,
      toResourceId: true,
      relationType: true,
    },
  });

  return relations.map((rel) => ({
    id: rel.id,
    source: rel.fromResourceId,
    target: rel.toResourceId,
    label: formatEdgeLabel(rel.relationType),
    relationType: rel.relationType,
    animated: rel.relationType === 'routes-via',
  }));
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
  };
  return labels[relationType] ?? relationType;
}
