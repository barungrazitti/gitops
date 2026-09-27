/**
 * Tests for ConfigManager
 */

// jest.mock is NOT hoisted (transform: {} — no babel), so register the mocks
// BEFORE requiring the module under test or they never apply.
jest.mock('fs-extra');
jest.mock('conf', () =>
  jest.fn().mockImplementation(() => ({
    store: { defaultProvider: 'groq', conventionalCommits: true },
    path: '/test/config.json',
    get: jest.fn(key => {
      const store = { defaultProvider: 'groq', conventionalCommits: true };
      return store[key];
    }),
    set: jest.fn(),
    clear: jest.fn(),
  }))
);

const ConfigManager = require('../src/core/config-manager');

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
          temperature: 0.5,
        })
      ).resolves.toBeUndefined();
    });

    it('chmods the conf store to 0600 after writing', async () => {
      const fs = require('fs');
      const chmodSpy = jest.spyOn(fs, 'chmodSync').mockImplementation(() => {});

      try {
        await configManager.setMultiple({ conventionalCommits: false });

        expect(chmodSpy).toHaveBeenCalledWith('/test/config.json', 0o600);
      } finally {
        chmodSpy.mockRestore();
      }
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
      expect(config.model).toBe('openai/gpt-oss-20b');
    });

    it('should return ollama provider configuration', async () => {
      const config = await configManager.getProviderConfig('ollama');

      expect(config).toBeDefined();
      expect(config.model).toBe('qwen2.5-coder:latest');
      expect(config.baseURL).toBe('http://localhost:11434');
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
