import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { getResourceColor } from '../../../utils/colors';

export default React.memo(function GenericNode({ data }: NodeProps) {
  const d = data as any;
  const color = getResourceColor(d?.resourceType || '');
  const short = d?.resourceType?.split('/').pop()?.slice(0, 3).toUpperCase() || '?';

  if (d?.compact) {
    return (
      <div className="bg-white dark:bg-gray-800 border rounded-lg px-2 py-1 flex items-center gap-1.5" style={{ borderColor: color }}>
        <span className="w-4 h-4 rounded text-white text-[8px] flex items-center justify-center font-bold shrink-0" style={{ backgroundColor: color }}>{short}</span>
        <span className="text-[10px] font-medium truncate max-w-[70px] dark:text-gray-200">{d?.label || 'Resource'}</span>
        <Handle type="target" position={Position.Top} className="!w-2 !h-2" style={{ background: color }} />
        <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" style={{ background: color }} />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border-2 rounded-lg p-2.5 min-w-[120px] shadow-sm" style={{ borderColor: color }}>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg text-white text-[10px] flex items-center justify-center font-bold" style={{ backgroundColor: color }}>
          {short}
        </span>
        <div className="text-xs font-semibold truncate max-w-[100px] dark:text-gray-200">{d?.label || 'Resource'}</div>
      </div>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" style={{ background: color }} />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" style={{ background: color }} />
    </div>
  );
});
