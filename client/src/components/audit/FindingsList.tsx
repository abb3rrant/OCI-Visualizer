import React, { useState, useMemo } from 'react';
import type { GroupedAuditFinding } from '../../types';
import { getSeverityColor } from '../../utils/colors';

interface FindingsListProps {
  findings: GroupedAuditFinding[];
}

export default function FindingsList({ findings }: FindingsListProps) {
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterFramework, setFilterFramework] = useState<string>('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const categories = useMemo(() => [...new Set(findings.map(f => f.category))].sort(), [findings]);
  const frameworks = useMemo(() => [...new Set(findings.map(f => f.framework).filter(Boolean))].sort() as string[], [findings]);
  const filtered = useMemo(() => findings.filter(f => {
    if (filterSeverity && f.severity !== filterSeverity) return false;
    if (filterCategory && f.category !== filterCategory) return false;
    if (filterFramework && f.framework !== filterFramework) return false;
    return true;
  }), [findings, filterSeverity, filterCategory, filterFramework]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-200">
          <option value="">All severities</option>
          {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-200">
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterFramework} onChange={(e) => setFilterFramework(e.target.value)} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-gray-200">
          <option value="">All frameworks</option>
          {frameworks.map(fw => <option key={fw} value={fw}>{fw}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {filtered.map((finding, i) => {
          const color = getSeverityColor(finding.severity);
          const isExpanded = expandedIndex === i;
          return (
            <div key={i} className="card !p-0 overflow-hidden">
              <button
                onClick={() => setExpandedIndex(isExpanded ? null : i)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <svg
                  className={`w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="badge shrink-0" style={{ backgroundColor: `${color}15`, color }}>{finding.severity}</span>
                {finding.framework && (
                  <span className="badge shrink-0" style={{ backgroundColor: '#7C3AED15', color: '#7C3AED' }}>{finding.framework}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{finding.title}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{finding.description}</div>
                </div>
                <span className="badge shrink-0 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{finding.count} resource{finding.count !== 1 ? 's' : ''}</span>
                <span className="badge shrink-0 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{finding.category}</span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <div className="mt-3 mb-3">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Recommendation</div>
                    <div className="text-sm text-blue-700 dark:text-blue-400">{finding.recommendation}</div>
                  </div>

                  {finding.resources.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Affected Resources ({finding.resources.length})</div>
                      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">
                              <th className="text-left px-3 py-2 font-medium">Name</th>
                              <th className="text-left px-3 py-2 font-medium">OCID</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {finding.resources.map((r) => (
                              <tr key={r.id} className="bg-white dark:bg-gray-800">
                                <td className="px-3 py-1.5 text-gray-900 dark:text-gray-100">{r.name || '(unnamed)'}</td>
                                <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 font-mono text-xs truncate max-w-md">{r.ocid}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-4">No findings match the current filters</p>}
      </div>
    </div>
  );
}
