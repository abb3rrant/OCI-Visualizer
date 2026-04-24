import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export default React.memo(function VcnNode({ data }: NodeProps) {
  const d = data as any;
  if (d?.compact) {
    return (
      <div className="bg-purple-50 dark:bg-purple-950 border border-purple-300 dark:border-purple-700 rounded-lg px-2 py-1 flex items-center gap-1.5">
        <span className="w-4 h-4 rounded bg-purple-500 text-white text-[8px] flex items-center justify-center font-bold shrink-0">VCN</span>
        <span className="text-[10px] font-medium text-purple-900 dark:text-purple-100 truncate max-w-[80px]">{d?.label || 'VCN'}</span>
        <Handle type="target" position={Position.Top} className="!bg-purple-500" />
        <Handle type="source" position={Position.Bottom} className="!bg-purple-500" />
      </div>
    );
  }
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

export const VcnGroupNode = React.memo(function VcnGroupNode({ data, width, height }: NodeProps) {
  const d = data as any;
  const w = width || d?.style?.width;
  const h = height || d?.style?.height;
  return (
    <div
      className="bg-purple-50/50 dark:bg-purple-950/30 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-2xl"
      style={{ width: w, height: h, minWidth: 200, minHeight: 100 }}
    >
      <div className="bg-purple-100/80 dark:bg-purple-900/50 rounded-t-2xl px-3 py-2 flex items-center gap-2 pointer-events-auto">
        <span className="w-5 h-5 rounded bg-purple-500 text-white text-[9px] flex items-center justify-center font-bold shrink-0">VCN</span>
        <span className="text-xs font-semibold text-purple-900 dark:text-purple-100 truncate">{d?.label || 'VCN'}</span>
        {d?.metadata?.cidrBlocks && (
          <span className="text-[10px] text-purple-500 dark:text-purple-400 ml-auto truncate max-w-[120px]">{d.metadata.cidrBlocks.join(', ')}</span>
        )}
      </div>
      <Handle type="target" position={Position.Top} className="!bg-purple-500" />
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500" />
    </div>
  );
});
