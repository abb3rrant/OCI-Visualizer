import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export default function VcnNode({ data }: NodeProps) {
  const d = data as any;
  return (
    <div className="bg-purple-50 border-2 border-purple-300 rounded-xl p-4 min-w-[400px] min-h-[250px]">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 rounded-lg bg-purple-500 text-white text-xs flex items-center justify-center font-bold">VCN</span>
        <span className="text-sm font-semibold text-purple-900">{d?.label || 'VCN'}</span>
      </div>
      {d?.metadata?.cidrBlocks && (
        <span className="text-xs text-purple-600">{d.metadata.cidrBlocks.join(', ')}</span>
      )}
      <Handle type="target" position={Position.Top} className="!bg-purple-500" />
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500" />
    </div>
  );
}
