import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'urql';
import { useSnapshot } from '../../contexts/SnapshotContext';
import { SEARCH_RESOURCES_QUERY } from '../../graphql/queries';
import ResourceIcon from '../common/ResourceIcon';
import { formatResourceType } from '../../utils/formatters';

export default function GlobalSearch() {
  const { currentSnapshot } = useSnapshot();
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce input
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(inputValue.trim());
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [inputValue]);

  const [result] = useQuery({
    query: SEARCH_RESOURCES_QUERY,
    variables: {
      snapshotId: currentSnapshot?.id || '',
      query: debouncedQuery,
      limit: 20,
    },
    pause: !currentSnapshot || debouncedQuery.length < 2,
  });

  const resources = result.data?.searchResources || [];
  const showDropdown = isOpen && debouncedQuery.length >= 2;

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  }, []);

  const handleSelect = useCallback((resource: any) => {
    setIsOpen(false);
    setInputValue('');
    setDebouncedQuery('');
    navigate(`/inventory?q=${encodeURIComponent(resource.ocid)}`);
  }, [navigate]);

  const formatOcid = (ocid: string) => {
    if (ocid.length <= 40) return ocid;
    return ocid.slice(0, 20) + '...' + ocid.slice(-16);
  };

  if (!currentSnapshot) return null;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search resources..."
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:bg-white dark:focus:bg-gray-600 focus:border-blue-400 focus:outline-none transition-colors"
        />
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {result.fetching ? (
            <div className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">Searching...</div>
          ) : resources.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">No results found</div>
          ) : (
            resources.map((r: any) => (
              <button
                key={r.id}
                onClick={() => handleSelect(r)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-left border-b border-gray-100 dark:border-gray-700 last:border-b-0"
              >
                <ResourceIcon resourceType={r.resourceType} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{r.displayName || '(unnamed)'}</div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{formatResourceType(r.resourceType)}</span>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="font-mono truncate">{formatOcid(r.ocid)}</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
