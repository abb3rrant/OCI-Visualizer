import { PrismaClient } from '@prisma/client';
import { evaluateCustomRules } from './customAudit.js';

// ---------------------------------------------------------------
// In-memory audit cache
// ---------------------------------------------------------------
// Keyed by `snapshotId:userId` — caches the full GroupedAuditReport.
// Entries are evicted after CACHE_TTL_MS or when resource count changes.

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  report: GroupedAuditReport;
  resourceCount: number;
  timestamp: number;
}

const auditCache = new Map<string, CacheEntry>();

/** Invalidate all cache entries for a snapshot (call after import/delete). */
export function invalidateAuditCache(snapshotId: string): void {
  for (const key of auditCache.keys()) {
    if (key.startsWith(snapshotId + ':')) {
      auditCache.delete(key);
    }
  }
}

// Prune expired entries every 5 minutes to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of auditCache) {
    if (now - entry.timestamp > CACHE_TTL_MS) auditCache.delete(key);
  }
}, CACHE_TTL_MS);

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
  timeCreated: string | null;
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
  userId?: string,
): Promise<GroupedAuditReport> {
  // Check cache first — keyed by snapshot + user (custom rules are per-user)
  const cacheKey = `${snapshotId}:${userId ?? ''}`;
  const resourceCount = await prisma.resource.count({ where: { snapshotId } });
  const cached = auditCache.get(cacheKey);
  if (cached && cached.resourceCount === resourceCount && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.report;
  }

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

  // Pre-scan: find LB OCIDs protected by WAF
  const wafProtectedLbOcids = new Set<string>();
  const wafResources = await prisma.resource.findMany({
    where: { snapshotId, resourceType: 'security/waf-policy' },
    select: { rawData: true },
  });
  for (const w of wafResources) {
    if (w.rawData) {
      try {
        const raw = JSON.parse(w.rawData as string);
        if (raw.loadBalancerId) wafProtectedLbOcids.add(raw.loadBalancerId);
      } catch {}
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
        timeCreated: true,
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

      // --- New security checks ---
      checkNsgOpenRules(resource, rawData, findings);
      checkLoadBalancerWithoutWaf(resource, wafProtectedLbOcids, findings);
      checkExpiringCertificates(resource, rawData, findings);
      checkBastionPermissiveCidr(resource, rawData, findings);

      // --- Database checks ---
      checkDatabaseWithoutNsg(resource, rawData, findings);
      checkMysqlWithoutHa(resource, rawData, findings);
      checkMysqlWithoutCrashRecovery(resource, rawData, findings);

      // --- Storage checks ---
      checkBucketWithoutVersioning(resource, rawData, findings);
      checkFileSystemWithoutKms(resource, rawData, findings);

      // --- IAM checks (additional) ---
      checkUserWithoutMfa(resource, rawData, findings);
      checkStaleApiKey(resource, findings);
      checkStaleCustomerSecretKey(resource, rawData, findings);
      checkBroadDynamicGroup(resource, rawData, findings);
      checkAnyUserPolicy(resource, rawData, findings);

      // --- Load balancer checks (additional) ---
      checkPublicLbHttpListener(resource, rawData, findings);
      checkPublicLbWithoutNsg(resource, rawData, findings);

      // --- Network checks (additional) ---
      checkEgressAllProtocol(resource, rawData, findings);
      checkNsgEgressAllProtocol(resource, rawData, findings);
      checkUnassignedPublicIp(resource, rawData, findings);
      checkDisabledInternetGateway(resource, rawData, findings);
      checkBlockedNatGateway(resource, rawData, findings);

      // --- Storage checks (additional) ---
      checkBucketWithoutObjectEvents(resource, rawData, findings);

      // --- Secret management checks ---
      checkSecretNotRotated(resource, rawData, findings);

      // --- Observability checks ---
      checkDisabledAlarm(resource, rawData, findings);
      checkDisabledLog(resource, rawData, findings);

      // --- Container security checks ---
      checkCriticalContainerScan(resource, rawData, findings);

      // --- Operational checks ---
      checkStoppedInstances(resource, findings);
      checkUnattachedVolumes(resource, volumeAttachedResourceIds, findings);
      checkFailedResources(resource, findings);
    }
  }

  // --- Blob-based checks (userData secrets, SSH key reuse, etc.) ---
  await checkUserDataSecrets(prisma, snapshotId, findings);
  await checkSshKeyIssues(prisma, snapshotId, findings);

  // --- Custom audit rules ---
  if (userId) {
    const customFindings = await evaluateCustomRules(prisma, snapshotId, userId);
    findings.push(...customFindings);
  }

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
  const report: GroupedAuditReport = { groupedFindings, summary };

  // Store in cache
  auditCache.set(cacheKey, { report, resourceCount, timestamp: Date.now() });

  return report;
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
  'NSG open ingress on port 22 from 0.0.0.0/0': 'CIS 5.1.1',
  'NSG open ingress on port 3389 from 0.0.0.0/0': 'CIS 5.1.2',
  'NSG rule allows all protocols from 0.0.0.0/0': 'CIS 5.1.3',
  'SSH public key reused across multiple instances': 'CIS 3.2.1',
  'Deprecated DSA SSH key in use': 'CIS 3.2.2',
  'IAM user without MFA enabled': 'CIS 1.7',
  'Autonomous Database without Network Security Group': 'CIS 5.3.2',
  'MySQL DB System without Network Security Group': 'CIS 5.3.2',
  'Bucket without versioning enabled': 'CIS 2.1.3',
  'File system not encrypted with customer-managed key': 'CIS 2.1.1',
  'Egress rule allows all protocols to 0.0.0.0/0': 'CIS 5.2.2',
  'NSG egress rule allows all protocols to 0.0.0.0/0': 'CIS 5.2.2',
  'Public load balancer with HTTP listener (no TLS)': 'CIS 4.1.1',
  'API key not rotated in over 90 days': 'CIS 1.8',
  'Customer secret key not rotated in over 90 days': 'CIS 1.9',
  'Vault secret has never been rotated': 'CIS 2.2.1',
  'Overly broad dynamic group matching rule': 'CIS 1.5',
  'IAM policy grants access to any-user': 'CIS 1.1.3',
  'Public load balancer without Network Security Group': 'CIS 5.3.1',
  'Public network load balancer without Network Security Group': 'CIS 5.3.1',
  'Bucket without object events enabled': 'CIS 2.1.4',
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

// ---------------------------------------------------------------
// SSH key checks
// ---------------------------------------------------------------

/** Minimum number of instances sharing a key before it's flagged */
const SSH_KEY_REUSE_THRESHOLD = 3;

/**
 * Parse an authorized_keys blob into individual key entries.
 * Each line that starts with a key type (ssh-rsa, ecdsa-sha2-*, etc.) is
 * treated as one key.  Returns the key body (type + base64 portion) which
 * is stable for deduplication — the comment at the end is stripped.
 */
function parseAuthorizedKeys(content: string): { keyType: string; keyBody: string }[] {
  const keys: { keyType: string; keyBody: string }[] = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    // Typical format: ssh-rsa AAAA... comment
    const match = trimmed.match(/^(ssh-rsa|ssh-dss|ssh-ed25519|ecdsa-sha2-\S+)\s+(\S+)/);
    if (match) {
      keys.push({ keyType: match[1], keyBody: `${match[1]} ${match[2]}` });
    }
  }
  return keys;
}

