import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { GraphQLError } from 'graphql';
import { signToken } from '../../middleware/auth.js';

interface Context {
  prisma: PrismaClient;
  user: { userId: string; email: string } | null;
}

export const authResolvers = {
  Query: {
    me: async (_parent: unknown, _args: unknown, ctx: Context) => {
      if (!ctx.user) return null;
      return ctx.prisma.user.findUnique({ where: { id: ctx.user.userId } });
    },
  },

  Mutation: {
    register: async (
      _parent: unknown,
      args: { email: string; password: string; name?: string },
      ctx: Context,
    ) => {
      try {
        if (args.password.length < 8) {
          throw new GraphQLError('Password must be at least 8 characters long.');
        }

        const existing = await ctx.prisma.user.findUnique({
          where: { email: args.email },
        });
        if (existing) {
          throw new GraphQLError('A user with that email already exists.');
        }

        const passwordHash = await bcrypt.hash(args.password, 10);
        const user = await ctx.prisma.user.create({
          data: {
            email: args.email,
            passwordHash,
            name: args.name ?? null,
          },
        });

        const token = signToken({ userId: user.id, email: user.email });
        return { token, user };
      } catch (err) {
        console.error('[register] Error:', err);
        if (err instanceof GraphQLError) throw err;
        throw new GraphQLError(
          err instanceof Error ? err.message : 'Registration failed',
        );
      }
    },

    login: async (
      _parent: unknown,
      args: { email: string; password: string },
      ctx: Context,
    ) => {
      try {
        const user = await ctx.prisma.user.findUnique({
          where: { email: args.email },
        });
        if (!user) {
          throw new GraphQLError('Invalid email or password.');
        }

        const valid = await bcrypt.compare(args.password, user.passwordHash);
        if (!valid) {
          throw new GraphQLError('Invalid email or password.');
        }

        const token = signToken({ userId: user.id, email: user.email });
        return { token, user };
      } catch (err) {
        console.error('[login] Error:', err);
        if (err instanceof GraphQLError) throw err;
        throw new GraphQLError(
          err instanceof Error ? err.message : 'Login failed',
        );
      }
    },
  },
};
