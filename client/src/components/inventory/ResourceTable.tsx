import React, { useState } from 'react';
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

export default function ResourceTable({ resources, loading, onRowClick, selectedId }: ResourceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('resourceType');
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = [...resources].sort((a, b) => {
    const aVal = (a[sortKey] || '').toLowerCase();
    const bVal = (b[sortKey] || '').toLowerCase();
    return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700"
      onClick={() => handleSort(field)}
    >
      {label} {sortKey === field && (sortAsc ? '↑' : '↓')}
    </th>
  );

  if (loading) return <div className="text-gray-400 py-8 text-center">Loading resources...</div>;
  if (!resources.length) return <div className="text-gray-400 py-8 text-center">No resources found</div>;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 w-10"></th>
            <SortHeader label="Name" field="displayName" />
            <SortHeader label="Type" field="resourceType" />
            <SortHeader label="State" field="lifecycleState" />
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Region</th>
            <SortHeader label="Created" field="timeCreated" />
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">OCID</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.map((r) => (
            <tr
              key={r.id}
              className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''} ${selectedId === r.id ? 'bg-blue-50' : ''}`}
              onClick={() => onRowClick?.(r)}
            >
              <td className="px-4 py-2"><ResourceIcon resourceType={r.resourceType} size="sm" /></td>
              <td className="px-4 py-2 font-medium text-gray-900">{r.displayName || '-'}</td>
              <td className="px-4 py-2 text-gray-600">{formatResourceType(r.resourceType)}</td>
              <td className="px-4 py-2"><StateBadge state={r.lifecycleState} /></td>
              <td className="px-4 py-2 text-gray-600">{r.regionKey || '-'}</td>
              <td className="px-4 py-2 text-gray-500 text-xs">{formatDate(r.timeCreated)}</td>
              <td className="px-4 py-2 font-mono text-xs text-gray-400">{formatOcid(r.ocid)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
