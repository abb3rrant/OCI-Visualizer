import React, { useState } from 'react';
import { useSnapshot } from '../contexts/SnapshotContext';
import { useAudit, useTagCompliance } from '../hooks/useAudit';
import AuditDashboard from '../components/audit/AuditDashboard';
import FindingsList from '../components/audit/FindingsList';
import TagCompliance from '../components/audit/TagCompliance';

export default function AuditPage() {
  const { currentSnapshot } = useSnapshot();
  const { report, loading } = useAudit(currentSnapshot?.id || null);
  const [activeTab, setActiveTab] = useState<'findings' | 'tags'>('findings');
  const [requiredTags, setRequiredTags] = useState<string[]>(['Environment', 'Owner', 'Project']);
  const { report: tagReport } = useTagCompliance(currentSnapshot?.id || null, requiredTags);

  if (!currentSnapshot) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 text-lg">Select a snapshot to run audit</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Security Audit</h2>

      {loading ? (
        <p className="text-gray-400">Running audit checks...</p>
      ) : report ? (
        <>
          <AuditDashboard summary={report.summary} />

          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('findings')}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'findings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
            >
              Findings ({report.findings.length})
            </button>
            <button
              onClick={() => setActiveTab('tags')}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'tags' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
            >
              Tag Compliance
            </button>
          </div>

          {activeTab === 'findings' ? (
            <FindingsList findings={report.findings} />
          ) : (
            <TagCompliance
              report={tagReport}
              requiredTags={requiredTags}
              onTagsChange={setRequiredTags}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
