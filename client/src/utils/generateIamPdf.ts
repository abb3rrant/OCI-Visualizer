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

interface PdfOptions {
  findings: Finding[];
  snapshotName: string;
}

export async function generateIamPdf({ findings, snapshotName }: PdfOptions): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 20;

  function checkPage(needed: number) {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
  }

  // --- Cover page ---
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('IAM Security Analysis Report', pageWidth / 2, 60, { align: 'center' });

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

  const critical = findings.filter(f => f.severity === 'CRITICAL').length;
  const high = findings.filter(f => f.severity === 'HIGH').length;
  const medium = findings.filter(f => f.severity === 'MEDIUM').length;
  const low = findings.filter(f => f.severity === 'LOW').length;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Findings: ${findings.length}`, margin, y);
  y += 10;

  autoTable(doc, {
    startY: y,
    head: [['Severity', 'Count']],
    body: [
      ['Critical', String(critical)],
      ['High', String(high)],
      ['Medium', String(medium)],
      ['Low', String(low)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: margin, right: margin },
    styles: { fontSize: 10 },
  });

  y = (doc as any).lastAutoTable.finalY + 15;

  // --- Findings by Severity ---
  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
  const severityColors: Record<string, [number, number, number]> = {
    CRITICAL: [220, 38, 38],
    HIGH: [234, 88, 12],
    MEDIUM: [217, 119, 6],
    LOW: [37, 99, 235],
    INFO: [107, 114, 128],
  };

  const grouped = new Map<string, Finding[]>();
  for (const f of findings) {
    const existing = grouped.get(f.severity) || [];
    existing.push(f);
    grouped.set(f.severity, existing);
  }

  for (const severity of severityOrder) {
    const items = grouped.get(severity);
    if (!items || items.length === 0) continue;

    checkPage(25);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const [r, g, b] = severityColors[severity] || [0, 0, 0];
    doc.setTextColor(r, g, b);
    doc.text(`${severity} (${items.length})`, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 8;

    for (const finding of items) {
      checkPage(40);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      const titleText = finding.framework ? `[${finding.framework}] ${finding.title}` : finding.title;
      doc.text(titleText, margin, y);
      y += 5;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const descLines = doc.splitTextToSize(finding.description, pageWidth - margin * 2);
      doc.text(descLines, margin, y);
      y += descLines.length * 4 + 2;

      if (finding.attackPath.length > 0) {
        doc.setFont('helvetica', 'normal');
        const pathText = `Attack Path: ${finding.attackPath.join(' → ')}`;
        const pathLines = doc.splitTextToSize(pathText, pageWidth - margin * 2);
        doc.text(pathLines, margin, y);
        y += pathLines.length * 4 + 2;
      }

      doc.setFont('helvetica', 'italic');
      const recLines = doc.splitTextToSize(`Recommendation: ${finding.recommendation}`, pageWidth - margin * 2);
      doc.text(recLines, margin, y);
      y += recLines.length * 4 + 2;

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
  const cisFindings = findings.filter(f => f.framework);
  if (cisFindings.length > 0) {
    checkPage(30);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('CIS OCI Benchmark Compliance', margin, y);
    y += 12;

    autoTable(doc, {
      startY: y,
      head: [['CIS Control', 'Finding', 'Severity', 'Resources']],
      body: cisFindings.map(f => [
        f.framework || '',
        f.title,
        f.severity,
        String(f.resources.length),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [124, 58, 237] },
      styles: { fontSize: 9 },
      margin: { left: margin, right: margin },
    });
  }

  doc.save(`iam-report-${snapshotName.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
