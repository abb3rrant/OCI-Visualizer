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

  // Compute sub-resources
  'compute/volume-attachment': '#60A5FA', // blue-400
  'compute/dedicated-vm-host': '#2563EB', // blue-600
  'compute/capacity-reservation': '#1D4ED8', // blue-700
  'compute/compute-cluster': '#1E40AF', // blue-800
  'compute/console-history': '#BFDBFE', // blue-200
  'compute/autoscaling-config': '#3B82F6', // blue-500

  // Network sub-resources
  'network/vlan': '#A78BFA',           // violet-400
  'network/cpe': '#7C3AED',           // violet-600
  'network/ipsec-connection': '#6D28D9', // violet-700
  'network/cross-connect-group': '#5B21B6', // violet-800
  'network/cross-connect': '#4C1D95', // violet-900
  'network/virtual-circuit': '#8B5CF6', // violet-500
  'network/remote-peering-connection': '#4F46E5', // indigo-600
  'network/private-ip': '#C4B5FD',    // violet-300
  'network/vtap': '#7C3AED',          // violet-600
  'network/capture-filter': '#EF4444', // red-500
  'network/byoip-range': '#818CF8',   // indigo-400
  'network/public-ip-pool': '#6366F1', // indigo-500
  'network/network-firewall': '#DC2626', // red-600
  'network/network-firewall-policy': '#B91C1C', // red-700
  'network/drg-route-distribution': '#818CF8', // indigo-400
  'network/nsg-rule': '#F87171',      // red-400

  // Database sub-resources
  'database/db-backup': '#F9A8D4',    // pink-300
  'database/autonomous-db-backup': '#F472B6', // pink-400
  'database/autonomous-container-database': '#EC4899', // pink-500
  'database/database': '#DB2777',     // pink-600
  'database/pluggable-database': '#BE185D', // pink-700
  'database/db-node': '#9D174D',      // pink-800
  'database/exadata-infrastructure': '#831843', // pink-900
  'database/cloud-vm-cluster': '#EC4899', // pink-500
  'database/cloud-exa-infra': '#BE185D', // pink-700
  'database/db-software-image': '#F9A8D4', // pink-300
  'database/db-key-store': '#DC2626', // red-600
  'database/maintenance-run': '#6B7280', // gray-500
  'database/data-guard-association': '#DB2777', // pink-600
  'database/redis-cluster': '#EF4444', // red-500
  'database/opensearch-cluster': '#F59E0B', // amber-500
  'database/psql-db-system': '#3B82F6', // blue-500
  'database/psql-backup': '#93C5FD',  // blue-300
  'database/nosql-table': '#EC4899',  // pink-500

  // Storage sub-resources
  'storage/preauth-request': '#EA580C', // orange-600
  'storage/lifecycle-policy': '#C2410C', // orange-700
  'storage/replication-policy': '#9A3412', // orange-800

  // Security additions
  'security/cloud-guard-target': '#DC2626', // red-600
  'security/cloud-guard-detector-recipe': '#B91C1C', // red-700
  'security/waas-policy': '#991B1B',  // red-800
  'security/waas-certificate': '#7F1D1D', // red-900
  'security/waf-policy': '#DC2626',   // red-600
  'security/bastion': '#B91C1C',      // red-700
  'security/certificate': '#991B1B',  // red-800
  'security/dr-protection-group': '#DC2626', // red-600
  'security/dr-plan': '#B91C1C',      // red-700

  // IAM additions
  'iam/auth-token': '#78716C',        // stone-500
  'iam/smtp-credential': '#57534E',   // stone-600
  'iam/network-source': '#44403C',    // stone-700
  'iam/region-subscription': '#A3A3A3', // neutral-400
  'iam/tag-namespace': '#FBBF24',     // amber-400
  'iam/tag-default': '#F59E0B',       // amber-500
  'iam/tag': '#D97706',               // amber-600

  // Observability additions
  'observability/alarm': '#65A30D',   // lime-600
  'observability/notification-topic': '#4D7C0F', // lime-700
  'observability/notification-subscription': '#3F6212', // lime-800
  'observability/events-rule': '#365314', // lime-900
  'observability/email-sender': '#059669', // emerald-600

  // DevOps
  'devops/project': '#0D9488',        // teal-600
  'devops/build-pipeline': '#0F766E', // teal-700
  'devops/deploy-pipeline': '#115E59', // teal-800
  'devops/repository': '#134E4A',     // teal-900

  // Messaging
  'messaging/stream': '#F472B6',      // pink-400
  'messaging/connect-harness': '#E879F9', // fuchsia-400
  'messaging/service-connector': '#A78BFA', // violet-400
  'messaging/queue': '#C084FC',       // purple-400

  // Governance
  'governance/resource-manager-stack': '#FCD34D', // amber-300
  'governance/budget': '#FBBF24',     // amber-400
  'governance/quota': '#F59E0B',      // amber-500

  // Monitoring / Health
  'monitoring/health-check-http': '#34D399', // emerald-400
  'monitoring/health-check-ping': '#10B981', // emerald-500
  'monitoring/apm-domain': '#059669', // emerald-600
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
