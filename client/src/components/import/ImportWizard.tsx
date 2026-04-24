import React, { useState, useCallback } from 'react';
import FileUploader from './FileUploader';
import ImportProgress from './ImportProgress';
import { useImportStatus } from '../../contexts/ImportStatusContext';

interface ImportWizardProps {
  snapshotId: string;
  token: string | null;
  onComplete?: () => void;
}

interface UploadResult {
  resourceCount: number;
  resourceTypes: string[];
  errors: string[];
}

export default function ImportWizard({ snapshotId, token, onComplete }: ImportWizardProps) {
  const { trackJob } = useImportStatus();
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Called by ImportProgress SSE when the job finishes
  const handleJobComplete = useCallback(async () => {
    if (!jobId) return;
    try {
      const response = await fetch(`/api/import-job/${jobId}`);
      if (!response.ok) return;
      const status = await response.json();
      setUploading(false);
      if (status.status === 'completed') {
        setResults([{
          resourceCount: status.progress,
          resourceTypes: status.resourceTypes,
          errors: status.errors,
        }]);
        onComplete?.();
      } else if (status.status === 'failed') {
        setError(status.errors?.join('; ') || 'Import failed');
      }
    } catch {
      setUploading(false);
      setError('Lost connection to server');
    }
  }, [jobId, onComplete]);

  const handleFiles = async (files: File[]) => {
    setUploading(true);
    setError(null);
    setResults([]);

    const formData = new FormData();
    for (const file of files) {
      formData.append('file', file);
    }

    try {
      const response = await fetch(`/api/upload/${snapshotId}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }

      const data = await response.json();

      if (data.jobId) {
        // Background job — poll for progress
        trackJob(data.jobId);
        setJobId(data.jobId);
      } else {
        // Legacy synchronous response
        setResults([data]);
        setUploading(false);
        onComplete?.();
      }
    } catch (err: any) {
      setError(err.message);
      setUploading(false);
    }
  };

  const totalImported = results.reduce((sum, r) => sum + r.resourceCount, 0);
  const allTypes = [...new Set(results.flatMap(r => r.resourceTypes))];

  return (
    <div className="space-y-4">
      <FileUploader onFiles={handleFiles} disabled={uploading} />

      {uploading && (
        <ImportProgress
          jobId={jobId ?? undefined}
          onComplete={handleJobComplete}
        />
      )}

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">{error}</div>
      )}

      {results.length > 0 && (
        <div className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="text-sm font-medium text-green-800 dark:text-green-300">
            Imported {totalImported.toLocaleString()} resources across {allTypes.length} types
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {allTypes.map(t => (
              <span key={t} className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded">{t}</span>
            ))}
          </div>
          {results.some(r => r.errors.length > 0) && (
            <div className="mt-2 space-y-1">
              <div className="text-xs font-medium text-amber-700 dark:text-amber-400">
                {results.flatMap(r => r.errors).length} warning(s) during import:
              </div>
              <ul className="text-xs text-amber-600 dark:text-amber-400 list-disc list-inside space-y-0.5">
                {results.flatMap(r => r.errors).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
