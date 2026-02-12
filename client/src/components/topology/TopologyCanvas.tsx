import React, { useMemo, useCallback } from 'react';
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
import type { TopologyNode, TopologyEdge } from '../../types';
import { getLayoutedElements } from './layouts';
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
import RelationshipEdge from './edges/RelationshipEdge';

const nodeTypes = {
  compartmentNode: CompartmentNode,
  vcnNode: VcnNode,
  subnetNode: SubnetNode,
  instanceNode: InstanceNode,
  databaseNode: DatabaseNode,
  loadBalancerNode: LoadBalancerNode,
  storageNode: StorageNode,
  gatewayNode: GatewayNode,
  securityNode: SecurityNode,
  genericNode: GenericNode,
};

const edgeTypes = {
  relationship: RelationshipEdge,
};

interface TopologyCanvasProps {
  topologyNodes: TopologyNode[];
  topologyEdges: TopologyEdge[];
  onNodeClick?: (nodeId: string) => void;
}

// Map node type to approximate dimensions for layout
const nodeDimensions: Record<string, { width: number; height: number }> = {
  compartmentNode: { width: 350, height: 250 },
  vcnNode: { width: 450, height: 300 },
  subnetNode: { width: 180, height: 80 },
  instanceNode: { width: 160, height: 70 },
  databaseNode: { width: 160, height: 60 },
  loadBalancerNode: { width: 160, height: 60 },
  storageNode: { width: 140, height: 60 },
  gatewayNode: { width: 120, height: 50 },
  securityNode: { width: 130, height: 50 },
  genericNode: { width: 140, height: 50 },
};

export default function TopologyCanvas({ topologyNodes, topologyEdges, onNodeClick }: TopologyCanvasProps) {
  const { flowNodes, flowEdges } = useMemo(() => {
    // Count children per parent to dynamically size containers
    const childCount = new Map<string, number>();
    for (const n of topologyNodes) {
      if (n.parentNode) {
        childCount.set(n.parentNode, (childCount.get(n.parentNode) || 0) + 1);
      }
    }

    // Compute dynamic size for container nodes based on child count
    function getContainerSize(nodeId: string, nodeType: string) {
      const count = childCount.get(nodeId) || 0;
      if (count === 0) {
        // No children — use minimal size
        return { width: 200, height: 80 };
      }
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      const w = Math.max(280, 40 + cols * 200 + 40);
      const h = Math.max(140, 60 + rows * 100 + 20);
      return { width: w, height: h };
    }

    const containerTypes = new Set(['compartmentNode', 'vcnNode']);

    // Get layout positions
    const layoutNodes = topologyNodes.map(n => {
      if (containerTypes.has(n.type)) {
        const size = getContainerSize(n.id, n.type);
        return { id: n.id, width: size.width, height: size.height, parentNode: n.parentNode };
      }
      return {
        id: n.id,
        width: (nodeDimensions[n.type] || nodeDimensions.genericNode).width,
        height: (nodeDimensions[n.type] || nodeDimensions.genericNode).height,
        parentNode: n.parentNode,
      };
    });
    const layoutEdges = topologyEdges.map(e => ({ source: e.source, target: e.target }));
    const positions = getLayoutedElements(layoutNodes, layoutEdges);

    // Build a map for container sizes for use in style
    const containerSizes = new Map<string, { width: number; height: number }>();
    for (const n of topologyNodes) {
      if (containerTypes.has(n.type)) {
        containerSizes.set(n.id, getContainerSize(n.id, n.type));
      }
    }

    const flowNodes: Node[] = topologyNodes.map(n => {
      const size = containerSizes.get(n.id);
      return {
        id: n.id,
        type: n.type,
        position: positions[n.id] || { x: 0, y: 0 },
        data: { label: n.label, resourceType: n.resourceType, ocid: n.ocid, lifecycleState: n.lifecycleState, metadata: n.metadata },
        ...(n.parentNode ? { parentId: n.parentNode } : {}),
        style: size ? { width: size.width, height: size.height } : undefined,
      };
    });

    const flowEdges: Edge[] = topologyEdges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'relationship',
      animated: e.animated,
      data: { label: e.label, relationType: e.relationType },
      style: e.animated ? { stroke: '#F59E0B' } : { stroke: '#94A3B8' },
    }));

    return { flowNodes, flowEdges };
  }, [topologyNodes, topologyEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Re-sync when flow data changes
  React.useEffect(() => { setNodes(flowNodes); }, [flowNodes, setNodes]);
  React.useEffect(() => { setEdges(flowEdges); }, [flowEdges, setEdges]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    onNodeClick?.(node.id);
  }, [onNodeClick]);

  return (
    <div className="w-full h-full">
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
      >
        <Controls />
        <MiniMap zoomable pannable />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}
