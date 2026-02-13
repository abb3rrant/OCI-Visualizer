import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

const subtypeLabels: Record<string, { short: string; color: string }> = {
  'serverless/application': { short: 'APP', color: '#A855F7' },
  'serverless/function': { short: 'FN', color: '#C084FC' },
  'serverless/api-gateway': { short: 'API', color: '#E879F9' },
  'serverless/api-deployment': { short: 'DEP', color: '#D946EF' },
};

export default function ServerlessNode({ data }: NodeProps) {
  const d = data as any;
  const info = subtypeLabels[d?.resourceType] || { short: 'SLS', color: '#A855F7' };

  return (
    <div className="bg-white border-2 rounded-lg p-2.5 min-w-[130px] shadow-sm" style={{ borderColor: info.color }}>
      <div className="flex items-center gap-2">
        <span
          className="w-6 h-6 rounded-lg text-white text-[9px] flex items-center justify-center font-bold"
          style={{ backgroundColor: info.color }}
        >
          {info.short}
        </span>
        <div className="text-xs font-semibold truncate max-w-[110px]">{d?.label || 'Serverless'}</div>
      </div>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" style={{ background: info.color }} />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" style={{ background: info.color }} />
    </div>
  );
}
