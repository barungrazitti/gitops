/**
 * Unit tests for AI Provider Factory - Comprehensive Coverage
 */

jest.mock('../src/providers/groq-provider');
jest.mock('../src/providers/ollama-provider');
jest.mock('../src/core/config-manager', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    getAll: jest.fn(),
    getProviderConfig: jest.fn()
  }));
});

const AIProviderFactory = require('../src/providers/ai-provider-factory');
const GroqProvider = require('../src/providers/groq-provider');
const OllamaProvider = require('../src/providers/ollama-provider');

describe('AIProviderFactory - Comprehensive Coverage', () => {
  let mockConfigManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfigManager = {
      get: jest.fn(),
      set: jest.fn(),
      getAll: jest.fn(),
      getProviderConfig: jest.fn()
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    beforeEach(() => {
      // Reset the factory to avoid test pollution
      jest.isolateModules(() => {
        require('../src/providers/ai-provider-factory');
      });
    });

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

    it('should handle case insensitive provider names', () => {
      GroqProvider.mockImplementation(() => ({ name: 'groq' }));
      
      const provider = AIProviderFactory.create('GROQ');
      
      expect(provider).toEqual({ name: 'groq' });
    });

    it('should throw error for empty provider name', () => {
      expect(() => AIProviderFactory.create(''))
        .toThrow('Unsupported AI provider: . Supported providers: groq, ollama');
    });

    it('should throw error for null provider name', () => {
      expect(() => AIProviderFactory.create(null))
        .toThrow('Unsupported AI provider: null. Supported providers: groq, ollama');
    });

    it('should throw error for undefined provider name', () => {
      expect(() => AIProviderFactory.create(undefined))
        .toThrow('Unsupported AI provider: undefined. Supported providers: groq, ollama');
    });

    it('should throw error for non-string provider name', () => {
      expect(() => AIProviderFactory.create(123))
        .toThrow('Unsupported AI provider: 123. Supported providers: groq, ollama');
    });

    it('should handle provider creation errors', () => {
      GroqProvider.mockImplementation(() => {
        throw new Error('Configuration error');
      });

      expect(() => AIProviderFactory.create('groq'))
        .toThrow('Configuration error');
    });

    it('should throw error for whitespace-only provider name', () => {
      expect(() => AIProviderFactory.create('   '))
        .toThrow('Unsupported AI provider:    . Supported providers: groq, ollama');
    });

    it('should throw error for object provider name', () => {
      expect(() => AIProviderFactory.create({}))
        .toThrow('Unsupported AI provider: [object Object]. Supported providers: groq, ollama');
    });

    it('should handle provider names with special characters', () => {
      expect(() => AIProviderFactory.create('groq@beta'))
        .toThrow('Unsupported AI provider: groq@beta. Supported providers: groq, ollama');
    });

    it('should handle provider names with numbers', () => {
      expect(() => AIProviderFactory.create('groq2'))
        .toThrow('Unsupported AI provider: groq2. Supported providers: groq, ollama');
    });

    it('should handle very long provider names', () => {
      const longName = 'g'.repeat(1000);
      expect(() => AIProviderFactory.create(longName))
        .toThrow(`Unsupported AI provider: ${longName}. Supported providers: groq, ollama`);
    });

    it('should handle provider names with Unicode characters', () => {
      expect(() => AIProviderFactory.create('gröq'))
        .toThrow('Unsupported AI provider: gröq. Supported providers: groq, ollama');
    });
  });

  describe('getAvailableProviders', () => {
    it('should return list of available providers', () => {
      const providers = AIProviderFactory.getAvailableProviders();

      expect(providers).toHaveLength(2);
      expect(providers[0]).toEqual({
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
      expect(providers[1]).toEqual({
        name: 'ollama',
        displayName: 'Ollama (Local)',
        description: 'Local models via Ollama',
        requiresApiKey: false,
        models: expect.any(Array)
      });
    });

    it('should maintain consistent metadata structure', () => {
      const providers = AIProviderFactory.getAvailableProviders();

      providers.forEach(provider => {
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('displayName');
        expect(provider).toHaveProperty('description');
        expect(provider).toHaveProperty('requiresApiKey');
        expect(provider).toHaveProperty('models');
        expect(Array.isArray(provider.models)).toBe(true);
      });
    });

    it('should include all supported providers', () => {
      const providers = AIProviderFactory.getAvailableProviders();
      const providerNames = providers.map(p => p.name);

      expect(providerNames).toContain('groq');
      expect(providerNames).toContain('ollama');
    });
  });

  describe('isProviderAvailable', () => {
    it('should return true for groq provider', () => {
      expect(AIProviderFactory.isProviderAvailable('groq')).toBe(true);
    });

    it('should return true for ollama provider', () => {
      expect(AIProviderFactory.isProviderAvailable('ollama')).toBe(true);
    });

    it('should return false for unknown provider', () => {
      expect(AIProviderFactory.isProviderAvailable('unknown')).toBe(false);
    });

    it('should handle case insensitive check', () => {
      expect(AIProviderFactory.isProviderAvailable('GROQ')).toBe(true);
      expect(AIProviderFactory.isProviderAvailable('OLLAMA')).toBe(true);
      expect(AIProviderFactory.isProviderAvailable('Groq')).toBe(true);
      expect(AIProviderFactory.isProviderAvailable('Ollama')).toBe(true);
    });

    it('should handle provider name with special characters', () => {
      expect(AIProviderFactory.isProviderAvailable('groq@beta')).toBe(false);
      expect(AIProviderFactory.isProviderAvailable('ollama-2')).toBe(false);
    });

    it('should handle empty provider name', () => {
      expect(AIProviderFactory.isProviderAvailable('')).toBe(false);
    });

    it('should handle null provider name', () => {
      expect(AIProviderFactory.isProviderAvailable(null)).toBe(false);
    });

    it('should handle undefined provider name', () => {
      expect(AIProviderFactory.isProviderAvailable(undefined)).toBe(false);
    });

    it('should handle provider name with whitespace', () => {
      expect(AIProviderFactory.isProviderAvailable('  groq  ')).toBe(false);
    });

    it('should handle provider name with different case and whitespace', () => {
      expect(AIProviderFactory.isProviderAvailable('  GROQ  ')).toBe(false);
    });
  });

  describe('getDefaultProvider', () => {
    beforeEach(() => {
      // Reset ConfigManager mock
      require('../src/core/config-manager').mockImplementation(() => mockConfigManager);
    });

    it('should return configured default provider', () => {
      mockConfigManager.get.mockReturnValue('ollama');

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toBe('ollama');
      expect(mockConfigManager.get).toHaveBeenCalledWith('defaultProvider');
    });

    it('should fallback to groq if default is invalid', () => {
      mockConfigManager.get.mockReturnValue('invalid');

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toBe('groq');
    });

    it('should fallback to groq if default is null', () => {
      mockConfigManager.get.mockReturnValue(null);

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toBe('groq');
    });

    it('should fallback to groq if default is undefined', () => {
      mockConfigManager.get.mockReturnValue(undefined);

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toBe('groq');
    });

    it('should fallback to groq if default is empty string', () => {
      mockConfigManager.get.mockReturnValue('');

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toBe('groq');
    });

    it('should fallback to groq if ConfigManager throws error', () => {
      mockConfigManager.get.mockImplementation(() => {
        throw new Error('Config error');
      });

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toBe('groq');
    });

    it('should fallback to groq if default provider is not available', () => {
      mockConfigManager.get.mockReturnValue('nonexistent');

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toBe('groq');
    });

    it('should handle ConfigManager returning object', () => {
      mockConfigManager.get.mockReturnValue({});

      const defaultProvider = AIProviderFactory.getDefaultProvider();

      expect(defaultProvider).toBe('groq');
    });

    it('should handle ConfigManager returning array', () => {
      mockConfigManager.get.mockReturnValue(['ollama']);

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

    it('should validate ollama provider successfully', async () => {
      const mockProvider = {
        validate: jest.fn().mockResolvedValue(true)
      };
      OllamaProvider.mockImplementation(() => mockProvider);

      const result = await AIProviderFactory.validateProvider('ollama', mockProvider);

      expect(result).toBe(true);
      expect(mockProvider.validate).toHaveBeenCalledWith({
        url: 'http://localhost:11434'
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

    it('should handle null provider instance', async () => {
      await expect(AIProviderFactory.validateProvider('groq', null))
        .rejects.toThrow('Provider instance is required');
    });

    it('should handle undefined provider instance', async () => {
      await expect(AIProviderFactory.validateProvider('groq', undefined))
        .rejects.toThrow('Provider instance is required');
    });
  });

  describe('getProviderConfig', () => {
    beforeEach(() => {
      require('../src/core/config-manager').mockImplementation(() => mockConfigManager);
    });

    it('should get groq provider config', () => {
      const configData = {
        'groq.apiKey': 'test-key',
        'groq.model': 'mixtral-8x7b-32768'
      };
      mockConfigManager.get.mockReturnValue(configData);

      const config = AIProviderFactory.getProviderConfig('groq');

      expect(config).toEqual({
        apiKey: 'test-key',
        model: 'mixtral-8x7b-32768'
      });
      expect(mockConfigManager.get).toHaveBeenCalled();
    });

    it('should get ollama provider config', () => {
      const configData = {
        'ollama.url': 'http://localhost:11434',
        'ollama.model': 'llama2'
      };
      mockConfigManager.get.mockReturnValue(configData);

      const config = AIProviderFactory.getProviderConfig('ollama');

      expect(config).toEqual({
        url: 'http://localhost:11434',
        model: 'llama2'
      });
    });

    it('should return empty config for provider with no settings', () => {
      const configData = {
        'other.setting': 'value'
      };
      mockConfigManager.get.mockReturnValue(configData);

      const config = AIProviderFactory.getProviderConfig('groq');

      expect(config).toEqual({});
    });

    it('should handle ConfigManager throwing error', () => {
      mockConfigManager.get.mockImplementation(() => {
        throw new Error('Configuration error');
      });

      expect(() => AIProviderFactory.getProviderConfig('groq'))
        .toThrow('Configuration error');
    });

    it('should handle ConfigManager returning null', () => {
      mockConfigManager.get.mockReturnValue(null);

      const config = AIProviderFactory.getProviderConfig('groq');

      expect(config).toEqual({});
    });

    it('should handle ConfigManager returning undefined', () => {
      mockConfigManager.get.mockReturnValue(undefined);

      const config = AIProviderFactory.getProviderConfig('groq');

      expect(config).toEqual({});
    });

    it('should handle ConfigManager returning empty object', () => {
      mockConfigManager.get.mockReturnValue({});

      const config = AIProviderFactory.getProviderConfig('groq');

      expect(config).toEqual({});
    });

    it('should handle provider config extraction errors', () => {
      const configData = {
        'groq': 'invalid-data'
      };
      mockConfigManager.get.mockReturnValue(configData);

      const config = AIProviderFactory.getProviderConfig('groq');

      expect(config).toEqual({});
    });

    it('should handle nested provider config', () => {
      const configData = {
        'groq.apiKey': 'test-key',
        'groq.advanced.timeout': 60000,
        'groq.advanced.retries': 3
      };
      mockConfigManager.get.mockReturnValue(configData);

      const config = AIProviderFactory.getProviderConfig('groq');

      expect(config).toEqual({
        apiKey: 'test-key',
        advanced: {
          timeout: 60000,
          retries: 3
        }
      });
    });

    it('should handle provider config with special characters', () => {
      const configData = {
        'ollama.测试.url': 'http://测试.localhost:11434',
        'ollama.model': '测试模型'
      };
      mockConfigManager.get.mockReturnValue(configData);

      const config = AIProviderFactory.getProviderConfig('ollama');

      expect(config).toEqual({
        '测试.url': 'http://测试.localhost:11434',
        model: '测试模型'
      });
    });
  });

  describe('setProviderConfig', () => {
    beforeEach(() => {
      require('../src/core/config-manager').mockImplementation(() => mockConfigManager);
    });

    it('should set groq provider config', async () => {
      const config = {
        apiKey: 'new-key',
        model: 'new-model'
      };
      mockConfigManager.set.mockResolvedValue();

      await AIProviderFactory.setProviderConfig('groq', config);

      expect(mockConfigManager.set).toHaveBeenCalledWith('groq.apiKey', 'new-key');
      expect(mockConfigManager.set).toHaveBeenCalledWith('groq.model', 'new-model');
    });

    it('should set ollama provider config', async () => {
      const config = {
        url: 'http://new-host:11434',
        model: 'new-model'
      };
      mockConfigManager.set.mockResolvedValue();

      await AIProviderFactory.setProviderConfig('ollama', config);

      expect(mockConfigManager.set).toHaveBeenCalledWith('ollama.url', 'http://new-host:11434');
      expect(mockConfigManager.set).toHaveBeenCalledWith('ollama.model', 'new-model');
    });

    it('should handle empty config', async () => {
      mockConfigManager.set.mockResolvedValue();

      await AIProviderFactory.setProviderConfig('groq', {});

      expect(mockConfigManager.set).not.toHaveBeenCalled();
    });

    it('should handle null config', async () => {
      mockConfigManager.set.mockResolvedValue();

      await AIProviderFactory.setProviderConfig('groq', null);

      expect(mockConfigManager.set).not.toHaveBeenCalled();
    });

    it('should handle undefined config', async () => {
      mockConfigManager.set.mockResolvedValue();

      await AIProviderFactory.setProviderConfig('groq', undefined);

      expect(mockConfigManager.set).not.toHaveBeenCalled();
    });

    it('should handle ConfigManager set errors', async () => {
      const config = { apiKey: 'test-key' };
      mockConfigManager.set.mockRejectedValue(new Error('Save error'));

      await expect(AIProviderFactory.setProviderConfig('groq', config))
        .rejects.toThrow('Save error');
    });

    it('should handle unknown provider', async () => {
      const config = { apiKey: 'test-key' };

      await expect(AIProviderFactory.setProviderConfig('unknown', config))
        .rejects.toThrow('Unsupported AI provider: unknown');
    });

    it('should handle nested config objects', async () => {
      const config = {
        apiKey: 'test-key',
        advanced: {
          timeout: 60000,
          retries: 3
        }
      };
      mockConfigManager.set.mockResolvedValue();

      await AIProviderFactory.setProviderConfig('groq', config);

      expect(mockConfigManager.set).toHaveBeenCalledWith('groq.apiKey', 'test-key');
      expect(mockConfigManager.set).toHaveBeenCalledWith('groq.advanced', expect.any(Object));
    });
  });

  describe('error handling', () => {
    it('should handle GroqProvider constructor throwing null', () => {
      GroqProvider.mockImplementation(() => {
        throw null;
      });

      expect(() => AIProviderFactory.create('groq')).toThrow();
    });

    it('should handle GroqProvider constructor throwing undefined', () => {
      GroqProvider.mockImplementation(() => {
        throw undefined;
      });

      expect(() => AIProviderFactory.create('groq')).toThrow();
    });

    it('should handle GroqProvider constructor throwing string', () => {
      GroqProvider.mockImplementation(() => {
        throw 'Error message';
      });

      expect(() => AIProviderFactory.create('groq')).toThrow();
    });

    it('should handle GroqProvider constructor throwing error object', () => {
      GroqProvider.mockImplementation(() => {
        throw new Error('Provider error');
      });

      expect(() => AIProviderFactory.create('groq')).toThrow('Provider error');
    });

    it('should handle provider name with prototype chain', () => {
      const providerName = Object.create(null);
      providerName.toString = () => 'groq';

      expect(() => AIProviderFactory.create(providerName))
        .toThrow('Unsupported AI provider: groq. Supported providers: groq, ollama');
    });

    it('should handle provider name with circular reference', () => {
      const providerName = {};
      providerName.self = providerName;
      providerName.toString = () => 'groq';

      expect(() => AIProviderFactory.create(providerName))
        .toThrow('Unsupported AI provider: groq. Supported providers: groq, ollama');
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

    it('should handle provider creation in sequence', () => {
      GroqProvider.mockImplementation(() => ({ name: 'groq' }));
      OllamaProvider.mockImplementation(() => ({ name: 'ollama' }));

      const providers = [];
      providers.push(AIProviderFactory.create('groq'));
      providers.push(AIProviderFactory.create('ollama'));
      providers.push(AIProviderFactory.create('groq'));
      providers.push(AIProviderFactory.create('ollama'));

      expect(providers).toHaveLength(4);
      expect(providers[0].name).toBe('groq');
      expect(providers[1].name).toBe('ollama');
      expect(providers[2].name).toBe('groq');
      expect(providers[3].name).toBe('ollama');
    });

    it('should handle concurrent provider creation', async () => {
      GroqProvider.mockImplementation(() => ({ name: 'groq', id: Math.random() }));
      OllamaProvider.mockImplementation(() => ({ name: 'ollama', id: Math.random() }));

      const promises = [
        Promise.resolve(AIProviderFactory.create('groq')),
        Promise.resolve(AIProviderFactory.create('ollama')),
        Promise.resolve(AIProviderFactory.create('groq')),
        Promise.resolve(AIProviderFactory.create('ollama'))
      ];

      const providers = await Promise.all(promises);

      expect(providers).toHaveLength(4);
      expect(providers.every(p => p.name === 'groq' || p.name === 'ollama')).toBe(true);
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

    it('should maintain provider list consistency', () => {
      const providers1 = AIProviderFactory.getAvailableProviders();
      const providers2 = AIProviderFactory.getAvailableProviders();

      expect(providers1).toEqual(providers2);
      expect(providers1).not.toBe(providers2); // Different arrays, same content
    });

    it('should cache provider availability checks', () => {
      const startTime = Date.now();
      AIProviderFactory.isProviderAvailable('groq');
      AIProviderFactory.isProviderAvailable('groq');
      AIProviderFactory.isProviderAvailable('groq');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle extremely long provider names', () => {
      const longName = 'g'.repeat(10000);
      expect(() => AIProviderFactory.create(longName))
        .toThrow(`Unsupported AI provider: ${longName}. Supported providers: groq, ollama`);
    });

    it('should handle provider names with escape sequences', () => {
      const escapeName = '\x67\x72\x6f\x71'; // 'groq' in hex
      expect(() => AIProviderFactory.create(escapeName))
        .toThrow('Unsupported AI provider: groq. Supported providers: groq, ollama');
    });

    it('should handle provider names with control characters', () => {
      const controlName = 'groq\x00\x01\x02';
      expect(() => AIProviderFactory.create(controlName))
        .toThrow('Unsupported AI provider: groq\u0000\u0001\u0002. Supported providers: groq, ollama');
    });

    it('should handle provider names with surrogate pairs', () => {
      const surrogateName = 'groq\ud83d\ude00'; // 'groq' + emoji
      expect(() => AIProviderFactory.create(surrogateName))
        .toThrow('Unsupported AI provider: groq😀. Supported providers: groq, ollama');
    });

    it('should handle provider names with combining characters', () => {
      const combiningName = 'gröq'; // 'g' + 'r' + 'ö' + 'q'
      expect(() => AIProviderFactory.create(combiningName))
        .toThrow('Unsupported AI provider: gr\u00f6q. Supported providers: groq, ollama');
    });

    it('should handle provider names with zero-width joiners', () => {
      const zwjName = 'g\u200dr\u200dq\u200d'; // 'g' + ZWJ + 'r' + ZWJ + 'o' + ZWJ + 'q' + ZWJ
      expect(() => AIProviderFactory.create(zwjName))
        .toThrow('Unsupported AI provider: g\u200dr\u200dq\u200d. Supported providers: groq, ollama');
    });
  });
});