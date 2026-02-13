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
