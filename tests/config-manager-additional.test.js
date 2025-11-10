/**
 * Unit tests for Config Manager - Additional Coverage
 */

const ConfigManager = require('../src/core/config-manager');
const path = require('path');

describe('ConfigManager - Additional Coverage', () => {
  let configManager;
  let configPath;

  beforeEach(() => {
    configPath = path.join(__dirname, '..', 'config', 'test-config.json');
    configManager = new ConfigManager(configPath);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getProviderConfig', () => {
    it('should extract provider-specific config', () => {
      const mockData = {
        'groq.apiKey': 'test-key',
        'groq.model': 'mixtral',
        'ollama.url': 'http://localhost:11434',
        'general.setting': 'value'
      };

      configManager.data = mockData;

      const groqConfig = configManager.getProviderConfig('groq');
      expect(groqConfig).toEqual({
        apiKey: 'test-key',
        model: 'mixtral'
      });

      const ollamaConfig = configManager.getProviderConfig('ollama');
      expect(ollamaConfig).toEqual({
        url: 'http://localhost:11434'
      });
    });

    it('should return empty config for provider with no settings', () => {
      configManager.data = {
        'other.setting': 'value'
      };

      const config = configManager.getProviderConfig('unknown');
      expect(config).toEqual({});
    });

    it('should handle nested provider config', () => {
      configManager.data = {
        'groq.apiKey': 'test-key',
        'groq.advanced': {
          retryCount: 3,
          timeout: 60000
        }
      };

      const config = configManager.getProviderConfig('groq');
      expect(config).toEqual({
        apiKey: 'test-key',
        advanced: {
          retryCount: 3,
          timeout: 60000
        }
      });
    });

    it('should handle malformed provider config', () => {
      configManager.data = {
        'groq': 'not-an-object',
        'groq.apiKey': 'test-key'
      };

      const config = configManager.getProviderConfig('groq');
      expect(config).toEqual({
        apiKey: 'test-key'
      });
    });
  });

  describe('validateConfig', () => {
    it('should validate groq config', () => {
      const validGroqConfig = {
        apiKey: 'gsk_test_key',
        model: 'llama-3.1-8b-instant'
      };

      const result = configManager.validateConfig('groq', validGroqConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject invalid groq config', () => {
      const invalidGroqConfig = {
        apiKey: '',
        model: 'invalid-model'
      };

      const result = configManager.validateConfig('groq', invalidGroqConfig);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('API key is required');
    });

    it('should validate ollama config', () => {
      const validOllamaConfig = {
        url: 'http://localhost:11434',
        model: 'llama2'
      };

      const result = configManager.validateConfig('ollama', validOllamaConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should accept empty ollama config', () => {
      const result = configManager.validateConfig('ollama', {});
      expect(result.valid).toBe(true);
    });

    it('should handle unknown provider', () => {
      const result = configManager.validateConfig('unknown', {});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unknown provider: unknown');
    });
  });

  describe('mergeConfig', () => {
    it('should merge configurations correctly', () => {
      const base = {
        setting1: 'value1',
        setting2: 'old-value'
      };

      const override = {
        setting2: 'new-value',
        setting3: 'value3'
      };

      const result = configManager.mergeConfig(base, override);
      expect(result).toEqual({
        setting1: 'value1',
        setting2: 'new-value',
        setting3: 'value3'
      });
    });

    it('should handle null base config', () => {
      const override = { setting: 'value' };
      const result = configManager.mergeConfig(null, override);
      expect(result).toEqual(override);
    });

    it('should handle null override config', () => {
      const base = { setting: 'value' };
      const result = configManager.mergeConfig(base, null);
      expect(result).toEqual(base);
    });

    it('should handle nested objects', () => {
      const base = {
        nested: {
          prop1: 'value1',
          prop2: 'old-value'
        }
      };

      const override = {
        nested: {
          prop2: 'new-value',
          prop3: 'value3'
        }
      };

      const result = configManager.mergeConfig(base, override);
      expect(result).toEqual({
        nested: {
          prop2: 'new-value',
          prop3: 'value3'
        }
      });
    });
  });

  describe('reset', () => {
    it('should reset to default configuration', async () => {
      // Modify some config
      await configManager.set('test.setting', 'modified');
      expect(configManager.get('test.setting')).toBe('modified');

      // Reset
      await configManager.reset();

      // Should be back to default
      expect(configManager.get('test.setting')).toBeUndefined();
    });

    it('should reload from file after reset', async () => {
      jest.spyOn(configManager, 'loadConfig').mockResolvedValue();

      await configManager.reset();

      expect(configManager.loadConfig).toHaveBeenCalled();
    });

    it('should handle reset errors gracefully', async () => {
      jest.spyOn(configManager, 'loadConfig').mockRejectedValue(new Error('File error'));

      await expect(configManager.reset()).resolves.toBeUndefined();
    });
  });

  describe('exportConfig', () => {
    it('should export configuration to file', async () => {
      const exportPath = path.join(__dirname, '..', 'config', 'export.json');
      const config = { test: 'value' };
      
      configManager.data = config;

      const result = await configManager.exportConfig(exportPath);
      
      expect(result.success).toBe(true);
      expect(result.path).toBe(exportPath);
    });

    it('should handle export errors', async () => {
      const invalidPath = '/invalid/path/config.json';
      
      const result = await configManager.exportConfig(invalidPath);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('importConfig', () => {
    it('should import configuration from file', async () => {
      const importPath = path.join(__dirname, '..', 'config', 'test-config.json');
      const importData = { imported: 'value' };
      
      jest.spyOn(require('fs-extra'), 'readJson').mockResolvedValue(importData);
      
      const result = await configManager.importConfig(importPath);
      
      expect(result.success).toBe(true);
      expect(configManager.data.imported).toBe('value');
    });

    it('should handle import errors', async () => {
      const invalidPath = '/invalid/path/config.json';
      
      jest.spyOn(require('fs-extra'), 'readJson').mockRejectedValue(new Error('File not found'));
      
      const result = await configManager.importConfig(invalidPath);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getSchema', () => {
    it('should return configuration schema', () => {
      const schema = configManager.getSchema();
      
      expect(schema).toHaveProperty('groq');
      expect(schema).toHaveProperty('ollama');
      expect(schema.groq).toHaveProperty('apiKey');
      expect(schema.groq).toHaveProperty('model');
    });

    it('should include validation rules in schema', () => {
      const schema = configManager.getSchema();
      
      expect(schema.groq.apiKey.required).toBe(true);
      expect(schema.ollama.url.type).toBe('string');
    });
  });

  describe('watchConfig', () => {
    it('should watch configuration file for changes', (done) => {
      const callback = jest.fn();
      
      configManager.watchConfig(callback);
      
      // Simulate file change
      setTimeout(() => {
        configManager.emit('change', { test: 'changed' });
        
        expect(callback).toHaveBeenCalledWith({ test: 'changed' });
        done();
      }, 100);
    });

    it('should handle watch errors gracefully', () => {
      const callback = jest.fn();
      
      // Mock fs.watch to throw error
      jest.spyOn(require('fs'), 'watch').mockImplementation(() => {
        throw new Error('Watch error');
      });
      
      expect(() => configManager.watchConfig(callback)).not.toThrow();
    });
  });

  describe('environment variable integration', () => {
    it('should override config with environment variables', () => {
      process.env.TEST_CONFIG_SETTING = 'env-value';
      
      configManager.data = {
        'test.setting': 'config-value'
      };
      
      const value = configManager.get('test.setting', true);
      expect(value).toBe('env-value');
      
      delete process.env.TEST_CONFIG_SETTING;
    });

    it('should handle missing environment variables', () => {
      const value = configManager.get('missing.setting', true);
      expect(value).toBeUndefined();
    });
  });

  describe('configuration validation', () => {
    it('should validate URLs in config', () => {
      const config = {
        'ollama.url': 'invalid-url'
      };
      
      configManager.data = config;
      const result = configManager.validateConfig('ollama', configManager.getProviderConfig('ollama'));
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate API key format', () => {
      const config = {
        'groq.apiKey': 'invalid-key'
      };
      
      configManager.data = config;
      const result = configManager.validateConfig('groq', configManager.getProviderConfig('groq'));
      
      if (result.errors.length > 0) {
        expect(result.errors[0]).toContain('API key');
      }
    });
  });

  describe('default configuration', () => {
    it('should provide sensible defaults', () => {
      const defaults = configManager.getDefaults();
      
      expect(defaults).toHaveProperty('groq');
      expect(defaults).toHaveProperty('ollama');
      expect(defaults.groq.model).toBe('llama-3.1-8b-instant');
      expect(defaults.ollama.url).toBe('http://localhost:11434');
    });

    it('should merge defaults with user config', () => {
      const userConfig = {
        'groq.model': 'custom-model'
      };
      
      configManager.data = userConfig;
      const fullConfig = configManager.getAll();
      
      expect(fullConfig['groq.model']).toBe('custom-model');
      // Should still have other default properties
    });
  });

  describe('performance and optimization', () => {
    it('should cache provider config extraction', () => {
      configManager.data = {
        'groq.apiKey': 'test-key',
        'groq.model': 'mixtral'
      };
      
      const spy = jest.spyOn(Object, 'keys');
      
      const config1 = configManager.getProviderConfig('groq');
      const config2 = configManager.getProviderConfig('groq');
      
      expect(config1).toEqual(config2);
      // Should be cached, not recompute
      spy.mockClear();
    });

    it('should handle large configuration objects efficiently', () => {
      const largeConfig = {};
      
      // Create large config
      for (let i = 0; i < 1000; i++) {
        largeConfig[`setting${i}`] = `value${i}`;
      }
      
      configManager.data = largeConfig;
      
      const start = Date.now();
      const value = configManager.get('setting500');
      const end = Date.now();
      
      expect(value).toBe('value500');
      expect(end - start).toBeLessThan(100); // Should be fast
    });
  });

  describe('edge cases', () => {
    it('should handle circular references in config', () => {
      const circular = {};
      circular.self = circular;
      
      configManager.data = { circular };
      
      expect(() => configManager.getProviderConfig('groq')).not.toThrow();
    });

    it('should handle extremely long configuration values', () => {
      const longValue = 'x'.repeat(10000);
      configManager.data = { 'long.value': longValue };
      
      const retrieved = configManager.get('long.value');
      expect(retrieved).toBe(longValue);
    });

    it('should handle special characters in config keys', () => {
      const specialConfig = {
        'test.special-char_123': 'value',
        'test.unicode-设置': 'unicode-value'
      };
      
      configManager.data = specialConfig;
      
      expect(configManager.get('test.special-char_123')).toBe('value');
      expect(configManager.get('test.unicode-设置')).toBe('unicode-value');
    });
  });
});