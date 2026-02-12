import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export default function CompartmentNode({ data }: NodeProps) {
  return (
    <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-4 min-w-[300px] min-h-[200px]">
      <div className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
        <span className="w-3 h-3 rounded bg-gray-400 text-white text-[8px] flex items-center justify-center font-bold">C</span>
        {(data as any)?.label || 'Compartment'}
      </div>
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </div>
  );
}
