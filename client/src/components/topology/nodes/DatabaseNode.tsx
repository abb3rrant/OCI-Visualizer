import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export default React.memo(function DatabaseNode({ data }: NodeProps) {
  const d = data as any;
  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-pink-400 dark:border-pink-600 rounded-lg p-2.5 min-w-[140px] shadow-sm">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-pink-500 text-white text-[10px] flex items-center justify-center font-bold">DB</span>
        <div className="min-w-0">
          <div className="text-xs font-semibold truncate dark:text-gray-200">{d?.label || 'Database'}</div>
          {d?.metadata?.shape && <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{d.metadata.shape}</div>}
        </div>
      </div>
      <Handle type="target" position={Position.Top} className="!bg-pink-400 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-pink-400 !w-2 !h-2" />
    </div>
  );
});
