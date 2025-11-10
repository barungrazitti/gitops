/**
 * Unit tests for AI Provider Factory
 */

jest.mock('../src/providers/groq-provider');
jest.mock('../src/providers/ollama-provider');

const AIProviderFactory = require('../src/providers/ai-provider-factory');
const GroqProvider = require('../src/providers/groq-provider');
const OllamaProvider = require('../src/providers/ollama-provider');

describe('AIProviderFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create groq provider', () => {
      const provider = AIProviderFactory.create('groq');

      expect(GroqProvider).toHaveBeenCalled();
      expect(provider).toBeInstanceOf(GroqProvider);
      expect(provider.name).toBe('groq');
    });

    it('should create ollama provider', () => {
      const provider = AIProviderFactory.create('ollama');

      expect(OllamaProvider).toHaveBeenCalled();
      expect(provider).toBeInstanceOf(OllamaProvider);
      expect(provider.name).toBe('ollama');
    });

    it('should throw error for unknown provider', () => {
      expect(() => AIProviderFactory.create('unknown'))
        .toThrow('Unsupported AI provider: unknown. Supported providers: groq, ollama');
    });

    it('should throw error for empty provider name', () => {
      expect(() => AIProviderFactory.create(''))
        .toThrow('Provider name is required. Got: . Available providers: groq, ollama');
    });

    it('should handle case insensitive provider names', () => {
      const upperProvider = AIProviderFactory.create('GROQ');
      const mixedProvider = AIProviderFactory.create('Ollama');

      expect(GroqProvider).toHaveBeenCalledTimes(1);
      expect(OllamaProvider).toHaveBeenCalledTimes(1);
      expect(upperProvider).toBeInstanceOf(GroqProvider);
      expect(mixedProvider).toBeInstanceOf(OllamaProvider);
    });
  });

  describe('getAvailableProviders', () => {
    it('should return list of available providers', () => {
      const providers = AIProviderFactory.getAvailableProviders();

      expect(providers).toHaveLength(2);
      expect(providers[0]).toHaveProperty('name', 'groq');
      expect(providers[0]).toHaveProperty('displayName', 'Groq');
      expect(providers[0]).toHaveProperty('description', 'Fast inference models');
      expect(providers[0]).toHaveProperty('requiresApiKey', true);
      expect(providers[0]).toHaveProperty('models');
      expect(providers[1]).toHaveProperty('name', 'ollama');
      expect(providers[1]).toHaveProperty('displayName', 'Ollama');
    });
  });

  describe('isProviderAvailable', () => {
    it('should return true for available providers', () => {
      expect(AIProviderFactory.isProviderAvailable('groq')).toBe(true);
      expect(AIProviderFactory.isProviderAvailable('ollama')).toBe(true);
    });

    it('should return false for unavailable providers', () => {
      expect(AIProviderFactory.isProviderAvailable('unknown')).toBe(false);
    });

    it('should handle case insensitive check', () => {
      expect(AIProviderFactory.isProviderAvailable('GROQ')).toBe(true);
      expect(AIProviderFactory.isProviderAvailable('OLLAMA')).toBe(true);
    });
  });

  describe('getDefaultProvider', () => {
    beforeEach(() => {
      jest.mock('../src/core/config-manager', () => ({
        get: jest.fn()
      }));
    });

    it('should return configured default provider', () => {
      const { ConfigManager } = require('../src/core/config-manager');
      jest.spyOn(ConfigManager.prototype, 'get').mockReturnValue('ollama');

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toBe('ollama');
    });

    it('should fallback to groq if default is invalid', () => {
      const { ConfigManager } = require('../src/core/config-manager');
      jest.spyOn(ConfigManager.prototype, 'get').mockReturnValue('invalid');

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toBe('groq');
    });

    it('should fallback to groq if default is null', () => {
      const { ConfigManager } = require('../src/core/config-manager');
      jest.spyOn(ConfigManager.prototype, 'get').mockReturnValue(null);

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toBe('groq');
    });

    it('should fallback to groq if config throws error', () => {
      const { ConfigManager } = require('../src/core/config-manager');
      jest.spyOn(ConfigManager.prototype, 'get').mockImplementation(() => {
        throw new Error('Config error');
      });

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toBe('groq');
    });
  });

  describe('validateProvider', () => {
    it('should validate groq provider successfully', async () => {
      const mockProvider = {
        validate: jest.fn().mockResolvedValue(true)
      };
      GroqProvider.mockImplementation(() => mockProvider);

      const result = await AIProviderFactory.validateProvider('groq', {
        apiKey: 'test-key'
      });

      expect(result).toBe(true);
    });

    it('should handle validation errors', async () => {
      const mockProvider = {
        validate: jest.fn().mockRejectedValue(new Error('Validation failed'))
      };
      GroqProvider.mockImplementation(() => mockProvider);

      await expect(AIProviderFactory.validateProvider('groq', {
        apiKey: 'invalid-key'
      }))
        .rejects.toThrow('Validation failed');
    });

    it('should throw error for unknown provider', async () => {
      const mockProvider = {
        validate: jest.fn()
      };

      await expect(AIProviderFactory.validateProvider('unknown', mockProvider))
        .rejects.toThrow('Unsupported AI provider: unknown');
    });
  });

  describe('getProviderConfig', () => {
    beforeEach(() => {
      jest.mock('../src/core/config-manager', () => ({
        get: jest.fn()
      }));
    });

    it('should get groq provider config', () => {
      const { ConfigManager } = require('../src/core/config-manager');
      jest.spyOn(ConfigManager.prototype, 'get').mockReturnValue({
        'groq.apiKey': 'test-key',
        'groq.model': 'llama-3.1-8b-instant'
      });

      const config = AIProviderFactory.getProviderConfig('groq');

      expect(config).toEqual({
        apiKey: 'test-key',
        model: 'llama-3.1-8b-instant'
      });
    });

    it('should get ollama provider config', () => {
      const { ConfigManager } = require('../src/core/config-manager');
      jest.spyOn(ConfigManager.prototype, 'get').mockReturnValue({
        'ollama.url': 'http://localhost:11434',
        'ollama.model': 'llama2'
      });

      const config = AIProviderFactory.getProviderConfig('ollama');

      expect(config).toEqual({
        url: 'http://localhost:11434',
        model: 'llama2'
      });
    });
  });

  describe('error handling', () => {
    it('should handle provider creation errors', () => {
      GroqProvider.mockImplementation(() => {
        throw new Error('Failed to create Groq provider');
      });

      expect(() => AIProviderFactory.create('groq'))
        .toThrow('Failed to create Groq provider');
    });

    it('should handle provider configuration errors', () => {
      const { ConfigManager } = require('../src/core/config-manager');
      jest.spyOn(ConfigManager.prototype, 'get').mockImplementation(() => {
        throw new Error('Configuration error');
      });

      expect(() => AIProviderFactory.getProviderConfig('groq'))
        .toThrow('Configuration error');
    });
  });

  describe('provider metadata', () => {
    it('should include complete provider metadata', () => {
      const providers = AIProviderFactory.getAvailableProviders();

      const groqProvider = providers.find(p => p.name === 'groq');
      const ollamaProvider = providers.find(p => p.name === 'ollama');

      expect(groqProvider).toEqual({
        name: 'groq',
        displayName: 'Groq',
        description: 'Fast inference models',
        requiresApiKey: true,
        models: [
          'llama-3.1-8b-instant',
          'llama-3.3-70b-versatile',
          'openai/gpt-oss-20b',
          'qwen/qwen3-32b',
          'meta-llama/llama-4-scout-17b-16e-instruct',
        ]
      });

      expect(ollamaProvider).toHaveProperty('name', 'ollama');
      expect(ollamaProvider).toHaveProperty('displayName', 'Ollama');
      expect(ollamaProvider).toHaveProperty('requiresApiKey', false);
    });
  });

  describe('edge cases', () => {
    it('should handle null provider name in create', () => {
      expect(() => AIProviderFactory.create(null))
        .toThrow('Provider name is required. Got: null. Available providers: groq, ollama');
    });

    it('should handle undefined provider name in create', () => {
      expect(() => AIProviderFactory.create(undefined))
        .toThrow('Provider name is required. Got: undefined. Available providers: groq, ollama');
    });

    it('should handle whitespace-only provider name', () => {
      expect(() => AIProviderFactory.create('   '))
        .toThrow('Unsupported AI provider:    . Supported providers: groq, ollama');
    });

    it('should handle empty config for provider', () => {
      const { ConfigManager } = require('../src/core/config-manager');
      jest.spyOn(ConfigManager.prototype, 'get').mockReturnValue({});

      const config = AIProviderFactory.getProviderConfig('groq');

      expect(config).toEqual({});
    });
  });
});