const resourceColors: Record<string, string> = {
  // Compute
  'compute/instance': '#3B82F6',     // blue
  'compute/image': '#93C5FD',        // light blue
  'compute/vnic-attachment': '#60A5FA', // mid blue
  'compute/boot-volume-attachment': '#BFDBFE', // lightest blue
  // Network
  'network/vcn': '#8B5CF6',          // purple
  'network/subnet': '#A78BFA',       // light purple
  'network/security-list': '#EF4444', // red
  'network/route-table': '#F97316',   // orange
  'network/nsg': '#EF4444',          // red
  'network/internet-gateway': '#10B981', // green
  'network/nat-gateway': '#059669',   // dark green
  'network/service-gateway': '#14B8A6', // teal
  'network/local-peering-gateway': '#7C3AED', // purple-600
  'network/drg': '#6366F1',          // indigo
  'network/drg-attachment': '#818CF8', // indigo-light
  'network/dhcp-options': '#FB923C',  // orange-light
  'network/load-balancer': '#F59E0B', // amber
  'network/network-load-balancer': '#D97706', // amber-dark
  // Database
  'database/db-system': '#EC4899',    // pink
  'database/autonomous-database': '#DB2777', // dark pink
  'database/db-home': '#F472B6',      // light pink
  'database/mysql-db-system': '#BE185D', // deep pink
  // Storage
  'storage/block-volume': '#6B7280',  // gray
  'storage/boot-volume': '#9CA3AF',   // light gray
  'storage/volume-backup': '#4B5563', // dark gray
  'storage/volume-group': '#374151',  // darker gray
  'storage/bucket': '#F97316',        // orange
  'storage/file-system': '#D1D5DB',   // gray-light
  // Container / OKE
  'container/cluster': '#06B6D4',     // cyan
  'container/node-pool': '#67E8F9',   // light cyan
  'container/container-instance': '#0891B2', // dark cyan
  'container/container-repository': '#0E7490', // darker cyan
  'container/container-image': '#155E75', // deepest cyan
  // Serverless
  'serverless/application': '#A855F7', // violet
  'serverless/function': '#C084FC',   // light violet
  'serverless/api-gateway': '#E879F9', // fuchsia
  'serverless/api-deployment': '#D946EF', // magenta
  // IAM
  'iam/compartment': '#78716C',       // stone
  'iam/user': '#A3A3A3',             // neutral
  'iam/group': '#A3A3A3',
  'iam/policy': '#FBBF24',           // yellow
  'iam/dynamic-group': '#92400E',    // amber-dark
  // DNS
  'dns/zone': '#2DD4BF',             // teal
  // Security
  'security/vault': '#DC2626',        // red-600
  'security/secret': '#B91C1C',       // red-700
  'security/container-scan-result': '#991B1B', // red-800
  // Observability
  'observability/log-group': '#65A30D', // lime-600
  'observability/log': '#4D7C0F',     // lime-700
  // Compute (continued)
  'compute/instance-configuration': '#93C5FD', // blue-300
  // Container (continued)
  'container/image-signature': '#164E63', // cyan-900
  // IAM (continued)
  'iam/api-key': '#78716C',           // stone-500
  'iam/customer-secret-key': '#57534E', // stone-600
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
