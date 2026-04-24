import { PrismaClient } from '@prisma/client';
import { GraphQLError } from 'graphql';
import type { AuthUser } from '../../middleware/auth.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';

interface Context {
  prisma: PrismaClient;
  user: AuthUser | null;
}

interface AuditRuleInput {
  name: string;
  description?: string;
  resourceType: string;
  fieldPath: string;
  operator: string;
  value?: string;
  severity: string;
  message: string;
  recommendation?: string;
  category?: string;
  framework?: string;
  enabled?: boolean;
}

const FIELD_PATH_REGEX = /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/;
const FIELD_PATH_MAX_LENGTH = 500;

function validateFieldPath(fieldPath: string): void {
  if (fieldPath.length > FIELD_PATH_MAX_LENGTH) {
    throw new GraphQLError('fieldPath exceeds maximum length of 500 characters', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  if (!FIELD_PATH_REGEX.test(fieldPath)) {
    throw new GraphQLError('fieldPath contains invalid characters. Only alphanumerics, underscores, and dots are allowed.', { extensions: { code: 'BAD_USER_INPUT' } });
  }
}

export const auditRulesResolvers = {
  Query: {
    auditRules: async (_parent: unknown, _args: unknown, ctx: Context) => {
      requireAuth(ctx.user);
      return ctx.prisma.auditRule.findMany({
        where: { userId: ctx.user!.userId },
        orderBy: { createdAt: 'desc' },
      });
    },
  },

  Mutation: {
    createAuditRule: async (
      _parent: unknown,
      args: { input: AuditRuleInput },
      ctx: Context,
    ) => {
      requireAuth(ctx.user);
      validateFieldPath(args.input.fieldPath);

      // Enforce 50 rule limit
      const count = await ctx.prisma.auditRule.count({
        where: { userId: ctx.user!.userId },
      });
      if (count >= 50) {
        throw new GraphQLError('Maximum of 50 custom audit rules allowed', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      return ctx.prisma.auditRule.create({
        data: {
          name: args.input.name,
          description: args.input.description || null,
          resourceType: args.input.resourceType,
          fieldPath: args.input.fieldPath,
          operator: args.input.operator,
          value: args.input.value || null,
          severity: args.input.severity,
          message: args.input.message,
          recommendation: args.input.recommendation || null,
          category: args.input.category || 'Custom',
          framework: args.input.framework || null,
          enabled: args.input.enabled ?? true,
          userId: ctx.user!.userId,
        },
      });
    },

    updateAuditRule: async (
      _parent: unknown,
      args: { id: string; input: AuditRuleInput },
      ctx: Context,
    ) => {
      requireAuth(ctx.user);
      validateFieldPath(args.input.fieldPath);

      // Verify ownership
      const existing = await ctx.prisma.auditRule.findUnique({
        where: { id: args.id },
      });
      if (!existing || existing.userId !== ctx.user!.userId) {
        throw new GraphQLError('Audit rule not found', { extensions: { code: 'NOT_FOUND' } });
      }

      return ctx.prisma.auditRule.update({
        where: { id: args.id },
        data: {
          name: args.input.name,
          description: args.input.description || null,
          resourceType: args.input.resourceType,
          fieldPath: args.input.fieldPath,
          operator: args.input.operator,
          value: args.input.value || null,
          severity: args.input.severity,
          message: args.input.message,
          recommendation: args.input.recommendation || null,
          category: args.input.category || 'Custom',
          framework: args.input.framework || null,
          enabled: args.input.enabled ?? true,
        },
      });
    },

    deleteAuditRule: async (
      _parent: unknown,
      args: { id: string },
      ctx: Context,
    ) => {
      requireAuth(ctx.user);

      const existing = await ctx.prisma.auditRule.findUnique({
        where: { id: args.id },
      });
      if (!existing || existing.userId !== ctx.user!.userId) {
        throw new GraphQLError('Audit rule not found', { extensions: { code: 'NOT_FOUND' } });
      }

      await ctx.prisma.auditRule.delete({ where: { id: args.id } });
      return true;
    },
  },
};