/**
 * Check SSH-key-related misconfigurations across all instances in a snapshot:
 *   - MEDIUM: Same public key reused across N+ instances
 *   - MEDIUM: Deprecated DSA key type
 */
async function checkSshKeyIssues(
  prisma: PrismaClient,
  snapshotId: string,
  findings: AuditFinding[],
): Promise<void> {
  const instances = await prisma.resource.findMany({
    where: { snapshotId, resourceType: 'compute/instance' },
    select: { id: true, ocid: true, displayName: true },
  });
  if (instances.length === 0) return;

  // keyBody → list of resources that have it
  const keyUsage = new Map<string, { id: string; ocid: string; displayName: string | null }[]>();

  for (let i = 0; i < instances.length; i += BLOB_CHUNK_SIZE) {
    const chunk = instances.slice(i, i + BLOB_CHUNK_SIZE);
    const chunkIds = chunk.map(r => r.id);
    const idMap = new Map(chunk.map(r => [r.id, r]));

    const blobs = await prisma.resourceBlob.findMany({
      where: {
        resourceId: { in: chunkIds },
        blobKey: 'sshAuthorizedKeys',
      },
      select: { resourceId: true, content: true },
    });

    for (const blob of blobs) {
      const resource = idMap.get(blob.resourceId);
      if (!resource) continue;

      const keys = parseAuthorizedKeys(blob.content);

      for (const key of keys) {
        // Flag deprecated DSA keys per-instance
        if (key.keyType === 'ssh-dss') {
          findings.push({
            severity: 'MEDIUM',
            category: 'Security',
            title: 'Deprecated DSA SSH key in use',
            description: `Instance "${resource.displayName}" uses a DSA (ssh-dss) SSH key. DSA keys are deprecated and considered insecure by OpenSSH.`,
            resourceId: resource.id,
            resourceOcid: resource.ocid,
            resourceName: resource.displayName,
            recommendation: 'Replace DSA keys with Ed25519 or ECDSA keys.',
          });
        }

        // Track key usage for reuse detection
        let list = keyUsage.get(key.keyBody);
        if (!list) {
          list = [];
          keyUsage.set(key.keyBody, list);
        }
        list.push(resource);
      }
    }
  }

  // Emit findings for keys reused across too many instances
  for (const [_keyBody, resources] of keyUsage) {
    if (resources.length >= SSH_KEY_REUSE_THRESHOLD) {
      // Emit one finding per affected instance so they show up grouped
      // with a per-resource breakdown in the report
      for (const resource of resources) {
        findings.push({
          severity: 'MEDIUM',
          category: 'Security',
          title: 'SSH public key reused across multiple instances',
          description: `The same SSH public key is configured on ${resources.length} instances. ` +
            `Key reuse means compromising one instance's key grants access to all of them.`,
          resourceId: resource.id,
          resourceOcid: resource.ocid,
          resourceName: resource.displayName,
          recommendation: 'Use unique SSH key pairs per instance or per team. Rotate shared keys and restrict access via bastion hosts.',
        });
      }
    }
  }
}

