import React, { useState, useMemo, useEffect } from 'react';
import CopyButton from '../common/CopyButton';
import { useDetailPanel } from '../../contexts/DetailPanelContext';

interface Finding {
  id: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
  attackPath: string[];
  resources: { id: string; ocid: string; name: string | null }[];
  framework: string | null;
}

interface IamFindingsListProps {
  findings: Finding[];
}

const severityColors: Record<string, { badge: string; ring: string }> = {
  CRITICAL: { badge: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300', ring: 'ring-red-300 dark:ring-red-700' },
  HIGH: { badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300', ring: 'ring-orange-300 dark:ring-orange-700' },
  MEDIUM: { badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300', ring: 'ring-amber-300 dark:ring-amber-700' },
  LOW: { badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300', ring: 'ring-blue-300 dark:ring-blue-700' },
  INFO: { badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', ring: 'ring-gray-300 dark:ring-gray-600' },
};

const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };

export default function IamFindingsList({ findings }: IamFindingsListProps) {
  const { openResource } = useDetailPanel();
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(50);

  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of findings) {
      counts[f.severity] = (counts[f.severity] || 0) + 1;
    }
    return counts;
  }, [findings]);

  const filtered = useMemo(() => {
    let list = filterSeverity === 'ALL'
      ? findings
      : findings.filter((f) => f.severity === filterSeverity);

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter((f) =>
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        f.recommendation.toLowerCase().includes(q) ||
        f.attackPath.some((s) => s.toLowerCase().includes(q)) ||
        f.resources.some((r) => r.name?.toLowerCase().includes(q) || r.ocid.toLowerCase().includes(q))
      );
    }

    return [...list].sort((a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5));
  }, [findings, filterSeverity, searchTerm]);

  // Reset visible count when filters change
  useEffect(() => { setVisibleCount(50); }, [filterSeverity, searchTerm]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-500 dark:text-gray-400">Filter:</label>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="ALL">All Severities</option>
          {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((s) => {
            const count = severityCounts[s] || 0;
            if (count === 0) return null;
            return <option key={s} value={s}>{s} ({count})</option>;
          })}
        </select>
        <input
          type="text"
          placeholder="Search findings..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 flex-1 max-w-xs"
        />
        <span className="text-sm text-gray-400 dark:text-gray-500">
          {filtered.length} finding{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3">
        {filtered.slice(0, visibleCount).map((f) => {
          const colors = severityColors[f.severity] || severityColors.INFO;
          return (
            <div key={f.id} className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 ring-1 ${colors.ring}`}>
              <div className="flex items-start gap-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${colors.badge}`}>
                  {f.severity}
                </span>
                {f.framework && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                    {f.framework}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">{f.title}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{f.description}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-2 italic">{f.recommendation}</p>
                  {f.attackPath.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {f.attackPath.map((step, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && (
                            <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">
                            {step}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                  {f.resources.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Affected Resources ({f.resources.length})</div>
                      <div className="space-y-1">
                        {f.resources.map((r) => (
                          <div key={r.id} className="flex items-center gap-2 text-xs">
                            <button
                              onClick={() => openResource(r.id)}
                              className="text-blue-600 dark:text-blue-400 hover:underline truncate"
                              title="Open in Detail Panel"
                            >
                              {r.name || '(unnamed)'}
                            </button>
                            <span className="text-gray-400 dark:text-gray-500 font-mono truncate max-w-[200px]">{r.ocid}</span>
                            <CopyButton text={r.ocid} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {visibleCount < filtered.length && (
          <button
            onClick={() => setVisibleCount(prev => prev + 50)}
            className="w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
          >
            Show more ({filtered.length - visibleCount} remaining)
          </button>
        )}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 dark:text-gray-500 py-8">No findings match the current filter.</p>
        )}
      </div>
    </div>
  );
}
