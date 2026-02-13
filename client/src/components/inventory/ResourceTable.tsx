import React, { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Resource } from '../../types';
import ResourceIcon from '../common/ResourceIcon';
import StateBadge from '../common/StateBadge';
import { formatOcid, formatDate, formatResourceType } from '../../utils/formatters';

interface ResourceTableProps {
  resources: Resource[];
  loading?: boolean;
  onRowClick?: (resource: Resource) => void;
  selectedId?: string | null;
}

type SortKey = 'displayName' | 'resourceType' | 'lifecycleState' | 'timeCreated';

const ROW_HEIGHT = 41;

export default function ResourceTable({ resources, loading, onRowClick, selectedId }: ResourceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('resourceType');
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = useMemo(() => {
    return [...resources].sort((a, b) => {
      const aVal = (a[sortKey] || '').toLowerCase();
      const bVal = (b[sortKey] || '').toLowerCase();
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [resources, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
      onClick={() => handleSort(field)}
    >
      {label} {sortKey === field && (sortAsc ? '\u2191' : '\u2193')}
    </th>
  );

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  if (loading) return <div className="text-gray-400 dark:text-gray-500 py-8 text-center">Loading resources...</div>;
  if (!resources.length) return <div className="text-gray-400 dark:text-gray-500 py-8 text-center">No resources found</div>;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <tr>
            <th className="px-4 py-3 w-10"></th>
            <SortHeader label="Name" field="displayName" />
            <SortHeader label="Type" field="resourceType" />
            <SortHeader label="State" field="lifecycleState" />
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Region</th>
            <SortHeader label="Created" field="timeCreated" />
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">OCID</th>
          </tr>
        </thead>
      </table>
      <div
        ref={parentRef}
        className="overflow-y-auto"
        style={{ maxHeight: '70vh' }}
      >
        <table className="w-full text-sm">
          <tbody>
            <tr style={{ height: virtualizer.getTotalSize() }}>
              <td style={{ padding: 0, border: 'none' }}>
                <div style={{ position: 'relative', width: '100%', height: virtualizer.getTotalSize() }}>
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const r = sorted[virtualRow.index];
                    return (
                      <table
                        key={r.id}
                        className="w-full text-sm"
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <tbody>
                          <tr
                            className={`hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 ${onRowClick ? 'cursor-pointer' : ''} ${selectedId === r.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                            onClick={() => onRowClick?.(r)}
                          >
                            <td className="px-4 py-2 w-10"><ResourceIcon resourceType={r.resourceType} size="sm" /></td>
                            <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{r.displayName || '-'}</td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{formatResourceType(r.resourceType)}</td>
                            <td className="px-4 py-2"><StateBadge state={r.lifecycleState} /></td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{r.regionKey || '-'}</td>
                            <td className="px-4 py-2 text-gray-500 dark:text-gray-400 text-xs">{formatDate(r.timeCreated)}</td>
                            <td className="px-4 py-2 font-mono text-xs text-gray-400 dark:text-gray-500">{formatOcid(r.ocid)}</td>
                          </tr>
                        </tbody>
                      </table>
                    );
                  })}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