/**
 * Returns true when the string looks like raw base64 that was never decoded
 * (or was double-encoded).  We check whether the *entire* content is composed
 * almost exclusively of base64 alphabet characters — real cloud-init scripts
 * have whitespace, punctuation, newlines, etc.
 */
function looksLikeBase64(content: string): boolean {
  // Short content isn't a concern
  if (content.length < 64) return false;
  // Sample up to the first 512 chars — enough to tell
  const sample = content.slice(0, 512);
  const base64Chars = sample.replace(/[A-Za-z0-9+/=\r\n]/g, '');
  // If < 5 % of characters are non-base64, it's probably still encoded
  return base64Chars.length / sample.length < 0.05;
}

function scanUserDataContent(
  content: string,
  resource: { id: string; ocid: string; displayName: string | null },
  findings: AuditFinding[],
): void {
  // Skip content that is still base64-encoded (e.g. double-encoded or
  // non-UTF8 binary that Buffer.from didn't throw on).  Scanning raw
  // base64 produces false positives because random base64 characters
  // can match patterns like "password=", "key=<long string>", etc.
  if (looksLikeBase64(content)) return;

  const row: ResourceRow = {
    id: resource.id,
    ocid: resource.ocid,
    resourceType: 'compute/instance',
    displayName: resource.displayName,
    lifecycleState: null,
    compartmentId: null,
    rawData: null,
    freeformTags: null,
    timeCreated: null,
  };

  // CRITICAL: Hardcoded passwords
  // Exclude common false positives:
  //   - "password_authentication" / "PasswordAuthentication" (sshd config)
  //   - Values that are shell variable references ($VAR, ${VAR})
  //   - "password = no" / "password = yes" (config toggles)
  //   - Lines that are comments (# or //)
  //   - Common placeholder values (changeme, placeholder, CHANGE_ME, xxx, etc.)
  // We scan only non-comment lines to avoid matching example/documentation text.
  const nonCommentLines = content.split(/\r?\n/)
    .filter(l => { const t = l.trim(); return t && !t.startsWith('#') && !t.startsWith('//'); })
    .join('\n');

  if (
    /password\s*[=:]\s*(?!\$)(?!no\b)(?!yes\b)(?!none\b)(?!null\b)(?!true\b)(?!false\b)(?!authentication)(?!changeme\b)(?!placeholder\b)(?!CHANGE_ME\b)(?!xxx\b)\S+/i.test(nonCommentLines) ||
    /passwd\s*[=:]\s*(?!\$)(?!no\b)(?!yes\b)\S+/i.test(nonCommentLines) ||
    /-p\s+(?!['"]?\$)(?!-)\S{8,}/.test(nonCommentLines)
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
  // - AWS access key IDs (AKIA...) are always real secrets
  // - For generic key/token/secret assignments, exclude common false positives:
  //     - gpgkey=https://... (RPM repo GPG key URLs)
  //     - ssh-authorized-keys (cloud-config YAML directive)
  //     - Values that are URLs (start with http)
  //     - Values that are shell variable references
  if (
    /AKIA[0-9A-Z]{16}/.test(nonCommentLines) ||
    /(?:api_key|api_token|api_secret|access_key|secret_key|private_key)\s*[=:]\s*['"]?(?!\$)[A-Za-z0-9/+=]{20,}/i.test(nonCommentLines)
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
  // Exclude common false positives:
  //   - 169.254.169.254 (instance metadata service — always local, HTTPS not available)
  //   - localhost / 127.0.0.1 (local loopback)
  //   - Package repo URLs (yum, repo, mirror, download subdomains)
  //   - Package manager config lines (baseurl=, gpgkey=, mirrorlist=, metalink=)
  //   - Comment lines already excluded via nonCommentLines
  const httpLines = nonCommentLines.split(/\r?\n/).filter(l =>
    /http:\/\//.test(l) &&
    !/^[ \t]*(baseurl|gpgkey|mirrorlist|metalink)\s*=/i.test(l),
  );
  const hasSuspiciousHttp = httpLines.some(l => {
    const urls = l.match(/http:\/\/[^\s"']+/gi) || [];
    return urls.some(url =>
      !/^http:\/\/(localhost|127\.0\.0\.1|169\.254\.169\.254)/i.test(url) &&
      !/^http:\/\/(yum|repo|mirror|download)\./i.test(url),
    );
  });
  if (hasSuspiciousHttp) {
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

  // MEDIUM: Security controls disabled (only in non-comment lines)
  if (/setenforce\s+0/.test(nonCommentLines) || /iptables\s+-F/.test(nonCommentLines)) {
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

/**
 * CRITICAL/HIGH: NSG rules with 0.0.0.0/0 source on sensitive ports.
 * Similar to checkOpenSecurityRules but for NSG rules.
 */
function checkNsgOpenRules(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'network/nsg-rule') return;
  if (rawData.direction !== 'INGRESS') return;

  const source = rawData.source;
  if (source !== '0.0.0.0/0' && source !== '::/0') return;

  // All-protocol rule
  if (rawData.protocol === 'all') {
    findings.push(
      makeFinding(
        resource,
        'HIGH',
        'Network Security',
        'NSG rule allows all protocols from 0.0.0.0/0',
        `NSG rule in "${resource.displayName || resource.ocid}" allows ALL protocols from ${source}. This is extremely permissive.`,
        'Replace with specific protocol and port rules limited to trusted source CIDRs.',
      ),
    );
    return;
  }

  // TCP rule — check sensitive ports
  const tcpOptions = rawData.tcpOptions;
  if (tcpOptions?.destinationPortRange) {
    const minPort = tcpOptions.destinationPortRange.min;
    const maxPort = tcpOptions.destinationPortRange.max;
    for (const sensitivePort of SENSITIVE_PORTS) {
      if (sensitivePort >= minPort && sensitivePort <= maxPort) {
        findings.push(
          makeFinding(
            resource,
            'CRITICAL',
            'Network Security',
            `NSG open ingress on port ${sensitivePort} from ${source}`,
            `NSG rule allows ingress from ${source} on port ${sensitivePort} (range ${minPort}-${maxPort}). This exposes sensitive services to the internet.`,
            'Restrict the source CIDR to trusted IP ranges and limit port ranges.',
          ),
        );
      }
    }
  }
}

/**
 * MEDIUM: Load balancers without WAF protection.
 */
function checkLoadBalancerWithoutWaf(
  resource: ResourceRow,
  wafProtectedLbOcids: Set<string>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'network/load-balancer') return;

  // Only flag public-facing load balancers — private LBs aren't internet-exposed
  const rawData = typeof resource.rawData === 'string'
    ? JSON.parse(resource.rawData)
    : resource.rawData;
  if (rawData?.isPrivate === true) return;

  if (!wafProtectedLbOcids.has(resource.ocid)) {
    findings.push(
      makeFinding(
        resource,
        'MEDIUM',
        'Network Security',
        'Load balancer without WAF protection',
        `Load balancer "${resource.displayName}" does not have a Web Application Firewall (WAF) policy attached. Public-facing load balancers should use WAF for additional protection.`,
        'Attach a WAF policy to the load balancer to protect against common web attacks.',
      ),
    );
  }
}

/**
 * HIGH: Certificates expiring within 30 days.
 * MEDIUM: Certificates expiring within 90 days.
 */
function checkExpiringCertificates(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'security/certificate') return;

  const currentVersion = rawData.currentVersion;
  if (!currentVersion?.validity?.timeOfValidityNotAfter) return;

  const expiryDate = new Date(currentVersion.validity.timeOfValidityNotAfter);
  const now = new Date();
  const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) {
    findings.push(
      makeFinding(
        resource,
        'CRITICAL',
        'Security',
        'Expired certificate',
        `Certificate "${resource.displayName}" expired ${Math.abs(daysUntilExpiry)} days ago. Expired certificates will cause TLS failures.`,
        'Renew or replace the certificate immediately.',
      ),
    );
  } else if (daysUntilExpiry <= 30) {
    findings.push(
      makeFinding(
        resource,
        'HIGH',
        'Security',
        'Certificate expiring within 30 days',
        `Certificate "${resource.displayName}" expires in ${daysUntilExpiry} days (${expiryDate.toISOString().slice(0, 10)}). Renew before expiry to avoid outages.`,
        'Renew the certificate or configure auto-renewal through OCI Certificate Service.',
      ),
    );
  } else if (daysUntilExpiry <= 90) {
    findings.push(
      makeFinding(
        resource,
        'MEDIUM',
        'Security',
        'Certificate expiring within 90 days',
        `Certificate "${resource.displayName}" expires in ${daysUntilExpiry} days (${expiryDate.toISOString().slice(0, 10)}). Plan renewal soon.`,
        'Schedule certificate renewal to avoid last-minute renewals.',
      ),
    );
  }
}

/**
 * MEDIUM: Bastions with overly permissive CIDR allow lists.
 */
function checkBastionPermissiveCidr(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'security/bastion') return;

  const allowList = rawData.clientCidrBlockAllowList;
  if (!Array.isArray(allowList)) return;

  for (const cidr of allowList) {
    if (cidr === '0.0.0.0/0' || cidr === '::/0') {
      findings.push(
        makeFinding(
          resource,
          'MEDIUM',
          'Security',
          'Bastion allows connections from any IP',
          `Bastion "${resource.displayName}" has ${cidr} in its client CIDR allow list, allowing connections from any IP address.`,
          'Restrict the bastion CIDR allow list to specific trusted IP ranges.',
        ),
      );
      break;
    }
  }
}

// ---------------------------------------------------------------
// Database checks
// ---------------------------------------------------------------

/**
 * HIGH: Autonomous Database without NSG.
 */
function checkDatabaseWithoutNsg(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType === 'database/autonomous-database') {
    const nsgIds = rawData.nsgIds;
    if (!nsgIds || (Array.isArray(nsgIds) && nsgIds.length === 0)) {
      findings.push(
        makeFinding(
          resource,
          'HIGH',
          'Network Security',
          'Autonomous Database without Network Security Group',
          `Autonomous Database "${resource.displayName}" is not associated with any Network Security Group. ` +
            `Without NSGs, the database relies solely on security lists for network access control.`,
          'Associate the database with an NSG to apply fine-grained network rules.',
        ),
      );
    }
  }

  if (resource.resourceType === 'database/mysql-db-system') {
    const nsgIds = rawData.nsgIds;
    if (!nsgIds || (Array.isArray(nsgIds) && nsgIds.length === 0)) {
      findings.push(
        makeFinding(
          resource,
          'HIGH',
          'Network Security',
          'MySQL DB System without Network Security Group',
          `MySQL DB System "${resource.displayName}" is not associated with any Network Security Group.`,
          'Associate the MySQL DB System with an NSG to restrict network access.',
        ),
      );
    }
  }
}

/**
 * MEDIUM: MySQL without high availability.
 */
function checkMysqlWithoutHa(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'database/mysql-db-system') return;

  if (rawData.isHighlyAvailable === false) {
    findings.push(
      makeFinding(
        resource,
        'MEDIUM',
        'Reliability',
        'MySQL DB System without high availability',
        `MySQL DB System "${resource.displayName}" does not have high availability enabled. ` +
          `A single-node deployment has no automatic failover.`,
        'Enable high availability to get automatic failover with a standby node in a different fault domain.',
      ),
    );
  }
}

/**
 * MEDIUM: MySQL without crash recovery.
 */
function checkMysqlWithoutCrashRecovery(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'database/mysql-db-system') return;

  if (rawData.crashRecovery === 'DISABLED') {
    findings.push(
      makeFinding(
        resource,
        'MEDIUM',
        'Reliability',
        'MySQL DB System with crash recovery disabled',
        `MySQL DB System "${resource.displayName}" has crash recovery disabled. ` +
          `Data may be lost in the event of an unexpected failure.`,
        'Enable crash recovery to protect against data loss from unexpected failures.',
      ),
    );
  }
}

// ---------------------------------------------------------------
// Storage checks
// ---------------------------------------------------------------

/**
 * MEDIUM: Buckets without versioning.
 */
function checkBucketWithoutVersioning(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'storage/bucket') return;

  if (!rawData.versioning || rawData.versioning === 'Disabled') {
    findings.push(
      makeFinding(
        resource,
        'MEDIUM',
        'Data Protection',
        'Bucket without versioning enabled',
        `Bucket "${resource.displayName}" does not have object versioning enabled. ` +
          `Without versioning, deleted or overwritten objects cannot be recovered.`,
        'Enable versioning on the bucket to protect against accidental deletion or overwrites.',
      ),
    );
  }
}

/**
 * HIGH: File system without KMS encryption.
 */
function checkFileSystemWithoutKms(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'storage/file-system') return;

  if (!rawData.kmsKeyId) {
    findings.push(
      makeFinding(
        resource,
        'HIGH',
        'Data Encryption',
        'File system not encrypted with customer-managed key',
        `File system "${resource.displayName}" does not have a customer-managed KMS key. ` +
          `Customer-managed keys provide full control over the encryption lifecycle.`,
        'Configure a customer-managed KMS key for the file system.',
      ),
    );
  }
}

