import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { CATEGORIES } from '../../utils/categories';
import type { ResourceCount } from '../../types';

const CATEGORY_COLORS: Record<string, string> = {
  compute: '#3B82F6',
  network: '#8B5CF6',
  database: '#EC4899',
  storage: '#6B7280',
  container: '#06B6D4',
  serverless: '#A855F7',
  iam: '#78716C',
  security: '#DC2626',
  observability: '#65A30D',
  dns: '#2DD4BF',
};

interface Props {
  counts: ResourceCount[];
}

export default function ResourceDistributionChart({ counts }: Props) {
  const data = useMemo(() => {
    const categoryMap = new Map<string, number>();
    for (const c of counts) {
      const key = c.resourceType.split('/')[0] || 'other';
      categoryMap.set(key, (categoryMap.get(key) || 0) + c.count);
    }
    return Array.from(categoryMap.entries())
      .map(([key, count]) => ({
        name: CATEGORIES.find(c => c.key === key)?.label || key,
        value: count,
        color: CATEGORY_COLORS[key] || '#6B7280',
      }))
      .sort((a, b) => b.value - a.value);
  }, [counts]);

  if (data.length === 0) return null;

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Resource Distribution</h3>
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
