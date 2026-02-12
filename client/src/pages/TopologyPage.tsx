import React, { useState, useCallback } from 'react';
import { useSnapshot } from '../contexts/SnapshotContext';
import { useTopology } from '../hooks/useTopology';
import TopologyCanvas from '../components/topology/TopologyCanvas';
import type { ViewType } from '../types';
import { useQuery } from 'urql';
import { RESOURCE_QUERY, COMPARTMENTS_QUERY } from '../graphql/queries';

export default function TopologyPage() {
  const { currentSnapshot } = useSnapshot();
  const [viewType, setViewType] = useState<ViewType>('NETWORK');
  const [compartmentOcid, setCompartmentOcid] = useState<string | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);

  const { topology, loading, error } = useTopology(currentSnapshot?.id || null, compartmentOcid, viewType);

  // Fetch compartments for the dropdown
  const [compartmentsResult] = useQuery({
    query: COMPARTMENTS_QUERY,
    variables: { snapshotId: currentSnapshot?.id || '' },
    pause: !currentSnapshot,
  });
  const compartments = compartmentsResult.data?.compartments || [];

  // Fetch selected resource details
  const [resourceResult] = useQuery({
    query: RESOURCE_QUERY,
    variables: { id: selectedResourceId || '' },
    pause: !selectedResourceId,
  });

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedResourceId(nodeId);
  }, []);

  if (!currentSnapshot) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 text-lg">Select a snapshot to view topology</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-4 py-3 bg-white border-b border-gray-200">
        <span className="text-sm font-medium text-gray-700">View:</span>
        {(['NETWORK', 'COMPARTMENT', 'DEPENDENCY'] as ViewType[]).map(vt => (
          <button
            key={vt}
            onClick={() => setViewType(vt)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              viewType === vt ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {vt.charAt(0) + vt.slice(1).toLowerCase()}
          </button>
        ))}

        <div className="w-px h-6 bg-gray-200" />

        <span className="text-sm font-medium text-gray-700">Compartment:</span>
        <select
          value={compartmentOcid || ''}
          onChange={(e) => setCompartmentOcid(e.target.value || null)}
          className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white max-w-xs truncate"
        >
          <option value="">All Compartments</option>
          {compartments.map((c: any) => (
            <option key={c.ocid} value={c.ocid}>
              {c.displayName || c.ocid}
            </option>
          ))}
        </select>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">Loading topology...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-red-500">Error: {error.message}</div>
          </div>
        ) : topology ? (
          <TopologyCanvas
            topologyNodes={topology.nodes}
            topologyEdges={topology.edges}
            onNodeClick={handleNodeClick}
          />
        ) : null}

        {/* Selected resource detail sidebar */}
        {selectedResourceId && resourceResult.data?.resource && (
          <div className="absolute top-0 right-0 w-80 h-full bg-white border-l border-gray-200 shadow-lg overflow-y-auto p-4">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-semibold text-sm">{resourceResult.data.resource.displayName || 'Unnamed'}</h3>
              <button onClick={() => setSelectedResourceId(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <dl className="text-xs space-y-2">
              <div><dt className="text-gray-500">Type</dt><dd>{resourceResult.data.resource.resourceType}</dd></div>
              <div><dt className="text-gray-500">State</dt><dd>{resourceResult.data.resource.lifecycleState || '-'}</dd></div>
              <div><dt className="text-gray-500">OCID</dt><dd className="font-mono break-all">{resourceResult.data.resource.ocid}</dd></div>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