// ---------------------------------------------------------------
// IAM checks (additional)
// ---------------------------------------------------------------

/**
 * HIGH: IAM users without MFA.
 */
function checkUserWithoutMfa(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'iam/user') return;

  if (rawData.isMfaActivated === false) {
    findings.push(
      makeFinding(
        resource,
        'HIGH',
        'IAM Security',
        'IAM user without MFA enabled',
        `User "${resource.displayName}" does not have multi-factor authentication enabled. ` +
          `Accounts without MFA are vulnerable to credential compromise.`,
        'Enable MFA for all IAM users, especially those with administrative privileges.',
      ),
    );
  }
}

// ---------------------------------------------------------------
// Load balancer checks (additional)
// ---------------------------------------------------------------

/**
 * MEDIUM: Public load balancer with plain HTTP listener.
 */
function checkPublicLbHttpListener(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'network/load-balancer') return;
  if (rawData.isPrivate === true) return;

  const listeners = rawData.listeners;
  if (!listeners || typeof listeners !== 'object') return;

  for (const [name, listener] of Object.entries<any>(listeners)) {
    if (listener?.protocol === 'HTTP') {
      findings.push(
        makeFinding(
          resource,
          'MEDIUM',
          'Network Security',
          'Public load balancer with HTTP listener (no TLS)',
          `Public load balancer "${resource.displayName}" has an HTTP listener "${name}" (port ${listener.port ?? '?'}). ` +
            `Traffic is unencrypted and vulnerable to interception.`,
          'Configure HTTPS listeners with TLS certificates or add an HTTP-to-HTTPS redirect rule.',
        ),
      );
      break; // one finding per LB is enough
    }
  }
}

