/**
 * Unit tests for Config Manager - Corrected Coverage
 */

const ConfigManager = require('../src/core/config-manager');
const path = require('path');

describe('ConfigManager - Corrected Coverage', () => {
  let configManager;
  let configPath;

  beforeEach(() => {
    configPath = path.join(__dirname, '..', 'config', 'test-config.json');
    configManager = new ConfigManager(configPath);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getDefaults', () => {
    it('should provide sensible defaults', () => {
      const defaults = configManager.getDefaults();
      
      expect(defaults).toHaveProperty('defaultProvider', 'groq');
      expect(defaults).toHaveProperty('temperature');
      expect(defaults).toHaveProperty('maxTokens');
      expect(defaults).toHaveProperty('language', 'en');
      expect(defaults).toHaveProperty('conventionalCommits', true);
    });

    it('should include default validation settings', () => {
      const defaults = configManager.getDefaults();
      
      expect(defaults).toHaveProperty('testValidation');
      expect(defaults.testValidation).toHaveProperty('enabled', false);
      expect(defaults.testValidation).toHaveProperty('autoFix', true);
    });

    it('should include template defaults', () => {
      const defaults = configManager.getDefaults();
      
      expect(defaults).toHaveProperty('templates');
      expect(defaults.templates).toHaveProperty('conventional');
      expect(defaults.templates).toHaveProperty('simple');
      expect(defaults.templates).toHaveProperty('detailed');
    });
  });

  describe('getValidationSchema', () => {
    it('should return validation schema', () => {
      const schema = configManager.getValidationSchema();
      
      expect(schema).toHaveProperty('type', 'object');
      expect(schema).toHaveProperty('properties');
      expect(schema).toHaveProperty('required');
    });

    it('should include required fields in schema', () => {
      const schema = configManager.getValidationSchema();
      
      expect(schema.required).toContain('conventionalCommits');
      expect(schema.required).toContain('maxTokens');
      expect(schema.required).toContain('messageCount');
    });

    it('should include property definitions', () => {
      const schema = configManager.getValidationSchema();
      
      expect(schema.properties).toHaveProperty('temperature');
      expect(schema.properties).toHaveProperty('maxTokens');
      expect(schema.properties).toHaveProperty('messageCount');
      expect(schema.properties).toHaveProperty('language');
    });
  });

  describe('getConfigPath', () => {
    it('should return config path', () => {
      const configPath = configManager.getConfigPath();
      
      expect(configPath).toBeDefined();
      expect(typeof configPath).toBe('string');
      expect(configPath).toContain('config');
      expect(configPath).toContain('aic.json');
    });
  });

  describe('getProviderConfig', () => {
    it('should extract provider-specific config', async () => {
      const config = {
        apiKey: 'test-key',
        model: 'llama-3.1-8b-instant',
        temperature: 0.7
      };
      
      // Mock the config to have provider data
      configManager.config = {
        all: config
      };
      
      const groqConfig = await configManager.getProviderConfig('groq');
      expect(groqConfig).toEqual(config);
    });

    it('should handle missing provider config gracefully', async () => {
      // Mock config to not have provider data
      configManager.config = {
        all: {}
      };
      
      const groqConfig = await configManager.getProviderConfig('groq');
      expect(groqConfig).toEqual({});
    });

    it('should handle provider config extraction errors gracefully', async () => {
      // Mock invalid config structure
      configManager.config = null;
      
      await expect(configManager.getProviderConfig('groq')).rejects.toThrow('Failed to get provider configuration');
    });

    it('should include provider-specific defaults for ollama', async () => {
      const config = {
        url: 'http://localhost:11434',
        model: 'qwen2.5-coder:latest'
      };
      
      configManager.config = {
        all: config
      };
      
      const ollamaConfig = await configManager.getProviderConfig('ollama');
      
      expect(ollamaConfig).toEqual(config);
    });

    it('should include provider-specific defaults for groq', async () => {
      const config = {
        apiKey: 'gsk_test_key',
        model: 'llama-3.1-8b-instant',
        temperature: 0.3
      };
      
      configManager.config = {
        all: config
      };
      
      const groqConfig = await configManager.getProviderConfig('groq');
      
      expect(groqConfig).toEqual(config);
    });
  });

  describe('validateApiKey', () => {
    it('should validate ollama without API key', async () => {
      configManager.config = { all: {} };
      
      const result = await configManager.validateApiKey('ollama');
      expect(result).toBe(true);
    });

    it('should validate groq with API key', async () => {
      configManager.config = {
        all: { apiKey: 'gsk_test_key' }
      };
      
      const result = await configManager.validateApiKey('groq');
      expect(result).toBe(true);
    });

    it('should reject groq without API key', async () => {
      configManager.config = { all: {} };
      
      await expect(configManager.validateApiKey('groq'))
        .rejects.toThrow('API key not configured for groq');
    });

    it('should handle configuration loading errors', async () => {
      // Mock load to throw error
      jest.spyOn(configManager, 'load').mockRejectedValue(new Error('Config file not found'));
      
      await expect(configManager.validateApiKey('groq'))
        .rejects.toThrow('API key not configured for groq');
    });
  });

  describe('set and get operations', () => {
    it('should set and get simple configuration', async () => {
      await configManager.set('test.key', 'test-value');
      
      const value = await configManager.get('test.key');
      expect(value).toBe('test-value');
    });

    it('should set and get nested configuration', async () => {
      await configManager.set('test.nested.key', 'nested-value');
      
      const value = await configManager.get('test.nested.key');
      expect(value).toBe('nested-value');
    });

    it('should handle getting non-existent keys', async () => {
      const value = await configManager.get('non.existent.key');
      expect(value).toBeUndefined();
    });

    it('should handle getting configuration with environment override', async () => {
      process.env.AICOMMIT_TEST_KEY = 'env-value';
      
      // Set a config value
      await configManager.set('test.key', 'config-value');
      
      // Get with environment override
      const value = await configManager.get('test.key', true);
      
      expect(value).toBe('env-value');
      
      // Clean up
      delete process.env.AICOMMIT_TEST_KEY;
    });

    it('should handle setting invalid configuration', async () => {
      await expect(configManager.set('invalid.key', null))
        .rejects.toThrow('Failed to set configuration value');
    });
  });

  describe('load and save operations', () => {
    it('should load configuration from file', async () => {
      const mockConfig = {
        temperature: 0.7,
        maxTokens: 150
      };
      
      // Mock fs operations
      jest.spyOn(require('fs-extra'), 'readJson').mockResolvedValue(mockConfig);
      jest.spyOn(require('fs-extra'), 'pathExists').mockResolvedValue(true);
      
      const loadedConfig = await configManager.load();
      
      expect(loadedConfig).toEqual(mockConfig);
    });

    it('should handle missing config file', async () => {
      // Mock file not exists
      jest.spyOn(require('fs-extra'), 'pathExists').mockResolvedValue(false);
      
      const loadedConfig = await configManager.load();
      
      // Should return defaults
      expect(loadedConfig).toBeDefined();
      expect(typeof loadedConfig).toBe('object');
    });

    it('should handle config file read errors', async () => {
      // Mock file exists but read error
      jest.spyOn(require('fs-extra'), 'pathExists').mockResolvedValue(true);
      jest.spyOn(require('fs-extra'), 'readJson').mockRejectedValue(new Error('Read error'));
      
      await expect(configManager.load()).rejects.toThrow('Failed to load configuration');
    });

    it('should save configuration to file', async () => {
      const mockConfig = {
        temperature: 0.8,
        maxTokens: 200
      };
      
      // Mock config structure
      configManager.config = { all: mockConfig };
      
      // Mock fs operations
      jest.spyOn(require('fs-extra'), 'writeJson').mockResolvedValue();
      jest.spyOn(require('fs-extra'), 'ensureDir').mockResolvedValue();
      
      await configManager.save();
      
      expect(require('fs-extra').writeJson).toHaveBeenCalled();
    });

    it('should handle save errors', async () => {
      const mockConfig = {
        temperature: 0.8,
        maxTokens: 200
      };
      
      configManager.config = { all: mockConfig };
      
      // Mock save error
      jest.spyOn(require('fs-extra'), 'writeJson').mockRejectedValue(new Error('Write error'));
      
      await expect(configManager.save()).rejects.toThrow('Failed to save configuration');
    });
  });

  describe('reset functionality', () => {
    it('should reset configuration to defaults', async () => {
      // Set some custom config
      await configManager.set('test.setting', 'custom-value');
      
      // Reset
      await configManager.reset();
      
      // Should not have custom value
      const value = await configManager.get('test.setting');
      expect(value).toBeUndefined();
    });

    it('should reload defaults after reset', async () => {
      // Reset should load defaults
      await configManager.reset();
      
      const defaults = configManager.getDefaults();
      const temperature = await configManager.get('temperature');
      
      expect(temperature).toBe(defaults.temperature);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle circular references in configuration', async () => {
      const circular = {};
      circular.self = circular;
      
      // This should not cause infinite recursion
      await expect(configManager.set('circular', circular))
        .rejects.toThrow(); // Should fail gracefully
    });

    it('should handle very long configuration values', async () => {
      const longValue = 'x'.repeat(10000);
      
      await configManager.set('long.value', longValue);
      
      const retrieved = await configManager.get('long.value');
      expect(retrieved).toBe(longValue);
    });

    it('should handle special characters in configuration keys', async () => {
      const specialKey = 'test.special-char_123.unicode-设置';
      const value = 'special-value';
      
      await configManager.set(specialKey, value);
      
      const retrieved = await configManager.get(specialKey);
      expect(retrieved).toBe(value);
    });

    it('should handle configuration with Unicode content', async () => {
      const unicodeValue = '测试配置值 🎉';
      
      await configManager.set('unicode.value', unicodeValue);
      
      const retrieved = await configManager.get('unicode.value');
      expect(retrieved).toBe(unicodeValue);
    });

    it('should handle null configuration values', async () => {
      await configManager.set('null.value', null);
      
      const retrieved = await configManager.get('null.value');
      expect(retrieved).toBeNull();
    });

    it('should handle undefined configuration values', async () => {
      await configManager.set('undefined.value', undefined);
      
      const retrieved = await configManager.get('undefined.value');
      expect(retrieved).toBeUndefined();
    });

    it('should handle numeric configuration values', async () => {
      await configManager.set('numeric.value', 42);
      
      const retrieved = await configManager.get('numeric.value');
      expect(retrieved).toBe(42);
    });

    it('should handle boolean configuration values', async () => {
      await configManager.set('boolean.value', true);
      
      const retrieved = await configManager.get('boolean.value');
      expect(retrieved).toBe(true);
    });
  });

  describe('performance and optimization', () => {
    it('should handle large configuration objects efficiently', async () => {
      const largeConfig = {};
      
      // Create large configuration
      for (let i = 0; i < 1000; i++) {
        largeConfig[`setting${i}`] = `value${i}`;
      }
      
      const start = Date.now();
      await configManager.set('large.config', largeConfig);
      const end = Date.now();
      
      expect(end - start).toBeLessThan(1000); // Should be reasonably fast
    });

    it('should cache configuration reads', async () => {
      await configManager.set('cache.test', 'test-value');
      
      const start = Date.now();
      const value1 = await configManager.get('cache.test');
      const value2 = await configManager.get('cache.test');
      const end = Date.now();
      
      expect(value1).toBe('test-value');
      expect(value2).toBe('test-value');
      expect(end - start).toBeLessThan(100); // Should be fast due to caching
    });

    it('should handle concurrent configuration operations', async () => {
      const promises = [];
      
      // Create multiple concurrent operations
      for (let i = 0; i < 100; i++) {
        promises.push(configManager.set(`concurrent.${i}`, `value${i}`));
        promises.push(configManager.get(`concurrent.${i - 1}`));
      }
      
      // Should not throw errors
      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });

  describe('environment integration', () => {
    it('should override configuration with environment variables', async () => {
      process.env.AICOMMIT_ENV_TEST = 'environment-value';
      
      const value = await configManager.get('env.test', true);
      
      expect(value).toBe('environment-value');
      
      delete process.env.AICOMMIT_ENV_TEST;
    });

    it('should handle missing environment variables gracefully', async () => {
      const value = await configManager.get('missing.env.var', true);
      
      expect(value).toBeUndefined();
    });

    it('should handle environment variables with special characters', async () => {
      process.env.AICOMMIT_SPECIAL_CHARS = 'special-value-123_!@#$%';
      
      const value = await configManager.get('special.chars', true);
      
      expect(value).toBe('special-value-123_!@#$%');
      
      delete process.env.AICOMMIT_SPECIAL_CHARS;
    });
  });
});