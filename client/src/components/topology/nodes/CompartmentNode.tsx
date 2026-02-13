import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

const TYPE_LABELS: Record<string, string> = {
  'compute/instance': 'Compute',
  'compute/image': 'Images',
  'compute/vnic-attachment': 'VNICs',
  'compute/boot-volume-attachment': 'Boot Vol Attach',
  'compute/instance-configuration': 'Instance Config',
  'network/vcn': 'VCNs',
  'network/subnet': 'Subnets',
  'network/security-list': 'Security Lists',
  'network/route-table': 'Route Tables',
  'network/nsg': 'NSGs',
  'network/internet-gateway': 'IGWs',
  'network/nat-gateway': 'NAT GWs',
  'network/service-gateway': 'Service GWs',
  'network/local-peering-gateway': 'LPGs',
  'network/drg': 'DRGs',
  'network/drg-attachment': 'DRG Attach',
  'network/dhcp-options': 'DHCP',
  'network/load-balancer': 'Load Balancers',
  'network/network-load-balancer': 'NLBs',
  'database/db-system': 'DB Systems',
  'database/autonomous-database': 'Autonomous DBs',
  'database/mysql-db-system': 'MySQL',
  'database/db-home': 'DB Homes',
  'storage/block-volume': 'Block Volumes',
  'storage/boot-volume': 'Boot Volumes',
  'storage/volume-backup': 'Vol Backups',
  'storage/volume-group': 'Vol Groups',
  'storage/file-system': 'File Systems',
  'storage/bucket': 'Buckets',
  'container/cluster': 'OKE Clusters',
  'container/node-pool': 'Node Pools',
  'container/container-instance': 'Container Inst.',
  'container/container-repository': 'Repos',
  'container/container-image': 'Container Imgs',
  'serverless/application': 'Fn Apps',
  'serverless/function': 'Functions',
  'serverless/api-gateway': 'API GWs',
  'serverless/api-deployment': 'API Deploy',
  'iam/user': 'Users',
  'iam/group': 'Groups',
  'iam/policy': 'Policies',
  'iam/dynamic-group': 'Dynamic Groups',
  'iam/compartment': 'Compartments',
  'dns/zone': 'DNS Zones',
  'security/vault': 'Vaults',
  'security/secret': 'Secrets',
  'observability/log-group': 'Log Groups',
  'observability/log': 'Logs',
};

const TYPE_COLORS: Record<string, string> = {
  compute: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  network: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
  database: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
  storage: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300',
  container: 'bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300',
  serverless: 'bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300',
  iam: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  dns: 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300',
  security: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
  observability: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
};

function getColorClass(resourceType: string): string {
  const category = resourceType.split('/')[0];
  return TYPE_COLORS[category] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
}

function formatLabel(resourceType: string): string {
  return TYPE_LABELS[resourceType] || resourceType.split('/').pop() || resourceType;
}

function CompartmentNodeInner({ data }: NodeProps) {
  const metadata = (data as any)?.metadata as { resourceCounts?: Record<string, number>; totalResources?: number } | null;
  const label = (data as any)?.label || 'Compartment';
  const resourceCounts = metadata?.resourceCounts ?? {};
  const totalResources = metadata?.totalResources ?? 0;

  // Sort by count descending, take top entries
  const entries = Object.entries(resourceCounts)
    .sort((a, b) => b[1] - a[1]);
  const topEntries = entries.slice(0, 8);
  const remaining = entries.length - topEntries.length;

  return (
    <div className="bg-amber-50 dark:bg-amber-950 border-2 border-amber-300 dark:border-amber-700 rounded-xl shadow-sm w-[280px]">
      {/* Folder header */}
      <div className="bg-amber-200 dark:bg-amber-800 rounded-t-xl px-3 py-2 flex items-center gap-2">
        <svg className="w-4 h-4 text-amber-700 dark:text-amber-300" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
        <span className="text-sm font-semibold text-amber-900 dark:text-amber-100 truncate">{label}</span>
      </div>

      {/* Body */}
      <div className="px-3 py-2 space-y-1.5">
        {totalResources > 0 ? (
          <>
            <div className="text-xs text-amber-700 dark:text-amber-300 font-medium">
              {totalResources.toLocaleString()} resources
            </div>
            <div className="flex flex-wrap gap-1">
              {topEntries.map(([type, count]) => (
                <span
                  key={type}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${getColorClass(type)}`}
                >
                  <span className="font-bold">{count.toLocaleString()}</span>
                  {formatLabel(type)}
                </span>
              ))}
              {remaining > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                  +{remaining} more
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="text-xs text-amber-400 dark:text-amber-500 italic">Empty</div>
        )}
      </div>

      <Handle type="target" position={Position.Top} className="!bg-amber-400 !border-amber-600" />
      <Handle type="source" position={Position.Bottom} className="!bg-amber-400 !border-amber-600" />
    </div>
  );
}

export default React.memo(CompartmentNodeInner);
