import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

export interface LayoutNode {
  id: string;
  width: number;
  height: number;
  parentId?: string;
  nodeType?: string;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
}

export interface LayoutResult {
  positions: Record<string, { x: number; y: number }>;
  sizes?: Record<string, { width: number; height: number }>;
}

/**
 * Flat ELK layout — all nodes at the same level, hierarchy shown via edges.
 * ELK's layered algorithm positions nodes in layers based on edge direction,
 * naturally creating a top-down flow: DRG → VCN → Subnet → Instance.
 */
export async function getLayoutedElements(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
): Promise<LayoutResult> {
  if (nodes.length === 0) {
    return { positions: {} };
  }

  const nodeIds = new Set(nodes.map(n => n.id));

  const elkChildren: ElkNode[] = nodes.map(n => ({
    id: n.id,
    width: n.width,
    height: n.height,
  }));

  // Only include edges where both endpoints exist
  const elkEdges: ElkExtendedEdge[] = edges
    .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target) && e.source !== e.target)
    .map(e => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    }));

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '30',
      'elk.layered.spacing.nodeNodeBetweenLayers': '60',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.separateConnectedComponents': 'true',
      'elk.spacing.componentComponent': '80',
    },
    children: elkChildren,
    edges: elkEdges,
  };

  const result = await elk.layout(elkGraph);

  const positions: Record<string, { x: number; y: number }> = {};
  for (const child of result.children || []) {
    positions[child.id] = { x: child.x ?? 0, y: child.y ?? 0 };
  }

  return { positions };
}

/**
 * Hierarchical ELK layout for NETWORK view — VCNs and Subnets are compound nodes.
 * Children are positioned inside their parents. Returns both positions and computed sizes.
 */
export async function getHierarchicalLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
): Promise<LayoutResult> {
  if (nodes.length === 0) {
    return { positions: {}, sizes: {} };
  }

  const nodeIds = new Set(nodes.map(n => n.id));
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Determine which nodes are compound (VCN or Subnet that have children)
  const parentIds = new Set<string>();
  for (const n of nodes) {
    if (n.parentId && nodeIds.has(n.parentId)) {
      parentIds.add(n.parentId);
    }
  }

  // Build tree: group children by parent
  const childrenByParent = new Map<string, LayoutNode[]>();
  const rootNodes: LayoutNode[] = [];

  for (const n of nodes) {
    if (n.parentId && nodeIds.has(n.parentId)) {
      let children = childrenByParent.get(n.parentId);
      if (!children) {
        children = [];
        childrenByParent.set(n.parentId, children);
      }
      children.push(n);
    } else {
      rootNodes.push(n);
    }
  }

  // Recursively build ELK nodes
  function buildElkNode(n: LayoutNode): ElkNode {
    const children = childrenByParent.get(n.id);
    const isCompound = children && children.length > 0;

    const elkNode: ElkNode = {
      id: n.id,
      width: isCompound ? undefined : n.width,
      height: isCompound ? undefined : n.height,
    };

    if (isCompound) {
      const isVcn = n.nodeType === 'vcnNode';
      elkNode.layoutOptions = {
        'elk.algorithm': 'layered',
        'elk.direction': 'DOWN',
        'elk.spacing.nodeNode': '30',
        'elk.layered.spacing.nodeNodeBetweenLayers': '50',
        'elk.padding': isVcn
          ? '[top=50,left=25,bottom=25,right=25]'
          : '[top=40,left=20,bottom=20,right=20]',
      };
      elkNode.children = children.map(c => buildElkNode(c));
    }

    return elkNode;
  }

  const elkChildren = rootNodes.map(n => buildElkNode(n));

  // For hierarchical layout, edges must be placed at the lowest common ancestor (LCA).
  // Build a parentOf map to find ancestry chains, then place each edge at the LCA node.
  const parentOf = new Map<string, string>(); // nodeId -> parentId
  for (const n of nodes) {
    if (n.parentId && nodeIds.has(n.parentId)) {
      parentOf.set(n.id, n.parentId);
    }
  }

  function getAncestors(id: string): string[] {
    const chain: string[] = [];
    let cur = id;
    while (cur) {
      chain.push(cur);
      cur = parentOf.get(cur)!;
    }
    return chain; // [self, parent, grandparent, ..., root]
  }

  // Group edges by LCA so they get placed in the right compound node
  const edgesByOwner = new Map<string, ElkExtendedEdge[]>(); // 'root' or compound nodeId

  for (const e of edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target) || e.source === e.target) continue;
    const srcAncestors = getAncestors(e.source);
    const tgtAncestors = getAncestors(e.target);
    const tgtSet = new Set(tgtAncestors);

    let owner = 'root';
    for (const a of srcAncestors) {
      if (tgtSet.has(a)) {
        owner = a;
        break;
      }
    }

    const elkEdge: ElkExtendedEdge = { id: e.id, sources: [e.source], targets: [e.target] };
    const list = edgesByOwner.get(owner);
    if (list) list.push(elkEdge);
    else edgesByOwner.set(owner, [elkEdge]);
  }

  // Attach edges to their owner compound nodes
  function attachEdges(elkNode: ElkNode): void {
    const owned = edgesByOwner.get(elkNode.id);
    if (owned) elkNode.edges = (elkNode.edges || []).concat(owned);
    if (elkNode.children) {
      for (const child of elkNode.children) attachEdges(child);
    }
  }
  for (const child of elkChildren) attachEdges(child);

  const rootEdges = edgesByOwner.get('root') || [];

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '60',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.separateConnectedComponents': 'true',
      'elk.spacing.componentComponent': '120',
    },
    children: elkChildren,
    edges: rootEdges,
  };

  const result = await elk.layout(elkGraph);

  const positions: Record<string, { x: number; y: number }> = {};
  const sizes: Record<string, { width: number; height: number }> = {};

  // Recursively extract positions (relative to parent) and sizes
  function extractPositions(elkNodes: ElkNode[] | undefined) {
    if (!elkNodes) return;
    for (const child of elkNodes) {
      positions[child.id] = { x: child.x ?? 0, y: child.y ?? 0 };
      // Store sizes for all compound nodes so React Flow can size the containers
      if (child.children && child.children.length > 0) {
        sizes[child.id] = { width: child.width ?? 200, height: child.height ?? 100 };
      }
      extractPositions(child.children);
    }
  }

  extractPositions(result.children);

  return { positions, sizes };
}
