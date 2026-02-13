import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSnapshot } from '../contexts/SnapshotContext';
import { useResources, useResourceCounts } from '../hooks/useResources';
import { useQuery } from 'urql';
import { COMPARTMENTS_QUERY, RESOURCE_QUERY } from '../graphql/queries';
import SearchBar from '../components/common/SearchBar';
import FilterPanel from '../components/common/FilterPanel';
import ResourceTable from '../components/inventory/ResourceTable';
import SkeletonTable from '../components/common/SkeletonTable';
import DetailPanel from '../components/layout/DetailPanel';
import type { Resource } from '../types';

const MAX_ACCUMULATED = 500;

export default function InventoryPage() {
  const { currentSnapshot } = useSnapshot();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-driven filter state
  const search = searchParams.get('q') || '';
  const resourceType = searchParams.get('type') || '';
  const lifecycleState = searchParams.get('state') || '';
  const compartmentOcid = searchParams.get('compartment') || '';

  const updateParam = useCallback((key: string, value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setSearch = useCallback((v: string) => updateParam('q', v), [updateParam]);
  const setResourceType = useCallback((v: string) => updateParam('type', v), [updateParam]);
  const setLifecycleState = useCallback((v: string) => updateParam('state', v), [updateParam]);
  const setCompartmentOcid = useCallback((v: string) => updateParam('compartment', v), [updateParam]);

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [accumulatedResources, setAccumulatedResources] = useState<any[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);

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

  // Accumulate resources across pages; reset when filters change
  const filterKey = `${currentSnapshot?.id}|${resourceType}|${compartmentOcid}|${lifecycleState}|${search}`;
  const prevFilterKey = useRef(filterKey);
  useEffect(() => {
    if (prevFilterKey.current !== filterKey) {
      setAccumulatedResources([]);
      setCursor(undefined);
      prevFilterKey.current = filterKey;
    }
  }, [filterKey]);

  const currentPageResources = connection?.edges?.map((e: any) => e.node) || [];
  useEffect(() => {
    if (currentPageResources.length > 0) {
      setAccumulatedResources(prev => {
        if (!cursor) return currentPageResources;
        if (prev.length >= MAX_ACCUMULATED) return prev;
        const existingIds = new Set(prev.map((r: any) => r.id));
        const newItems = currentPageResources.filter((r: any) => !existingIds.has(r.id));
        const combined = [...prev, ...newItems];
        return combined.slice(0, MAX_ACCUMULATED);
      });
    }
  }, [connection]);

  const resources = accumulatedResources;
  const hasNext = connection?.pageInfo?.hasNextPage || false;
  const totalCount = connection?.totalCount || 0;
  const atCap = resources.length >= MAX_ACCUMULATED && totalCount > MAX_ACCUMULATED;

  // Fetch full details for selected resource
  const [resourceResult] = useQuery({
    query: RESOURCE_QUERY,
    variables: { id: selectedResourceId || '' },
    pause: !selectedResourceId,
  });

  const handleRowClick = useCallback((resource: Resource) => {
    setSelectedResourceId(resource.id);
  }, []);

  const handleNavigateResource = useCallback((resourceId: string) => {
    setSelectedResourceId(resourceId);
  }, []);

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
        <p className="text-gray-400 dark:text-gray-500 text-lg">Select a snapshot to view inventory</p>
      </div>
    );
  }

  return (
    <div className="flex h-full -m-6">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Resource Inventory</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{totalCount} resources</p>
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
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 dark:text-gray-200 max-w-xs truncate"
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

        {loading && resources.length === 0 ? (
          <SkeletonTable rows={8} columns={7} />
        ) : (
          <ResourceTable
            resources={resources}
            loading={loading && resources.length > 0}
            onRowClick={handleRowClick}
            selectedId={selectedResourceId}
          />
        )}

        {/* Pagination */}
        {atCap ? (
          <div className="text-center text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            Showing {MAX_ACCUMULATED} of {totalCount.toLocaleString()}. Use filters to narrow results.
          </div>
        ) : hasNext ? (
          <div className="flex justify-center">
            <button
              onClick={() => setCursor(connection?.pageInfo?.endCursor || undefined)}
              className="btn-secondary text-sm"
            >
              Load More
            </button>
          </div>
        ) : null}
      </div>

      {/* Detail panel */}
      {selectedResourceId && resourceResult.data?.resource && (
        <DetailPanel
          resource={resourceResult.data.resource}
          onClose={() => setSelectedResourceId(null)}
          onNavigate={handleNavigateResource}
        />
      )}
    </div>
  );
}