// ---------------------------------------------------------------
// Network checks (additional)
// ---------------------------------------------------------------

/**
 * MEDIUM: Security list egress rules allowing all protocols to 0.0.0.0/0.
 */
function checkEgressAllProtocol(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'network/security-list') return;

  const egressRules = rawData.egressSecurityRules;
  if (!Array.isArray(egressRules)) return;

  for (const rule of egressRules) {
    if (rule.protocol === 'all' && (rule.destination === '0.0.0.0/0' || rule.destination === '::/0')) {
      findings.push(
        makeFinding(
          resource,
          'MEDIUM',
          'Network Security',
          'Egress rule allows all protocols to 0.0.0.0/0',
          `Security list "${resource.displayName}" has an egress rule allowing ALL protocols to ${rule.destination}. ` +
            `Unrestricted egress can allow data exfiltration.`,
          'Restrict egress rules to specific protocols and destinations required by your workloads.',
        ),
      );
      break;
    }
  }
}

/**
 * MEDIUM: NSG egress rules allowing all protocols to 0.0.0.0/0.
 */
function checkNsgEgressAllProtocol(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'network/nsg-rule') return;
  if (rawData.direction !== 'EGRESS') return;

  const dest = rawData.destination;
  if ((dest === '0.0.0.0/0' || dest === '::/0') && rawData.protocol === 'all') {
    findings.push(
      makeFinding(
        resource,
        'MEDIUM',
        'Network Security',
        'NSG egress rule allows all protocols to 0.0.0.0/0',
        `NSG rule in "${resource.displayName || resource.ocid}" allows ALL protocols egress to ${dest}. Unrestricted egress can allow data exfiltration.`,
        'Restrict egress to specific protocols and destinations.',
      ),
    );
  }
}

