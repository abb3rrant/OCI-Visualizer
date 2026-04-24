import { GraphQLError } from 'graphql';

const MAX_PATTERN_LENGTH = 200;

/**
 * Validate a user-supplied regex pattern before it hits Postgres.
 * - Caps length to reduce ReDoS blast radius.
 * - Ensures the pattern compiles as a JS RegExp (Postgres POSIX regex is
 *   a superset, but JS compilation catches most malformed inputs early).
 */
export function validateRegexPattern(pattern: string): string {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new GraphQLError(
      `Regex pattern too long (max ${MAX_PATTERN_LENGTH} characters).`,
      { extensions: { code: 'BAD_USER_INPUT' } },
    );
  }
  try {
    new RegExp(pattern);
  } catch (err) {
    throw new GraphQLError(
      `Invalid regex pattern: ${err instanceof Error ? err.message : 'unknown error'}`,
      { extensions: { code: 'BAD_USER_INPUT' } },
    );
  }
  return pattern;
}
