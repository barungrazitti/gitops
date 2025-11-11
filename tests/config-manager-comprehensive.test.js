/**
 * Comprehensive Tests for Config Manager
 */

const ConfigManager = require('../src/core/config-manager');
const fs = require('fs-extra');
const path = require('path');

jest.mock('fs-extra');

describe('ConfigManager', () => {
  let configManager;
  const mockConfigPath = '/mock/config/path';

  beforeEach(() => {
    jest.clearAllMocks();
    configManager = new ConfigManager(mockConfigPath);
  });

  describe('constructor', () => {
    test('should initialize with default config path', () => {
      const defaultManager = new ConfigManager();
      expect(defaultManager.configPath).toContain('ai-commit-config.json');
    });

    test('should initialize with custom config path', () => {
      expect(configManager.configPath).toBe(mockConfigPath);
    });
  });

  describe('load', () => {
    test('should load existing config successfully', async () => {
      const mockConfig = {
        defaultProvider: 'ollama',
        conventionalCommits: true,
        language: 'en'
      };
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue(mockConfig);

      const result = await configManager.load();

      expect(result).toEqual(mockConfig);
      expect(fs.pathExists).toHaveBeenCalledWith(mockConfigPath);
      expect(fs.readJson).toHaveBeenCalledWith(mockConfigPath);
    });

    test('should return default config when file does not exist', async () => {
      fs.pathExists.mockResolvedValue(false);

      const result = await configManager.load();

      expect(result).toEqual(configManager.defaultConfig);
      expect(fs.pathExists).toHaveBeenCalledWith(mockConfigPath);
      expect(fs.readJson).not.toHaveBeenCalled();
    });

    test('should handle read errors gracefully', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockRejectedValue(new Error('Read error'));

      const result = await configManager.load();

      expect(result).toEqual(configManager.defaultConfig);
    });
  });

  describe('save', () => {
    test('should save config successfully', async () => {
      const config = { provider: 'ollama' };
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();

      await configManager.save(config);

      expect(fs.ensureDir).toHaveBeenCalledWith(path.dirname(mockConfigPath));
      expect(fs.writeJson).toHaveBeenCalledWith(mockConfigPath, config, { spaces: 2 });
    });

    test('should handle save errors', async () => {
      const config = { provider: 'ollama' };
      fs.ensureDir.mockRejectedValue(new Error('Save error'));

      await expect(configManager.save(config)).rejects.toThrow('Failed to save configuration');
    });
  });

  describe('get', () => {
    test('should get specific config value', async () => {
      const mockConfig = { provider: 'ollama', language: 'en' };
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue(mockConfig);

      const result = await configManager.get('provider');

      expect(result).toBe('ollama');
    });

    test('should return undefined for non-existent key', async () => {
      const mockConfig = { provider: 'ollama' };
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue(mockConfig);

      const result = await configManager.get('nonexistent');

      expect(result).toBeUndefined();
    });

    test('should return default value for non-existent key', async () => {
      const mockConfig = { provider: 'ollama' };
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue(mockConfig);

      const result = await configManager.get('nonexistent', 'default');

      expect(result).toBe('default');
    });
  });

  describe('set', () => {
    test('should set config value successfully', async () => {
      const mockConfig = { provider: 'groq' };
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue(mockConfig);
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();

      await configManager.set('provider', 'ollama');

      expect(fs.writeJson).toHaveBeenCalledWith(
        mockConfigPath,
        { provider: 'ollama' },
        { spaces: 2 }
      );
    });

    test('should create new config if none exists', async () => {
      fs.pathExists.mockResolvedValue(false);
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();

      await configManager.set('provider', 'ollama');

      expect(fs.writeJson).toHaveBeenCalledWith(
        mockConfigPath,
        { provider: 'ollama' },
        { spaces: 2 }
      );
    });
  });

  describe('setMultiple', () => {
    test('should set multiple config values', async () => {
      const mockConfig = { provider: 'groq' };
      const newValues = { provider: 'ollama', language: 'es' };
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue(mockConfig);
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();

      await configManager.setMultiple(newValues);

      expect(fs.writeJson).toHaveBeenCalledWith(
        mockConfigPath,
        newValues,
        { spaces: 2 }
      );
    });
  });

  describe('reset', () => {
    test('should reset to default config', async () => {
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();

      await configManager.reset();

      expect(fs.writeJson).toHaveBeenCalledWith(
        mockConfigPath,
        configManager.defaultConfig,
        { spaces: 2 }
      );
    });
  });

  describe('validate', () => {
    test('should validate valid config', () => {
      const validConfig = {
        defaultProvider: 'ollama',
        conventionalCommits: true,
        language: 'en',
        count: 3
      };

      expect(() => configManager.validate(validConfig)).not.toThrow();
    });

    test('should reject invalid provider', () => {
      const invalidConfig = {
        defaultProvider: 'invalid',
        conventionalCommits: true,
        language: 'en'
      };

      expect(() => configManager.validate(invalidConfig)).toThrow();
    });

    test('should reject invalid language', () => {
      const invalidConfig = {
        defaultProvider: 'ollama',
        conventionalCommits: true,
        language: 'invalid'
      };

      expect(() => configManager.validate(invalidConfig)).toThrow();
    });

    test('should reject invalid count', () => {
      const invalidConfig = {
        defaultProvider: 'ollama',
        conventionalCommits: true,
        language: 'en',
        count: 0
      };

      expect(() => configManager.validate(invalidConfig)).toThrow();
    });
  });
});