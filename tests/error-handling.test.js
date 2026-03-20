const AICommitGenerator = require('../src/index');
const chalk = require('chalk');

describe('AICommitGenerator Error Handling', () => {
  let generator;

  beforeEach(() => {
    generator = new AICommitGenerator();
  });

  describe('identifyErrorType', () => {
    test('identifies "no staged changes" error', () => {
      const error = new Error('No staged changes found. Please stage your changes first.');
      expect(generator.identifyErrorType(error)).toBe('git_no_changes');
    });

    test('identifies "not a git repository" error', () => {
      const error = new Error('not a git repository (or any of the parent directories): .git');
      expect(generator.identifyErrorType(error)).toBe('git_not_repo');
    });

    test('identifies AI authentication error (401)', () => {
      const error = new Error('AI provider returned 401 Unauthorized');
      expect(generator.identifyErrorType(error)).toBe('ai_auth_error');
    });

    test('identifies AI rate limit error (429)', () => {
      const error = new Error('AI provider returned 429 Too Many Requests');
      expect(generator.identifyErrorType(error)).toBe('ai_rate_limit');
    });

    test('returns "unknown" for unrecognized errors', () => {
      const error = new Error('Some random error');
      expect(generator.identifyErrorType(error)).toBe('unknown');
    });
  });

  describe('getLocalSuggestion', () => {
    test('returns suggestion for git_no_changes', () => {
      const suggestion = generator.getLocalSuggestion('git_no_changes');
      expect(suggestion).toContain('git add');
    });

    test('returns suggestion for git_not_repo', () => {
      const suggestion = generator.getLocalSuggestion('git_not_repo');
      expect(suggestion).toContain('git init');
    });

    test('returns suggestion for ai_auth_error', () => {
      const suggestion = generator.getLocalSuggestion('ai_auth_error');
      expect(suggestion).toContain('aic setup');
    });

    test('returns default suggestion for unknown type', () => {
      const suggestion = generator.getLocalSuggestion('unknown');
      expect(suggestion).toContain('Check your internet connection');
    });
  });

  describe('provideErrorSuggestions', () => {
    test('should not throw even if helper methods fail', () => {
      // Mocking to force an error internally
      jest.spyOn(generator, 'identifyErrorType').mockImplementation(() => {
        throw new Error('Internal failure');
      });
      
      expect(() => {
        generator.provideErrorSuggestions(new Error('test'), {});
      }).not.toThrow();
    });

    test('prints suggestion to console', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const error = new Error('No staged changes found');
      
      generator.provideErrorSuggestions(error, {});
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
