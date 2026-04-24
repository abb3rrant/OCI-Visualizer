import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export default React.memo(function SubnetNode({ data }: NodeProps) {
  const d = data as any;
  const isPublic = d?.metadata?.prohibitInternetIngress === false;

  if (d?.compact) {
    return (
      <div className={`rounded-lg border px-2 py-1 flex items-center gap-1.5 ${
        isPublic ? 'bg-green-50 dark:bg-green-950 border-green-400 dark:border-green-700' : 'bg-blue-50 dark:bg-blue-950 border-blue-400 dark:border-blue-700'
      }`}>
        <span className={`w-4 h-4 rounded text-white text-[8px] flex items-center justify-center font-bold shrink-0 ${isPublic ? 'bg-green-500' : 'bg-blue-500'}`}>SN</span>
        <span className="text-[10px] font-medium truncate max-w-[80px] dark:text-gray-200">{d?.label || 'Subnet'}</span>
        <Handle type="target" position={Position.Top} className="!bg-blue-400 !w-2 !h-2" />
        <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !w-2 !h-2" />
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border-2 px-3 py-2 min-w-[160px] shadow-sm ${
        isPublic
          ? 'bg-green-50 dark:bg-green-950 border-green-400 dark:border-green-700'
          : 'bg-blue-50 dark:bg-blue-950 border-blue-400 dark:border-blue-700'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`w-5 h-5 rounded text-white text-[9px] flex items-center justify-center font-bold shrink-0 ${
            isPublic ? 'bg-green-500' : 'bg-blue-500'
          }`}
        >
          SN
        </span>
        <span className="text-xs font-semibold truncate max-w-[120px] dark:text-gray-200">{d?.label || 'Subnet'}</span>
        <span
          className={`ml-auto text-[9px] font-medium px-1 py-0.5 rounded ${
            isPublic
              ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
              : 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
          }`}
        >
          {isPublic ? 'Public' : 'Private'}
        </span>
      </div>
      {d?.metadata?.cidrBlock && (
        <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{d.metadata.cidrBlock}</div>
      )}
      <Handle type="target" position={Position.Top} className="!bg-blue-400 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !w-2 !h-2" />
    </div>
  );
});

export const SubnetGroupNode = React.memo(function SubnetGroupNode({ data, width, height }: NodeProps) {
  const d = data as any;
  const isPublic = d?.metadata?.prohibitInternetIngress === false;
  const borderColor = isPublic ? 'border-green-400 dark:border-green-700' : 'border-blue-400 dark:border-blue-700';
  const bgColor = isPublic ? 'bg-green-50/50 dark:bg-green-950/30' : 'bg-blue-50/50 dark:bg-blue-950/30';
  const headerBg = isPublic ? 'bg-green-100/80 dark:bg-green-900/50' : 'bg-blue-100/80 dark:bg-blue-900/50';
  const w = width || d?.style?.width;
  const h = height || d?.style?.height;

  return (
    <div
      className={`${bgColor} border-2 border-dashed ${borderColor} rounded-xl`}
      style={{ width: w, height: h, minWidth: 180, minHeight: 80 }}
    >
      <div className={`${headerBg} rounded-t-xl px-3 py-1.5 flex items-center gap-1.5 pointer-events-auto`}>
        <span className={`w-4 h-4 rounded text-white text-[8px] flex items-center justify-center font-bold shrink-0 ${isPublic ? 'bg-green-500' : 'bg-blue-500'}`}>SN</span>
        <span className="text-[10px] font-semibold truncate dark:text-gray-200">{d?.label || 'Subnet'}</span>
        {d?.metadata?.cidrBlock && (
          <span className="text-[9px] text-gray-500 dark:text-gray-400 ml-auto">{d.metadata.cidrBlock}</span>
        )}
      </div>
      <Handle type="target" position={Position.Top} className="!bg-blue-400 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !w-2 !h-2" />
    </div>
  );
});
