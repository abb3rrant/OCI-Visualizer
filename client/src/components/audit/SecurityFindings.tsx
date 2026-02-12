import React from 'react';
import type { AuditFinding } from '../../types';
import FindingsList from './FindingsList';

interface SecurityFindingsProps {
  findings: AuditFinding[];
}

export default function SecurityFindings({ findings }: SecurityFindingsProps) {
  const securityFindings = findings.filter(f => f.category === 'security' || f.category === 'networking');
  return (
    <div>
      <h3 className="text-lg font-semibold mb-3">Security & Network Findings</h3>
      <FindingsList findings={securityFindings} />
    </div>
  );
}
