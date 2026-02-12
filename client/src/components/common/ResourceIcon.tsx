import React from 'react';
import { getResourceColor } from '../../utils/colors';

interface ResourceIconProps {
  resourceType: string;
  size?: 'sm' | 'md' | 'lg';
}

const typeInitials: Record<string, string> = {
  'compute/instance': 'VM',
  'compute/image': 'IMG',
  'network/vcn': 'VCN',
  'network/subnet': 'SN',
  'network/security-list': 'SL',
  'network/route-table': 'RT',
  'network/nsg': 'NSG',
  'network/internet-gateway': 'IGW',
  'network/nat-gateway': 'NAT',
  'network/service-gateway': 'SGW',
  'network/drg': 'DRG',
  'network/load-balancer': 'LB',
  'database/db-system': 'DB',
  'database/autonomous-database': 'ADB',
  'storage/block-volume': 'BV',
  'storage/boot-volume': 'BTV',
  'storage/bucket': 'OBJ',
  'container/cluster': 'OKE',
  'container/node-pool': 'NP',
  'serverless/application': 'APP',
  'serverless/function': 'FN',
  'serverless/api-gateway': 'API',
  'iam/compartment': 'CMP',
  'iam/user': 'USR',
  'iam/group': 'GRP',
  'iam/policy': 'POL',
  'dns/zone': 'DNS',
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
