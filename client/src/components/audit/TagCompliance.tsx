import React, { useState, useCallback } from 'react';
import type { TagReport, Resource } from '../../types';

interface TagComplianceProps {
  report: TagReport | null;
  requiredTags: string[];
  onTagsChange: (tags: string[]) => void;
}

function truncateOcid(ocid: string | null): string {
  if (!ocid) return '-';
  if (ocid.length <= 40) return ocid;
  return ocid.slice(0, 20) + '...' + ocid.slice(-12);
}

function getMissingTags(resource: Resource, requiredTags: string[]): string[] {
  const tags = resource.freeformTags || {};
  return requiredTags.filter(t => !(t in tags));
}

export default function TagCompliance({ report, requiredTags, onTagsChange }: TagComplianceProps) {
  const [newTag, setNewTag] = useState('');

  const addTag = () => {
    if (newTag.trim() && !requiredTags.includes(newTag.trim())) {
      onTagsChange([...requiredTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    onTagsChange(requiredTags.filter(t => t !== tag));
  };

  const exportCsv = useCallback(() => {
    if (!report?.missingTagResources?.length) return;
    const header = 'Name,Type,Compartment OCID,Missing Tags';
    const rows = report.missingTagResources.map((r) => {
      const missing = getMissingTags(r, requiredTags).join('; ');
      const name = (r.displayName || '(unnamed)').replace(/,/g, ' ');
      const type = r.resourceType.replace(/,/g, ' ');
      const compartment = r.compartmentId || '';
      return `${name},${type},${compartment},${missing}`;
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tag-compliance-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [report, requiredTags]);

  return (
    <div className="space-y-4">
      {/* Tag input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTag()}
          placeholder="Add required tag key..."
          className="input-field flex-1"
        />
        <button onClick={addTag} className="btn-primary text-sm">Add</button>
      </div>

      <div className="flex flex-wrap gap-2">
        {requiredTags.map(tag => (
          <span key={tag} className="badge bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 gap-1">
            {tag}
            <button onClick={() => removeTag(tag)} className="hover:text-blue-900 dark:hover:text-blue-100">&times;</button>
          </span>
        ))}
      </div>

      {report && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{report.totalResources}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Total Resources</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{report.compliantResources}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Compliant</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{report.nonCompliantResources}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Non-Compliant</div>
            </div>
          </div>

          {/* Coverage bars */}
          <div className="space-y-3">
            {report.tagCoverage.map(tc => (
              <div key={tc.tagKey}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{tc.tagKey}</span>
                  <span className="text-gray-500 dark:text-gray-400">{tc.count}/{tc.total} ({tc.percentage.toFixed(0)}%)</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full"
                    style={{
                      width: `${tc.percentage}%`,
                      backgroundColor: tc.percentage >= 80 ? '#10B981' : tc.percentage >= 50 ? '#F59E0B' : '#EF4444',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Non-compliant resources table */}
          {report.missingTagResources && report.missingTagResources.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Non-Compliant Resources ({report.missingTagResources.length})</h3>
                <button
                  onClick={exportCsv}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wide">
                      <th className="text-left px-3 py-2 font-medium">Name</th>
                      <th className="text-left px-3 py-2 font-medium">Type</th>
                      <th className="text-left px-3 py-2 font-medium">Compartment</th>
                      <th className="text-left px-3 py-2 font-medium">Missing Tags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {report.missingTagResources.map((r) => {
                      const missing = getMissingTags(r, requiredTags);
                      return (
                        <tr key={r.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-3 py-1.5 text-gray-900 dark:text-gray-100">{r.displayName || '(unnamed)'}</td>
                          <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400 text-xs">{r.resourceType}</td>
                          <td className="px-3 py-1.5 text-gray-500 dark:text-gray-400 font-mono text-xs" title={r.compartmentId || ''}>{truncateOcid(r.compartmentId)}</td>
                          <td className="px-3 py-1.5">
                            <div className="flex flex-wrap gap-1">
                              {missing.map(tag => (
                                <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800">{tag}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
