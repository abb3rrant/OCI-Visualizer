import React, { useState, useCallback, useEffect } from 'react';
import { useSnapshot } from '../contexts/SnapshotContext';
import { usePagination } from '../hooks/usePagination';
import { useQuery } from 'urql';
import { COMPARTMENTS_QUERY, RESOURCE_WITH_BLOBS_QUERY, RESOURCE_BY_OCID_QUERY, COMPUTE_RESOURCES_QUERY } from '../graphql/queries';
import SearchBar from '../components/common/SearchBar';
import StateBadge from '../components/common/StateBadge';
import BlobListView from '../components/compute/BlobListView';
import HighlightedSnippet from '../components/common/HighlightedSnippet';
import RegexToggle from '../components/common/RegexToggle';
import { useAuth } from '../contexts/AuthContext';
import type { Resource, ResourceBlob } from '../types';

function decodeBlob(content: string, blobKey: string): string {
  if (blobKey !== 'ansibleArgs') return content;
  try {
    return atob(content);
  } catch {
    return content;
  }
}

const BLOB_LABELS: Record<string, string> = {
  userData: 'User Data',
  sshAuthorizedKeys: 'SSH Keys',
  ansibleArgs: 'Ansible Args',
  bootstrapKubeletConfig: 'Kubelet Config',
};

