/**
 * Tests for refactored MessageFormatter
 */

const MessageFormatter = require('../../src/core/message-formatter');

describe('MessageFormatter (refactored)', () => {
  let formatter;

  beforeEach(() => {
    formatter = new MessageFormatter();
  });

  describe('format()', () => {
    it('should return null/undefined as-is', () => {
      expect(formatter.format(null)).toBeNull();
      expect(formatter.format(undefined)).toBeUndefined();
    });

    it('should format message with conventional option', () => {
      const result = formatter.format('Add new feature', { conventional: true });
      expect(result).toMatch(/^feat(\(.+\))?:/);
    });

    it('should apply length constraints', () => {
      const longMessage = 'a'.repeat(100) + ' add feature';
      const result = formatter.format(longMessage, { conventional: true });
      expect(result.length).toBeLessThan(longMessage.length);
    });

    it('should clean up formatting', () => {
      const messyMessage = 'Add   feature\n\n\n\nwith body';
      const result = formatter.format(messyMessage);
      expect(result).not.toContain('   ');
      expect(result).not.toContain('\n\n\n');
    });
  });

  describe('applyConventionalFormat()', () => {
    it('should return already conventional format as-is', () => {
      const message = 'feat(auth): add login';
      const result = formatter.applyConventionalFormat(message, {});
      expect(result).toBe(message);
    });

    it('should apply conventional format', () => {
      const message = 'Add login feature';
      const result = formatter.applyConventionalFormat(message, {});
      expect(result).toMatch(/^feat(\(.+\))?:/);
    });

    it('should use provided type', () => {
      const message = 'Update something';
      const result = formatter.applyConventionalFormat(message, { type: 'chore' });
      expect(result).toMatch(/^chore(\(.+\))?:/);
    });

    it('should use provided scope', () => {
      const message = 'Add feature';
      const result = formatter.applyConventionalFormat(message, { scope: 'api' });
      expect(result).toMatch(/^\w+\(api\):/);
    });
  });

  describe('isConventionalFormat()', () => {
    it('should recognize conventional format', () => {
      expect(formatter.isConventionalFormat('feat: add feature')).toBe(true);
      expect(formatter.isConventionalFormat('fix(auth): resolve issue')).toBe(true);
    });

    it('should reject non-conventional format', () => {
      expect(formatter.isConventionalFormat('Add feature')).toBe(false);
      expect(formatter.isConventionalFormat('Fixed bug')).toBe(false);
    });
  });

  describe('inferType()', () => {
    it('should infer feat type', () => {
      expect(formatter.inferType('Add new capability')).toBe('feat');
    });

    it('should infer fix type', () => {
      expect(formatter.inferType('Fix crash')).toBe('fix');
    });

    it('should infer docs type', () => {
      expect(formatter.inferType('Update documentation')).toBe('docs');
    });

    it('should infer refactor type', () => {
      expect(formatter.inferType('Refactor module')).toBe('refactor');
    });

    it('should infer perf type', () => {
      expect(formatter.inferType('Performance optimization')).toBe('perf');
    });

    it('should infer test type', () => {
      expect(formatter.inferType('Unit tests for auth')).toBe('test');
    });

    it('should infer chore type', () => {
      expect(formatter.inferType('Update dependencies')).toBe('chore');
    });

    it('should default to chore', () => {
      expect(formatter.inferType('Random change')).toBe('chore');
    });
  });

  describe('inferScope()', () => {
    it('should infer from components scope', () => {
      const context = { components: { scope: 'auth' } };
      expect(formatter.inferScope('Update', context)).toBe('auth');
    });

    it('should infer from files scope', () => {
      const context = { files: { scope: 'api' } };
      expect(formatter.inferScope('Update', context)).toBe('api');
    });

    it('should infer from WordPress plugin', () => {
      const context = {
        files: {
          wordpress: {
            isWordPress: true,
            plugins: ['woocommerce'],
          },
        },
      };
      expect(formatter.inferScope('Update', context)).toBe('woocommerce');
    });

    it('should return null when no scope', () => {
      expect(formatter.inferScope('Update', {})).toBeNull();
    });
  });

  describe('cleanDescription()', () => {
    it('should remove common prefixes', () => {
      expect(formatter.cleanDescription('Add new feature')).toBe('new feature');
      expect(formatter.cleanDescription('Fix the bug')).toBe('the bug');
    });

    it('should lowercase first letter after prefix removal', () => {
      const result = formatter.cleanDescription('Add Feature');
      expect(result).toBe('feature');
    });

    it('should remove trailing period', () => {
      const result = formatter.cleanDescription('Feature.');
      expect(result).toBe('feature');
    });
  });

  describe('applyLengthConstraints()', () => {
    it('should not modify short messages', () => {
      const message = 'feat: add feature';
      expect(formatter.applyLengthConstraints(message)).toBe(message);
    });

    it('should truncate long titles', () => {
      const longTitle = 'a'.repeat(80) + ' add feature';
      const result = formatter.applyLengthConstraints(longTitle);
      expect(result.length).toBeLessThan(longTitle.length);
    });

    it('should preserve body', () => {
      const message = 'Short title\n\nThis is a longer body with details.';
      const result = formatter.applyLengthConstraints(message);
      expect(result).toContain('This is a longer body with details.');
    });
  });

  describe('cleanupFormatting()', () => {
    it('should normalize whitespace', () => {
      const result = formatter.cleanupFormatting('Multiple   spaces');
      expect(result).toBe('Multiple spaces');
    });

    it('should trim message', () => {
      const result = formatter.cleanupFormatting('  trimmed  ');
      expect(result).toBe('trimmed');
    });
  });
});
