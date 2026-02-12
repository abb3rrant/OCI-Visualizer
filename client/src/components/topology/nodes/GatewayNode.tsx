import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

const gatewayLabels: Record<string, { short: string; color: string }> = {
  'network/internet-gateway': { short: 'IGW', color: '#10B981' },
  'network/nat-gateway': { short: 'NAT', color: '#059669' },
  'network/service-gateway': { short: 'SGW', color: '#14B8A6' },
  'network/drg': { short: 'DRG', color: '#6366F1' },
  'network/local-peering-gateway': { short: 'LPG', color: '#8B5CF6' },
};

export default function GatewayNode({ data }: NodeProps) {
  const d = data as any;
  const gw = gatewayLabels[d?.resourceType] || { short: 'GW', color: '#6B7280' };

  return (
    <div className="bg-white border-2 rounded-lg p-2.5 min-w-[100px] shadow-sm" style={{ borderColor: gw.color }}>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg text-white text-[9px] flex items-center justify-center font-bold" style={{ backgroundColor: gw.color }}>
          {gw.short}
        </span>
        <div className="text-xs font-semibold truncate max-w-[100px]">{d?.label || 'Gateway'}</div>
      </div>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" style={{ background: gw.color }} />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" style={{ background: gw.color }} />
    </div>
  );
}
