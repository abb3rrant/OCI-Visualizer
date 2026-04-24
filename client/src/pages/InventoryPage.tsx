import React, { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSnapshot } from '../contexts/SnapshotContext';
import { useDetailPanel } from '../contexts/DetailPanelContext';
import { useResources, useResourceCounts } from '../hooks/useResources';
import { usePagination } from '../hooks/usePagination';
import { useQuery, useClient } from 'urql';
import { COMPARTMENTS_QUERY, EXPORT_RESOURCES_QUERY } from '../graphql/queries';
import SearchBar from '../components/common/SearchBar';
import FilterPanel from '../components/common/FilterPanel';
import RegexToggle from '../components/common/RegexToggle';
import ResourceTable from '../components/inventory/ResourceTable';
import SkeletonTable from '../components/common/SkeletonTable';
import type { Resource } from '../types';

const PAGE_SIZE = 50;

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

  const [regexEnabled, setRegexEnabled] = useState(false);
  const urqlClient = useClient();
  const { openResource, selectedResourceId } = useDetailPanel();

  const { counts } = useResourceCounts(currentSnapshot?.id || null);
  const resourceTypes = useMemo(() => counts.map((c: any) => c.resourceType).sort(), [counts]);

  // Fetch compartments for the dropdown
  const [compartmentsResult] = useQuery({
    query: COMPARTMENTS_QUERY,
    variables: { snapshotId: currentSnapshot?.id || '' },
    pause: !currentSnapshot,
  });
  const compartments = compartmentsResult.data?.compartments || [];

  const filterKey = `${currentSnapshot?.id}|${resourceType}|${compartmentOcid}|${lifecycleState}|${search}`;
  const { cursor, pageIndex, pageSize, goNextPage, goPrevPage } = usePagination({ pageSize: PAGE_SIZE, filterKey });

  const { connection, loading } = useResources({
    snapshotId: currentSnapshot?.id || '',
    resourceType: resourceType || undefined,
    compartmentId: compartmentOcid || undefined,
    lifecycleState: lifecycleState || undefined,
    search: search || undefined,
    isRegex: regexEnabled || undefined,
    first: pageSize,
    after: cursor,
  });

  const resources = connection?.edges?.map((e: any) => e.node) || [];
  const hasNext = connection?.pageInfo?.hasNextPage || false;
  const totalCount = connection?.totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleNextPage = useCallback(() => {
    goNextPage(connection?.pageInfo?.endCursor);
  }, [goNextPage, connection?.pageInfo?.endCursor]);

  const handlePrevPage = goPrevPage;

  const handleRowClick = useCallback((resource: Resource) => {
    openResource(resource.id);
  }, [openResource]);

  // CSV export (current page)
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

  // Export All (all matching rows with tags)
  const handleExportAll = async () => {
    if (!currentSnapshot) return;
    const result = await urqlClient.query(EXPORT_RESOURCES_QUERY, {
      filter: {
        snapshotId: currentSnapshot.id,
        resourceType: resourceType || undefined,
        compartmentId: compartmentOcid || undefined,
        lifecycleState: lifecycleState || undefined,
        search: search || undefined,
        isRegex: regexEnabled || undefined,
      },
    }).toPromise();
    const allResources = result.data?.exportResources || [];
    if (!allResources.length) return;
    const headers = ['OCID', 'Type', 'Name', 'State', 'Region', 'Availability Domain', 'Created', 'Compartment', 'Freeform Tags', 'Defined Tags'];
    const rows = allResources.map((r: any) => [
      r.ocid, r.resourceType, r.displayName || '', r.lifecycleState || '', r.regionKey || '',
      r.availabilityDomain || '', r.timeCreated || '', r.compartmentId || '',
      r.freeformTags ? JSON.stringify(r.freeformTags) : '',
      r.definedTags ? JSON.stringify(r.definedTags) : '',
    ]);
    const csv = [headers, ...rows].map((r: string[]) => r.map((c: string) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oci-resources-all-${new Date().toISOString().slice(0, 10)}.csv`;
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
    <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Resource Inventory</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{totalCount} resources</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportAll} className="btn-secondary text-sm" disabled={!totalCount}>
              Export All
            </button>
            <button onClick={handleExportCsv} className="btn-secondary text-sm" disabled={!resources.length}>
              Export CSV
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1"><SearchBar value={search} onChange={setSearch} /></div>
            <RegexToggle enabled={regexEnabled} onToggle={() => setRegexEnabled(!regexEnabled)} />
          </div>
          <select
            value={compartmentOcid}
            onChange={(e) => setCompartmentOcid(e.target.value)}
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

        {loading ? (
          <SkeletonTable rows={8} columns={7} />
        ) : (
          <ResourceTable
            resources={resources}
            loading={false}
            onRowClick={handleRowClick}
            selectedId={selectedResourceId}
          />
        )}

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {pageIndex * PAGE_SIZE + 1}–{Math.min((pageIndex + 1) * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPage}
                disabled={pageIndex === 0}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {pageIndex + 1} of {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={!hasNext}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
