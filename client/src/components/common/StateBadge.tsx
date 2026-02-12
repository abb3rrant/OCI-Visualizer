import React from 'react';
import { getStateColor } from '../../utils/colors';

interface StateBadgeProps {
  state: string | null;
}

export default function StateBadge({ state }: StateBadgeProps) {
  if (!state) return <span className="text-gray-400 text-sm">-</span>;

  const color = getStateColor(state);
  return (
    <span
      className="badge"
      style={{ backgroundColor: `${color}15`, color, borderColor: `${color}30`, borderWidth: 1 }}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: color }} />
      {state}
    </span>
  );
}
