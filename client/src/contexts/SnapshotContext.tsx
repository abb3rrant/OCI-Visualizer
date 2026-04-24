import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from 'urql';
import { SNAPSHOTS_QUERY } from '../graphql/queries';
import { useAuth } from './AuthContext';
import type { Snapshot } from '../types';

interface SnapshotContextType {
  currentSnapshot: Snapshot | null;
  setCurrentSnapshot: (snapshot: Snapshot | null) => void;
  snapshots: Snapshot[];
  loading: boolean;
  refetchSnapshots: () => void;
}

const STORAGE_KEY = 'oci-viz-snapshot-id';

const SnapshotContext = createContext<SnapshotContextType>(null!);

export function SnapshotProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [currentSnapshot, setCurrentSnapshotRaw] = useState<Snapshot | null>(null);
  const [result, reexecute] = useQuery({ query: SNAPSHOTS_QUERY, pause: !isAuthenticated });
  const snapshots: Snapshot[] = result.data?.snapshots || [];

  const setCurrentSnapshot = useCallback((snapshot: Snapshot | null) => {
    setCurrentSnapshotRaw(snapshot);
    if (snapshot) {
      localStorage.setItem(STORAGE_KEY, snapshot.id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const refetchSnapshots = useCallback(() => {
    reexecute({ requestPolicy: 'network-only' });
  }, [reexecute]);

  // Auto-select: restore from localStorage, or pick the most recent snapshot
  useEffect(() => {
    if (snapshots.length === 0 || currentSnapshot) return;

    const savedId = localStorage.getItem(STORAGE_KEY);
    const match = savedId ? snapshots.find((s) => s.id === savedId) : null;

    if (match) {
      setCurrentSnapshotRaw(match);
    } else {
      // Pick the most recent snapshot
      const latest = snapshots[0];
      setCurrentSnapshotRaw(latest);
      localStorage.setItem(STORAGE_KEY, latest.id);
    }
  }, [snapshots, currentSnapshot]);

  const loading = result.fetching;
  const value = useMemo(() => ({
    currentSnapshot, setCurrentSnapshot, snapshots, loading, refetchSnapshots,
  }), [currentSnapshot, setCurrentSnapshot, snapshots, loading, refetchSnapshots]);

  return (
    <SnapshotContext.Provider value={value}>
      {children}
    </SnapshotContext.Provider>
  );
}

export function useSnapshot() {
  return useContext(SnapshotContext);
}
