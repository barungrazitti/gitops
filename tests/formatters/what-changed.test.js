/**
 * Tests for WhatChangedFormatter
 */

const WhatChangedFormatter = require('../../src/formatters/sections/what-changed');

describe('WhatChangedFormatter', () => {
  let formatter;

  beforeEach(() => {
    formatter = new WhatChangedFormatter();
  });

  describe('format()', () => {
    it('should return generic what-changed when no context provided', () => {
      const result = formatter.format(null, 'Add feature');
      expect(result).toContain('Changes:');
    });

    it('should format component changes', () => {
      const context = {
        components: {
          packages: ['@myapp/auth', '@myapp/api'],
          custom: ['UserService'],
          boundaries: ['auth-module']
        }
      };

      const result = formatter.format(context, 'Add authentication');
      
      expect(result).toContain('Affected packages: @myapp/auth, @myapp/api');
      expect(result).toContain('Affected components: UserService');
      expect(result).toContain('Module boundaries: auth-module');
    });

    it('should format file changes grouped by directory', () => {
      const context = {
        files: {
          changed: [
            { path: 'src/auth/login.js' },
            { path: 'src/auth/logout.js' },
            { path: 'src/utils/helper.js' }
          ]
        }
      };

      const result = formatter.format(context, 'Update auth');
      
      expect(result).toContain('src/auth:');
      expect(result).toContain('src/utils:');
    });

    it('should format WordPress-specific changes', () => {
      const context = {
        files: {
          wordpress: {
            isWordPress: true,
            type: 'plugin',
            plugins: ['woocommerce'],
            themes: [],
            specificPages: ['single-product'],
            components: ['widgets']
          }
        }
      };

      const result = formatter.format(context, 'Update WooCommerce');
      
      expect(result).toContain('WordPress plugin changes');
      expect(result).toContain('Plugins affected: woocommerce');
      expect(result).toContain('Pages/templates: single-product');
    });

    it('should handle root level files', () => {
      const context = {
        files: {
          changed: [
            { path: 'package.json' },
            { path: 'README.md' }
          ]
        }
      };

      const result = formatter.format(context, 'Update docs');
      
      expect(result).toContain('Root files:');
    });

    it('should truncate long file names', () => {
      const context = {
        files: {
          changed: [
            { path: 'src/components/very-long-component-name-that-exceeds-limit.js' }
          ]
        }
      };

      const result = formatter.format(context, 'Update component');
      
      expect(result.length).toBeLessThan(200);
    });

    it('should infer change type from message', () => {
      const context = { files: {} };

      expect(formatter.format(context, 'Added new feature')).toContain('added');
      expect(formatter.format(context, 'Removed unused code')).toContain('removed');
      expect(formatter.format(context, 'Modified config')).toContain('modified');
    });
  });

  describe('_groupFilesByDirectory()', () => {
    it('should group files by their directory', () => {
      const files = [
        { path: 'src/auth/login.js' },
        { path: 'src/auth/logout.js' },
        { path: 'src/utils/helper.js' },
        { path: 'package.json' }
      ];

      const grouped = formatter._groupFilesByDirectory(files);

      expect(grouped['src/auth'].length).toBe(2);
      expect(grouped['src/utils'].length).toBe(1);
      expect(grouped['.'].length).toBe(1);
    });
  });

  describe('_truncateFileName()', () => {
    it('should not truncate short names', () => {
      const result = formatter._truncateFileName('short.js', 40);
      expect(result).toBe('short.js');
    });

    it('should truncate long names', () => {
      const result = formatter._truncateFileName('very-long-file-name-that-exceeds-limit.js', 20);
      expect(result).toContain('...');
      expect(result.length).toBeLessThanOrEqual(23);
    });
  });

  describe('_inferChangeType()', () => {
    it('should infer added changes', () => {
      expect(formatter._inferChangeType('Added new feature')).toBe('added');
    });

    it('should infer removed changes', () => {
      expect(formatter._inferChangeType('Deleted old code')).toBe('removed');
    });

    it('should infer modified changes', () => {
      expect(formatter._inferChangeType('Updated config')).toBe('modified');
    });

    it('should default to modified', () => {
      expect(formatter._inferChangeType('Some change')).toBe('modified');
    });
  });
});
