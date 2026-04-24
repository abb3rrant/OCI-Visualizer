import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useQuery } from 'urql';
import { RESOURCE_QUERY } from '../graphql/queries';
import type { Resource } from '../types';

interface DetailPanelContextType {
  selectedResourceId: string | null;
  resource: Resource | null;
  loading: boolean;
  error: Error | null;
  openResource: (id: string) => void;
  closeResource: () => void;
}

const DetailPanelContext = createContext<DetailPanelContextType>(null!);

export function DetailPanelProvider({ children }: { children: React.ReactNode }) {
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);

  const [resourceResult] = useQuery({
    query: RESOURCE_QUERY,
    variables: { id: selectedResourceId || '' },
    pause: !selectedResourceId,
    requestPolicy: 'cache-first',
  });

  const openResource = useCallback((id: string) => {
    setSelectedResourceId(id);
  }, []);

  const closeResource = useCallback(() => {
    setSelectedResourceId(null);
  }, []);

  const resource = resourceResult.data?.resource || null;
  const loading = resourceResult.fetching;
  const error = resourceResult.error ? new Error(resourceResult.error.message) : null;

  const value = useMemo(() => ({
    selectedResourceId, resource, loading, error, openResource, closeResource,
  }), [selectedResourceId, resource, loading, error, openResource, closeResource]);

  return (
    <DetailPanelContext.Provider value={value}>
      {children}
    </DetailPanelContext.Provider>
  );
}

export function useDetailPanel() {
  return useContext(DetailPanelContext);
}
