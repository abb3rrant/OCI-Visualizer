import React from 'react';
import type { GroupedAuditFinding } from '../../types';
import FindingsList from './FindingsList';

interface SecurityFindingsProps {
  findings: GroupedAuditFinding[];
}

const SECURITY_CATEGORIES = new Set([
  'Network Security',
  'Data Encryption',
  'Data Exposure',
  'IAM Security',
  'Secrets in userData',
]);

export default function SecurityFindings({ findings }: SecurityFindingsProps) {
  const securityFindings = findings.filter(f => SECURITY_CATEGORIES.has(f.category));
  return (
    <div>
      <h3 className="text-lg font-semibold mb-3 dark:text-gray-100">Security & Network Findings</h3>
      <FindingsList findings={securityFindings} />
    </div>
  );
}
