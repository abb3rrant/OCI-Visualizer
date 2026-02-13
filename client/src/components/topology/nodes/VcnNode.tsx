import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export default React.memo(function VcnNode({ data }: NodeProps) {
  const d = data as any;
  return (
    <div className="bg-purple-50 dark:bg-purple-950 border-2 border-purple-300 dark:border-purple-700 rounded-xl px-4 py-3 min-w-[180px] shadow-sm">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-purple-500 text-white text-xs flex items-center justify-center font-bold">VCN</span>
        <span className="text-sm font-semibold text-purple-900 dark:text-purple-100 truncate max-w-[160px]">{d?.label || 'VCN'}</span>
      </div>
      {d?.metadata?.cidrBlocks && (
        <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">{d.metadata.cidrBlocks.join(', ')}</div>
      )}
      <Handle type="target" position={Position.Top} className="!bg-purple-500" />
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500" />
    </div>
  );
});
