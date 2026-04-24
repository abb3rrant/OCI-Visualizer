import React, { useState, useMemo } from 'react';
import { useQuery } from 'urql';
import { useSnapshot } from '../contexts/SnapshotContext';
import { useDetailPanel } from '../contexts/DetailPanelContext';
import { NETWORK_RESOURCES_QUERY, COMPARTMENTS_QUERY } from '../graphql/queries';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseRaw(resource: any): Record<string, any> {
  if (!resource?.rawData) return {};
  if (typeof resource.rawData === 'string') {
    try { return JSON.parse(resource.rawData); } catch { return {}; }
  }
  return resource.rawData;
}

function formatProtocol(proto: string | undefined | null): string {
  if (!proto) return '—';
  const p = String(proto).toLowerCase();
  if (p === '6') return 'TCP';
  if (p === '17') return 'UDP';
  if (p === '1') return 'ICMP';
  if (p === 'all' || p === '0') return 'ALL';
  return proto;
}

function formatPortRange(opts: any): string {
  if (!opts) return 'ALL';
  const range = opts.destinationPortRange || opts.sourcePortRange;
  if (!range) return 'ALL';
  const { min, max } = range;
  if (min === max) return String(min);
  return `${min}–${max}`;
}

function protocolBadgeColor(proto: string): string {
  switch (proto) {
    case 'TCP': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'UDP': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
    case 'ICMP': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'ALL': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

function useNetworkQuery(snapshotId: string, resourceType: string, pause: boolean) {
  const [result] = useQuery({
    query: NETWORK_RESOURCES_QUERY,
    variables: { filter: { snapshotId, resourceType, first: 500 } },
    pause,
  });
  const nodes = useMemo(
    () => (result.data?.resources?.edges || []).map((e: any) => e.node),
    [result.data],
  );
  return { nodes, fetching: result.fetching };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type TabId = 'subnets' | 'gateways' | 'loadbalancers' | 'publicips' | 'security' | 'routing' | 'nsgs' | 'dns';
const TABS: { id: TabId; label: string }[] = [
  { id: 'subnets', label: 'Subnets' },
  { id: 'gateways', label: 'Gateways' },
  { id: 'loadbalancers', label: 'Load Balancers' },
  { id: 'publicips', label: 'Public IPs' },
  { id: 'security', label: 'Security' },
  { id: 'routing', label: 'Routing' },
  { id: 'nsgs', label: 'NSGs' },
  { id: 'dns', label: 'DNS' },
];

function VcnCard({
  resource,
  selected,
  onClick,
}: {
  resource: any;
  selected: boolean;
  onClick: () => void;
}) {
  const raw = parseRaw(resource);
  const cidrs: string[] = raw.cidrBlocks || raw.cidrBlock ? (raw.cidrBlocks || [raw.cidrBlock]) : [];

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
      }`}
    >
      <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
        {resource.displayName || 'Unnamed VCN'}
      </div>
      {cidrs.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {cidrs.map((c: string, i: number) => (
            <span key={i} className="text-xs font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              {c}
            </span>
          ))}
        </div>
      )}
      {resource.lifecycleState && (
        <span className="mt-1 inline-block text-xs text-gray-500 dark:text-gray-400">
          {resource.lifecycleState}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Subnets Tab
// ---------------------------------------------------------------------------

function SubnetsTab({ subnets, dhcpOptionsMap, onClickResource }: { subnets: any[]; dhcpOptionsMap: Map<string, any>; onClickResource: (id: string) => void }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  if (subnets.length === 0) return <p className="text-sm text-gray-400 dark:text-gray-500">No subnets found</p>;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">CIDR</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Access</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">AD</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">State</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {subnets.map((s: any) => {
            const raw = parseRaw(s);
            const isPublic = raw.prohibitInternetIngress === false || raw.prohibitPublicIpOnVnic === false;
            const isExpanded = expanded.has(s.id);
            return (
              <React.Fragment key={s.id}>
                <tr
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => toggle(s.id)}
                >
                  <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100 font-medium">
                    <button
                      onClick={(e) => { e.stopPropagation(); onClickResource(s.id); }}
                      className="hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-[200px] block"
                      title="Open in detail panel"
                    >
                      {s.displayName || 'Unnamed'}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-sm font-mono text-gray-600 dark:text-gray-400">{raw.cidrBlock || '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      isPublic
                        ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    }`}>
                      {isPublic ? 'PUBLIC' : 'PRIVATE'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{s.availabilityDomain || 'Regional'}</td>
                  <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">{s.lifecycleState || '—'}</td>
                </tr>
                {isExpanded && (
                  <tr className="bg-gray-50 dark:bg-gray-900">
                    <td colSpan={5} className="px-6 py-3">
                      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        {raw.securityListIds && (
                          <div>
                            <dt className="text-xs text-gray-400 dark:text-gray-500 font-medium">Security Lists</dt>
                            <dd className="font-mono text-xs text-gray-600 dark:text-gray-400 break-all">{(raw.securityListIds || []).length} attached</dd>
                          </div>
                        )}
                        {raw.routeTableId && (
                          <div>
                            <dt className="text-xs text-gray-400 dark:text-gray-500 font-medium">Route Table</dt>
                            <dd className="font-mono text-xs text-gray-600 dark:text-gray-400 break-all">{raw.routeTableId}</dd>
                          </div>
                        )}
                        {raw.dnsLabel && (
                          <div>
                            <dt className="text-xs text-gray-400 dark:text-gray-500 font-medium">DNS Label</dt>
                            <dd className="text-gray-600 dark:text-gray-400">{raw.dnsLabel}</dd>
                          </div>
                        )}
                        {raw.dhcpOptionsId && (() => {
                          const dhcp = dhcpOptionsMap.get(raw.dhcpOptionsId);
                          const dhcpRaw = dhcp ? parseRaw(dhcp) : null;
                          const options: any[] = dhcpRaw?.options || [];
                          return (
                            <div className="col-span-2">
                              <dt className="text-xs text-gray-400 dark:text-gray-500 font-medium">DHCP Options</dt>
                              <dd className="text-xs text-gray-600 dark:text-gray-400">
                                <span className="font-medium">{dhcp?.displayName || 'Unknown'}</span>
                                {options.length > 0 && (
                                  <ul className="mt-1 space-y-0.5">
                                    {options.map((opt: any, oi: number) => (
                                      <li key={oi} className="font-mono text-xs">
                                        {opt.type === 'DomainNameServer' && <>DNS: {opt.serverType}{opt.customDnsServers?.length > 0 && ` (${opt.customDnsServers.join(', ')})`}</>}
                                        {opt.type === 'SearchDomain' && <>Search: {(opt.searchDomainNames || []).join(', ')}</>}
                                        {opt.type !== 'DomainNameServer' && opt.type !== 'SearchDomain' && <>{opt.type}</>}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </dd>
                            </div>
                          );
                        })()}
                      </dl>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gateways Tab
// ---------------------------------------------------------------------------

const GATEWAY_TYPE_LABELS: Record<string, string> = {
  'network/internet-gateway': 'Internet Gateway',
  'network/nat-gateway': 'NAT Gateway',
  'network/service-gateway': 'Service Gateway',
  'network/local-peering-gateway': 'Local Peering Gateway',
};

function GatewaysTab({ gateways, drgAttachments, allVcns, onClickResource }: { gateways: any[]; drgAttachments: any[]; allVcns: any[]; onClickResource: (id: string) => void }) {
  const [expandedDrg, setExpandedDrg] = useState<string | null>(null);

  // Build VCN OCID -> name map for LPG peer resolution
  const vcnNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of allVcns) map.set(v.ocid, v.displayName || 'Unnamed VCN');
    return map;
  }, [allVcns]);

  if (gateways.length === 0 && drgAttachments.length === 0) return <p className="text-sm text-gray-400 dark:text-gray-500">No gateways found</p>;

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const gw of gateways) {
      const type = gw.resourceType as string;
      if (!map.has(type)) map.set(type, []);
      map.get(type)!.push(gw);
    }
    return map;
  }, [gateways]);

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([type, items]) => (
        <div key={type} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{GATEWAY_TYPE_LABELS[type] || type}</span>
            <span className="ml-2 text-xs text-gray-400">{items.length}</span>
          </div>
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {items.map((gw: any) => {
                const raw = parseRaw(gw);
                const enabled = raw.isEnabled !== false && raw.blockTraffic !== true;
                let detail = '';
                if (type === 'network/nat-gateway' && raw.natIp) detail = `IP: ${raw.natIp}`;
                if (type === 'network/service-gateway' && raw.services) {
                  detail = (raw.services as any[]).map((s: any) => s.serviceName || s.serviceId).join(', ');
                }
                if (type === 'network/local-peering-gateway') {
                  const peerVcnName = raw.peerAdvertisedCidr ? raw.peerAdvertisedCidr : '';
                  const peerStatus = raw.peeringStatus || '';
                  const isCrossTenancy = raw.isCrossTenancyPeering === true;
                  detail = [peerStatus, peerVcnName, isCrossTenancy ? '(cross-tenancy)' : ''].filter(Boolean).join(' · ');
                }
                return (
                  <tr key={gw.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-2 text-sm">
                      <button
                        onClick={() => onClickResource(gw.id)}
                        className="text-gray-900 dark:text-gray-100 font-medium hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {gw.displayName || 'Unnamed'}
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        enabled
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {enabled ? 'ENABLED' : 'BLOCKED'}
                      </span>
                      {type === 'network/local-peering-gateway' && raw.isCrossTenancyPeering && (
                        <span className="ml-1 text-xs font-semibold px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">CROSS-TENANCY</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{detail || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* DRG Attachments */}
      {drgAttachments.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">DRG Attachments</span>
            <span className="ml-2 text-xs text-gray-400">{drgAttachments.length}</span>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {drgAttachments.map((att: any) => {
              const raw = parseRaw(att);
              const isOpen = expandedDrg === att.id;
              return (
                <div key={att.id}>
                  <button
                    onClick={() => setExpandedDrg(isOpen ? null : att.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg className={`w-4 h-4 transition-transform text-gray-400 ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <button
                        onClick={(e) => { e.stopPropagation(); onClickResource(att.id); }}
                        className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {att.displayName || 'Unnamed DRG Attachment'}
                      </button>
                      <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                        {raw.attachmentType || 'VCN'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{att.lifecycleState || '—'}</span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-3">
                      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                        <div>
                          <dt className="text-xs text-gray-400 dark:text-gray-500 font-medium">DRG ID</dt>
                          <dd className="font-mono text-xs text-gray-600 dark:text-gray-400 break-all">{raw.drgId || '—'}</dd>
                        </div>
                        {raw.drgRouteTableId && (
                          <div>
                            <dt className="text-xs text-gray-400 dark:text-gray-500 font-medium">DRG Route Table</dt>
                            <dd className="font-mono text-xs text-gray-600 dark:text-gray-400 break-all">{raw.drgRouteTableId}</dd>
                          </div>
                        )}
                        {raw.routeTableId && (
                          <div>
                            <dt className="text-xs text-gray-400 dark:text-gray-500 font-medium">VCN Route Table</dt>
                            <dd className="font-mono text-xs text-gray-600 dark:text-gray-400 break-all">{raw.routeTableId}</dd>
                          </div>
                        )}
                        {raw.networkDetails && (
                          <div>
                            <dt className="text-xs text-gray-400 dark:text-gray-500 font-medium">Network Details</dt>
                            <dd className="text-xs text-gray-600 dark:text-gray-400">
                              Type: {raw.networkDetails.type || '—'}
                              {raw.networkDetails.vcnRouteType && ` · Route type: ${raw.networkDetails.vcnRouteType}`}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Load Balancers Tab
// ---------------------------------------------------------------------------

function LoadBalancersTab({ loadBalancers, onClickResource }: { loadBalancers: any[]; onClickResource: (id: string) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loadBalancers.length === 0) return <p className="text-sm text-gray-400 dark:text-gray-500">No load balancers found for this VCN</p>;

  return (
    <div className="space-y-3">
      {loadBalancers.map((lb: any) => {
        const raw = parseRaw(lb);
        const isNlb = lb.resourceType === 'network/network-load-balancer';
        const isPublic = raw.isPublic === true;
        const isOpen = expandedId === lb.id;
        const ipAddresses: any[] = raw.ipAddresses || [];
        const listeners: any[] = raw.listeners ? Object.values(raw.listeners) : [];
        const backendSets: any[] = raw.backendSets ? Object.entries(raw.backendSets) : [];

        return (
          <div key={lb.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedId(isOpen ? null : lb.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <svg className={`w-4 h-4 transition-transform text-gray-400 ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <button
                  onClick={(e) => { e.stopPropagation(); onClickResource(lb.id); }}
                  className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {lb.displayName || 'Unnamed'}
                </button>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isNlb ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                  {isNlb ? 'NLB' : 'LB'}
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${isPublic ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                  {isPublic ? 'PUBLIC' : 'PRIVATE'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                {raw.shapeName && <span>{raw.shapeName}</span>}
                <span>{listeners.length} listener{listeners.length !== 1 ? 's' : ''}</span>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 space-y-4">
                {/* IP Addresses */}
                {ipAddresses.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">IP Addresses</h4>
                    <div className="flex flex-wrap gap-2">
                      {ipAddresses.map((ip: any, i: number) => (
                        <span key={i} className="text-xs font-mono px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {ip.ipAddress || ip}
                          {ip.isPublic && <span className="ml-1 text-orange-600 dark:text-orange-400">(public)</span>}
                          {ip.isPublic === false && <span className="ml-1 text-green-600 dark:text-green-400">(private)</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Listeners */}
                {listeners.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Listeners</h4>
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-400 dark:text-gray-500 uppercase">
                          <th className="text-left py-1 pr-3">Name</th>
                          <th className="text-left py-1 pr-3">Port</th>
                          <th className="text-left py-1 pr-3">Protocol</th>
                          <th className="text-left py-1">Backend Set</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listeners.map((l: any, i: number) => (
                          <tr key={i}>
                            <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">{l.name || '—'}</td>
                            <td className="py-1 pr-3 font-mono text-gray-600 dark:text-gray-400">{l.port || '—'}</td>
                            <td className="py-1 pr-3">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                {l.protocol || '—'}
                              </span>
                            </td>
                            <td className="py-1 text-xs text-gray-600 dark:text-gray-400">{l.defaultBackendSetName || l.backendSetName || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Backend Sets */}
                {backendSets.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Backend Sets</h4>
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-400 dark:text-gray-500 uppercase">
                          <th className="text-left py-1 pr-3">Name</th>
                          <th className="text-left py-1 pr-3">Policy</th>
                          <th className="text-left py-1 pr-3">Backends</th>
                          <th className="text-left py-1">Health Check</th>
                        </tr>
                      </thead>
                      <tbody>
                        {backendSets.map(([name, bs]: [string, any], i: number) => {
                          const backends: any[] = bs.backends || [];
                          const hc = bs.healthChecker || {};
                          return (
                            <tr key={i}>
                              <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">{name}</td>
                              <td className="py-1 pr-3 text-xs text-gray-600 dark:text-gray-400">{bs.policy || '—'}</td>
                              <td className="py-1 pr-3 text-xs text-gray-600 dark:text-gray-400">{backends.length} member{backends.length !== 1 ? 's' : ''}</td>
                              <td className="py-1 text-xs font-mono text-gray-600 dark:text-gray-400">
                                {hc.protocol && `${hc.protocol}:${hc.port || ''}${hc.urlPath || ''}`}
                                {!hc.protocol && '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public IPs Tab
// ---------------------------------------------------------------------------

function PublicIpsTab({ publicIps, resourceNameMap, onClickResource }: { publicIps: any[]; resourceNameMap: Map<string, string>; onClickResource: (id: string) => void }) {
  if (publicIps.length === 0) return <p className="text-sm text-gray-400 dark:text-gray-500">No public IPs found for this VCN</p>;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">IP Address</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Scope</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Lifetime</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Assigned To</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">State</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {publicIps.map((pip: any) => {
            const raw = parseRaw(pip);
            const assignedName = raw.assignedEntityId ? (resourceNameMap.get(raw.assignedEntityId) || 'Unknown') : '—';
            return (
              <tr key={pip.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-4 py-2 text-sm">
                  <button
                    onClick={() => onClickResource(pip.id)}
                    className="text-gray-900 dark:text-gray-100 font-medium hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    {pip.displayName || 'Unnamed'}
                  </button>
                </td>
                <td className="px-4 py-2 text-sm font-mono text-gray-600 dark:text-gray-400">{raw.ipAddress || '—'}</td>
                <td className="px-4 py-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    {raw.scope || '—'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    raw.lifetime === 'RESERVED'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {raw.lifetime || '—'}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{assignedName}</td>
                <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">{pip.lifecycleState || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Security Tab
// ---------------------------------------------------------------------------

function SecurityTab({ securityLists, onClickResource }: { securityLists: any[]; onClickResource: (id: string) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (securityLists.length === 0) return <p className="text-sm text-gray-400 dark:text-gray-500">No security lists found</p>;

  return (
    <div className="space-y-3">
      {securityLists.map((sl: any) => {
        const raw = parseRaw(sl);
        const ingress: any[] = raw.ingressSecurityRules || [];
        const egress: any[] = raw.egressSecurityRules || [];
        const isOpen = expandedId === sl.id;

        return (
          <div key={sl.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedId(isOpen ? null : sl.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <svg className={`w-4 h-4 transition-transform text-gray-400 ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <button
                  onClick={(e) => { e.stopPropagation(); onClickResource(sl.id); }}
                  className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {sl.displayName || 'Unnamed'}
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                <span>{ingress.length} ingress</span>
                <span>·</span>
                <span>{egress.length} egress</span>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 space-y-4">
                {ingress.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Ingress Rules</h4>
                    <SecurityRulesTable rules={ingress} direction="ingress" />
                  </div>
                )}
                {egress.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Egress Rules</h4>
                    <SecurityRulesTable rules={egress} direction="egress" />
                  </div>
                )}
                {ingress.length === 0 && egress.length === 0 && (
                  <p className="text-sm text-gray-400">No rules</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SecurityRulesTable({ rules, direction }: { rules: any[]; direction: 'ingress' | 'egress' }) {
  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="text-xs text-gray-400 dark:text-gray-500 uppercase">
          <th className="text-left py-1 pr-3">Protocol</th>
          <th className="text-left py-1 pr-3">{direction === 'ingress' ? 'Source' : 'Destination'}</th>
          <th className="text-left py-1 pr-3">Ports</th>
          <th className="text-left py-1">Flags</th>
        </tr>
      </thead>
      <tbody>
        {rules.map((rule: any, i: number) => {
          const proto = formatProtocol(rule.protocol);
          const cidr = rule.source || rule.destination || '—';
          const isWideOpen = direction === 'ingress' && cidr === '0.0.0.0/0';
          const ports = proto === 'TCP'
            ? formatPortRange(rule.tcpOptions)
            : proto === 'UDP'
              ? formatPortRange(rule.udpOptions)
              : '—';
          return (
            <tr key={i} className={isWideOpen ? 'bg-red-50 dark:bg-red-900/10' : ''}>
              <td className="py-1 pr-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${protocolBadgeColor(proto)}`}>{proto}</span>
              </td>
              <td className={`py-1 pr-3 font-mono text-xs ${isWideOpen ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-600 dark:text-gray-400'}`}>
                {cidr}
              </td>
              <td className="py-1 pr-3 font-mono text-xs text-gray-600 dark:text-gray-400">{ports}</td>
              <td className="py-1 text-xs text-gray-400">
                {rule.isStateless && <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700">stateless</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Routing Tab
// ---------------------------------------------------------------------------

function RoutingTab({ routeTables, drgRouteTables, drgRouteRulesByTable, onClickResource }: {
  routeTables: any[];
  drgRouteTables: any[];
  drgRouteRulesByTable: Map<string, any[]>;
  onClickResource: (id: string) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDrgRtId, setExpandedDrgRtId] = useState<string | null>(null);

  if (routeTables.length === 0 && drgRouteTables.length === 0) return <p className="text-sm text-gray-400 dark:text-gray-500">No route tables found</p>;

  return (
    <div className="space-y-6">
      {/* VCN Route Tables */}
      {routeTables.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">VCN Route Tables</h3>
          {routeTables.map((rt: any) => {
            const raw = parseRaw(rt);
            const rules: any[] = raw.routeRules || [];
            const isOpen = expandedId === rt.id;

            return (
              <div key={rt.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedId(isOpen ? null : rt.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <svg className={`w-4 h-4 transition-transform text-gray-400 ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <button
                      onClick={(e) => { e.stopPropagation(); onClickResource(rt.id); }}
                      className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {rt.displayName || 'Unnamed'}
                    </button>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{rules.length} rule{rules.length !== 1 ? 's' : ''}</span>
                </button>
                {isOpen && (
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    {rules.length > 0 ? (
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-400 dark:text-gray-500 uppercase bg-gray-50 dark:bg-gray-900">
                            <th className="px-4 py-2 text-left">Destination</th>
                            <th className="px-4 py-2 text-left">Target Type</th>
                            <th className="px-4 py-2 text-left">Target</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {rules.map((rule: any, i: number) => (
                            <tr key={i}>
                              <td className="px-4 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                                {rule.destination || rule.cidrBlock || '—'}
                              </td>
                              <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400">
                                {rule.destinationType || '—'}
                              </td>
                              <td className="px-4 py-2 font-mono text-xs text-gray-600 dark:text-gray-400 break-all">
                                {rule.networkEntityId || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="px-4 py-3 text-sm text-gray-400">No route rules</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* DRG Route Tables */}
      {drgRouteTables.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">DRG Route Tables</h3>
          {drgRouteTables.map((drt: any) => {
            const raw = parseRaw(drt);
            const rules = drgRouteRulesByTable.get(drt.ocid) || [];
            const isOpen = expandedDrgRtId === drt.id;

            return (
              <div key={drt.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedDrgRtId(isOpen ? null : drt.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <svg className={`w-4 h-4 transition-transform text-gray-400 ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <button
                      onClick={(e) => { e.stopPropagation(); onClickResource(drt.id); }}
                      className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {drt.displayName || 'Unnamed DRG Route Table'}
                    </button>
                    <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">DRG</span>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{rules.length} rule{rules.length !== 1 ? 's' : ''}</span>
                </button>
                {isOpen && (
                  <div className="border-t border-gray-200 dark:border-gray-700">
                    {rules.length > 0 ? (
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-400 dark:text-gray-500 uppercase bg-gray-50 dark:bg-gray-900">
                            <th className="px-4 py-2 text-left">Destination</th>
                            <th className="px-4 py-2 text-left">Dest Type</th>
                            <th className="px-4 py-2 text-left">Next Hop</th>
                            <th className="px-4 py-2 text-left">Route Type</th>
                            <th className="px-4 py-2 text-left">Flags</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {rules.map((rule: any, i: number) => {
                            const isConflict = rule.isConflict === true;
                            const isBlackhole = rule.isBlackhole === true;
                            return (
                              <tr key={i} className={isConflict ? 'bg-red-50 dark:bg-red-900/10' : isBlackhole ? 'bg-gray-50 dark:bg-gray-900' : ''}>
                                <td className="px-4 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                                  {rule.destination || '—'}
                                </td>
                                <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400">
                                  {rule.destinationType || '—'}
                                </td>
                                <td className="px-4 py-2 font-mono text-xs text-gray-600 dark:text-gray-400 break-all">
                                  {rule.nextHopDrgAttachmentId || '—'}
                                </td>
                                <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400">
                                  {rule.routeType || '—'}
                                </td>
                                <td className="px-4 py-2 text-xs space-x-1">
                                  {isConflict && <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 font-semibold">CONFLICT</span>}
                                  {isBlackhole && <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-100 dark:bg-gray-600 dark:text-gray-200 font-semibold">BLACKHOLE</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <p className="px-4 py-3 text-sm text-gray-400">No route rules</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NSGs Tab
// ---------------------------------------------------------------------------

function NsgsTab({ nsgs, nsgRules, onClickResource }: { nsgs: any[]; nsgRules: any[]; onClickResource: (id: string) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const rulesByNsg = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const rule of nsgRules) {
      const raw = parseRaw(rule);
      const nsgId = raw.networkSecurityGroupId;
      if (!nsgId) continue;
      if (!map.has(nsgId)) map.set(nsgId, []);
      map.get(nsgId)!.push(raw);
    }
    return map;
  }, [nsgRules]);

  if (nsgs.length === 0) return <p className="text-sm text-gray-400 dark:text-gray-500">No NSGs found</p>;

  return (
    <div className="space-y-3">
      {nsgs.map((nsg: any) => {
        const rules = rulesByNsg.get(nsg.ocid) || [];
        const ingress = rules.filter((r: any) => r.direction === 'INGRESS');
        const egress = rules.filter((r: any) => r.direction === 'EGRESS');
        const isOpen = expandedId === nsg.id;

        return (
          <div key={nsg.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedId(isOpen ? null : nsg.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <svg className={`w-4 h-4 transition-transform text-gray-400 ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <button
                  onClick={(e) => { e.stopPropagation(); onClickResource(nsg.id); }}
                  className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {nsg.displayName || 'Unnamed'}
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                <span>{ingress.length} ingress</span>
                <span>·</span>
                <span>{egress.length} egress</span>
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 space-y-4">
                {ingress.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Ingress Rules</h4>
                    <NsgRulesTable rules={ingress} direction="ingress" />
                  </div>
                )}
                {egress.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Egress Rules</h4>
                    <NsgRulesTable rules={egress} direction="egress" />
                  </div>
                )}
                {rules.length === 0 && (
                  <p className="text-sm text-gray-400">No rules</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NsgRulesTable({ rules, direction }: { rules: any[]; direction: 'ingress' | 'egress' }) {
  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="text-xs text-gray-400 dark:text-gray-500 uppercase">
          <th className="text-left py-1 pr-3">Protocol</th>
          <th className="text-left py-1 pr-3">{direction === 'ingress' ? 'Source' : 'Destination'}</th>
          <th className="text-left py-1 pr-3">Ports</th>
          <th className="text-left py-1">Flags</th>
        </tr>
      </thead>
      <tbody>
        {rules.map((rule: any, i: number) => {
          const proto = formatProtocol(rule.protocol);
          const cidr = rule.source || rule.destination || '—';
          const isWideOpen = direction === 'ingress' && cidr === '0.0.0.0/0';
          const ports = proto === 'TCP'
            ? formatPortRange(rule.tcpOptions)
            : proto === 'UDP'
              ? formatPortRange(rule.udpOptions)
              : '—';
          return (
            <tr key={i} className={isWideOpen ? 'bg-red-50 dark:bg-red-900/10' : ''}>
              <td className="py-1 pr-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${protocolBadgeColor(proto)}`}>{proto}</span>
              </td>
              <td className={`py-1 pr-3 font-mono text-xs ${isWideOpen ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-600 dark:text-gray-400'}`}>
                {cidr}
              </td>
              <td className="py-1 pr-3 font-mono text-xs text-gray-600 dark:text-gray-400">{ports}</td>
              <td className="py-1 text-xs text-gray-400">
                {rule.isStateless && <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700">stateless</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// DNS Tab
// ---------------------------------------------------------------------------

function DnsRecordTypeBadge({ rtype }: { rtype: string }) {
  const colors: Record<string, string> = {
    A: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    AAAA: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    CNAME: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    MX: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    NS: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    SOA: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    TXT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    SRV: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  };
  const color = colors[rtype] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded ${color}`}>{rtype}</span>;
}

function SteeringTemplateBadge({ template }: { template: string }) {
  const colors: Record<string, string> = {
    FAILOVER: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    LOAD_BALANCE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    ROUTE_BY_GEO: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    ROUTE_BY_ASN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    ROUTE_BY_IP: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    CUSTOM: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };
  const color = colors[template] || 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded ${color}`}>{template}</span>;
}

function DnsTab({
  vcn,
  subnets,
  dnsZones,
  dnsRecords,
  dnsResolvers,
  dnsViews,
  dnsResolverEndpoints,
  steeringPolicies,
  steeringAttachments,
  tsigKeys,
  onClickResource,
}: {
  vcn: any;
  subnets: any[];
  dnsZones: any[];
  dnsRecords: any[];
  dnsResolvers: any[];
  dnsViews: any[];
  dnsResolverEndpoints: any[];
  steeringPolicies: any[];
  steeringAttachments: any[];
  tsigKeys: any[];
  onClickResource: (id: string) => void;
}) {
  const vcnRaw = parseRaw(vcn);
  const vcnDnsLabel = vcnRaw.dnsLabel;
  const vcnDomainName = vcnRaw.vcnDomainName;
  const vcnOcid = vcn.ocid;
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());

  const toggleZone = (id: string) => setExpandedZones(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const subnetDnsEntries = useMemo(() =>
    subnets
      .map((s: any) => {
        const raw = parseRaw(s);
        return { id: s.id, name: s.displayName, dnsLabel: raw.dnsLabel, domainName: raw.subnetDomainName };
      })
      .filter((e) => e.dnsLabel || e.domainName),
    [subnets],
  );

  // Filter resolvers attached to this VCN
  const vcnResolvers = useMemo(() =>
    dnsResolvers.filter((r: any) => parseRaw(r).attachedVcnId === vcnOcid),
    [dnsResolvers, vcnOcid],
  );

  // Group records by zone OCID
  const recordsByZone = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const rec of dnsRecords) {
      const raw = parseRaw(rec);
      const zoneId = raw.zoneNameOrId || '';
      if (!map.has(zoneId)) map.set(zoneId, []);
      map.get(zoneId)!.push(rec);
    }
    return map;
  }, [dnsRecords]);

  // Build attachment lookup: steeringPolicyId -> domain names
  const attachmentsByPolicy = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const att of steeringAttachments) {
      const raw = parseRaw(att);
      const policyId = raw.steeringPolicyId;
      if (!policyId) continue;
      if (!map.has(policyId)) map.set(policyId, []);
      if (raw.domainName) map.get(policyId)!.push(raw.domainName);
    }
    return map;
  }, [steeringAttachments]);

  const hasDnsInfo = vcnDnsLabel || vcnDomainName || subnetDnsEntries.length > 0 || dnsZones.length > 0
    || vcnResolvers.length > 0 || dnsViews.length > 0 || dnsResolverEndpoints.length > 0
    || steeringPolicies.length > 0 || tsigKeys.length > 0;

  if (!hasDnsInfo) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">No DNS information available for this VCN</p>;
  }

  return (
    <div className="space-y-6">
      {/* VCN DNS info */}
      {(vcnDnsLabel || vcnDomainName) && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">VCN DNS Configuration</h3>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {vcnDnsLabel && (
              <div>
                <dt className="text-xs text-gray-400 dark:text-gray-500 font-medium">DNS Label</dt>
                <dd className="font-mono text-gray-700 dark:text-gray-300 mt-0.5">{vcnDnsLabel}</dd>
              </div>
            )}
            {vcnDomainName && (
              <div>
                <dt className="text-xs text-gray-400 dark:text-gray-500 font-medium">VCN Domain Name</dt>
                <dd className="font-mono text-gray-700 dark:text-gray-300 mt-0.5">{vcnDomainName}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Subnet DNS labels */}
      {subnetDnsEntries.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Subnet DNS Labels</h3>
          </div>
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subnet</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">DNS Label</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Domain Name</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {subnetDnsEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-2 text-sm">
                    <button
                      onClick={() => onClickResource(entry.id)}
                      className="text-gray-900 dark:text-gray-100 font-medium hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {entry.name || 'Unnamed'}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-sm font-mono text-gray-600 dark:text-gray-400">{entry.dnsLabel || '—'}</td>
                  <td className="px-4 py-2 text-sm font-mono text-gray-600 dark:text-gray-400">{entry.domainName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* VCN Resolver */}
      {vcnResolvers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">VCN Resolver</h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {vcnResolvers.map((resolver: any) => {
              const raw = parseRaw(resolver);
              const endpoints: any[] = raw.endpoints || [];
              return (
                <div key={resolver.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onClickResource(resolver.id)}
                      className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {resolver.displayName || 'Unnamed Resolver'}
                    </button>
                    {resolver.lifecycleState && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">{resolver.lifecycleState}</span>
                    )}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                    {raw.defaultViewId && (
                      <div>
                        <dt className="text-gray-400 dark:text-gray-500">Default View</dt>
                        <dd className="font-mono text-gray-600 dark:text-gray-400 truncate">{raw.defaultViewId}</dd>
                      </div>
                    )}
                  </dl>
                  {endpoints.length > 0 && (
                    <div>
                      <dt className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-1">Endpoints</dt>
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 dark:text-gray-500 uppercase">
                            <th className="text-left py-1 pr-3">Name</th>
                            <th className="text-left py-1 pr-3">Type</th>
                            <th className="text-left py-1 pr-3">Forwarding</th>
                            <th className="text-left py-1">Listening</th>
                          </tr>
                        </thead>
                        <tbody>
                          {endpoints.map((ep: any, i: number) => (
                            <tr key={i}>
                              <td className="py-1 pr-3 text-gray-700 dark:text-gray-300">{ep.name || '—'}</td>
                              <td className="py-1 pr-3 text-gray-600 dark:text-gray-400">{ep.endpointType || '—'}</td>
                              <td className="py-1 pr-3 font-mono text-gray-600 dark:text-gray-400">{ep.forwardingAddress || '—'}</td>
                              <td className="py-1 font-mono text-gray-600 dark:text-gray-400">{ep.listeningAddress || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DNS Zones with Records */}
      {dnsZones.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              DNS Zones
              <span className="ml-2 text-xs font-normal text-gray-400">{dnsZones.length} zone{dnsZones.length !== 1 ? 's' : ''}</span>
            </h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {dnsZones.map((zone: any) => {
              const raw = parseRaw(zone);
              const nameservers: any[] = raw.nameservers || [];
              const zoneRecords = recordsByZone.get(zone.ocid) || [];
              const isExpanded = expandedZones.has(zone.id);
              return (
                <div key={zone.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onClickResource(zone.id)}
                      className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {zone.displayName || raw.name || 'Unnamed Zone'}
                    </button>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      raw.zoneType === 'PRIMARY'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {raw.zoneType || 'UNKNOWN'}
                    </span>
                    {raw.scope && (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                        {raw.scope}
                      </span>
                    )}
                    {raw.isProtected && (
                      <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        Protected
                      </span>
                    )}
                    {zoneRecords.length > 0 && (
                      <button
                        onClick={() => toggleZone(zone.id)}
                        className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {isExpanded ? 'Hide' : 'Show'} {zoneRecords.length} record{zoneRecords.length !== 1 ? 's' : ''}
                      </button>
                    )}
                  </div>
                  <dl className="grid grid-cols-3 gap-x-6 gap-y-1 text-xs">
                    {raw.serial && (
                      <div>
                        <dt className="text-gray-400 dark:text-gray-500">Serial</dt>
                        <dd className="font-mono text-gray-600 dark:text-gray-400">{raw.serial}</dd>
                      </div>
                    )}
                    {raw.version && (
                      <div>
                        <dt className="text-gray-400 dark:text-gray-500">Version</dt>
                        <dd className="font-mono text-gray-600 dark:text-gray-400">{raw.version}</dd>
                      </div>
                    )}
                    {zone.lifecycleState && (
                      <div>
                        <dt className="text-gray-400 dark:text-gray-500">State</dt>
                        <dd className="text-gray-600 dark:text-gray-400">{zone.lifecycleState}</dd>
                      </div>
                    )}
                  </dl>
                  {nameservers.length > 0 && (
                    <div>
                      <dt className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-1">Nameservers</dt>
                      <div className="flex flex-wrap gap-1.5">
                        {nameservers.map((ns: any, i: number) => (
                          <span key={i} className="text-xs font-mono px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                            {ns.hostname || ns}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* DNS Records (collapsible) */}
                  {isExpanded && zoneRecords.length > 0 && (
                    <div className="mt-2 bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 dark:text-gray-500 uppercase">
                            <th className="text-left py-1 pr-3">Domain</th>
                            <th className="text-left py-1 pr-3">Type</th>
                            <th className="text-left py-1 pr-3">TTL</th>
                            <th className="text-left py-1">RData</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {zoneRecords.map((rec: any, i: number) => {
                            const recRaw = parseRaw(rec);
                            return (
                              <tr key={i}>
                                <td className="py-1 pr-3 font-mono text-gray-700 dark:text-gray-300 max-w-[200px] truncate">{recRaw.domain || '—'}</td>
                                <td className="py-1 pr-3"><DnsRecordTypeBadge rtype={recRaw.rtype || '—'} /></td>
                                <td className="py-1 pr-3 font-mono text-gray-600 dark:text-gray-400">{recRaw.ttl ?? '—'}</td>
                                <td className="py-1 font-mono text-gray-600 dark:text-gray-400 max-w-[300px] truncate" title={recRaw.rdata}>{recRaw.rdata || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Steering Policies */}
      {steeringPolicies.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Steering Policies
              <span className="ml-2 text-xs font-normal text-gray-400">{steeringPolicies.length}</span>
            </h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {steeringPolicies.map((policy: any) => {
              const raw = parseRaw(policy);
              const domains = attachmentsByPolicy.get(policy.ocid) || [];
              return (
                <div key={policy.id} className="px-4 py-3 space-y-1">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onClickResource(policy.id)}
                      className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {policy.displayName || 'Unnamed Policy'}
                    </button>
                    {raw.template && <SteeringTemplateBadge template={raw.template} />}
                    {raw.ttl != null && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">TTL: {raw.ttl}</span>
                    )}
                  </div>
                  {domains.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {domains.map((d: string, i: number) => (
                        <span key={i} className="text-xs font-mono px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DNS Views */}
      {dnsViews.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              DNS Views
              <span className="ml-2 text-xs font-normal text-gray-400">{dnsViews.length}</span>
            </h3>
          </div>
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Scope</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Protected</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {dnsViews.map((view: any) => {
                const raw = parseRaw(view);
                return (
                  <tr key={view.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-2 text-sm">
                      <button
                        onClick={() => onClickResource(view.id)}
                        className="text-gray-900 dark:text-gray-100 font-medium hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {view.displayName || 'Unnamed View'}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400">
                      {raw.scope && (
                        <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700">{raw.scope}</span>
                      )}
                      {!raw.scope && '—'}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {raw.isProtected && (
                        <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Protected</span>
                      )}
                      {!raw.isProtected && <span className="text-gray-400">No</span>}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">{view.lifecycleState || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Resolver Endpoints */}
      {dnsResolverEndpoints.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Resolver Endpoints
              <span className="ml-2 text-xs font-normal text-gray-400">{dnsResolverEndpoints.length}</span>
            </h3>
          </div>
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Forwarding</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Listening</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {dnsResolverEndpoints.map((ep: any) => {
                const raw = parseRaw(ep);
                return (
                  <tr key={ep.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-2 text-sm">
                      <button
                        onClick={() => onClickResource(ep.id)}
                        className="text-gray-900 dark:text-gray-100 font-medium hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {ep.displayName || raw.name || 'Unnamed'}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600 dark:text-gray-400">{raw.endpointType || '—'}</td>
                    <td className="px-4 py-2 text-sm font-mono text-gray-600 dark:text-gray-400">{raw.forwardingAddress || '—'}</td>
                    <td className="px-4 py-2 text-sm font-mono text-gray-600 dark:text-gray-400">{raw.listeningAddress || '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">{ep.lifecycleState || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TSIG Keys */}
      {tsigKeys.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              TSIG Keys
              <span className="ml-2 text-xs font-normal text-gray-400">{tsigKeys.length}</span>
            </h3>
          </div>
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Algorithm</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {tsigKeys.map((key: any) => {
                const raw = parseRaw(key);
                return (
                  <tr key={key.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-2 text-sm">
                      <button
                        onClick={() => onClickResource(key.id)}
                        className="text-gray-900 dark:text-gray-100 font-medium hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {key.displayName || raw.name || 'Unnamed'}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-sm font-mono text-gray-600 dark:text-gray-400">{raw.algorithm || '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">{key.lifecycleState || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VCN Detail Panel
// ---------------------------------------------------------------------------

function VcnDetail({
  vcn,
  snapshotId,
  allVcns,
  onClickResource,
}: {
  vcn: any;
  snapshotId: string;
  allVcns: any[];
  onClickResource: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<TabId>('subnets');
  const vcnRaw = parseRaw(vcn);
  const vcnOcid = vcn.ocid;

  // Fetch child resources — existing
  const { nodes: allSubnets, fetching: fetchingSubnets } = useNetworkQuery(snapshotId, 'network/subnet', false);
  const { nodes: allSecLists } = useNetworkQuery(snapshotId, 'network/security-list', false);
  const { nodes: allRouteTables } = useNetworkQuery(snapshotId, 'network/route-table', false);
  const { nodes: allNsgs } = useNetworkQuery(snapshotId, 'network/nsg', false);
  const { nodes: allNsgRules } = useNetworkQuery(snapshotId, 'network/nsg-rule', false);
  const { nodes: allIgws } = useNetworkQuery(snapshotId, 'network/internet-gateway', false);
  const { nodes: allNatGws } = useNetworkQuery(snapshotId, 'network/nat-gateway', false);
  const { nodes: allSgws } = useNetworkQuery(snapshotId, 'network/service-gateway', false);
  const { nodes: allLpgs } = useNetworkQuery(snapshotId, 'network/local-peering-gateway', false);
  const { nodes: allDnsZones } = useNetworkQuery(snapshotId, 'dns/zone', false);
  const { nodes: allDnsResolvers } = useNetworkQuery(snapshotId, 'dns/resolver', false);
  const { nodes: allDnsRecords } = useNetworkQuery(snapshotId, 'dns/record', false);
  const { nodes: allSteeringPolicies } = useNetworkQuery(snapshotId, 'dns/steering-policy', false);
  const { nodes: allSteeringAttachments } = useNetworkQuery(snapshotId, 'dns/steering-policy-attachment', false);
  const { nodes: allTsigKeys } = useNetworkQuery(snapshotId, 'dns/tsig-key', false);

  // Fetch child resources — new
  const { nodes: allLoadBalancers } = useNetworkQuery(snapshotId, 'network/load-balancer', false);
  const { nodes: allNetworkLoadBalancers } = useNetworkQuery(snapshotId, 'network/network-load-balancer', false);
  const { nodes: allPublicIps } = useNetworkQuery(snapshotId, 'network/public-ip', false);
  const { nodes: allDhcpOptions } = useNetworkQuery(snapshotId, 'network/dhcp-options', false);
  const { nodes: allDrgAttachments } = useNetworkQuery(snapshotId, 'network/drg-attachment', false);
  const { nodes: allDrgRouteTables } = useNetworkQuery(snapshotId, 'network/drg-route-table', false);
  const { nodes: allDrgRouteRules } = useNetworkQuery(snapshotId, 'network/drg-route-rule', false);
  const { nodes: allDnsViews } = useNetworkQuery(snapshotId, 'dns/view', false);
  const { nodes: allDnsResolverEndpoints } = useNetworkQuery(snapshotId, 'dns/resolver-endpoint', false);

  // Filter by VCN
  const subnets = useMemo(() => allSubnets.filter((s: any) => parseRaw(s).vcnId === vcnOcid), [allSubnets, vcnOcid]);
  const securityLists = useMemo(() => allSecLists.filter((s: any) => parseRaw(s).vcnId === vcnOcid), [allSecLists, vcnOcid]);
  const routeTables = useMemo(() => allRouteTables.filter((s: any) => parseRaw(s).vcnId === vcnOcid), [allRouteTables, vcnOcid]);
  const nsgs = useMemo(() => allNsgs.filter((s: any) => parseRaw(s).vcnId === vcnOcid), [allNsgs, vcnOcid]);
  const nsgRules = useMemo(() => {
    const nsgOcids = new Set(nsgs.map((n: any) => n.ocid));
    return allNsgRules.filter((r: any) => nsgOcids.has(parseRaw(r).networkSecurityGroupId));
  }, [allNsgRules, nsgs]);
  const gateways = useMemo(() => {
    const all = [...allIgws, ...allNatGws, ...allSgws, ...allLpgs];
    return all.filter((g: any) => parseRaw(g).vcnId === vcnOcid);
  }, [allIgws, allNatGws, allSgws, allLpgs, vcnOcid]);

  // DHCP Options map
  const dhcpOptionsMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const d of allDhcpOptions) {
      if (parseRaw(d).vcnId === vcnOcid) map.set(d.ocid, d);
    }
    return map;
  }, [allDhcpOptions, vcnOcid]);

  // DRG Attachments for this VCN
  const drgAttachments = useMemo(() =>
    allDrgAttachments.filter((a: any) => parseRaw(a).vcnId === vcnOcid),
    [allDrgAttachments, vcnOcid],
  );

  // DRG OCIDs attached to this VCN
  const drgOcids = useMemo(() => {
    const set = new Set<string>();
    for (const att of drgAttachments) {
      const raw = parseRaw(att);
      if (raw.drgId) set.add(raw.drgId);
    }
    return set;
  }, [drgAttachments]);

  // DRG Route Tables filtered by DRG
  const drgRouteTables = useMemo(() =>
    allDrgRouteTables.filter((drt: any) => drgOcids.has(parseRaw(drt).drgId)),
    [allDrgRouteTables, drgOcids],
  );

  // DRG Route Rules grouped by table OCID
  const drgRouteRulesByTable = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const rule of allDrgRouteRules) {
      const raw = parseRaw(rule);
      const tableId = raw.drgRouteTableId;
      if (!tableId) continue;
      const drgRouteTableOcids = new Set(drgRouteTables.map((t: any) => t.ocid));
      if (!drgRouteTableOcids.has(tableId)) continue;
      if (!map.has(tableId)) map.set(tableId, []);
      map.get(tableId)!.push(raw);
    }
    return map;
  }, [allDrgRouteRules, drgRouteTables]);

  // Subnet OCIDs for LB filtering
  const subnetOcids = useMemo(() => new Set(subnets.map((s: any) => s.ocid)), [subnets]);

  // Load Balancers filtered by VCN subnets
  const loadBalancers = useMemo(() => {
    const lbs = allLoadBalancers.filter((lb: any) => {
      const raw = parseRaw(lb);
      const sids: string[] = raw.subnetIds || [];
      return sids.some((sid: string) => subnetOcids.has(sid));
    });
    const nlbs = allNetworkLoadBalancers.filter((nlb: any) => {
      const raw = parseRaw(nlb);
      return subnetOcids.has(raw.subnetId);
    });
    return [...lbs, ...nlbs];
  }, [allLoadBalancers, allNetworkLoadBalancers, subnetOcids]);

  // All VCN resource OCIDs for public IP matching
  const vcnResourceOcids = useMemo(() => {
    const set = new Set<string>();
    for (const s of subnets) set.add(s.ocid);
    for (const g of gateways) set.add(g.ocid);
    for (const lb of loadBalancers) set.add(lb.ocid);
    for (const att of drgAttachments) set.add(att.ocid);
    return set;
  }, [subnets, gateways, loadBalancers, drgAttachments]);

  // Public IPs filtered by assigned entity
  const publicIps = useMemo(() =>
    allPublicIps.filter((pip: any) => {
      const raw = parseRaw(pip);
      return raw.assignedEntityId && vcnResourceOcids.has(raw.assignedEntityId);
    }),
    [allPublicIps, vcnResourceOcids],
  );

  // Resource name map for public IP "assigned to" display
  const resourceNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subnets) map.set(s.ocid, s.displayName || 'Unnamed Subnet');
    for (const g of gateways) map.set(g.ocid, g.displayName || 'Unnamed Gateway');
    for (const lb of loadBalancers) map.set(lb.ocid, lb.displayName || 'Unnamed LB');
    for (const att of drgAttachments) map.set(att.ocid, att.displayName || 'Unnamed DRG Attachment');
    return map;
  }, [subnets, gateways, loadBalancers, drgAttachments]);

  // DNS zones share the VCN's compartment (no vcnId on zones)
  const dnsZones = useMemo(() =>
    allDnsZones.filter((z: any) => z.compartmentId === vcn.compartmentId),
    [allDnsZones, vcn.compartmentId],
  );
  const steeringPolicies = useMemo(() =>
    allSteeringPolicies.filter((p: any) => p.compartmentId === vcn.compartmentId),
    [allSteeringPolicies, vcn.compartmentId],
  );
  const steeringAttachments = useMemo(() =>
    allSteeringAttachments.filter((a: any) => a.compartmentId === vcn.compartmentId),
    [allSteeringAttachments, vcn.compartmentId],
  );
  const tsigKeys = useMemo(() =>
    allTsigKeys.filter((k: any) => k.compartmentId === vcn.compartmentId),
    [allTsigKeys, vcn.compartmentId],
  );

  // DNS Views linked to VCN resolvers
  const vcnResolvers = useMemo(() =>
    allDnsResolvers.filter((r: any) => parseRaw(r).attachedVcnId === vcnOcid),
    [allDnsResolvers, vcnOcid],
  );
  const dnsViews = useMemo(() => {
    const viewOcids = new Set<string>();
    for (const resolver of vcnResolvers) {
      const raw = parseRaw(resolver);
      if (raw.defaultViewId) viewOcids.add(raw.defaultViewId);
      const attached: any[] = raw.attachedViews || [];
      for (const av of attached) {
        if (av.viewId) viewOcids.add(av.viewId);
      }
    }
    return allDnsViews.filter((v: any) => viewOcids.has(v.ocid));
  }, [allDnsViews, vcnResolvers]);

  // Resolver Endpoints matched by subnet
  const dnsResolverEndpoints = useMemo(() =>
    allDnsResolverEndpoints.filter((ep: any) => subnetOcids.has(parseRaw(ep).subnetId)),
    [allDnsResolverEndpoints, subnetOcids],
  );

  // Exposure badge
  const hasEnabledIgw = useMemo(() =>
    gateways.some((g: any) => g.resourceType === 'network/internet-gateway' && parseRaw(g).isEnabled !== false),
    [gateways],
  );
  const hasPublicSubnet = useMemo(() =>
    subnets.some((s: any) => {
      const raw = parseRaw(s);
      return raw.prohibitInternetIngress === false || raw.prohibitPublicIpOnVnic === false;
    }),
    [subnets],
  );
  const isExposed = hasEnabledIgw && hasPublicSubnet;

  const cidrs: string[] = vcnRaw.cidrBlocks || (vcnRaw.cidrBlock ? [vcnRaw.cidrBlock] : []);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {/* VCN Header */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {vcn.displayName || 'Unnamed VCN'}
          </h2>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            isExposed
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
          }`}>
            {isExposed ? 'Internet Exposed' : 'Private'}
          </span>
        </div>
        {cidrs.length > 0 && (
          <div className="mt-1 flex gap-2 flex-wrap">
            {cidrs.map((c: string, i: number) => (
              <span key={i} className="text-sm font-mono text-gray-500 dark:text-gray-400">{c}</span>
            ))}
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
        <span>{subnets.length} subnet{subnets.length !== 1 ? 's' : ''}</span>
        <span>·</span>
        <span>{gateways.length} gateway{gateways.length !== 1 ? 's' : ''}</span>
        {loadBalancers.length > 0 && <><span>·</span><span>{loadBalancers.length} load balancer{loadBalancers.length !== 1 ? 's' : ''}</span></>}
        {publicIps.length > 0 && <><span>·</span><span>{publicIps.length} public IP{publicIps.length !== 1 ? 's' : ''}</span></>}
        <span>·</span>
        <span>{securityLists.length} security list{securityLists.length !== 1 ? 's' : ''}</span>
        <span>·</span>
        <span>{routeTables.length} route table{routeTables.length !== 1 ? 's' : ''}</span>
        <span>·</span>
        <span>{nsgs.length} NSG{nsgs.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-700 dark:text-blue-300'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {fetchingSubnets && activeTab === 'subnets' && (
          <p className="text-sm text-gray-400">Loading...</p>
        )}
        {activeTab === 'subnets' && <SubnetsTab subnets={subnets} dhcpOptionsMap={dhcpOptionsMap} onClickResource={onClickResource} />}
        {activeTab === 'gateways' && <GatewaysTab gateways={gateways} drgAttachments={drgAttachments} allVcns={allVcns} onClickResource={onClickResource} />}
        {activeTab === 'loadbalancers' && <LoadBalancersTab loadBalancers={loadBalancers} onClickResource={onClickResource} />}
        {activeTab === 'publicips' && <PublicIpsTab publicIps={publicIps} resourceNameMap={resourceNameMap} onClickResource={onClickResource} />}
        {activeTab === 'security' && <SecurityTab securityLists={securityLists} onClickResource={onClickResource} />}
        {activeTab === 'routing' && <RoutingTab routeTables={routeTables} drgRouteTables={drgRouteTables} drgRouteRulesByTable={drgRouteRulesByTable} onClickResource={onClickResource} />}
        {activeTab === 'nsgs' && <NsgsTab nsgs={nsgs} nsgRules={nsgRules} onClickResource={onClickResource} />}
        {activeTab === 'dns' && <DnsTab vcn={vcn} subnets={subnets} dnsZones={dnsZones} dnsRecords={allDnsRecords} dnsResolvers={allDnsResolvers} dnsViews={dnsViews} dnsResolverEndpoints={dnsResolverEndpoints} steeringPolicies={steeringPolicies} steeringAttachments={steeringAttachments} tsigKeys={tsigKeys} onClickResource={onClickResource} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function NetworkPage() {
  const { currentSnapshot } = useSnapshot();
  const { openResource } = useDetailPanel();
  const [selectedVcnId, setSelectedVcnId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [compartmentFilter, setCompartmentFilter] = useState('');

  const snapshotId = currentSnapshot?.id || '';

  // Fetch VCNs
  const [vcnResult] = useQuery({
    query: NETWORK_RESOURCES_QUERY,
    variables: { filter: { snapshotId, resourceType: 'network/vcn', first: 200 } },
    pause: !snapshotId,
  });
  const allVcns: any[] = useMemo(
    () => (vcnResult.data?.resources?.edges || []).map((e: any) => e.node),
    [vcnResult.data],
  );

  // Fetch compartments for filter
  const [compartmentsResult] = useQuery({
    query: COMPARTMENTS_QUERY,
    variables: { snapshotId },
    pause: !snapshotId,
  });
  const compartments = compartmentsResult.data?.compartments || [];

  // Filter VCNs
  const vcns = useMemo(() => {
    let filtered = allVcns;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((v: any) => {
        const name = (v.displayName || '').toLowerCase();
        const raw = parseRaw(v);
        const cidrs = (raw.cidrBlocks || (raw.cidrBlock ? [raw.cidrBlock] : [])).join(' ').toLowerCase();
        return name.includes(q) || cidrs.includes(q);
      });
    }
    if (compartmentFilter) {
      filtered = filtered.filter((v: any) => v.compartmentId === compartmentFilter);
    }
    return filtered;
  }, [allVcns, search, compartmentFilter]);

  const selectedVcn = useMemo(() => allVcns.find((v: any) => v.id === selectedVcnId) || null, [allVcns, selectedVcnId]);

  if (!currentSnapshot) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 dark:text-gray-500 text-lg">Select a snapshot to view network resources</p>
      </div>
    );
  }

  return (
    <div className="flex h-full -m-6">
      {/* Left panel — VCN list */}
      <div className="w-80 shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        <div className="p-4 space-y-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Networks</h2>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search VCNs..."
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            value={compartmentFilter}
            onChange={(e) => setCompartmentFilter(e.target.value)}
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 dark:text-gray-200"
          >
            <option value="">All Compartments</option>
            {compartments.map((c: any) => (
              <option key={c.ocid} value={c.ocid}>{c.displayName || c.ocid}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {vcnResult.fetching && (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">Loading...</p>
          )}
          {!vcnResult.fetching && vcns.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No VCNs found</p>
          )}
          {vcns.map((vcn: any) => (
            <VcnCard
              key={vcn.id}
              resource={vcn}
              selected={selectedVcnId === vcn.id}
              onClick={() => setSelectedVcnId(selectedVcnId === vcn.id ? null : vcn.id)}
            />
          ))}
        </div>
      </div>

      {/* Right panel — VCN detail */}
      {selectedVcn ? (
        <VcnDetail
          key={selectedVcn.id}
          vcn={selectedVcn}
          snapshotId={snapshotId}
          allVcns={allVcns}
          onClickResource={openResource}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-400 dark:text-gray-500 text-lg">Select a VCN to inspect</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">{allVcns.length} VCN{allVcns.length !== 1 ? 's' : ''} available</p>
          </div>
        </div>
      )}
    </div>
  );
}
