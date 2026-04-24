import React, { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSnapshot } from '../contexts/SnapshotContext';
import { useDetailPanel } from '../contexts/DetailPanelContext';
import { useTopology } from '../hooks/useTopology';
import TopologyCanvas from '../components/topology/TopologyCanvas';
import type { DiffData } from '../components/topology/TopologyCanvas';
import ReachabilityCanvas from '../components/topology/ReachabilityCanvas';
import type { ViewType, ReachabilityResult, Severity } from '../types';
import { useQuery, useClient } from 'urql';
import { COMPARTMENTS_QUERY, REACHABILITY_QUERY, AUDIT_QUERY, SNAPSHOTS_QUERY, SNAPSHOT_DIFF_QUERY, EXPAND_INSTANCES_QUERY } from '../graphql/queries';
import type { TopologyNode } from '../types';

const VIEW_TABS: ViewType[] = ['NETWORK', 'COMPARTMENT', 'DEPENDENCY', 'EXPOSURE', 'REACHABILITY'];

export default function TopologyPage() {
  const { currentSnapshot } = useSnapshot();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-driven state
  const viewType = (searchParams.get('view') as ViewType) || 'NETWORK';
  const compartmentOcid = searchParams.get('compartment') || null;
  const focusNodeId = searchParams.get('focus') || undefined;

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

  const { openResource } = useDetailPanel();
  const urqlClient = useClient();

  // Reachability state
  const [reachSource, setReachSource] = useState('');
  const [reachDest, setReachDest] = useState('');
  const [reachProtocol, setReachProtocol] = useState('');
  const [reachPort, setReachPort] = useState('');
  const [reachTrigger, setReachTrigger] = useState(0);

  // Feature 11: Security heatmap
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);

  // Feature 9: Diff view
  const [compareSnapshotId, setCompareSnapshotId] = useState<string | null>(null);

  const isReachability = viewType === 'REACHABILITY';

  const { topology, loading, error } = useTopology(
    currentSnapshot?.id || null,
    compartmentOcid,
    isReachability ? 'NETWORK' : viewType,
  );

  // Fetch compartments for the dropdown
  const [compartmentsResult] = useQuery({
    query: COMPARTMENTS_QUERY,
    variables: { snapshotId: currentSnapshot?.id || '' },
    pause: !currentSnapshot,
  });
  const compartments = compartmentsResult.data?.compartments || [];

  // Reachability query
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
    openResource(nodeId);
  }, [openResource]);

  // Expand collapsed instance summary nodes into individual instances (single batched query)
  const handleExpandInstances = useCallback(async (parentOcids: string[]): Promise<TopologyNode[]> => {
    if (!currentSnapshot || parentOcids.length === 0) return [];
    const result = await urqlClient.query(EXPAND_INSTANCES_QUERY, {
      snapshotId: currentSnapshot.id,
      parentOcids,
    }).toPromise();
    return result.data?.expandInstances ?? [];
  }, [currentSnapshot, urqlClient]);

  // Feature 10: Start reachability from context menu
  const handleStartReachability = useCallback((sourceIp?: string, destIp?: string) => {
    setViewType('REACHABILITY');
    if (sourceIp) setReachSource(sourceIp);
    if (destIp) setReachDest(destIp);
  }, [setViewType]);

  // Feature 11: Audit query for heatmap
  const [auditResult] = useQuery({
    query: AUDIT_QUERY,
    variables: { snapshotId: currentSnapshot?.id || '' },
    pause: !currentSnapshot || !heatmapEnabled,
  });

  const resourceSeverityMap = useMemo(() => {
    if (!heatmapEnabled || !auditResult.data?.auditFindings?.groupedFindings) return undefined;

    const severityPriority: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
    const map = new Map<string, Severity>();

    for (const finding of auditResult.data.auditFindings.groupedFindings) {
      for (const resource of finding.resources || []) {
        const existing = map.get(resource.id);
        if (!existing || severityPriority[finding.severity] < severityPriority[existing]) {
          map.set(resource.id, finding.severity as Severity);
        }
      }
    }
    return map;
  }, [heatmapEnabled, auditResult.data]);

  // Feature 9: Snapshots and diff queries
  const [snapshotsResult] = useQuery({
    query: SNAPSHOTS_QUERY,
    pause: !currentSnapshot,
  });
  const allSnapshots = snapshotsResult.data?.snapshots || [];

  const [diffResult] = useQuery({
    query: SNAPSHOT_DIFF_QUERY,
    variables: {
      snapshotIdA: currentSnapshot?.id || '',
      snapshotIdB: compareSnapshotId || '',
    },
    pause: !currentSnapshot || !compareSnapshotId,
  });

  const diffData: DiffData | undefined = useMemo(() => {
    if (!diffResult.data?.snapshotDiff) return undefined;
    const diff = diffResult.data.snapshotDiff;
    return {
      added: new Set((diff.added || []).map((r: any) => r.ocid)),
      changed: new Set((diff.changed || []).map((r: any) => r.ocid)),
      removed: (diff.removed || []).map((r: any) => ({
        ocid: r.ocid,
        name: r.displayName || r.ocid,
        type: r.resourceType,
      })),
    };
  }, [diffResult.data]);

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

            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

            {/* Feature 11: Security heatmap toggle */}
            <button
              onClick={() => setHeatmapEnabled(!heatmapEnabled)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                heatmapEnabled
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Security Heatmap
            </button>

            {/* Feature 9: Compare snapshot selector */}
            <select
              value={compareSnapshotId || ''}
              onChange={e => setCompareSnapshotId(e.target.value || null)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 dark:text-gray-200 max-w-[200px] truncate"
            >
              <option value="">Compare with...</option>
              {allSnapshots
                .filter((s: any) => s.id !== currentSnapshot.id)
                .map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name || `Snapshot ${s.id.slice(0, 8)}`}
                  </option>
                ))}
            </select>
          </>
        )}
      </div>

      {/* Canvas */}
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
              viewType={viewType}
              onStartReachability={handleStartReachability}
              heatmapEnabled={heatmapEnabled}
              resourceSeverityMap={resourceSeverityMap}
              diffData={diffData}
              onExpandInstances={handleExpandInstances}
              focusNodeId={focusNodeId}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
