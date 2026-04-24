import React, { useMemo, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'urql';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useSnapshot } from '../contexts/SnapshotContext';
import { useAuth } from '../contexts/AuthContext';
import { useResourceCounts } from '../hooks/useResources';
import ResourceIcon from '../components/common/ResourceIcon';
import SkeletonCard from '../components/common/SkeletonCard';
import { formatResourceType } from '../utils/formatters';
import { CATEGORIES, groupCountsByCategory } from '../utils/categories';
import { AUDIT_TREND_QUERY, AUDIT_QUERY } from '../graphql/queries';
import { showToast } from '../components/common/ToastProvider';
import ResourceDistributionChart from '../components/dashboard/ResourceDistributionChart';
import TopCompartmentsChart from '../components/dashboard/TopCompartmentsChart';
import LifecycleStateChart from '../components/dashboard/LifecycleStateChart';
import AuditSeverityChart from '../components/dashboard/AuditSeverityChart';

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

const CHART_MARGIN = { top: 8, right: 16, left: 0, bottom: 16 };

function AuditTrendChart({ data }: { data: AuditTrendPoint[] }) {
  const chartData = useMemo(() => data.map(d => ({
    name: d.snapshotName.length > 12 ? d.snapshotName.slice(0, 12) + '...' : d.snapshotName,
    Critical: d.critical,
    High: d.high,
    Medium: d.medium,
    Low: d.low,
    Info: d.info,
  })), [data]);

  if (data.length < 2) return null;

  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Audit Trend</h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={CHART_MARGIN}>
          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 11 }} width={40} />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
          <Legend iconType="line" iconSize={12} wrapperStyle={{ fontSize: '11px' }} />
          <Line type="monotone" dataKey="Critical" stroke={SEVERITY_COLORS.critical} strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="High" stroke={SEVERITY_COLORS.high} strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="Medium" stroke={SEVERITY_COLORS.medium} strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="Low" stroke={SEVERITY_COLORS.low} strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="Info" stroke={SEVERITY_COLORS.info} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
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
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

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

  // Audit trend query — deferred until user clicks "Load Trend" to avoid
  // running up to 20 full audits on every Dashboard visit.
  const [showTrend, setShowTrend] = useState(false);
  const [trendResult] = useQuery({ query: AUDIT_TREND_QUERY, pause: !currentSnapshot || !showTrend });
  const trendData: AuditTrendPoint[] = trendResult.data?.auditTrend || [];

  // Audit summary for severity chart
  const [auditResult] = useQuery({
    query: AUDIT_QUERY,
    variables: { snapshotId: currentSnapshot?.id || '' },
    pause: !currentSnapshot,
  });
  const auditSummary = auditResult.data?.auditFindings?.summary || null;

  // Export snapshot handler
  const handleExport = useCallback(async () => {
    if (!currentSnapshot || !token || isExporting) return;
    setIsExporting(true);
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
      showToast(`Export failed: ${err.message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  }, [currentSnapshot, token, isExporting]);

  // Import snapshot handler
  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token || isImporting) return;
    setIsImporting(true);
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
      showToast(`Snapshot imported successfully. Reloading...`, 'success');
      window.location.reload();
    } catch (err: any) {
      showToast(`Import failed: ${err.message}`, 'error');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [token, isImporting]);

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
            <button onClick={handleExport} disabled={isExporting} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {isExporting ? 'Exporting...' : 'Export Snapshot'}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {isImporting ? 'Importing...' : 'Import Snapshot'}
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
          {showTrend && trendData.length >= 2 && <AuditTrendChart data={trendData} />}
          {showTrend && trendResult.fetching && (
            <div className="card text-center py-6 text-gray-400 dark:text-gray-500 text-sm">Loading audit trend...</div>
          )}
          {!showTrend && (
            <button
              onClick={() => setShowTrend(true)}
              className="card text-center py-4 w-full text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer border-dashed"
            >
              Load Audit Trend (compares up to 20 snapshots)
            </button>
          )}

          {/* Chart widgets grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ResourceDistributionChart counts={counts} />
            <TopCompartmentsChart />
            <LifecycleStateChart />
            <AuditSeverityChart summary={auditSummary} />
          </div>

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
