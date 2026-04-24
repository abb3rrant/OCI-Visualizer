import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useViewport,
  ReactFlowProvider,
  SelectionMode,
  type Node,
  type Edge,
  type OnSelectionChangeParams,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import type { TopologyNode, TopologyEdge, ViewType, Severity } from '../../types';
import { getLayoutedElements, getHierarchicalLayout, type LayoutResult } from './layouts';
import TopologySearchToolbar from './TopologySearchToolbar';
import CompartmentNode from './nodes/CompartmentNode';
import VcnNode, { VcnGroupNode } from './nodes/VcnNode';
import SubnetNode, { SubnetGroupNode } from './nodes/SubnetNode';
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

// Stable references — defined outside component so they never change
const NODE_TYPES = {
  compartmentNode: CompartmentNode,
  vcnNode: VcnNode,
  vcnNodeGroup: VcnGroupNode,
  subnetNode: SubnetNode,
  subnetNodeGroup: SubnetGroupNode,
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

const EDGE_TYPES = {
  relationship: RelationshipEdge,
};

const CLIENT_NODE_CAP = 5000;

// Minimap node color mapping
const MINIMAP_NODE_COLORS: Record<string, string> = {
  vcnNode: '#A855F7',
  vcnNodeGroup: '#A855F7',
  subnetNode: '#3B82F6',
  subnetNodeGroup: '#3B82F6',
  instanceNode: '#60A5FA',
  instanceSummaryNode: '#93C5FD',
  databaseNode: '#EC4899',
  loadBalancerNode: '#F59E0B',
  storageNode: '#6B7280',
  gatewayNode: '#8B5CF6',
  securityNode: '#DC2626',
  containerNode: '#06B6D4',
  serverlessNode: '#A855F7',
  iamNode: '#78716C',
  internetNode: '#3B82F6',
  oracleServicesNode: '#F97316',
  compartmentNode: '#F59E0B',
  genericNode: '#9CA3AF',
};

export interface DiffData {
  added: Set<string>;
  changed: Set<string>;
  removed: { ocid: string; name: string; type: string }[];
}

export interface TopologyCanvasProps {
  topologyNodes: TopologyNode[];
  topologyEdges: TopologyEdge[];
  totalCount?: number;
  truncated?: boolean;
  onNodeClick?: (nodeId: string) => void;
  viewType?: ViewType;
  onStartReachability?: (sourceIp?: string, destIp?: string) => void;
  heatmapEnabled?: boolean;
  resourceSeverityMap?: Map<string, Severity>;
  diffData?: DiffData;
  onExpandInstances?: (parentOcids: string[]) => Promise<TopologyNode[]>;
  focusNodeId?: string;
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

const defaultDim = nodeDimensions.genericNode;

// Severity heatmap styles
const SEVERITY_STYLES: Record<string, React.CSSProperties> = {
  CRITICAL: { border: '3px solid #DC2626', boxShadow: '0 0 12px rgba(220, 38, 38, 0.5)' },
  HIGH: { border: '3px solid #F97316', boxShadow: '0 0 10px rgba(249, 115, 22, 0.4)' },
  MEDIUM: { border: '3px solid #EAB308' },
  LOW: { border: '2px solid #3B82F6' },
};

// Zoom-aware compact mode: use CSS class on container instead of updating every node
function ZoomWatcher({ onCompactChange }: { onCompactChange: (compact: boolean) => void }) {
  const { zoom } = useViewport();
  const compact = zoom < 0.5;
  const prevCompact = useRef(compact);

  useEffect(() => {
    if (prevCompact.current !== compact) {
      prevCompact.current = compact;
      onCompactChange(compact);
    }
  }, [compact, onCompactChange]);

  return null;
}

export default function TopologyCanvas(props: TopologyCanvasProps) {
  return (
    <ReactFlowProvider>
      <TopologyCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function TopologyCanvasInner({
  topologyNodes, topologyEdges, totalCount, truncated, onNodeClick,
  viewType, onStartReachability, heatmapEnabled, resourceSeverityMap, diffData,
  onExpandInstances, focusNodeId,
}: TopologyCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [searchFilterMode, setSearchFilterMode] = useState<'highlight' | 'dim' | 'hide'>('highlight');
  const [syntheticInfo, setSyntheticInfo] = useState<any>(null);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [selectedOnlyIds, setSelectedOnlyIds] = useState<Set<string> | null>(null);
  const [focusedParentId, setFocusedParentId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeData: any } | null>(null);
  const [showRemovedPanel, setShowRemovedPanel] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [vcnInfo, setVcnInfo] = useState<any>(null);
  const [expandedNodes, setExpandedNodes] = useState<TopologyNode[]>([]);
  const [expanding, setExpanding] = useState(false);
  const reactFlowInstance = useReactFlow();

  const [groupedLayout, setGroupedLayout] = useState(false);
  const isHierarchicalView = groupedLayout && viewType === 'NETWORK';

  // Stable callback for ZoomWatcher
  const handleCompactChange = useCallback((compact: boolean) => {
    setIsCompact(compact);
  }, []);

  // Merge expanded instance nodes: replace summary nodes, strip parentNode so
  // instances lay out freely without hierarchy edges to the subnet
  const mergedTopologyNodes = useMemo(() => {
    if (expandedNodes.length === 0) return topologyNodes;
    const expandedParentIds = new Set(expandedNodes.map(n => n.parentNode).filter(Boolean) as string[]);
    const filtered = topologyNodes.filter(n =>
      !(n.type === 'instanceSummaryNode' && n.parentNode && expandedParentIds.has(n.parentNode))
    );
    const freeInstances = expandedNodes.map(n => ({ ...n, parentNode: null }));
    return [...filtered, ...freeInstances];
  }, [topologyNodes, expandedNodes]);

  // Build parent->children map once for efficient BFS in focus mode
  const childrenByParent = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const n of mergedTopologyNodes) {
      if (n.parentNode) {
        let children = map.get(n.parentNode);
        if (!children) {
          children = [];
          map.set(n.parentNode, children);
        }
        children.push(n.id);
      }
    }
    return map;
  }, [mergedTopologyNodes]);

  // Filter by hidden types BEFORE layout so layout adapts
  const filteredNodes = useMemo(() => {
    let result = mergedTopologyNodes;
    if (hiddenTypes.size > 0) {
      result = result.filter(n => !hiddenTypes.has(n.resourceType));
    }
    // Feature 8: hide mode — remove non-matching nodes
    if (searchQuery.trim() && searchFilterMode === 'hide') {
      const q = searchQuery.toLowerCase();
      result = result.filter(n =>
        n.label.toLowerCase().includes(q) || n.ocid.toLowerCase().includes(q)
      );
    }
    // Feature 3: selectedOnlyIds filter
    if (selectedOnlyIds) {
      result = result.filter(n => selectedOnlyIds.has(n.id));
    }
    // Feature 7: focus mode — O(n) BFS using pre-computed children map
    if (focusedParentId) {
      const focusedIds = new Set<string>();
      const queue = [focusedParentId];
      focusedIds.add(focusedParentId);
      while (queue.length > 0) {
        const parentId = queue.shift()!;
        const children = childrenByParent.get(parentId);
        if (children) {
          for (const childId of children) {
            if (!focusedIds.has(childId)) {
              focusedIds.add(childId);
              queue.push(childId);
            }
          }
        }
      }
      result = result.filter(n => focusedIds.has(n.id));
    }
    return result;
  }, [mergedTopologyNodes, hiddenTypes, searchQuery, searchFilterMode, selectedOnlyIds, focusedParentId, childrenByParent]);

  // Compute matched node IDs for search highlighting (only when query changes)
  const matchedNodeIds = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    const ids = new Set<string>();
    for (const n of filteredNodes) {
      if (n.label.toLowerCase().includes(q) || n.ocid.toLowerCase().includes(q)) {
        ids.add(n.id);
      }
    }
    return ids;
  }, [filteredNodes, searchQuery]);

  // Node labels for search toolbar — memoized on topology identity
  const nodeLabels = useMemo(() =>
    mergedTopologyNodes.map(n => ({ id: n.id, label: n.label, ocid: n.ocid, resourceType: n.resourceType })),
    [mergedTopologyNodes],
  );

  const handleFocusNode = useCallback((nodeId: string) => {
    reactFlowInstance.fitView({ nodes: [{ id: nodeId }], duration: 400, padding: 0.5 });
  }, [reactFlowInstance]);

  // Client-side safety cap
  const clientTruncated = filteredNodes.length > CLIENT_NODE_CAP;
  const cappedNodes = clientTruncated ? filteredNodes.slice(0, CLIENT_NODE_CAP) : filteredNodes;
  const cappedNodeIds = useMemo(
    () => clientTruncated ? new Set(cappedNodes.map(n => n.id)) : null,
    [cappedNodes, clientTruncated],
  );
  const cappedEdges = useMemo(
    () => clientTruncated
      ? topologyEdges.filter(e => cappedNodeIds!.has(e.source) && cappedNodeIds!.has(e.target))
      : topologyEdges,
    [topologyEdges, cappedNodeIds, clientTruncated],
  );

  const hasSummaryNodes = cappedNodes.some(n => n.type === 'instanceSummaryNode');
  const showWarning = truncated || clientTruncated || hasSummaryNodes;
  const displayCount = cappedNodes.length;
  const displayTotal = totalCount ?? mergedTopologyNodes.length;

  // Build all edges: server edges + synthetic hierarchy edges from parentNode
  const allEdges = useMemo(() => {
    const visibleIds = new Set(cappedNodes.map(n => n.id));

    // For hierarchical view, don't create hierarchy edges (children are nested).
    // Also filter out edges that are containment relationships (parent→child).
    if (isHierarchicalView) {
      const childToParent = new Map<string, string>();
      for (const n of cappedNodes) {
        if (n.parentNode && visibleIds.has(n.parentNode)) {
          childToParent.set(n.id, n.parentNode);
        }
      }
      return cappedEdges.filter(e => {
        if (!visibleIds.has(e.source) || !visibleIds.has(e.target)) return false;
        // Skip containment edges (parent→child or child→parent)
        if (childToParent.get(e.target) === e.source) return false;
        if (childToParent.get(e.source) === e.target) return false;
        return true;
      });
    }

    const existingPairs = new Set<string>();
    for (const e of cappedEdges) {
      existingPairs.add(`${e.source}:${e.target}`);
    }

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
  }, [cappedNodes, cappedEdges, isHierarchicalView]);

  // Structural signature for layout — only re-layout when node IDs or edge topology changes
  const layoutSignature = useMemo(() => {
    const nodeIds = cappedNodes.map(n => n.id).sort().join(',');
    const edgeIds = allEdges.map(e => `${e.source}-${e.target}`).sort().join(',');
    return `${isHierarchicalView}:${nodeIds}:${edgeIds}`;
  }, [cappedNodes, allEdges, isHierarchicalView]);

  // Build layout input (only when structure changes)
  const layoutInput = useMemo(() => {
    const layoutNodes = cappedNodes.map(n => ({
      id: n.id,
      width: (nodeDimensions[n.type] || defaultDim).width,
      height: (nodeDimensions[n.type] || defaultDim).height,
      parentId: isHierarchicalView ? (n.parentNode || undefined) : undefined,
      nodeType: n.type,
    }));
    const layoutEdges = allEdges.map(e => ({ id: e.id, source: e.source, target: e.target }));
    return { layoutNodes, layoutEdges };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutSignature]);

  // Run ELK layout asynchronously
  const [layoutState, setLayoutState] = useState<LayoutResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLayoutState(null);

    const layoutFn = isHierarchicalView
      ? getHierarchicalLayout(layoutInput.layoutNodes, layoutInput.layoutEdges)
      : getLayoutedElements(layoutInput.layoutNodes, layoutInput.layoutEdges);

    layoutFn
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
  }, [layoutInput, isHierarchicalView]);

  // Pre-compute node ID set for O(1) parent existence checks
  const cappedNodeIdSet = useMemo(() => new Set(cappedNodes.map(n => n.id)), [cappedNodes]);

  // Build React Flow nodes and edges
  const { flowNodes, flowEdges } = useMemo(() => {
    if (!layoutState) return { flowNodes: [], flowEdges: [] };

    const positions = { ...layoutState.positions };
    const sizes = layoutState.sizes || {};

    // Pin synthetic nodes to top-center above all other nodes
    const syntheticTypes = new Set(['internetNode', 'oracleServicesNode']);
    const syntheticNodesList = cappedNodes.filter(n => syntheticTypes.has(n.type));
    if (syntheticNodesList.length > 0 && Object.keys(positions).length > syntheticNodesList.length) {
      const syntheticIds = new Set(syntheticNodesList.map(n => n.id));
      let minX = Infinity, maxX = -Infinity, minY = Infinity;
      for (const [id, pos] of Object.entries(positions)) {
        if (syntheticIds.has(id)) continue;
        if (pos.x < minX) minX = pos.x;
        if (pos.x > maxX) maxX = pos.x;
        if (pos.y < minY) minY = pos.y;
      }
      const centerX = (minX + maxX) / 2;
      const spacing = 200;
      const totalWidth = (syntheticNodesList.length - 1) * spacing;
      syntheticNodesList.forEach((n, i) => {
        positions[n.id] = {
          x: centerX - totalWidth / 2 + i * spacing,
          y: minY - 120,
        };
      });
    }

    const flowNodes: Node[] = cappedNodes.map(n => {
      const isGroup = isHierarchicalView && (n.type === 'vcnNode' || n.type === 'subnetNode');
      const nodeType = isGroup ? (n.type === 'vcnNode' ? 'vcnNodeGroup' : 'subnetNodeGroup') : n.type;
      const size = sizes[n.id];

      // Determine style overrides
      let style: React.CSSProperties | undefined;
      if (isGroup && size) {
        style = { width: size.width, height: size.height };
      }

      // Feature 8: dim mode
      const isDimmed = searchFilterMode === 'dim' && matchedNodeIds && !matchedNodeIds.has(n.id);

      // Feature 11: heatmap severity
      const severity = heatmapEnabled && resourceSeverityMap?.get(n.id);
      const severityStyle = severity ? SEVERITY_STYLES[severity] : undefined;

      // Feature 9: diff styles
      let diffStyle: React.CSSProperties | undefined;
      if (diffData) {
        if (diffData.added.has(n.ocid)) {
          diffStyle = { border: '3px solid #10B981', boxShadow: '0 0 10px rgba(16, 185, 129, 0.4)' };
        } else if (diffData.changed.has(n.ocid)) {
          diffStyle = { border: '3px solid #F59E0B', boxShadow: '0 0 10px rgba(245, 158, 11, 0.4)' };
        }
      }

      const hasOverrides = style || severityStyle || diffStyle || isDimmed;
      let combinedStyle: React.CSSProperties | undefined;
      if (hasOverrides) {
        combinedStyle = { ...style, ...severityStyle, ...diffStyle };
        if (isDimmed) {
          combinedStyle!.opacity = 0.15;
          combinedStyle!.pointerEvents = 'none';
        }
      }

      const node: Node = {
        id: n.id,
        type: nodeType,
        position: positions[n.id] || { x: 0, y: 0 },
        className: matchedNodeIds && matchedNodeIds.has(n.id) && searchFilterMode === 'highlight' ? 'rf-highlighted' : undefined,
        data: {
          label: n.label,
          resourceType: n.resourceType,
          ocid: n.ocid,
          lifecycleState: n.lifecycleState,
          metadata: n.metadata,
          compact: isCompact,
          style: isGroup && size ? { width: size.width, height: size.height } : undefined,
        },
        style: combinedStyle,
      };

      // Hierarchical view: group nodes need explicit dimensions and lower zIndex
      if (isGroup && size) {
        node.width = size.width;
        node.height = size.height;
        node.zIndex = -1;
      }

      // Hierarchical view: set parentId for child nodes
      if (isHierarchicalView && n.parentNode && cappedNodeIdSet.has(n.parentNode)) {
        node.parentId = n.parentNode;
      }

      return node;
    });

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
  }, [cappedNodes, allEdges, layoutState, matchedNodeIds, searchFilterMode,
      heatmapEnabled, resourceSeverityMap, diffData, isHierarchicalView, isCompact, cappedNodeIdSet]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  React.useEffect(() => { setNodes(flowNodes); }, [flowNodes, setNodes]);
  React.useEffect(() => { setEdges(flowEdges); }, [flowEdges, setEdges]);

  // Focus on a specific node when focusNodeId is set
  React.useEffect(() => {
    if (!focusNodeId || flowNodes.length === 0) return;
    const targetNode = flowNodes.find(n => n.id === focusNodeId);
    if (!targetNode) return;
    // Delay to allow layout to complete
    const timer = setTimeout(() => {
      reactFlowInstance.fitView({ nodes: [{ id: focusNodeId }], duration: 600, padding: 0.5 });
    }, 500);
    return () => clearTimeout(timer);
  }, [focusNodeId, flowNodes, reactFlowInstance]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    // Feature 5: synthetic node info card
    if (node.type === 'internetNode' || node.type === 'oracleServicesNode') {
      setSyntheticInfo(node.data);
      setVcnInfo(null);
      return;
    }
    if (node.type === 'instanceSummaryNode') return;
    // VCN instance list panel
    if (node.type === 'vcnNode' || node.type === 'vcnNodeGroup') {
      const d = node.data as any;
      if (d?.metadata?.subnets?.length > 0) {
        setVcnInfo(d);
        setSyntheticInfo(null);
      } else {
        setVcnInfo(null);
      }
    } else {
      setVcnInfo(null);
    }
    onNodeClick?.(node.id);
  }, [onNodeClick]);

  // Feature 7: double-click to focus
  const handleNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'vcnNode' || node.type === 'vcnNodeGroup' ||
        node.type === 'subnetNode' || node.type === 'subnetNodeGroup' ||
        node.type === 'compartmentNode') {
      setFocusedParentId(node.id);
    }
  }, []);

  // Feature 10: context menu
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    const d = node.data as any;
    const ip = d?.metadata?.privateIp || d?.metadata?.cidrBlock || d?.metadata?.ipAddress;
    if (ip) {
      setContextMenu({ x: event.clientX, y: event.clientY, nodeData: { ...d, ip, nodeId: node.id } });
    }
  }, []);

  // Feature 3: selection change
  const handleSelectionChange = useCallback(({ nodes }: OnSelectionChangeParams) => {
    setSelectedNodes(nodes);
  }, []);

  // O(1) lookup map for topology nodes — avoids repeated O(n) find() calls
  const nodeById = useMemo(() => {
    const map = new Map<string, TopologyNode>();
    for (const n of mergedTopologyNodes) map.set(n.id, n);
    return map;
  }, [mergedTopologyNodes]);

  // Feature 3: show only selected (expand to include all descendants, expanding collapsed instances)
  const handleShowOnlySelected = useCallback(async () => {
    if (selectedNodes.length === 0) return;
    const ids = new Set(selectedNodes.map(n => n.id));
    // BFS: expand container nodes to include all children
    const queue = [...ids];
    while (queue.length > 0) {
      const parentId = queue.shift()!;
      const children = childrenByParent.get(parentId);
      if (children) {
        for (const childId of children) {
          if (!ids.has(childId)) {
            ids.add(childId);
            queue.push(childId);
          }
        }
      }
    }

    // Check for summary nodes — these need to be expanded from the server
    const summaryNodeParentOcids: string[] = [];
    for (const id of ids) {
      const node = nodeById.get(id);
      if (node?.type === 'instanceSummaryNode' && node.parentNode) {
        const parent = nodeById.get(node.parentNode);
        if (parent?.ocid) summaryNodeParentOcids.push(parent.ocid);
      }
    }

    if (summaryNodeParentOcids.length > 0 && onExpandInstances) {
      setExpanding(true);
      try {
        const expanded = await onExpandInstances(summaryNodeParentOcids);
        setExpandedNodes(expanded);
        // Add expanded instance IDs to the filter set and remove summary node IDs
        const expandedParentDbIds = new Set(expanded.map(n => n.parentNode).filter(Boolean) as string[]);
        for (const id of [...ids]) {
          const node = nodeById.get(id);
          if (node?.type === 'instanceSummaryNode' && node.parentNode && expandedParentDbIds.has(node.parentNode)) {
            ids.delete(id);
          }
        }
        for (const n of expanded) ids.add(n.id);
      } finally {
        setExpanding(false);
      }
    }

    setSelectedOnlyIds(ids);
  }, [selectedNodes, childrenByParent, nodeById, onExpandInstances]);

  // Feature 3: export subgraph
  const handleExportSubgraph = useCallback(async () => {
    if (!containerRef.current || selectedNodes.length === 0) return;
    setExporting(true);
    try {
      await reactFlowInstance.fitView({ nodes: selectedNodes.map(n => ({ id: n.id })), duration: 300, padding: 0.2 });
      await new Promise(r => setTimeout(r, 350));
      const dataUrl = await toPng(containerRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `topology-subgraph-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Subgraph export failed:', err);
    } finally {
      setExporting(false);
    }
  }, [selectedNodes, reactFlowInstance]);

  // Feature 3: clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedNodes([]);
    setSelectedOnlyIds(null);
    setExpandedNodes([]);
  }, []);

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

  // Close context menu on click outside — single persistent listener
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu]);

  // Minimap color callback
  const minimapNodeColor = useCallback((node: Node) => {
    return MINIMAP_NODE_COLORS[node.type || ''] || '#9CA3AF';
  }, []);

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

  const isSearchActive = matchedNodeIds !== null && matchedNodeIds.size > 0;

  return (
    <div ref={containerRef} className={`w-full h-full relative ${isSearchActive ? 'topology-search-active' : ''}`}>
      {/* Search & Filter toolbar */}
      <TopologySearchToolbar
        nodeLabels={nodeLabels}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        hiddenTypes={hiddenTypes}
        onHiddenTypesChange={setHiddenTypes}
        onFocusNode={handleFocusNode}
        filterMode={searchFilterMode}
        onFilterModeChange={setSearchFilterMode}
      />

      {showWarning && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-sm px-4 py-2 rounded-lg shadow-sm">
          {hasSummaryNodes
            ? `${displayTotal.toLocaleString()} resources total — instances collapsed into counts per subnet/VCN. Filter by compartment to see individual instances.`
            : `Showing ${displayCount.toLocaleString()} of ${displayTotal.toLocaleString()} resources. Filter by compartment to see more.`}
        </div>
      )}

      {/* Top-right toolbar buttons */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        {viewType === 'NETWORK' && (
          <button
            onClick={() => setGroupedLayout(!groupedLayout)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg shadow-sm transition-colors ${
              groupedLayout
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-600'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            title="Toggle grouped VCN/Subnet containers"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4z" />
            </svg>
            {groupedLayout ? 'Grouped' : 'Flat'}
          </button>
        )}
        <button
          onClick={handleExportPng}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors dark:text-gray-200"
          title="Export as PNG"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {exporting ? 'Exporting...' : 'Export PNG'}
        </button>
      </div>

      {/* Feature 7: Focus mode breadcrumb */}
      {focusedParentId && (
        <div className="absolute top-14 left-3 z-10 flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm px-3 py-1.5">
          <button
            onClick={() => setFocusedParentId(null)}
            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to full view
          </button>
        </div>
      )}

      {/* Feature 3: Selection action bar */}
      {selectedNodes.length > 0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg px-4 py-2">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{selectedNodes.length} selected</span>
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
          <button
            onClick={handleShowOnlySelected}
            disabled={expanding}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 disabled:opacity-50"
          >
            {expanding ? 'Expanding...' : 'Show Only Selected'}
          </button>
          <button
            onClick={handleExportSubgraph}
            disabled={exporting}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 disabled:opacity-50"
          >
            Export Subgraph
          </button>
          <button
            onClick={handleClearSelection}
            className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700"
          >
            Clear
          </button>
        </div>
      )}

      {/* Feature 5: Synthetic node info card */}
      {syntheticInfo && (
        <div className="absolute top-14 right-3 z-20 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold dark:text-gray-200">{syntheticInfo.label}</span>
            <button onClick={() => setSyntheticInfo(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {syntheticInfo.metadata?.connectedGateways ? (
            <>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {syntheticInfo.metadata.connectionCount || syntheticInfo.metadata.connectedGateways.length} connected gateways
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {syntheticInfo.metadata.connectedGateways.map((gw: any, i: number) => (
                  <div key={i} className="text-xs flex items-center gap-2 p-1.5 bg-gray-50 dark:bg-gray-700/50 rounded">
                    <span className="font-medium dark:text-gray-200">{gw.name}</span>
                    <span className="text-gray-400 dark:text-gray-500">{gw.type}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {syntheticInfo.resourceType === 'internet'
                ? 'Represents connectivity to the public internet via IGW, NAT, and public LBs.'
                : 'Represents Oracle Services Network connectivity via service gateways.'}
            </div>
          )}
        </div>
      )}

      {/* VCN instance list panel — grouped by subnet */}
      {vcnInfo && (
        <div className="absolute top-14 right-3 z-20 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold dark:text-gray-200">{vcnInfo.label}</span>
            <button onClick={() => setVcnInfo(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {vcnInfo.metadata?.cidrBlock && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-mono">{vcnInfo.metadata.cidrBlock}</div>
          )}
          <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-3">
            {vcnInfo.metadata?.instanceCount ?? 0} compute instance{(vcnInfo.metadata?.instanceCount ?? 0) !== 1 ? 's' : ''} across {vcnInfo.metadata?.subnets?.length ?? 0} subnet{(vcnInfo.metadata?.subnets?.length ?? 0) !== 1 ? 's' : ''}
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {(vcnInfo.metadata?.subnets || []).map((sub: any, si: number) => (
              <div key={si}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 truncate">{sub.subnetName}</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 ml-2">{sub.totalInstances}</span>
                </div>
                <div className="space-y-0.5">
                  {(sub.instances || []).map((inst: any, ii: number) => (
                    <div
                      key={ii}
                      className="text-xs flex items-center justify-between gap-2 p-1.5 bg-gray-50 dark:bg-gray-700/50 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => {
                        const n = nodes.find(nd => (nd.data as any)?.ocid === inst.ocid);
                        if (n) {
                          onNodeClick?.(n.id);
                          reactFlowInstance.fitView({ nodes: [{ id: n.id }], duration: 400, padding: 0.5 });
                        }
                      }}
                    >
                      <span className="font-medium dark:text-gray-200 truncate">{inst.name}</span>
                      {inst.lifecycleState && (
                        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${
                          inst.lifecycleState === 'RUNNING'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : inst.lifecycleState === 'STOPPED'
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
                          {inst.lifecycleState}
                        </span>
                      )}
                    </div>
                  ))}
                  {sub.totalInstances > (sub.instances?.length || 0) && (
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 pl-1.5">
                      +{sub.totalInstances - sub.instances.length} more
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature 10: Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl py-1 min-w-[220px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => {
              onStartReachability?.(contextMenu.nodeData.ip);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200"
          >
            Analyze reachability from <span className="font-mono font-medium">{contextMenu.nodeData.ip}</span>
          </button>
          <button
            onClick={() => {
              onStartReachability?.(undefined, contextMenu.nodeData.ip);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200"
          >
            Analyze reachability to <span className="font-mono font-medium">{contextMenu.nodeData.ip}</span>
          </button>
        </div>
      )}

      {/* Feature 11: Heatmap legend */}
      {heatmapEnabled && (
        <div className="absolute bottom-4 right-4 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm px-3 py-2">
          <div className="text-[10px] font-medium text-gray-600 dark:text-gray-300 mb-1.5">Security Heatmap</div>
          <div className="space-y-1">
            {[
              { label: 'Critical', color: '#DC2626' },
              { label: 'High', color: '#F97316' },
              { label: 'Medium', color: '#EAB308' },
              { label: 'Low', color: '#3B82F6' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm border-2" style={{ borderColor: s.color }} />
                <span className="text-[10px] text-gray-500 dark:text-gray-400">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature 9: Diff legend + removed panel */}
      {diffData && (
        <div className="absolute bottom-4 left-4 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm px-3 py-2">
          <div className="text-[10px] font-medium text-gray-600 dark:text-gray-300 mb-1.5">Diff Legend</div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border-2" style={{ borderColor: '#10B981' }} />
              <span className="text-[10px] text-gray-500 dark:text-gray-400">Added ({diffData.added.size})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border-2" style={{ borderColor: '#F59E0B' }} />
              <span className="text-[10px] text-gray-500 dark:text-gray-400">Changed ({diffData.changed.size})</span>
            </div>
            {diffData.removed.length > 0 && (
              <button
                onClick={() => setShowRemovedPanel(!showRemovedPanel)}
                className="flex items-center gap-1.5 text-[10px] text-red-500 dark:text-red-400 hover:text-red-700"
              >
                <span className="w-3 h-3 rounded-sm border-2 border-red-500" />
                Removed ({diffData.removed.length}) {showRemovedPanel ? '\u25B2' : '\u25BC'}
              </button>
            )}
          </div>
          {showRemovedPanel && diffData.removed.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto border-t border-gray-200 dark:border-gray-700 pt-2 space-y-1">
              {diffData.removed.slice(0, 100).map(r => (
                <div key={r.ocid} className="text-[10px] text-gray-500 dark:text-gray-400">
                  <span className="font-medium text-red-600 dark:text-red-400">{r.name || r.ocid}</span>
                  <span className="ml-1 text-gray-400">({r.type})</span>
                </div>
              ))}
              {diffData.removed.length > 100 && (
                <div className="text-[10px] text-gray-400">...and {diffData.removed.length - 100} more</div>
              )}
            </div>
          )}
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeContextMenu={handleNodeContextMenu}
        onSelectionChange={handleSelectionChange}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        selectionMode={SelectionMode.Partial}
        fitView
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="dark:!bg-gray-900"
      >
        <ZoomWatcher onCompactChange={handleCompactChange} />
        <Controls />
        <MiniMap zoomable pannable nodeColor={minimapNodeColor} />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="dark:[&>pattern>circle]:!fill-gray-600" />
      </ReactFlow>
    </div>
  );
}
