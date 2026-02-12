import dagre from 'dagre';

interface LayoutNode {
  id: string;
  width: number;
  height: number;
  parentNode?: string | null;
}

interface LayoutEdge {
  source: string;
  target: string;
}

export function getLayoutedElements(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  direction: 'TB' | 'LR' = 'TB'
) {
  const g = new dagre.graphlib.Graph({ compound: true });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 80, ranksep: 120, marginx: 40, marginy: 40 });

  // Only layout top-level nodes with dagre (children handled by React Flow grouping)
  const topLevelNodes = nodes.filter(n => !n.parentNode);
  const childNodes = nodes.filter(n => n.parentNode);

  topLevelNodes.forEach(node => {
    g.setNode(node.id, { width: node.width, height: node.height });
  });

  // Only add edges between top-level nodes
  const topLevelIds = new Set(topLevelNodes.map(n => n.id));
  edges.forEach(edge => {
    if (topLevelIds.has(edge.source) && topLevelIds.has(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(g);

  const positions: Record<string, { x: number; y: number }> = {};
  topLevelNodes.forEach(node => {
    const pos = g.node(node.id);
    positions[node.id] = { x: pos.x - node.width / 2, y: pos.y - node.height / 2 };
  });

  // Position child nodes relative to parent (simple grid)
  const childrenByParent = new Map<string, LayoutNode[]>();
  childNodes.forEach(n => {
    if (!n.parentNode) return;
    const list = childrenByParent.get(n.parentNode) || [];
    list.push(n);
    childrenByParent.set(n.parentNode, list);
  });

  childrenByParent.forEach((children, _parentId) => {
    const cols = Math.ceil(Math.sqrt(children.length));
    children.forEach((child, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions[child.id] = { x: 40 + col * 200, y: 60 + row * 100 };
    });
  });

  return positions;
}
