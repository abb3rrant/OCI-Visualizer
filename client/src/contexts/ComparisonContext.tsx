import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { Resource } from '../types';

interface ComparisonContextType {
  pinned: [Resource | null, Resource | null];
  isComparing: boolean;
  pinResource: (r: Resource) => void;
  unpinResource: (id: string) => void;
  clearComparison: () => void;
  isPinned: (id: string) => boolean;
}

const ComparisonContext = createContext<ComparisonContextType>(null!);

export function ComparisonProvider({ children }: { children: React.ReactNode }) {
  const [pinned, setPinned] = useState<[Resource | null, Resource | null]>([null, null]);

  const pinResource = useCallback((r: Resource) => {
    setPinned(([a, b]) => {
      if (a?.id === r.id || b?.id === r.id) return [a, b];
      if (!a) return [r, b];
      if (!b) return [a, r];
      return [b, r]; // rotate oldest out
    });
  }, []);

  const unpinResource = useCallback((id: string) => {
    setPinned(([a, b]) => [a?.id === id ? null : a, b?.id === id ? null : b]);
  }, []);

  const clearComparison = useCallback(() => setPinned([null, null]), []);

  const isPinned = useCallback((id: string) => pinned[0]?.id === id || pinned[1]?.id === id, [pinned]);

  const isComparing = pinned[0] !== null && pinned[1] !== null;

  const value = useMemo(() => ({
    pinned, isComparing, pinResource, unpinResource, clearComparison, isPinned,
  }), [pinned, isComparing, pinResource, unpinResource, clearComparison, isPinned]);

  return (
    <ComparisonContext.Provider value={value}>
      {children}
    </ComparisonContext.Provider>
  );
}

export function useComparison() {
  return useContext(ComparisonContext);
}
