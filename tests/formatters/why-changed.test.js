/**
 * Tests for WhyChangedFormatter
 */

const WhyChangedFormatter = require('../../src/formatters/sections/why-changed');

describe('WhyChangedFormatter', () => {
  let formatter;

  beforeEach(() => {
    formatter = new WhyChangedFormatter();
  });

  describe('format()', () => {
    it('should return empty string when no message provided', () => {
      const result = formatter.format({}, '');
      expect(result).toBe('');
    });

    it('should detect bug fix motivation', () => {
      const context = {};
      const result = formatter.format(context, 'Fix login crash on invalid credentials');
      
      expect(result).toContain('Why:');
      expect(result.toLowerCase()).toMatch(/fix|bug|issue|error/);
    });

    it('should detect feature motivation', () => {
      const context = {};
      const result = formatter.format(context, 'Add new user dashboard');
      
      expect(result).toContain('Why:');
      expect(result.toLowerCase()).toMatch(/add|new|feature|functionality/);
    });

    it('should detect refactor motivation', () => {
      const context = {};
      const result = formatter.format(context, 'Refactor authentication module');
      
      expect(result).toMatch(/Why:|Why \(inferred\):/);
      expect(result.toLowerCase()).toMatch(/refactor|improve|optimize/);
    });

    it('should detect docs motivation', () => {
      const context = {};
      const result = formatter.format(context, 'Add documentation for API endpoints');
      
      expect(result).toContain('Why:');
      expect(result.toLowerCase()).toMatch(/doc|guide|document/);
    });

    it('should detect performance motivation', () => {
      const context = {};
      const result = formatter.format(context, 'Optimize database queries for faster loading');
      
      expect(result).toContain('Why:');
      expect(result.toLowerCase()).toMatch(/performance|optimize|speed/);
    });

    it('should use convention context to boost detection', () => {
      const context = {
        conventions: {
          commitType: 'fix'
        }
      };
      const result = formatter.format(context, 'Resolve issue with session');
      
      expect(result).toContain('Why:');
    });

    it('should use file type context to boost detection', () => {
      const context = {
        files: {
          types: {
            'test.js': 5
          }
        }
      };
      const result = formatter.format(context, 'Add tests for auth');
      
      expect(result).toContain('Why:');
    });

    it('should handle low confidence with indicator', () => {
      const context = {};
      const result = formatter.format(context, 'Update some stuff');
      
      // Low confidence should show indicator
      expect(result).toMatch(/(Why:|Why \(inferred\):)/);
    });

    it('should format generic why for fix messages', () => {
      const context = {};
      const result = formatter.format(context, 'Fix the bug');
      
      expect(result).toContain('Why:');
      expect(result).toMatch(/fix|issue|bug/i);
    });

    it('should format generic why for add messages', () => {
      const context = {};
      const result = formatter.format(context, 'Add new feature');
      
      expect(result).toContain('Why:');
      expect(result).toMatch(/new|functionality/i);
    });

    it('should format generic why for update messages', () => {
      const context = {};
      const result = formatter.format(context, 'Update dependencies');
      
      expect(result).toMatch(/Why:|Why \(inferred\):/);
      expect(result).toMatch(/update|modify|dependencies/i);
    });
  });

  describe('_detectMotivation()', () => {
    it('should return unknown for empty message', () => {
      const result = formatter._detectMotivation('', {});
      expect(result.type).toBe('unknown');
    });

    it('should score bugfix patterns', () => {
      const result = formatter._detectMotivation('Fix crash', {});
      expect(result.type).toBe('bugfix');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should score feature patterns', () => {
      const result = formatter._detectMotivation('Add new capability', {});
      expect(result.type).toBe('feature');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should return alternatives', () => {
      const result = formatter._detectMotivation('Fix and add feature', {});
      expect(result.alternatives).toBeDefined();
      expect(Array.isArray(result.alternatives)).toBe(true);
    });
  });

  describe('_matchesConventionType()', () => {
    it('should match bugfix to fix convention', () => {
      expect(formatter._matchesConventionType('bugfix', 'fix')).toBe(true);
    });

    it('should match feature to feat convention', () => {
      expect(formatter._matchesConventionType('feature', 'feat')).toBe(true);
    });

    it('should not match unrelated types', () => {
      expect(formatter._matchesConventionType('bugfix', 'feat')).toBe(false);
    });
  });

  describe('_matchesFileTypes()', () => {
    it('should match docs motivation to md files', () => {
      const fileTypes = { 'readme.md': 1 };
      expect(formatter._matchesFileTypes('docs', fileTypes)).toBe(true);
    });

    it('should match test motivation to test files', () => {
      const fileTypes = { 'auth.test.js': 1 };
      expect(formatter._matchesFileTypes('test', fileTypes)).toBe(true);
    });

    it('should return false for no match', () => {
      const fileTypes = { 'index.js': 1 };
      expect(formatter._matchesFileTypes('docs', fileTypes)).toBe(false);
    });
  });

  describe('extraction helpers', () => {
    it('should extract component from context', () => {
      const context = {
        components: {
          packages: ['@myapp/auth']
        }
      };
      expect(formatter._extractComponent(context)).toBe('@myapp/auth');
    });

    it('should return default when extraction fails', () => {
      expect(formatter._extractComponent({})).toBe('the component');
      expect(formatter._extractFeature({})).toBe('new functionality');
      expect(formatter._extractBenefit({})).toBe('better maintainability');
    });
  });
});
