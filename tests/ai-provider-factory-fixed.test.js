/**
 * Unit tests for AI Provider Factory - Fixed
 */

jest.mock('../src/providers/groq-provider');
jest.mock('../src/providers/ollama-provider');
jest.mock('../src/core/config-manager');

const AIProviderFactory = require('../src/providers/ai-provider-factory');
const GroqProvider = require('../src/providers/groq-provider');
const OllamaProvider = require('../src/providers/ollama-provider');
const ConfigManager = require('../src/core/config-manager');

describe('AIProviderFactory - Fixed', () => {
  let mockConfigManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfigManager = {
      get: jest.fn(),
      set: jest.fn(),
      getAll: jest.fn()
    };
    
    ConfigManager.mockImplementation(() => mockConfigManager);

    // Reset module cache
    jest.isolateModules(() => {
      require('../src/providers/ai-provider-factory');
    });
  });

  describe('create', () => {
    it('should create groq provider', () => {
      GroqProvider.mockImplementation(() => ({ name: 'groq' }));
      
      const provider = AIProviderFactory.create('groq');
      
      expect(provider).toEqual({ name: 'groq' });
      expect(GroqProvider).toHaveBeenCalled();
    });

    it('should create ollama provider', () => {
      OllamaProvider.mockImplementation(() => ({ name: 'ollama' }));
      
      const provider = AIProviderFactory.create('ollama');
      
      expect(provider).toEqual({ name: 'ollama' });
      expect(OllamaProvider).toHaveBeenCalled();
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
      GroqProvider.mockImplementation(() => ({ name: 'groq' }));
      
      const provider = AIProviderFactory.create('GROQ');
      
      expect(provider).toEqual({ name: 'groq' });
      expect(GroqProvider).toHaveBeenCalled();
    });

    it('should handle provider creation errors', () => {
      GroqProvider.mockImplementation(() => {
        throw new Error('Configuration error');
      });

      expect(() => AIProviderFactory.create('groq'))
        .toThrow('Configuration error');
    });

    it('should handle whitespace-only provider name', () => {
      expect(() => AIProviderFactory.create('   '))
        .toThrow('Provider name is required. Got:    . Available providers: groq, ollama');
    });

    it('should handle null provider name', () => {
      expect(() => AIProviderFactory.create(null))
        .toThrow('Provider name is required. Got: null. Available providers: groq, ollama');
    });

    it('should handle undefined provider name', () => {
      expect(() => AIProviderFactory.create(undefined))
        .toThrow('Provider name is required. Got: undefined. Available providers: groq, ollama');
    });

    it('should handle object provider name', () => {
      expect(() => AIProviderFactory.create({ toString: () => 'groq' }))
        .toThrow('Provider name is required. Got: [object Object]. Available providers: groq, ollama');
    });

    it('should handle array provider name', () => {
      expect(() => AIProviderFactory.create(['groq']))
        .toThrow('Provider name is required. Got: groq. Available providers: groq, ollama');
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
      expect(providers[1]).toHaveProperty('displayName', 'Ollama (Local)');
      expect(providers[1]).toHaveProperty('requiresApiKey', false);
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

    it('should handle provider name with special characters', () => {
      expect(AIProviderFactory.isProviderAvailable('groq@beta')).toBe(false);
    });

    it('should handle provider name with numbers', () => {
      expect(AIProviderFactory.isProviderAvailable('groq2')).toBe(false);
    });

    it('should handle very long provider name', () => {
      const longName = 'g'.repeat(1000);
      expect(AIProviderFactory.isProviderAvailable(longName)).toBe(false);
    });
  });

  describe('getDefaultProvider', () => {
    beforeEach(() => {
      // Reset ConfigManager before each test
      delete require.cache[require.resolve('../src/core/config-manager')];
    });

    it('should return configured default provider', () => {
      jest.doMock('../src/core/config-manager', () => ({
        get: jest.fn().mockReturnValue('ollama')
      }));

      const { ConfigManager } = require('../src/core/config-manager');
      ConfigManager.get = jest.fn().mockReturnValue('ollama');

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toBe('ollama');
    });

    it('should fallback to groq if default is invalid', () => {
      jest.doMock('../src/core/config-manager', () => ({
        get: jest.fn().mockReturnValue('invalid')
      }));

      const { ConfigManager } = require('../src/core/config-manager');
      ConfigManager.get = jest.fn().mockReturnValue('invalid');

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toBe('groq');
    });

    it('should fallback to groq if default is null', () => {
      jest.doMock('../src/core/config-manager', () => ({
        get: jest.fn().mockReturnValue(null)
      }));

      const { ConfigManager } = require('../src/core/config-manager');
      ConfigManager.get = jest.fn().mockReturnValue(null);

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toBe('groq');
    });

    it('should fallback to groq if config throws error', () => {
      jest.doMock('../src/core/config-manager', () => ({
        get: jest.fn().mockImplementation(() => {
          throw new Error('Config error');
        })
      }));

      const { ConfigManager } = require('../src/core/config-manager');
      ConfigManager.get = jest.fn().mockImplementation(() => {
        throw new Error('Config error');
      });

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toBe('groq');
    });

    it('should handle ConfigManager returning undefined', () => {
      jest.doMock('../src/core/config-manager', () => ({
        get: jest.fn().mockReturnValue(undefined)
      }));

      const { ConfigManager } = require('../src/core/config-manager');
      ConfigManager.get = jest.fn().mockReturnValue(undefined);

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toBe('groq');
    });

    it('should handle ConfigManager returning empty string', () => {
      jest.doMock('../src/core/config-manager', () => ({
        get: jest.fn().mockReturnValue('')
      }));

      const { ConfigManager } = require('../src/core/config-manager');
      ConfigManager.get = jest.fn().mockReturnValue('');

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

      const result = await AIProviderFactory.validateProvider('groq', mockProvider);

      expect(result).toBe(true);
      expect(mockProvider.validate).toHaveBeenCalledWith({
        apiKey: 'test-key'
      });
    });

    it('should handle validation errors', async () => {
      const mockProvider = {
        validate: jest.fn().mockRejectedValue(new Error('Invalid API key'))
      };
      GroqProvider.mockImplementation(() => mockProvider);

      await expect(AIProviderFactory.validateProvider('groq', mockProvider))
        .rejects.toThrow('Invalid API key');
    });

    it('should throw error for unknown provider', async () => {
      const mockProvider = {
        validate: jest.fn()
      };

      await expect(AIProviderFactory.validateProvider('unknown', mockProvider))
        .rejects.toThrow('Unsupported AI provider: unknown');
    });

    it('should handle validation with custom config', async () => {
      const mockProvider = {
        validate: jest.fn().mockResolvedValue(true)
      };
      GroqProvider.mockImplementation(() => mockProvider);
      const customConfig = { apiKey: 'custom-key', model: 'custom-model' };

      const result = await AIProviderFactory.validateProvider('groq', mockProvider, customConfig);

      expect(result).toBe(true);
      expect(mockProvider.validate).toHaveBeenCalledWith(customConfig);
    });

    it('should handle validation timeout', async () => {
      const mockProvider = {
        validate: jest.fn().mockImplementation(() => {
          return new Promise((resolve) => {
            setTimeout(() => resolve(true), 100);
          });
        })
      };
      GroqProvider.mockImplementation(() => mockProvider);

      const result = await AIProviderFactory.validateProvider('groq', mockProvider);

      expect(result).toBe(true);
    });
  });

  describe('getProviderConfig', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    it('should get groq provider config', () => {
      jest.doMock('../src/core/config-manager', () => ({
        get: jest.fn().mockReturnValue({
          'groq.apiKey': 'test-key',
          'groq.model': 'mixtral-8x7b-32768'
        })
      }));

      const { ConfigManager } = require('../src/core/config-manager');
      ConfigManager.get = jest.fn().mockReturnValue({
        'groq.apiKey': 'test-key',
        'groq.model': 'mixtral-8x7b-32768'
      });

      const config = AIProviderFactory.getProviderConfig('groq');

      expect(config).toEqual({
        apiKey: 'test-key',
        model: 'mixtral-8x7b-32768'
      });
    });

    it('should get ollama provider config', () => {
      jest.doMock('../src/core/config-manager', () => ({
        get: jest.fn().mockReturnValue({
          'ollama.url': 'http://localhost:11434',
          'ollama.model': 'llama2'
        })
      }));

      const { ConfigManager } = require('../src/core/config-manager');
      ConfigManager.get = jest.fn().mockReturnValue({
        'ollama.url': 'http://localhost:11434',
        'ollama.model': 'llama2'
      });

      const config = AIProviderFactory.getProviderConfig('ollama');

      expect(config).toEqual({
        url: 'http://localhost:11434',
        model: 'llama2'
      });
    });

    it('should handle provider configuration errors', () => {
      jest.doMock('../src/core/config-manager', () => ({
        get: jest.fn().mockImplementation(() => {
          throw new Error('Configuration error');
        })
      }));

      const { ConfigManager } = require('../src/core/config-manager');
      ConfigManager.get = jest.fn().mockImplementation(() => {
        throw new Error('Configuration error');
      });

      expect(() => AIProviderFactory.getProviderConfig('groq'))
        .toThrow('Configuration error');
    });

    it('should return empty config for provider with no settings', () => {
      jest.doMock('../src/core/config-manager', () => ({
        get: jest.fn().mockReturnValue({
          'other.setting': 'value'
        })
      }));

      const { ConfigManager } = require('../src/core/config-manager');
      ConfigManager.get = jest.fn().mockReturnValue({
        'other.setting': 'value'
      });

      const config = AIProviderFactory.getProviderConfig('groq');

      expect(config).toEqual({});
    });

    it('should handle empty config for provider', () => {
      jest.doMock('../src/core/config-manager', () => ({
        get: jest.fn().mockReturnValue({})
      }));

      const { ConfigManager } = require('../src/core/config-manager');
      ConfigManager.get = jest.fn().mockReturnValue({});

      const config = AIProviderFactory.getProviderConfig('groq');

      expect(config).toEqual({});
    });
  });

  describe('error handling', () => {
    it('should handle ConfigManager throwing TypeError', () => {
      jest.doMock('../src/core/config-manager', () => ({
        get: jest.fn().mockImplementation(() => {
          throw new TypeError('Cannot read property of undefined');
        })
      }));

      const { ConfigManager } = require('../src/core/config-manager');
      ConfigManager.get = jest.fn().mockImplementation(() => {
        throw new TypeError('Cannot read property of undefined');
      });

      expect(() => AIProviderFactory.getDefaultProvider()).not.toThrow();
      expect(AIProviderFactory.getDefaultProvider()).toBe('groq');
    });

    it('should handle provider constructor throwing null', () => {
      GroqProvider.mockImplementation(() => {
        throw null;
      });

      expect(() => AIProviderFactory.create('groq')).toThrow();
    });

    it('should handle provider constructor throwing undefined', () => {
      OllamaProvider.mockImplementation(() => {
        throw undefined;
      });

      expect(() => AIProviderFactory.create('ollama')).toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should work with multiple provider instances', () => {
      GroqProvider.mockImplementation(() => ({ name: 'groq', id: 1 }));
      OllamaProvider.mockImplementation(() => ({ name: 'ollama', id: 2 }));

      const groq1 = AIProviderFactory.create('groq');
      const groq2 = AIProviderFactory.create('groq');
      const ollama1 = AIProviderFactory.create('ollama');
      const ollama2 = AIProviderFactory.create('ollama');

      expect(groq1).not.toBe(groq2); // Different instances
      expect(ollama1).not.toBe(ollama2); // Different instances
      expect(groq1.name).toBe('groq');
      expect(ollama1.name).toBe('ollama');
    });
  });

  describe('performance and memory', () => {
    it('should not cause memory leaks with repeated operations', () => {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      GroqProvider.mockImplementation(() => ({ name: 'groq' }));
      OllamaProvider.mockImplementation(() => ({ name: 'ollama' }));

      for (let i = 0; i < 100; i++) {
        AIProviderFactory.create('groq');
        AIProviderFactory.create('ollama');
        AIProviderFactory.getAvailableProviders();
        AIProviderFactory.isProviderAvailable('groq');
        AIProviderFactory.getDefaultProvider();
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
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
          'mixtral-8x7b-32768',
          'llama2-70b-4096',
          'gemma-7b-it',
          'llama3-8b-8192',
          'llama3-70b-8192',
        ]
      });

      expect(ollamaProvider).toEqual({
        name: 'ollama',
        displayName: 'Ollama (Local)',
        description: 'Local models',
        requiresApiKey: false,
        models: expect.any(Array)
      });
    });

    it('should maintain provider list consistency', () => {
      const providers1 = AIProviderFactory.getAvailableProviders();
      const providers2 = AIProviderFactory.getAvailableProviders();

      expect(providers1).toEqual(providers2);
      expect(providers1).not.toBe(providers2); // Different arrays, same content
    });
  });

  describe('edge cases', () => {
    it('should handle provider name with prototype chain', () => {
      const customName = 'groq';
      Object.defineProperty(customName, 'toString', {
        value: () => 'custom',
        configurable: true
      });
      
      expect(() => AIProviderFactory.create(customName))
        .toThrow('Unsupported AI provider: groq. Supported providers: groq, ollama');
    });

    it('should handle provider name with escape sequences', () => {
      expect(() => AIProviderFactory.create('\x67\x72\x6f\x71'))
        .toThrow('Unsupported AI provider: groq. Supported providers: groq, ollama');
    });

    it('should handle provider names with Unicode characters', () => {
      expect(() => AIProviderFactory.create('gröq'))
        .toThrow('Unsupported AI provider: gröq. Supported providers: groq, ollama');
      expect(() => AIProviderFactory.create('ollama测试'))
        .toThrow('Unsupported AI provider: ollama测试. Supported providers: groq, ollama');
    });
  });
});