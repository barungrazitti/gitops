/**
 * Unit tests for Message Formatter - covering uncovered lines
 */

const MessageFormatter = require('../src/core/message-formatter');

describe('MessageFormatter - Additional Coverage', () => {
  let formatter;

  beforeEach(() => {
    formatter = new MessageFormatter();
  });

  describe('inferWordPressScope', () => {
    it('should infer scope from specific pages', () => {
      const wordpressContext = {
        type: 'theme',
        specificPages: ['single.php', 'page.php'],
        plugins: [],
        themes: [],
        components: []
      };
      const message = 'Update single post template';

      const scope = formatter.inferWordPressScope(message, wordpressContext);

      expect(scope).toBe('single.php');
    });

    it('should return first specific page when no match found', () => {
      const wordpressContext = {
        type: 'theme',
        specificPages: ['archive.php'],
        plugins: [],
        themes: [],
        components: []
      };
      const message = 'Update general template';

      const scope = formatter.inferWordPressScope(message, wordpressContext);

      expect(scope).toBe('archive.php');
    });

    it('should infer scope from plugin names', () => {
      const wordpressContext = {
        type: 'plugin',
        specificPages: [],
        plugins: ['jetpack', 'woocommerce'],
        themes: [],
        components: []
      };
      const message = 'Add jetpack support';

      const scope = formatter.inferWordPressScope(message, wordpressContext);

      expect(scope).toBe('jetpack');
    });

    it('should return first plugin when single plugin exists', () => {
      const wordpressContext = {
        type: 'plugin',
        specificPages: [],
        plugins: ['contact-form-7'],
        themes: [],
        components: []
      };
      const message = 'Update plugin settings';

      const scope = formatter.inferWordPressScope(message, wordpressContext);

      expect(scope).toBe('contact-form-7');
    });

    it('should infer scope from theme names', () => {
      const wordpressContext = {
        type: 'theme',
        specificPages: [],
        plugins: [],
        themes: ['twenty-twenty-three', 'custom-theme'],
        components: []
      };
      const message = 'Update twenty twenty three styling';

      const scope = formatter.inferWordPressScope(message, wordpressContext);

      expect(scope).toBe('twenty-twenty-three');
    });

    it('should infer scope from WordPress components', () => {
      const wordpressContext = {
        type: 'theme',
        specificPages: [],
        plugins: [],
        themes: [],
        components: ['theme-functions', 'customizer']
      };
      const message = 'Update customizer functionality';

      const scope = formatter.inferWordPressScope(message, wordpressContext);

      expect(scope).toBe('customizer');
    });

    it('should map WordPress components to scopes', () => {
      const wordpressContext = {
        type: 'theme',
        specificPages: [],
        plugins: [],
        themes: [],
        components: ['theme-functions']
      };
      const message = 'Update functions';

      const scope = formatter.inferWordPressScope(message, wordpressContext);

      expect(scope).toBe('functions');
    });

    it('should return single component when only one exists', () => {
      const wordpressContext = {
        type: 'theme',
        specificPages: [],
        plugins: [],
        themes: [],
        components: ['sidebar']
      };
      const message = 'Update layout';

      const scope = formatter.inferWordPressScope(message, wordpressContext);

      expect(scope).toBe('sidebar');
    });

    it('should infer scope from WordPress type', () => {
      const wordpressContext = {
        type: 'plugin',
        specificPages: [],
        plugins: [],
        themes: [],
        components: []
      };
      const message = 'Update core functionality';

      const scope = formatter.inferWordPressScope(message, wordpressContext);

      expect(scope).toBe('plugin');
    });

    it('should return null when no WordPress context', () => {
      const wordpressContext = {
        type: null,
        specificPages: [],
        plugins: [],
        themes: [],
        components: []
      };
      const message = 'Update general code';

      const scope = formatter.inferWordPressScope(message, wordpressContext);

      expect(scope).toBeNull();
    });
  });

  describe('inferScopeFromMessage', () => {
    it('should infer API scope', () => {
      const message = 'Update API endpoint for user data';
      const scope = formatter.inferScopeFromMessage(message);
      expect(scope).toBe('api');
    });

    it('should infer UI scope', () => {
      const message = 'Fix component rendering issue in the interface';
      const scope = formatter.inferScopeFromMessage(message);
      expect(scope).toBe('ui');
    });

    it('should infer auth scope', () => {
      const message = 'Implement JWT token validation';
      const scope = formatter.inferScopeFromMessage(message);
      expect(scope).toBe('auth');
    });

    it('should infer database scope', () => {
      const message = 'Add migration for user model';
      const scope = formatter.inferScopeFromMessage(message);
      expect(scope).toBe('db');
    });

    it('should infer config scope', () => {
      const message = 'Update environment variables';
      const scope = formatter.inferScopeFromMessage(message);
      expect(scope).toBe('config');
    });

    it('should infer test scope', () => {
      const message = 'Add unit tests for authentication';
      const scope = formatter.inferScopeFromMessage(message);
      expect(scope).toBe('test');
    });

    it('should infer utils scope', () => {
      const message = 'Add helper function for data formatting';
      const scope = formatter.inferScopeFromMessage(message);
      expect(scope).toBe('utils');
    });

    it('should infer deps scope', () => {
      const message = 'Update npm packages to latest versions';
      const scope = formatter.inferScopeFromMessage(message);
      expect(scope).toBe('deps');
    });

    it('should infer performance scope', () => {
      const message = 'Optimize cache for faster loading';
      const scope = formatter.inferScopeFromMessage(message);
      expect(scope).toBe('perf');
    });

    it('should infer docs scope', () => {
      const message = 'Update README with installation guide';
      const scope = formatter.inferScopeFromMessage(message);
      expect(scope).toBe('docs');
    });

    it('should infer build scope', () => {
      const message = 'Configure webpack bundler';
      const scope = formatter.inferScopeFromMessage(message);
      expect(scope).toBe('build');
    });

    it('should infer CI scope', () => {
      const message = 'Add GitHub Actions workflow';
      const scope = formatter.inferScopeFromMessage(message);
      expect(scope).toBe('ci');
    });

    it('should return null for unknown scope', () => {
      const message = 'Fix some general bug';
      const scope = formatter.inferScopeFromMessage(message);
      expect(scope).toBeNull();
    });
  });

  describe('inferScope with context', () => {
    it('should use WordPress scope when WordPress context present', () => {
      const context = {
        files: {
          wordpress: {
            isWordPress: true,
            type: 'plugin',
            plugins: ['jetpack']
          }
        }
      };
      const message = 'Update jetpack functionality';

      const scope = formatter.inferScope(message, context);

      expect(scope).toBe('jetpack');
    });

    it('should use file scope when confident and matches message', () => {
      const context = {
        files: {
          scope: 'api'
        }
      };
      const message = 'Update API endpoint';

      const scope = formatter.inferScope(message, context);

      expect(scope).toBe('api');
    });

    it('should prefer message scope when different from file scope', () => {
      const context = {
        files: {
          scope: 'utils'
        }
      };
      const message = 'Add database migration';

      const scope = formatter.inferScope(message, context);

      expect(scope).toBe('db');
    });

    it('should fall back to message inference when no file scope', () => {
      const context = {
        files: {
          scope: 'general'
        }
      };
      const message = 'Add authentication logic';

      const scope = formatter.inferScope(message, context);

      expect(scope).toBe('auth');
    });
  });

  describe('formatWithTemplate with enhanced context', () => {
    it('should format with WordPress context', () => {
      const template = '{type}({scope}): {description}';
      const data = {
        type: 'feat',
        scope: 'plugin',
        description: 'Add new feature',
        context: {
          wordpress: {
            type: 'plugin',
            plugins: ['jetpack']
          }
        }
      };

      const result = formatter.formatWithTemplate(template, data);

      expect(result).toBe('feat(plugin): Add new feature');
    });

    it('should handle complex template variables', () => {
      const template = '{type}({scope}): {description} [{ticket}]';
      const data = {
        type: 'fix',
        scope: 'auth',
        description: 'Resolve login issue',
        ticket: 'TICKET-123'
      };

      const result = formatter.formatWithTemplate(template, data);

      expect(result).toBe('fix(auth): Resolve login issue [TICKET-123]');
    });
  });

  describe('getSuggestions with WordPress context', () => {
    it('should provide WordPress-specific suggestions', () => {
      const message = 'update plugin functionality';
      const context = {
        files: {
          wordpress: {
            isWordPress: true,
            type: 'plugin'
          }
        }
      };

      const suggestions = formatter.getSuggestions(message, context);

      expect(suggestions).toContain(
        expect.stringContaining('Consider using conventional commit format')
      );
    });

    it('should suggest scope improvements for WordPress', () => {
      const message = 'feat: update code';
      const context = {
        files: {
          wordpress: {
            isWordPress: true,
            plugins: ['jetpack'],
            themes: [],
            components: []
          }
        }
      };

      const suggestions = formatter.getSuggestions(message, context);

      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty WordPress context', () => {
      const wordpressContext = {};
      const message = 'Update code';

      const scope = formatter.inferWordPressScope(message, wordpressContext);

      expect(scope).toBeNull();
    });

    it('should handle WordPress context with missing properties', () => {
      const wordpressContext = {
        type: 'plugin'
        // Missing other properties
      };
      const message = 'Update plugin';

      const scope = formatter.inferWordPressScope(message, wordpressContext);

      expect(scope).toBe('plugin');
    });

    it('should handle messages with mixed case', () => {
      const message = 'UpDaTe API EndPoInT';
      const scope = formatter.inferScopeFromMessage(message);
      expect(scope).toBe('api');
    });

    it('should handle messages with special characters', () => {
      const message = 'Update api/v1/user endpoint';
      const scope = formatter.inferScopeFromMessage(message);
      expect(scope).toBe('api');
    });

    it('should handle very long messages', () => {
      const longMessage = 'Update ' + 'api '.repeat(100) + 'endpoint';
      const scope = formatter.inferScopeFromMessage(longMessage);
      expect(scope).toBe('api');
    });

    it('should handle null/undefined inputs gracefully', () => {
      expect(() => formatter.inferWordPressScope(null, {})).not.toThrow();
      expect(() => formatter.inferScopeFromMessage(null)).not.toThrow();
      expect(() => formatter.inferScope(null, {})).not.toThrow();
    });
  });
});