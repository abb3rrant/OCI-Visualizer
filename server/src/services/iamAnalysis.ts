import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------
// In-memory cache (same pattern as audit.ts)
// ---------------------------------------------------------------

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  result: IamAnalysisResult;
  resourceCount: number;
  timestamp: number;
}

const iamCache = new Map<string, CacheEntry>();

export function invalidateIamCache(snapshotId: string): void {
  for (const key of iamCache.keys()) {
    if (key.startsWith(snapshotId + ':')) iamCache.delete(key);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of iamCache) {
    if (now - entry.timestamp > CACHE_TTL_MS) iamCache.delete(key);
  }
}, CACHE_TTL_MS);

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
type IamVerb = 'manage' | 'use' | 'read' | 'inspect';

interface ParsedStatement {
  raw: string;
  policyName: string;
  policyOcid: string;
  subject: string;
  subjectType: 'group' | 'dynamic-group' | 'any-user' | 'service';
  verb: IamVerb;
  resourceType: string;
  scope: string;
  conditions: string | null;
  parsed: boolean;
}

interface IamGraphNode {
  id: string;
  type: 'user' | 'group' | 'dynamic-group' | 'policy' | 'permission';
  label: string;
  ocid: string;
  metadata: Record<string, unknown>;
}

interface IamGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  edgeType: string;
  verb: string | null;
}

interface IamFinding {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
  attackPath: string[];
  attackPathNodeIds: string[];
  resources: { id: string; ocid: string; name: string | null }[];
  framework?: string | null;
}

// CIS OCI Foundations Benchmark mapping
const CIS_IAM_MAPPINGS: Record<string, string> = {
  'Tenancy-wide admin privileges': 'CIS 1.1.1',
  'Privilege escalation: can modify IAM policies': 'CIS 1.1.2',
  'Privilege escalation: can manage users/groups': 'CIS 1.1.3',
  'Admin user without MFA': 'CIS 1.2',
  'Stale API key (>90 days old)': 'CIS 1.3',
  'Dynamic group with broad matching rule': 'CIS 1.5',
  'Orphaned user: no group membership': 'CIS 1.7',
};

interface IamSummary {
  totalUsers: number;
  totalPolicies: number;
  criticalPaths: number;
  privEscPaths: number;
}

interface EffectivePermission {
  verb: IamVerb;
  resourceType: string;
  scope: string;
  policyName: string;
  conditions: string | null;
}

interface IamPrincipal {
  id: string;
  ocid: string;
  name: string;
  principalType: 'user' | 'dynamic-group';
  riskLevel: Severity;
  groups: string[];
  permissions: EffectivePermission[];
  // Dynamic group deep dive
  matchingRule?: string | null;
  matchedInstanceCount?: number | null;
  ruleAnalysis?: string | null;
  // Blast radius
  blastRadiusNodeIds?: string[];
}

export interface IamAnalysisResult {
  graph: { nodes: IamGraphNode[]; edges: IamGraphEdge[] };
  findings: IamFinding[];
  summary: IamSummary;
  principals: IamPrincipal[];
  statements: ParsedStatement[];
}

// ---------------------------------------------------------------
// OCI policy statement parser
// ---------------------------------------------------------------

const VERB_HIERARCHY: IamVerb[] = ['inspect', 'read', 'use', 'manage'];

