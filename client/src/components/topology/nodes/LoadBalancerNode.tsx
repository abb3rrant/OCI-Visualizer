import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export default React.memo(function LoadBalancerNode({ data }: NodeProps) {
  const d = data as any;
  if (d?.compact) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-amber-400 dark:border-amber-600 rounded-lg px-2 py-1 flex items-center gap-1.5">
        <span className="w-4 h-4 rounded bg-amber-500 text-white text-[8px] flex items-center justify-center font-bold shrink-0">LB</span>
        <span className="text-[10px] font-medium truncate max-w-[80px] dark:text-gray-200">{d?.label || 'Load Balancer'}</span>
        <Handle type="target" position={Position.Top} className="!bg-amber-400 !w-2 !h-2" />
        <Handle type="source" position={Position.Bottom} className="!bg-amber-400 !w-2 !h-2" />
      </div>
    );
  }
  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-amber-400 dark:border-amber-600 rounded-lg p-2.5 min-w-[140px] shadow-sm">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">LB</span>
        <div className="min-w-0">
          <div className="text-xs font-semibold truncate dark:text-gray-200">{d?.label || 'Load Balancer'}</div>
          {d?.metadata?.shapeName && <div className="text-[10px] text-gray-500 dark:text-gray-400">{d.metadata.shapeName}</div>}
        </div>
      </div>
      <Handle type="target" position={Position.Top} className="!bg-amber-400 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-amber-400 !w-2 !h-2" />
    </div>
  );
});
