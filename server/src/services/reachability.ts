/**
 * Network reachability analysis engine.
 *
 * Three modes:
 *   1. Source + Destination  — single path walk (original)
 *   2. Source only           — fan-out: show all reachable destinations
 *   3. Destination only      — fan-in: show all subnets that can reach it
 */

import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type HopStatus = 'ALLOW' | 'DENY' | 'UNKNOWN';

export interface ReachabilityHop {
  id: string;
  type: string;        // SRC | SUB | RT | SL | NSG | GW | DST | NET
  label: string;
  resourceType: string;
  ocid: string;
  status: HopStatus;
  details: string;
  metadata: Record<string, any> | null;
}

export interface ReachabilityLink {
  id: string;
  source: string;
  target: string;
  status: HopStatus;
  label: string;
}

export type Verdict = 'REACHABLE' | 'BLOCKED' | 'PARTIAL' | 'UNKNOWN';

export interface ReachabilityResult {
  hops: ReachabilityHop[];
  links: ReachabilityLink[];
  verdict: Verdict;
  verdictDetail: string;
}

// ---------------------------------------------------------------------------
// CIDR utilities (pure functions, no npm deps)
// ---------------------------------------------------------------------------

export function ipToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function intToIp(n: number): string {
  return `${(n >>> 24) & 0xff}.${(n >>> 16) & 0xff}.${(n >>> 8) & 0xff}.${n & 0xff}`;
}

export interface CidrRange {
  network: number;
  mask: number;
  prefix: number;
  raw: string;
}

export function parseCidr(cidr: string): CidrRange {
  const parts = cidr.split('/');
  const ip = ipToInt(parts[0]);
  const prefix = parts.length > 1 ? parseInt(parts[1], 10) : 32;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return { network: (ip & mask) >>> 0, mask, prefix, raw: cidr };
}

export function ipInCidr(ipInt: number, cidr: CidrRange): boolean {
  return ((ipInt & cidr.mask) >>> 0) === cidr.network;
}

interface RouteCandidate {
  cidr: CidrRange;
  networkEntityId: string;
  raw: any;
}

