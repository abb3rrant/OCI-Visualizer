import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useClient } from 'urql';
import { useSnapshot } from '../../contexts/SnapshotContext';
import { useDetailPanel } from '../../contexts/DetailPanelContext';
import { DEEP_SEARCH_QUERY } from '../../graphql/queries';
import ResourceIcon from './ResourceIcon';
import HighlightedSnippet from './HighlightedSnippet';
import RegexToggle from './RegexToggle';
import { formatResourceType } from '../../utils/formatters';

interface DeepSearchModalProps {
  open: boolean;
  onClose: () => void;
}

interface DeepSearchResult {
  resourceId: string;
  resourceType: string;
  displayName: string | null;
  ocid: string;
  snippet: string;
  field: string;
}

export default function DeepSearchModal({ open, onClose }: DeepSearchModalProps) {
  const { currentSnapshot } = useSnapshot();
  const { openResource } = useDetailPanel();
  const urqlClient = useClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [regexEnabled, setRegexEnabled] = useState(false);
  const [results, setResults] = useState<DeepSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSearch = useCallback(async () => {
    if (!currentSnapshot || query.length < 3) return;
    setLoading(true);
    setSearched(true);
    const result = await urqlClient.query(DEEP_SEARCH_QUERY, {
      snapshotId: currentSnapshot.id,
      query,
      isRegex: regexEnabled || undefined,
      limit: 50,
    }).toPromise();
    setResults(result.data?.deepSearch || []);
    setLoading(false);
  }, [currentSnapshot, query, regexEnabled, urqlClient]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
    if (e.key === 'Escape') onClose();
  }, [handleSearch, onClose]);

  const handleSelect = useCallback((resourceId: string) => {
    openResource(resourceId);
    onClose();
  }, [openResource, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[60vh] flex flex-col border border-gray-200 dark:border-gray-700"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Deep search across all resource raw data (min 3 chars)..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 text-sm bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
          <RegexToggle enabled={regexEnabled} onToggle={() => setRegexEnabled(!regexEnabled)} />
          <button
            onClick={handleSearch}
            disabled={query.length < 3}
            className="px-3 py-1 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Search
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-gray-200 dark:border-gray-700 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {results.map((r) => (
                <button
                  key={r.resourceId}
                  onClick={() => handleSelect(r.resourceId)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 text-left"
                >
                  <ResourceIcon resourceType={r.resourceType} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {r.displayName || '(unnamed)'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatResourceType(r.resourceType)}
                    </div>
                    <div className="mt-1 text-xs font-mono text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded px-2 py-1 overflow-hidden">
                      <HighlightedSnippet text={r.snippet} query={query} isRegex={regexEnabled} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : searched ? (
            <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
              No results found
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
              Search all resource raw data for IP addresses, config values, etc.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
