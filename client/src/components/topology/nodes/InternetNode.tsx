import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export default React.memo(function InternetNode({ data }: NodeProps) {
  const d = data as any;
  if (d?.compact) {
    return (
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-400 dark:border-blue-700 rounded-lg px-2 py-1 flex items-center gap-1.5">
        <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[7px] flex items-center justify-center font-bold shrink-0">WAN</span>
        <span className="text-[10px] font-medium text-blue-700 dark:text-blue-300">Internet</span>
        <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" style={{ background: '#3B82F6' }} />
      </div>
    );
  }
  return (
    <div className="bg-blue-50 dark:bg-blue-950 border-2 border-blue-400 dark:border-blue-700 rounded-xl p-3 min-w-[120px] shadow-md">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold">
          WAN
        </span>
        <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">Internet</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" style={{ background: '#3B82F6' }} />
    </div>
  );
});
