import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export default function StorageNode({ data }: NodeProps) {
  const d = data as any;
  return (
    <div className="bg-white border-2 border-gray-400 rounded-lg p-2.5 min-w-[120px] shadow-sm">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-gray-500 text-white text-[10px] flex items-center justify-center font-bold">
          {d?.resourceType?.includes('bucket') ? 'OBJ' : 'BV'}
        </span>
        <div className="min-w-0">
          <div className="text-xs font-semibold truncate">{d?.label || 'Storage'}</div>
          {d?.metadata?.sizeInGbs && <div className="text-[10px] text-gray-500">{d.metadata.sizeInGbs} GB</div>}
        </div>
      </div>
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2" />
    </div>
  );
}