// Allow <subject> to <verb> <resource-type> in <scope> [where <conditions>]
const POLICY_REGEX =
  /^\s*allow\s+(any-user|service\s+[\w.-]+|(?:dynamic-)?group\s+(?:(?:id\s+)?[\w.'/-]+(?:\s*,\s*(?:id\s+)?[\w.'/-]+)*))\s+to\s+(inspect|read|use|manage)\s+([\w-]+)\s+in\s+(tenancy|compartment\s+(?:id\s+)?[\w.'/-]+)(?:\s+where\s+(.+))?\s*$/i;

function parseStatements(
  policyName: string,
  policyOcid: string,
  statementsJson: string | null,
): ParsedStatement[] {
  if (!statementsJson) return [];
  let statements: string[];
  try {
    statements = JSON.parse(statementsJson);
  } catch {
    return [];
  }
  if (!Array.isArray(statements)) return [];

  return statements.map((raw) => {
    const match = raw.match(POLICY_REGEX);
    if (!match) {
      return {
        raw,
        policyName,
        policyOcid,
        subject: '',
        subjectType: 'group' as const,
        verb: 'inspect' as IamVerb,
        resourceType: '',
        scope: '',
        conditions: null,
        parsed: false,
      };
    }

    const [, subjectRaw, verb, resourceType, scope, conditions] = match;
    let subject = subjectRaw.trim();
    let subjectType: ParsedStatement['subjectType'] = 'group';

    if (/^any-user$/i.test(subject)) {
      subjectType = 'any-user';
    } else if (/^service\s+/i.test(subject)) {
      subjectType = 'service';
      subject = subject.replace(/^service\s+/i, '').trim();
    } else if (/^dynamic-group\s+/i.test(subject)) {
      subjectType = 'dynamic-group';
      subject = subject.replace(/^dynamic-group\s+/i, '').trim();
    } else {
      subject = subject.replace(/^group\s+/i, '').trim();
    }

    return {
      raw,
      policyName,
      policyOcid,
      subject,
      subjectType,
      verb: verb.toLowerCase() as IamVerb,
      resourceType: resourceType.toLowerCase(),
      scope: scope.toLowerCase(),
      conditions: conditions?.trim() || null,
      parsed: true,
    };
  });
}

// ---------------------------------------------------------------
// Graph builder & analysis engine
// ---------------------------------------------------------------

interface ResourceRow {
  id: string;
  ocid: string;
  resourceType: string;
  displayName: string | null;
  rawData: string;
  lifecycleState: string | null;
  timeCreated: string | null;
  compartmentId: string | null;
}

interface RelationRow {
  fromResourceId: string;
  toResourceId: string;
  relationType: string;
}

export async function runIamAnalysis(
  prisma: PrismaClient,
  snapshotId: string,
): Promise<IamAnalysisResult> {
  const cacheKey = `${snapshotId}:`;
  const resourceCount = await prisma.resource.count({ where: { snapshotId } });
  const cached = iamCache.get(cacheKey);
  if (
    cached &&
    cached.resourceCount === resourceCount &&
    Date.now() - cached.timestamp < CACHE_TTL_MS
  ) {
    return cached.result;
  }

  // Load IAM resources
  const iamTypes = [
    'iam/policy',
    'iam/user',
    'iam/group',
    'iam/dynamic-group',
    'iam/api-key',
    'iam/auth-token',
    'iam/user-group-membership',
  ];

  const infraTypes = [
    'network/security-list',
    'network/network-security-group',
    'vcn/subnet',
    'compute/instance',
    'iam/compartment',
  ];

  const selectFields = {
    id: true,
    ocid: true,
    resourceType: true,
    displayName: true,
    rawData: true,
    lifecycleState: true,
    timeCreated: true,
    compartmentId: true,
  };

  const [iamRows, infraRows] = await Promise.all([
    prisma.resource.findMany({
      where: { snapshotId, resourceType: { in: iamTypes } },
      select: selectFields,
    }),
    prisma.resource.findMany({
      where: { snapshotId, resourceType: { in: infraTypes } },
      select: selectFields,
    }),
  ]);

  const resources = [...iamRows, ...infraRows] as ResourceRow[];

  // Only query relations for IAM resources (user→group membership)
  // Infra resources don't need relation lookups
  const iamResourceIds = iamRows.map((r) => r.id);
  const relations = (await prisma.resourceRelation.findMany({
    where: {
      OR: [
        { fromResourceId: { in: iamResourceIds } },
        { toResourceId: { in: iamResourceIds } },
      ],
    },
    select: { fromResourceId: true, toResourceId: true, relationType: true },
  })) as RelationRow[];

  // Index resources
  const byType = new Map<string, ResourceRow[]>();
  const byId = new Map<string, ResourceRow>();
  for (const r of resources) {
    byId.set(r.id, r);
    const list = byType.get(r.resourceType) || [];
    list.push(r);
    byType.set(r.resourceType, list);
  }

  const policies = byType.get('iam/policy') || [];
  const users = byType.get('iam/user') || [];
  const groups = byType.get('iam/group') || [];
  const dynamicGroups = byType.get('iam/dynamic-group') || [];
  const apiKeys = byType.get('iam/api-key') || [];
  const securityLists = byType.get('network/security-list') || [];
  const nsgs = byType.get('network/network-security-group') || [];
  const subnets = byType.get('vcn/subnet') || [];
  const instances = byType.get('compute/instance') || [];
  const compartments = byType.get('iam/compartment') || [];

  // Compartment name→OCID map
  const compartmentNameToOcid = new Map<string, string>();
  const compartmentOcidToName = new Map<string, string>();
  for (const c of compartments) {
    if (c.displayName) {
      compartmentNameToOcid.set(c.displayName.toLowerCase(), c.ocid);
      compartmentOcidToName.set(c.ocid, c.displayName);
    }
  }

  // Build group membership: user→groups via belongs-to relations + membership resources
  const userGroups = new Map<string, string[]>(); // userId -> groupIds
  const groupNameToId = new Map<string, string>(); // lowered displayName -> resource id
  const dgNameToId = new Map<string, string>();

  for (const g of groups) {
    if (g.displayName) groupNameToId.set(g.displayName.toLowerCase(), g.id);
  }
  for (const dg of dynamicGroups) {
    if (dg.displayName) dgNameToId.set(dg.displayName.toLowerCase(), dg.id);
  }

  // OCID→DB-ID map for resolving membership rawData references
  const ocidToDbId = new Map<string, string>();
  for (const r of resources) {
    ocidToDbId.set(r.ocid, r.id);
  }

  // 1) From belongs-to relations (built by relationship.ts)
  for (const rel of relations) {
    if (rel.relationType === 'belongs-to') {
      const fromRes = byId.get(rel.fromResourceId);
      const toRes = byId.get(rel.toResourceId);
      if (fromRes?.resourceType === 'iam/user' && toRes?.resourceType === 'iam/group') {
        const existing = userGroups.get(fromRes.id) || [];
        existing.push(toRes.id);
        userGroups.set(fromRes.id, existing);
      }
    }
  }

  // 2) Directly from iam/user-group-membership resources (fallback if
  //    relations weren't built or rawData OCIDs didn't resolve earlier)
  const memberships = byType.get('iam/user-group-membership') || [];
  for (const m of memberships) {
    try {
      const raw = JSON.parse(m.rawData);
      const userOcid = raw.userId;
      const groupOcid = raw.groupId;
      if (!userOcid || !groupOcid) continue;
      const userDbId = ocidToDbId.get(userOcid);
      const groupDbId = ocidToDbId.get(groupOcid);
      if (userDbId && groupDbId) {
        const existing = userGroups.get(userDbId) || [];
        if (!existing.includes(groupDbId)) {
          existing.push(groupDbId);
          userGroups.set(userDbId, existing);
        }
      }
    } catch {
      // skip malformed rawData
    }
  }

  // Parse all policy statements
  const allStatements: ParsedStatement[] = [];
  for (const p of policies) {
    let statementsJson: string | null = null;
    try {
      const raw = JSON.parse(p.rawData);
      statementsJson = JSON.stringify(raw.statements || []);
    } catch {
      // skip
    }
    allStatements.push(...parseStatements(p.displayName || p.ocid, p.ocid, statementsJson));
  }

  // Match statements to groups/dynamic-groups
  const groupStatements = new Map<string, ParsedStatement[]>(); // groupId -> statements
  const dgStatements = new Map<string, ParsedStatement[]>();
  const anyUserStatements: ParsedStatement[] = [];

  for (const stmt of allStatements) {
    if (!stmt.parsed) continue;

    if (stmt.subjectType === 'any-user') {
      anyUserStatements.push(stmt);
      continue;
    }
    if (stmt.subjectType === 'service') continue;

    // Handle comma-separated subjects
    const subjects = stmt.subject.split(',').map((s) => s.trim().toLowerCase());
    for (const subjectName of subjects) {
      const cleanName = subjectName.replace(/^id\s+/, '').replace(/'/g, '');
      if (stmt.subjectType === 'dynamic-group') {
        const dgId = dgNameToId.get(cleanName);
        if (dgId) {
          const list = dgStatements.get(dgId) || [];
          list.push(stmt);
          dgStatements.set(dgId, list);
        }
      } else {
        const gId = groupNameToId.get(cleanName);
        if (gId) {
          const list = groupStatements.get(gId) || [];
          list.push(stmt);
          groupStatements.set(gId, list);
        }
      }
    }
  }

  // Build effective permissions per user
  const principals: IamPrincipal[] = [];

  for (const user of users) {
    const gIds = userGroups.get(user.id) || [];
    const permissions: EffectivePermission[] = [];

    // Permissions from group memberships
    for (const gId of gIds) {
      const stmts = groupStatements.get(gId) || [];
      for (const s of stmts) {
        permissions.push({
          verb: s.verb,
          resourceType: s.resourceType,
          scope: s.scope,
          policyName: s.policyName,
          conditions: s.conditions,
        });
      }
    }

    // any-user statements apply to all
    for (const s of anyUserStatements) {
      permissions.push({
        verb: s.verb,
        resourceType: s.resourceType,
        scope: s.scope,
        policyName: s.policyName,
        conditions: s.conditions,
      });
    }

    const riskLevel = computeRiskLevel(permissions);
    principals.push({
      id: user.id,
      ocid: user.ocid,
      name: user.displayName || user.ocid,
      principalType: 'user',
      riskLevel,
      groups: gIds.map((gId) => byId.get(gId)?.displayName || gId),
      permissions,
    });
  }

  // Dynamic groups as principals (with deep dive)
  for (const dg of dynamicGroups) {
    const stmts = dgStatements.get(dg.id) || [];
    const permissions: EffectivePermission[] = stmts.map((s) => ({
      verb: s.verb,
      resourceType: s.resourceType,
      scope: s.scope,
      policyName: s.policyName,
      conditions: s.conditions,
    }));

    // Parse matching rule for deep dive
    let matchingRule: string | null = null;
    let matchedInstanceCount: number | null = null;
    let ruleAnalysis: string | null = null;
    try {
      const raw = JSON.parse(dg.rawData);
      matchingRule = raw.matchingRule || null;
      if (matchingRule) {
        // Classify rule broadness
        if (/instance\.id\s*=/i.test(matchingRule)) {
          ruleAnalysis = 'Narrow: matches specific instance OCIDs';
          // Count matching instances by OCID reference
          const ocidMatches = matchingRule.match(/ocid1\.instance\.[^'"]*/gi) || [];
          matchedInstanceCount = ocidMatches.length;
        } else if (/any\s*\{/i.test(matchingRule)) {
          ruleAnalysis = 'Broad: uses Any{} - matches all instances in referenced compartments';
          // Estimate by compartment references
          const compartmentRefs = matchingRule.match(/ocid1\.compartment\.[^'")}]*/gi) || [];
          matchedInstanceCount = 0;
          for (const inst of instances) {
            if (compartmentRefs.length === 0 || compartmentRefs.some((c) => inst.compartmentId === c.trim())) {
              matchedInstanceCount++;
            }
          }
        } else if (/instance\.compartment\.id/i.test(matchingRule)) {
          ruleAnalysis = 'Medium: matches by compartment membership';
          const compartmentRefs = matchingRule.match(/ocid1\.compartment\.[^'")}]*/gi) || [];
          matchedInstanceCount = 0;
          for (const inst of instances) {
            if (compartmentRefs.some((c) => inst.compartmentId === c.trim())) {
              matchedInstanceCount++;
            }
          }
        } else {
          ruleAnalysis = 'Unknown pattern - manual review recommended';
        }
      }
    } catch { /* skip */ }

    const riskLevel = computeRiskLevel(permissions);
    principals.push({
      id: dg.id,
      ocid: dg.ocid,
      name: dg.displayName || dg.ocid,
      principalType: 'dynamic-group',
      riskLevel,
      groups: [],
      permissions,
      matchingRule,
      matchedInstanceCount,
      ruleAnalysis,
    });
  }

  // Build graph
  const graph = buildGraph(
    users,
    groups,
    dynamicGroups,
    policies,
    userGroups,
    groupStatements,
    dgStatements,
    anyUserStatements,
    allStatements,
    byId,
  );

  // Compute blast radius for each principal via BFS
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = adjacency.get(edge.source) || [];
    list.push(edge.target);
    adjacency.set(edge.source, list);
  }
  for (const p of principals) {
    const visited = new Set<string>();
    const queue = [p.id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const neighbors = adjacency.get(current) || [];
      for (const n of neighbors) {
        if (!visited.has(n)) queue.push(n);
      }
    }
    visited.delete(p.id); // exclude self
    p.blastRadiusNodeIds = [...visited];
  }

  // Build attack path context for findings
  const policyNameToId = new Map<string, string>();
  for (const p of policies) {
    if (p.displayName) policyNameToId.set(p.displayName.toLowerCase(), p.id);
  }
  const attackPathCtx: AttackPathContext = { groupNameToId, policyNameToId };

  // Run findings checks
  const findings = runFindings(
    principals,
    allStatements,
    anyUserStatements,
    users,
    groups,
    dynamicGroups,
    apiKeys,
    userGroups,
    byId,
    securityLists,
    subnets,
    instances,
    compartmentNameToOcid,
    compartmentOcidToName,
    dgStatements,
    attackPathCtx,
  );

  const summary: IamSummary = {
    totalUsers: users.length,
    totalPolicies: policies.length,
    criticalPaths: findings.filter((f) => f.severity === 'CRITICAL').length,
    privEscPaths: findings.filter(
      (f) => f.id.startsWith('F2') || f.id.startsWith('F3'),
    ).length,
  };

  const result: IamAnalysisResult = {
    graph,
    findings,
    summary,
    principals,
    statements: allStatements,
  };

  iamCache.set(cacheKey, { result, resourceCount, timestamp: Date.now() });
  return result;
}

// ---------------------------------------------------------------
// Risk level computation
// ---------------------------------------------------------------

function computeRiskLevel(permissions: EffectivePermission[]): Severity {
  for (const p of permissions) {
    if (
      p.verb === 'manage' &&
      p.resourceType === 'all-resources' &&
      p.scope === 'tenancy'
    ) {
      return 'CRITICAL';
    }
  }
  for (const p of permissions) {
    if (
      p.verb === 'manage' &&
      (p.resourceType === 'policies' ||
        p.resourceType === 'users' ||
        p.resourceType === 'groups') &&
      p.scope === 'tenancy'
    ) {
      return 'CRITICAL';
    }
  }
  for (const p of permissions) {
    if (p.verb === 'manage' && p.scope === 'tenancy') {
      return 'HIGH';
    }
  }
  for (const p of permissions) {
    if (p.verb === 'manage') {
      return 'MEDIUM';
    }
  }
  if (permissions.length > 0) return 'LOW';
  return 'INFO';
}

// ---------------------------------------------------------------
// Graph builder
// ---------------------------------------------------------------

function buildGraph(
  users: ResourceRow[],
  groups: ResourceRow[],
  dynamicGroups: ResourceRow[],
  policies: ResourceRow[],
  userGroups: Map<string, string[]>,
  groupStatements: Map<string, ParsedStatement[]>,
  dgStatements: Map<string, ParsedStatement[]>,
  anyUserStatements: ParsedStatement[],
  allStatements: ParsedStatement[],
  byId: Map<string, ResourceRow>,
): { nodes: IamGraphNode[]; edges: IamGraphEdge[] } {
  const nodes: IamGraphNode[] = [];
  const edges: IamGraphEdge[] = [];
  const permNodeIds = new Set<string>();

  // User nodes
  for (const u of users) {
    nodes.push({
      id: u.id,
      type: 'user',
      label: u.displayName || u.ocid,
      ocid: u.ocid,
      metadata: {},
    });
  }

  // Group nodes
  for (const g of groups) {
    nodes.push({
      id: g.id,
      type: 'group',
      label: g.displayName || g.ocid,
      ocid: g.ocid,
      metadata: {},
    });
  }

  // Dynamic group nodes
  for (const dg of dynamicGroups) {
    nodes.push({
      id: dg.id,
      type: 'dynamic-group',
      label: dg.displayName || dg.ocid,
      ocid: dg.ocid,
      metadata: {},
    });
  }

  // Policy nodes
  for (const p of policies) {
    nodes.push({
      id: p.id,
      type: 'policy',
      label: p.displayName || p.ocid,
      ocid: p.ocid,
      metadata: {},
    });
  }

  // User → Group edges
  for (const [userId, gIds] of userGroups) {
    for (const gId of gIds) {
      edges.push({
        id: `${userId}->${gId}`,
        source: userId,
        target: gId,
        label: 'member-of',
        edgeType: 'membership',
        verb: null,
      });
    }
  }

  // Group → Policy → Permission edges
  const policyIdByOcid = new Map<string, string>();
  for (const p of policies) policyIdByOcid.set(p.ocid, p.id);

  for (const [gId, stmts] of groupStatements) {
    const policyIds = new Set<string>();
    for (const s of stmts) {
      const pId = policyIdByOcid.get(s.policyOcid);
      if (pId && !policyIds.has(pId)) {
        policyIds.add(pId);
        edges.push({
          id: `${gId}->${pId}`,
          source: gId,
          target: pId,
          label: 'granted-by',
          edgeType: 'policy-link',
          verb: null,
        });
      }

      // Permission node
      const permId = `perm-${s.verb}-${s.resourceType}-${s.scope}`;
      if (!permNodeIds.has(permId)) {
        permNodeIds.add(permId);
        nodes.push({
          id: permId,
          type: 'permission',
          label: `${s.verb} ${s.resourceType}`,
          ocid: '',
          metadata: { verb: s.verb, resourceType: s.resourceType, scope: s.scope },
        });
      }
      if (pId) {
        const edgeId = `${pId}->${permId}`;
        if (!edges.some((e) => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            source: pId,
            target: permId,
            label: s.verb,
            edgeType: 'permission',
            verb: s.verb,
          });
        }
      }
    }
  }

  // Dynamic group → Policy → Permission edges
  for (const [dgId, stmts] of dgStatements) {
    const policyIds = new Set<string>();
    for (const s of stmts) {
      const pId = policyIdByOcid.get(s.policyOcid);
      if (pId && !policyIds.has(pId)) {
        policyIds.add(pId);
        edges.push({
          id: `${dgId}->${pId}`,
          source: dgId,
          target: pId,
          label: 'granted-by',
          edgeType: 'policy-link',
          verb: null,
        });
      }

      const permId = `perm-${s.verb}-${s.resourceType}-${s.scope}`;
      if (!permNodeIds.has(permId)) {
        permNodeIds.add(permId);
        nodes.push({
          id: permId,
          type: 'permission',
          label: `${s.verb} ${s.resourceType}`,
          ocid: '',
          metadata: { verb: s.verb, resourceType: s.resourceType, scope: s.scope },
        });
      }
      if (pId) {
        const edgeId = `${pId}->${permId}`;
        if (!edges.some((e) => e.id === edgeId)) {
          edges.push({
            id: edgeId,
            source: pId,
            target: permId,
            label: s.verb,
            edgeType: 'permission',
            verb: s.verb,
          });
        }
      }
    }
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------
// Findings checks
// ---------------------------------------------------------------

function runFindings(
  principals: IamPrincipal[],
  allStatements: ParsedStatement[],
  anyUserStatements: ParsedStatement[],
  users: ResourceRow[],
  groups: ResourceRow[],
  dynamicGroups: ResourceRow[],
  apiKeys: ResourceRow[],
  userGroups: Map<string, string[]>,
  byId: Map<string, ResourceRow>,
  securityLists: ResourceRow[],
  subnets: ResourceRow[],
  instances: ResourceRow[],
  compartmentNameToOcid: Map<string, string>,
  compartmentOcidToName: Map<string, string>,
  dgStatements: Map<string, ParsedStatement[]>,
  attackPathCtx: AttackPathContext,
): IamFinding[] {
  const findings: IamFinding[] = [];
  let findingIdx = 0;

  // F1: manage all-resources in tenancy
  for (const p of principals) {
    const manageAll = p.permissions.find(
      (perm) =>
        perm.verb === 'manage' &&
        perm.resourceType === 'all-resources' &&
        perm.scope === 'tenancy',
    );
    if (manageAll) {
      const ap = buildAttackPath(p, manageAll, attackPathCtx);
      findings.push({
        id: `F1-${findingIdx++}`,
        severity: 'CRITICAL',
        title: 'Tenancy-wide admin privileges',
        description: `${p.principalType} "${p.name}" has manage all-resources in tenancy via policy "${manageAll.policyName}". This grants full administrative access.`,
        recommendation:
          'Apply least-privilege: scope permissions to specific compartments and resource types.',
        attackPath: ap.labels,
        attackPathNodeIds: ap.nodeIds,
        resources: [{ id: p.id, ocid: p.ocid, name: p.name }],
      });
    }
  }

  // F2: Can modify IAM policies (priv-esc)
  for (const p of principals) {
    const managePolicies = p.permissions.find(
      (perm) =>
        perm.verb === 'manage' &&
        perm.resourceType === 'policies' &&
        perm.scope === 'tenancy',
    );
    if (managePolicies) {
      const ap = buildAttackPath(p, managePolicies, attackPathCtx);
      findings.push({
        id: `F2-${findingIdx++}`,
        severity: 'CRITICAL',
        title: 'Privilege escalation: can modify IAM policies',
        description: `${p.principalType} "${p.name}" can manage policies in tenancy via "${managePolicies.policyName}". This allows creating new policies to grant themselves any permission.`,
        recommendation:
          'Restrict policy management to a dedicated admin group with break-glass procedures.',
        attackPath: ap.labels,
        attackPathNodeIds: ap.nodeIds,
        resources: [{ id: p.id, ocid: p.ocid, name: p.name }],
      });
    }
  }

  // F3: Can manage users/groups (self-escalation)
  for (const p of principals) {
    const manageUsers = p.permissions.find(
      (perm) =>
        perm.verb === 'manage' &&
        (perm.resourceType === 'users' || perm.resourceType === 'groups') &&
        perm.scope === 'tenancy',
    );
    if (manageUsers) {
      const ap = buildAttackPath(p, manageUsers, attackPathCtx);
      findings.push({
        id: `F3-${findingIdx++}`,
        severity: 'CRITICAL',
        title: 'Privilege escalation: can manage users/groups',
        description: `${p.principalType} "${p.name}" can manage ${manageUsers.resourceType} in tenancy via "${manageUsers.policyName}". This allows adding themselves to privileged groups.`,
        recommendation:
          'Limit user/group management to identity administrators only.',
        attackPath: ap.labels,
        attackPathNodeIds: ap.nodeIds,
        resources: [{ id: p.id, ocid: p.ocid, name: p.name }],
      });
    }
  }

  // F4: Any manage X in tenancy (broad)
  for (const p of principals) {
    const broadManage = p.permissions.filter(
      (perm) =>
        perm.verb === 'manage' &&
        perm.scope === 'tenancy' &&
        perm.resourceType !== 'all-resources' &&
        perm.resourceType !== 'policies' &&
        perm.resourceType !== 'users' &&
        perm.resourceType !== 'groups',
    );
    for (const perm of broadManage) {
      const ap = buildAttackPath(p, perm, attackPathCtx);
      findings.push({
        id: `F4-${findingIdx++}`,
        severity: 'HIGH',
        title: `Broad tenancy-level manage: ${perm.resourceType}`,
        description: `${p.principalType} "${p.name}" has manage ${perm.resourceType} in tenancy via "${perm.policyName}".`,
        recommendation:
          'Scope manage permissions to specific compartments rather than tenancy.',
        attackPath: ap.labels,
        attackPathNodeIds: ap.nodeIds,
        resources: [{ id: p.id, ocid: p.ocid, name: p.name }],
      });
    }
  }

  // F5: Admin permissions + MFA disabled (check rawData for isMfaActivated)
  for (const p of principals) {
    if (p.principalType !== 'user') continue;
    const isAdmin = p.riskLevel === 'CRITICAL' || p.riskLevel === 'HIGH';
    if (!isAdmin) continue;

    const userRes = users.find((u) => u.id === p.id);
    if (!userRes) continue;
    try {
      const raw = JSON.parse(userRes.rawData);
      if (raw.isMfaActivated === false) {
        findings.push({
          id: `F5-${findingIdx++}`,
          severity: 'HIGH',
          title: 'Admin user without MFA',
          description: `User "${p.name}" has ${p.riskLevel}-level permissions but MFA is not activated.`,
          recommendation: 'Enable MFA for all users with administrative permissions.',
          attackPath: [p.name, 'No MFA', 'Account compromise'],
          attackPathNodeIds: [p.id],
          resources: [{ id: p.id, ocid: p.ocid, name: p.name }],
        });
      }
    } catch {
      // skip
    }
  }

  // F6: Dynamic group with broad matching rule
  for (const dg of dynamicGroups) {
    try {
      const raw = JSON.parse(dg.rawData);
      const matchingRule = raw.matchingRule || '';
      if (
        /any\s*\{/i.test(matchingRule) ||
        /instance\.compartment\.id\s*=\s*'[^']+'\s*\}/i.test(matchingRule)
      ) {
        const dgPrincipal = principals.find((p) => p.id === dg.id);
        if (dgPrincipal && dgPrincipal.permissions.length > 0) {
          findings.push({
            id: `F6-${findingIdx++}`,
            severity: 'HIGH',
            title: 'Dynamic group with broad matching rule',
            description: `Dynamic group "${dg.displayName}" uses a broad matching rule that may include unintended instances. Rule: ${matchingRule.substring(0, 200)}`,
            recommendation:
              'Use specific resource OCIDs or narrow compartment matching in dynamic group rules.',
            attackPath: [dg.displayName || dg.ocid, 'Broad match rule', 'Unintended access'],
            attackPathNodeIds: [dg.id],
            resources: [{ id: dg.id, ocid: dg.ocid, name: dg.displayName }],
          });
        }
      }
    } catch {
      // skip
    }
  }

  // F7: Stale API keys (>90 days)
  const now = Date.now();
  const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
  for (const key of apiKeys) {
    if (key.timeCreated) {
      const created = new Date(key.timeCreated).getTime();
      if (now - created > NINETY_DAYS) {
        // Find the owning user via relations
        let ownerName = 'unknown';
        try {
          const raw = JSON.parse(key.rawData);
          ownerName = raw.userId || 'unknown';
        } catch {
          // skip
        }
        findings.push({
          id: `F7-${findingIdx++}`,
          severity: 'MEDIUM',
          title: 'Stale API key (>90 days old)',
          description: `API key "${key.displayName || key.ocid}" was created ${Math.floor((now - created) / (24 * 60 * 60 * 1000))} days ago.`,
          recommendation: 'Rotate API keys regularly. Remove unused keys.',
          attackPath: [ownerName, key.displayName || key.ocid, 'Stale credential'],
          attackPathNodeIds: [key.id],
          resources: [{ id: key.id, ocid: key.ocid, name: key.displayName }],
        });
      }
    }
  }

  // F8: any-user policy statements
  for (const stmt of anyUserStatements) {
    findings.push({
      id: `F8-${findingIdx++}`,
      severity: 'MEDIUM',
      title: `any-user policy: ${stmt.verb} ${stmt.resourceType}`,
      description: `Policy "${stmt.policyName}" grants "${stmt.verb} ${stmt.resourceType}" to any-user. This means any authenticated OCI user can access this resource.`,
      recommendation:
        'Replace any-user with specific group references to limit access.',
      attackPath: ['any-user', stmt.policyName, `${stmt.verb} ${stmt.resourceType}`],
      attackPathNodeIds: [],
      resources: [],
    });
  }

  // F9: Orphaned users (no group membership)
  for (const user of users) {
    const gIds = userGroups.get(user.id) || [];
    if (gIds.length === 0) {
      findings.push({
        id: `F9-${findingIdx++}`,
        severity: 'MEDIUM',
        title: 'Orphaned user: no group membership',
        description: `User "${user.displayName || user.ocid}" is not a member of any group. They may have no permissions or may only receive any-user grants.`,
        recommendation:
          'Add the user to appropriate groups or remove if unused.',
        attackPath: [user.displayName || user.ocid, 'No groups'],
        attackPathNodeIds: [user.id],
        resources: [{ id: user.id, ocid: user.ocid, name: user.displayName }],
      });
    }
  }

  // F10: Unparseable policy statements
  const unparsed = allStatements.filter((s) => !s.parsed);
  if (unparsed.length > 0) {
    findings.push({
      id: `F10-${findingIdx++}`,
      severity: 'LOW',
      title: `${unparsed.length} unparseable policy statement(s)`,
      description: `${unparsed.length} policy statements could not be parsed. These may use advanced syntax (define, endorse) or have unexpected formatting. Manual review recommended.`,
      recommendation:
        'Review these statements manually to ensure they do not grant unintended access.',
      attackPath: ['Unparsed statements', 'Unknown risk'],
      attackPathNodeIds: [],
      resources: [],
    });
  }

  // F11: Toxic combinations
  checkToxicCombinations(principals, findings, findingIdx);

  // F12: Cross-domain attack paths
  checkCrossDomainAttackPaths(
    principals, findings, securityLists, subnets,
    compartmentNameToOcid, compartmentOcidToName,
  );

  // F13: Lateral movement paths
  checkLateralMovementPaths(
    principals, findings, dynamicGroups, instances,
    dgStatements, compartmentOcidToName,
  );

  // Post-process: add CIS framework mapping
  for (const f of findings) {
    f.framework = CIS_IAM_MAPPINGS[f.title] || null;
  }

  return findings;
}

// ---------------------------------------------------------------
// Toxic combinations check
// ---------------------------------------------------------------

interface ToxicCombo {
  name: string;
  severity: Severity;
  checkA: (p: EffectivePermission) => boolean;
  checkB: (p: EffectivePermission) => boolean;
  description: string;
  recommendation: string;
}

const TOXIC_COMBOS: ToxicCombo[] = [
  {
    name: 'Secret read + compute manage',
    severity: 'CRITICAL',
    checkA: (p) => (p.verb === 'read' || p.verb === 'manage' || p.verb === 'use') && p.resourceType === 'secret-family',
    checkB: (p) => p.verb === 'manage' && (p.resourceType === 'instance-family' || p.resourceType === 'compute-management-family'),
    description: 'Can read secrets and manage compute instances, enabling exfiltration of secrets via instance metadata or startup scripts.',
    recommendation: 'Separate secret access from compute management into different groups.',
  },
  {
    name: 'Network manage + IAM manage',
    severity: 'CRITICAL',
    checkA: (p) => p.verb === 'manage' && (p.resourceType === 'virtual-network-family' || p.resourceType === 'network-security-groups'),
    checkB: (p) => p.verb === 'manage' && (p.resourceType === 'policies' || p.resourceType === 'users' || p.resourceType === 'groups'),
    description: 'Can modify both network controls and IAM policies, enabling complete control of access and network paths.',
    recommendation: 'Separate network administration from IAM administration.',
  },
  {
    name: 'Object storage + compute manage',
    severity: 'HIGH',
    checkA: (p) => (p.verb === 'manage' || p.verb === 'use') && p.resourceType === 'object-family',
    checkB: (p) => p.verb === 'manage' && (p.resourceType === 'instance-family' || p.resourceType === 'compute-management-family'),
    description: 'Can access object storage and manage compute, enabling data exfiltration via compute instances.',
    recommendation: 'Limit object storage access for principals who manage compute resources.',
  },
  {
    name: 'Database admin + network control',
    severity: 'HIGH',
    checkA: (p) => p.verb === 'manage' && (p.resourceType === 'database-family' || p.resourceType === 'autonomous-database-family'),
    checkB: (p) => p.verb === 'manage' && (p.resourceType === 'virtual-network-family' || p.resourceType === 'network-security-groups'),
    description: 'Can manage databases and network security, enabling database exposure to untrusted networks.',
    recommendation: 'Separate database administration from network security management.',
  },
];

function checkToxicCombinations(
  principals: IamPrincipal[],
  findings: IamFinding[],
  startIdx: number,
): void {
  let idx = startIdx;
  for (const p of principals) {
    for (const combo of TOXIC_COMBOS) {
      const hasA = p.permissions.some(combo.checkA);
      const hasB = p.permissions.some(combo.checkB);
      if (hasA && hasB) {
        findings.push({
          id: `F11-${idx++}`,
          severity: combo.severity,
          title: `Toxic combination: ${combo.name}`,
          description: `${p.principalType} "${p.name}" has ${combo.description}`,
          recommendation: combo.recommendation,
          attackPath: [p.name, combo.name.split(' + ')[0], combo.name.split(' + ')[1], 'Combined risk'],
          attackPathNodeIds: [p.id],
          resources: [{ id: p.id, ocid: p.ocid, name: p.name }],
        });
      }
    }
  }
}

// ---------------------------------------------------------------
// Cross-domain attack paths (F12)
// ---------------------------------------------------------------

function checkCrossDomainAttackPaths(
  principals: IamPrincipal[],
  findings: IamFinding[],
  securityLists: ResourceRow[],
  subnets: ResourceRow[],
  compartmentNameToOcid: Map<string, string>,
  compartmentOcidToName: Map<string, string>,
): void {
  // Find compartments with exposed security lists (0.0.0.0/0 ingress)
  const exposedCompartments = new Set<string>();

  for (const sl of securityLists) {
    try {
      const raw = JSON.parse(sl.rawData);
      const ingressRules = raw.ingressSecurityRules || [];
      for (const rule of ingressRules) {
        if (rule.source === '0.0.0.0/0') {
          if (sl.compartmentId) exposedCompartments.add(sl.compartmentId);
          break;
        }
      }
    } catch { /* skip */ }
  }

  // Check subnets with public IPs allowed
  for (const subnet of subnets) {
    try {
      const raw = JSON.parse(subnet.rawData);
      if (raw.prohibitPublicIpOnVnic === false && subnet.compartmentId) {
        exposedCompartments.add(subnet.compartmentId);
      }
    } catch { /* skip */ }
  }

  if (exposedCompartments.size === 0) return;

  let idx = 0;
  for (const p of principals) {
    const computeManage = p.permissions.find(
      (perm) =>
        perm.verb === 'manage' &&
        (perm.resourceType === 'instance-family' ||
          perm.resourceType === 'compute-management-family' ||
          perm.resourceType === 'all-resources'),
    );
    if (!computeManage) continue;

    // Check if scoped to an exposed compartment
    const scopeMatch = computeManage.scope.match(/compartment\s+(?:id\s+)?(.+)/i);
    if (scopeMatch) {
      const scopeName = scopeMatch[1].replace(/'/g, '').toLowerCase();
      const scopeOcid = compartmentNameToOcid.get(scopeName) || scopeName;
      if (!exposedCompartments.has(scopeOcid)) continue;
    }
    // If scope is tenancy, they can reach exposed compartments

    const exposedNames = [...exposedCompartments]
      .map((ocid) => compartmentOcidToName.get(ocid) || ocid.slice(-8))
      .slice(0, 3)
      .join(', ');

    findings.push({
      id: `F12-${idx++}`,
      severity: 'HIGH',
      title: 'Cross-domain attack path: compute to network-exposed compartment',
      description: `${p.principalType} "${p.name}" can manage compute in compartments with internet-exposed security lists (${exposedNames}). An attacker could launch instances in exposed networks.`,
      recommendation: 'Restrict compute management to non-internet-facing compartments, or tighten security list ingress rules.',
      attackPath: [p.name, 'manage compute', 'exposed compartment', 'internet-facing instance'],
      attackPathNodeIds: [p.id],
      resources: [{ id: p.id, ocid: p.ocid, name: p.name }],
    });
  }
}

// ---------------------------------------------------------------
// Lateral movement paths (F13)
// ---------------------------------------------------------------

function checkLateralMovementPaths(
  principals: IamPrincipal[],
  findings: IamFinding[],
  dynamicGroups: ResourceRow[],
  instances: ResourceRow[],
  dgStatements: Map<string, ParsedStatement[]>,
  compartmentOcidToName: Map<string, string>,
): void {
  // Find dynamic groups with elevated permissions and broad matching rules
  const broadDynGroups: { dg: ResourceRow; matchingRule: string; perms: ParsedStatement[] }[] = [];

  for (const dg of dynamicGroups) {
    try {
      const raw = JSON.parse(dg.rawData);
      const matchingRule = raw.matchingRule || '';
      const isBroad = /any\s*\{/i.test(matchingRule) ||
        /instance\.compartment\.id/i.test(matchingRule);
      if (!isBroad) continue;

      const stmts = dgStatements.get(dg.id) || [];
      const hasElevated = stmts.some(
        (s) => s.verb === 'manage' || s.verb === 'use',
      );
      if (hasElevated) {
        broadDynGroups.push({ dg, matchingRule, perms: stmts });
      }
    } catch { /* skip */ }
  }

  if (broadDynGroups.length === 0) return;

  let idx = 0;
  for (const p of principals) {
    if (p.principalType !== 'user') continue;
    const canManageCompute = p.permissions.some(
      (perm) =>
        perm.verb === 'manage' &&
        (perm.resourceType === 'instance-family' ||
          perm.resourceType === 'compute-management-family' ||
          perm.resourceType === 'all-resources'),
    );
    if (!canManageCompute) continue;

    for (const { dg, perms } of broadDynGroups) {
      const dgPermSummary = perms
        .slice(0, 3)
        .map((s) => `${s.verb} ${s.resourceType}`)
        .join(', ');

      findings.push({
        id: `F13-${idx++}`,
        severity: 'HIGH',
        title: 'Lateral movement: compute → dynamic group escalation',
        description: `User "${p.name}" can manage compute and launch instances that match dynamic group "${dg.displayName}", gaining permissions: ${dgPermSummary}.`,
        recommendation: 'Use specific instance OCIDs in dynamic group rules instead of broad compartment matching. Restrict compute management.',
        attackPath: [p.name, 'manage compute', 'launch instance', `match "${dg.displayName}"`, dgPermSummary],
        attackPathNodeIds: [p.id, dg.id],
        resources: [
          { id: p.id, ocid: p.ocid, name: p.name },
          { id: dg.id, ocid: dg.ocid, name: dg.displayName },
        ],
      });
    }
  }
}

function buildAttackPath(
  principal: IamPrincipal,
  permission: EffectivePermission,
  ctx: AttackPathContext,
): { labels: string[]; nodeIds: string[] } {
  const labels: string[] = [principal.name];
  const nodeIds: string[] = [principal.id];

  if (principal.groups.length > 0) {
    labels.push(principal.groups[0]);
    // Resolve group name to node ID
    const gId = ctx.groupNameToId.get(principal.groups[0].toLowerCase());
    if (gId) nodeIds.push(gId);
  }

  labels.push(permission.policyName);
  const pId = ctx.policyNameToId.get(permission.policyName.toLowerCase());
  if (pId) nodeIds.push(pId);

  const permLabel = `${permission.verb} ${permission.resourceType}`;
  labels.push(permLabel);
  // Permission node IDs follow this pattern in buildGraph
  const permNodeId = `perm-${permission.verb}-${permission.resourceType}-${permission.scope}`;
  nodeIds.push(permNodeId);

  return { labels, nodeIds };
}

interface AttackPathContext {
  groupNameToId: Map<string, string>;
  policyNameToId: Map<string, string>;
}