/**
 * LOW: Reserved public IP not assigned to anything.
 */
function checkUnassignedPublicIp(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'network/public-ip') return;
  if (rawData.lifetime !== 'RESERVED') return;

  if (!rawData.assignedEntityId) {
    findings.push(
      makeFinding(
        resource,
        'LOW',
        'Operations',
        'Reserved public IP not assigned to any resource',
        `Reserved public IP "${resource.displayName}" (${rawData.ipAddress ?? 'unknown'}) is not assigned to any resource. ` +
          `Unassigned reserved IPs incur costs.`,
        'Assign the IP to a resource or release it to avoid unnecessary costs.',
      ),
    );
  }
}

/**
 * LOW: Internet gateway that is disabled.
 */
function checkDisabledInternetGateway(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'network/internet-gateway') return;

  if (rawData.isEnabled === false) {
    findings.push(
      makeFinding(
        resource,
        'LOW',
        'Operations',
        'Disabled internet gateway',
        `Internet gateway "${resource.displayName}" exists but is disabled. ` +
          `This may indicate a misconfiguration or an unused resource.`,
        'Either enable the gateway if it is needed or delete it to reduce clutter.',
      ),
    );
  }
}

/**
 * LOW: NAT gateway with traffic blocked.
 */
function checkBlockedNatGateway(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'network/nat-gateway') return;

  if (rawData.blockTraffic === true) {
    findings.push(
      makeFinding(
        resource,
        'LOW',
        'Operations',
        'NAT gateway with traffic blocked',
        `NAT gateway "${resource.displayName}" has blockTraffic set to true. ` +
          `This effectively disables the gateway while still incurring costs.`,
        'Either unblock traffic if the gateway is needed or delete it.',
      ),
    );
  }
}

// ---------------------------------------------------------------
// Observability checks
// ---------------------------------------------------------------

/**
 * MEDIUM: Disabled alarms.
 */
function checkDisabledAlarm(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'observability/alarm') return;

  if (rawData.isEnabled === false) {
    findings.push(
      makeFinding(
        resource,
        'MEDIUM',
        'Observability',
        'Monitoring alarm is disabled',
        `Alarm "${resource.displayName}" is disabled. Disabled alarms will not trigger notifications, creating gaps in monitoring coverage.`,
        'Enable the alarm or delete it if no longer relevant.',
      ),
    );
  }
}

