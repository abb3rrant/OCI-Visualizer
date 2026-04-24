import React, { useState, useRef, useEffect } from 'react';
import type { GroupedAuditFinding } from '../../types';

interface ExportAuditButtonProps {
  findings: GroupedAuditFinding[];
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return `"${value}"`;
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(escapeCSV).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportAuditButton({ findings }: ExportAuditButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const exportSummary = () => {
    const headers = ['Severity', 'Category', 'Title', 'Count', 'Recommendation'];
    const rows = findings.map(f => [f.severity, f.category, f.title, String(f.count), f.recommendation]);
    downloadCSV(`audit-summary-${new Date().toISOString().slice(0, 10)}.csv`, [headers, ...rows]);
    setOpen(false);
  };

  const exportDetail = () => {
    const headers = ['Severity', 'Category', 'Title', 'Resource Name', 'Resource OCID', 'Recommendation'];
    const rows: string[][] = [];
    for (const f of findings) {
      if (f.resources.length === 0) {
        rows.push([f.severity, f.category, f.title, '', '', f.recommendation]);
      } else {
        for (const r of f.resources) {
          rows.push([f.severity, f.category, f.title, r.name || '', r.ocid, f.recommendation]);
        }
      }
    }
    downloadCSV(`audit-detail-${new Date().toISOString().slice(0, 10)}.csv`, [headers, ...rows]);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="btn-secondary text-sm flex items-center gap-1"
        disabled={findings.length === 0}
      >
        Export CSV
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
          <button onClick={exportSummary} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200">
            Export Summary
          </button>
          <button onClick={exportDetail} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200">
            Export Detail
          </button>
        </div>
      )}
    </div>
  );
}
