import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export default function SubnetNode({ data }: NodeProps) {
  const d = data as any;
  const isPublic = d?.metadata?.prohibitInternetIngress === false;
  return (
    <div className={`border-2 rounded-lg p-3 min-w-[160px] ${isPublic ? 'bg-green-50 border-green-300' : 'bg-blue-50 border-blue-300'}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`w-5 h-5 rounded text-white text-[9px] flex items-center justify-center font-bold ${isPublic ? 'bg-green-500' : 'bg-blue-500'}`}>SN</span>
        <span className="text-xs font-semibold truncate max-w-[120px]">{d?.label || 'Subnet'}</span>
      </div>
      {d?.metadata?.cidrBlock && <span className="text-[10px] text-gray-500">{d.metadata.cidrBlock}</span>}
      {isPublic && <span className="ml-1 text-[10px] text-green-700 font-medium">Public</span>}
      <Handle type="target" position={Position.Top} className="!bg-blue-400 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !w-2 !h-2" />
    </div>
  );
}
