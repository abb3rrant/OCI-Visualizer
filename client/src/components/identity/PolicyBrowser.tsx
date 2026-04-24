import React, { useState, useMemo } from 'react';

interface ParsedStatement {
  raw: string;
  policyName: string;
  policyOcid: string;
  subject: string;
  subjectType: string;
  verb: string;
  resourceType: string;
  scope: string;
  conditions: string | null;
  parsed: boolean;
}

interface PolicyBrowserProps {
  statements: ParsedStatement[];
}

const verbColors: Record<string, string> = {
  manage: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  use: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  read: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  inspect: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

export default function PolicyBrowser({ statements }: PolicyBrowserProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return statements;
    const q = search.toLowerCase();
    return statements.filter(
      (s) =>
        s.policyName.toLowerCase().includes(q) ||
        s.raw.toLowerCase().includes(q) ||
        s.subject.toLowerCase().includes(q) ||
        s.verb.toLowerCase().includes(q) ||
        s.resourceType.toLowerCase().includes(q) ||
        s.scope.toLowerCase().includes(q),
    );
  }, [statements, search]);

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Search statements..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400"
      />

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
              <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Policy</th>
              <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Subject</th>
              <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Verb</th>
              <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Resource Type</th>
              <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Scope</th>
              <th className="px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Statement</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr
                key={i}
                className={`border-b border-gray-100 dark:border-gray-800 ${!s.parsed ? 'opacity-60' : ''}`}
              >
                <td className="px-3 py-2 text-gray-900 dark:text-gray-100 font-medium whitespace-nowrap">{s.policyName}</td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {s.parsed ? (
                    <span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">{s.subjectType}: </span>
                      {s.subject || 'any-user'}
                    </span>
                  ) : (
                    <span className="text-gray-400 italic">unparsed</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {s.parsed ? (
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${verbColors[s.verb] || verbColors.inspect}`}>
                      {s.verb}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{s.parsed ? s.resourceType : '-'}</td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{s.parsed ? s.scope : '-'}</td>
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400 text-xs max-w-md truncate" title={s.raw}>{s.raw}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 dark:text-gray-500 py-8">No statements match your search.</p>
        )}
      </div>
    </div>
  );
}
