import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

const typeBadges: Record<string, { short: string; color: string }> = {
  SRC: { short: 'SRC', color: '#3B82F6' },
  SUB: { short: 'SUB', color: '#8B5CF6' },
  RT:  { short: 'RT',  color: '#F59E0B' },
  SL:  { short: 'SL',  color: '#EC4899' },
  NSG: { short: 'NSG', color: '#D946EF' },
  GW:  { short: 'GW',  color: '#10B981' },
  DST: { short: 'DST', color: '#06B6D4' },
  NET: { short: 'NET', color: '#6366F1' },
};

const statusColors: Record<string, string> = {
  ALLOW: '#10B981',
  DENY: '#EF4444',
  UNKNOWN: '#9CA3AF',
};

export default React.memo(function ReachabilityHopNode({ data }: NodeProps) {
  const d = data as any;
  const badge = typeBadges[d?.hopType] || { short: '?', color: '#6B7280' };
  const status: string = d?.status || 'UNKNOWN';
  const borderColor = statusColors[status] || '#9CA3AF';

  return (
    <div
      className="bg-white dark:bg-gray-800 border-2 rounded-lg p-3 min-w-[140px] max-w-[220px] shadow-sm"
      style={{ borderColor }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="w-7 h-7 rounded-md text-white text-[10px] flex items-center justify-center font-bold shrink-0"
          style={{ backgroundColor: badge.color }}
        >
          {badge.short}
        </span>
        <div className="text-xs font-semibold truncate dark:text-gray-200">{d?.label || 'Hop'}</div>
        <span className="ml-auto text-sm">
          {status === 'ALLOW' ? '\u2713' : status === 'DENY' ? '\u2717' : '?'}
        </span>
      </div>
      {d?.details && (
        <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate" title={d.details}>
          {d.details}
        </div>
      )}
      <Handle type="target" position={Position.Left} className="!w-2 !h-2" style={{ background: borderColor }} />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2" style={{ background: borderColor }} />
    </div>
  );
});
