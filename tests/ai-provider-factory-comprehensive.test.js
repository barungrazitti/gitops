/**
 * Comprehensive Tests for AI Provider Factory
 */

const AIProviderFactory = require('../src/providers/ai-provider-factory');
const GroqProvider = require('../src/providers/groq-provider');
const OllamaProvider = require('../src/providers/ollama-provider');

jest.mock('../src/providers/groq-provider');
jest.mock('../src/providers/ollama-provider');

describe('AIProviderFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    test('should create Groq provider', () => {
      const mockConfig = { apiKey: 'test-key', model: 'mixtral-8x7b-32768' };
      GroqProvider.mockImplementation(() => ({ name: 'groq', config: mockConfig }));

      const provider = AIProviderFactory.create('groq', mockConfig);

      expect(GroqProvider).toHaveBeenCalledWith(mockConfig);
      expect(provider).toEqual({ name: 'groq', config: mockConfig });
    });

    test('should create Ollama provider', () => {
      const mockConfig = { model: 'deepseek-coder', baseUrl: 'http://localhost:11434' };
      OllamaProvider.mockImplementation(() => ({ name: 'ollama', config: mockConfig }));

      const provider = AIProviderFactory.create('ollama', mockConfig);

      expect(OllamaProvider).toHaveBeenCalledWith(mockConfig);
      expect(provider).toEqual({ name: 'ollama', config: mockConfig });
    });

    test('should throw error for unsupported provider', () => {
      expect(() => {
        AIProviderFactory.create('unsupported');
      }).toThrow('Unsupported AI provider: unsupported');
    });

    test('should use default config for Groq', () => {
      const defaultConfig = { apiKey: 'default-key', model: 'mixtral-8x7b-32768' };
      GroqProvider.mockImplementation(() => ({ name: 'groq', config: defaultConfig }));

      AIProviderFactory.create('groq');

      expect(GroqProvider).toHaveBeenCalledWith(defaultConfig);
    });

    test('should use default config for Ollama', () => {
      const defaultConfig = { model: 'deepseek-coder', baseUrl: 'http://localhost:11434' };
      OllamaProvider.mockImplementation(() => ({ name: 'ollama', config: defaultConfig }));

      AIProviderFactory.create('ollama');

      expect(OllamaProvider).toHaveBeenCalledWith(defaultConfig);
    });
  });

  describe('getSupportedProviders', () => {
    test('should return list of supported providers', () => {
      const providers = AIProviderFactory.getSupportedProviders();

      expect(providers).toEqual(['groq', 'ollama']);
      expect(providers).toHaveLength(2);
    });
  });

  describe('isSupported', () => {
    test('should return true for supported providers', () => {
      expect(AIProviderFactory.isSupported('groq')).toBe(true);
      expect(AIProviderFactory.isSupported('ollama')).toBe(true);
    });

    test('should return false for unsupported providers', () => {
      expect(AIProviderFactory.isSupported('openai')).toBe(false);
      expect(AIProviderFactory.isSupported('anthropic')).toBe(false);
      expect(AIProviderFactory.isSupported('')).toBe(false);
      expect(AIProviderFactory.isSupported(null)).toBe(false);
    });
  });

  describe('getDefaultConfig', () => {
    test('should return default config for Groq', () => {
      const config = AIProviderFactory.getDefaultConfig('groq');

      expect(config).toEqual({
        apiKey: '',
        model: 'mixtral-8x7b-32768',
        maxTokens: 4096,
        temperature: 0.7
      });
    });

    test('should return default config for Ollama', () => {
      const config = AIProviderFactory.getDefaultConfig('ollama');

      expect(config).toEqual({
        model: 'deepseek-coder',
        baseUrl: 'http://localhost:11434',
        maxTokens: 4096,
        temperature: 0.7,
        timeout: 30000
      });
    });

    test('should throw error for unsupported provider config', () => {
      expect(() => {
        AIProviderFactory.getDefaultConfig('unsupported');
      }).toThrow('Unsupported AI provider: unsupported');
    });
  });

  describe('validateConfig', () => {
    test('should validate valid Groq config', () => {
      const config = {
        apiKey: 'sk-test-key',
        model: 'mixtral-8x7b-32768',
        maxTokens: 4096,
        temperature: 0.7
      };

      expect(() => AIProviderFactory.validateConfig('groq', config)).not.toThrow();
    });

    test('should validate valid Ollama config', () => {
      const config = {
        model: 'deepseek-coder',
        baseUrl: 'http://localhost:11434',
        maxTokens: 4096,
        temperature: 0.7,
        timeout: 30000
      };

      expect(() => AIProviderFactory.validateConfig('ollama', config)).not.toThrow();
    });

    test('should reject invalid Groq config', () => {
      const invalidConfigs = [
        { apiKey: '', model: 'mixtral-8x7b-32768' }, // empty API key
        { apiKey: 'sk-test', model: '' }, // empty model
        { apiKey: 'sk-test', model: 'mixtral', maxTokens: -1 }, // negative max tokens
        { apiKey: 'sk-test', model: 'mixtral', temperature: 2 }, // temperature > 1
        { apiKey: 'sk-test', model: 'mixtral', temperature: -1 } // negative temperature
      ];

      invalidConfigs.forEach(config => {
        expect(() => {
          AIProviderFactory.validateConfig('groq', config);
        }).toThrow();
      });
    });

    test('should reject invalid Ollama config', () => {
      const invalidConfigs = [
        { model: '', baseUrl: 'http://localhost:11434' }, // empty model
        { model: 'deepseek', baseUrl: '' }, // empty base URL
        { model: 'deepseek', baseUrl: 'invalid-url' }, // invalid URL
        { model: 'deepseek', baseUrl: 'http://localhost:11434', maxTokens: -1 }, // negative max tokens
        { model: 'deepseek', baseUrl: 'http://localhost:11434', timeout: -1 } // negative timeout
      ];

      invalidConfigs.forEach(config => {
        expect(() => {
          AIProviderFactory.validateConfig('ollama', config);
        }).toThrow();
      });
    });

    test('should throw error for unsupported provider validation', () => {
      expect(() => {
        AIProviderFactory.validateConfig('unsupported', {});
      }).toThrow('Unsupported AI provider: unsupported');
    });
  });

  describe('getAvailableModels', () => {
    test('should return Groq models', () => {
      const models = AIProviderFactory.getAvailableModels('groq');

      expect(models).toContain('mixtral-8x7b-32768');
      expect(models).toContain('llama3-70b-8192');
      expect(models).toContain('gemma-7b-it');
    });

    test('should return Ollama models', () => {
      const models = AIProviderFactory.getAvailableModels('ollama');

      expect(models).toContain('deepseek-coder');
      expect(models).toContain('qwen2.5-coder');
      expect(models).toContain('mistral');
      expect(models).toContain('llama3');
    });

    test('should throw error for unsupported provider models', () => {
      expect(() => {
        AIProviderFactory.getAvailableModels('unsupported');
      }).toThrow('Unsupported AI provider: unsupported');
    });
  });

  describe('provider capabilities', () => {
    test('should return Groq capabilities', () => {
      const capabilities = AIProviderFactory.getProviderCapabilities('groq');

      expect(capabilities).toEqual({
        supportsStreaming: true,
        supportsSystemMessages: true,
        maxTokens: 8192,
        supportedFormats: ['text'],
        pricing: { model: 'per-token', input: 0.0000005, output: 0.0000015 }
      });
    });

    test('should return Ollama capabilities', () => {
      const capabilities = AIProviderFactory.getProviderCapabilities('ollama');

      expect(capabilities).toEqual({
        supportsStreaming: false,
        supportsSystemMessages: true,
        maxTokens: 4096,
        supportedFormats: ['text'],
        pricing: { model: 'free' }
      });
    });

    test('should throw error for unsupported provider capabilities', () => {
      expect(() => {
        AIProviderFactory.getProviderCapabilities('unsupported');
      }).toThrow('Unsupported AI provider: unsupported');
    });
  });
});