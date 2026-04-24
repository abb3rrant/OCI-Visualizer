import React, { useState, useCallback } from 'react';
import { useQuery, useClient } from 'urql';
import { useSnapshot } from '../../contexts/SnapshotContext';
import { usePagination } from '../../hooks/usePagination';
import { LIST_BLOBS_QUERY } from '../../graphql/queries';
import StateBadge from '../common/StateBadge';
import HighlightedSnippet from '../common/HighlightedSnippet';
import RegexToggle from '../common/RegexToggle';

function decodeBlob(content: string, blobKey: string): string {
  if (blobKey !== 'ansibleArgs') return content;
  try {
    return atob(content);
  } catch {
    return content;
  }
}

const PAGE_SIZE = 50;

interface BlobListViewProps {
  blobKey: string;
  blobLabel: string;
}

export default function BlobListView({ blobKey, blobLabel }: BlobListViewProps) {
  const { currentSnapshot } = useSnapshot();
  const urqlClient = useClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [regexEnabled, setRegexEnabled] = useState(false);
  const [activeRegex, setActiveRegex] = useState(false);
  const [exporting, setExporting] = useState(false);

  const regexInvalid = regexEnabled && searchInput.length > 0 && (() => { try { new RegExp(searchInput.replace(/\(\?[imsx]+\)/g, '')); return false; } catch { return true; } })();
  const canSearch = searchInput.length >= 3 && !regexInvalid;

  const handleSearch = useCallback(() => {
    if (canSearch) {
      setActiveQuery(searchInput);
      setActiveRegex(regexEnabled);
    }
  }, [canSearch, searchInput, regexEnabled]);

  const handleClear = useCallback(() => {
    setSearchInput('');
    setActiveQuery('');
    setActiveRegex(false);
  }, []);

  const handleExport = useCallback(async () => {
    if (!currentSnapshot) return;
    setExporting(true);
    try {
      const allEdges: any[] = [];
      let after: string | null = null;
      // Paginate through all results
      for (;;) {
        const res: any = await urqlClient.query(LIST_BLOBS_QUERY, {
          snapshotId: currentSnapshot.id,
          blobKey,
          query: activeQuery || undefined,
          isRegex: activeRegex || undefined,
          first: 200,
          after,
        }).toPromise();
        const conn: any = res.data?.listBlobs;
        if (!conn?.edges?.length) break;
        allEdges.push(...conn.edges);
        if (!conn.pageInfo?.hasNextPage) break;
        after = conn.pageInfo.endCursor;
      }

      // Build CSV
      const escapeCsv = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const header = ['OCID', 'Instance Name', 'State', 'Availability Domain', blobLabel];
      const rows = allEdges.map((edge: any) => {
        const r = edge.node.resource;
        const content = decodeBlob(edge.node.content, edge.node.blobKey);
        return [r.ocid, r.displayName || '', r.lifecycleState || '', r.availabilityDomain || '', content].map(escapeCsv).join(',');
      });
      const csv = [header.join(','), ...rows].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${blobKey}-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [currentSnapshot, urqlClient, blobKey, activeQuery, activeRegex]);

  const filterKey = `${currentSnapshot?.id}|${blobKey}|${activeQuery}`;
  const { cursor, pageIndex, pageSize, goNextPage, goPrevPage } = usePagination({ pageSize: PAGE_SIZE, filterKey });

  const [result] = useQuery({
    query: LIST_BLOBS_QUERY,
    variables: {
      snapshotId: currentSnapshot?.id || '',
      blobKey,
      query: activeQuery || undefined,
      isRegex: activeRegex || undefined,
      first: pageSize,
      after: cursor,
    },
    pause: !currentSnapshot,
  });

  const connection = result.data?.listBlobs;
  const edges = connection?.edges || [];
  const hasNext = connection?.pageInfo?.hasNextPage || false;
  const totalCount = connection?.totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleNextPage = useCallback(() => {
    goNextPage(connection?.pageInfo?.endCursor);
  }, [goNextPage, connection?.pageInfo?.endCursor]);

  if (!currentSnapshot) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 dark:text-gray-500 text-lg">Select a snapshot to view {blobLabel.toLowerCase()}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{blobLabel}</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">{totalCount} instance{totalCount !== 1 ? 's' : ''} with {blobLabel.toLowerCase()}</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            placeholder={regexEnabled ? "Search with regex (min 3 chars)..." : "Search blob content (min 3 chars)..."}
            className={`w-full text-sm border rounded-lg pl-9 pr-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${regexInvalid ? 'border-red-400 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'}`}
          />
        </div>
        <RegexToggle enabled={regexEnabled} onToggle={() => setRegexEnabled(!regexEnabled)} invalid={!!regexInvalid} />
        <button
          onClick={handleSearch}
          disabled={!canSearch}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          Search
        </button>
        <button
          onClick={handleExport}
          disabled={exporting || totalCount === 0}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 flex items-center gap-1.5"
        >
          {exporting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Exporting...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Export CSV
            </>
          )}
        </button>
      </div>

      {activeQuery && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">
            {result.fetching ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            {result.fetching ? 'Searching...' : <>Filtered by "<strong>{activeQuery}</strong>"</>}
          </span>
          <button
            onClick={handleClear}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Instance Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">State</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">OS</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">OS Version</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">AD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {edges.map((edge: any) => {
              const blob = edge.node;
              const resource = blob.resource;
              const imageRaw = resource.imageResource?.rawData;
              const isExpanded = expandedId === blob.id;
              return (
                <React.Fragment key={blob.id}>
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : blob.id)}
                    className={`cursor-pointer transition-colors ${
                      isExpanded
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium truncate max-w-[300px]">
                      <div className="flex items-center gap-2">
                        <svg
                          className={`w-3 h-3 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        {resource.displayName || 'Unnamed'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StateBadge state={resource.lifecycleState} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {imageRaw?.operatingSystem || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {imageRaw?.operatingSystemVersion || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {resource.availabilityDomain || '-'}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={5} className="px-4 py-3 bg-gray-50 dark:bg-gray-900">
                        <pre className="font-mono text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 overflow-auto max-h-[500px] whitespace-pre-wrap break-words dark:text-gray-300">
                          {activeQuery ? (
                            <HighlightedSnippet text={decodeBlob(blob.content, blob.blobKey)} query={activeQuery} isRegex={activeRegex} />
                          ) : (
                            decodeBlob(blob.content, blob.blobKey)
                          )}
                        </pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {edges.length === 0 && !result.fetching && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                  {activeQuery ? `No matches for "${activeQuery}"` : `No instances with ${blobLabel.toLowerCase()} found`}
                </td>
              </tr>
            )}
            {result.fetching && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                  Loading...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalCount > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {pageIndex * PAGE_SIZE + 1}–{Math.min((pageIndex + 1) * PAGE_SIZE, totalCount)} of {totalCount.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={goPrevPage}
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
