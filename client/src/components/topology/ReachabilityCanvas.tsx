import React, { useMemo, useCallback, useState, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ReachabilityResult } from '../../types';
import { getLayoutedElements, type LayoutResult } from './layouts';
import ReachabilityHopNode from './nodes/ReachabilityHopNode';

const nodeTypes = {
  reachabilityHopNode: ReachabilityHopNode,
};

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

const statusEdgeColors: Record<string, string> = {
  ALLOW: '#10B981',
  DENY: '#EF4444',
  UNKNOWN: '#9CA3AF',
};

const verdictStyles: Record<string, { bg: string; border: string; text: string }> = {
  REACHABLE: { bg: 'bg-green-50 dark:bg-green-950', border: 'border-green-300 dark:border-green-700', text: 'text-green-800 dark:text-green-200' },
  BLOCKED:   { bg: 'bg-red-50 dark:bg-red-950',     border: 'border-red-300 dark:border-red-700',     text: 'text-red-800 dark:text-red-200' },
  PARTIAL:   { bg: 'bg-amber-50 dark:bg-amber-950', border: 'border-amber-300 dark:border-amber-700', text: 'text-amber-800 dark:text-amber-200' },
  UNKNOWN:   { bg: 'bg-gray-50 dark:bg-gray-800',   border: 'border-gray-300 dark:border-gray-600',   text: 'text-gray-800 dark:text-gray-200' },
};

interface ReachabilityCanvasProps {
  result: ReachabilityResult;
  onNodeClick?: (ocid: string) => void;
}

export default function ReachabilityCanvas({ result, onNodeClick }: ReachabilityCanvasProps) {
  const { hops, links, verdict, verdictDetail } = result;

  const vs = verdictStyles[verdict] || verdictStyles.UNKNOWN;

  // Build layout input
  const layoutInput = useMemo(() => {
    const layoutNodes = hops.map(h => ({ id: h.id, width: NODE_WIDTH, height: NODE_HEIGHT }));
    const layoutEdges = links.map(l => ({ id: l.id, source: l.source, target: l.target }));
    return { layoutNodes, layoutEdges };
  }, [hops, links]);

  // Run ELK layout (RIGHT direction for horizontal flow)
  const [layoutState, setLayoutState] = useState<LayoutResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLayoutState(null);

    // Use a custom ELK layout with RIGHT direction
    import('elkjs/lib/elk.bundled.js').then(({ default: ELK }) => {
      const elk = new ELK();
      const nodeIds = new Set(layoutInput.layoutNodes.map(n => n.id));
      const elkGraph = {
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'RIGHT',
          'elk.spacing.nodeNode': '40',
          'elk.layered.spacing.nodeNodeBetweenLayers': '80',
          'elk.separateConnectedComponents': 'true',
        },
        children: layoutInput.layoutNodes.map(n => ({ id: n.id, width: n.width, height: n.height })),
        edges: layoutInput.layoutEdges
          .filter(e => nodeIds.has(e.source) && nodeIds.has(e.target) && e.source !== e.target)
          .map(e => ({ id: e.id, sources: [e.source], targets: [e.target] })),
      };
      return elk.layout(elkGraph);
    }).then(result => {
      if (cancelled) return;
      const positions: Record<string, { x: number; y: number }> = {};
      for (const child of result.children || []) {
        positions[child.id] = { x: child.x ?? 0, y: child.y ?? 0 };
      }
      setLayoutState({ positions });
    }).catch(err => {
      console.error('Reachability layout error:', err);
      if (!cancelled) {
        const positions: Record<string, { x: number; y: number }> = {};
        layoutInput.layoutNodes.forEach((n, i) => {
          positions[n.id] = { x: i * (NODE_WIDTH + 80), y: 0 };
        });
        setLayoutState({ positions });
      }
    });

    return () => { cancelled = true; };
  }, [layoutInput]);

  // Build React Flow nodes/edges
  const { flowNodes, flowEdges } = useMemo(() => {
    if (!layoutState) return { flowNodes: [], flowEdges: [] };

    const flowNodes: Node[] = hops.map(h => ({
      id: h.id,
      type: 'reachabilityHopNode',
      position: layoutState.positions[h.id] || { x: 0, y: 0 },
      data: {
        label: h.label,
        hopType: h.type,
        status: h.status,
        details: h.details,
        resourceType: h.resourceType,
        ocid: h.ocid,
      },
    }));

    const flowEdges: Edge[] = links.map(l => ({
      id: l.id,
      source: l.source,
      target: l.target,
      label: l.label || undefined,
      style: { stroke: statusEdgeColors[l.status] || '#9CA3AF', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: statusEdgeColors[l.status] || '#9CA3AF' },
      animated: l.status === 'ALLOW',
    }));

    return { flowNodes, flowEdges };
  }, [hops, links, layoutState]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  React.useEffect(() => { setNodes(flowNodes); }, [flowNodes, setNodes]);
  React.useEffect(() => { setEdges(flowEdges); }, [flowEdges, setEdges]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const ocid = (node.data as any)?.ocid;
    if (ocid && onNodeClick) onNodeClick(ocid);
  }, [onNodeClick]);

  if (!layoutState) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-sm text-gray-400 dark:text-gray-500">Computing layout...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {/* Verdict banner */}
      <div className={`absolute top-3 left-1/2 -translate-x-1/2 z-10 ${vs.bg} border ${vs.border} ${vs.text} text-sm px-4 py-2 rounded-lg shadow-sm max-w-2xl text-center`}>
        <span className="font-semibold">{verdict === 'REACHABLE' ? 'Reachable' : verdict === 'BLOCKED' ? 'Blocked' : verdict}</span>
        {verdictDetail && <span className="ml-2">&mdash; {verdictDetail}</span>}
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="dark:!bg-gray-900"
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="dark:[&>pattern>circle]:!fill-gray-600" />
      </ReactFlow>
    </div>
  );
}
