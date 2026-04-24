import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useQuery } from 'urql';
import { LIFECYCLE_STATE_COUNTS_QUERY } from '../../graphql/queries';
import { useSnapshot } from '../../contexts/SnapshotContext';
import { getStateColor } from '../../utils/colors';

export default function LifecycleStateChart() {
  const { currentSnapshot } = useSnapshot();
  const [result] = useQuery({
    query: LIFECYCLE_STATE_COUNTS_QUERY,
    variables: { snapshotId: currentSnapshot?.id || '' },
    pause: !currentSnapshot,
  });

  const data = (result.data?.lifecycleStateCounts || [])
    .map((c: any) => ({
      name: c.name,
      value: c.count,
      color: getStateColor(c.name),
    }))
    .sort((a: any, b: any) => b.value - a.value);

  if (data.length === 0) return null;

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Lifecycle States</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={80}
            paddingAngle={1}
            dataKey="value"
          >
            {data.map((entry: any, i: number) => (
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
