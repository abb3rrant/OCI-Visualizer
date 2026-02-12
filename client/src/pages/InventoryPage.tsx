import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSnapshot } from '../contexts/SnapshotContext';
import { useResources, useResourceCounts } from '../hooks/useResources';
import { useQuery } from 'urql';
import { COMPARTMENTS_QUERY } from '../graphql/queries';
import SearchBar from '../components/common/SearchBar';
import FilterPanel from '../components/common/FilterPanel';
import ResourceTable from '../components/inventory/ResourceTable';

export default function InventoryPage() {
  const { currentSnapshot } = useSnapshot();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [resourceType, setResourceType] = useState(searchParams.get('type') || '');
  const [lifecycleState, setLifecycleState] = useState('');
  const [compartmentOcid, setCompartmentOcid] = useState(searchParams.get('compartment') || '');
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const { counts } = useResourceCounts(currentSnapshot?.id || null);
  const resourceTypes = useMemo(() => counts.map((c: any) => c.resourceType).sort(), [counts]);

  // Fetch compartments for the dropdown
  const [compartmentsResult] = useQuery({
    query: COMPARTMENTS_QUERY,
    variables: { snapshotId: currentSnapshot?.id || '' },
    pause: !currentSnapshot,
  });
  const compartments = compartmentsResult.data?.compartments || [];

  const { connection, loading } = useResources({
    snapshotId: currentSnapshot?.id || '',
    resourceType: resourceType || undefined,
    compartmentId: compartmentOcid || undefined,
    lifecycleState: lifecycleState || undefined,
    search: search || undefined,
    first: 50,
    after: cursor,
  });

  const resources = connection?.edges?.map((e: any) => e.node) || [];
  const hasNext = connection?.pageInfo?.hasNextPage || false;
  const totalCount = connection?.totalCount || 0;

  // CSV export
  const handleExportCsv = () => {
    if (!resources.length) return;
    const headers = ['OCID', 'Type', 'Name', 'State', 'Region', 'Availability Domain', 'Created'];
    const rows = resources.map((r: any) => [r.ocid, r.resourceType, r.displayName || '', r.lifecycleState || '', r.regionKey || '', r.availabilityDomain || '', r.timeCreated || '']);
    const csv = [headers, ...rows].map((r: string[]) => r.map((c: string) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oci-resources-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!currentSnapshot) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 text-lg">Select a snapshot to view inventory</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Resource Inventory</h2>
          <p className="text-gray-500 text-sm">{totalCount} resources</p>
        </div>
        <button onClick={handleExportCsv} className="btn-secondary text-sm" disabled={!resources.length}>
          Export CSV
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1"><SearchBar value={search} onChange={setSearch} /></div>
        <select
          value={compartmentOcid}
          onChange={(e) => { setCompartmentOcid(e.target.value); setCursor(undefined); }}
          className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white max-w-xs truncate"
        >
          <option value="">All Compartments</option>
          {compartments.map((c: any) => (
            <option key={c.ocid} value={c.ocid}>
              {c.displayName || c.ocid}
            </option>
          ))}
        </select>
        <FilterPanel
          resourceTypes={resourceTypes}
          selectedType={resourceType}
          onTypeChange={setResourceType}
          selectedState={lifecycleState}
          onStateChange={setLifecycleState}
        />
      </div>

      <ResourceTable resources={resources} loading={loading} />

      {/* Pagination */}
      {hasNext && (
        <div className="flex justify-center">
          <button
            onClick={() => setCursor(connection?.pageInfo?.endCursor || undefined)}
            className="btn-secondary text-sm"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
