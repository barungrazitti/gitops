/**
 * Tests for FormatterFactory
 */

const FormatterFactory = require('../../src/formatters/formatter-factory');
const ConventionalFormatter = require('../../src/formatters/formatter-factory');

describe('FormatterFactory', () => {
  let factory;

  beforeEach(() => {
    factory = new FormatterFactory();
  });

  describe('getFormatter()', () => {
    it('should return conventional formatter', () => {
      const formatter = factory.getFormatter('conventional');
      expect(formatter).toBeDefined();
      expect(formatter.format).toBeDefined();
    });

    it('should return freeform formatter', () => {
      const formatter = factory.getFormatter('freeform');
      expect(formatter).toBeDefined();
      expect(formatter.format).toBeDefined();
    });

    it('should return default formatter for unknown type', () => {
      const formatter = factory.getFormatter('unknown');
      expect(formatter).toBeDefined();
    });
  });

  describe('createCompositeFormatter()', () => {
    it('should create composite formatter with default sections', () => {
      const composite = factory.createCompositeFormatter();
      expect(composite).toBeDefined();
      expect(composite.format).toBeDefined();
    });

    it('should create composite formatter with custom sections', () => {
      const composite = factory.createCompositeFormatter({
        includeSections: ['what', 'why']
      });
      expect(composite).toBeDefined();
      expect(composite.includeSections).toEqual(['what', 'why']);
    });
  });

  describe('format()', () => {
    it('should format with conventional strategy', () => {
      const result = factory.format('add new feature', {}, { conventional: true });
      expect(result).toMatch(/^feat(\(.+\))?:/);
    });

    it('should format with freeform strategy', () => {
      const result = factory.format('add new feature', {}, { conventional: false });
      expect(result).toBe('add new feature');
    });

    it('should use freeform as default when conventional not specified', () => {
      const result = factory.format('add new feature', {}, {});
      expect(result).toBe('add new feature');
    });
  });
});

