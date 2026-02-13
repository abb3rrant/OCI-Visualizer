import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface AuditFinding {
  severity: Severity;
  category: string;
  title: string;
  description: string;
  resourceId: string | null;
  resourceOcid: string | null;
  resourceName: string | null;
  recommendation: string;
}

export interface AffectedResource {
  id: string;
  ocid: string;
  name: string | null;
}

export interface GroupedAuditFinding {
  severity: Severity;
  category: string;
  title: string;
  description: string;
  recommendation: string;
  count: number;
  resources: AffectedResource[];
  framework: string | null;
}

export interface GroupedAuditReport {
  groupedFindings: GroupedAuditFinding[];
  summary: { critical: number; high: number; medium: number; low: number; info: number };
}

export interface TagReport {
  totalResources: number;
  compliantResources: number;
  nonCompliantResources: number;
  tagCoverage: { tagKey: string; count: number; total: number; percentage: number }[];
  missingTagResourceIds: string[];
}

interface ResourceRow {
  id: string;
  ocid: string;
  resourceType: string;
  displayName: string | null;
  lifecycleState: string | null;
  compartmentId: string | null;
  rawData: string | null;
  freeformTags: string | null;
}

// Sensitive ports that should never be open to the internet
const SENSITIVE_PORTS = [22, 3389, 1521, 3306, 5432, 27017];

const AUDIT_CHUNK_SIZE = 5000;
const BLOB_CHUNK_SIZE = 500;

const SEVERITY_ORDER: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};
const MAX_MISSING_TAG_RESOURCES = 500;

// ---------------------------------------------------------------
// Main audit entry point
// ---------------------------------------------------------------

/**
 * Run a full security audit against a snapshot and return all findings
 * with a summary breakdown by severity.
 *
 * Resources are processed in chunks to avoid OOM on large snapshots.
 */
export async function runAudit(
  prisma: PrismaClient,
  snapshotId: string,
): Promise<GroupedAuditReport> {
  // First pass: load lightweight metadata to get IDs and build relation sets
  const allResourceMeta = await prisma.resource.findMany({
    where: { snapshotId },
    select: { id: true },
  });

  const allIds = allResourceMeta.map(r => r.id);

  // Load relations for relationship-based checks
  const relations = await prisma.resourceRelation.findMany({
    where: { fromResourceId: { in: allIds } },
    select: {
      fromResourceId: true,
      toResourceId: true,
      relationType: true,
    },
  });

  // Build a set of resource IDs that have nsg-member relations
  const nsgMemberResourceIds = new Set<string>();
  // Build a set of resource IDs that have volume-attached relations
  const volumeAttachedResourceIds = new Set<string>();

  for (const rel of relations) {
    if (rel.relationType === 'nsg-member') {
      nsgMemberResourceIds.add(rel.fromResourceId);
    }
    if (rel.relationType === 'volume-attached') {
      // The "to" side is the volume
      volumeAttachedResourceIds.add(rel.toResourceId);
    }
  }

  const findings: AuditFinding[] = [];

  // Process resources in chunks to avoid loading all rawData at once
  for (let i = 0; i < allIds.length; i += AUDIT_CHUNK_SIZE) {
    const chunkIds = allIds.slice(i, i + AUDIT_CHUNK_SIZE);

    const resources = (await prisma.resource.findMany({
      where: { id: { in: chunkIds } },
      select: {
        id: true,
        ocid: true,
        resourceType: true,
        displayName: true,
        lifecycleState: true,
        compartmentId: true,
        rawData: true,
        freeformTags: true,
      },
    })) as ResourceRow[];

    for (const resource of resources) {
      let rawData: Record<string, any> = {};
      if (resource.rawData) {
        try {
          rawData = JSON.parse(resource.rawData);
        } catch {
          continue;
        }
      }

      // --- Security checks ---
      checkOpenSecurityRules(resource, rawData, findings);
      checkAllProtocolAllowRules(resource, rawData, findings);
      checkPublicSubnets(resource, rawData, findings);
      checkUnencryptedVolumes(resource, rawData, findings);
      checkPublicBuckets(resource, rawData, findings);
      checkInstancesWithoutNsg(resource, nsgMemberResourceIds, findings);

      // --- IAM checks ---
      checkOverlyBroadPolicies(resource, rawData, findings);
      checkBroadGroupPolicies(resource, rawData, findings);

      // --- Operational checks ---
      checkStoppedInstances(resource, findings);
      checkUnattachedVolumes(resource, volumeAttachedResourceIds, findings);
      checkFailedResources(resource, findings);
    }
  }

  // --- userData secret checks ---
  await checkUserDataSecrets(prisma, snapshotId, findings);

  const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) {
    switch (f.severity) {
      case 'CRITICAL':
        summary.critical++;
        break;
      case 'HIGH':
        summary.high++;
        break;
      case 'MEDIUM':
        summary.medium++;
        break;
      case 'LOW':
        summary.low++;
        break;
      case 'INFO':
        summary.info++;
        break;
    }
  }

  const groupedFindings = groupFindings(findings);
  return { groupedFindings, summary };
}

