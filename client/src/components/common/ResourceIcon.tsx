import React from 'react';
import { getResourceColor } from '../../utils/colors';

interface ResourceIconProps {
  resourceType: string;
  size?: 'sm' | 'md' | 'lg';
}

const typeInitials: Record<string, string> = {
  // Compute
  'compute/instance': 'VM',
  'compute/image': 'IMG',
  'compute/vnic-attachment': 'VNC',
  'compute/boot-volume-attachment': 'BVA',
  // Network
  'network/vcn': 'VCN',
  'network/subnet': 'SN',
  'network/security-list': 'SL',
  'network/route-table': 'RT',
  'network/nsg': 'NSG',
  'network/internet-gateway': 'IGW',
  'network/nat-gateway': 'NAT',
  'network/service-gateway': 'SGW',
  'network/local-peering-gateway': 'LPG',
  'network/drg': 'DRG',
  'network/drg-attachment': 'DRA',
  'network/dhcp-options': 'DHCP',
  'network/load-balancer': 'LB',
  'network/network-load-balancer': 'NLB',
  // Database
  'database/db-system': 'DB',
  'database/autonomous-database': 'ADB',
  'database/db-home': 'DBH',
  'database/mysql-db-system': 'MYS',
  // Storage
  'storage/block-volume': 'BV',
  'storage/boot-volume': 'BTV',
  'storage/volume-backup': 'VBK',
  'storage/volume-group': 'VGR',
  'storage/bucket': 'OBJ',
  'storage/file-system': 'FS',
  // Container / OKE
  'container/cluster': 'OKE',
  'container/node-pool': 'NP',
  'container/container-instance': 'CI',
  'container/container-repository': 'REP',
  'container/container-image': 'CIM',
  // Serverless
  'serverless/application': 'APP',
  'serverless/function': 'FN',
  'serverless/api-gateway': 'API',
  'serverless/api-deployment': 'DEP',
  // IAM
  'iam/compartment': 'CMP',
  'iam/user': 'USR',
  'iam/group': 'GRP',
  'iam/policy': 'POL',
  'iam/dynamic-group': 'DYN',
  // DNS
  'dns/zone': 'DNS',
  // Security
  'security/vault': 'VLT',
  'security/secret': 'SEC',
  'security/container-scan-result': 'SCN',
  // Observability
  'observability/log-group': 'LGR',
  'observability/log': 'LOG',
  // Compute (continued)
  'compute/instance-configuration': 'IC',
  // Container (continued)
  'container/image-signature': 'SIG',
  // IAM (continued)
  'iam/api-key': 'KEY',
  'iam/customer-secret-key': 'CSK',

  // Compute sub-resources
  'compute/volume-attachment': 'VOL',
  'compute/dedicated-vm-host': 'DVH',
  'compute/capacity-reservation': 'CAP',
  'compute/compute-cluster': 'CCL',
  'compute/console-history': 'CON',
  'compute/autoscaling-config': 'ASC',

  // Network sub-resources
  'network/vlan': 'VLN',
  'network/cpe': 'CPE',
  'network/ipsec-connection': 'VPN',
  'network/cross-connect-group': 'CCG',
  'network/cross-connect': 'CC',
  'network/virtual-circuit': 'VC',
  'network/remote-peering-connection': 'RPC',
  'network/private-ip': 'PIP',
  'network/vtap': 'VTP',
  'network/capture-filter': 'CF',
  'network/byoip-range': 'BYO',
  'network/public-ip-pool': 'IPP',
  'network/network-firewall': 'NFW',
  'network/network-firewall-policy': 'NFP',
  'network/drg-route-distribution': 'DRD',
  'network/nsg-rule': 'NSR',
  'network/public-ip': 'PUB',
  'network/drg-route-table': 'DRT',
  'network/drg-route-rule': 'DRR',

  // Database sub-resources
  'database/db-backup': 'DBK',
  'database/autonomous-db-backup': 'ABK',
  'database/autonomous-container-database': 'ACD',
  'database/database': 'DBA',
  'database/pluggable-database': 'PDB',
  'database/db-node': 'NOD',
  'database/exadata-infrastructure': 'EXA',
  'database/cloud-vm-cluster': 'CVM',
  'database/cloud-exa-infra': 'CEI',
  'database/db-software-image': 'DSI',
  'database/db-key-store': 'DKS',
  'database/maintenance-run': 'MNT',
  'database/data-guard-association': 'DGD',
  'database/redis-cluster': 'RDS',
  'database/opensearch-cluster': 'OSR',
  'database/psql-db-system': 'PGS',
  'database/psql-backup': 'PBK',
  'database/nosql-table': 'NQL',

  // Storage sub-resources
  'storage/preauth-request': 'PAR',
  'storage/lifecycle-policy': 'LCP',
  'storage/replication-policy': 'RPL',
  'storage/mount-target': 'MT',

  // Security additions
  'security/cloud-guard-target': 'CGT',
  'security/cloud-guard-detector-recipe': 'CGD',
  'security/waas-policy': 'WAS',
  'security/waas-certificate': 'WCT',
  'security/waf-policy': 'WAF',
  'security/bastion': 'BST',
  'security/certificate': 'CRT',
  'security/dr-protection-group': 'DRP',
  'security/dr-plan': 'DPN',

  // IAM additions
  'iam/auth-token': 'ATK',
  'iam/smtp-credential': 'SMT',
  'iam/network-source': 'NWS',
  'iam/region-subscription': 'REG',
  'iam/tag-namespace': 'TNS',
  'iam/tag-default': 'TDF',
  'iam/tag': 'TAG',

  // Observability additions
  'observability/alarm': 'ALM',
  'observability/notification-topic': 'ONS',
  'observability/notification-subscription': 'SUB',
  'observability/events-rule': 'EVT',
  'observability/email-sender': 'EML',

  // DevOps
  'devops/project': 'DVP',
  'devops/build-pipeline': 'BPL',
  'devops/deploy-pipeline': 'DPL',
  'devops/repository': 'GIT',

  // Messaging
  'messaging/stream': 'STR',
  'messaging/connect-harness': 'CHN',
  'messaging/service-connector': 'SCH',
  'messaging/queue': 'QUE',

  // Governance
  'governance/resource-manager-stack': 'STK',
  'governance/budget': 'BDG',
  'governance/quota': 'QTA',

  // Monitoring / Health
  'monitoring/health-check-http': 'HCH',
  'monitoring/health-check-ping': 'HCP',
  'monitoring/apm-domain': 'APM',
};

const sizes = { sm: 'w-6 h-6 text-[10px]', md: 'w-8 h-8 text-xs', lg: 'w-10 h-10 text-sm' };

export default function ResourceIcon({ resourceType, size = 'md' }: ResourceIconProps) {
  const color = getResourceColor(resourceType);
  const initials = typeInitials[resourceType] || resourceType.split('/').pop()?.slice(0, 3).toUpperCase() || '?';

  return (
    <div
      className={`${sizes[size]} rounded-lg flex items-center justify-center font-bold text-white shrink-0`}
      style={{ backgroundColor: color }}
      title={resourceType}
    >
      {initials}
    </div>
  );
}
