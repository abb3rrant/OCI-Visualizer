import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

const subtypeLabels: Record<string, { short: string; color: string }> = {
  'container/cluster': { short: 'OKE', color: '#06B6D4' },
  'container/node-pool': { short: 'NP', color: '#67E8F9' },
  'container/container-instance': { short: 'CI', color: '#0891B2' },
  'container/container-repository': { short: 'REP', color: '#0E7490' },
  'container/container-image': { short: 'CIM', color: '#155E75' },
  'container/image-signature': { short: 'SIG', color: '#164E63' },
};

export default function ContainerNode({ data }: NodeProps) {
  const d = data as any;
  const info = subtypeLabels[d?.resourceType] || { short: 'CTR', color: '#06B6D4' };

  const subtitle =
    d?.metadata?.kubernetesVersion ||
    (d?.metadata?.imageCount != null ? `${d.metadata.imageCount} images` : null);

  return (
    <div className="bg-white border-2 rounded-lg p-2.5 min-w-[130px] shadow-sm" style={{ borderColor: info.color }}>
      <div className="flex items-center gap-2">
        <span
          className="w-6 h-6 rounded-lg text-white text-[9px] flex items-center justify-center font-bold"
          style={{ backgroundColor: info.color }}
        >
          {info.short}
        </span>
        <div className="min-w-0">
          <div className="text-xs font-semibold truncate max-w-[110px]">{d?.label || 'Container'}</div>
          {subtitle && <div className="text-[10px] text-gray-500 truncate">{subtitle}</div>}
        </div>
      </div>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" style={{ background: info.color }} />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" style={{ background: info.color }} />
    </div>
  );
}