// ---------------------------------------------------------------
// CIS Benchmark Mappings (C12)
// ---------------------------------------------------------------

const CIS_MAPPINGS: Record<string, string> = {
  'Open ingress on port 22 from 0.0.0.0/0': 'CIS 5.1.1',
  'Open ingress on port 3389 from 0.0.0.0/0': 'CIS 5.1.2',
  'Ingress rule allows all protocols from 0.0.0.0/0': 'CIS 5.1.3',
  'Public subnet detected': 'CIS 5.2.1',
  'Volume not encrypted with customer-managed key': 'CIS 2.1.1',
  'Publicly accessible bucket': 'CIS 2.1.2',
  'Instance without Network Security Group': 'CIS 5.3.1',
  'Overly broad policy — manage all-resources in tenancy': 'CIS 1.1.1',
  'Broad "manage" policy at tenancy level': 'CIS 1.1.2',
  'Hardcoded password in instance userData': 'CIS 3.1.1',
  'Potential API key or token in instance userData': 'CIS 3.1.2',
};

// ---------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------

function groupFindings(findings: AuditFinding[]): GroupedAuditFinding[] {
  const groups = new Map<string, GroupedAuditFinding>();

  for (const f of findings) {
    const key = `${f.severity}\0${f.title}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        severity: f.severity,
        category: f.category,
        title: f.title,
        description: f.description,
        recommendation: f.recommendation,
        count: 0,
        resources: [],
        framework: CIS_MAPPINGS[f.title] ?? null,
      };
      groups.set(key, group);
    }
    group.count++;
    if (f.resourceId && f.resourceOcid) {
      group.resources.push({
        id: f.resourceId,
        ocid: f.resourceOcid,
        name: f.resourceName,
      });
    }
  }

  const result = Array.from(groups.values());
  result.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.count - a.count;
  });
  return result;
}

// ---------------------------------------------------------------
// userData secret checks
// ---------------------------------------------------------------

async function checkUserDataSecrets(
  prisma: PrismaClient,
  snapshotId: string,
  findings: AuditFinding[],
): Promise<void> {
  // Get all compute instance resource IDs in this snapshot
  const instances = await prisma.resource.findMany({
    where: { snapshotId, resourceType: 'compute/instance' },
    select: { id: true, ocid: true, displayName: true },
  });

  if (instances.length === 0) return;

  // Process in chunks to stay within SQLite's parameter limit
  for (let i = 0; i < instances.length; i += BLOB_CHUNK_SIZE) {
    const chunk = instances.slice(i, i + BLOB_CHUNK_SIZE);
    const chunkIds = chunk.map(r => r.id);
    const idMap = new Map(chunk.map(r => [r.id, r]));

    const blobs = await prisma.resourceBlob.findMany({
      where: {
        resourceId: { in: chunkIds },
        blobKey: 'userData',
      },
      select: { resourceId: true, content: true },
    });

    for (const blob of blobs) {
      const resource = idMap.get(blob.resourceId);
      if (!resource) continue;
      scanUserDataContent(blob.content, resource, findings);
    }
  }
}

function scanUserDataContent(
  content: string,
  resource: { id: string; ocid: string; displayName: string | null },
  findings: AuditFinding[],
): void {
  const row: ResourceRow = {
    id: resource.id,
    ocid: resource.ocid,
    resourceType: 'compute/instance',
    displayName: resource.displayName,
    lifecycleState: null,
    compartmentId: null,
    rawData: null,
    freeformTags: null,
  };

  // CRITICAL: Hardcoded passwords
  if (
    /password\s*[=:]\s*\S+/i.test(content) ||
    /passwd\s*[=:]/i.test(content) ||
    /-p\s+(?!['"]?\$)\S+/.test(content)
  ) {
    findings.push(
      makeFinding(
        row,
        'CRITICAL',
        'Secrets in userData',
        'Hardcoded password in instance userData',
        `Instance "${resource.displayName}" has cloud-init userData containing what appears to be a hardcoded password. ` +
          `Passwords in userData are stored in plaintext and visible to anyone with API access.`,
        'Use OCI Vault secrets or instance metadata service instead of hardcoding passwords in userData scripts.',
      ),
    );
  }

  // HIGH: API keys / tokens
  if (
    /AKIA[0-9A-Z]{16}/.test(content) ||
    /(?:key|token|secret)\s*[=:]\s*['"]?[A-Za-z0-9/+=]{20,}/i.test(content)
  ) {
    findings.push(
      makeFinding(
        row,
        'HIGH',
        'Secrets in userData',
        'Potential API key or token in instance userData',
        `Instance "${resource.displayName}" has cloud-init userData containing what appears to be an API key or token. ` +
          `Credentials in userData are stored in plaintext.`,
        'Store API keys and tokens in OCI Vault and retrieve them at runtime rather than embedding in userData.',
      ),
    );
  }

  // MEDIUM: Insecure HTTP URLs
  if (/http:\/\/(?!localhost|127\.0\.0\.1)/.test(content)) {
    findings.push(
      makeFinding(
        row,
        'MEDIUM',
        'Secrets in userData',
        'Insecure HTTP URL in instance userData',
        `Instance "${resource.displayName}" has cloud-init userData referencing insecure HTTP URLs. ` +
          `Downloads over HTTP are vulnerable to man-in-the-middle attacks.`,
        'Use HTTPS URLs for all downloads and package repositories in userData scripts.',
      ),
    );
  }

  // MEDIUM: Security controls disabled
  if (/setenforce\s+0/.test(content) || /iptables\s+-F/.test(content)) {
    findings.push(
      makeFinding(
        row,
        'MEDIUM',
        'Secrets in userData',
        'Security controls disabled in instance userData',
        `Instance "${resource.displayName}" has cloud-init userData that disables security controls (SELinux or iptables). ` +
          `Disabling security controls weakens the instance's security posture.`,
        'Avoid disabling SELinux or flushing iptables rules. Configure proper security policies instead.',
      ),
    );
  }
}

