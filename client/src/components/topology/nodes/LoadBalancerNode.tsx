import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export default function LoadBalancerNode({ data }: NodeProps) {
  const d = data as any;
  return (
    <div className="bg-white border-2 border-amber-400 rounded-lg p-2.5 min-w-[140px] shadow-sm">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">LB</span>
        <div className="min-w-0">
          <div className="text-xs font-semibold truncate">{d?.label || 'Load Balancer'}</div>
          {d?.metadata?.shapeName && <div className="text-[10px] text-gray-500">{d.metadata.shapeName}</div>}
        </div>
      </div>
      <Handle type="target" position={Position.Top} className="!bg-amber-400 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-amber-400 !w-2 !h-2" />
    </div>
  );
}
