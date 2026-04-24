import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { formatResourceType } from '../../utils/formatters';

interface TopologySearchToolbarProps {
  nodeLabels: { id: string; label: string; ocid: string; resourceType: string }[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  hiddenTypes: Set<string>;
  onHiddenTypesChange: (types: Set<string>) => void;
  onFocusNode: (nodeId: string) => void;
  filterMode?: 'highlight' | 'dim' | 'hide';
  onFilterModeChange?: (mode: 'highlight' | 'dim' | 'hide') => void;
}

const FILTER_MODES = [
  { value: 'highlight' as const, label: 'Highlight', icon: '\u2B50' },
  { value: 'dim' as const, label: 'Dim', icon: '\uD83D\uDD76\uFE0F' },
  { value: 'hide' as const, label: 'Hide', icon: '\uD83D\uDEAB' },
] as const;

export default function TopologySearchToolbar({
  nodeLabels,
  searchQuery,
  onSearchChange,
  hiddenTypes,
  onHiddenTypesChange,
  onFocusNode,
  filterMode = 'highlight',
  onFilterModeChange,
}: TopologySearchToolbarProps) {
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Derive unique resource types from nodes
  const resourceTypes = useMemo(() => {
    const types = new Map<string, number>();
    for (const n of nodeLabels) {
      types.set(n.resourceType, (types.get(n.resourceType) || 0) + 1);
    }
    return Array.from(types.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([type, count]) => ({ type, count }));
  }, [nodeLabels]);

  // Debounced search
  const handleInputChange = useCallback((value: string) => {
    setLocalQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(value);
    }, 300);
  }, [onSearchChange]);

  // Matched results
  const matchedResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return nodeLabels
      .filter(n => n.label.toLowerCase().includes(q) || n.ocid.toLowerCase().includes(q))
      .slice(0, 20);
  }, [nodeLabels, searchQuery]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowTypeFilter(false);
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleToggleType = useCallback((type: string) => {
    const next = new Set(hiddenTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    onHiddenTypesChange(next);
  }, [hiddenTypes, onHiddenTypesChange]);

  const handleShowAll = useCallback(() => {
    onHiddenTypesChange(new Set());
  }, [onHiddenTypesChange]);

  const handleHideAll = useCallback(() => {
    onHiddenTypesChange(new Set(resourceTypes.map(t => t.type)));
  }, [onHiddenTypesChange, resourceTypes]);

  const hasActiveSearch = searchQuery.trim().length > 0;

  return (
    <div ref={containerRef} className="absolute top-3 left-3 z-10 flex items-start gap-2">
      {/* Search input */}
      <div className="relative">
        <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm">
          <svg className="w-4 h-4 text-gray-400 ml-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={localQuery}
            onChange={e => handleInputChange(e.target.value)}
            onFocus={() => setShowResults(true)}
            placeholder="Search nodes..."
            className="px-2 py-1.5 text-xs bg-transparent border-none outline-none w-48 text-gray-900 dark:text-gray-100 placeholder-gray-400"
          />
          {localQuery && (
            <button
              onClick={() => { setLocalQuery(''); onSearchChange(''); }}
              className="px-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Results dropdown */}
        {showResults && matchedResults.length > 0 && (
          <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {matchedResults.map(r => (
              <button
                key={r.id}
                onClick={() => { onFocusNode(r.id); setShowResults(false); }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{r.label}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{formatResourceType(r.resourceType)}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Feature 8: Filter mode toggle — only visible when search is active */}
      {hasActiveSearch && onFilterModeChange && (
        <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm overflow-hidden">
          {FILTER_MODES.map(mode => (
            <button
              key={mode.value}
              onClick={() => onFilterModeChange(mode.value)}
              className={`px-2 py-1.5 text-[10px] font-medium transition-colors ${
                filterMode === mode.value
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              title={mode.label}
            >
              {mode.label}
            </button>
          ))}
        </div>
      )}

      {/* Type filter button */}
      <div className="relative">
        <button
          onClick={() => setShowTypeFilter(!showTypeFilter)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors dark:text-gray-200 ${
            hiddenTypes.size > 0 ? 'border-blue-400 text-blue-600 dark:text-blue-400' : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filter Types
          {hiddenTypes.size > 0 && (
            <span className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full text-xs">
              {hiddenTypes.size} hidden
            </span>
          )}
        </button>

        {showTypeFilter && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-80 overflow-y-auto">
            <div className="flex gap-2 p-2 border-b border-gray-200 dark:border-gray-700">
              <button onClick={handleShowAll} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">Show All</button>
              <button onClick={handleHideAll} className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400">Hide All</button>
            </div>
            {resourceTypes.map(({ type, count }) => (
              <label
                key={type}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={!hiddenTypes.has(type)}
                  onChange={() => handleToggleType(type)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                />
                <span className="text-xs text-gray-700 dark:text-gray-200 flex-1 truncate">{formatResourceType(type)}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{count}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