// ---------------------------------------------------------------
// Tag compliance
// ---------------------------------------------------------------

/**
 * Check freeform tag compliance across all resources in a snapshot.
 * Processes resources in chunks to avoid OOM.
 */
export async function runTagCompliance(
  prisma: PrismaClient,
  snapshotId: string,
  requiredTags: string[],
): Promise<TagReport> {
  const totalResources = await prisma.resource.count({ where: { snapshotId } });

  const missingTagResourceIds: string[] = [];

  // Per-tag counters
  const tagCountMap = new Map<string, number>();
  for (const tag of requiredTags) {
    tagCountMap.set(tag, 0);
  }

  let compliantResources = 0;
  let processedCursor: string | undefined = undefined;

  // Process in chunks using cursor-based pagination
  while (true) {
    const findArgs: any = {
      where: { snapshotId },
      select: { id: true, ocid: true, freeformTags: true },
      take: AUDIT_CHUNK_SIZE,
      orderBy: { id: 'asc' as const },
    };
    if (processedCursor) {
      findArgs.cursor = { id: processedCursor };
      findArgs.skip = 1;
    }

    const chunk = await prisma.resource.findMany(findArgs) as Array<{ id: string; ocid: string; freeformTags: string | null }>;
    if (chunk.length === 0) break;

    for (const resource of chunk) {
      let tags: Record<string, string> = {};
      if (resource.freeformTags) {
        try {
          tags = JSON.parse(resource.freeformTags);
        } catch {
          // treat as no tags
        }
      }

      let allPresent = true;
      for (const reqTag of requiredTags) {
        if (tags && reqTag in tags) {
          tagCountMap.set(reqTag, (tagCountMap.get(reqTag) ?? 0) + 1);
        } else {
          allPresent = false;
        }
      }

      if (allPresent && requiredTags.length > 0) {
        compliantResources++;
      } else if (requiredTags.length > 0) {
        if (missingTagResourceIds.length < MAX_MISSING_TAG_RESOURCES) {
          missingTagResourceIds.push(resource.id);
        }
      }
    }

    processedCursor = chunk[chunk.length - 1].id;
    if (chunk.length < AUDIT_CHUNK_SIZE) break;
  }

  const tagCoverage = requiredTags.map((tagKey) => {
    const count = tagCountMap.get(tagKey) ?? 0;
    return {
      tagKey,
      count,
      total: totalResources,
      percentage: totalResources > 0 ? Math.round((count / totalResources) * 10000) / 100 : 0,
    };
  });

  return {
    totalResources,
    compliantResources,
    nonCompliantResources: totalResources - compliantResources,
    tagCoverage,
    missingTagResourceIds,
  };
}