describe('ConventionalFormatter', () => {
  let formatter;

  beforeEach(() => {
    const factory = new FormatterFactory();
    formatter = factory.getFormatter('conventional');
  });

  describe('format()', () => {
    it('should format message in conventional style', () => {
      const result = formatter.format('Add new authentication feature', {});
      expect(result).toMatch(/^feat(\(.+\))?:/i);
    });

    it('should return existing conventional format as-is', () => {
      const message = 'feat(auth): add login functionality';
      const result = formatter.format(message, {});
      expect(result).toBe(message);
    });

    it('should use provided type option', () => {
      const result = formatter.format('Update something', {}, { type: 'chore' });
      expect(result).toMatch(/^chore(\(.+\))?:/);
    });

    it('should use provided scope option', () => {
      const result = formatter.format('Add feature', {}, { scope: 'auth' });
      expect(result).toMatch(/^\w+\(auth\):/);
    });

    it('should infer type from context', () => {
      const context = {
        conventions: {
          commitType: 'fix'
        }
      };
      const result = formatter.format('Resolve issue', context);
      expect(result).toMatch(/^fix(\(.+\))?:/);
    });

    it('should infer scope from components context', () => {
      const context = {
        components: {
          scope: 'auth-module'
        }
      };
      const result = formatter.format('Update auth', context);
      expect(result).toMatch(/^\w+\(auth-module\):/);
    });

    it('should infer scope from WordPress context', () => {
      const context = {
        files: {
          wordpress: {
            isWordPress: true,
            plugins: ['woocommerce']
          }
        }
      };
      const result = formatter.format('Update plugin', context);
      expect(result).toMatch(/^\w+\(woocommerce\):/);
    });
  });

  describe('isConventional()', () => {
    it('should recognize conventional format', () => {
      expect(formatter.isConventional('feat: add feature')).toBe(true);
      expect(formatter.isConventional('fix(auth): resolve login issue')).toBe(true);
    });

    it('should reject non-conventional format', () => {
      expect(formatter.isConventional('Add feature')).toBe(false);
      expect(formatter.isConventional('Fixed the bug')).toBe(false);
    });
  });

  describe('inferType()', () => {
    it('should infer feat type', () => {
      expect(formatter.inferType('Add new capability', {})).toBe('feat');
      expect(formatter.inferType('Implement feature', {})).toBe('feat');
    });

    it('should infer fix type', () => {
      expect(formatter.inferType('Fix crash bug', {})).toBe('fix');
      expect(formatter.inferType('Resolve issue', {})).toBe('fix');
    });

    it('should infer docs type', () => {
      expect(formatter.inferType('Documentation update', {})).toBe('docs');
      expect(formatter.inferType('Readme changes', {})).toBe('docs');
    });

    it('should infer refactor type', () => {
      expect(formatter.inferType('Refactor module', {})).toBe('refactor');
      expect(formatter.inferType('Clean up code', {})).toBe('refactor');
    });

    it('should infer perf type', () => {
      expect(formatter.inferType('Performance optimization', {})).toBe('perf');
      expect(formatter.inferType('Speed boost', {})).toBe('perf');
    });

    it('should infer test type', () => {
      expect(formatter.inferType('Test coverage for auth', {})).toBe('test');
      expect(formatter.inferType('Spec file updates', {})).toBe('test');
    });

    it('should infer chore type', () => {
      expect(formatter.inferType('Update dependencies', {})).toBe('chore');
      expect(formatter.inferType('Bump version', {})).toBe('chore');
    });

    it('should default to chore', () => {
      expect(formatter.inferType('Some change', {})).toBe('chore');
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
            plugins: ['woocommerce']
          }
        }
      };
      expect(formatter.inferScope('Update', context)).toBe('woocommerce');
    });

    it('should return null when no scope available', () => {
      expect(formatter.inferScope('Update', {})).toBeNull();
    });
  });

  describe('cleanDescription()', () => {
    it('should remove conventional prefix', () => {
      const result = formatter.cleanDescription('feat(auth): add feature');
      expect(result).toBe('feature');
    });

    it('should remove common prefixes', () => {
      expect(formatter.cleanDescription('Add new feature')).toBe('new feature');
      expect(formatter.cleanDescription('Fix the bug')).toBe('the bug');
      expect(formatter.cleanDescription('Update config')).toBe('config');
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
});

describe('FreeformFormatter', () => {
  let formatter;

  beforeEach(() => {
    const factory = new FormatterFactory();
    formatter = factory.getFormatter('freeform');
  });

  describe('format()', () => {
    it('should return message as-is', () => {
      const message = 'Add new feature for users';
      const result = formatter.format(message, {});
      expect(result).toBe(message);
    });

    it('should clean up whitespace', () => {
      const result = formatter.format('Add   new    feature', {});
      expect(result).toBe('Add new feature');
    });

    it('should handle empty message', () => {
      const result = formatter.format('', {});
      expect(result).toBe('');
    });
  });

  describe('cleanupMessage()', () => {
    it('should normalize whitespace', () => {
      const result = formatter.cleanupMessage('Multiple   spaces   here');
      expect(result).toBe('Multiple spaces here');
    });

    it('should trim message', () => {
      const result = formatter.cleanupMessage('  trimmed  ');
      expect(result).toBe('trimmed');
    });
  });
});

describe('CompositeFormatter', () => {
  let composite;

  beforeEach(() => {
    const factory = new FormatterFactory();
    composite = factory.createCompositeFormatter({
      conventional: true,
      includeSections: ['what', 'why', 'impact']
    });
  });

  describe('format()', () => {
    it('should format with all sections', () => {
      const context = {
        components: { packages: ['auth'] },
        dependencies: { affected: [] }
      };
      const message = 'Add authentication feature';

      const result = composite.format(message, context);

      expect(result).toMatch(/feat:/);
      expect(result).toContain('Why:');
      expect(result).toContain('Impact:');
    });

    it('should handle missing sections gracefully', () => {
      const context = {};
      const message = 'Simple update';

      const result = composite.format(message, context);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should respect includeSections option', () => {
      const factory = new FormatterFactory();
      const custom = factory.createCompositeFormatter({
        includeSections: ['what']
      });

      const context = {
        components: { packages: ['auth'] },
        dependencies: { affected: [] }
      };

      const result = custom.format('Update', context);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});
