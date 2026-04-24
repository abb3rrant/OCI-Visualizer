import React, { useState, useMemo } from 'react';
import { useComparison } from '../../contexts/ComparisonContext';
import { formatResourceType } from '../../utils/formatters';

export default function ComparisonPanel() {
  const { pinned, clearComparison } = useComparison();
  const [collapsed, setCollapsed] = useState(false);
  const [a, b] = pinned;

  const rows = useMemo(() => {
    if (!a || !b) return [];

    const result: { key: string; section: 'info' | 'raw' | 'tags'; aVal: string; bVal: string }[] = [];

    // Basic info
    const infoKeys: { key: string; get: (r: typeof a) => string }[] = [
      { key: 'Type', get: (r) => formatResourceType(r!.resourceType) },
      { key: 'State', get: (r) => r!.lifecycleState || '—' },
      { key: 'Region', get: (r) => r!.regionKey || '—' },
    ];
    for (const { key, get } of infoKeys) {
      result.push({ key, section: 'info', aVal: get(a), bVal: get(b) });
    }

    // Union of rawData keys
    const allRawKeys = new Set([...Object.keys(a.rawData || {}), ...Object.keys(b.rawData || {})]);
    for (const key of [...allRawKeys].sort()) {
      const aVal = a.rawData?.[key];
      const bVal = b.rawData?.[key];
      const fmt = (v: unknown) => v === undefined || v === null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);
      result.push({ key, section: 'raw', aVal: fmt(aVal), bVal: fmt(bVal) });
    }

    // Tags
    const allTagKeys = new Set([
      ...Object.keys(a.freeformTags || {}),
      ...Object.keys(b.freeformTags || {}),
    ]);
    for (const key of [...allTagKeys].sort()) {
      result.push({
        key: `tag:${key}`,
        section: 'tags',
        aVal: (a.freeformTags as Record<string, string>)?.[key] || '—',
        bVal: (b.freeformTags as Record<string, string>)?.[key] || '—',
      });
    }

    return result;
  }, [a, b]);

  if (!a || !b) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 border-t border-gray-300 dark:border-gray-600 shadow-2xl">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Comparing: {a.displayName || 'Unnamed'} vs {b.displayName || 'Unnamed'}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          >
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
          <button
            onClick={clearComparison}
            className="text-xs px-2 py-1 rounded border border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
          >
            Clear
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-100 dark:bg-gray-900">
              <tr>
                <th className="text-left px-3 py-1.5 font-medium text-gray-500 dark:text-gray-400 w-1/5">Field</th>
                <th className="text-left px-3 py-1.5 font-medium text-gray-500 dark:text-gray-400 w-2/5">{a.displayName || 'Resource A'}</th>
                <th className="text-left px-3 py-1.5 font-medium text-gray-500 dark:text-gray-400 w-2/5">{b.displayName || 'Resource B'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {rows.map((row) => {
                const differs = row.aVal !== row.bVal;
                return (
                  <tr key={`${row.section}-${row.key}`} className={differs ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}>
                    <td className="px-3 py-1 font-medium text-gray-600 dark:text-gray-400">{row.key}</td>
                    <td className={`px-3 py-1 break-all ${differs ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {row.aVal}
                    </td>
                    <td className={`px-3 py-1 break-all ${differs ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {row.bVal}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
