import { describe, it, expect } from 'vitest';
import { GraphQLError } from 'graphql';
import { validateRegexPattern } from './regexGuard.js';

describe('validateRegexPattern', () => {
  it('accepts simple patterns', () => {
    expect(validateRegexPattern('foo.*')).toBe('foo.*');
    expect(validateRegexPattern('^abc$')).toBe('^abc$');
  });

  it('rejects patterns longer than 200 chars', () => {
    const long = 'a'.repeat(201);
    expect(() => validateRegexPattern(long)).toThrow(GraphQLError);
  });

  it('rejects patterns that do not compile', () => {
    expect(() => validateRegexPattern('(')).toThrow(GraphQLError);
    expect(() => validateRegexPattern('[')).toThrow(GraphQLError);
  });

  it('tags rejections as BAD_USER_INPUT', () => {
    try {
      validateRegexPattern('[');
    } catch (err) {
      expect(err).toBeInstanceOf(GraphQLError);
      expect((err as GraphQLError).extensions.code).toBe('BAD_USER_INPUT');
      return;
    }
    throw new Error('expected throw');
  });
});
