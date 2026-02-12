import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Snapshot } from '../types';

interface SnapshotContextType {
  currentSnapshot: Snapshot | null;
  setCurrentSnapshot: (snapshot: Snapshot | null) => void;
}

const SnapshotContext = createContext<SnapshotContextType>(null!);

export function SnapshotProvider({ children }: { children: React.ReactNode }) {
  const [currentSnapshot, setCurrentSnapshot] = useState<Snapshot | null>(null);
  return (
    <SnapshotContext.Provider value={{ currentSnapshot, setCurrentSnapshot }}>
      {children}
    </SnapshotContext.Provider>
  );
}

export function useSnapshot() {
  return useContext(SnapshotContext);
}
