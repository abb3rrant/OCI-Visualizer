import React, { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from 'urql';
import { useSnapshot } from '../contexts/SnapshotContext';
import { useResources, useResourceCounts } from '../hooks/useResources';
import { RESOURCE_QUERY } from '../graphql/queries';
import { CATEGORIES, groupCountsByCategory } from '../utils/categories';
import { formatResourceType } from '../utils/formatters';
import ResourceIcon from '../components/common/ResourceIcon';
import SearchBar from '../components/common/SearchBar';
import ResourceTable from '../components/inventory/ResourceTable';
import DetailPanel from '../components/layout/DetailPanel';
import type { Resource } from '../types';

export default function ExplorerPage() {
  const { currentSnapshot } = useSnapshot();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedType = searchParams.get('type') || '';
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => new Set(CATEGORIES.map((c) => c.key)),
  );
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const { counts, loading: countsLoading } = useResourceCounts(currentSnapshot?.id || null);

  const grouped = useMemo(() => groupCountsByCategory(counts), [counts]);

  // Ordered category groups following CATEGORIES order, then any remaining
  const orderedGroups = useMemo(() => {
    const result: { key: string; label: string; types: { resourceType: string; count: number }[] }[] = [];
    for (const cat of CATEGORIES) {
      const group = grouped.get(cat.key);
      if (group && group.types.length > 0) {
        result.push({ key: cat.key, ...group });
      }
    }
    // Include any categories not in CATEGORIES
    for (const [key, group] of grouped) {
      if (!CATEGORIES.some((c) => c.key === key)) {
        result.push({ key, ...group });
      }
    }
    return result;
  }, [grouped]);

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectType = (type: string) => {
    setSearchParams(type ? { type } : {});
    setSearch('');
    setCursor(undefined);
    setSelectedResourceId(null);
  };

  // Fetch resources for selected type (pause query when no type is selected)
  const { connection, loading: resourcesLoading } = useResources({
    snapshotId: selectedType ? (currentSnapshot?.id || '') : '',
    resourceType: selectedType || undefined,
    search: search || undefined,
    first: 50,
    after: cursor,
  });

  const resources = connection?.edges?.map((e: any) => e.node) || [];
  const hasNext = connection?.pageInfo?.hasNextPage || false;
  const totalCount = connection?.totalCount || 0;

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

  if (!currentSnapshot) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 dark:text-gray-500 text-lg">Select a snapshot to explore resources</p>
      </div>
    );
  }

  // Find the count for the selected type
  const selectedTypeCount = selectedType
    ? counts.find((c: any) => c.resourceType === selectedType)?.count || 0
    : 0;

  return (
    <div className="flex h-full -m-6">
      {/* Left sidebar — category accordion */}
      <div className="w-60 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0 overflow-y-auto">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Resource Explorer</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {counts.reduce((s: number, c: any) => s + c.count, 0)} resources
          </p>
        </div>

        {countsLoading ? (
          <div className="p-4 text-xs text-gray-400 dark:text-gray-500">Loading...</div>
        ) : (
          <nav className="flex-1 overflow-y-auto py-1">
            {orderedGroups.map((group) => {
              const categoryTotal = group.types.reduce((s, t) => s + t.count, 0);
              const isExpanded = expandedCategories.has(group.key);

              return (
                <div key={group.key}>
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(group.key)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <span className="flex items-center gap-1.5">
                      <svg
                        className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      {group.label}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 font-normal normal-case">{categoryTotal}</span>
                  </button>

                  {/* Resource types within category */}
                  {isExpanded && (
                    <div className="pb-1">
                      {group.types.map((t) => (
                        <button
                          key={t.resourceType}
                          onClick={() => selectType(t.resourceType)}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                            selectedType === t.resourceType
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <ResourceIcon resourceType={t.resourceType} size="sm" />
                          <span className="flex-1 text-left truncate text-xs">
                            {formatResourceType(t.resourceType)}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{t.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        )}
      </div>

      {/* Right panel — resource table or overview */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {selectedType ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ResourceIcon resourceType={selectedType} size="lg" />
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {formatResourceType(selectedType)}
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">{selectedTypeCount} resources</p>
                </div>
              </div>
              <button
                onClick={() => selectType('')}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Clear selection
              </button>
            </div>

            <SearchBar
              value={search}
              onChange={(v) => { setSearch(v); setCursor(undefined); }}
              placeholder={`Search ${formatResourceType(selectedType)} resources...`}
            />

            <ResourceTable
              resources={resources}
              loading={resourcesLoading}
              onRowClick={handleRowClick}
              selectedId={selectedResourceId}
            />

            {hasNext && (
              <div className="flex justify-center">
                <button
                  onClick={() => setCursor(connection?.pageInfo?.endCursor || undefined)}
                  className="btn-secondary text-sm"
                >
                  Load More ({totalCount - resources.length} remaining)
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-1">Select a resource type</h3>
            <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm">
              Browse the categories on the left and click a resource type to view its resources.
            </p>
          </div>
        )}
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