/**
 * MEDIUM: Disabled logs.
 */
function checkDisabledLog(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'observability/log') return;

  if (rawData.isEnabled === false) {
    findings.push(
      makeFinding(
        resource,
        'MEDIUM',
        'Observability',
        'Log is disabled',
        `Log "${resource.displayName}" is disabled. Disabled logs create gaps in audit trails and troubleshooting data.`,
        'Enable the log or delete it if the source is no longer relevant.',
      ),
    );
  }
}

// ---------------------------------------------------------------
// Container security checks
// ---------------------------------------------------------------

/**
 * HIGH: Container scan result with CRITICAL severity.
 */
function checkCriticalContainerScan(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'security/container-scan-result') return;

  const severity = rawData.highestProblemSeverity;
  if (severity === 'CRITICAL') {
    findings.push(
      makeFinding(
        resource,
        'CRITICAL',
        'Container Security',
        'Container image with critical vulnerabilities',
        `Container scan for "${resource.displayName}" found CRITICAL vulnerabilities (${rawData.problemCount ?? '?'} problems). ` +
          `Critical vulnerabilities may allow remote code execution or data exposure.`,
        'Rebuild the container image with updated base images and patched dependencies.',
      ),
    );
  } else if (severity === 'HIGH') {
    findings.push(
      makeFinding(
        resource,
        'HIGH',
        'Container Security',
        'Container image with high-severity vulnerabilities',
        `Container scan for "${resource.displayName}" found HIGH severity vulnerabilities (${rawData.problemCount ?? '?'} problems).`,
        'Update the container image dependencies to address the identified vulnerabilities.',
      ),
    );
  }
}

// ---------------------------------------------------------------
// IAM: Stale API keys (CIS 1.8)
// ---------------------------------------------------------------

/**
 * HIGH: API keys older than 90 days that are still active.
 *
 * False-positive mitigation:
 *   - Only flag keys in ACTIVE state (skip INACTIVE / DELETED).
 *   - Skip keys with no timeCreated (data missing).
 *   - 90-day threshold aligns with CIS benchmark recommendation.
 */
function checkStaleApiKey(
  resource: ResourceRow,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'iam/api-key') return;
  if (resource.lifecycleState?.toUpperCase() !== 'ACTIVE') return;
  if (!resource.timeCreated) return;

  const created = new Date(resource.timeCreated).getTime();
  if (isNaN(created)) return;
  const ageDays = Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24));
  if (ageDays > 90) {
    findings.push(
      makeFinding(
        resource,
        'HIGH',
        'IAM Security',
        'API key not rotated in over 90 days',
        `API key "${resource.displayName}" is ${ageDays} days old and still active. ` +
          `Long-lived API keys increase the risk of credential compromise.`,
        'Rotate the API key: generate a new key, update all consumers, then delete the old key.',
      ),
    );
  }
}

// ---------------------------------------------------------------
// IAM: Stale customer secret keys (CIS 1.9)
// ---------------------------------------------------------------

/**
 * HIGH: Customer secret keys that have expired.
 *
 * False-positive mitigation:
 *   - Only flag keys in ACTIVE state.
 *   - Only flag when timeExpires is present and in the past.
 */
function checkStaleCustomerSecretKey(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'iam/customer-secret-key') return;
  if (resource.lifecycleState?.toUpperCase() !== 'ACTIVE') return;

  if (rawData.timeExpires) {
    const expires = new Date(rawData.timeExpires);
    if (!isNaN(expires.getTime()) && expires.getTime() < Date.now()) {
      findings.push(
        makeFinding(
          resource,
          'CRITICAL',
          'IAM Security',
          'Expired customer secret key still active',
          `Customer secret key "${resource.displayName}" has expired (${expires.toISOString().slice(0, 10)}) but is still in ACTIVE state. ` +
            `Expired credentials should be deactivated or deleted.`,
          'Delete or deactivate the expired customer secret key immediately.',
        ),
      );
    }
  }
}

// ---------------------------------------------------------------
// IAM: Broad dynamic groups (CIS 1.5)
// ---------------------------------------------------------------

/**
 * MEDIUM: Dynamic groups with matching rules that are overly broad.
 *
 * False-positive mitigation:
 *   - Only flag rules that reference the tenancy OCID directly
 *     (compartment.id = 'ocid1.tenancy.…') or use empty "Any {}".
 *   - Compartment-scoped rules are left alone.
 */
function checkBroadDynamicGroup(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'iam/dynamic-group') return;

  const rule = rawData.matchingRule;
  if (typeof rule !== 'string') return;

  const lower = rule.toLowerCase().replace(/\s+/g, ' ');

  const matchesTenancy = /compartment\.id\s*=\s*'ocid1\.tenancy\./.test(lower);
  const matchesAll = /any\s*\{\s*\}/.test(lower);

  if (matchesTenancy || matchesAll) {
    findings.push(
      makeFinding(
        resource,
        'MEDIUM',
        'IAM Security',
        'Overly broad dynamic group matching rule',
        `Dynamic group "${resource.displayName}" has a matching rule that applies to all resources ` +
          `in the tenancy. This grants the associated policies to every matching resource.`,
        'Scope the matching rule to a specific compartment or resource type.',
      ),
    );
  }
}

