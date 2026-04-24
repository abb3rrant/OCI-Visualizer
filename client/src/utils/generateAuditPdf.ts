import type { GroupedAuditFinding, AuditReport, Snapshot } from '../types';

interface PdfOptions {
  report: AuditReport;
  snapshotName: string;
}

export async function generateAuditPdf({ report, snapshotName }: PdfOptions): Promise<void> {
  // Lazy-load jspdf to avoid 300KB bundle hit
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 20;

  // Helper to add a new page if needed
  function checkPage(needed: number) {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
  }

  // --- Cover page ---
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('OCI Security Audit Report', pageWidth / 2, 60, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(snapshotName, pageWidth / 2, 75, { align: 'center' });

  doc.setFontSize(11);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })}`, pageWidth / 2, 90, { align: 'center' });

  doc.text('OCI Visualizer', pageWidth / 2, 105, { align: 'center' });

  // --- Executive Summary ---
  doc.addPage();
  y = 20;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', margin, y);
  y += 12;

  const { summary } = report;
  const totalFindings = summary.critical + summary.high + summary.medium + summary.low + summary.info;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Findings: ${totalFindings}`, margin, y);
  y += 10;

  // Severity summary table
  autoTable(doc, {
    startY: y,
    head: [['Severity', 'Count']],
    body: [
      ['Critical', String(summary.critical)],
      ['High', String(summary.high)],
      ['Medium', String(summary.medium)],
      ['Low', String(summary.low)],
      ['Info', String(summary.info)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: margin, right: margin },
    styles: { fontSize: 10 },
  });

  y = (doc as any).lastAutoTable.finalY + 15;

  // --- Detailed Findings ---
  checkPage(30);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Detailed Findings', margin, y);
  y += 12;

  // Group by severity order
  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
  const grouped = new Map<string, GroupedAuditFinding[]>();
  for (const f of report.groupedFindings) {
    const existing = grouped.get(f.severity) || [];
    existing.push(f);
    grouped.set(f.severity, existing);
  }

  const severityColors: Record<string, [number, number, number]> = {
    CRITICAL: [220, 38, 38],
    HIGH: [234, 88, 12],
    MEDIUM: [217, 119, 6],
    LOW: [37, 99, 235],
    INFO: [107, 114, 128],
  };

  for (const severity of severityOrder) {
    const findings = grouped.get(severity);
    if (!findings || findings.length === 0) continue;

    checkPage(25);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const [r, g, b] = severityColors[severity] || [0, 0, 0];
    doc.setTextColor(r, g, b);
    doc.text(`${severity} (${findings.length})`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 8;

    for (const finding of findings) {
      checkPage(40);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(finding.title, margin, y);
      y += 5;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const descLines = doc.splitTextToSize(finding.description, pageWidth - margin * 2);
      doc.text(descLines, margin, y);
      y += descLines.length * 4 + 2;

      doc.setFont('helvetica', 'italic');
      const recLines = doc.splitTextToSize(`Recommendation: ${finding.recommendation}`, pageWidth - margin * 2);
      doc.text(recLines, margin, y);
      y += recLines.length * 4 + 2;

      // Affected resources table (limited to 50)
      if (finding.resources.length > 0) {
        const resourceRows = finding.resources.slice(0, 50).map(r => [
          r.name || '(unnamed)',
          r.ocid.length > 50 ? r.ocid.slice(0, 20) + '...' + r.ocid.slice(-8) : r.ocid,
        ]);

        autoTable(doc, {
          startY: y,
          head: [['Name', 'OCID']],
          body: resourceRows,
          theme: 'striped',
          headStyles: { fillColor: [100, 116, 139], fontSize: 8 },
          styles: { fontSize: 7, cellPadding: 1.5 },
          margin: { left: margin, right: margin },
          columnStyles: { 1: { cellWidth: 70 } },
        });

        y = (doc as any).lastAutoTable.finalY + 8;
      }
      y += 4;
    }
  }

  // --- CIS Compliance Table ---
  const cisFindings = report.groupedFindings.filter(f => f.framework);
  if (cisFindings.length > 0) {
    checkPage(30);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('CIS Benchmark Compliance', margin, y);
    y += 12;

    autoTable(doc, {
      startY: y,
      head: [['CIS Control', 'Finding', 'Severity', 'Count']],
      body: cisFindings.map(f => [
        f.framework || '',
        f.title,
        f.severity,
        String(f.count),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [124, 58, 237] },
      styles: { fontSize: 9 },
      margin: { left: margin, right: margin },
    });
  }

  // Save
  doc.save(`audit-report-${snapshotName.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
