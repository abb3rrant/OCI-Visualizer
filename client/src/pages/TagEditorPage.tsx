import React, { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from 'urql';
import { useSnapshot } from '../contexts/SnapshotContext';
import { TAG_SUMMARY_QUERY, RESOURCES_QUERY } from '../graphql/queries';
import { generateTagCommands, downloadScript } from '../utils/generateTagCommands';

interface TagSummaryItem {
  tagKey: string;
  values: string[];
  resourceCount: number;
}

interface ResourceNode {
  id: string;
  ocid: string;
  displayName: string | null;
  resourceType: string;
  compartmentId: string | null;
  freeformTags: Record<string, string> | null;
}

export default function TagEditorPage() {
  const { currentSnapshot } = useSnapshot();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedTagKey = searchParams.get('tag') || '';
  const resourceTypeFilter = searchParams.get('type') || '';

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<'add' | 'remove' | 'update'>('add');
  const [newTagKey, setNewTagKey] = useState('');
  const [newTagValue, setNewTagValue] = useState('');
  const [generatedScript, setGeneratedScript] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);

  // Fetch tag summary
  const [tagSummaryResult] = useQuery({
    query: TAG_SUMMARY_QUERY,
    variables: { snapshotId: currentSnapshot?.id || '' },
    pause: !currentSnapshot,
  });

  const tagSummary: TagSummaryItem[] = tagSummaryResult.data?.tagSummary || [];

  // Fetch resources with pagination
  const [resourcesResult] = useQuery({
    query: RESOURCES_QUERY,
    variables: {
      filter: {
        snapshotId: currentSnapshot?.id || '',
        resourceType: resourceTypeFilter || undefined,
        search: selectedTagKey || undefined,
        first: 50,
        after: after || undefined,
      },
    },
    pause: !currentSnapshot,
  });

  const edges = resourcesResult.data?.resources?.edges || [];
  const pageInfo = resourcesResult.data?.resources?.pageInfo;
  const totalCount = resourcesResult.data?.resources?.totalCount || 0;

  const resources: ResourceNode[] = useMemo(() =>
    edges.map((e: any) => e.node),
    [edges],
  );

  // Filter resources that have the selected tag key (for display)
  const filteredResources = useMemo(() => {
    if (!selectedTagKey) return resources;
    return resources;
  }, [resources, selectedTagKey]);

  const handleSelectTag = useCallback((tagKey: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (tagKey) next.set('tag', tagKey);
      else next.delete('tag');
      return next;
    }, { replace: true });
    setSelectedIds(new Set());
    setAfter(null);
  }, [setSearchParams]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredResources.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredResources.map(r => r.id)));
    }
  }, [filteredResources, selectedIds.size]);

  const handleGenerate = useCallback(() => {
    const selected = filteredResources.filter(r => selectedIds.has(r.id));
    const key = action === 'add' || action === 'update' ? newTagKey : selectedTagKey || newTagKey;
    if (!key) return;

    const script = generateTagCommands(selected, action, key, newTagValue);
    setGeneratedScript(script);
  }, [filteredResources, selectedIds, action, newTagKey, newTagValue, selectedTagKey]);

  const handleDownload = useCallback(() => {
    if (!generatedScript) return;
    const filename = `tag-${action}-${newTagKey || selectedTagKey || 'update'}.sh`;
    downloadScript(generatedScript, filename);
  }, [generatedScript, action, newTagKey, selectedTagKey]);

  if (!currentSnapshot) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 dark:text-gray-500 text-lg">Select a snapshot to manage tags</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tag Editor</h2>

      {/* Tag Overview */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Tag Overview</h3>
        {tagSummary.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                  <th className="text-left px-3 py-2">Tag Key</th>
                  <th className="text-left px-3 py-2">Unique Values</th>
                  <th className="text-right px-3 py-2">Resources</th>
                  <th className="text-right px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {tagSummary.map(tag => (
                  <tr
                    key={tag.tagKey}
                    className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                      selectedTagKey === tag.tagKey ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    onClick={() => handleSelectTag(tag.tagKey)}
                  >
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{tag.tagKey}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                      <div className="flex flex-wrap gap-1">
                        {tag.values.slice(0, 5).map(v => (
                          <span key={v} className="inline-block text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">
                            {v}
                          </span>
                        ))}
                        {tag.values.length > 5 && (
                          <span className="text-xs text-gray-400">+{tag.values.length - 5} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{tag.resourceCount}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSelectTag(tag.tagKey); }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800"
                      >
                        View Resources
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {tagSummaryResult.fetching ? 'Loading tags...' : 'No tags found in this snapshot.'}
          </p>
        )}
      </div>

      {/* Resource Tag Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Resources {selectedTagKey && <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({totalCount} total)</span>}
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={resourceTypeFilter}
              onChange={e => {
                setSearchParams(prev => {
                  const next = new URLSearchParams(prev);
                  if (e.target.value) next.set('type', e.target.value);
                  else next.delete('type');
                  return next;
                }, { replace: true });
                setAfter(null);
              }}
              className="input-field text-sm py-1"
            >
              <option value="">All types</option>
              {Array.from(new Set(resources.map(r => r.resourceType))).sort().map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                <th className="text-left px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={filteredResources.length > 0 && selectedIds.size === filteredResources.length}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </th>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Tags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredResources.map(resource => {
                const tags = resource.freeformTags || {};
                return (
                  <tr key={resource.id} className={selectedIds.has(resource.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(resource.id)}
                        onChange={() => handleToggleSelect(resource.id)}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-xs">
                        {resource.displayName || resource.ocid}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs">{resource.ocid}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{resource.resourceType}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(tags).slice(0, 4).map(([k, v]) => (
                          <span
                            key={k}
                            className={`inline-block text-xs px-1.5 py-0.5 rounded ${
                              k === selectedTagKey
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {k}={String(v)}
                          </span>
                        ))}
                        {Object.keys(tags).length > 4 && (
                          <span className="text-xs text-gray-400">+{Object.keys(tags).length - 4}</span>
                        )}
                        {Object.keys(tags).length === 0 && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 italic">No tags</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Showing {filteredResources.length} of {totalCount} resources
            {selectedIds.size > 0 && ` (${selectedIds.size} selected)`}
          </span>
          <div className="flex gap-2">
            {after && (
              <button
                onClick={() => setAfter(null)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800"
              >
                First Page
              </button>
            )}
            {pageInfo?.hasNextPage && (
              <button
                onClick={() => setAfter(pageInfo.endCursor)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800"
              >
                Next Page
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Action Panel */}
      {selectedIds.size > 0 && (
        <div className="card border-2 border-blue-500 dark:border-blue-400">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Tag Action ({selectedIds.size} resource{selectedIds.size !== 1 ? 's' : ''} selected)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Action</label>
              <select
                value={action}
                onChange={e => setAction(e.target.value as any)}
                className="input-field text-sm"
              >
                <option value="add">Add Tag</option>
                <option value="update">Update Tag</option>
                <option value="remove">Remove Tag</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tag Key</label>
              <input
                type="text"
                value={newTagKey}
                onChange={e => setNewTagKey(e.target.value)}
                className="input-field text-sm"
                placeholder={selectedTagKey || 'e.g. Environment'}
              />
            </div>
            {action !== 'remove' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tag Value</label>
                <input
                  type="text"
                  value={newTagValue}
                  onChange={e => setNewTagValue(e.target.value)}
                  className="input-field text-sm"
                  placeholder="e.g. production"
                />
              </div>
            )}
            <div className="flex items-end">
              <button
                onClick={handleGenerate}
                className="btn-primary text-sm w-full"
                disabled={!(newTagKey || selectedTagKey)}
              >
                Generate Commands
              </button>
            </div>
          </div>

          {generatedScript && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Generated Script</span>
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Script
                </button>
              </div>
              <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
                {generatedScript}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
