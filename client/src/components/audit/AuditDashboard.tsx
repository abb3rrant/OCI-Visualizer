import React from 'react';
import { getSeverityColor } from '../../utils/colors';

interface AuditDashboardProps {
  summary: { critical: number; high: number; medium: number; low: number; info: number };
}

export default function AuditDashboard({ summary }: AuditDashboardProps) {
  const items = [
    { label: 'Critical', count: summary.critical, severity: 'CRITICAL' },
    { label: 'High', count: summary.high, severity: 'HIGH' },
    { label: 'Medium', count: summary.medium, severity: 'MEDIUM' },
    { label: 'Low', count: summary.low, severity: 'LOW' },
    { label: 'Info', count: summary.info, severity: 'INFO' },
  ];

  return (
    <div className="grid grid-cols-5 gap-4">
      {items.map((item) => {
        const color = getSeverityColor(item.severity);
        return (
          <div key={item.severity} className="card text-center" style={{ borderColor: `${color}40`, borderWidth: 2 }}>
            <div className="text-3xl font-bold" style={{ color }}>{item.count}</div>
            <div className="text-sm text-gray-600 mt-1">{item.label}</div>
          </div>
        );
      })}
    </div>
  );
}
