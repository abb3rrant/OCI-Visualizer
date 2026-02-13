import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnapshot } from '../contexts/SnapshotContext';
import { useResourceCounts } from '../hooks/useResources';
import ResourceIcon from '../components/common/ResourceIcon';
import { formatResourceType } from '../utils/formatters';
import { CATEGORIES, groupCountsByCategory } from '../utils/categories';

export default function DashboardPage() {
  const { currentSnapshot } = useSnapshot();
  const { counts, loading } = useResourceCounts(currentSnapshot?.id || null);
  const navigate = useNavigate();

  const totalResources = counts.reduce((sum: number, c: any) => sum + c.count, 0);

  const grouped = useMemo(() => groupCountsByCategory(counts), [counts]);

  // Ordered groups following CATEGORIES order, then any remaining
  const orderedGroups = useMemo(() => {
    const result: { key: string; label: string; types: { resourceType: string; count: number }[] }[] = [];
    for (const cat of CATEGORIES) {
      const group = grouped.get(cat.key);
      if (group && group.types.length > 0) {
        result.push({ key: cat.key, ...group });
      }
    }
    for (const [key, group] of grouped) {
      if (!CATEGORIES.some((c) => c.key === key)) {
        result.push({ key, ...group });
      }
    }
    return result;
  }, [grouped]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 mt-1">
          {currentSnapshot ? `Viewing: ${currentSnapshot.name}` : 'Select a snapshot to get started'}
        </p>
      </div>

      {!currentSnapshot ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 text-lg mb-4">No snapshot selected</p>
          <button onClick={() => navigate('/import')} className="btn-primary">Import Data</button>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card">
              <div className="text-sm text-gray-500">Total Resources</div>
              <div className="text-3xl font-bold text-gray-900 mt-1">{totalResources}</div>
            </div>
            <div className="card">
              <div className="text-sm text-gray-500">Resource Types</div>
              <div className="text-3xl font-bold text-gray-900 mt-1">{counts.length}</div>
            </div>
            <div className="card cursor-pointer hover:border-blue-300" onClick={() => navigate('/topology')}>
              <div className="text-sm text-gray-500">View Topology</div>
              <div className="text-lg font-semibold text-blue-600 mt-1">Network Diagram &rarr;</div>
            </div>
            <div className="card cursor-pointer hover:border-blue-300" onClick={() => navigate('/audit')}>
              <div className="text-sm text-gray-500">Security Audit</div>
              <div className="text-lg font-semibold text-blue-600 mt-1">Run Audit &rarr;</div>
            </div>
          </div>

          {/* Resource counts grouped by category */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Resource Inventory</h3>
            {loading ? (
              <p className="text-gray-400">Loading...</p>
            ) : (
              <div className="space-y-6">
                {orderedGroups.map((group) => (
                  <div key={group.key}>
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      {group.label}
                      <span className="ml-2 text-gray-400 font-normal normal-case">
                        {group.types.reduce((s, t) => s + t.count, 0)} resources
                      </span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {group.types.map((c) => (
                        <div
                          key={c.resourceType}
                          className="card flex items-center gap-3 cursor-pointer hover:border-blue-300 !p-4"
                          onClick={() => navigate(`/inventory?type=${encodeURIComponent(c.resourceType)}`)}
                        >
                          <ResourceIcon resourceType={c.resourceType} />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{formatResourceType(c.resourceType)}</div>
                            <div className="text-xs text-gray-500">{c.count} resources</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
