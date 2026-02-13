import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import type { TopologyNode, TopologyEdge } from '../../types';
import { getLayoutedElements, type LayoutResult } from './layouts';
import CompartmentNode from './nodes/CompartmentNode';
import VcnNode from './nodes/VcnNode';
import SubnetNode from './nodes/SubnetNode';
import InstanceNode from './nodes/InstanceNode';
import DatabaseNode from './nodes/DatabaseNode';
import LoadBalancerNode from './nodes/LoadBalancerNode';
import StorageNode from './nodes/StorageNode';
import GatewayNode from './nodes/GatewayNode';
import GenericNode from './nodes/GenericNode';
import SecurityNode from './nodes/SecurityNode';
import ContainerNode from './nodes/ContainerNode';
import ServerlessNode from './nodes/ServerlessNode';
import IamNode from './nodes/IamNode';
import InternetNode from './nodes/InternetNode';
import OracleServicesNode from './nodes/OracleServicesNode';
import InstanceSummaryNode from './nodes/InstanceSummaryNode';
import RelationshipEdge from './edges/RelationshipEdge';

const nodeTypes = {
  compartmentNode: CompartmentNode,
  vcnNode: VcnNode,
  subnetNode: SubnetNode,
  instanceNode: InstanceNode,
  instanceSummaryNode: InstanceSummaryNode,
  databaseNode: DatabaseNode,
  loadBalancerNode: LoadBalancerNode,
  storageNode: StorageNode,
  gatewayNode: GatewayNode,
  securityNode: SecurityNode,
  containerNode: ContainerNode,
  serverlessNode: ServerlessNode,
  iamNode: IamNode,
  internetNode: InternetNode,
  oracleServicesNode: OracleServicesNode,
  genericNode: GenericNode,
};

const edgeTypes = {
  relationship: RelationshipEdge,
};

const CLIENT_NODE_CAP = 5000;

interface TopologyCanvasProps {
  topologyNodes: TopologyNode[];
  topologyEdges: TopologyEdge[];
  totalCount?: number;
  truncated?: boolean;
  onNodeClick?: (nodeId: string) => void;
}

// Map node type to approximate dimensions for layout
const nodeDimensions: Record<string, { width: number; height: number }> = {
  compartmentNode: { width: 280, height: 160 },
  vcnNode: { width: 220, height: 70 },
  subnetNode: { width: 180, height: 60 },
  instanceNode: { width: 160, height: 70 },
  instanceSummaryNode: { width: 160, height: 60 },
  databaseNode: { width: 160, height: 60 },
  loadBalancerNode: { width: 160, height: 60 },
  storageNode: { width: 140, height: 60 },
  gatewayNode: { width: 120, height: 50 },
  securityNode: { width: 130, height: 50 },
  containerNode: { width: 150, height: 60 },
  serverlessNode: { width: 150, height: 55 },
  iamNode: { width: 130, height: 50 },
  internetNode: { width: 130, height: 55 },
  oracleServicesNode: { width: 150, height: 55 },
  genericNode: { width: 140, height: 50 },
};