// ---------------------------------------------------------------
// IAM: Policies granting access to any-user (CIS 1.1.3)
// ---------------------------------------------------------------

/**
 * HIGH: Policies that grant access to "any-user" (all authenticated users).
 *
 * False-positive mitigation:
 *   - Only match the word-boundary-delimited "any-user" subject.
 *   - Skip statements with "inspect" verb — read-only listing is
 *     intentional for public catalogs.
 */
function checkAnyUserPolicy(
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
    if (/\bany-user\b/.test(lower) && /\ballow\b/.test(lower) && !/\binspect\b/.test(lower)) {
      findings.push(
        makeFinding(
          resource,
          'HIGH',
          'IAM Security',
          'IAM policy grants access to any-user',
          `Policy "${resource.displayName}" contains a statement granting access to any-user: "${stmt}". ` +
            `This may allow unintended access to OCI resources.`,
          'Replace any-user with a specific group or dynamic group. Use least-privilege principles.',
        ),
      );
      break;
    }
  }
}

// ---------------------------------------------------------------
// Load balancer: Public LB/NLB without NSG
// ---------------------------------------------------------------

/**
 * HIGH: Public-facing load balancers without any NSG.
 *
 * False-positive mitigation:
 *   - Only flag when isPrivate is explicitly false.
 *   - Skip if isPrivate is null/undefined (data not exported).
 */
function checkPublicLbWithoutNsg(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  const isLb = resource.resourceType === 'network/load-balancer';
  const isNlb = resource.resourceType === 'network/network-load-balancer';
  if (!isLb && !isNlb) return;

  if (rawData.isPrivate !== false) return;

  const nsgIds = rawData.networkSecurityGroupIds;
  if (!nsgIds || (Array.isArray(nsgIds) && nsgIds.length === 0)) {
    const kind = isLb ? 'Load balancer' : 'Network load balancer';
    findings.push(
      makeFinding(
        resource,
        'HIGH',
        'Network Security',
        isLb
          ? 'Public load balancer without Network Security Group'
          : 'Public network load balancer without Network Security Group',
        `${kind} "${resource.displayName}" is public-facing but has no Network Security Group attached. ` +
          `Without NSGs, traffic filtering relies solely on security lists.`,
        `Attach one or more NSGs to the ${kind.toLowerCase()} to enforce fine-grained traffic rules.`,
      ),
    );
  }
}

// ---------------------------------------------------------------
// Storage: Bucket without object events (CIS 2.1.4)
// ---------------------------------------------------------------

/**
 * LOW: Buckets without object events — no audit trail for object-level ops.
 *
 * False-positive mitigation:
 *   - Only flag when objectEventsEnabled is explicitly false.
 *   - Skip null/undefined (data not exported).
 */
function checkBucketWithoutObjectEvents(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'storage/bucket') return;

  if (rawData.objectEventsEnabled === false) {
    findings.push(
      makeFinding(
        resource,
        'LOW',
        'Observability',
        'Bucket without object events enabled',
        `Bucket "${resource.displayName}" does not have object events enabled. ` +
          `Without object events there is no audit trail of object-level operations.`,
        'Enable object events on the bucket to get notifications for object lifecycle operations.',
      ),
    );
  }
}

// ---------------------------------------------------------------
// Secret management: Never-rotated secrets (CIS 2.2.1)
// ---------------------------------------------------------------

/**
 * MEDIUM: Vault secrets that have never been rotated and have no
 * auto-rotation configured.
 *
 * False-positive mitigation:
 *   - Skip secrets in PENDING_DELETION, DELETED, CANCELLING_DELETION state.
 *   - Skip secrets that have a rotationConfig (auto-rotation set up).
 *   - Skip secrets that have been rotated at least once (lastRotationTime present).
 */
function checkSecretNotRotated(
  resource: ResourceRow,
  rawData: Record<string, any>,
  findings: AuditFinding[],
): void {
  if (resource.resourceType !== 'security/secret') return;

  const state = resource.lifecycleState?.toUpperCase();
  if (state === 'PENDING_DELETION' || state === 'DELETED' || state === 'CANCELLING_DELETION') return;

  if (rawData.rotationConfig) return;
  if (rawData.lastRotationTime) return;

  findings.push(
    makeFinding(
      resource,
      'MEDIUM',
      'Secret Management',
      'Vault secret has never been rotated',
      `Secret "${resource.displayName}" has never been rotated and has no auto-rotation configured. ` +
        `Long-lived secrets increase the window of exposure if compromised.`,
      'Configure automatic rotation or establish a manual rotation schedule for this secret.',
    ),
  );
}
