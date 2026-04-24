import React, { useState, useRef, useEffect } from 'react';

interface Finding {
  id: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
  attackPath: string[];
  resources: { id: string; ocid: string; name: string | null }[];
  framework: string | null;
}

interface ExportIamButtonProps {
  findings: Finding[];
  snapshotName: string;
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

export default function ExportIamButton({ findings, snapshotName }: ExportIamButtonProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
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
    const headers = ['Severity', 'Title', 'CIS Control', 'Recommendation'];
    const rows = findings.map(f => [f.severity, f.title, f.framework || '', f.recommendation]);
    downloadCSV(`iam-summary-${new Date().toISOString().slice(0, 10)}.csv`, [headers, ...rows]);
    setOpen(false);
  };

  const exportDetail = () => {
    const headers = ['Severity', 'Title', 'CIS Control', 'Resource Name', 'OCID', 'Attack Path', 'Recommendation'];
    const rows: string[][] = [];
    for (const f of findings) {
      const attackPath = f.attackPath.join(' → ');
      if (f.resources.length === 0) {
        rows.push([f.severity, f.title, f.framework || '', '', '', attackPath, f.recommendation]);
      } else {
        for (const r of f.resources) {
          rows.push([f.severity, f.title, f.framework || '', r.name || '', r.ocid, attackPath, f.recommendation]);
        }
      }
    }
    downloadCSV(`iam-detail-${new Date().toISOString().slice(0, 10)}.csv`, [headers, ...rows]);
    setOpen(false);
  };

  const exportPdf = async () => {
    setGenerating(true);
    setOpen(false);
    try {
      const { generateIamPdf } = await import('../../utils/generateIamPdf');
      await generateIamPdf({ findings, snapshotName });
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="btn-secondary text-sm flex items-center gap-1"
        disabled={findings.length === 0 || generating}
      >
        {generating ? 'Generating...' : 'Export'}
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
          <button onClick={exportSummary} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200">
            Summary CSV
          </button>
          <button onClick={exportDetail} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200">
            Detail CSV
          </button>
          <button onClick={exportPdf} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200">
            PDF Report
          </button>
        </div>
      )}
    </div>
  );
}
