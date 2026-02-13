import React, { useEffect, useState, useRef } from 'react';

interface ImportProgressProps {
  jobId?: string;
  progress?: number;
  total?: number;
  status?: string;
  onComplete?: () => void;
}

export default function ImportProgress({ jobId, progress: propProgress, total: propTotal, status: propStatus, onComplete }: ImportProgressProps) {
  const [sseData, setSseData] = useState<{ progress: number; total: number; status: string } | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const es = new EventSource(`/api/import-job/${jobId}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setSseData(data);
        if (data.status === 'completed' || data.status === 'failed') {
          es.close();
          onComplete?.();
        }
      } catch {}
    };

    es.onerror = () => {
      // Fallback to polling (parent component handles this)
      es.close();
    };

    return () => { es.close(); };
  }, [jobId, onComplete]);

  const progress = sseData?.progress ?? propProgress ?? 0;
  const total = sseData?.total ?? propTotal ?? 0;
  const status = sseData?.status ?? propStatus ?? 'pending';

  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;
  const showBar = total > 0;

  return (
    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
      <div className="flex items-center gap-3">
        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <div className="flex-1">
          <span className="text-sm text-blue-700 dark:text-blue-300">
            {status === 'pending' && 'Preparing import...'}
            {status === 'processing' && showBar && `Importing... ${progress.toLocaleString()} / ${total.toLocaleString()} resources`}
            {status === 'processing' && !showBar && 'Importing resources...'}
            {status === 'completed' && `Import complete: ${progress.toLocaleString()} resources`}
            {status === 'failed' && 'Import failed'}
          </span>
        </div>
        {showBar && <span className="text-xs text-blue-500 dark:text-blue-400 font-medium">{pct}%</span>}
      </div>
      {showBar && (
        <div className="w-full bg-blue-100 dark:bg-blue-900/40 rounded-full h-2 overflow-hidden">
          <div className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="text-xs text-blue-400 dark:text-blue-500">
        {status === 'completed' ? 'Import finished successfully.' : 'Import continues server-side even if you navigate away.'}
      </div>
    </div>
  );
}
