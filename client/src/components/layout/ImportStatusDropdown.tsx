import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useImportStatus, type ImportJobInfo } from '../../contexts/ImportStatusContext';

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StatusIcon({ status }: { status: ImportJobInfo['status'] }) {
  if (status === 'pending' || status === 'processing') {
    return (
      <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    );
  }
  if (status === 'completed') {
    return (
      <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function JobItem({ job, onDismiss }: { job: ImportJobInfo; onDismiss: (id: string) => void }) {
  const isActive = job.status === 'pending' || job.status === 'processing';
  const pct = job.total > 0 ? Math.round((job.progress / job.total) * 100) : 0;
  const errorCount = job.errors.length;
  const shownErrors = job.errors.slice(0, 3);
  const moreCount = errorCount - shownErrors.length;

  return (
    <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div className="flex items-start gap-2">
        <StatusIcon status={job.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
              {job.snapshotName}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(job.id); }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs flex-shrink-0"
              title="Dismiss"
            >
              &times;
            </button>
          </div>

          {isActive && (
            <div className="mt-1">
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {job.progress}/{job.total} resources ({pct}%)
              </div>
            </div>
          )}

          {job.status === 'completed' && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {job.progress} resources imported
            </div>
          )}

          {errorCount > 0 && (
            <details className="mt-1">
              <summary className="text-xs text-red-600 dark:text-red-400 cursor-pointer hover:underline">
                {errorCount} error{errorCount !== 1 ? 's' : ''}
              </summary>
              <ul className="mt-1 text-xs text-red-600 dark:text-red-400 space-y-0.5 pl-3 list-disc">
                {shownErrors.map((err, i) => (
                  <li key={i} className="break-words">{err}</li>
                ))}
                {moreCount > 0 && (
                  <li className="text-red-500 dark:text-red-300">+{moreCount} more</li>
                )}
              </ul>
            </details>
          )}

          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {timeAgo(job.createdAt)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ImportStatusDropdown() {
  const { jobs, hasActiveJobs, hasRecentErrors, dismissJob } = useImportStatus();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const badgeColor = hasActiveJobs
    ? 'bg-blue-500'
    : hasRecentErrors
      ? 'bg-red-500'
      : null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 relative"
        title="Import status"
      >
        <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        {badgeColor && (
          <span className={`absolute top-0.5 right-0.5 w-2.5 h-2.5 ${badgeColor} rounded-full border-2 border-white dark:border-gray-800`} />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Imports</span>
            <button
              onClick={() => { setOpen(false); navigate('/import'); }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              New Import
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {jobs.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                No recent imports
              </div>
            ) : (
              jobs.map(job => (
                <JobItem key={job.id} job={job} onDismiss={dismissJob} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
