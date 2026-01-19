/**
 * Tests for ConfigManager
 */

const ConfigManager = require('../src/core/config-manager');
const fs = require('fs-extra');

jest.mock('fs-extra');
jest.mock('conf', () => {
  return jest.fn().mockImplementation(() => ({
    store: {},
    path: '/test/config.json',
    get: jest.fn((key) => {
      const store = { defaultProvider: 'groq', conventionalCommits: true };
      return store[key];
    }),
    set: jest.fn(),
    clear: jest.fn(),
  }));
});

describe('ConfigManager', () => {
  let configManager;

  beforeEach(() => {
    jest.clearAllMocks();

    configManager = new ConfigManager();
  });

  describe('getDefaults', () => {
    it('should return default configuration object', () => {
      const defaults = configManager.getDefaults();

      expect(defaults).toHaveProperty('defaultProvider', 'groq');
      expect(defaults).toHaveProperty('conventionalCommits', true);
      expect(defaults).toHaveProperty('language', 'en');
      expect(defaults).toHaveProperty('messageCount', 3);
      expect(defaults).toHaveProperty('maxTokens', 150);
      expect(defaults).toHaveProperty('temperature', 0.7);
      expect(defaults).toHaveProperty('cache', true);
      expect(defaults).toHaveProperty('apiKey', null);
      expect(defaults).toHaveProperty('model', null);
    });
  });

  describe('getValidationSchema', () => {
    it('should return Joi validation schema', () => {
      const schema = configManager.getValidationSchema();

      expect(schema).toBeDefined();
      expect(schema.validate).toBeDefined();
    });

    it('should validate default configuration', () => {
      const schema = configManager.getValidationSchema();
      const defaults = configManager.getDefaults();
      const { error } = schema.validate(defaults);

      expect(error).toBeUndefined();
    });

    it('should reject invalid provider', () => {
      const schema = configManager.getValidationSchema();
      const { error } = schema.validate({ defaultProvider: 'invalid' });

      expect(error).toBeDefined();
    });

    it('should reject invalid language', () => {
      const schema = configManager.getValidationSchema();
      const { error } = schema.validate({ language: 'invalid' });

      expect(error).toBeDefined();
    });

    it('should reject invalid messageCount', () => {
      const schema = configManager.getValidationSchema();
      const { error } = schema.validate({ messageCount: 0 });

      expect(error).toBeDefined();
    });
  });

  describe('getConfigPath', () => {
    it('should return configuration file path', () => {
      const path = configManager.getConfigPath();

      expect(path).toBeDefined();
      expect(typeof path).toBe('string');
    });
  });

  describe('load', () => {
    it('should load configuration', async () => {
      const result = await configManager.load();

      expect(result).toBeDefined();
      expect(result.defaultProvider).toBe('groq');
      expect(result.conventionalCommits).toBe(true);
    });
  });

  describe('get', () => {
    it('should get configuration value', async () => {
      const result = await configManager.get('defaultProvider');

      expect(result).toBe('groq');
    });
  });

  describe('set', () => {
    it('should set valid configuration value', async () => {
      await expect(configManager.set('conventionalCommits', false)).resolves.toBeUndefined();
    });
  });

  describe('setMultiple', () => {
    it('should set multiple valid configuration values', async () => {
      await expect(
        configManager.setMultiple({
          conventionalCommits: false,
          language: 'fr',
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('reset', () => {
    it('should reset configuration to defaults', async () => {
      await expect(configManager.reset()).resolves.toBeUndefined();
    });
  });

  describe('getProviderConfig', () => {
    it('should return groq provider configuration', async () => {
      const config = await configManager.getProviderConfig('groq');

      expect(config).toBeDefined();
      expect(config.model).toBe('llama-3.1-8b-instant');
    });

    it('should return ollama provider configuration', async () => {
      const config = await configManager.getProviderConfig('ollama');

      expect(config).toBeDefined();
      expect(config.model).toBe('qwen2.5-coder:latest');
      expect(config.baseURL).toBe('http://localhost:11434');
    });
  });

  describe('validateApiKey', () => {
    it('should validate ollama provider without API key', async () => {
      const result = await configManager.validateApiKey('ollama');
      expect(result).toBe(true);
    });

    it('should validate groq provider with API key', async () => {
      await configManager.set('apiKey', 'test-key');

      const result = await configManager.validateApiKey('groq');
      expect(result).toBe(true);
    });

    it('should throw error for groq provider without API key', async () => {
      await configManager.set('apiKey', null);

      await expect(configManager.validateApiKey('groq')).rejects.toThrow('API key not configured');
    });
  });

  describe('validateProviderConfig', () => {
    it('should validate groq provider', async () => {
      const result = await configManager.validateProviderConfig('groq', { apiKey: 'test' });

      expect(result.valid).toBe(true);
    });

    it('should validate ollama provider', async () => {
      const result = await configManager.validateProviderConfig('ollama', {});

      expect(result.valid).toBe(true);
    });

    it('should reject unknown provider', async () => {
      const result = await configManager.validateProviderConfig('unknown', {});

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('mergeConfig', () => {
    it('should merge configuration objects', () => {
      const base = { a: 1, b: 2 };
      const override = { b: 3, c: 4 };

      const result = configManager.mergeConfig(base, override);

      expect(result.a).toBe(1);
      expect(result.b).toBe(3);
      expect(result.c).toBe(4);
    });

    it('should handle null base config', () => {
      const result = configManager.mergeConfig(null, { a: 1 });

      expect(result.a).toBe(1);
    });

    it('should handle null override config', () => {
      const result = configManager.mergeConfig({ a: 1 }, null);

      expect(result.a).toBe(1);
    });
  });
});
