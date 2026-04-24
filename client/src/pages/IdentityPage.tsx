import React, { useCallback, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSnapshot } from '../contexts/SnapshotContext';
import { useIamAnalysis } from '../hooks/useIamAnalysis';
import IamSummaryCards, { type CardKey } from '../components/identity/IamSummaryCards';
import IamGraphCanvas from '../components/identity/IamGraphCanvas';
import IamFindingsList from '../components/identity/IamFindingsList';
import PolicyBrowser from '../components/identity/PolicyBrowser';
import ExportIamButton from '../components/identity/ExportIamButton';
import SkeletonCard from '../components/common/SkeletonCard';
import SkeletonTable from '../components/common/SkeletonTable';

type TabType = 'graph' | 'findings' | 'policies';

export default function IdentityPage() {
  const { currentSnapshot } = useSnapshot();
  const { data, loading } = useIamAnalysis(currentSnapshot?.id || null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeCard, setActiveCard] = useState<CardKey | null>(null);

  const activeTab = (searchParams.get('tab') as TabType) || 'graph';
  const setActiveTab = useCallback((tab: TabType) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'graph') next.delete('tab');
      else next.set('tab', tab);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Compute highlighted node IDs from summary card selection
  const cardHighlight = useMemo((): Set<string> | null => {
    if (!activeCard || !data) return null;

    const nodeIds = new Set<string>();

    if (activeCard === 'totalUsers') {
      for (const n of data.graph.nodes) {
        if (n.type === 'user') nodeIds.add(n.id);
      }
    } else if (activeCard === 'totalPolicies') {
      for (const n of data.graph.nodes) {
        if (n.type === 'policy') nodeIds.add(n.id);
      }
    } else if (activeCard === 'criticalPaths') {
      const criticalFindings = data.findings.filter((f: any) => f.severity === 'CRITICAL');
      traceAttackPaths(data.graph, criticalFindings, nodeIds);
    } else if (activeCard === 'privEscPaths') {
      const privEscFindings = data.findings.filter(
        (f: any) => f.id.startsWith('F2') || f.id.startsWith('F3'),
      );
      traceAttackPaths(data.graph, privEscFindings, nodeIds);
    }

    return nodeIds.size > 0 ? nodeIds : null;
  }, [activeCard, data]);

  const handleCardClick = useCallback((key: CardKey) => {
    if (activeCard === key) {
      setActiveCard(null);
    } else {
      setActiveCard(key);
      // Switch to graph tab when clicking critical/privEsc paths
      if (key === 'criticalPaths' || key === 'privEscPaths') {
        setActiveTab('graph');
      }
    }
  }, [activeCard, setActiveTab]);

  // Clear card selection when switching tabs manually
  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    // Don't clear card highlight when switching to graph – it's showing the highlight
  }, [setActiveTab]);

  if (!currentSnapshot) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 dark:text-gray-500 text-lg">Select a snapshot to analyze IAM</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Identity &amp; Access</h2>
        {data && <ExportIamButton findings={data.findings} snapshotName={currentSnapshot.name} />}
      </div>

      {loading ? (
        <div className="space-y-6">
          <SkeletonCard count={4} />
          <SkeletonTable rows={6} columns={5} />
        </div>
      ) : data ? (
        <>
          <IamSummaryCards
            summary={data.summary}
            activeCard={activeCard}
            onCardClick={handleCardClick}
          />

          <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => handleTabChange('graph')}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'graph' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 dark:text-gray-400'}`}
            >
              Graph
            </button>
            <button
              onClick={() => handleTabChange('findings')}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'findings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 dark:text-gray-400'}`}
            >
              Findings ({data.findings.length})
            </button>
            <button
              onClick={() => handleTabChange('policies')}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'policies' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 dark:text-gray-400'}`}
            >
              Policies ({data.statements.length})
            </button>
          </div>

          {activeTab === 'graph' ? (
            <div className="flex-1 min-h-[500px] bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <IamGraphCanvas
                graph={data.graph}
                principals={data.principals}
                externalHighlight={cardHighlight}
              />
            </div>
          ) : activeTab === 'findings' ? (
            <IamFindingsList findings={data.findings} />
          ) : (
            <PolicyBrowser statements={data.statements} />
          )}
        </>
      ) : null}
    </div>
  );
}

/**
 * For each finding, use the server-provided attackPathNodeIds to highlight
 * exactly the nodes along the escalation route (user → group → policy → permission).
 */
function traceAttackPaths(
  _graph: { nodes: { id: string }[]; edges: { source: string; target: string }[] },
  findings: { resources: { id: string }[]; attackPathNodeIds: string[] }[],
  result: Set<string>,
) {
  for (const finding of findings) {
    // Include directly-affected resource nodes
    for (const r of finding.resources) result.add(r.id);
    // Include the specific attack path nodes (user → group → policy → permission)
    for (const nodeId of finding.attackPathNodeIds) result.add(nodeId);
  }
}
