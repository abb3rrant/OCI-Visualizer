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
  genericNode: { width: 140, height: 50 },
};

export default function TopologyCanvas({ topologyNodes, topologyEdges, onNodeClick }: TopologyCanvasProps) {
  const { flowNodes, flowEdges } = useMemo(() => {
    // Get layout positions
    const layoutNodes = topologyNodes.map(n => ({
      id: n.id,
      width: (nodeDimensions[n.type] || nodeDimensions.genericNode).width,
      height: (nodeDimensions[n.type] || nodeDimensions.genericNode).height,
      parentNode: n.parentNode,
    }));
    const layoutEdges = topologyEdges.map(e => ({ source: e.source, target: e.target }));
    const positions = getLayoutedElements(layoutNodes, layoutEdges);

    const flowNodes: Node[] = topologyNodes.map(n => ({
      id: n.id,
      type: n.type,
      position: positions[n.id] || { x: 0, y: 0 },
      data: { label: n.label, resourceType: n.resourceType, ocid: n.ocid, lifecycleState: n.lifecycleState, metadata: n.metadata },
      ...(n.parentNode ? { parentId: n.parentNode, extent: 'parent' as const } : {}),
      style: ['compartmentNode', 'vcnNode'].includes(n.type) ? { width: nodeDimensions[n.type]?.width, height: nodeDimensions[n.type]?.height } : undefined,
    }));

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
