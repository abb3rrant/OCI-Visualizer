import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export default React.memo(function InstanceNode({ data }: NodeProps) {
  const d = data as any;
  const stateColor = d?.lifecycleState === 'RUNNING' ? 'bg-green-500' : d?.lifecycleState === 'STOPPED' ? 'bg-gray-400' : 'bg-yellow-500';
  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-blue-400 dark:border-blue-600 rounded-lg p-2.5 min-w-[140px] shadow-sm">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">VM</span>
        <div className="min-w-0">
          <div className="text-xs font-semibold truncate dark:text-gray-200">{d?.label || 'Instance'}</div>
          {d?.metadata?.shape && <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{d.metadata.shape}</div>}
        </div>
      </div>
      <div className="flex items-center gap-1 mt-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${stateColor}`} />
        <span className="text-[10px] text-gray-500 dark:text-gray-400">{d?.lifecycleState || ''}</span>
      </div>
      <Handle type="target" position={Position.Top} className="!bg-blue-400 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !w-2 !h-2" />
    </div>
  );
});
