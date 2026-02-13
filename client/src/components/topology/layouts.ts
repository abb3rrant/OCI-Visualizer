import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

export interface LayoutNode {
  id: string;
  width: number;
  height: number;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
}

export interface LayoutResult {
  positions: Record<string, { x: number; y: number }>;
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
