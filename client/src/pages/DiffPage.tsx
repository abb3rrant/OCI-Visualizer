import React, { useState } from 'react';
import { useQuery } from 'urql';
import { SNAPSHOTS_QUERY, SNAPSHOT_DIFF_QUERY } from '../graphql/queries';

interface DiffResource {
  ocid: string;
  displayName: string | null;
  resourceType: string;
}

interface ChangedField {
  field: string;
  oldValue: any;
  newValue: any;
}

interface ChangedResource extends DiffResource {
  changes: ChangedField[];
}

interface SnapshotDiffData {
  added: DiffResource[];
  removed: DiffResource[];
  changed: ChangedResource[];
}

function CollapsibleSection({
  title,
  count,
  color,
  defaultOpen,
  children,
}: {
  title: string;
  count: number;
  color: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? count > 0);

  const bgColors: Record<string, string> = {
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  };
  const headerBg: Record<string, string> = {
    green: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${bgColors[color] || 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold ${headerBg[color] || 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'}`}
      >
        <span>{title} ({count})</span>
        <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

function ResourceList({ resources }: { resources: DiffResource[] }) {
  if (resources.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400">None</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-gray-500 dark:text-gray-400 uppercase">
          <th className="pb-2 pr-4">Name</th>
          <th className="pb-2 pr-4">Type</th>
          <th className="pb-2">OCID</th>
        </tr>
      </thead>
      <tbody>
        {resources.map((r) => (
          <tr key={r.ocid} className="border-t border-gray-200/50 dark:border-gray-700/50">
            <td className="py-1.5 pr-4 font-medium">{r.displayName || '-'}</td>
            <td className="py-1.5 pr-4 text-gray-600 dark:text-gray-400">{r.resourceType}</td>
            <td className="py-1.5 text-gray-400 dark:text-gray-500 font-mono text-xs truncate max-w-xs">{r.ocid}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChangedResourceList({ resources }: { resources: ChangedResource[] }) {
  const [expandedOcid, setExpandedOcid] = useState<string | null>(null);

  if (resources.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400">None</p>;

  return (
    <div className="space-y-2">
      {resources.map((r) => (
        <div key={r.ocid} className="bg-white dark:bg-gray-800 rounded border border-yellow-200 dark:border-yellow-800">
          <button
            onClick={() => setExpandedOcid(expandedOcid === r.ocid ? null : r.ocid)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
          >
            <span>
              <span className="font-medium">{r.displayName || '-'}</span>
              <span className="text-gray-500 dark:text-gray-400 ml-2">{r.resourceType}</span>
              <span className="text-gray-400 dark:text-gray-500 ml-2 text-xs">({r.changes.length} field{r.changes.length !== 1 ? 's' : ''} changed)</span>
            </span>
            <svg className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${expandedOcid === r.ocid ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedOcid === r.ocid && (
            <div className="border-t border-yellow-200 dark:border-yellow-800 px-3 py-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 uppercase">
                    <th className="pb-1 pr-3">Field</th>
                    <th className="pb-1 pr-3">Old Value</th>
                    <th className="pb-1">New Value</th>
                  </tr>
                </thead>
                <tbody>
                  {r.changes.map((c) => (
                    <tr key={c.field} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="py-1 pr-3 font-medium text-gray-700 dark:text-gray-300">{c.field}</td>
                      <td className="py-1 pr-3 text-red-600 dark:text-red-400 font-mono break-all max-w-xs">
                        {typeof c.oldValue === 'object' ? JSON.stringify(c.oldValue) : String(c.oldValue ?? 'null')}
                      </td>
                      <td className="py-1 text-green-600 dark:text-green-400 font-mono break-all max-w-xs">
                        {typeof c.newValue === 'object' ? JSON.stringify(c.newValue) : String(c.newValue ?? 'null')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function DiffPage() {
  const [snapshotIdA, setSnapshotIdA] = useState('');
  const [snapshotIdB, setSnapshotIdB] = useState('');
  const [compareIds, setCompareIds] = useState<{ a: string; b: string } | null>(null);

  const [snapshotsResult] = useQuery({ query: SNAPSHOTS_QUERY });
  const snapshots = snapshotsResult.data?.snapshots || [];

  const [diffResult] = useQuery({
    query: SNAPSHOT_DIFF_QUERY,
    variables: { snapshotIdA: compareIds?.a || '', snapshotIdB: compareIds?.b || '' },
    pause: !compareIds,
  });

  const diff: SnapshotDiffData | null = diffResult.data?.snapshotDiff || null;

  const handleCompare = () => {
    if (snapshotIdA && snapshotIdB && snapshotIdA !== snapshotIdB) {
      setCompareIds({ a: snapshotIdA, b: snapshotIdB });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Snapshot Diff</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Compare two snapshots to see what changed</p>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Snapshot A (baseline)</label>
            <select
              value={snapshotIdA}
              onChange={(e) => setSnapshotIdA(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
            >
              <option value="">Select snapshot...</option>
              {snapshots.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} ({new Date(s.importedAt).toLocaleDateString()})</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Snapshot B (new)</label>
            <select
              value={snapshotIdB}
              onChange={(e) => setSnapshotIdB(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-200"
            >
              <option value="">Select snapshot...</option>
              {snapshots.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} ({new Date(s.importedAt).toLocaleDateString()})</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCompare}
            disabled={!snapshotIdA || !snapshotIdB || snapshotIdA === snapshotIdB}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Compare
          </button>
        </div>
        {snapshotIdA && snapshotIdB && snapshotIdA === snapshotIdB && (
          <p className="text-sm text-red-500 dark:text-red-400 mt-2">Please select two different snapshots to compare.</p>
        )}
      </div>

      {diffResult.fetching && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">Computing diff...</div>
      )}

      {diffResult.error && (
        <div className="card bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          Error: {diffResult.error.message}
        </div>
      )}

      {diff && !diffResult.fetching && (
        <div className="space-y-4">
          <div className="flex gap-4 text-sm">
            <span className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 font-medium">
              +{diff.added.length} added
            </span>
            <span className="px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 font-medium">
              -{diff.removed.length} removed
            </span>
            <span className="px-3 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 font-medium">
              ~{diff.changed.length} changed
            </span>
          </div>

          <CollapsibleSection title="Added Resources" count={diff.added.length} color="green">
            <ResourceList resources={diff.added} />
          </CollapsibleSection>

          <CollapsibleSection title="Removed Resources" count={diff.removed.length} color="red">
            <ResourceList resources={diff.removed} />
          </CollapsibleSection>

          <CollapsibleSection title="Changed Resources" count={diff.changed.length} color="yellow">
            <ChangedResourceList resources={diff.changed} />
          </CollapsibleSection>
        </div>
      )}

      {compareIds && !diffResult.fetching && !diffResult.error && diff &&
        diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0 && (
        <div className="card text-center py-8 text-gray-500 dark:text-gray-400">
          No differences found between the two snapshots.
        </div>
      )}
    </div>
  );
}