function longestPrefixMatch(destIpInt: number, routes: RouteCandidate[]): RouteCandidate | null {
  let best: RouteCandidate | null = null;
  for (const r of routes) {
    if (ipInCidr(destIpInt, r.cidr)) {
      if (!best || r.cidr.prefix > best.cidr.prefix) {
        best = r;
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Helper: parse JSON field from DB (may be string or object)
// ---------------------------------------------------------------------------

function parseJson(val: any): any {
  if (val == null) return null;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return null; }
  }
  return val;
}

// ---------------------------------------------------------------------------
// Security rule evaluation
// ---------------------------------------------------------------------------

interface SecurityRule {
  protocol: string;
  source?: string;
  destination?: string;
  tcpOptions?: { destinationPortRange?: { min: number; max: number }; sourcePortRange?: { min: number; max: number } };
  udpOptions?: { destinationPortRange?: { min: number; max: number }; sourcePortRange?: { min: number; max: number } };
  isStateless?: boolean;
}

function ruleMatchesCidr(ruleCidr: string | undefined, targetIpInt: number): boolean {
  if (!ruleCidr) return true;
  try {
    return ipInCidr(targetIpInt, parseCidr(ruleCidr));
  } catch {
    return false;
  }
}

function ruleMatchesProtocol(rule: SecurityRule, protocol?: string, port?: number): boolean {
  if (rule.protocol === 'all') return true;
  if (!protocol) return true;
  if (rule.protocol !== protocol) return false;
  if (port != null && (protocol === '6' || protocol === '17')) {
    const opts = protocol === '6' ? rule.tcpOptions : rule.udpOptions;
    if (opts?.destinationPortRange) {
      const { min, max } = opts.destinationPortRange;
      if (port < min || port > max) return false;
    }
  }
  return true;
}

/** Check if any egress rule allows traffic. Pass null destIpInt to skip CIDR check. */
function evaluateEgressRules(
  rules: SecurityRule[],
  destIpInt: number | null,
  protocol?: string,
  port?: number,
): { allowed: boolean; matchedRule: SecurityRule | null } {
  for (const rule of rules) {
    const cidrOk = destIpInt == null || ruleMatchesCidr(rule.destination, destIpInt);
    if (cidrOk && ruleMatchesProtocol(rule, protocol, port)) {
      return { allowed: true, matchedRule: rule };
    }
  }
  return { allowed: false, matchedRule: null };
}

function evaluateIngressRules(
  rules: SecurityRule[],
  srcIpInt: number | null,
  protocol?: string,
  port?: number,
): { allowed: boolean; matchedRule: SecurityRule | null } {
  for (const rule of rules) {
    const cidrOk = srcIpInt == null || ruleMatchesCidr(rule.source, srcIpInt);
    if (cidrOk && ruleMatchesProtocol(rule, protocol, port)) {
      return { allowed: true, matchedRule: rule };
    }
  }
  return { allowed: false, matchedRule: null };
}

// ---------------------------------------------------------------------------
// Resource lookup map builder
// ---------------------------------------------------------------------------

interface ResourceRecord {
  id: string;
  ocid: string;
  resourceType: string;
  displayName: string | null;
  rawData: any;
}

type ResourceMap = Map<string, ResourceRecord>;

async function loadNetworkResources(prisma: PrismaClient, snapshotId: string): Promise<ResourceMap> {
  const types = [
    'network/vcn',
    'network/subnet',
    'network/route-table',
    'network/security-list',
    'network/nsg',
    'network/internet-gateway',
    'network/nat-gateway',
    'network/service-gateway',
    'network/drg',
    'network/drg-attachment',
    'network/local-peering-gateway',
  ];

  const resources = await prisma.resource.findMany({
    where: { snapshotId, resourceType: { in: types } },
    select: { id: true, ocid: true, resourceType: true, displayName: true, rawData: true },
  });

  const map: ResourceMap = new Map();
  for (const r of resources) {
    map.set(r.ocid, {
      id: r.id,
      ocid: r.ocid,
      resourceType: r.resourceType,
      displayName: r.displayName,
      rawData: parseJson(r.rawData),
    });
  }
  return map;
}

function getSubnets(resources: ResourceMap): ResourceRecord[] {
  return [...resources.values()].filter(r => r.resourceType === 'network/subnet');
}

// ---------------------------------------------------------------------------
// Shared helpers for building gateway hops
// ---------------------------------------------------------------------------

function evaluateGateway(gateway: ResourceRecord): { allowed: boolean; detail: string } {
  if (gateway.resourceType === 'network/internet-gateway') {
    const ok = gateway.rawData?.isEnabled !== false;
    return { allowed: ok, detail: ok ? 'Internet Gateway enabled' : 'Internet Gateway disabled' };
  }
  if (gateway.resourceType === 'network/nat-gateway') {
    const ok = gateway.rawData?.blockTraffic !== true;
    return { allowed: ok, detail: ok ? 'NAT Gateway active' : 'NAT Gateway blocking traffic' };
  }
  if (gateway.resourceType === 'network/service-gateway') {
    const ok = gateway.rawData?.blockTraffic !== true;
    return { allowed: ok, detail: ok ? 'Service Gateway active' : 'Service Gateway blocking traffic' };
  }
  if (gateway.resourceType === 'network/drg') {
    return { allowed: true, detail: 'DRG — cross-VCN routing' };
  }
  if (gateway.resourceType === 'network/local-peering-gateway') {
    const peeringStatus = gateway.rawData?.peeringStatus;
    const ok = peeringStatus !== 'REVOKED';
    return { allowed: ok, detail: ok ? 'LPG — VCN peering active' : 'LPG — peering revoked' };
  }
  return { allowed: true, detail: `Gateway type: ${gateway.resourceType}` };
}

function gatewayTypeLabel(rt: string): string {
  const m: Record<string, string> = {
    'network/internet-gateway': 'IGW',
    'network/nat-gateway': 'NAT',
    'network/service-gateway': 'SGW',
    'network/drg': 'DRG',
    'network/local-peering-gateway': 'LPG',
  };
  return m[rt] || 'GW';
}

// ---------------------------------------------------------------------------
// D14: NSG rule evaluation helpers
// ---------------------------------------------------------------------------

/** Find all NSGs in the same VCN and check their egress rules. */
function checkNsgEgressSecurity(
  resources: ResourceMap,
  vcnId: string | undefined,
  destIpInt: number | null,
  protocol?: string,
  port?: number,
): { allowed: boolean; detail: string; nsg: ResourceRecord | null } {
  if (!vcnId) return { allowed: false, detail: 'No VCN ID', nsg: null };

  for (const [, r] of resources) {
    if (r.resourceType === 'network/nsg' && r.rawData?.vcnId === vcnId) {
      const egressRules: SecurityRule[] = r.rawData?.egressSecurityRules ?? [];
      if (egressRules.length === 0) continue;
      const result = evaluateEgressRules(egressRules, destIpInt, protocol, port);
      if (result.allowed) {
        const matched = result.matchedRule!;
        return {
          allowed: true,
          detail: `NSG ${r.displayName}: proto=${matched.protocol}, dest=${matched.destination || 'any'}`,
          nsg: r,
        };
      }
    }
  }
  return { allowed: false, detail: 'No matching NSG egress rule', nsg: null };
}

/** Find all NSGs in the same VCN and check their ingress rules. */
function checkNsgIngressSecurity(
  resources: ResourceMap,
  vcnId: string | undefined,
  srcIpInt: number | null,
  protocol?: string,
  port?: number,
): { allowed: boolean; detail: string; nsg: ResourceRecord | null } {
  if (!vcnId) return { allowed: false, detail: 'No VCN ID', nsg: null };

  for (const [, r] of resources) {
    if (r.resourceType === 'network/nsg' && r.rawData?.vcnId === vcnId) {
      const ingressRules: SecurityRule[] = r.rawData?.ingressSecurityRules ?? [];
      if (ingressRules.length === 0) continue;
      const result = evaluateIngressRules(ingressRules, srcIpInt, protocol, port);
      if (result.allowed) {
        const matched = result.matchedRule!;
        return {
          allowed: true,
          detail: `NSG ${r.displayName}: proto=${matched.protocol}, src=${matched.source || 'any'}`,
          nsg: r,
        };
      }
    }
  }
  return { allowed: false, detail: 'No matching NSG ingress rule', nsg: null };
}

// ---------------------------------------------------------------------------
// Egress security check helper (returns allowed + first matching SL)
// ---------------------------------------------------------------------------

function checkEgressSecurity(
  resources: ResourceMap,
  subnet: ResourceRecord,
  destIpInt: number | null,
  protocol?: string,
  port?: number,
): { allowed: boolean; detail: string; sl: ResourceRecord | null } {
  const slOcids: string[] = subnet.rawData?.securityListIds ?? [];
  for (const slOcid of slOcids) {
    const sl = resources.get(slOcid);
    if (!sl) continue;
    const egressRules: SecurityRule[] = sl.rawData?.egressSecurityRules ?? [];
    const result = evaluateEgressRules(egressRules, destIpInt, protocol, port);
    if (result.allowed) {
      const r = result.matchedRule!;
      return { allowed: true, detail: `Matched: proto=${r.protocol}, dest=${r.destination || 'any'}`, sl };
    }
  }
  const firstSl = slOcids.length > 0 ? (resources.get(slOcids[0]) ?? null) : null;
  return { allowed: false, detail: 'No matching egress rule', sl: firstSl };
}

function checkIngressSecurity(
  resources: ResourceMap,
  subnet: ResourceRecord,
  srcIpInt: number | null,
  protocol?: string,
  port?: number,
): { allowed: boolean; detail: string; sl: ResourceRecord | null } {
  const slOcids: string[] = subnet.rawData?.securityListIds ?? [];
  for (const slOcid of slOcids) {
    const sl = resources.get(slOcid);
    if (!sl) continue;
    const ingressRules: SecurityRule[] = sl.rawData?.ingressSecurityRules ?? [];
    const result = evaluateIngressRules(ingressRules, srcIpInt, protocol, port);
    if (result.allowed) {
      const r = result.matchedRule!;
      return { allowed: true, detail: `Matched: proto=${r.protocol}, src=${r.source || 'any'}`, sl };
    }
  }
  const firstSl = slOcids.length > 0 ? (resources.get(slOcids[0]) ?? null) : null;
  return { allowed: false, detail: 'No matching ingress rule', sl: firstSl };
}

// ---------------------------------------------------------------------------
// D15: Cross-VCN continuation helper
// ---------------------------------------------------------------------------

/**
 * Continue path analysis into a target VCN after crossing a DRG or LPG.
 * Finds the destination subnet in the target VCN, checks ingress security,
 * and appends the appropriate hops/links.
 */
function continueInTargetVcn(
  resources: ResourceMap,
  targetVcnId: string,
  destIpInt: number,
  destinationIp: string,
  srcIpInt: number,
  prevHopId: string,
  hops: ReachabilityHop[],
  links: ReachabilityLink[],
  visitedVcns: Set<string>,
  protocol?: string,
  port?: number,
): { verdict: Verdict; verdictDetail: string } {
  // Loop detection
  if (visitedVcns.has(targetVcnId)) {
    return { verdict: 'PARTIAL', verdictDetail: 'Cross-VCN loop detected — aborting analysis' };
  }
  visitedVcns.add(targetVcnId);

  const targetVcn = resources.get(targetVcnId);

  // Add target VCN hop
  const vcnHopId = `vcn-${targetVcnId}`;
  hops.push({
    id: vcnHopId, type: 'SUB', label: targetVcn?.displayName || 'Target VCN',
    resourceType: 'network/vcn', ocid: targetVcnId,
    status: 'ALLOW', details: `Cross-VCN target: ${targetVcn?.displayName || targetVcnId}`,
    metadata: null,
  });
  links.push({ id: `link-${prevHopId}-${vcnHopId}`, source: prevHopId, target: vcnHopId, status: 'ALLOW', label: 'cross-VCN' });

  // Find destination subnet in target VCN
  let targetSubnet: ResourceRecord | null = null;
  for (const r of resources.values()) {
    if (r.resourceType === 'network/subnet' && r.rawData?.vcnId === targetVcnId && r.rawData?.cidrBlock) {
      try {
        if (ipInCidr(destIpInt, parseCidr(r.rawData.cidrBlock))) {
          targetSubnet = r;
          break;
        }
      } catch {}
    }
  }

  if (!targetSubnet) {
    hops[hops.length - 1].status = 'UNKNOWN';
    return { verdict: 'PARTIAL', verdictDetail: `No subnet found for ${destinationIp} in target VCN` };
  }

  const tgtSubHopId = `sub-tgt-${targetSubnet.ocid}`;
  hops.push({
    id: tgtSubHopId, type: 'SUB', label: targetSubnet.displayName || 'Target Subnet',
    resourceType: 'network/subnet', ocid: targetSubnet.ocid,
    status: 'ALLOW', details: `CIDR: ${targetSubnet.rawData?.cidrBlock}`,
    metadata: { cidrBlock: targetSubnet.rawData?.cidrBlock },
  });
  links.push({ id: `link-${vcnHopId}-${tgtSubHopId}`, source: vcnHopId, target: tgtSubHopId, status: 'ALLOW', label: '' });

  // Ingress security list check on target subnet
  const ingress = checkIngressSecurity(resources, targetSubnet, srcIpInt, protocol, port);
  // Also check NSG ingress (OCI allows if EITHER SL or NSG allows)
  const nsgIngress = checkNsgIngressSecurity(resources, targetVcnId, srcIpInt, protocol, port);
  const ingressAllowed = ingress.allowed || nsgIngress.allowed;

  const ingressSlHopId = ingress.sl ? `sl-tgt-${ingress.sl.ocid}` : 'sl-tgt-ingress';
  hops.push({
    id: ingressSlHopId, type: 'SL',
    label: ingress.sl?.displayName || 'Ingress Security List',
    resourceType: 'network/security-list', ocid: ingress.sl?.ocid ?? '',
    status: ingressAllowed ? 'ALLOW' : 'DENY',
    details: ingress.allowed
      ? ingress.detail
      : nsgIngress.allowed
        ? `SL denied, but NSG allowed: ${nsgIngress.detail}`
        : `No ingress rule allows traffic from source`,
    metadata: null,
  });
  links.push({
    id: `link-${tgtSubHopId}-${ingressSlHopId}`, source: tgtSubHopId, target: ingressSlHopId,
    status: ingressAllowed ? 'ALLOW' : 'DENY', label: 'ingress rules',
  });

  // If SL denied but NSG allowed, add NSG hop
  if (!ingress.allowed && nsgIngress.allowed && nsgIngress.nsg) {
    const nsgHopId = `nsg-tgt-${nsgIngress.nsg.ocid}`;
    hops.push({
      id: nsgHopId, type: 'NSG', label: nsgIngress.nsg.displayName || 'NSG',
      resourceType: 'network/nsg', ocid: nsgIngress.nsg.ocid,
      status: 'ALLOW', details: nsgIngress.detail, metadata: null,
    });
    links.push({
      id: `link-${tgtSubHopId}-${nsgHopId}`, source: tgtSubHopId, target: nsgHopId,
      status: 'ALLOW', label: 'NSG ingress',
    });
  }

  // Destination hop
  const dstHopId = `dst-tgt-${targetSubnet.ocid}`;
  hops.push({
    id: dstHopId, type: 'DST',
    label: targetSubnet.displayName || destinationIp,
    resourceType: 'network/subnet', ocid: targetSubnet.ocid,
    status: ingressAllowed ? 'ALLOW' : 'DENY',
    details: `CIDR: ${targetSubnet.rawData?.cidrBlock}`,
    metadata: { cidrBlock: targetSubnet.rawData?.cidrBlock },
  });
  links.push({
    id: `link-${ingressSlHopId}-${dstHopId}`, source: ingressSlHopId, target: dstHopId,
    status: ingressAllowed ? 'ALLOW' : 'DENY', label: '',
  });

  if (!ingressAllowed) {
    return { verdict: 'BLOCKED', verdictDetail: `Ingress security on target VCN subnet blocks traffic` };
  }
  return { verdict: 'REACHABLE', verdictDetail: `Traffic can flow cross-VCN to ${destinationIp}` };
}

// ---------------------------------------------------------------------------
// Mode 1: Source + Destination — single path walk
// ---------------------------------------------------------------------------

function analyzePair(
  resources: ResourceMap,
  sourceIp: string,
  destinationIp: string,
  protocol?: string,
  port?: number,
): ReachabilityResult {
  const hops: ReachabilityHop[] = [];
  const links: ReachabilityLink[] = [];

  const srcIpInt = ipToInt(sourceIp);

  const isInternet = destinationIp.toLowerCase() === 'internet' || destinationIp === '0.0.0.0/0';
  let destIpInt: number;
  if (isInternet) {
    destIpInt = ipToInt('0.0.0.0');
  } else {
    destIpInt = ipToInt(destinationIp.split('/')[0]);
  }

  // Source hop
  const srcHopId = 'src';
  hops.push({ id: srcHopId, type: 'SRC', label: sourceIp, resourceType: 'source', ocid: '', status: 'ALLOW', details: `Source IP: ${sourceIp}`, metadata: null });

  // Find source subnet
  let sourceSubnet: ResourceRecord | null = null;
  let sourceVcn: ResourceRecord | null = null;
  for (const r of resources.values()) {
    if (r.resourceType === 'network/subnet' && r.rawData?.cidrBlock) {
      try { if (ipInCidr(srcIpInt, parseCidr(r.rawData.cidrBlock))) { sourceSubnet = r; break; } } catch {}
    }
  }
  if (!sourceSubnet) {
    hops[0].status = 'DENY';
    hops[0].details = `No subnet found containing ${sourceIp}`;
    return { hops, links, verdict: 'BLOCKED', verdictDetail: `No subnet found for source IP ${sourceIp}` };
  }
  const vcnOcid = sourceSubnet.rawData?.vcnId;
  if (vcnOcid) sourceVcn = resources.get(vcnOcid) ?? null;

  const subHopId = `sub-${sourceSubnet.ocid}`;
  hops.push({ id: subHopId, type: 'SUB', label: sourceSubnet.displayName || 'Subnet', resourceType: 'network/subnet', ocid: sourceSubnet.ocid, status: 'ALLOW', details: `CIDR: ${sourceSubnet.rawData?.cidrBlock}`, metadata: { cidrBlock: sourceSubnet.rawData?.cidrBlock } });
  links.push({ id: 'link-src-sub', source: srcHopId, target: subHopId, status: 'ALLOW', label: '' });

  // Find destination subnet (intra-VCN?)
  let destSubnet: ResourceRecord | null = null;
  let isIntraVcn = false;
  if (!isInternet) {
    for (const r of resources.values()) {
      if (r.resourceType === 'network/subnet' && r.rawData?.cidrBlock) {
        try {
          if (ipInCidr(destIpInt, parseCidr(r.rawData.cidrBlock))) {
            destSubnet = r;
            if (destSubnet.rawData?.vcnId && destSubnet.rawData.vcnId === vcnOcid) isIntraVcn = true;
            break;
          }
        } catch {}
      }
    }
  }

  // Route table
  const rtOcid = sourceSubnet.rawData?.routeTableId || sourceVcn?.rawData?.defaultRouteTableId;
  const routeTable = rtOcid ? resources.get(rtOcid) : null;
  const rtHopId = routeTable ? `rt-${routeTable.ocid}` : 'rt-missing';

  if (!routeTable) {
    hops.push({ id: rtHopId, type: 'RT', label: 'Route Table (missing)', resourceType: 'network/route-table', ocid: '', status: 'DENY', details: 'No route table found for subnet', metadata: null });
    links.push({ id: 'link-sub-rt', source: subHopId, target: rtHopId, status: 'DENY', label: 'no route table' });
    return { hops, links, verdict: 'BLOCKED', verdictDetail: 'No route table found for source subnet' };
  }

  const routeRules: any[] = routeTable.rawData?.routeRules ?? [];
  const routeCandidates: RouteCandidate[] = routeRules.map((rule: any) => ({
    cidr: parseCidr(rule.destination ?? rule.cidrBlock ?? '0.0.0.0/0'),
    networkEntityId: rule.networkEntityId ?? '',
    raw: rule,
  }));

  const destIpForRouting = isInternet ? ipToInt('8.8.8.8') : destIpInt;
  const matchedRoute = longestPrefixMatch(destIpForRouting, routeCandidates);

  hops.push({
    id: rtHopId, type: 'RT', label: routeTable.displayName || 'Route Table', resourceType: 'network/route-table', ocid: routeTable.ocid, status: 'ALLOW',
    details: matchedRoute ? `Matched rule: ${matchedRoute.cidr.raw} → ${matchedRoute.networkEntityId}` : isIntraVcn ? 'Intra-VCN: implicit local route' : 'No matching route rule',
    metadata: { rulesCount: routeRules.length, matchedDestination: matchedRoute?.cidr.raw ?? null },
  });
  links.push({ id: 'link-sub-rt', source: subHopId, target: rtHopId, status: 'ALLOW', label: 'routes via' });

  if (!matchedRoute && !isIntraVcn) {
    hops[hops.length - 1].status = 'DENY';
    links[links.length - 1].status = 'DENY';
    return { hops, links, verdict: 'BLOCKED', verdictDetail: `No route to ${destinationIp}` };
  }

  // Egress security list
  const egressCheckIp = isInternet ? ipToInt('8.8.8.8') : destIpInt;
  const egress = checkEgressSecurity(resources, sourceSubnet, egressCheckIp, protocol, port);

  // D14: NSG egress check — OCI allows traffic if EITHER security list OR NSG allows
  const nsgEgress = checkNsgEgressSecurity(resources, vcnOcid, egressCheckIp, protocol, port);
  const egressAllowed = egress.allowed || nsgEgress.allowed;

  const slHopId = egress.sl ? `sl-${egress.sl.ocid}` : 'sl-egress';
  hops.push({
    id: slHopId, type: 'SL', label: egress.sl?.displayName || 'Egress Security List', resourceType: 'network/security-list', ocid: egress.sl?.ocid ?? '',
    status: egressAllowed ? 'ALLOW' : 'DENY',
    details: egress.allowed
      ? egress.detail
      : nsgEgress.allowed
        ? `SL denied, but NSG allowed: ${nsgEgress.detail}`
        : `No egress rule allows traffic to ${destinationIp}${port ? `:${port}` : ''}`,
    metadata: null,
  });
  links.push({ id: 'link-rt-sl', source: rtHopId, target: slHopId, status: egressAllowed ? 'ALLOW' : 'DENY', label: 'egress rules' });

  // Add NSG hop if SL blocked but NSG allowed
  if (!egress.allowed && nsgEgress.allowed && nsgEgress.nsg) {
    const nsgHopId = `nsg-egress-${nsgEgress.nsg.ocid}`;
    hops.push({
      id: nsgHopId, type: 'NSG', label: nsgEgress.nsg.displayName || 'NSG',
      resourceType: 'network/nsg', ocid: nsgEgress.nsg.ocid,
      status: 'ALLOW', details: nsgEgress.detail, metadata: null,
    });
    links.push({ id: `link-rt-${nsgHopId}`, source: rtHopId, target: nsgHopId, status: 'ALLOW', label: 'NSG egress' });
  }

  if (!egressAllowed) {
    return { hops, links, verdict: 'BLOCKED', verdictDetail: `Egress security blocks traffic to ${destinationIp}${port ? `:${port}` : ''}` };
  }

  // Intra-VCN: ingress check on destination subnet
  if (isIntraVcn && destSubnet) {
    const ingress = checkIngressSecurity(resources, destSubnet, srcIpInt, protocol, port);
    // D14: NSG ingress check
    const nsgIngress = checkNsgIngressSecurity(resources, vcnOcid, srcIpInt, protocol, port);
    const ingressAllowed = ingress.allowed || nsgIngress.allowed;

    const destSlHopId = ingress.sl ? `sl-${ingress.sl.ocid}` : 'sl-ingress';
    hops.push({
      id: destSlHopId, type: 'SL', label: ingress.sl?.displayName || 'Ingress Security List', resourceType: 'network/security-list', ocid: ingress.sl?.ocid ?? '',
      status: ingressAllowed ? 'ALLOW' : 'DENY',
      details: ingress.allowed
        ? ingress.detail
        : nsgIngress.allowed
          ? `SL denied, but NSG allowed: ${nsgIngress.detail}`
          : `No ingress rule allows traffic from ${sourceIp}${port ? `:${port}` : ''}`,
      metadata: null,
    });
    links.push({ id: 'link-sl-destsl', source: slHopId, target: destSlHopId, status: ingressAllowed ? 'ALLOW' : 'DENY', label: 'ingress rules' });

    // Add NSG hop if SL blocked but NSG allowed
    if (!ingress.allowed && nsgIngress.allowed && nsgIngress.nsg) {
      const nsgHopId = `nsg-ingress-${nsgIngress.nsg.ocid}`;
      hops.push({
        id: nsgHopId, type: 'NSG', label: nsgIngress.nsg.displayName || 'NSG',
        resourceType: 'network/nsg', ocid: nsgIngress.nsg.ocid,
        status: 'ALLOW', details: nsgIngress.detail, metadata: null,
      });
      links.push({ id: `link-sl-${nsgHopId}`, source: slHopId, target: nsgHopId, status: 'ALLOW', label: 'NSG ingress' });
    }

    const destSubHopId = `sub-${destSubnet.ocid}`;
    hops.push({
      id: destSubHopId, type: 'DST', label: destSubnet.displayName || 'Destination Subnet', resourceType: 'network/subnet', ocid: destSubnet.ocid,
      status: ingressAllowed ? 'ALLOW' : 'DENY',
      details: `CIDR: ${destSubnet.rawData?.cidrBlock}`,
      metadata: { cidrBlock: destSubnet.rawData?.cidrBlock },
    });
    links.push({ id: 'link-destsl-dst', source: destSlHopId, target: destSubHopId, status: ingressAllowed ? 'ALLOW' : 'DENY', label: '' });

    if (!ingressAllowed) {
      return { hops, links, verdict: 'BLOCKED', verdictDetail: `Ingress security on destination subnet blocks traffic from ${sourceIp}` };
    }
    return { hops, links, verdict: 'REACHABLE', verdictDetail: `Traffic can flow from ${sourceIp} to ${destinationIp} within VCN` };
  }

  // Gateway hop
  if (matchedRoute) {
    const gwOcid = matchedRoute.networkEntityId;
    const gateway = resources.get(gwOcid);
    if (!gateway) {
      const gwHopId = 'gw-missing';
      hops.push({ id: gwHopId, type: 'GW', label: 'Gateway (not found)', resourceType: 'network/gateway', ocid: gwOcid, status: 'UNKNOWN', details: `Route points to ${gwOcid} but resource not found in snapshot`, metadata: null });
      links.push({ id: 'link-sl-gw', source: slHopId, target: gwHopId, status: 'UNKNOWN', label: '' });
      return { hops, links, verdict: 'UNKNOWN', verdictDetail: `Gateway ${gwOcid} not found in snapshot` };
    }

    const gw = evaluateGateway(gateway);
    const gwHopId = `gw-${gateway.ocid}`;
    hops.push({ id: gwHopId, type: 'GW', label: gateway.displayName || 'Gateway', resourceType: gateway.resourceType, ocid: gateway.ocid, status: gw.allowed ? 'ALLOW' : 'DENY', details: gw.detail, metadata: null });
    links.push({ id: 'link-sl-gw', source: slHopId, target: gwHopId, status: gw.allowed ? 'ALLOW' : 'DENY', label: '' });

    if (!gw.allowed) {
      return { hops, links, verdict: 'BLOCKED', verdictDetail: gw.detail };
    }

    // D15: DRG cross-VCN tracing
    if (gateway.resourceType === 'network/drg') {
      // Find DRG attachments
      const attachments = [...resources.values()].filter(
        r => r.resourceType === 'network/drg-attachment' && r.rawData?.drgId === gateway.ocid
      );

      // Find attachment for a different VCN than source
      const targetAttachment = attachments.find(a => {
        const attachVcnId = a.rawData?.vcnId || a.rawData?.networkDetails?.id;
        return attachVcnId && attachVcnId !== vcnOcid;
      });

      if (targetAttachment) {
        const targetVcnId = targetAttachment.rawData?.vcnId || targetAttachment.rawData?.networkDetails?.id;
        if (targetVcnId) {
          const visitedVcns = new Set<string>();
          if (vcnOcid) visitedVcns.add(vcnOcid);
          const crossResult = continueInTargetVcn(
            resources, targetVcnId, isInternet ? ipToInt('8.8.8.8') : destIpInt,
            destinationIp, srcIpInt, gwHopId, hops, links, visitedVcns, protocol, port,
          );
          return { hops, links, verdict: crossResult.verdict, verdictDetail: crossResult.verdictDetail };
        }
      }

      // No suitable attachment found — fall back to partial
      if (!isInternet) {
        const dstHopId = 'dst-ext';
        hops.push({ id: dstHopId, type: 'DST', label: destinationIp, resourceType: 'external', ocid: '', status: 'ALLOW', details: `External destination: ${destinationIp}`, metadata: null });
        links.push({ id: 'link-gw-dst', source: gwHopId, target: dstHopId, status: 'ALLOW', label: '' });
      }
      return { hops, links, verdict: 'PARTIAL', verdictDetail: `${gw.detail}. No matching DRG attachment for target VCN found.` };
    }

    // D15: LPG cross-VCN tracing
    if (gateway.resourceType === 'network/local-peering-gateway') {
      const peerLpgOcid = gateway.rawData?.peerId;
      const peerLpg = peerLpgOcid ? resources.get(peerLpgOcid) : null;

      if (peerLpg) {
        const peerVcnId = peerLpg.rawData?.vcnId;
        if (peerVcnId) {
          // Add peer LPG hop
          const peerLpgHopId = `gw-peer-${peerLpg.ocid}`;
          hops.push({
            id: peerLpgHopId, type: 'GW',
            label: peerLpg.displayName || 'Peer LPG',
            resourceType: 'network/local-peering-gateway', ocid: peerLpg.ocid,
            status: 'ALLOW', details: 'Peer LPG — receiving end',
            metadata: null,
          });
          links.push({ id: `link-${gwHopId}-${peerLpgHopId}`, source: gwHopId, target: peerLpgHopId, status: 'ALLOW', label: 'peering' });

          const visitedVcns = new Set<string>();
          if (vcnOcid) visitedVcns.add(vcnOcid);
          const crossResult = continueInTargetVcn(
            resources, peerVcnId, isInternet ? ipToInt('8.8.8.8') : destIpInt,
            destinationIp, srcIpInt, peerLpgHopId, hops, links, visitedVcns, protocol, port,
          );
          return { hops, links, verdict: crossResult.verdict, verdictDetail: crossResult.verdictDetail };
        }
      }

      // No peer LPG found — fall back to partial
      if (!isInternet) {
        const dstHopId = 'dst-ext';
        hops.push({ id: dstHopId, type: 'DST', label: destinationIp, resourceType: 'external', ocid: '', status: 'ALLOW', details: `External destination: ${destinationIp}`, metadata: null });
        links.push({ id: 'link-gw-dst', source: gwHopId, target: dstHopId, status: 'ALLOW', label: '' });
      }
      return { hops, links, verdict: 'PARTIAL', verdictDetail: `${gw.detail}. Peer LPG not found in snapshot.` };
    }

    // Non-DRG/LPG gateways (IGW, NAT, SGW)
    if (isInternet) {
      const netHopId = 'net-internet';
      hops.push({ id: netHopId, type: 'NET', label: 'Internet', resourceType: 'internet', ocid: '', status: 'ALLOW', details: '0.0.0.0/0', metadata: null });
      links.push({ id: 'link-gw-net', source: gwHopId, target: netHopId, status: 'ALLOW', label: '' });
    } else {
      const dstHopId = 'dst-ext';
      hops.push({ id: dstHopId, type: 'DST', label: destinationIp, resourceType: 'external', ocid: '', status: 'ALLOW', details: `External destination: ${destinationIp}`, metadata: null });
      links.push({ id: 'link-gw-dst', source: gwHopId, target: dstHopId, status: 'ALLOW', label: '' });
    }
    return { hops, links, verdict: 'REACHABLE', verdictDetail: `Traffic can flow from ${sourceIp} to ${destinationIp}` };
  }

  return { hops, links, verdict: 'UNKNOWN', verdictDetail: 'Analysis could not determine reachability' };
}

// ---------------------------------------------------------------------------
// Mode 2: Source only — fan-out to all route destinations
// ---------------------------------------------------------------------------

function analyzeFromSource(
  resources: ResourceMap,
  sourceIp: string,
  protocol?: string,
  port?: number,
): ReachabilityResult {
  const hops: ReachabilityHop[] = [];
  const links: ReachabilityLink[] = [];

  const srcIpInt = ipToInt(sourceIp);

  // Source hop
  const srcHopId = 'src';
  hops.push({ id: srcHopId, type: 'SRC', label: sourceIp, resourceType: 'source', ocid: '', status: 'ALLOW', details: `Source IP: ${sourceIp}`, metadata: null });

  // Find source subnet
  let sourceSubnet: ResourceRecord | null = null;
  let sourceVcn: ResourceRecord | null = null;
  for (const r of resources.values()) {
    if (r.resourceType === 'network/subnet' && r.rawData?.cidrBlock) {
      try { if (ipInCidr(srcIpInt, parseCidr(r.rawData.cidrBlock))) { sourceSubnet = r; break; } } catch {}
    }
  }
  if (!sourceSubnet) {
    hops[0].status = 'DENY';
    hops[0].details = `No subnet found containing ${sourceIp}`;
    return { hops, links, verdict: 'BLOCKED', verdictDetail: `No subnet found for source IP ${sourceIp}` };
  }
  const vcnOcid = sourceSubnet.rawData?.vcnId;
  if (vcnOcid) sourceVcn = resources.get(vcnOcid) ?? null;

  const subHopId = `sub-${sourceSubnet.ocid}`;
  hops.push({ id: subHopId, type: 'SUB', label: sourceSubnet.displayName || 'Subnet', resourceType: 'network/subnet', ocid: sourceSubnet.ocid, status: 'ALLOW', details: `CIDR: ${sourceSubnet.rawData?.cidrBlock}`, metadata: { cidrBlock: sourceSubnet.rawData?.cidrBlock } });
  links.push({ id: 'link-src-sub', source: srcHopId, target: subHopId, status: 'ALLOW', label: '' });

  // Route table
  const rtOcid = sourceSubnet.rawData?.routeTableId || sourceVcn?.rawData?.defaultRouteTableId;
  const routeTable = rtOcid ? resources.get(rtOcid) : null;
  const rtHopId = routeTable ? `rt-${routeTable.ocid}` : 'rt-missing';

  if (!routeTable) {
    hops.push({ id: rtHopId, type: 'RT', label: 'Route Table (missing)', resourceType: 'network/route-table', ocid: '', status: 'DENY', details: 'No route table found for subnet', metadata: null });
    links.push({ id: 'link-sub-rt', source: subHopId, target: rtHopId, status: 'DENY', label: 'no route table' });
    return { hops, links, verdict: 'BLOCKED', verdictDetail: 'No route table found for source subnet' };
  }

  const routeRules: any[] = routeTable.rawData?.routeRules ?? [];
  hops.push({
    id: rtHopId, type: 'RT', label: routeTable.displayName || 'Route Table', resourceType: 'network/route-table', ocid: routeTable.ocid, status: 'ALLOW',
    details: `${routeRules.length} route rule(s)`, metadata: { rulesCount: routeRules.length },
  });
  links.push({ id: 'link-sub-rt', source: subHopId, target: rtHopId, status: 'ALLOW', label: 'routes via' });

  let reachableCount = 0;
  let blockedCount = 0;

  // Fan out: each route rule becomes a branch
  const seenGateways = new Set<string>();
  for (let i = 0; i < routeRules.length; i++) {
    const rule = routeRules[i];
    const destCidr = rule.destination ?? rule.cidrBlock ?? '0.0.0.0/0';
    const gwOcid: string = rule.networkEntityId ?? '';
    const branchId = `route-${i}`;

    // Pick a representative IP for egress security check
    const reprIpInt = destCidr === '0.0.0.0/0' ? ipToInt('8.8.8.8') : ipToInt(destCidr.split('/')[0]);

    // Egress security — SL + NSG combined (D14)
    const egress = checkEgressSecurity(resources, sourceSubnet!, reprIpInt, protocol, port);
    const nsgEgress = checkNsgEgressSecurity(resources, vcnOcid, reprIpInt, protocol, port);
    const egressAllowed = egress.allowed || nsgEgress.allowed;

    const gateway = resources.get(gwOcid);
    const gw = gateway ? evaluateGateway(gateway) : null;
    const gwLabel = gateway ? (gateway.displayName || gatewayTypeLabel(gateway.resourceType)) : 'Unknown GW';

    // Determine overall status for this branch
    let branchStatus: HopStatus = 'ALLOW';
    let branchDetail = '';
    if (!egressAllowed) {
      branchStatus = 'DENY';
      branchDetail = 'Blocked by egress security (SL + NSG)';
    } else if (!gateway) {
      branchStatus = 'UNKNOWN';
      branchDetail = `Gateway ${gwOcid} not in snapshot`;
    } else if (!gw!.allowed) {
      branchStatus = 'DENY';
      branchDetail = gw!.detail;
    } else {
      branchDetail = gw!.detail;
    }

    if (branchStatus === 'ALLOW') reachableCount++;
    else blockedCount++;

    // Create a combined gateway+destination node per unique gateway
    const gwNodeId = gateway ? `gw-${gateway.ocid}` : `gw-unknown-${i}`;
    if (!seenGateways.has(gwNodeId)) {
      seenGateways.add(gwNodeId);
      hops.push({
        id: gwNodeId, type: 'GW', label: gwLabel, resourceType: gateway?.resourceType ?? 'network/gateway', ocid: gateway?.ocid ?? gwOcid,
        status: branchStatus, details: branchDetail, metadata: null,
      });
      links.push({ id: `link-rt-${gwNodeId}`, source: rtHopId, target: gwNodeId, status: egressAllowed ? 'ALLOW' : 'DENY', label: destCidr });
    }

    // Destination node for this route rule
    const isDefaultRoute = destCidr === '0.0.0.0/0';
    const dstNodeId = isDefaultRoute ? `dst-internet-${i}` : `dst-${branchId}`;
    const dstLabel = isDefaultRoute ? 'Internet' : destCidr;
    hops.push({
      id: dstNodeId, type: isDefaultRoute ? 'NET' : 'DST', label: dstLabel, resourceType: isDefaultRoute ? 'internet' : 'external', ocid: '',
      status: branchStatus, details: destCidr, metadata: null,
    });
    links.push({ id: `link-${gwNodeId}-${dstNodeId}`, source: gwNodeId, target: dstNodeId, status: branchStatus, label: '' });
  }

  // Also show intra-VCN subnets that are reachable
  const subnets = getSubnets(resources);
  for (const sub of subnets) {
    if (sub.ocid === sourceSubnet.ocid) continue;
    if (sub.rawData?.vcnId !== vcnOcid) continue;

    const reprDestIpInt = ipToInt(sub.rawData.cidrBlock.split('/')[0]);
    const egress = checkEgressSecurity(resources, sourceSubnet, reprDestIpInt, protocol, port);
    const nsgEgress = checkNsgEgressSecurity(resources, vcnOcid, reprDestIpInt, protocol, port);
    const egressAllowed = egress.allowed || nsgEgress.allowed;

    const ingress = checkIngressSecurity(resources, sub, srcIpInt, protocol, port);
    const nsgIngress = checkNsgIngressSecurity(resources, sub.rawData?.vcnId, srcIpInt, protocol, port);
    const ingressAllowed = ingress.allowed || nsgIngress.allowed;

    const status: HopStatus = egressAllowed && ingressAllowed ? 'ALLOW' : 'DENY';
    if (status === 'ALLOW') reachableCount++;
    else blockedCount++;

    const dstSubId = `dst-sub-${sub.ocid}`;
    hops.push({
      id: dstSubId, type: 'DST', label: sub.displayName || sub.rawData.cidrBlock, resourceType: 'network/subnet', ocid: sub.ocid,
      status, details: `${sub.rawData.cidrBlock} (intra-VCN)${!egressAllowed ? ' — blocked by egress security' : !ingressAllowed ? ' — blocked by ingress security' : ''}`,
      metadata: { cidrBlock: sub.rawData.cidrBlock },
    });
    links.push({ id: `link-rt-${dstSubId}`, source: rtHopId, target: dstSubId, status, label: 'intra-VCN' });
  }

  const total = reachableCount + blockedCount;
  const verdict: Verdict = reachableCount === 0 ? 'BLOCKED' : blockedCount === 0 ? 'REACHABLE' : 'PARTIAL';
  const verdictDetail = `${reachableCount} of ${total} destination(s) reachable from ${sourceIp}`;
  return { hops, links, verdict, verdictDetail };
}

// ---------------------------------------------------------------------------
// Mode 3: Destination only — fan-in from all subnets
// ---------------------------------------------------------------------------

function analyzeToDestination(
  resources: ResourceMap,
  destinationIp: string,
  protocol?: string,
  port?: number,
): ReachabilityResult {
  const hops: ReachabilityHop[] = [];
  const links: ReachabilityLink[] = [];

  const isInternet = destinationIp.toLowerCase() === 'internet' || destinationIp === '0.0.0.0/0';
  const destIpInt = isInternet ? ipToInt('8.8.8.8') : ipToInt(destinationIp.split('/')[0]);

  // Find destination subnet for intra-VCN checks
  let destSubnet: ResourceRecord | null = null;
  if (!isInternet) {
    for (const r of resources.values()) {
      if (r.resourceType === 'network/subnet' && r.rawData?.cidrBlock) {
        try { if (ipInCidr(destIpInt, parseCidr(r.rawData.cidrBlock))) { destSubnet = r; break; } } catch {}
      }
    }
  }

  // Destination node (center/right of graph)
  const dstHopId = 'dst';
  const dstLabel = isInternet ? 'Internet' : (destSubnet ? (destSubnet.displayName || destinationIp) : destinationIp);
  hops.push({
    id: dstHopId, type: isInternet ? 'NET' : 'DST', label: dstLabel,
    resourceType: isInternet ? 'internet' : (destSubnet ? 'network/subnet' : 'external'), ocid: destSubnet?.ocid ?? '',
    status: 'ALLOW', details: isInternet ? '0.0.0.0/0' : `Destination: ${destinationIp}`, metadata: null,
  });

  let reachableCount = 0;
  let blockedCount = 0;

  const subnets = getSubnets(resources);
  for (const subnet of subnets) {
    // Skip the destination subnet itself
    if (destSubnet && subnet.ocid === destSubnet.ocid) continue;

    const cidr = subnet.rawData?.cidrBlock;
    if (!cidr) continue;
    // Use first usable IP in subnet as representative source
    const subnetCidr = parseCidr(cidr);
    const reprSrcIpInt = (subnetCidr.network + 1) >>> 0;

    const vcnOcid = subnet.rawData?.vcnId;
    const vcn = vcnOcid ? resources.get(vcnOcid) : null;
    const isIntraVcn = destSubnet && destSubnet.rawData?.vcnId === vcnOcid;

    // Route table
    const rtOcid = subnet.rawData?.routeTableId || vcn?.rawData?.defaultRouteTableId;
    const routeTable = rtOcid ? resources.get(rtOcid) : null;

    if (!routeTable && !isIntraVcn) {
      blockedCount++;
      const subNodeId = `src-sub-${subnet.ocid}`;
      hops.push({ id: subNodeId, type: 'SUB', label: subnet.displayName || cidr, resourceType: 'network/subnet', ocid: subnet.ocid, status: 'DENY', details: `${cidr} — no route table`, metadata: { cidrBlock: cidr } });
      links.push({ id: `link-${subNodeId}-dst`, source: subNodeId, target: dstHopId, status: 'DENY', label: 'no route' });
      continue;
    }

    // Check route
    let hasRoute = false;
    if (isIntraVcn) {
      hasRoute = true; // implicit local route
    } else if (routeTable) {
      const routeRules: any[] = routeTable.rawData?.routeRules ?? [];
      const candidates: RouteCandidate[] = routeRules.map((rule: any) => ({
        cidr: parseCidr(rule.destination ?? rule.cidrBlock ?? '0.0.0.0/0'),
        networkEntityId: rule.networkEntityId ?? '',
        raw: rule,
      }));
      hasRoute = longestPrefixMatch(destIpInt, candidates) !== null;
    }

    if (!hasRoute) {
      blockedCount++;
      const subNodeId = `src-sub-${subnet.ocid}`;
      hops.push({ id: subNodeId, type: 'SUB', label: subnet.displayName || cidr, resourceType: 'network/subnet', ocid: subnet.ocid, status: 'DENY', details: `${cidr} — no matching route`, metadata: { cidrBlock: cidr } });
      links.push({ id: `link-${subNodeId}-dst`, source: subNodeId, target: dstHopId, status: 'DENY', label: 'no route' });
      continue;
    }

    // Egress security — SL + NSG combined (D14)
    const egress = checkEgressSecurity(resources, subnet, destIpInt, protocol, port);
    const nsgEgress = checkNsgEgressSecurity(resources, vcnOcid, destIpInt, protocol, port);
    const egressAllowed = egress.allowed || nsgEgress.allowed;

    // Ingress security (only for intra-VCN) — SL + NSG combined (D14)
    let ingressOk = true;
    if (isIntraVcn && destSubnet) {
      const ingress = checkIngressSecurity(resources, destSubnet, reprSrcIpInt, protocol, port);
      const nsgIngress = checkNsgIngressSecurity(resources, destSubnet.rawData?.vcnId, reprSrcIpInt, protocol, port);
      ingressOk = ingress.allowed || nsgIngress.allowed;
    }

    const status: HopStatus = egressAllowed && ingressOk ? 'ALLOW' : 'DENY';
    if (status === 'ALLOW') reachableCount++;
    else blockedCount++;

    let detail = cidr;
    if (!egressAllowed) detail += ' — blocked by egress security';
    else if (!ingressOk) detail += ' — blocked by ingress security';

    const subNodeId = `src-sub-${subnet.ocid}`;
    hops.push({
      id: subNodeId, type: 'SUB', label: subnet.displayName || cidr, resourceType: 'network/subnet', ocid: subnet.ocid,
      status, details: detail, metadata: { cidrBlock: cidr },
    });
    links.push({ id: `link-${subNodeId}-dst`, source: subNodeId, target: dstHopId, status, label: isIntraVcn ? 'intra-VCN' : '' });
  }

  const total = reachableCount + blockedCount;
  const verdict: Verdict = reachableCount === 0 ? 'BLOCKED' : blockedCount === 0 ? 'REACHABLE' : 'PARTIAL';
  const verdictDetail = `${reachableCount} of ${total} subnet(s) can reach ${destinationIp}`;
  return { hops, links, verdict, verdictDetail };
}

// ---------------------------------------------------------------------------
// Main entry point — dispatches to the appropriate mode
// ---------------------------------------------------------------------------

export async function analyzeReachability(
  prisma: PrismaClient,
  snapshotId: string,
  sourceIp?: string,
  destinationIp?: string,
  protocol?: string,
  port?: number,
): Promise<ReachabilityResult> {
  const resources = await loadNetworkResources(prisma, snapshotId);

  if (sourceIp && destinationIp) {
    return analyzePair(resources, sourceIp, destinationIp, protocol, port);
  }
  if (sourceIp) {
    return analyzeFromSource(resources, sourceIp, protocol, port);
  }
  if (destinationIp) {
    return analyzeToDestination(resources, destinationIp, protocol, port);
  }

  return { hops: [], links: [], verdict: 'UNKNOWN', verdictDetail: 'Provide at least a source IP or destination IP' };
}
