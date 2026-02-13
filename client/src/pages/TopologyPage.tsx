import React, { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSnapshot } from '../contexts/SnapshotContext';
import { useTopology } from '../hooks/useTopology';
import TopologyCanvas from '../components/topology/TopologyCanvas';
import ReachabilityCanvas from '../components/topology/ReachabilityCanvas';
import DetailPanel from '../components/layout/DetailPanel';
import type { ViewType, ReachabilityResult } from '../types';
import { useQuery } from 'urql';
import { RESOURCE_QUERY, COMPARTMENTS_QUERY, REACHABILITY_QUERY } from '../graphql/queries';

const VIEW_TABS: ViewType[] = ['NETWORK', 'COMPARTMENT', 'DEPENDENCY', 'EXPOSURE', 'REACHABILITY'];

export default function TopologyPage() {
  const { currentSnapshot } = useSnapshot();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-driven state
  const viewType = (searchParams.get('view') as ViewType) || 'NETWORK';
  const compartmentOcid = searchParams.get('compartment') || null;

  const setViewType = useCallback((vt: ViewType) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (vt === 'NETWORK') next.delete('view');
      else next.set('view', vt);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setCompartmentOcid = useCallback((ocid: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (ocid) next.set('compartment', ocid);
      else next.delete('compartment');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);

  // Reachability state
  const [reachSource, setReachSource] = useState('');
  const [reachDest, setReachDest] = useState('');
  const [reachProtocol, setReachProtocol] = useState('');
  const [reachPort, setReachPort] = useState('');
  const [reachTrigger, setReachTrigger] = useState(0); // increment to trigger query

  const isReachability = viewType === 'REACHABILITY';

  const { topology, loading, error } = useTopology(
    currentSnapshot?.id || null,
    compartmentOcid,
    isReachability ? 'NETWORK' : viewType,  // don't send REACHABILITY to topology query
  );

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

  // Reachability query — paused until user clicks Analyze
  const [reachResult] = useQuery({
    query: REACHABILITY_QUERY,
    variables: {
      snapshotId: currentSnapshot?.id || '',
      sourceIp: reachSource || null,
      destinationIp: reachDest || null,
      protocol: reachProtocol || null,
      port: reachPort ? parseInt(reachPort, 10) : null,
    },
    pause: !isReachability || (!reachSource && !reachDest) || reachTrigger === 0,
    requestPolicy: 'network-only',
  });

  const reachabilityResult: ReachabilityResult | null = reachResult.data?.reachabilityAnalysis ?? null;

  const handleAnalyze = useCallback(() => {
    if (reachSource || reachDest) {
      setReachTrigger(t => t + 1);
    }
  }, [reachSource, reachDest]);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedResourceId(nodeId);
  }, []);

  const handleNavigateResource = useCallback((resourceId: string) => {
    setSelectedResourceId(resourceId);
  }, []);

  if (!currentSnapshot) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 dark:text-gray-500 text-lg">Select a snapshot to view topology</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-wrap">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">View:</span>
        {VIEW_TABS.map(vt => (
          <button
            key={vt}
            onClick={() => setViewType(vt)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              viewType === vt ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {vt.charAt(0) + vt.slice(1).toLowerCase()}
          </button>
        ))}

        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

        {isReachability ? (
          <>
            <input
              type="text"
              placeholder="Source IP (optional)"
              value={reachSource}
              onChange={e => setReachSource(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 dark:text-gray-200 w-40"
            />
            <input
              type="text"
              placeholder="Dest IP / &quot;internet&quot; (optional)"
              value={reachDest}
              onChange={e => setReachDest(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 dark:text-gray-200 w-44"
            />
            <select
              value={reachProtocol}
              onChange={e => setReachProtocol(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 dark:text-gray-200"
            >
              <option value="">Any Protocol</option>
              <option value="6">TCP</option>
              <option value="17">UDP</option>
              <option value="1">ICMP</option>
            </select>
            <input
              type="number"
              placeholder="Port"
              value={reachPort}
              onChange={e => setReachPort(e.target.value)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 dark:text-gray-200 w-20"
            />
            <button
              onClick={handleAnalyze}
              disabled={!reachSource && !reachDest}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Analyze
            </button>
          </>
        ) : (
          <>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Compartment:</span>
            <select
              value={compartmentOcid || ''}
              onChange={(e) => setCompartmentOcid(e.target.value || null)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 dark:text-gray-200 max-w-xs truncate"
            >
              <option value="">All Compartments</option>
              {compartments.map((c: any) => (
                <option key={c.ocid} value={c.ocid}>
                  {c.displayName || c.ocid}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Canvas + detail panel */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          {isReachability ? (
            reachResult.fetching ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-gray-200 dark:border-gray-700 border-t-blue-500 rounded-full animate-spin" />
                  <span className="text-gray-400 dark:text-gray-500 text-sm">Analyzing reachability...</span>
                </div>
              </div>
            ) : reachResult.error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-red-500">Error: {reachResult.error.message}</div>
              </div>
            ) : reachabilityResult ? (
              <ReachabilityCanvas result={reachabilityResult} onNodeClick={handleNodeClick} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-400 dark:text-gray-500 text-center max-w-md">
                  <p className="text-lg mb-3">Network Reachability Analysis</p>
                  <p className="text-sm mb-1"><strong>Both IPs</strong> — trace a single source-to-destination path</p>
                  <p className="text-sm mb-1"><strong>Source only</strong> — fan-out: see everywhere the source can reach</p>
                  <p className="text-sm"><strong>Dest only</strong> — fan-in: see which subnets can reach the destination</p>
                </div>
              </div>
            )
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-gray-200 dark:border-gray-700 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-gray-400 dark:text-gray-500 text-sm">Loading topology...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-red-500">Error: {error.message}</div>
            </div>
          ) : topology ? (
            <TopologyCanvas
              topologyNodes={topology.nodes}
              topologyEdges={topology.edges}
              totalCount={topology.totalCount}
              truncated={topology.truncated}
              onNodeClick={handleNodeClick}
            />
          ) : null}
        </div>

        {selectedResourceId && resourceResult.data?.resource && (
          <DetailPanel
            resource={resourceResult.data.resource}
            onClose={() => setSelectedResourceId(null)}
            onNavigate={handleNavigateResource}
          />
        )}
      </div>
    </div>
  );
}