export default function TopologyCanvas({ topologyNodes, topologyEdges, totalCount, truncated, onNodeClick }: TopologyCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  // Client-side safety cap
  const clientTruncated = topologyNodes.length > CLIENT_NODE_CAP;
  const cappedNodes = clientTruncated ? topologyNodes.slice(0, CLIENT_NODE_CAP) : topologyNodes;
  const cappedNodeIds = clientTruncated ? new Set(cappedNodes.map(n => n.id)) : null;
  const cappedEdges = clientTruncated
    ? topologyEdges.filter(e => cappedNodeIds!.has(e.source) && cappedNodeIds!.has(e.target))
    : topologyEdges;

  const hasSummaryNodes = cappedNodes.some(n => n.type === 'instanceSummaryNode');
  const showWarning = truncated || clientTruncated || hasSummaryNodes;
  const displayCount = cappedNodes.length;
  const displayTotal = totalCount ?? topologyNodes.length;

  // Build all edges: server edges + synthetic hierarchy edges from parentNode
  const allEdges = useMemo(() => {
    const visibleIds = new Set(cappedNodes.map(n => n.id));

    // Existing edge pairs (to avoid duplicates)
    const existingPairs = new Set(cappedEdges.map(e => `${e.source}:${e.target}`));

    // Create hierarchy edges from parentNode relationships
    const hierarchyEdges: TopologyEdge[] = [];
    for (const n of cappedNodes) {
      if (n.parentNode && visibleIds.has(n.parentNode)) {
        const pair = `${n.parentNode}:${n.id}`;
        const reversePair = `${n.id}:${n.parentNode}`;
        if (!existingPairs.has(pair) && !existingPairs.has(reversePair)) {
          hierarchyEdges.push({
            id: `hier-${n.id}`,
            source: n.parentNode,
            target: n.id,
            label: null,
            relationType: 'contains',
            animated: false,
          });
        }
      }
    }

    return [...cappedEdges, ...hierarchyEdges];
  }, [cappedNodes, cappedEdges]);

  // Build layout input
  const layoutInput = useMemo(() => {
    const layoutNodes = cappedNodes.map(n => ({
      id: n.id,
      width: (nodeDimensions[n.type] || nodeDimensions.genericNode).width,
      height: (nodeDimensions[n.type] || nodeDimensions.genericNode).height,
    }));
    const layoutEdges = allEdges.map(e => ({ id: e.id, source: e.source, target: e.target }));
    return { layoutNodes, layoutEdges };
  }, [cappedNodes, allEdges]);

  // Run ELK layout asynchronously
  const [layoutState, setLayoutState] = useState<LayoutResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLayoutState(null);

    getLayoutedElements(layoutInput.layoutNodes, layoutInput.layoutEdges)
      .then(result => {
        if (!cancelled) setLayoutState(result);
      })
      .catch(err => {
        console.error('ELK layout error:', err);
        if (!cancelled) {
          const positions: Record<string, { x: number; y: number }> = {};
          const cols = Math.max(1, Math.ceil(Math.sqrt(layoutInput.layoutNodes.length)));
          layoutInput.layoutNodes.forEach((n, i) => {
            positions[n.id] = { x: (i % cols) * 250, y: Math.floor(i / cols) * 150 };
          });
          setLayoutState({ positions });
        }
      });

    return () => { cancelled = true; };
  }, [layoutInput]);

  // Build React Flow nodes and edges
  const { flowNodes, flowEdges } = useMemo(() => {
    if (!layoutState) return { flowNodes: [], flowEdges: [] };

    const positions = { ...layoutState.positions };

    // Pin synthetic nodes (Internet, Oracle Services) to top-center above all other nodes
    const syntheticTypes = new Set(['internetNode', 'oracleServicesNode']);
    const syntheticNodes = cappedNodes.filter(n => syntheticTypes.has(n.type));
    if (syntheticNodes.length > 0 && Object.keys(positions).length > syntheticNodes.length) {
      const syntheticIds = new Set(syntheticNodes.map(n => n.id));
      let minX = Infinity, maxX = -Infinity, minY = Infinity;
      for (const [id, pos] of Object.entries(positions)) {
        if (syntheticIds.has(id)) continue;
        if (pos.x < minX) minX = pos.x;
        if (pos.x > maxX) maxX = pos.x;
        if (pos.y < minY) minY = pos.y;
      }
      const centerX = (minX + maxX) / 2;
      const spacing = 200;
      const totalWidth = (syntheticNodes.length - 1) * spacing;
      syntheticNodes.forEach((n, i) => {
        positions[n.id] = {
          x: centerX - totalWidth / 2 + i * spacing,
          y: minY - 120,
        };
      });
    }

    // All nodes are flat — no parentId, fully draggable
    const flowNodes: Node[] = cappedNodes.map(n => ({
      id: n.id,
      type: n.type,
      position: positions[n.id] || { x: 0, y: 0 },
      data: {
        label: n.label,
        resourceType: n.resourceType,
        ocid: n.ocid,
        lifecycleState: n.lifecycleState,
        metadata: n.metadata,
      },
    }));

    // All edges rendered — hierarchy edges styled differently from relationship edges
    const flowEdges: Edge[] = allEdges.map(e => {
      const isHierarchy = e.id.startsWith('hier-') || e.relationType === 'contains' || e.relationType === 'parent';
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'relationship',
        animated: e.animated,
        data: { label: isHierarchy ? null : e.label, relationType: e.relationType },
        style: isHierarchy
          ? { stroke: '#CBD5E1', strokeDasharray: '6 3' }
          : e.animated
            ? { stroke: '#F59E0B' }
            : { stroke: '#94A3B8' },
      };
    });

    return { flowNodes, flowEdges };
  }, [cappedNodes, allEdges, layoutState]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  React.useEffect(() => { setNodes(flowNodes); }, [flowNodes, setNodes]);
  React.useEffect(() => { setEdges(flowEdges); }, [flowEdges, setEdges]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    // Skip synthetic nodes (no real resource to show)
    if (node.type === 'internetNode' || node.type === 'oracleServicesNode' || node.type === 'instanceSummaryNode') return;
    onNodeClick?.(node.id);
  }, [onNodeClick]);

  const handleExportPng = useCallback(async () => {
    if (!containerRef.current || exporting) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(containerRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      link.download = `topology-${date}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('PNG export failed:', err);
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  if (!layoutState) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-gray-200 dark:border-gray-700 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm text-gray-400 dark:text-gray-500">Computing layout...</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {showWarning && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-sm px-4 py-2 rounded-lg shadow-sm">
          {hasSummaryNodes
            ? `${displayTotal.toLocaleString()} resources total — instances collapsed into counts per subnet/VCN. Filter by compartment to see individual instances.`
            : `Showing ${displayCount.toLocaleString()} of ${displayTotal.toLocaleString()} resources. Filter by compartment to see more.`}
        </div>
      )}

      {/* Export PNG button */}
      <button
        onClick={handleExportPng}
        disabled={exporting}
        className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors dark:text-gray-200"
        title="Export as PNG"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {exporting ? 'Exporting...' : 'Export PNG'}
      </button>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="dark:!bg-gray-900"
      >
        <Controls />
        <MiniMap zoomable pannable />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="dark:[&>pattern>circle]:!fill-gray-600" />
      </ReactFlow>
    </div>
  );
}
