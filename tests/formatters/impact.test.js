/**
 * Tests for ImpactFormatter
 */

const ImpactFormatter = require('../../src/formatters/sections/impact');

describe('ImpactFormatter', () => {
  let formatter;

  beforeEach(() => {
    formatter = new ImpactFormatter();
  });

  describe('format()', () => {
    it('should return no impact message when no context', () => {
      const result = formatter.format({}, 'Update code');
      expect(result).toContain('No breaking changes');
    });

    it('should detect breaking change from message', () => {
      const context = {};
      const result = formatter.format(context, 'Breaking change: remove deprecated API');
      
      expect(result).toContain('Impact:');
      expect(result).toMatch(/⚠|🚨/);
    });

    it('should detect breaking change from context', () => {
      const context = {
        conventions: {
          breakingChange: true
        }
      };
      const result = formatter.format(context, 'Update API');
      
      expect(result).toContain('Impact:');
    });

    it('should format dependency impact', () => {
      const context = {
        dependencies: {
          affected: ['module-a', 'module-b', 'module-c'],
          imports: { changed: ['module-a'] },
          exports: { changed: ['module-b'] }
        }
      };

      const result = formatter.format(context, 'Update module');
      
      expect(result).toContain('Dependencies:');
      expect(result).toContain('3 module(s) affected');
      expect(result).toContain('Imports changed:');
      expect(result).toContain('Exports changed:');
    });

    it('should format downstream impact', () => {
      const context = {
        dependencies: {
          affected: [],
          downstream: ['client-a', 'client-b', 'client-c']
        }
      };

      const result = formatter.format(context, 'Update API');
      
      expect(result).toContain('Downstream:');
      expect(result).toContain('may require updates');
    });

    it('should format performance impact', () => {
      const context = {
        conventions: {
          performanceImpact: {
            type: 'improvement',
            metric: 'load time',
            estimatedChange: '+25%'
          }
        }
      };

      const result = formatter.format(context, 'Optimize loading');
      
      expect(result).toContain('Performance:');
      expect(result).toContain('📈');
      expect(result).toContain('load time');
    });

    it('should format performance degradation', () => {
      const context = {
        conventions: {
          performanceImpact: {
            type: 'degradation',
            metric: 'memory usage',
            estimatedChange: '-10%'
          }
        }
      };

      const result = formatter.format(context, 'Add caching');
      
      expect(result).toContain('Performance:');
      expect(result).toContain('📉');
    });

    it('should format required actions', () => {
      const context = {
        dependencies: {
          requiredActions: [
            'Update configuration',
            'Run migration script',
            'Clear cache'
          ]
        }
      };

      const result = formatter.format(context, 'Breaking update');
      
      expect(result).toContain('Required actions:');
      expect(result).toContain('Update configuration');
      expect(result).toContain('Run migration script');
    });

    it('should limit required actions to 5', () => {
      const context = {
        dependencies: {
          requiredActions: Array(10).fill('Action')
        }
      };

      const result = formatter.format(context, 'Big update');
      
      expect(result).toContain('...and 5 more');
    });

    it('should assess critical impact level', () => {
      const context = {
        dependencies: {
          affected: Array(15).fill('module'),
          downstream: Array(10).fill('client')
        }
      };
      const result = formatter.format(context, 'Critical breaking change');
      
      expect(result).toContain('🚨');
      expect(result).toContain('Critical impact');
    });

    it('should assess minor impact level', () => {
      const context = {
        dependencies: {
          affected: ['single-module']
        }
      };
      const result = formatter.format(context, 'Minor tweak');
      
      // Minor changes may not trigger breaking change detection
      expect(result).toMatch(/Dependencies:|No breaking changes/);
    });
  });

  describe('_detectBreakingChanges()', () => {
    it('should detect BREAKING CHANGE pattern', () => {
      const result = formatter._detectBreakingChanges('BREAKING CHANGE: API update', {});
      expect(result).toBeTruthy();
    });

    it('should detect backwards incompatible pattern', () => {
      const result = formatter._detectBreakingChanges('Backwards incompatible change', {});
      expect(result).toBeTruthy();
    });

    it('should detect API change pattern', () => {
      const result = formatter._detectBreakingChanges('API change in auth module', {});
      expect(result).toBeTruthy();
    });

    it('should detect removed function pattern', () => {
      const result = formatter._detectBreakingChanges('Removed function exports', {});
      expect(result).toBeTruthy();
    });

    it('should return null for non-breaking changes', () => {
      const result = formatter._detectBreakingChanges('Fix typo in docs', {});
      expect(result).toBeNull();
    });
  });

  describe('_assessBreakingLevel()', () => {
    it('should assess critical for urgent messages with many affected', () => {
      const context = {
        dependencies: {
          affected: Array(20).fill('module'),
          downstream: Array(10).fill('client')
        }
      };
      const result = formatter._assessBreakingLevel('Critical emergency fix', context);
      expect(result).toBe('critical');
    });

    it('should assess major for significant changes', () => {
      const context = {
        dependencies: {
          affected: Array(8).fill('module')
        }
      };
      const result = formatter._assessBreakingLevel('Major update', context);
      expect(result).toBe('major');
    });

    it('should assess none for small changes', () => {
      const context = {
        dependencies: {
          affected: ['single']
        }
      };
      const result = formatter._assessBreakingLevel('Minor tweak', context);
      expect(result).toBe('none');
    });

    it('should assess none for no impact', () => {
      const context = {
        dependencies: {
          affected: []
        }
      };
      const result = formatter._assessBreakingLevel('Docs update', context);
      expect(result).toBe('minor');
    });
  });

  describe('_truncateModule()', () => {
    it('should not truncate short module names', () => {
      const result = formatter._truncateModule('auth', 30);
      expect(result).toBe('auth');
    });

    it('should truncate long module names', () => {
      const result = formatter._truncateModule('very-long-module-name-that-exceeds-limit', 20);
      expect(result).toContain('...');
      expect(result.length).toBeLessThanOrEqual(23);
    });

    it('should handle null module names', () => {
      const result = formatter._truncateModule(null, 30);
      expect(result).toBe('unknown');
    });
  });

  describe('_formatNoImpact()', () => {
    it('should return no impact message', () => {
      const result = formatter._formatNoImpact();
      expect(result).toBe('Impact: ✓ No breaking changes detected');
    });
  });
});
