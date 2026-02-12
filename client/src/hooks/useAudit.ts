import { useQuery } from 'urql';
import { AUDIT_QUERY, TAG_COMPLIANCE_QUERY } from '../graphql/queries';

export function useAudit(snapshotId: string | null) {
  const [result, reexecute] = useQuery({
    query: AUDIT_QUERY,
    variables: { snapshotId: snapshotId || '' },
    pause: !snapshotId,
  });

  return {
    report: result.data?.auditFindings || null,
    loading: result.fetching,
    error: result.error,
    refresh: reexecute,
  };
}

export function useTagCompliance(snapshotId: string | null, requiredTags: string[]) {
  const [result] = useQuery({
    query: TAG_COMPLIANCE_QUERY,
    variables: { snapshotId: snapshotId || '', requiredTags },
    pause: !snapshotId || requiredTags.length === 0,
  });

  return {
    report: result.data?.tagCompliance || null,
    loading: result.fetching,
    error: result.error,
  };
}
