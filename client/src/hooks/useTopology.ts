import { useQuery } from 'urql';
import { TOPOLOGY_QUERY } from '../graphql/queries';
import type { ViewType } from '../types';

export function useTopology(snapshotId: string | null, compartmentId: string | null, viewType: ViewType) {
  const [result, reexecute] = useQuery({
    query: TOPOLOGY_QUERY,
    variables: { snapshotId: snapshotId || '', compartmentId, viewType },
    pause: !snapshotId,
  });

  return {
    topology: result.data?.topology || null,
    loading: result.fetching,
    error: result.error,
    refresh: reexecute,
  };
}
