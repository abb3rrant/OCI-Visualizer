import React, { useState } from 'react';
import type { AuditFinding } from '../../types';
import { getSeverityColor } from '../../utils/colors';

interface FindingsListProps {
  findings: AuditFinding[];
}

export default function FindingsList({ findings }: FindingsListProps) {
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');

  const categories = [...new Set(findings.map(f => f.category))].sort();
  const filtered = findings.filter(f => {
    if (filterSeverity && f.severity !== filterSeverity) return false;
    if (filterCategory && f.category !== filterCategory) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="">All severities</option>
          {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {filtered.map((finding, i) => {
          const color = getSeverityColor(finding.severity);
          return (
            <div key={i} className="card !p-4 flex gap-4">
              <span className="badge shrink-0 self-start mt-0.5" style={{ backgroundColor: `${color}15`, color }}>{finding.severity}</span>
              <div className="min-w-0">
                <div className="font-medium text-sm text-gray-900">{finding.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{finding.description}</div>
                {finding.resourceName && <div className="text-xs text-gray-400 mt-1">Resource: {finding.resourceName}</div>}
                <div className="text-xs text-blue-600 mt-1">Recommendation: {finding.recommendation}</div>
              </div>
              <span className="badge shrink-0 self-start bg-gray-100 text-gray-600">{finding.category}</span>
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No findings match the current filters</p>}
      </div>
    </div>
  );
}
