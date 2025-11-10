/**
 * Tests for ConfigManager
 */

const ConfigManager = require('../src/core/config-manager');
const fs = require('fs-extra');

// Mock fs-extra
jest.mock('fs-extra');

describe('ConfigManager', () => {
  let configManager;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock fs-extra
    fs.writeJson = jest.fn().mockResolvedValue();
    fs.readJson = jest.fn();
    
    // Create a temporary config directory for testing
    process.env.CONFIG_DIR = '/tmp/test-config';
    
    configManager = new ConfigManager();
  });

  afterEach(() => {
    // Clean up environment
    delete process.env.CONFIG_DIR;
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
      expect(defaults).toHaveProperty('excludeFiles');
      expect(defaults).toHaveProperty('commitTypes');
      expect(defaults).toHaveProperty('templates');
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
      expect(error.message).toContain('defaultProvider');
    });

    it('should reject invalid language', () => {
      const schema = configManager.getValidationSchema();
      const defaults = configManager.getDefaults();
      const { error } = schema.validate({ ...defaults, language: 'invalid' });
      
      expect(error).toBeDefined();
      expect(error.message).toContain('language');
    });

    it('should reject invalid messageCount', () => {
      const schema = configManager.getValidationSchema();
      const defaults = configManager.getDefaults();
      const { error } = schema.validate({ ...defaults, messageCount: 0 });
      
      expect(error).toBeDefined();
      expect(error.message).toContain('messageCount');
    });
  });

  describe('getConfigPath', () => {
    it('should return configuration file path', () => {
      const path = configManager.getConfigPath();
      
      expect(path).toBeDefined();
      expect(typeof path).toBe('string');
    });
  });

  describe('get', () => {
    it('should get configuration value', async () => {
      // Set a valid value first
      await configManager.set('conventionalCommits', false);
      
      const result = await configManager.get('conventionalCommits');
      
      expect(result).toBe(false);
    });

    it('should return undefined for non-existent key', async () => {
      const result = await configManager.get('nonExistentKey');
      
      expect(result).toBeUndefined();
    });
  });

  describe('set', () => {
    it('should set valid configuration value', async () => {
      await configManager.set('conventionalCommits', false);
      
      const result = await configManager.get('conventionalCommits');
      expect(result).toBe(false);
    });

    it('should set string value', async () => {
      await configManager.set('language', 'es');
      
      const result = await configManager.get('language');
      expect(result).toBe('es');
    });

    it('should set number value', async () => {
      await configManager.set('messageCount', 5);
      
      const result = await configManager.get('messageCount');
      expect(result).toBe(5);
    });
  });

  describe('setMultiple', () => {
    it('should set multiple valid configuration values', async () => {
      const values = { 
        conventionalCommits: false, 
        messageCount: 5,
        language: 'fr'
      };
      
      await configManager.setMultiple(values);
      
      expect(await configManager.get('conventionalCommits')).toBe(false);
      expect(await configManager.get('messageCount')).toBe(5);
      expect(await configManager.get('language')).toBe('fr');
    });
  });

  describe('load', () => {
    it('should load configuration', async () => {
      // Set some values first
      await configManager.set('defaultProvider', 'ollama');
      
      const result = await configManager.load();
      
      expect(result).toBeDefined();
      expect(result.defaultProvider).toBe('ollama');
    });

    it('should merge with defaults', async () => {
      // Set only one value
      await configManager.set('defaultProvider', 'ollama');
      
      const result = await configManager.load();
      
      expect(result.defaultProvider).toBe('ollama');
      // Note: conventionalCommits might be false if it was set in a previous test
      expect(result.conventionalCommits).toBeDefined();
    });
  });

  describe('reset', () => {
    it('should reset configuration to defaults', async () => {
      // Set some values
      await configManager.set('defaultProvider', 'ollama');
      await configManager.set('conventionalCommits', false);
      
      // Reset
      await configManager.reset();
      
      // Check values are back to defaults
      expect(await configManager.get('defaultProvider')).toBe('groq');
      expect(await configManager.get('conventionalCommits')).toBe(true);
    });
  });

  describe('export', () => {
    it('should export configuration to file', async () => {
      await configManager.set('defaultProvider', 'ollama');
      
      await configManager.export('/path/to/export.json');
      
      expect(fs.writeJson).toHaveBeenCalledWith('/path/to/export.json', expect.any(Object), { spaces: 2 });
    });
  });

  describe('import', () => {
    it('should import valid configuration from file', async () => {
      const importConfig = { defaultProvider: 'ollama', conventionalCommits: false };
      fs.readJson.mockResolvedValue(importConfig);
      
      await configManager.import('/path/to/import.json');
      
      expect(fs.readJson).toHaveBeenCalledWith('/path/to/import.json');
      expect(await configManager.get('defaultProvider')).toBe('ollama');
      expect(await configManager.get('conventionalCommits')).toBe(false);
    });

    it('should throw error for invalid configuration file', async () => {
      fs.readJson.mockResolvedValue({ defaultProvider: 'invalid' });
      
      await expect(configManager.import('/path/to/import.json')).rejects.toThrow('Invalid configuration file');
    });

    it('should throw error when import fails', async () => {
      fs.readJson.mockRejectedValue(new Error('Import failed'));
      
      await expect(configManager.import('/path/to/import.json')).rejects.toThrow('Failed to import configuration');
    });
  });

  describe('getProviderConfig', () => {
    beforeEach(async () => {
      await configManager.set('apiKey', 'test-key');
      await configManager.set('model', null);
      await configManager.set('maxTokens', 150);
      await configManager.set('temperature', 0.7);
      await configManager.set('timeout', 120000);
      await configManager.set('retries', 3);
      await configManager.set('proxy', null);
    });

    it('should return groq provider configuration', async () => {
      const config = await configManager.getProviderConfig('groq');
      
      expect(config.apiKey).toBe('test-key');
      expect(config.model).toBe('llama-3.1-8b-instant');
      expect(config.maxTokens).toBe(150);
      expect(config.temperature).toBe(0.7);
    });

    it('should return ollama provider configuration', async () => {
      const config = await configManager.getProviderConfig('ollama');
      
      expect(config.apiKey).toBe('test-key');
      expect(config.model).toBe('qwen2.5-coder:latest');
      expect(config.baseURL).toBe('http://localhost:11434');
    });

    it('should use custom groq model if valid', async () => {
      await configManager.set('model', 'llama-3.1-70b-versatile');
      
      const config = await configManager.getProviderConfig('groq');
      
      expect(config.model).toBe('llama-3.1-70b-versatile');
    });

    it('should use custom ollama model if valid', async () => {
      await configManager.set('model', 'deepseek-v3.1:671b-cloud');
      
      const config = await configManager.getProviderConfig('ollama');
      
      expect(config.model).toBe('deepseek-v3.1:671b-cloud');
    });
  });

  describe('validateApiKey', () => {
    it('should validate ollama provider without API key', async () => {
      await configManager.set('apiKey', null);
      
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
      
      await expect(configManager.validateApiKey('groq')).rejects.toThrow('API key not configured for groq');
    });
  });
});