// ---------------------------------------------------------------
// Individual check functions
// ---------------------------------------------------------------

function makeFinding(
  resource: ResourceRow,
  severity: AuditFinding['severity'],
  category: string,
  title: string,
  description: string,
  recommendation: string,
): AuditFinding {
  return {
    severity,
    category,
    title,
    description,
    resourceId: resource.id,
    resourceOcid: resource.ocid,
    resourceName: resource.displayName,
    recommendation,
  };
}

/**
 * CRITICAL: Security lists with 0.0.0.0/0 source on sensitive ports.
 */
function checkOpenSecurityRules(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'network/security-list') return;

  const ingressRules = rawData.ingressSecurityRules;
  if (!Array.isArray(ingressRules)) return;

  for (const rule of ingressRules) {
    if (rule.source !== '0.0.0.0/0') continue;

    const tcpOptions = rule.tcpOptions;
    if (!tcpOptions?.destinationPortRange) continue;

    const minPort = tcpOptions.destinationPortRange.min;
    const maxPort = tcpOptions.destinationPortRange.max;

    for (const sensitivePort of SENSITIVE_PORTS) {
      if (sensitivePort >= minPort && sensitivePort <= maxPort) {
        findings.push(
          makeFinding(
            resource,
            'CRITICAL',
            'Network Security',
            `Open ingress on port ${sensitivePort} from 0.0.0.0/0`,
            `Security list "${resource.displayName}" allows ingress from 0.0.0.0/0 on port ${sensitivePort} (range ${minPort}-${maxPort}). ` +
              `This exposes sensitive services to the entire internet.`,
            `Restrict the source CIDR to only trusted IP ranges and limit the port range to the minimum required.`,
          ),
        );
      }
    }
  }
}

/**
 * HIGH: Security lists with rules allowing all protocols.
 */
function checkAllProtocolAllowRules(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'network/security-list') return;

  const ingressRules = rawData.ingressSecurityRules;
  if (!Array.isArray(ingressRules)) return;

  for (const rule of ingressRules) {
    if (rule.protocol === 'all' && rule.source === '0.0.0.0/0') {
      findings.push(
        makeFinding(
          resource,
          'HIGH',
          'Network Security',
          `Ingress rule allows all protocols from 0.0.0.0/0`,
          `Security list "${resource.displayName}" has an ingress rule that allows ALL protocols from 0.0.0.0/0. ` +
            `This is extremely permissive and exposes all ports.`,
          `Replace the "all protocols" rule with specific protocol and port rules limited to trusted source CIDRs.`,
        ),
      );
    }
  }
}

/**
 * HIGH: Subnets where internet ingress is not prohibited (public subnets).
 */
function checkPublicSubnets(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'network/subnet') return;

  if (rawData.prohibitInternetIngress === false) {
    findings.push(
      makeFinding(
        resource,
        'HIGH',
        'Network Security',
        `Public subnet detected`,
        `Subnet "${resource.displayName}" has prohibitInternetIngress set to false, making it a public subnet. ` +
          `Resources in public subnets may be directly accessible from the internet.`,
        `Use private subnets where possible and route internet traffic through a load balancer or bastion host.`,
      ),
    );
  }
}

/**
 * HIGH: Block/boot volumes without KMS encryption.
 */
function checkUnencryptedVolumes(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (
    resource.resourceType !== 'storage/block-volume' &&
    resource.resourceType !== 'storage/boot-volume'
  ) {
    return;
  }

  if (!rawData.kmsKeyId) {
    findings.push(
      makeFinding(
        resource,
        'HIGH',
        'Data Encryption',
        `Volume not encrypted with customer-managed key`,
        `Volume "${resource.displayName}" does not have a KMS key configured. ` +
          `While Oracle-managed encryption is the default, customer-managed keys provide additional control.`,
        `Configure a customer-managed KMS key for the volume to ensure you retain full control over encryption keys.`,
      ),
    );
  }
}

/**
 * CRITICAL: Object storage buckets with public access.
 */
function checkPublicBuckets(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'storage/bucket') return;

  if (rawData.publicAccessType && rawData.publicAccessType !== 'NoPublicAccess') {
    findings.push(
      makeFinding(
        resource,
        'CRITICAL',
        'Data Exposure',
        `Publicly accessible bucket`,
        `Bucket "${resource.displayName}" has public access type "${rawData.publicAccessType}". ` +
          `Public buckets can be accessed by anyone on the internet.`,
        `Set the bucket access type to "NoPublicAccess" unless public access is explicitly required and reviewed.`,
      ),
    );
  }
}

/**
 * MEDIUM: Instances with no NSG membership.
 */
