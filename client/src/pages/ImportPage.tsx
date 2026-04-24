import React, { useState, useCallback } from 'react';
import { useMutation, useQuery } from 'urql';
import { useAuth } from '../contexts/AuthContext';
import { useSnapshot } from '../contexts/SnapshotContext';
import { useImportStatus } from '../contexts/ImportStatusContext';
import { CREATE_SNAPSHOT_MUTATION, DELETE_SNAPSHOT_MUTATION, SHARE_SNAPSHOT_MUTATION } from '../graphql/mutations';
import { EXPORT_SCRIPT_QUERY } from '../graphql/queries';
import ImportWizard from '../components/import/ImportWizard';
import ImportProgress from '../components/import/ImportProgress';
import { showToast } from '../components/common/ToastProvider';

export default function ImportPage() {
  const { token, user, isAdmin } = useAuth();
  const { currentSnapshot, setCurrentSnapshot, snapshots, refetchSnapshots } = useSnapshot();
  const { trackJob } = useImportStatus();
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDesc, setSnapshotDesc] = useState('');
  const [snapshotDate, setSnapshotDate] = useState('');
  const [expandedUploadId, setExpandedUploadId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rebuildingJobs, setRebuildingJobs] = useState<Record<string, string>>({});
  const [rebuildResults, setRebuildResults] = useState<Record<string, { count: number } | { error: string }>>({});
  const [, createSnapshot] = useMutation(CREATE_SNAPSHOT_MUTATION);
  const [, deleteSnapshot] = useMutation(DELETE_SNAPSHOT_MUTATION);
  const [, shareSnapshot] = useMutation(SHARE_SNAPSHOT_MUTATION);
  const [exportScriptResult] = useQuery({ query: EXPORT_SCRIPT_QUERY });

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshotName.trim()) return;
    const result = await createSnapshot({
      name: snapshotName,
      description: snapshotDesc || undefined,
      importedAt: snapshotDate || undefined,
    });
    if (result.data?.createSnapshot) {
      setCurrentSnapshot(result.data.createSnapshot);
      setExpandedUploadId(result.data.createSnapshot.id);
      setSnapshotName('');
      setSnapshotDesc('');
      setSnapshotDate('');
      refetchSnapshots();
    }
  };

  const handleDeleteSnapshot = useCallback(async (id: string, name: string) => {
    if (!confirm(`Delete snapshot "${name}"? This will permanently remove all imported resources and cannot be undone.`)) {
      return;
    }
    setDeletingId(id);
    try {
      const result = await deleteSnapshot({ id });
      if (result.data?.deleteSnapshot) {
        if (currentSnapshot?.id === id) {
          setCurrentSnapshot(null);
        }
        if (expandedUploadId === id) {
          setExpandedUploadId(null);
        }
        refetchSnapshots();
      }
      if (result.error) {
        showToast(`Failed to delete: ${result.error.message}`, 'error');
      }
    } finally {
      setDeletingId(null);
    }
  }, [deleteSnapshot, currentSnapshot, expandedUploadId, setCurrentSnapshot, refetchSnapshots]);

  const handleToggleShare = useCallback(async (snapshotId: string, currentlyShared: boolean) => {
    const result = await shareSnapshot({ snapshotId, isShared: !currentlyShared });
    if (result.data?.shareSnapshot) {
      refetchSnapshots();
    }
  }, [shareSnapshot, refetchSnapshots]);

  const handleRebuildRelationships = useCallback(async (snapshotId: string) => {
    if (rebuildingJobs[snapshotId]) return;
    setRebuildResults(prev => { const next = { ...prev }; delete next[snapshotId]; return next; });
    try {
      const response = await fetch(`/api/snapshot/${snapshotId}/rebuild-relationships`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: response.statusText }));
        setRebuildResults(prev => ({ ...prev, [snapshotId]: { error: data.error || 'Request failed' } }));
        return;
      }
      const { jobId } = await response.json();
      trackJob(jobId);
      setRebuildingJobs(prev => ({ ...prev, [snapshotId]: jobId }));
    } catch (err: any) {
      setRebuildResults(prev => ({ ...prev, [snapshotId]: { error: err.message } }));
    }
  }, [rebuildingJobs, token, trackJob]);

  const handleRebuildComplete = useCallback(async (snapshotId: string) => {
    const jobId = rebuildingJobs[snapshotId];
    if (!jobId) return;
    try {
      const response = await fetch(`/api/import-job/${jobId}`);
      if (response.ok) {
        const status = await response.json();
        if (status.status === 'completed') {
          setRebuildResults(prev => ({ ...prev, [snapshotId]: { count: status.progress } }));
        } else if (status.status === 'failed') {
          setRebuildResults(prev => ({ ...prev, [snapshotId]: { error: status.errors?.join('; ') || 'Rebuild failed' } }));
        }
      }
    } catch { /* ignore */ }
    setRebuildingJobs(prev => { const next = { ...prev }; delete next[snapshotId]; return next; });
  }, [rebuildingJobs]);

  const handleDownloadScript = () => {
    if (!exportScriptResult.data?.exportScript) return;
    const blob = new Blob([exportScriptResult.data.exportScript], { type: 'text/x-sh' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generate-oci-export.sh';
    a.click();
    URL.revokeObjectURL(url);
  };

  const canEdit = user?.role !== 'viewer';

  return (
    <div className="space-y-6 max-w-5xl">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Import OCI Data</h2>

      {/* Getting Started */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-2">Getting Started</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Export your OCI environment using the export script, create a snapshot below, then upload the exported files.
        </p>
        <button onClick={handleDownloadScript} className="btn-secondary text-sm">
          Download Export Script
        </button>
      </div>

      {/* Create New Snapshot */}
      {canEdit && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-3">Create New Snapshot</h3>
          <form onSubmit={handleCreateSnapshot} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input
                type="text"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                placeholder="e.g., Production - Feb 2026"
                className="input-field"
                required
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <input
                type="text"
                value={snapshotDesc}
                onChange={(e) => setSnapshotDesc(e.target.value)}
                placeholder="Optional notes..."
                className="input-field"
              />
            </div>
            <div className="w-40">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <input
                type="date"
                value={snapshotDate}
                onChange={(e) => setSnapshotDate(e.target.value)}
                className="input-field"
              />
            </div>
            <button type="submit" className="btn-primary whitespace-nowrap">Create Snapshot</button>
          </form>
        </div>
      )}

      {/* Snapshots */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-3">Snapshots</h3>
        {snapshots.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No snapshots yet. Create one above to get started.</p>
        ) : (
          <div className="space-y-3">
            {snapshots.map((s: any) => {
              const isSelected = currentSnapshot?.id === s.id;
              const isUploading = expandedUploadId === s.id;
              const rebuildJobId = rebuildingJobs[s.id];
              const rebuildResult = rebuildResults[s.id];

              return (
                <div
                  key={s.id}
                  className={`rounded-lg border-2 transition-colors ${
                    isSelected
                      ? 'border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {/* Card body — click to select */}
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setCurrentSnapshot(isSelected ? null : s)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {s.name}
                          {isSelected && (
                            <span className="ml-2 text-xs font-normal text-blue-600 dark:text-blue-400">Selected</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          {s.description && <span>{s.description} &middot; </span>}
                          {(s.resourceCount || 0).toLocaleString()} resources
                          {s.isShared && <span className="ml-2 text-xs text-green-600 dark:text-green-400">Shared</span>}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                        {new Date(s.importedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  {canEdit && (
                    <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setExpandedUploadId(isUploading ? null : s.id); }}
                        className="btn-secondary text-xs"
                      >
                        {isUploading ? 'Hide Upload' : 'Upload More'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRebuildRelationships(s.id); }}
                        disabled={!!rebuildJobId}
                        className="btn-secondary text-xs disabled:opacity-50"
                      >
                        {rebuildJobId ? 'Rebuilding...' : 'Rebuild Relationships'}
                      </button>
                      {(isAdmin || user?.role === 'editor') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleShare(s.id, !!s.isShared); }}
                          className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                            s.isShared
                              ? 'border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                              : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          {s.isShared ? 'Shared' : 'Share'}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteSnapshot(s.id, s.name); }}
                        disabled={deletingId === s.id}
                        className="text-xs text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50 transition-colors ml-auto"
                        title="Delete snapshot"
                      >
                        {deletingId === s.id ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Rebuild progress / result */}
                  {rebuildJobId && (
                    <div className="px-4 pb-3">
                      <ImportProgress
                        jobId={rebuildJobId}
                        onComplete={() => handleRebuildComplete(s.id)}
                      />
                    </div>
                  )}
                  {rebuildResult && !rebuildJobId && (
                    <div className="px-4 pb-3">
                      {'count' in rebuildResult ? (
                        <div className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-2">
                          Rebuilt {rebuildResult.count.toLocaleString()} relationships
                        </div>
                      ) : (
                        <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2">
                          {rebuildResult.error}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inline upload zone */}
                  {isUploading && (
                    <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3">
                      <ImportWizard snapshotId={s.id} token={token} onComplete={refetchSnapshots} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