function ImageDetailsInline({ imageOcid, snapshotId, instanceRawData }: { imageOcid: string; snapshotId: string; instanceRawData?: any }) {
  const [expanded, setExpanded] = useState(false);
  const [result] = useQuery({
    query: RESOURCE_BY_OCID_QUERY,
    variables: { ocid: imageOcid, snapshotId },
    pause: !expanded,
  });

  const image = result.data?.resourceByOcid;
  const imageRaw = image?.rawData || {};
  const srcDetails = instanceRawData?.sourceDetails || {};
  const launchOpts = instanceRawData?.launchOptions || {};

  return (
    <div>
      <dt className="text-xs text-gray-400 dark:text-gray-500 font-medium">Image</dt>
      <dd className="mt-0.5">
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="font-mono text-xs break-all text-blue-600 dark:text-blue-400 hover:underline text-left"
        >
          {imageOcid}
          <svg
            className={`inline-block w-3 h-3 ml-1 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        {expanded && (
          <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2">
            {result.fetching && (
              <p className="text-xs text-gray-400 dark:text-gray-500">Loading image details...</p>
            )}
            {!result.fetching && !image && (
              <>
                <p className="text-xs text-amber-500 dark:text-amber-400">Image not in snapshot (likely a decommissioned platform image)</p>
                {(srcDetails.sourceType || srcDetails.bootVolumeSizeInGbs || Object.keys(launchOpts).length > 0) && (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                    {srcDetails.sourceType && (
                      <>
                        <dt className="text-gray-400 dark:text-gray-500 font-medium">Source Type</dt>
                        <dd className="text-gray-700 dark:text-gray-300">{srcDetails.sourceType}</dd>
                      </>
                    )}
                    {srcDetails.bootVolumeSizeInGbs && (
                      <>
                        <dt className="text-gray-400 dark:text-gray-500 font-medium">Boot Volume</dt>
                        <dd className="text-gray-700 dark:text-gray-300">{srcDetails.bootVolumeSizeInGbs} GB</dd>
                      </>
                    )}
                    {srcDetails.bootVolumeVpusPerGb != null && (
                      <>
                        <dt className="text-gray-400 dark:text-gray-500 font-medium">Boot VPUs/GB</dt>
                        <dd className="text-gray-700 dark:text-gray-300">{srcDetails.bootVolumeVpusPerGb}</dd>
                      </>
                    )}
                    {srcDetails.kmsKeyId && (
                      <>
                        <dt className="text-gray-400 dark:text-gray-500 font-medium">KMS Key</dt>
                        <dd className="text-gray-700 dark:text-gray-300 font-mono break-all">{srcDetails.kmsKeyId}</dd>
                      </>
                    )}
                    {launchOpts.bootVolumeType && (
                      <>
                        <dt className="text-gray-400 dark:text-gray-500 font-medium">Boot Type</dt>
                        <dd className="text-gray-700 dark:text-gray-300">{launchOpts.bootVolumeType}</dd>
                      </>
                    )}
                    {launchOpts.networkType && (
                      <>
                        <dt className="text-gray-400 dark:text-gray-500 font-medium">Network Type</dt>
                        <dd className="text-gray-700 dark:text-gray-300">{launchOpts.networkType}</dd>
                      </>
                    )}
                    {launchOpts.firmware && (
                      <>
                        <dt className="text-gray-400 dark:text-gray-500 font-medium">Firmware</dt>
                        <dd className="text-gray-700 dark:text-gray-300">{launchOpts.firmware}</dd>
                      </>
                    )}
                    {launchOpts.remoteDataVolumeType && (
                      <>
                        <dt className="text-gray-400 dark:text-gray-500 font-medium">Data Volume Type</dt>
                        <dd className="text-gray-700 dark:text-gray-300">{launchOpts.remoteDataVolumeType}</dd>
                      </>
                    )}
                  </dl>
                )}
              </>
            )}
            {image && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {image.displayName || 'Unnamed Image'}
                  </span>
                  <StateBadge state={image.lifecycleState} />
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                  {imageRaw.operatingSystem && (
                    <>
                      <dt className="text-gray-400 dark:text-gray-500 font-medium">OS</dt>
                      <dd className="text-gray-700 dark:text-gray-300">{imageRaw.operatingSystem}</dd>
                    </>
                  )}
                  {imageRaw.operatingSystemVersion && (
                    <>
                      <dt className="text-gray-400 dark:text-gray-500 font-medium">OS Version</dt>
                      <dd className="text-gray-700 dark:text-gray-300">{imageRaw.operatingSystemVersion}</dd>
                    </>
                  )}
                  {imageRaw.sizeInMBs != null && (
                    <>
                      <dt className="text-gray-400 dark:text-gray-500 font-medium">Size</dt>
                      <dd className="text-gray-700 dark:text-gray-300">
                        {imageRaw.sizeInMBs >= 1024
                          ? `${(imageRaw.sizeInMBs / 1024).toFixed(1)} GB`
                          : `${imageRaw.sizeInMBs} MB`}
                      </dd>
                    </>
                  )}
                  {imageRaw.baseImageId && (
                    <>
                      <dt className="text-gray-400 dark:text-gray-500 font-medium">Base Image</dt>
                      <dd className="text-gray-700 dark:text-gray-300 font-mono break-all">{imageRaw.baseImageId}</dd>
                    </>
                  )}
                  {imageRaw.createImageAllowed != null && (
                    <>
                      <dt className="text-gray-400 dark:text-gray-500 font-medium">Create Allowed</dt>
                      <dd className="text-gray-700 dark:text-gray-300">{imageRaw.createImageAllowed ? 'Yes' : 'No'}</dd>
                    </>
                  )}
                  {imageRaw.launchMode && (
                    <>
                      <dt className="text-gray-400 dark:text-gray-500 font-medium">Launch Mode</dt>
                      <dd className="text-gray-700 dark:text-gray-300">{imageRaw.launchMode}</dd>
                    </>
                  )}
                  {imageRaw.launchOptions && (
                    <>
                      <dt className="text-gray-400 dark:text-gray-500 font-medium">Boot Volume</dt>
                      <dd className="text-gray-700 dark:text-gray-300">{imageRaw.launchOptions.bootVolumeType || '-'}</dd>
                      <dt className="text-gray-400 dark:text-gray-500 font-medium">Network</dt>
                      <dd className="text-gray-700 dark:text-gray-300">{imageRaw.launchOptions.networkType || '-'}</dd>
                      <dt className="text-gray-400 dark:text-gray-500 font-medium">Firmware</dt>
                      <dd className="text-gray-700 dark:text-gray-300">{imageRaw.launchOptions.firmware || '-'}</dd>
                    </>
                  )}
                  {imageRaw.agentFeatures && (
                    <>
                      <dt className="text-gray-400 dark:text-gray-500 font-medium">Monitoring</dt>
                      <dd className="text-gray-700 dark:text-gray-300">
                        {imageRaw.agentFeatures.isMonitoringSupported ? 'Supported' : 'Not supported'}
                      </dd>
                      <dt className="text-gray-400 dark:text-gray-500 font-medium">Management</dt>
                      <dd className="text-gray-700 dark:text-gray-300">
                        {imageRaw.agentFeatures.isManagementSupported ? 'Supported' : 'Not supported'}
                      </dd>
                    </>
                  )}
                  {image.timeCreated && (
                    <>
                      <dt className="text-gray-400 dark:text-gray-500 font-medium">Created</dt>
                      <dd className="text-gray-700 dark:text-gray-300">
                        {new Date(image.timeCreated).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </dd>
                    </>
                  )}
                </dl>
              </>
            )}
          </div>
        )}
      </dd>
    </div>
  );
}

function ComputeDetailPanel({
  resource,
  blobs,
  onClose,
  initialBlobKey,
  snapshotId,
}: {
  resource: Resource;
  blobs: ResourceBlob[];
  onClose: () => void;
  initialBlobKey?: string | null;
  snapshotId: string;
}) {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [jsonSearch, setJsonSearch] = useState('');
  const [jsonRegex, setJsonRegex] = useState(false);
  const rawData = resource.rawData || {};

  const tabs = blobs.map(b => b.blobKey);

  // Auto-select blob tab: specific key from blob search, or first available
  useEffect(() => {
    if (initialBlobKey && tabs.includes(initialBlobKey)) {
      setActiveTab(initialBlobKey);
    } else if (tabs.length > 0) {
      setActiveTab(tabs[0]);
    } else {
      setActiveTab(null);
    }
  }, [resource.id, initialBlobKey]);

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
            {(rawData.imageId || rawData.sourceDetails?.imageId) && (
              <ImageDetailsInline imageOcid={rawData.imageId || rawData.sourceDetails.imageId} snapshotId={snapshotId} instanceRawData={rawData} />
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
                {decodeBlob(blobs.find(b => b.blobKey === activeTab)?.content || '', activeTab)}
              </pre>
            )}
          </section>
        )}

        {/* Tags */}
        {(() => {
          const freeformTags: Record<string, string> = resource.freeformTags || {};
          const definedTags: Record<string, Record<string, string>> = resource.definedTags || {};
          const hasFreeform = Object.keys(freeformTags).length > 0;
          const hasDefined = Object.keys(definedTags).length > 0;
          if (!hasFreeform && !hasDefined) return null;
          return (
            <section>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-100 dark:border-gray-700 pb-1">
                Tags
              </h3>
              {hasFreeform && (
                <div className="mb-2">
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-1">Freeform</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(freeformTags).map(([k, v]) => (
                      <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        <span className="font-medium">{k}</span>
                        <span className="text-gray-400 dark:text-gray-500">:</span>
                        <span>{v}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {hasDefined && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-1">Defined</p>
                  {Object.entries(definedTags).map(([ns, kvs]) => (
                    <div key={ns} className="mb-1.5">
                      <p className="text-xs text-gray-400 dark:text-gray-500 italic mb-0.5">{ns}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(kvs).map(([k, v]) => (
                          <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                            <span className="font-medium">{k}</span>
                            <span className="text-blue-400 dark:text-blue-500">:</span>
                            <span>{v}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })()}

        {/* Raw JSON */}
        <section>
          <button
            onClick={() => setShowRawJson(prev => !prev)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
          >
            {showRawJson ? 'Hide' : 'Show'} Raw JSON
          </button>
          {showRawJson && (
            <>
              <div className="flex items-center gap-1.5 mt-2 mb-1">
                <input
                  type="text"
                  placeholder="Search JSON..."
                  value={jsonSearch}
                  onChange={e => setJsonSearch(e.target.value)}
                  className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 dark:text-gray-200"
                />
                <RegexToggle enabled={jsonRegex} onToggle={() => setJsonRegex(prev => !prev)} />
              </div>
              <pre className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs overflow-auto max-h-96 border border-gray-200 dark:border-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                <HighlightedSnippet
                  text={JSON.stringify(rawData, null, 2)}
                  query={jsonSearch}
                  isRegex={jsonRegex}
                />
              </pre>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

const PAGE_SIZE = 50;

const BLOB_TABS = [
  { key: 'userData', label: 'User Data' },
  { key: 'sshAuthorizedKeys', label: 'SSH Keys' },
  { key: 'ansibleArgs', label: 'Ansible Args' },
  { key: 'bootstrapKubeletConfig', label: 'Kubelet Config' },
] as const;


export default function ComputePage() {
  const { currentSnapshot } = useSnapshot();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('instances');
  const [search, setSearch] = useState('');
  const [compartmentOcid, setCompartmentOcid] = useState('');
  const [lifecycleState, setLifecycleState] = useState('');
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [initialBlobKey, setInitialBlobKey] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Fetch compartments for the dropdown
  const [compartmentsResult] = useQuery({
    query: COMPARTMENTS_QUERY,
    variables: { snapshotId: currentSnapshot?.id || '' },
    pause: !currentSnapshot,
  });
  const compartments = compartmentsResult.data?.compartments || [];

  const filterKey = `${currentSnapshot?.id}|${compartmentOcid}|${lifecycleState}|${search}`;
  const { cursor, pageIndex, pageSize, goNextPage, goPrevPage } = usePagination({ pageSize: PAGE_SIZE, filterKey });

  const [computeResult] = useQuery({
    query: COMPUTE_RESOURCES_QUERY,
    variables: {
      filter: {
        snapshotId: currentSnapshot?.id || '',
        resourceType: 'compute/instance',
        compartmentId: compartmentOcid || undefined,
        lifecycleState: lifecycleState || undefined,
        search: search || undefined,
        first: pageSize,
        after: cursor,
      },
    },
    pause: !currentSnapshot?.id,
  });
  const connection = computeResult.data?.resources || null;
  const loading = computeResult.fetching;

  const resources = connection?.edges?.map((e: any) => e.node) || [];
  const hasNext = connection?.pageInfo?.hasNextPage || false;
  const totalCount = connection?.totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleNextPage = useCallback(() => {
    goNextPage(connection?.pageInfo?.endCursor);
  }, [goNextPage, connection?.pageInfo?.endCursor]);

  const handlePrevPage = goPrevPage;

  // Fetch detail + blobs for selected resource
  const [detailResult] = useQuery({
    query: RESOURCE_WITH_BLOBS_QUERY,
    variables: { id: selectedResourceId || '' },
    pause: !selectedResourceId,
  });

  const handleRowClick = useCallback((resource: Resource) => {
    setSelectedResourceId(prev => (prev === resource.id ? null : resource.id));
    setInitialBlobKey(null);
  }, []);

  const handleExportCsv = useCallback(async () => {
    if (!currentSnapshot || !token) return;
    setExporting(true);
    setExportError(null);
    try {
      const params = new URLSearchParams({ snapshotId: currentSnapshot.id });
      if (compartmentOcid) params.set('compartmentId', compartmentOcid);
      if (lifecycleState) params.set('lifecycleState', lifecycleState);
      if (search) params.set('search', search);

      const response = await fetch(`/api/export-compute-csv?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const text = await response.text();
        setExportError(`Server error ${response.status}: ${text}`);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'compute-instances.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setExportError(e?.message ?? 'Unknown error');
    } finally {
      setExporting(false);
    }
  }, [token, currentSnapshot, compartmentOcid, lifecycleState, search]);

  if (!currentSnapshot) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 dark:text-gray-500 text-lg">Select a snapshot to view compute instances</p>
      </div>
    );
  }

  const selectedResource = detailResult.data?.resource;
  const selectedBlobs: ResourceBlob[] = selectedResource?.blobs || [];

  const activeBlobTab = BLOB_TABS.find(t => t.key === activeTab);

  return (
    <div className="flex h-full -m-6">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('instances')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'instances'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Instances
          </button>
          {BLOB_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeBlobTab && (
          <BlobListView blobKey={activeBlobTab.key} blobLabel={activeBlobTab.label} />
        )}

        {activeTab === 'instances' && (<>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Compute Instances</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {search || compartmentOcid || lifecycleState ? (
              <>
                <span className="font-medium text-gray-700 dark:text-gray-300">{totalCount.toLocaleString()}</span>
                {' '}
                {totalCount === 1 ? 'instance matches' : 'instances match'}
                {search && (
                  <> &ldquo;<span className="font-mono text-xs text-blue-600 dark:text-blue-400">{search}</span>&rdquo;</>
                )}
              </>
            ) : (
              <>{totalCount.toLocaleString()} instances</>
            )}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <SearchBar value={search} onChange={setSearch} />
          </div>
          <select
            value={compartmentOcid}
            onChange={e => setCompartmentOcid(e.target.value)}
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
            onChange={e => setLifecycleState(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="">All States</option>
            <option value="RUNNING">Running</option>
            <option value="STOPPED">Stopped</option>
            <option value="TERMINATED">Terminated</option>
          </select>
          <button
            onClick={handleExportCsv}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>

        {exportError && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
            Export failed: {exportError}
          </p>
        )}

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Shape</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">State</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sys Init Image</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fault Domain</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">AD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {resources.map((r: any) => {
                let raw: Record<string, any> = {};
                if (typeof r.rawData === 'string') {
                  try { raw = JSON.parse(r.rawData); } catch { /* corrupted data */ }
                } else if (r.rawData) {
                  raw = r.rawData;
                }
                const tags: Record<string, string> = r.freeformTags || {};
                const sysInitImage = tags['sys_init_image'] ?? tags['sys-init-image'] ?? raw?.metadata?.sysInitImage ?? raw?.metadata?.sys_init_image ?? null;
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
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {sysInitImage || '-'}
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
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                    No compute instances found
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                    Loading...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

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
        </>)}
      </div>

      {/* Detail panel */}
      {activeTab === 'instances' && selectedResourceId && selectedResource && (
        <ComputeDetailPanel
          resource={selectedResource}
          blobs={selectedBlobs}
          initialBlobKey={initialBlobKey}
          snapshotId={currentSnapshot!.id}
          onClose={() => { setSelectedResourceId(null); setInitialBlobKey(null); }}
        />
      )}
    </div>
  );
}
