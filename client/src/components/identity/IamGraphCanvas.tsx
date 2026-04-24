import React, { useMemo, useCallback, useState, useEffect } from 'react';
import CopyButton from '../common/CopyButton';
import HighlightedSnippet from '../common/HighlightedSnippet';
import RegexToggle from '../common/RegexToggle';
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
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

interface GraphNode {
  id: string;
  type: string;
  label: string;
  ocid: string;
  metadata: Record<string, unknown> | null;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  edgeType: string;
  verb: string | null;
}

interface Principal {
  id: string;
  principalType: string;
  matchingRule?: string | null;
  matchedInstanceCount?: number | null;
  ruleAnalysis?: string | null;
  blastRadiusNodeIds?: string[] | null;
}

interface IamGraphCanvasProps {
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  principals?: Principal[];
  externalHighlight?: Set<string> | null;
}

// ---------------------------------------------------------------
// Node styling
// ---------------------------------------------------------------

const nodeStyles: Record<string, { bg: string; border: string; icon: string }> = {
  user: { bg: 'bg-blue-50 dark:bg-blue-900/40', border: 'border-blue-300 dark:border-blue-600', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  group: { bg: 'bg-purple-50 dark:bg-purple-900/40', border: 'border-purple-300 dark:border-purple-600', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  'dynamic-group': { bg: 'bg-amber-50 dark:bg-amber-900/40', border: 'border-amber-400 dark:border-amber-600', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
  policy: { bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-300 dark:border-amber-600', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  permission: { bg: 'bg-gray-50 dark:bg-gray-800', border: 'border-gray-300 dark:border-gray-600', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
};

const verbEdgeColors: Record<string, string> = {
  manage: '#EF4444',
  use: '#F59E0B',
  read: '#3B82F6',
  inspect: '#9CA3AF',
};

// ---------------------------------------------------------------
// Inline node component
// ---------------------------------------------------------------

const NODE_WIDTH = 180;
const NODE_HEIGHT = 56;

function IamNode({ data }: { data: { label: string; nodeType: string; metadata: Record<string, unknown> | null } }) {
  const style = nodeStyles[data.nodeType] || nodeStyles.permission;

  // Color permission nodes by verb
  let permBg = style.bg;
  let permBorder = style.border;
  if (data.nodeType === 'permission' && data.metadata?.verb) {
    const verb = data.metadata.verb as string;
    if (verb === 'manage') { permBg = 'bg-red-50 dark:bg-red-900/30'; permBorder = 'border-red-300 dark:border-red-600'; }
    else if (verb === 'use') { permBg = 'bg-amber-50 dark:bg-amber-900/30'; permBorder = 'border-amber-300 dark:border-amber-600'; }
    else if (verb === 'read') { permBg = 'bg-blue-50 dark:bg-blue-900/30'; permBorder = 'border-blue-300 dark:border-blue-600'; }
  }

  return (
    <div className={`${permBg} border ${permBorder} rounded-lg px-3 py-2 shadow-sm`} style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}>
      <Handle type="target" position={Position.Left} className="!bg-gray-400 !w-2 !h-2" />
      <div className="flex items-center gap-2 h-full">
        <svg className="w-4 h-4 shrink-0 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={style.icon} />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{data.label}</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">{data.nodeType}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-gray-400 !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = { iamNode: IamNode };

// ---------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------

function DetailPanel({ node, principal, onClose, onShowBlastRadius }: {
  node: GraphNode;
  principal?: Principal | null;
  onClose: () => void;
  onShowBlastRadius: (nodeIds: string[]) => void;
}) {
  const [showRawJson, setShowRawJson] = useState(false);
  const [jsonSearch, setJsonSearch] = useState('');
  const [jsonRegex, setJsonRegex] = useState(false);

  const rawJson = useMemo(() => {
    const obj: Record<string, unknown> = {
      id: node.id,
      type: node.type,
      label: node.label,
      ocid: node.ocid,
      ...(node.metadata || {}),
    };
    if (principal) {
      obj.principal = { ...principal };
    }
    return JSON.stringify(obj, null, 2);
  }, [node, principal]);

  return (
    <div className="absolute top-3 right-3 z-20 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Node Details</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <dl className="text-xs space-y-2">
        <div>
          <dt className="text-gray-500 dark:text-gray-400">Name</dt>
          <dd className="text-gray-900 dark:text-gray-100 font-medium">{node.label}</dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-gray-400">Type</dt>
          <dd className="text-gray-900 dark:text-gray-100">{node.type}</dd>
        </div>
        {node.ocid && (
          <div>
            <dt className="text-gray-500 dark:text-gray-400">OCID</dt>
            <dd className="text-gray-700 dark:text-gray-300 break-all flex items-start gap-1">
              <span className="flex-1">{node.ocid}</span>
              <CopyButton text={node.ocid} />
            </dd>
          </div>
        )}
        {node.metadata && Object.keys(node.metadata).length > 0 && (
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Metadata</dt>
            <dd className="text-gray-700 dark:text-gray-300">
              {Object.entries(node.metadata).map(([k, v]) => (
                <div key={k}><span className="text-gray-500">{k}:</span> {String(v)}</div>
              ))}
            </dd>
          </div>
        )}
        {/* Dynamic group deep dive */}
        {principal?.matchingRule && (
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Matching Rule</dt>
            <dd className="text-gray-700 dark:text-gray-300 break-all text-[10px] font-mono bg-gray-50 dark:bg-gray-900 p-1.5 rounded mt-0.5">
              {principal.matchingRule}
            </dd>
          </div>
        )}
        {principal?.ruleAnalysis && (
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Rule Analysis</dt>
            <dd className="text-gray-700 dark:text-gray-300">{principal.ruleAnalysis}</dd>
          </div>
        )}
        {principal?.matchedInstanceCount != null && (
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Matched Instances</dt>
            <dd className="text-gray-900 dark:text-gray-100 font-medium">{principal.matchedInstanceCount}</dd>
          </div>
        )}
        {/* Blast radius button */}
        {principal?.blastRadiusNodeIds && principal.blastRadiusNodeIds.length > 0 && (
          <div className="pt-2">
            <button
              onClick={() => onShowBlastRadius(principal.blastRadiusNodeIds!)}
              className="w-full text-xs px-3 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
            >
              Show Blast Radius ({principal.blastRadiusNodeIds.length} nodes)
            </button>
          </div>
        )}
      </dl>
      {/* Raw JSON toggle */}
      <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setShowRawJson(!showRawJson)}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          aria-expanded={showRawJson}
        >
          {showRawJson ? 'Hide' : 'View'} Raw JSON
        </button>
        {showRawJson && (
          <>
            <div className="flex items-center gap-1.5 mt-2 mb-1">
              <input
                type="text"
                placeholder="Search JSON..."
                value={jsonSearch}
                onChange={e => setJsonSearch(e.target.value)}
                className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-gray-200"
              />
              <RegexToggle enabled={jsonRegex} onToggle={() => setJsonRegex(!jsonRegex)} />
            </div>
            <pre className="p-2 bg-gray-50 dark:bg-gray-900 rounded text-[10px] overflow-auto max-h-60 border border-gray-200 dark:border-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
              <HighlightedSnippet text={rawJson} query={jsonSearch} isRegex={jsonRegex} />
            </pre>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Main canvas component
// ---------------------------------------------------------------

export default function IamGraphCanvas({ graph, principals, externalHighlight }: IamGraphCanvasProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [internalHighlight, setInternalHighlight] = useState<Set<string> | null>(null);

  // External highlight (from summary cards) takes precedence; internal (blast radius) is fallback
  const highlightedNodes = externalHighlight || internalHighlight;

  // Build layout input
  const layoutInput = useMemo(() => {
    const layoutNodes = graph.nodes.map((n) => ({ id: n.id, width: NODE_WIDTH, height: NODE_HEIGHT }));
    const layoutEdges = graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
    return { layoutNodes, layoutEdges };
  }, [graph]);

  // Run ELK layout
  const [layoutState, setLayoutState] = useState<Record<string, { x: number; y: number }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLayoutState(null);

    import('elkjs/lib/elk.bundled.js').then(({ default: ELK }) => {
      const elk = new ELK();
      const nodeIds = new Set(layoutInput.layoutNodes.map((n) => n.id));
      const elkGraph = {
        id: 'root',
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': 'RIGHT',
          'elk.spacing.nodeNode': '30',
          'elk.layered.spacing.nodeNodeBetweenLayers': '60',
          'elk.separateConnectedComponents': 'true',
        },
        children: layoutInput.layoutNodes.map((n) => ({ id: n.id, width: n.width, height: n.height })),
        edges: layoutInput.layoutEdges
          .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target) && e.source !== e.target)
          .map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
      };
      return elk.layout(elkGraph);
    }).then((result) => {
      if (cancelled) return;
      const positions: Record<string, { x: number; y: number }> = {};
      for (const child of result.children || []) {
        positions[child.id] = { x: child.x ?? 0, y: child.y ?? 0 };
      }
      setLayoutState(positions);
    }).catch((err) => {
      console.error('IAM graph layout error:', err);
      if (!cancelled) {
        const positions: Record<string, { x: number; y: number }> = {};
        layoutInput.layoutNodes.forEach((n, i) => {
          positions[n.id] = { x: i * (NODE_WIDTH + 60), y: 0 };
        });
        setLayoutState(positions);
      }
    });

    return () => { cancelled = true; };
  }, [layoutInput]);

  // Build React Flow nodes/edges
  const { flowNodes, flowEdges } = useMemo(() => {
    if (!layoutState) return { flowNodes: [], flowEdges: [] };

    const flowNodes: Node[] = graph.nodes.map((n) => {
      const dimmed = highlightedNodes && !highlightedNodes.has(n.id);
      return {
        id: n.id,
        type: 'iamNode',
        position: layoutState[n.id] || { x: 0, y: 0 },
        data: { label: n.label, nodeType: n.type, metadata: n.metadata },
        style: dimmed ? { opacity: 0.2 } : undefined,
      };
    });

    const flowEdges: Edge[] = graph.edges.map((e) => {
      const color = e.verb ? (verbEdgeColors[e.verb] || '#9CA3AF') : '#9CA3AF';
      const dimmed = highlightedNodes && !(highlightedNodes.has(e.source) && highlightedNodes.has(e.target));
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label || undefined,
        style: { stroke: color, strokeWidth: 2, opacity: dimmed ? 0.1 : 1 },
        markerEnd: { type: MarkerType.ArrowClosed, color },
        animated: e.verb === 'manage' && !dimmed,
        labelStyle: { fontSize: 10, fill: '#6B7280' },
      };
    });

    return { flowNodes, flowEdges };
  }, [graph, layoutState, highlightedNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  useEffect(() => { setNodes(flowNodes); }, [flowNodes, setNodes]);
  useEffect(() => { setEdges(flowEdges); }, [flowEdges, setEdges]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const graphNode = graph.nodes.find((n) => n.id === node.id);
    if (graphNode) setSelectedNode(graphNode);
  }, [graph]);

  if (!layoutState) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-sm text-gray-400 dark:text-gray-500">Computing layout...</div>
      </div>
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-gray-400 dark:text-gray-500">No IAM resources found in this snapshot.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="dark:!bg-gray-900"
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="dark:[&>pattern>circle]:!fill-gray-600" />
      </ReactFlow>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-[10px] flex gap-3">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> User</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400" /> Group</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Dynamic Group</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-300" /> Policy</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500" /> manage</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500" /> use</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500" /> read</span>
      </div>

      {internalHighlight && !externalHighlight && (
        <button
          onClick={() => setInternalHighlight(null)}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20 text-xs px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
        >
          Clear Blast Radius
        </button>
      )}

      {selectedNode && (
        <DetailPanel
          node={selectedNode}
          principal={principals?.find((p) => p.id === selectedNode.id)}
          onClose={() => setSelectedNode(null)}
          onShowBlastRadius={(nodeIds) => {
            const set = new Set(nodeIds);
            set.add(selectedNode.id);
            setInternalHighlight(set);
          }}
        />
      )}
    </div>
  );
}
