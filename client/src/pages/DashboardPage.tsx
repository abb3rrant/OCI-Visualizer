import React, { useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'urql';
import { useSnapshot } from '../contexts/SnapshotContext';
import { useAuth } from '../contexts/AuthContext';
import { useResourceCounts } from '../hooks/useResources';
import ResourceIcon from '../components/common/ResourceIcon';
import SkeletonCard from '../components/common/SkeletonCard';
import { formatResourceType } from '../utils/formatters';
import { CATEGORIES, groupCountsByCategory } from '../utils/categories';
import { AUDIT_TREND_QUERY } from '../graphql/queries';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ---------------------------------------------------------------------------
// AuditTrendChart - simple SVG line chart
// ---------------------------------------------------------------------------

interface AuditTrendPoint {
  snapshotId: string;
  snapshotName: string;
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#2563eb',
  info: '#9ca3af',
};

function AuditTrendChart({ data }: { data: AuditTrendPoint[] }) {
  if (data.length < 2) return null;

  const W = 700;
  const H = 220;
  const PAD_L = 40;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 60;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const severities = ['critical', 'high', 'medium', 'low', 'info'] as const;

  // Find max value across all severities
  let maxVal = 0;
  for (const d of data) {
    for (const s of severities) {
      if (d[s] > maxVal) maxVal = d[s];
    }
  }
  if (maxVal === 0) maxVal = 1;

  const xStep = chartW / (data.length - 1);

  const makePoints = (severity: typeof severities[number]) => {
    return data.map((d, i) => {
      const x = PAD_L + i * xStep;
      const y = PAD_T + chartH - (d[severity] / maxVal) * chartH;
      return `${x},${y}`;
    }).join(' ');
  };

  // Y-axis ticks
  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Audit Trend</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '260px' }}>
        {/* Grid lines */}
        {yTicks.map((tick) => {
          const y = PAD_T + chartH - (tick / maxVal) * chartH;
          return (
            <g key={tick}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={PAD_L - 6} y={y + 4} textAnchor="end" fill="#9ca3af" fontSize={10}>{tick}</text>
            </g>
          );
        })}

        {/* Lines */}
        {severities.map((s) => (
          <polyline
            key={s}
            points={makePoints(s)}
            fill="none"
            stroke={SEVERITY_COLORS[s]}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        ))}

        {/* Dots */}
        {severities.map((s) =>
          data.map((d, i) => {
            const x = PAD_L + i * xStep;
            const y = PAD_T + chartH - (d[s] / maxVal) * chartH;
            return <circle key={`${s}-${i}`} cx={x} cy={y} r={3} fill={SEVERITY_COLORS[s]} />;
          })
        )}

        {/* X-axis labels */}
        {data.map((d, i) => {
          const x = PAD_L + i * xStep;
          const label = d.snapshotName.length > 12 ? d.snapshotName.slice(0, 12) + '...' : d.snapshotName;
          return (
            <text
              key={i}
              x={x}
              y={H - PAD_B + 16}
              textAnchor="middle"
              fill="#6b7280"
              fontSize={9}
              transform={`rotate(-30, ${x}, ${H - PAD_B + 16})`}
            >
              {label}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 mt-2 text-xs">
        {severities.map((s) => (
          <div key={s} className="flex items-center gap-1">
            <span className="w-3 h-1 rounded" style={{ backgroundColor: SEVERITY_COLORS[s], display: 'inline-block' }} />
            <span className="capitalize text-gray-600 dark:text-gray-400">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DashboardPage
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { currentSnapshot } = useSnapshot();
  const { token } = useAuth();
  const { counts, loading } = useResourceCounts(currentSnapshot?.id || null);
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Audit trend query
  const [trendResult] = useQuery({ query: AUDIT_TREND_QUERY, pause: !currentSnapshot });
  const trendData: AuditTrendPoint[] = trendResult.data?.auditTrend || [];

  // Export snapshot handler
  const handleExport = useCallback(async () => {
    if (!currentSnapshot || !token) return;
    try {
      const resp = await fetch(`${API_BASE}/api/snapshot/${currentSnapshot.id}/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error('Export failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `snapshot-${currentSnapshot.name.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  }, [currentSnapshot, token]);

  // Import snapshot handler
  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    try {
      const text = await file.text();
      const resp = await fetch(`${API_BASE}/api/snapshot/import`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: text,
      });
      if (!resp.ok) throw new Error('Import failed');
      const data = await resp.json();
      alert(`Snapshot imported successfully (ID: ${data.snapshotId}). Reload to see it.`);
      window.location.reload();
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [token]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {currentSnapshot ? `Viewing: ${currentSnapshot.name}` : 'Select a snapshot to get started'}
        </p>
      </div>

      {!currentSnapshot ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 dark:text-gray-500 text-lg mb-4">No snapshot selected</p>
          <button onClick={() => navigate('/import')} className="btn-primary">Import Data</button>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card">
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Resources</div>
              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{totalResources}</div>
            </div>
            <div className="card">
              <div className="text-sm text-gray-500 dark:text-gray-400">Resource Types</div>
              <div className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{counts.length}</div>
            </div>
            <div className="card cursor-pointer hover:border-blue-300" onClick={() => navigate('/topology')}>
              <div className="text-sm text-gray-500 dark:text-gray-400">View Topology</div>
              <div className="text-lg font-semibold text-blue-600 mt-1">Network Diagram &rarr;</div>
            </div>
            <div className="card cursor-pointer hover:border-blue-300" onClick={() => navigate('/audit')}>
              <div className="text-sm text-gray-500 dark:text-gray-400">Security Audit</div>
              <div className="text-lg font-semibold text-blue-600 mt-1">Run Audit &rarr;</div>
            </div>
          </div>

          {/* Backup / Restore */}
          <div className="flex gap-3">
            <button onClick={handleExport} className="btn-primary flex items-center gap-2 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Snapshot
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import Snapshot
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>

          {/* Audit trend chart */}
          {trendData.length >= 2 && <AuditTrendChart data={trendData} />}

          {/* Resource counts grouped by category */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Resource Inventory</h3>
            {loading ? (
              <div className="space-y-6">
                <SkeletonCard count={4} />
                <SkeletonCard count={4} />
              </div>
            ) : (
              <div className="space-y-6">
                {orderedGroups.map((group) => (
                  <div key={group.key}>
                    <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      {group.label}
                      <span className="ml-2 text-gray-400 dark:text-gray-500 font-normal normal-case">
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
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatResourceType(c.resourceType)}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{c.count} resources</div>
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
