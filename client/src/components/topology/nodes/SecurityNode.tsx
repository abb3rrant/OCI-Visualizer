import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

const securityLabels: Record<string, { short: string; color: string }> = {
  'network/nsg': { short: 'NSG', color: '#DC2626' },
  'network/security-list': { short: 'SL', color: '#E11D48' },
  'network/route-table': { short: 'RT', color: '#9333EA' },
};

export default function SecurityNode({ data }: NodeProps) {
  const d = data as any;
  const sec = securityLabels[d?.resourceType] || { short: 'SEC', color: '#DC2626' };

  return (
    <div className="bg-white border-2 rounded-lg p-2.5 min-w-[100px] shadow-sm" style={{ borderColor: sec.color }}>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded text-white text-[9px] flex items-center justify-center font-bold" style={{ backgroundColor: sec.color }}>
          {sec.short}
        </span>
        <div className="text-xs font-semibold truncate max-w-[100px]">{d?.label || 'Security'}</div>
      </div>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" style={{ background: sec.color }} />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" style={{ background: sec.color }} />
    </div>
  );
}