function checkInstancesWithoutNsg(
  resource: ResourceRow,
  nsgMemberResourceIds: Set<string>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'compute/instance') return;

  if (!nsgMemberResourceIds.has(resource.id)) {
    findings.push(
      makeFinding(
        resource,
        'MEDIUM',
        'Network Security',
        `Instance without Network Security Group`,
        `Instance "${resource.displayName}" is not associated with any Network Security Group (NSG). ` +
          `NSGs provide fine-grained, per-resource network access control.`,
        `Associate the instance with one or more NSGs to apply targeted security rules.`,
      ),
    );
  }
}

/**
 * HIGH: IAM policies with "manage all-resources in tenancy".
 */
function checkOverlyBroadPolicies(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'iam/policy') return;

  const statements = rawData.statements;
  if (!Array.isArray(statements)) return;

  for (const stmt of statements) {
    if (typeof stmt !== 'string') continue;
    const lower = stmt.toLowerCase();
    if (lower.includes('manage all-resources in tenancy')) {
      findings.push(
        makeFinding(
          resource,
          'HIGH',
          'IAM Security',
          `Overly broad policy — manage all-resources in tenancy`,
          `Policy "${resource.displayName}" contains a statement granting "manage all-resources in tenancy": "${stmt}". ` +
            `This grants full administrative access across the entire tenancy.`,
          `Apply least-privilege principles. Replace broad policies with specific resource-type and compartment-scoped statements.`,
        ),
      );
    }
  }
}

/**
 * MEDIUM: IAM policies with broad "manage" statements.
 */
function checkBroadGroupPolicies(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'iam/policy') return;

  const statements = rawData.statements;
  if (!Array.isArray(statements)) return;

  for (const stmt of statements) {
    if (typeof stmt !== 'string') continue;
    const lower = stmt.toLowerCase();

    // Skip the tenancy-wide ones — already caught above
    if (lower.includes('manage all-resources in tenancy')) continue;

    // Flag any other broad "manage" statement that targets the whole tenancy
    if (lower.includes('manage') && lower.includes('in tenancy')) {
      findings.push(
        makeFinding(
          resource,
          'MEDIUM',
          'IAM Security',
          `Broad "manage" policy at tenancy level`,
          `Policy "${resource.displayName}" contains a tenancy-level manage statement: "${stmt}". ` +
            `Broad manage permissions at the tenancy level may grant excessive access.`,
          `Scope the policy to a specific compartment and limit the resource types where possible.`,
        ),
      );
    }
  }
}

/**
 * LOW: Instances in STOPPED state.
 */
function checkStoppedInstances(resource: ResourceRow, findings: AuditFinding[]): void {
  if (resource.resourceType !== 'compute/instance') return;

  if (resource.lifecycleState?.toUpperCase() === 'STOPPED') {
    findings.push(
      makeFinding(
        resource,
        'LOW',
        'Operations',
        `Stopped instance detected`,
        `Instance "${resource.displayName}" is in STOPPED state. ` +
          `Stopped instances still incur costs for attached boot volumes and reserved IPs.`,
        `Review whether the instance is still needed. Terminate unused instances to reduce costs.`,
      ),
    );
  }
}

/**
 * MEDIUM: Block volumes with no volume-attached relationship.
 */
function checkUnattachedVolumes(
  resource: ResourceRow,
  volumeAttachedResourceIds: Set<string>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'storage/block-volume') return;

  if (!volumeAttachedResourceIds.has(resource.id)) {
    findings.push(
      makeFinding(
        resource,
        'MEDIUM',
        'Operations',
        `Unattached block volume`,
        `Block volume "${resource.displayName}" is not attached to any instance. ` +
          `Unattached volumes incur storage costs without providing value.`,
        `Attach the volume to an instance or delete it if no longer needed.`,
      ),
    );
  }
}

/**
 * MEDIUM: Resources in FAILED or TERMINATING state.
 */
function checkFailedResources(resource: ResourceRow, findings: AuditFinding[]): void {
  const state = resource.lifecycleState?.toUpperCase();
  if (!state) return;

  if (state === 'FAILED' || state === 'TERMINATING') {
    findings.push(
      makeFinding(
        resource,
        'MEDIUM',
        'Operations',
        `Resource in ${state} state`,
        `Resource "${resource.displayName}" (${resource.resourceType}) is in ${state} state. ` +
          `This may indicate a provisioning failure or an incomplete deletion.`,
        `Investigate the root cause. For FAILED resources, attempt re-creation. For TERMINATING resources, verify deletion completes.`,
      ),
    );
  }
}
