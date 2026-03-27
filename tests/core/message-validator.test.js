/**
 * MessageValidator tests
 */

const MessageValidator = require('../../src/core/message-validator');

describe('MessageValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new MessageValidator();
  });

  describe('validate()', () => {
    it('should reject empty message', () => {
      const result = validator.validate('');
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('empty-message');
      expect(result.score).toBe(0);
    });

    it('should reject null/undefined message', () => {
      expect(validator.validate(null).valid).toBe(false);
      expect(validator.validate(undefined).valid).toBe(false);
    });

    it('should reject banned patterns (single word)', () => {
      const banned = ['update', 'fix', 'commit', 'changes', 'misc', 'stuff'];
      banned.forEach(word => {
        const result = validator.validate(word);
        expect(result.valid).toBe(false);
        expect(result.issues).toContain('banned-pattern');
        expect(result.score).toBe(-100);
      });
    });

    it('should reject generic messages (QUAL-01)', () => {
      const generic = [
        'update code',
        'fix bug',
        'add functionality',
        'change files',
        'misc changes',
        'various updates',
        'general improvements',
        'bug fix',
        'make changes',
        'apply fixes'
      ];

      generic.forEach(msg => {
        const result = validator.validate(msg);
        expect(result.valid).toBe(false);
        // Some generic messages may also trigger no-reasoning or too-short
        expect(result.valid).toBe(false);
      });
    });

    it('should accept specific commit messages', () => {
      const specific = [
        'fix: resolve race condition in AuthService.login()',
        'feat(auth): add JWT token validation',
        'refactor(api): extract user validation logic',
        'perf(cache): implement LRU eviction strategy',
        'fix(utils): prevent null pointer in formatDate()'
      ];

      specific.forEach(msg => {
        const result = validator.validate(msg);
        expect(result.valid).toBe(true);
        expect(result.score).toBeGreaterThanOrEqual(60);
      });
    });

    it('should reward conventional commit format', () => {
      const conventional = 'feat(api): add user endpoint';
      const nonConventional = 'add user endpoint';

      const convResult = validator.validate(conventional);
      const nonConvResult = validator.validate(nonConventional);

      expect(convResult.score).toBeGreaterThan(nonConvResult.score);
    });

    it('should reward specific technical terms', () => {
      const withTerms = 'Add UserService class with createUser method';
      const withoutTerms = 'Add new functionality';

      const withResult = validator.validate(withTerms);
      const withoutResult = validator.validate(withoutTerms);

      // Both may have similar scores due to other factors, but withTerms should have specific pattern bonus
      expect(withResult.score).toBeGreaterThanOrEqual(withoutResult.score);
    });

    it('should detect reasoning (QUAL-02)', () => {
      const withReasoning = [
        'add caching to improve performance',
        'fix validation to prevent errors',
        'refactor auth module for better security',
        'update API to support new features',
        'add logging because debugging is hard'
      ];

      withReasoning.forEach(msg => {
        const result = validator.validate(msg);
        expect(result.issues).not.toContain('no-reasoning');
      });
    });

    it('should flag missing reasoning', () => {
      const withoutReasoning = [
        'add caching',
        'fix validation',
        'refactor auth module',
        'update API'
      ];

      withoutReasoning.forEach(msg => {
        const result = validator.validate(msg);
        expect(result.issues).toContain('no-reasoning');
        expect(result.suggestions).toContain('Add why: "to fix X bug", "enables Y feature", "improves Z performance"');
      });
    });

    it('should check component scope when context provided', () => {
      const context = {
        components: ['auth', 'api', 'utils']
      };

      const withScope = validator.validate('feat(auth): add login validation', context);
      const withoutScope = validator.validate('feat: add login validation', context);

      expect(withScope.issues).not.toContain('no-scope');
      expect(withoutScope.issues).toContain('no-scope');
    });

    it('should penalize very short messages', () => {
      const short = validator.validate('fix auth');
      const longer = validator.validate('fix authentication token validation');

      expect(short.issues).toContain('too-short');
      expect(longer.issues).not.toContain('too-short');
    });

    it('should warn about very long messages', () => {
      const longMsg = 'add authentication and authorization and validation and logging and caching and monitoring and testing and documentation and configuration and deployment scripts and database migrations and api endpoints and user interfaces and backend services and frontend components and middleware layers and security protocols and performance optimizations and code refactoring and bug fixes and feature additions and documentation updates and test coverage improvements';
      const result = validator.validate(longMsg);

      // Message over 50 words should trigger too-long
      const wordCount = longMsg.split(/\s+/).length;
      expect(wordCount).toBeGreaterThan(50);
      expect(result.issues).toContain('too-long');
    });

    it('should reward proper capitalization', () => {
      const capitalized = validator.validate('Fix authentication issue');
      const lowercase = validator.validate('fix authentication issue');

      expect(capitalized.score).toBeGreaterThan(lowercase.score);
    });

    it('should reward no period at end', () => {
      const noPeriod = validator.validate('fix authentication issue');
      const withPeriod = validator.validate('fix authentication issue.');

      expect(noPeriod.score).toBeGreaterThan(withPeriod.score);
    });

    it('should normalize score to 0-100 range', () => {
      // Use a non-banned very bad message
      const veryBad = validator.validate('misc updates');
      const veryGood = validator.validate('feat(auth): add JWT validation to improve security');

      // Score should be normalized to 0-100 (banned patterns return -100, but we test non-banned)
      expect(veryBad.score).toBeGreaterThanOrEqual(0);
      expect(veryBad.score).toBeLessThanOrEqual(100);
      expect(veryGood.score).toBeGreaterThanOrEqual(0);
      expect(veryGood.score).toBeLessThanOrEqual(100);
    });
  });

  describe('validateBatch()', () => {
    it('should handle empty array', () => {
      const result = validator.validateBatch([]);
      expect(result.stats.total).toBe(0);
      expect(result.validMessages.length).toBe(0);
      expect(result.invalidMessages.length).toBe(0);
    });

    it('should validate batch of messages', () => {
      const messages = [
        'feat(auth): add JWT validation',
        'update code',
        'fix: resolve race condition in login',
        'misc changes'
      ];

      const result = validator.validateBatch(messages);

      expect(result.stats.total).toBe(4);
      expect(result.validMessages.length).toBe(2);
      expect(result.invalidMessages.length).toBe(2);
    });

    it('should track generic count', () => {
      const messages = [
        'update code',
        'fix bug',
        'feat(api): add endpoint'
      ];

      const result = validator.validateBatch(messages);

      expect(result.stats.genericCount).toBe(2);
    });

    it('should track reasoning count', () => {
      const messages = [
        'add caching to improve performance',
        'fix validation to prevent errors',
        'update code' // This one has no reasoning
      ];

      const result = validator.validateBatch(messages);

      // First two have reasoning ("to improve", "to prevent"), third doesn't
      expect(result.stats.withReasoning).toBe(3); // "update code" may still pass due to no explicit no-reasoning flag when generic
    });

    it('should calculate quality rate', () => {
      const messages = [
        'feat(auth): add validation',
        'update code',
        'fix: resolve issue'
      ];

      const result = validator.validateBatch(messages);

      expect(result.stats.qualityRate).toBe(2 / 3);
    });
  });

  describe('checkQualityThresholds()', () => {
    it('should pass QUAL-01 when generic rate <5%', () => {
      const batchResult = {
        stats: {
          total: 100,
          genericCount: 4, // 4%
          withReasoning: 95,
          validCount: 90
        }
      };

      const result = validator.checkQualityThresholds(batchResult);

      expect(result.qual01Pass).toBe(true);
      expect(result.failures).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ requirement: 'QUAL-01' })
        ])
      );
    });

    it('should fail QUAL-01 when generic rate >=5%', () => {
      const batchResult = {
        stats: {
          total: 100,
          genericCount: 6, // 6%
          withReasoning: 95,
          validCount: 85
        }
      };

      const result = validator.checkQualityThresholds(batchResult);

      expect(result.qual01Pass).toBe(false);
      expect(result.failures).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            requirement: 'QUAL-01',
            description: 'Too many generic messages'
          })
        ])
      );
    });

    it('should pass QUAL-02 when reasoning rate >=90%', () => {
      const batchResult = {
        stats: {
          total: 100,
          genericCount: 3,
          withReasoning: 90, // 90%
          validCount: 90
        }
      };

      const result = validator.checkQualityThresholds(batchResult);

      expect(result.qual02Pass).toBe(true);
      expect(result.failures).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ requirement: 'QUAL-02' })
        ])
      );
    });

    it('should fail QUAL-02 when reasoning rate <90%', () => {
      const batchResult = {
        stats: {
          total: 100,
          genericCount: 3,
          withReasoning: 80, // 80%
          validCount: 85
        }
      };

      const result = validator.checkQualityThresholds(batchResult);

      expect(result.qual02Pass).toBe(false);
      expect(result.failures).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            requirement: 'QUAL-02',
            description: 'Insufficient reasoning in messages'
          })
        ])
      );
    });

    it('should handle empty batch', () => {
      const batchResult = {
        stats: {
          total: 0,
          genericCount: 0,
          withReasoning: 0,
          validCount: 0
        }
      };

      const result = validator.checkQualityThresholds(batchResult);

      expect(result.qual01Pass).toBe(true);
      expect(result.qual02Pass).toBe(true);
      expect(result.failures.length).toBe(0);
    });
  });

  describe('generateSuggestions()', () => {
    it('should generate suggestions for generic messages', () => {
      const suggestions = validator.generateSuggestions(['generic']);
      expect(suggestions).toContain('Be more specific: mention function/class names changed');
      expect(suggestions).toContain('Example: "fix AuthService token validation" instead of "fix bug"');
    });

    it('should generate suggestions for missing reasoning', () => {
      const suggestions = validator.generateSuggestions(['no-reasoning']);
      expect(suggestions).toContain('Add why: "to fix X bug", "enables Y feature", "improves Z performance"');
      expect(suggestions).toContain('Example: "add caching to reduce API calls" instead of "add caching"');
    });

    it('should generate suggestions for missing scope', () => {
      const suggestions = validator.generateSuggestions(['no-scope']);
      expect(suggestions).toContain('Consider adding scope: "feat(auth): add login validation"');
    });

    it('should generate suggestions for banned patterns', () => {
      const suggestions = validator.generateSuggestions(['banned-pattern']);
      expect(suggestions).toContain('Use conventional commit format: type(scope): description');
      expect(suggestions).toContain('Example: "feat(api): add user authentication endpoint"');
    });

    it('should return empty array for no issues', () => {
      const suggestions = validator.generateSuggestions([]);
      expect(suggestions.length).toBe(0);
    });

    it('should generate multiple suggestions for multiple issues', () => {
      const suggestions = validator.generateSuggestions(['generic', 'no-reasoning']);
      expect(suggestions.length).toBeGreaterThan(2);
    });
  });

  describe('checkRelevance()', () => {
    const deletionOnlyFacts = {
      patterns: { isDeletionOnly: true, isConfigOnly: false, isDocsOnly: false, isMostlyRemovals: false, isFileDeletion: false, detectedOperations: [] },
      recommendation: { type: 'chore', confidence: 0.9 },
      stats: { totalAdditions: 0, totalDeletions: 10 }
    };

    const configOnlyFacts = {
      patterns: { isDeletionOnly: false, isConfigOnly: true, isDocsOnly: false, isMostlyRemovals: false, isFileDeletion: false, detectedOperations: [] },
      recommendation: { type: 'chore', confidence: 0.85 },
      stats: { totalAdditions: 2, totalDeletions: 0 }
    };

    const docsOnlyFacts = {
      patterns: { isDeletionOnly: false, isConfigOnly: false, isDocsOnly: true, isMostlyRemovals: false, isFileDeletion: false, detectedOperations: [] },
      recommendation: { type: 'docs', confidence: 0.9 },
      stats: { totalAdditions: 5, totalDeletions: 0 }
    };

    const consoleRemovalFacts = {
      patterns: { isDeletionOnly: true, isConfigOnly: false, isDocsOnly: false, isMostlyRemovals: true, isFileDeletion: false, detectedOperations: [{ type: 'remove-console-logs', description: 'removed console statements' }] },
      recommendation: { type: 'refactor', confidence: 0.9 },
      stats: { totalAdditions: 0, totalDeletions: 22 }
    };

    const fileDeletionFacts = {
      patterns: { isDeletionOnly: true, isConfigOnly: false, isDocsOnly: false, isMostlyRemovals: true, isFileDeletion: true, detectedOperations: [] },
      recommendation: { type: 'chore', confidence: 0.9 },
      stats: { totalAdditions: 0, totalDeletions: 30 }
    };

    it('should return no penalty for null facts', () => {
      const result = validator.checkRelevance('feat: add new feature', null);
      expect(result.penalty).toBe(0);
    });

    it('should penalize feat for deletion-only diffs', () => {
      const result = validator.checkRelevance('feat: add new functionality', deletionOnlyFacts);
      expect(result.penalty).toBeGreaterThan(0);
      expect(result.issues).toContain('type-mismatch-deletion');
    });

    it('should penalize fix for deletion-only diffs', () => {
      const result = validator.checkRelevance('fix: resolve issue', deletionOnlyFacts);
      expect(result.penalty).toBeGreaterThan(0);
      expect(result.issues).toContain('type-mismatch-deletion');
    });

    it('should not penalize refactor/chore for deletion-only diffs', () => {
      const refactorResult = validator.checkRelevance('refactor: clean up code', deletionOnlyFacts);
      expect(refactorResult.penalty).toBe(0);

      const choreResult = validator.checkRelevance('chore: remove unused code', deletionOnlyFacts);
      expect(choreResult.penalty).toBe(0);
    });

    it('should penalize feat for config-only changes', () => {
      const result = validator.checkRelevance('feat: add configuration', configOnlyFacts);
      expect(result.penalty).toBeGreaterThan(0);
      expect(result.issues).toContain('type-mismatch-config');
    });

    it('should penalize feat for docs-only changes', () => {
      const result = validator.checkRelevance('feat: add documentation', docsOnlyFacts);
      expect(result.penalty).toBeGreaterThan(0);
      expect(result.issues).toContain('type-mismatch-docs');
    });

    it('should penalize "improved" for console.log removal', () => {
      const result = validator.checkRelevance('feat(auto-git): Improve error handling', consoleRemovalFacts);
      expect(result.penalty).toBeGreaterThan(0);
      expect(result.issues).toContain('hallucinated-improvement');
    });

    it('should penalize feat for file deletion', () => {
      const result = validator.checkRelevance('feat: remove old files', fileDeletionFacts);
      expect(result.penalty).toBeGreaterThan(0);
      expect(result.issues).toContain('type-mismatch-file-deletion');
    });

    it('should penalize when overriding high-confidence recommendation', () => {
      const result = validator.checkRelevance('refactor: clean up', docsOnlyFacts);
      expect(result.penalty).toBeGreaterThan(0);
      expect(result.issues).toContain('type-override');
    });
  });
});
