import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuery } from 'urql';
import { COMPARTMENT_COUNTS_QUERY } from '../../graphql/queries';
import { useSnapshot } from '../../contexts/SnapshotContext';

export default function TopCompartmentsChart() {
  const { currentSnapshot } = useSnapshot();
  const [result] = useQuery({
    query: COMPARTMENT_COUNTS_QUERY,
    variables: { snapshotId: currentSnapshot?.id || '' },
    pause: !currentSnapshot,
  });

  const data = (result.data?.compartmentCounts || [])
    .slice(0, 10)
    .map((c: any) => ({
      name: c.compartmentName || c.compartmentId?.slice(-12) || 'Unknown',
      count: c.count,
    }));

  if (data.length === 0) return null;

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Top Compartments</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={100}
            tick={{ fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: 'var(--color-gray-800, #1f2937)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
          />
          <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
