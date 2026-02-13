import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSnapshot } from '../contexts/SnapshotContext';
import { useResources } from '../hooks/useResources';
import { useQuery } from 'urql';
import { COMPARTMENTS_QUERY, RESOURCE_WITH_BLOBS_QUERY } from '../graphql/queries';
import SearchBar from '../components/common/SearchBar';
import StateBadge from '../components/common/StateBadge';
import type { Resource, ResourceBlob } from '../types';

const BLOB_LABELS: Record<string, string> = {
  userData: 'User Data',
  sshAuthorizedKeys: 'SSH Keys',
};

function ComputeDetailPanel({
  resource,
  blobs,
  onClose,
}: {
  resource: Resource;
  blobs: ResourceBlob[];
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const rawData = resource.rawData || {};

  const tabs = blobs.map(b => b.blobKey);

  // Reset active tab when resource changes
  useEffect(() => {
    setActiveTab(null);
  }, [resource.id]);

  return (
    <div className="w-[480px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col shrink-0 overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
            {resource.displayName || 'Unnamed'}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Compute Instance</p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Status badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <StateBadge state={resource.lifecycleState} />
          {resource.availabilityDomain && (
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
              {resource.availabilityDomain}
            </span>
          )}
          {resource.regionKey && (
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
              {resource.regionKey}
            </span>
          )}
        </div>

        {/* Info section */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-100 dark:border-gray-700 pb-1">
            Details
          </h3>
          <dl className="space-y-2 text-sm">
            {rawData.shape && (
              <div>
                <dt className="text-xs text-gray-400 dark:text-gray-500 font-medium">Shape</dt>
                <dd className="text-gray-700 dark:text-gray-300 mt-0.5">{rawData.shape}</dd>
              </div>
            )}
            {rawData.faultDomain && (
              <div>
                <dt className="text-xs text-gray-400 dark:text-gray-500 font-medium">Fault Domain</dt>
                <dd className="text-gray-700 dark:text-gray-300 mt-0.5">{rawData.faultDomain}</dd>
              </div>
            )}
            {rawData.imageId && (
              <div>
                <dt className="text-xs text-gray-400 dark:text-gray-500 font-medium">Image ID</dt>
                <dd className="font-mono text-xs break-all text-gray-600 dark:text-gray-400 mt-0.5">
                  {rawData.imageId}
                </dd>
              </div>
            )}
            {rawData.launchMode && (
              <div>
                <dt className="text-xs text-gray-400 dark:text-gray-500 font-medium">Launch Mode</dt>
                <dd className="text-gray-700 dark:text-gray-300 mt-0.5">{rawData.launchMode}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-gray-400 dark:text-gray-500 font-medium">OCID</dt>
              <dd className="font-mono text-xs break-all text-gray-600 dark:text-gray-400 mt-0.5">
                {resource.ocid}
              </dd>
            </div>
          </dl>
        </section>

        {/* Blob tabs */}
        {tabs.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-100 dark:border-gray-700 pb-1">
              Startup Configuration
            </h3>
            <div className="flex gap-1 mb-3">
              {tabs.map(key => (
                <button
                  key={key}
                  onClick={() => setActiveTab(activeTab === key ? null : key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    activeTab === key
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {BLOB_LABELS[key] || key}
                </button>
              ))}
            </div>

            {activeTab && (
              <pre className="font-mono text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 overflow-auto max-h-[500px] whitespace-pre-wrap break-words dark:text-gray-300">
                {blobs.find(b => b.blobKey === activeTab)?.content || ''}
              </pre>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

const MAX_ACCUMULATED = 500;

export default function ComputePage() {
  const { currentSnapshot } = useSnapshot();
  const [search, setSearch] = useState('');
  const [compartmentOcid, setCompartmentOcid] = useState('');
  const [lifecycleState, setLifecycleState] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [accumulatedResources, setAccumulatedResources] = useState<any[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);

  // Fetch compartments for the dropdown
  const [compartmentsResult] = useQuery({
    query: COMPARTMENTS_QUERY,
    variables: { snapshotId: currentSnapshot?.id || '' },
    pause: !currentSnapshot,
  });
  const compartments = compartmentsResult.data?.compartments || [];

  const { connection, loading } = useResources({
    snapshotId: currentSnapshot?.id || '',
    resourceType: 'compute/instance',
    compartmentId: compartmentOcid || undefined,
    lifecycleState: lifecycleState || undefined,
    search: search || undefined,
    first: 50,
    after: cursor,
  });

  // Accumulate resources across pages; reset when filters change
  const filterKey = `${currentSnapshot?.id}|${compartmentOcid}|${lifecycleState}|${search}`;
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

  // Fetch detail + blobs for selected resource
  const [detailResult] = useQuery({
    query: RESOURCE_WITH_BLOBS_QUERY,
    variables: { id: selectedResourceId || '' },
    pause: !selectedResourceId,
  });

  const handleRowClick = useCallback((resource: Resource) => {
    setSelectedResourceId(prev => (prev === resource.id ? null : resource.id));
  }, []);

  if (!currentSnapshot) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 dark:text-gray-500 text-lg">Select a snapshot to view compute instances</p>
      </div>
    );
  }

  const selectedResource = detailResult.data?.resource;
  const selectedBlobs: ResourceBlob[] = selectedResource?.blobs || [];

  return (
    <div className="flex h-full -m-6">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Compute Instances</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{totalCount} instances</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <SearchBar value={search} onChange={setSearch} />
          </div>
          <select
            value={compartmentOcid}
            onChange={e => { setCompartmentOcid(e.target.value); setCursor(undefined); }}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 dark:text-gray-200 max-w-xs truncate"
          >
            <option value="">All Compartments</option>
            {compartments.map((c: any) => (
              <option key={c.ocid} value={c.ocid}>
                {c.displayName || c.ocid}
              </option>
            ))}
          </select>
          <select
            value={lifecycleState}
            onChange={e => { setLifecycleState(e.target.value); setCursor(undefined); }}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="">All States</option>
            <option value="RUNNING">Running</option>
            <option value="STOPPED">Stopped</option>
            <option value="TERMINATED">Terminated</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Shape</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">State</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fault Domain</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">AD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {resources.map((r: any) => {
                const raw = typeof r.rawData === 'string' ? JSON.parse(r.rawData) : (r.rawData || {});
                return (
                  <tr
                    key={r.id}
                    onClick={() => handleRowClick(r)}
                    className={`cursor-pointer transition-colors ${
                      selectedResourceId === r.id
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium truncate max-w-[200px]">
                      {r.displayName || 'Unnamed'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {raw.shape || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <StateBadge state={r.lifecycleState} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {raw.faultDomain || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {r.availabilityDomain || '-'}
                    </td>
                  </tr>
                );
              })}
              {resources.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                    No compute instances found
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                    Loading...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

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
      {selectedResourceId && selectedResource && (
        <ComputeDetailPanel
          resource={selectedResource}
          blobs={selectedBlobs}
          onClose={() => setSelectedResourceId(null)}
        />
      )}
    </div>
  );
}
