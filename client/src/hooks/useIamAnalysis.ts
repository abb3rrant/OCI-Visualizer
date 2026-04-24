import { useQuery } from 'urql';
import { IAM_ANALYSIS_QUERY } from '../graphql/queries';

export function useIamAnalysis(snapshotId: string | null) {
  const [result, reexecute] = useQuery({
    query: IAM_ANALYSIS_QUERY,
    variables: { snapshotId: snapshotId || '' },
    pause: !snapshotId,
  });

  return {
    data: result.data?.iamAnalysis || null,
    loading: result.fetching,
    error: result.error,
    refresh: reexecute,
  };
}
