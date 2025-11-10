/**
 * Unit tests for AI Provider Factory - covering uncovered lines
 */

jest.mock('../src/providers/groq-provider');
jest.mock('../src/providers/ollama-provider');
jest.mock('../src/core/config-manager');

const AIProviderFactory = require('../src/providers/ai-provider-factory');
const GroqProvider = require('../src/providers/groq-provider');
const OllamaProvider = require('../src/providers/ollama-provider');
const ConfigManager = require('../src/core/config-manager');

describe('AIProviderFactory - Additional Coverage', () => {
  let mockConfigManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfigManager = {
      get: jest.fn(),
      set: jest.fn(),
      getAll: jest.fn()
    };
    
    ConfigManager.mockImplementation(() => mockConfigManager);
  });

  describe('create with edge cases', () => {
    it('should handle provider creation with configuration errors', () => {
      GroqProvider.mockImplementation(() => {
        throw new Error('Configuration error');
      });

      expect(() => AIProviderFactory.create('groq'))
        .toThrow('Configuration error');
    });

    it('should handle provider name with whitespace', () => {
      expect(() => AIProviderFactory.create(' groq '))
        .toThrow('Unsupported AI provider:  groq . Supported providers: groq, ollama');
    });

    it('should handle numeric provider name', () => {
      expect(() => AIProviderFactory.create(123))
        .toThrow('Provider name is required. Got: 123. Available providers: groq, ollama');
    });

    it('should handle boolean provider name', () => {
      expect(() => AIProviderFactory.create(true))
        .toThrow('Provider name is required. Got: true. Available providers: groq, ollama');
    });
  });

  describe('getDefaultProvider with various configurations', () => {
    it('should handle ConfigManager returning undefined', () => {
      mockConfigManager.get.mockReturnValue(undefined);

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toBe('groq');
    });

    it('should handle ConfigManager throwing TypeError', () => {
      mockConfigManager.get.mockImplementation(() => {
        throw new TypeError('Cannot read property of undefined');
      });

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toBe('groq');
    });

    it('should handle ConfigManager returning empty string', () => {
      mockConfigManager.get.mockReturnValue('');

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toBe('groq');
    });

    it('should handle ConfigManager returning null', () => {
      mockConfigManager.get.mockReturnValue(null);

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toBe('groq');
    });
  });

  describe('getProviderConfig with complex scenarios', () => {
    it('should extract provider-specific config from full config', () => {
      const fullConfig = {
        'groq.apiKey': 'test-key',
        'groq.model': 'llama-3.1-8b-instant',
        'groq.temperature': 0.7,
        'ollama.url': 'http://localhost:11434',
        'ollama.model': 'llama2',
        'general.timeout': 30000
      };

      mockConfigManager.get.mockReturnValue(fullConfig);

      const groqConfig = AIProviderFactory.getProviderConfig('groq');

      expect(groqConfig).toEqual({
        apiKey: 'test-key',
        model: 'llama-3.1-8b-instant',
        temperature: 0.7
      });
    });

    it('should return empty config for provider with no settings', () => {
      const fullConfig = {
        'other.setting': 'value'
      };

      mockConfigManager.get.mockReturnValue(fullConfig);

      const config = AIProviderFactory.getProviderConfig('groq');

      expect(config).toEqual({});
    });

    it('should handle nested configuration values', () => {
      const fullConfig = {
        'groq.apiKey': 'test-key',
        'groq.advanced': {
          'retryCount': 3,
          'timeout': 60000
        }
      };

      mockConfigManager.get.mockReturnValue(fullConfig);

      const config = AIProviderFactory.getProviderConfig('groq');

      expect(config).toEqual({
        apiKey: 'test-key',
        advanced: {
          retryCount: 3,
          timeout: 60000
        }
      });
    });
  });

  describe('validateProvider with various scenarios', () => {
    it('should validate provider with timeout', async () => {
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
      expect(mockProvider.validate).toHaveBeenCalledWith({ apiKey: 'test-key' });
    });

    it('should handle validation returning non-boolean', async () => {
      const mockProvider = {
        validate: jest.fn().mockResolvedValue('valid')
      };
      GroqProvider.mockImplementation(() => mockProvider);

      const result = await AIProviderFactory.validateProvider('groq', mockProvider);

      expect(result).toBe('valid');
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
  });

  describe('isProviderAvailable edge cases', () => {
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

  describe('getAvailableProviders metadata details', () => {
    it('should include complete model lists', () => {
      const providers = AIProviderFactory.getAvailableProviders();

      const groqProvider = providers.find(p => p.name === 'groq');
      expect(groqProvider.models).toEqual([
        'llama-3.1-8b-instant',
        'llama2-70b-4096',
        'gemma-7b-it',
        'llama3-8b-8192',
        'llama3-70b-8192'
      ]);

      const ollamaProvider = providers.find(p => p.name === 'ollama');
      expect(Array.isArray(ollamaProvider.models)).toBe(true);
    });

    it('should include provider descriptions', () => {
      const providers = AIProviderFactory.getAvailableProviders();

      const groqProvider = providers.find(p => p.name === 'groq');
      expect(groqProvider.description).toBe('Fast inference models');

      const ollamaProvider = providers.find(p => p.name === 'ollama');
      expect(ollamaProvider.description).toBe('Local models');
    });

    it('should include API requirement indicators', () => {
      const providers = AIProviderFactory.getAvailableProviders();

      const groqProvider = providers.find(p => p.name === 'groq');
      expect(groqProvider.requiresApiKey).toBe(true);

      const ollamaProvider = providers.find(p => p.name === 'ollama');
      expect(ollamaProvider.requiresApiKey).toBe(false);
    });
  });

  describe('provider performance characteristics', () => {
    it('should create providers without side effects', () => {
      const initialGroqCalls = GroqProvider.mock.calls.length;
      const initialOllamaCalls = OllamaProvider.mock.calls.length;

      AIProviderFactory.create('groq');
      AIProviderFactory.create('ollama');
      AIProviderFactory.create('groq');

      expect(GroqProvider.mock.calls.length).toBe(initialGroqCalls + 2);
      expect(OllamaProvider.mock.calls.length).toBe(initialOllamaCalls + 1);
    });

    it('should handle rapid provider creation', () => {
      const providers = [];
      
      for (let i = 0; i < 100; i++) {
        providers.push(AIProviderFactory.create('groq'));
        providers.push(AIProviderFactory.create('ollama'));
      }

      expect(providers).toHaveLength(200);
      providers.forEach(provider => {
        expect(provider).toBeDefined();
      });
    });
  });

  describe('error handling and resilience', () => {
    it('should handle ConfigManager throwing ReferenceError', () => {
      mockConfigManager.get.mockImplementation(() => {
        throw new ReferenceError('config is not defined');
      });

      expect(() => AIProviderFactory.getDefaultProvider()).not.toThrow();
      expect(AIProviderFactory.getDefaultProvider()).toBe('groq');
    });

    it('should handle ConfigManager throwing custom error', () => {
      mockConfigManager.get.mockImplementation(() => {
        throw new Error('Configuration file corrupted');
      });

      expect(() => AIProviderFactory.getProviderConfig('groq')).not.toThrow();
      expect(() => AIProviderFactory.getProviderConfig('ollama')).not.toThrow();
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

  describe('type safety and validation', () => {
    it('should handle provider name as object', () => {
      const objName = { toString: () => 'groq' };
      expect(() => AIProviderFactory.create(objName))
        .toThrow('Provider name is required. Got: [object Object]. Available providers: groq, ollama');
    });

    it('should handle provider name as array', () => {
      expect(() => AIProviderFactory.create(['groq']))
        .toThrow('Provider name is required. Got: groq. Available providers: groq, ollama');
    });

    it('should handle provider name with prototype chain', () => {
      const customName = 'groq';
      customName.toString = () => 'custom';
      expect(() => AIProviderFactory.create(customName))
        .toThrow('Unsupported AI provider: groq. Supported providers: groq, ollama');
    });
  });

  describe('integration scenarios', () => {
    it('should work with multiple provider instances', () => {
      const groq1 = AIProviderFactory.create('groq');
      const groq2 = AIProviderFactory.create('groq');
      const ollama1 = AIProviderFactory.create('ollama');
      const ollama2 = AIProviderFactory.create('ollama');

      expect(groq1).not.toBe(groq2); // Different instances
      expect(ollama1).not.toBe(ollama2); // Different instances
      expect(groq1).toBeInstanceOf(GroqProvider);
      expect(ollama1).toBeInstanceOf(OllamaProvider);
    });

    it('should maintain provider list consistency', () => {
      const providers1 = AIProviderFactory.getAvailableProviders();
      const providers2 = AIProviderFactory.getAvailableProviders();

      expect(providers1).toEqual(providers2);
      expect(providers1).not.toBe(providers2); // Different arrays, same content
    });
  });

  describe('edge case inputs', () => {
    it('should handle empty provider names in different ways', () => {
      expect(() => AIProviderFactory.create('')).toThrow();
      expect(() => AIProviderFactory.create(null)).toThrow();
      expect(() => AIProviderFactory.create(undefined)).toThrow();
    });

    it('should handle whitespace-only provider names', () => {
      expect(() => AIProviderFactory.create('   ')).toThrow();
      expect(() => AIProviderFactory.create('\t\n')).toThrow();
      expect(() => AIProviderFactory.create('\r\n')).toThrow();
    });

    it('should handle provider names with Unicode characters', () => {
      expect(() => AIProviderFactory.create('gröq')).toThrow();
      expect(() => AIProviderFactory.create('ollama测试')).toThrow();
    });

    it('should handle provider names with escape sequences', () => {
      expect(() => AIProviderFactory.create('\x67\x72\x6f\x71')).toThrow();
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
      for (let i = 0; i < 1000; i++) {
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
});