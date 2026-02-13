import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export default React.memo(function InstanceSummaryNode({ data }: NodeProps) {
  const d = data as any;
  const count = d?.metadata?.instanceCount ?? 0;
  return (
    <div className="bg-blue-50 dark:bg-blue-950 border-2 border-blue-300 dark:border-blue-700 border-dashed rounded-lg p-2.5 min-w-[140px] shadow-sm">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-blue-400 text-white text-[10px] flex items-center justify-center font-bold">VM</span>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-blue-800 dark:text-blue-200">{count.toLocaleString()} instance{count !== 1 ? 's' : ''}</div>
          <div className="text-[10px] text-blue-500 dark:text-blue-400">collapsed</div>
        </div>
      </div>
      <Handle type="target" position={Position.Top} className="!bg-blue-300 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-blue-300 !w-2 !h-2" />
    </div>
  );
});
