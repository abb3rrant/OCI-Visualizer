import React, { useState, useEffect, useRef, useCallback } from 'react';
import FileUploader from './FileUploader';
import ImportProgress from './ImportProgress';

interface ImportWizardProps {
  snapshotId: string;
  token: string | null;
  onComplete?: () => void;
}

interface JobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  total: number;
  resourceTypes: string[];
  errors: string[];
}

interface UploadResult {
  resourceCount: number;
  resourceTypes: string[];
  errors: string[];
}

const POLL_INTERVAL = 2000;

export default function ImportWizard({ snapshotId, token, onComplete }: ImportWizardProps) {
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollJob = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/import-job/${id}`);
      if (!response.ok) return;
      const status: JobStatus = await response.json();
      setJobStatus(status);

      if (status.status === 'completed') {
        stopPolling();
        setUploading(false);
        setResults([{
          resourceCount: status.progress,
          resourceTypes: status.resourceTypes,
          errors: status.errors,
        }]);
        onComplete?.();
      } else if (status.status === 'failed') {
        stopPolling();
        setUploading(false);
        setError(status.errors?.join('; ') || 'Import failed');
      }
    } catch {
      // Network error — keep polling
    }
  }, [stopPolling, onComplete]);

  // Start polling when we get a jobId
  useEffect(() => {
    if (!jobId) return;
    // Immediately poll once
    pollJob(jobId);
    pollRef.current = setInterval(() => pollJob(jobId), POLL_INTERVAL);
    return stopPolling;
  }, [jobId, pollJob, stopPolling]);

  const handleFiles = async (files: File[]) => {
    setUploading(true);
    setError(null);
    setResults([]);
    setJobStatus(null);

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
          progress={jobStatus?.progress ?? 0}
          total={jobStatus?.total ?? 0}
          status={jobStatus?.status ?? 'pending'}
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
