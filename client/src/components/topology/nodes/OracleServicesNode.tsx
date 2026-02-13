import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export default React.memo(function OracleServicesNode({ data }: NodeProps) {
  return (
    <div className="bg-orange-50 dark:bg-orange-950 border-2 border-orange-400 dark:border-orange-700 rounded-xl p-3 min-w-[140px] shadow-md">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-orange-500 text-white text-[8px] flex items-center justify-center font-bold">
          OSN
        </span>
        <div className="text-xs font-semibold text-orange-700 dark:text-orange-300">Oracle Services</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" style={{ background: '#F97316' }} />
    </div>
  );
});
