import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

const subtypeLabels: Record<string, { short: string; color: string }> = {
  'iam/user': { short: 'USR', color: '#A3A3A3' },
  'iam/group': { short: 'GRP', color: '#A3A3A3' },
  'iam/policy': { short: 'POL', color: '#FBBF24' },
  'iam/dynamic-group': { short: 'DYN', color: '#92400E' },
};

export default function IamNode({ data }: NodeProps) {
  const d = data as any;
  const info = subtypeLabels[d?.resourceType] || { short: 'IAM', color: '#78716C' };

  return (
    <div className="bg-white border-2 rounded-lg p-2.5 min-w-[110px] shadow-sm" style={{ borderColor: info.color }}>
      <div className="flex items-center gap-2">
        <span
          className="w-6 h-6 rounded-lg text-white text-[9px] flex items-center justify-center font-bold"
          style={{ backgroundColor: info.color }}
        >
          {info.short}
        </span>
        <div className="text-xs font-semibold truncate max-w-[90px]">{d?.label || 'IAM'}</div>
      </div>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" style={{ background: info.color }} />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" style={{ background: info.color }} />
    </div>
  );
}
