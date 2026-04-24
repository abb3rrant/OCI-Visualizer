import { PrismaClient } from '@prisma/client';
import type { AuditFinding } from './audit.js';

const CHUNK_SIZE = 5000;

interface AuditRule {
  id: string;
  name: string;
  description: string | null;
  resourceType: string;
  fieldPath: string;
  operator: string;
  value: string | null;
  severity: string;
  message: string;
  recommendation: string | null;
  category: string;
  framework: string | null;
  enabled: boolean;
}

function getNestedValue(obj: Record<string, any>, dotPath: string): any {
  const parts = dotPath.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

/** Check if a regex pattern is likely safe (no catastrophic backtracking) */
function isSafeRegex(pattern: string): boolean {
  // Reject patterns longer than 200 chars or with nested quantifiers like (a+)+
  if (pattern.length > 200) return false;
  // Detect nested quantifiers: (group with quantifier) followed by quantifier
  if (/(\+|\*|\{)\)?(\+|\*|\{)/.test(pattern)) return false;
  return true;
}

function evaluateCondition(fieldValue: any, operator: string, ruleValue: string | null, regexCache?: Map<string, RegExp>): boolean {
  switch (operator) {
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null;
    case 'notExists':
      return fieldValue === undefined || fieldValue === null;
    case 'equals':
      return String(fieldValue) === ruleValue;
    case 'notEquals':
      return String(fieldValue) !== ruleValue;
    case 'contains':
      return typeof fieldValue === 'string' && ruleValue != null && fieldValue.includes(ruleValue);
    case 'greaterThan':
      return typeof fieldValue === 'number' && ruleValue != null && fieldValue > Number(ruleValue);
    case 'lessThan':
      return typeof fieldValue === 'number' && ruleValue != null && fieldValue < Number(ruleValue);
    case 'matches': {
      if (typeof fieldValue !== 'string' || !ruleValue) return false;
      // Cap input length to prevent excessive backtracking
      const safeInput = fieldValue.length > 10000 ? fieldValue.slice(0, 10000) : fieldValue;
      const cached = regexCache?.get(ruleValue);
      if (cached) return cached.test(safeInput);
      // Always check safety before creating RegExp, even on cache miss
      if (!isSafeRegex(ruleValue)) return false;
      try {
        return new RegExp(ruleValue).test(safeInput);
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

export async function evaluateCustomRules(
  prisma: PrismaClient,
  snapshotId: string,
  userId: string,
): Promise<AuditFinding[]> {
  // Fetch enabled rules for this user (limited to 50)
  const rules = await prisma.auditRule.findMany({
    where: { userId, enabled: true },
    take: 50,
  }) as AuditRule[];

  if (rules.length === 0) return [];

  const findings: AuditFinding[] = [];

  // Group rules by resource type for efficient scanning
  const rulesByType = new Map<string, AuditRule[]>();
  const wildcardRules: AuditRule[] = [];

  for (const rule of rules) {
    if (rule.resourceType === '*') {
      wildcardRules.push(rule);
    } else {
      const existing = rulesByType.get(rule.resourceType) || [];
      existing.push(rule);
      rulesByType.set(rule.resourceType, existing);
    }
  }

  // Get all resource IDs
  const allMeta = await prisma.resource.findMany({
    where: { snapshotId },
    select: { id: true },
  });

  const allIds = allMeta.map(r => r.id);

  // Pre-compile regex patterns (with safety check)
  const regexCache = new Map<string, RegExp>();
  for (const rule of rules) {
    if (rule.operator === 'matches' && rule.value && isSafeRegex(rule.value)) {
      try {
        regexCache.set(rule.value, new RegExp(rule.value));
      } catch {}
    }
  }

  // Process in chunks
  for (let i = 0; i < allIds.length; i += CHUNK_SIZE) {
    const chunkIds = allIds.slice(i, i + CHUNK_SIZE);

    const resources = await prisma.resource.findMany({
      where: { id: { in: chunkIds } },
      select: {
        id: true,
        ocid: true,
        resourceType: true,
        displayName: true,
        rawData: true,
        freeformTags: true,
      },
    });

    for (const resource of resources) {
      // Get applicable rules
      const applicableRules = [
        ...(rulesByType.get(resource.resourceType) || []),
        ...wildcardRules,
      ];
      if (applicableRules.length === 0) continue;

      let rawData: Record<string, any> = {};
      if (resource.rawData) {
        try { rawData = JSON.parse(resource.rawData as string); } catch { continue; }
      }

      // Also parse freeform tags to make them accessible via fieldPath
      let tags: Record<string, string> = {};
      if (resource.freeformTags) {
        try { tags = JSON.parse(resource.freeformTags as string); } catch {}
      }

      // Merge tags into rawData under freeformTags key for dotpath access
      const data = { ...rawData, freeformTags: tags };

      for (const rule of applicableRules) {
        const fieldValue = getNestedValue(data, rule.fieldPath);
        const conditionMet = evaluateCondition(fieldValue, rule.operator, rule.value, regexCache);

        // Rule violation: condition NOT met = violation
        if (!conditionMet) {
          findings.push({
            severity: rule.severity as any,
            category: rule.category,
            title: rule.message,
            description: rule.description || `Custom rule "${rule.name}" violated.`,
            resourceId: resource.id,
            resourceOcid: resource.ocid,
            resourceName: resource.displayName,
            recommendation: rule.recommendation || 'Review this resource against the custom rule.',
          });
        }
      }
    }
  }

  return findings;
}
