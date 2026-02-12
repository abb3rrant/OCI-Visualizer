const resourceColors: Record<string, string> = {
  'compute/instance': '#3B82F6',     // blue
  'compute/image': '#93C5FD',        // light blue
  'network/vcn': '#8B5CF6',          // purple
  'network/subnet': '#A78BFA',       // light purple
  'network/security-list': '#EF4444', // red
  'network/route-table': '#F97316',   // orange
  'network/nsg': '#EF4444',          // red
  'network/internet-gateway': '#10B981', // green
  'network/nat-gateway': '#059669',   // dark green
  'network/service-gateway': '#14B8A6', // teal
  'network/drg': '#6366F1',          // indigo
  'network/load-balancer': '#F59E0B', // amber
  'database/db-system': '#EC4899',    // pink
  'database/autonomous-database': '#DB2777', // dark pink
  'storage/block-volume': '#6B7280',  // gray
  'storage/boot-volume': '#9CA3AF',   // light gray
  'storage/bucket': '#F97316',        // orange
  'container/cluster': '#06B6D4',     // cyan
  'container/node-pool': '#67E8F9',   // light cyan
  'serverless/application': '#A855F7', // violet
  'serverless/function': '#C084FC',   // light violet
  'serverless/api-gateway': '#E879F9', // fuchsia
  'iam/compartment': '#78716C',       // stone
  'iam/user': '#A3A3A3',             // neutral
  'iam/group': '#A3A3A3',
  'iam/policy': '#FBBF24',           // yellow
  'dns/zone': '#2DD4BF',             // teal
};

export function getResourceColor(resourceType: string): string {
  return resourceColors[resourceType] || '#6B7280';
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return '#DC2626';
    case 'HIGH': return '#EA580C';
    case 'MEDIUM': return '#D97706';
    case 'LOW': return '#2563EB';
    case 'INFO': return '#6B7280';
    default: return '#6B7280';
  }
}

export function getStateColor(state: string | null): string {
  if (!state) return '#6B7280';
  switch (state.toUpperCase()) {
    case 'RUNNING':
    case 'ACTIVE':
    case 'AVAILABLE':
    case 'SUCCEEDED':
      return '#10B981';
    case 'STOPPED':
    case 'INACTIVE':
    case 'DISABLED':
      return '#6B7280';
    case 'TERMINATED':
    case 'DELETED':
    case 'FAILED':
      return '#EF4444';
    case 'PROVISIONING':
    case 'STARTING':
    case 'STOPPING':
    case 'UPDATING':
    case 'CREATING':
      return '#F59E0B';
    default:
      return '#6B7280';
  }
}
