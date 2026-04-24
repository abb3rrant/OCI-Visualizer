import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { getSeverityColor } from '../../utils/colors';

interface AuditSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

interface Props {
  summary: AuditSummary | null;
}

export default function AuditSeverityChart({ summary }: Props) {
  if (!summary) return null;

  const data = [
    { name: 'Critical', value: summary.critical, color: getSeverityColor('CRITICAL') },
    { name: 'High', value: summary.high, color: getSeverityColor('HIGH') },
    { name: 'Medium', value: summary.medium, color: getSeverityColor('MEDIUM') },
    { name: 'Low', value: summary.low, color: getSeverityColor('LOW') },
    { name: 'Info', value: summary.info, color: getSeverityColor('INFO') },
  ].filter(d => d.value > 0);

  if (data.length === 0) return null;

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Audit Findings by Severity</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--color-gray-800, #1f2937)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '11px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
