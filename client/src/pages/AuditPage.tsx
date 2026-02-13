import React, { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSnapshot } from '../contexts/SnapshotContext';
import { useAudit, useTagCompliance } from '../hooks/useAudit';
import AuditDashboard from '../components/audit/AuditDashboard';
import FindingsList from '../components/audit/FindingsList';
import TagCompliance from '../components/audit/TagCompliance';
import ExportAuditButton from '../components/audit/ExportAuditButton';
import SkeletonCard from '../components/common/SkeletonCard';
import SkeletonTable from '../components/common/SkeletonTable';

const PRINT_STYLES = `
@media print {
  /* Hide non-report UI */
  nav, [data-sidebar], [data-header], .no-print { display: none !important; }

  /* Make the report area full width */
  body, main, [data-main-content] { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; }

  /* Show the print header */
  .print-header { display: block !important; }

  /* Clean formatting for findings */
  .card { box-shadow: none !important; border: 1px solid #e5e7eb !important; break-inside: avoid; }
  button { pointer-events: none; }
}
`;

export default function AuditPage() {
  const { currentSnapshot } = useSnapshot();
  const { report, loading } = useAudit(currentSnapshot?.id || null);
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-driven tab state
  const activeTab = (searchParams.get('tab') as 'findings' | 'tags') || 'findings';
  const setActiveTab = useCallback((tab: 'findings' | 'tags') => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (tab === 'findings') next.delete('tab');
      else next.set('tab', tab);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const [requiredTags, setRequiredTags] = useState<string[]>(['Environment', 'Owner', 'Project']);
  const { report: tagReport } = useTagCompliance(currentSnapshot?.id || null, requiredTags);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (!currentSnapshot) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 dark:text-gray-500 text-lg">Select a snapshot to run audit</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <style>{PRINT_STYLES}</style>

      {/* Print-only header */}
      <div className="print-header" style={{ display: 'none' }}>
        <h1 className="text-xl font-bold">OCI Security Audit Report</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Snapshot: {currentSnapshot.name} | Generated: {new Date().toLocaleDateString()}
        </p>
        <hr className="my-3" />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Security Audit</h2>
        <div className="flex items-center gap-2">
          {report && (
            <>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors no-print"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Report
              </button>
              <ExportAuditButton findings={report.groupedFindings} />
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <SkeletonCard count={5} />
          <SkeletonTable rows={6} columns={5} />
        </div>
      ) : report ? (
        <>
          <AuditDashboard summary={report.summary} />

          <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 no-print">
            <button
              onClick={() => setActiveTab('findings')}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'findings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 dark:text-gray-400'}`}
            >
              Findings ({report.groupedFindings.length})
            </button>
            <button
              onClick={() => setActiveTab('tags')}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'tags' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 dark:text-gray-400'}`}
            >
              Tag Compliance
            </button>
          </div>

          {activeTab === 'findings' ? (
            <FindingsList findings={report.groupedFindings} />
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
