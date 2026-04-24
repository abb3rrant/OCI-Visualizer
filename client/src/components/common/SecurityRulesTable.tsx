import React, { useState } from 'react';

interface SecurityRule {
  direction: string;
  source?: string;
  destination?: string;
  protocol: string;
  tcpOptions?: { destinationPortRange?: { min: number; max: number }; sourcePortRange?: { min: number; max: number } };
  udpOptions?: { destinationPortRange?: { min: number; max: number }; sourcePortRange?: { min: number; max: number } };
  icmpOptions?: { type?: number; code?: number };
  isStateless?: boolean;
  description?: string;
}

const PROTOCOL_MAP: Record<string, string> = {
  '6': 'TCP',
  '17': 'UDP',
  '1': 'ICMP',
  '58': 'ICMPv6',
  'all': 'All',
};

function formatProtocol(p: string): string {
  return PROTOCOL_MAP[p] || PROTOCOL_MAP[p?.toLowerCase()] || p;
}

function formatPortRange(rule: SecurityRule): string {
  const proto = rule.protocol;
  if (proto === '6' && rule.tcpOptions?.destinationPortRange) {
    const { min, max } = rule.tcpOptions.destinationPortRange;
    return min === max ? String(min) : `${min}-${max}`;
  }
  if (proto === '17' && rule.udpOptions?.destinationPortRange) {
    const { min, max } = rule.udpOptions.destinationPortRange;
    return min === max ? String(min) : `${min}-${max}`;
  }
  if (proto === '1' && rule.icmpOptions) {
    const parts = [];
    if (rule.icmpOptions.type != null) parts.push(`type ${rule.icmpOptions.type}`);
    if (rule.icmpOptions.code != null) parts.push(`code ${rule.icmpOptions.code}`);
    return parts.join(', ') || 'All';
  }
  return 'All';
}

interface SecurityRulesTableProps {
  rawData: any;
  resourceType: string;
}

export default function SecurityRulesTable({ rawData, resourceType }: SecurityRulesTableProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (!rawData) return null;

  let rules: SecurityRule[] = [];

  if (resourceType === 'network/security-list') {
    const ingress = (rawData.ingressSecurityRules || []).map((r: any) => ({ ...r, direction: 'Ingress' }));
    const egress = (rawData.egressSecurityRules || []).map((r: any) => ({ ...r, direction: 'Egress' }));
    rules = [...ingress, ...egress];
  } else if (resourceType === 'network/nsg') {
    rules = (rawData.rules || rawData.securityRules || []).map((r: any) => ({
      ...r,
      direction: r.direction || 'Unknown',
    }));
  }

  if (rules.length === 0) return null;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <span>Security Rules ({rules.length})</span>
        <svg
          className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400 uppercase">Dir</th>
                <th className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400 uppercase">CIDR</th>
                <th className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400 uppercase">Protocol</th>
                <th className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400 uppercase">Port Range</th>
                <th className="px-2 py-1.5 text-left font-medium text-gray-500 dark:text-gray-400 uppercase">Stateless</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {rules.map((rule, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      rule.direction === 'Ingress' || rule.direction === 'INGRESS'
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                        : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                    }`}>
                      {rule.direction}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 font-mono text-gray-600 dark:text-gray-400">
                    {rule.source || rule.destination || 'Any'}
                  </td>
                  <td className="px-2 py-1.5 text-gray-600 dark:text-gray-400">{formatProtocol(rule.protocol)}</td>
                  <td className="px-2 py-1.5 font-mono text-gray-600 dark:text-gray-400">{formatPortRange(rule)}</td>
                  <td className="px-2 py-1.5">
                    {rule.isStateless && (
                      <span className="inline-block px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-[10px] font-medium text-gray-600 dark:text-gray-400">
                        Stateless
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
