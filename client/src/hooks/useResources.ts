import { useQuery } from 'urql';
import { RESOURCES_QUERY, RESOURCE_COUNTS_QUERY } from '../graphql/queries';

export function useResources(filter: { snapshotId: string; resourceType?: string; compartmentId?: string; lifecycleState?: string; search?: string; first?: number; after?: string }) {
  const [result, reexecute] = useQuery({
    query: RESOURCES_QUERY,
    variables: { filter },
    pause: !filter.snapshotId,
  });

  return {
    connection: result.data?.resources || null,
    loading: result.fetching,
    error: result.error,
    refresh: reexecute,
  };
}

export function useResourceCounts(snapshotId: string | null) {
  const [result] = useQuery({
    query: RESOURCE_COUNTS_QUERY,
    variables: { snapshotId: snapshotId || '' },
    pause: !snapshotId,
  });

  return {
    counts: result.data?.resourceCounts || [],
    loading: result.fetching,
    error: result.error,
  };
}
