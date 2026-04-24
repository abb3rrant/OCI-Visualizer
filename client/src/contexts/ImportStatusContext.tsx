import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { showToast } from '../components/common/ToastProvider';

export interface ImportJobInfo {
  id: string;
  snapshotId: string;
  snapshotName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  total: number;
  resourceTypes: string[];
  errors: string[];
  createdAt: string;
  updatedAt: string;
}

interface ImportStatusContextType {
  jobs: ImportJobInfo[];
  activeJobs: ImportJobInfo[];
  hasActiveJobs: boolean;
  hasRecentErrors: boolean;
  trackJob: (jobId: string) => void;
  dismissJob: (jobId: string) => void;
  refetchJobs: () => void;
}

const ImportStatusContext = createContext<ImportStatusContextType>(null!);

const POLL_INTERVAL = 10000;
const MAX_POLL_INTERVAL = 60000;
const BACKOFF_MULTIPLIER = 2;

export function ImportStatusProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [jobs, setJobs] = useState<ImportJobInfo[]>([]);
  const [trackedIds, setTrackedIds] = useState<Set<string>>(() => new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('dismissed-import-jobs');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStatusRef = useRef<Map<string, string>>(new Map());
  const trackedIdsRef = useRef(trackedIds);
  const tokenRef = useRef(token);
  const currentIntervalRef = useRef(POLL_INTERVAL);
  const mountedRef = useRef(true);

  // Keep refs in sync
  trackedIdsRef.current = trackedIds;
  tokenRef.current = token;

  const doFetch = useCallback(async (): Promise<boolean> => {
    const tok = tokenRef.current;
    if (!tok) return false;
    try {
      const res = await fetch('/api/import-jobs?limit=20', {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (!res.ok) return false;

      const data: ImportJobInfo[] = await res.json();
      if (!mountedRef.current) return false;

      setJobs(data);

      // Only continue polling when there are active jobs
      const hasActive = data.some(j => j.status === 'pending' || j.status === 'processing');
      currentIntervalRef.current = hasActive ? POLL_INTERVAL : 0; // 0 = stop polling

      // Check for status transitions on tracked jobs to show toasts
      const tracked = trackedIdsRef.current;
      for (const job of data) {
        const prev = prevStatusRef.current.get(job.id);
        if (prev && prev !== job.status && tracked.has(job.id)) {
          if (job.status === 'completed') {
            showToast(`Import "${job.snapshotName}" completed — ${job.progress} resources`, 'success');
          } else if (job.status === 'failed') {
            showToast(`Import "${job.snapshotName}" failed`, 'error');
          }
        }
        prevStatusRef.current.set(job.id, job.status);
      }

      return data.some(j => j.status === 'pending' || j.status === 'processing');
    } catch {
      // Network error — back off
      currentIntervalRef.current = Math.min(
        currentIntervalRef.current * BACKOFF_MULTIPLIER,
        MAX_POLL_INTERVAL,
      );
      return false;
    }
  }, []);

  const scheduleNext = useCallback((_hasActive?: boolean) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!mountedRef.current) return;
    // Stop polling entirely when no active jobs (interval === 0)
    if (currentIntervalRef.current === 0) return;
    timeoutRef.current = setTimeout(async () => {
      const stillActive = await doFetch();
      scheduleNext(stillActive);
    }, currentIntervalRef.current);
  }, [doFetch]);

  // Fetch once on mount (or when token changes)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hasActive = await doFetch();
      if (!cancelled) scheduleNext(hasActive);
    })();
    return () => {
      cancelled = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [token, doFetch, scheduleNext]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const startPolling = useCallback(() => {
    currentIntervalRef.current = POLL_INTERVAL;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      const hasActive = await doFetch();
      scheduleNext(hasActive);
    }, 500);
  }, [doFetch, scheduleNext]);

  const trackJob = useCallback((jobId: string) => {
    setTrackedIds(prev => new Set(prev).add(jobId));
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.delete(jobId);
      try { localStorage.setItem('dismissed-import-jobs', JSON.stringify([...next])); } catch {}
      return next;
    });
    // Start polling to pick up the new job
    startPolling();
  }, [startPolling]);

  const dismissJob = useCallback((jobId: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev).add(jobId);
      try { localStorage.setItem('dismissed-import-jobs', JSON.stringify([...next])); } catch {}
      return next;
    });
    // Delete the job server-side (fire-and-forget for completed/failed jobs)
    const tok = tokenRef.current;
    if (tok) {
      fetch(`/api/import-job/${jobId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tok}` },
      }).catch(() => {});
    }
  }, []);

  const activeJobs = useMemo(
    () => jobs.filter(j => j.status === 'pending' || j.status === 'processing'),
    [jobs],
  );

  const hasActiveJobs = activeJobs.length > 0;

  const hasRecentErrors = useMemo(
    () => jobs.some(j => j.status === 'failed' && !dismissedIds.has(j.id)),
    [jobs, dismissedIds],
  );

  const visibleJobs = useMemo(
    () => jobs.filter(j => !dismissedIds.has(j.id)),
    [jobs, dismissedIds],
  );

  const value = useMemo(() => ({
    jobs: visibleJobs,
    activeJobs,
    hasActiveJobs,
    hasRecentErrors,
    trackJob,
    dismissJob,
    refetchJobs: startPolling,
  }), [visibleJobs, activeJobs, hasActiveJobs, hasRecentErrors, trackJob, dismissJob, startPolling]);

  return (
    <ImportStatusContext.Provider value={value}>
      {children}
    </ImportStatusContext.Provider>
  );
}

export function useImportStatus() {
  return useContext(ImportStatusContext);
}
