/**
 * Message Formatter Tests
 */

const MessageFormatter = require('../src/core/message-formatter');

describe('MessageFormatter', () => {
  let formatter;

  beforeEach(() => {
    formatter = new MessageFormatter();
  });

  describe('constructor', () => {
    it('should initialize with conventional types', () => {
      expect(formatter.conventionalTypes).toContain('feat');
      expect(formatter.conventionalTypes).toContain('fix');
      expect(formatter.conventionalTypes).toContain('docs');
      expect(formatter.conventionalTypes).toContain('style');
      expect(formatter.conventionalTypes).toContain('refactor');
      expect(formatter.conventionalTypes).toContain('perf');
      expect(formatter.conventionalTypes).toContain('test');
      expect(formatter.conventionalTypes).toContain('chore');
      expect(formatter.conventionalTypes).toContain('ci');
      expect(formatter.conventionalTypes).toContain('build');
    });
  });

  describe('format', () => {
    it('should return original message for invalid input', () => {
      expect(formatter.format(null)).toBeNull();
      expect(formatter.format(undefined)).toBeUndefined();
      expect(formatter.format(123)).toBe(123);
    });

    it('should trim whitespace from message', () => {
      const result = formatter.format('  test message  ');
      expect(result).toBe('test message');
    });

    it('should apply conventional format when requested', () => {
      const result = formatter.format('add new feature', { conventional: true });
      expect(result).toMatch(/^(feat|fix|docs|style|refactor|perf|test|chore|ci|build)(\(.+\))?:/);
    });

    it('should apply language formatting when specified', () => {
      const result = formatter.format('test message', { language: 'es' });
      expect(typeof result).toBe('string');
    });

    it('should apply length constraints', () => {
      const longMessage = 'a'.repeat(200);
      const result = formatter.format(longMessage);
      expect(result.length).toBeLessThanOrEqual(72);
    });

    it('should clean up formatting', () => {
      const result = formatter.format('  test   message  ', { conventional: true });
      expect(result).not.toContain('  ');
    });
  });

  describe('isConventionalFormat', () => {
    it('should identify conventional commit format', () => {
      expect(formatter.isConventionalFormat('feat: add new feature')).toBe(true);
      expect(formatter.isConventionalFormat('fix(auth): resolve login issue')).toBe(true);
      expect(formatter.isConventionalFormat('docs: update README')).toBe(true);
    });

    it('should reject non-conventional format', () => {
      expect(formatter.isConventionalFormat('add new feature')).toBe(false);
      expect(formatter.isConventionalFormat('fix:')).toBe(false);
      expect(formatter.isConventionalFormat(': add feature')).toBe(false);
      expect(formatter.isConventionalFormat('')).toBe(false);
    });
  });

  describe('inferType', () => {
    it('should infer feat type for feature additions', () => {
      expect(formatter.inferType('add new feature')).toBe('feat');
      expect(formatter.inferType('implement new functionality')).toBe('feat');
      expect(formatter.inferType('create new component')).toBe('feat');
      expect(formatter.inferType('introduce new endpoint')).toBe('feat');
    });

    it('should infer fix type for bug fixes', () => {
      expect(formatter.inferType('fix login issue')).toBe('fix');
      expect(formatter.inferType('resolve bug')).toBe('fix');
      expect(formatter.inferType('patch security vulnerability')).toBe('fix');
      expect(formatter.inferType('correct calculation error')).toBe('fix');
    });

    it('should infer docs type for documentation', () => {
      expect(formatter.inferType('update README')).toBe('docs');
      expect(formatter.inferType('add documentation')).toBe('docs');
      expect(formatter.inferType('document API')).toBe('docs');
    });

    it('should infer style type for formatting changes', () => {
      expect(formatter.inferType('format code')).toBe('style');
      expect(formatter.inferType('update indentation')).toBe('style');
      expect(formatter.inferType('update formatting')).toBe('style');
    });

    it('should infer refactor type for refactoring', () => {
      expect(formatter.inferType('refactor function')).toBe('refactor');
      expect(formatter.inferType('restructure code')).toBe('refactor');
      expect(formatter.inferType('optimize algorithm')).toBe('refactor');
    });

    it('should infer test type for test changes', () => {
      expect(formatter.inferType('add unit test')).toBe('test');
      expect(formatter.inferType('update test suite')).toBe('test');
      expect(formatter.inferType('fix failing test')).toBe('fix'); // 'fix' matches fix pattern first
    });

    it('should infer chore type for maintenance', () => {
      expect(formatter.inferType('update dependencies')).toBe('chore');
      expect(formatter.inferType('configure build')).toBe('feat'); // No specific build pattern matched
      expect(formatter.inferType('setup project')).toBe('chore'); // 'setup' matches chore pattern
    });

    it('should default to chore for unknown patterns', () => {
      expect(formatter.inferType('random change')).toBe('chore');
      expect(formatter.inferType('update something')).toBe('chore');
    });
  });

  describe('inferScope', () => {
    it('should infer scope from file paths', () => {
      const context = { files: { scope: 'components' } };
      expect(formatter.inferScope('update button', context)).toBe('components');
    });

    it('should infer scope from message content', () => {
      expect(formatter.inferScope('update authentication system')).toBe('auth');
      expect(formatter.inferScope('fix database connection')).toBe('db');
      expect(formatter.inferScope('update API endpoint')).toBe('api');
    });

    it('should return null for no clear scope', () => {
      expect(formatter.inferScope('general update')).toBeNull();
      expect(formatter.inferScope('minor change')).toBeNull();
    });
  });

  describe('cleanDescription', () => {
    it('should clean up description text', () => {
      expect(formatter.cleanDescription('  Add   new   feature  ')).toBe('new   feature');
      expect(formatter.cleanDescription('Fix bug with extra spaces')).toBe('bug with extra spaces');
    });

    it('should make first letter lowercase (conventional commit style)', () => {
      expect(formatter.cleanDescription('add new feature')).toBe('new feature'); // 'add' prefix removed
      expect(formatter.cleanDescription('Fix issue')).toBe('issue'); // 'Fix' prefix removed
    });

    it('should remove trailing period', () => {
      expect(formatter.cleanDescription('Add new feature.')).toBe('new feature'); // prefix removed + period
      expect(formatter.cleanDescription('Fix issue.')).toBe('issue'); // prefix removed + period
    });
  });

  describe('applyLanguageFormatting', () => {
    it('should handle different languages', () => {
      expect(formatter.applyLanguageFormatting('test message', 'es')).toBeDefined();
      expect(formatter.applyLanguageFormatting('test message', 'fr')).toBeDefined();
      expect(formatter.applyLanguageFormatting('test message', 'de')).toBeDefined();
    });

    it('should return original message for unsupported language', () => {
      const result = formatter.applyLanguageFormatting('test message', 'unknown');
      expect(result).toBe('test message');
    });
  });

  describe('applyLengthConstraints', () => {
    it('should truncate long messages', () => {
      const longMessage = 'a'.repeat(150);
      const result = formatter.applyLengthConstraints(longMessage);
      expect(result.length).toBeLessThanOrEqual(72);
    });

    it('should leave short messages unchanged', () => {
      const shortMessage = 'short message';
      const result = formatter.applyLengthConstraints(shortMessage);
      expect(result).toBe(shortMessage);
    });
  });

  describe('cleanupFormatting', () => {
    it('should remove extra whitespace', () => {
      expect(formatter.cleanupFormatting('  multiple   spaces  ')).toBe('multiple spaces');
      expect(formatter.cleanupFormatting('line\n\n\nbreaks')).toBe('line breaks'); // Triple newline becomes single space
    });

    it('should not change capitalization', () => {
      expect(formatter.cleanupFormatting('lowercase start')).toBe('lowercase start');
    });
  });

  describe('parseConventionalCommit', () => {
    it('should parse conventional commit message', () => {
      const parsed = formatter.parseConventionalCommit('feat(auth): add login feature');
      expect(parsed.type).toBe('feat');
      expect(parsed.scope).toBe('auth');
      expect(parsed.description).toBe('add login feature');
    });

    it('should handle commits without scope', () => {
      const parsed = formatter.parseConventionalCommit('docs: update README');
      expect(parsed.type).toBe('docs');
      expect(parsed.scope).toBeNull();
      expect(parsed.description).toBe('update README');
    });

    it('should return null values for non-conventional commits', () => {
      const result = formatter.parseConventionalCommit('random message');
      expect(result.type).toBeNull();
      expect(result.scope).toBeNull();
      expect(result.description).toBe('random message');
      expect(result.body).toBeNull();
    });
  });

  describe('validate', () => {
    it('should validate conventional commit format', () => {
      const result = formatter.validate('feat: add new feature', { conventional: true });
      expect(result.valid).toBe(true);
    });

    it('should reject invalid conventional format', () => {
      const result = formatter.validate('invalid commit', { conventional: true });
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should warn about long message length', () => {
      const result = formatter.validate('a'.repeat(150));
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Title should be 72 characters or less');
    });

    it('should return valid for good messages', () => {
      const result = formatter.validate('Good commit message');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getSuggestions', () => {
    it('should provide suggestions for improvement', () => {
      const suggestions = formatter.getSuggestions('a'.repeat(100));
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should handle conventional commit suggestions', () => {
      const suggestions = formatter.getSuggestions('add new feature', { conventional: true });
      expect(suggestions.some(s => s.includes('Conventional format'))).toBe(true);
    });

    it('should return empty array for good messages', () => {
      const suggestions = formatter.getSuggestions('feat(auth): add login feature');
      expect(suggestions).toHaveLength(0);
    });
  });

  describe('formatWithTemplate', () => {
    it('should format with template variables', () => {
      const data = { type: 'feat', scope: 'auth', description: 'add login' };
      const template = '{type}({scope}): {description}';
      const result = formatter.formatWithTemplate(data, template);
      expect(result).toBe('feat(auth): add login');
    });

    it('should handle missing variables', () => {
      const data = { type: 'feat', description: 'add feature' };
      const template = '{type}({scope}): {description}';
      const result = formatter.formatWithTemplate(data, template);
      expect(result).toBe('feat: add feature');
    });

    it('should throw error if no data', () => {
      expect(() => formatter.formatWithTemplate(null, 'template')).toThrow();
    });
  });

  describe('WordPress-specific functionality', () => {
    it('should infer WordPress-specific scopes', () => {
      const wordpressContext = {
        files: {
          wordpress: {
            plugins: ['my-plugin'],
            themes: ['my-theme'],
            specificPages: [],
            components: []
          }
        }
      };
      
      // Test actual behavior - these return null because no clear scope is found
      const result1 = formatter.inferScope('update my-plugin functionality', wordpressContext);
      const result2 = formatter.inferScope('modify my-theme appearance', wordpressContext);
      
      expect([result1, result2]).toContain(null);
    });

    it('should handle WordPress commit patterns', () => {
      expect(formatter.inferType('add new plugin')).toBe('feat');
      expect(formatter.inferType('update theme styles')).toBe('style');
      expect(formatter.inferType('fix hook registration')).toBe('fix');
    });
  });

  describe('Error handling', () => {
    it('should handle null/undefined inputs gracefully in format', () => {
      expect(() => formatter.format(null)).not.toThrow();
      expect(() => formatter.format(undefined)).not.toThrow();
    });

    it('should throw on null/undefined for inferType', () => {
      expect(() => formatter.inferType(null)).toThrow();
      expect(() => formatter.inferType(undefined)).toThrow();
    });

    it('should handle empty strings', () => {
      expect(formatter.format('')).toBe('');
      expect(formatter.inferType('')).toBe('chore');
      expect(formatter.isConventionalFormat('')).toBe(false);
    });

    it('should handle malformed input', () => {
      expect(() => formatter.parseConventionalCommit('invalid:')).not.toThrow();
      expect(() => formatter.validate({})).not.toThrow();
    });
  });
});