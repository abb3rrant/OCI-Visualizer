import React, { useState } from 'react';
import { useMutation, useQuery } from 'urql';
import { useAuth } from '../contexts/AuthContext';
import { useSnapshot } from '../contexts/SnapshotContext';
import { CREATE_SNAPSHOT_MUTATION } from '../graphql/mutations';
import { EXPORT_SCRIPT_QUERY } from '../graphql/queries';
import ImportWizard from '../components/import/ImportWizard';

export default function ImportPage() {
  const { token } = useAuth();
  const { setCurrentSnapshot, snapshots, refetchSnapshots } = useSnapshot();
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDesc, setSnapshotDesc] = useState('');
  const [activeSnapshotId, setActiveSnapshotId] = useState<string | null>(null);
  const [, createSnapshot] = useMutation(CREATE_SNAPSHOT_MUTATION);
  const [exportScriptResult] = useQuery({ query: EXPORT_SCRIPT_QUERY });

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshotName.trim()) return;
    const result = await createSnapshot({ name: snapshotName, description: snapshotDesc || undefined });
    if (result.data?.createSnapshot) {
      setActiveSnapshotId(result.data.createSnapshot.id);
      setCurrentSnapshot(result.data.createSnapshot);
      refetchSnapshots();
    }
  };

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

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Import OCI Data</h2>

      {/* Step 1: Download export script */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-2">Step 1: Export from OCI</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Download and run this script to export your OCI environment data.</p>
        <button onClick={handleDownloadScript} className="btn-secondary text-sm">
          Download Export Script
        </button>
      </div>

      {/* Step 2: Create snapshot */}
      {!activeSnapshotId ? (
        <div className="card">
          <h3 className="text-lg font-semibold mb-3">Step 2: Create Snapshot</h3>
          <form onSubmit={handleCreateSnapshot} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Snapshot Name</label>
              <input
                type="text"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                placeholder="e.g., Production - Feb 2026"
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (optional)</label>
              <input
                type="text"
                value={snapshotDesc}
                onChange={(e) => setSnapshotDesc(e.target.value)}
                placeholder="Notes about this import..."
                className="input-field"
              />
            </div>
            <button type="submit" className="btn-primary">Create Snapshot</button>
          </form>
        </div>
      ) : (
        <div className="card">
          <h3 className="text-lg font-semibold mb-3">Step 3: Upload Files</h3>
          <ImportWizard snapshotId={activeSnapshotId} token={token} onComplete={refetchSnapshots} />
        </div>
      )}

      {/* Existing snapshots */}
      {snapshots.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-3">Existing Snapshots</h3>
          <div className="space-y-2">
            {snapshots.map((s: any) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 cursor-pointer"
                onClick={() => { setActiveSnapshotId(s.id); setCurrentSnapshot(s); }}
              >
                <div>
                  <div className="font-medium text-sm">{s.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{s.resourceCount || 0} resources</div>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500">{new Date(s.importedAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
