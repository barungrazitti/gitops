/**
 * Unit tests for OllamaProvider
 */

describe('OllamaProvider', () => {
  let OllamaProvider;
  let provider;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    
    jest.mock('axios');
    jest.mock('../src/core/config-manager', () => {
      return jest.fn().mockImplementation(() => ({
        get: jest.fn().mockReturnValue('test-host'),
        getProviderConfig: jest.fn().mockResolvedValue({
          url: 'http://localhost:11434',
          model: 'qwen2.5-coder:latest',
          temperature: 0.3,
        })
      }));
    });
    jest.mock('../src/core/circuit-breaker', () => {
      return jest.fn().mockImplementation(() => ({
        execute: jest.fn(),
        getStatus: jest.fn().mockReturnValue({ state: 'CLOSED' })
      }));
    });
    
    const axios = require('axios');
    
    OllamaProvider = require('../src/providers/ollama-provider');
    provider = new OllamaProvider();
  });

  describe('constructor', () => {
    it('should initialize with correct name', () => {
      expect(provider.name).toBe('ollama');
    });

    it('should set default base URL', () => {
      expect(provider.baseURL).toBe('http://localhost:11434');
    });

    it('should initialize circuit breaker', () => {
      expect(provider.circuitBreaker).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should return true when Ollama is running', async () => {
      const axios = require('axios');
      axios.get.mockResolvedValue({ data: {} });
      
      const result = await provider.validate({});
      expect(result).toBe(true);
    });

    it('should throw error when not running', async () => {
      const axios = require('axios');
      axios.get.mockRejectedValue(new Error('Connection refused'));
      
      await expect(provider.validate({}))
        .rejects.toThrow('Ollama is not running');
    });
  });

  describe('test', () => {
    it('should return success when model is available', async () => {
      const axios = require('axios');
      axios.get.mockResolvedValue({
        data: { models: [{ name: 'deepseek-v3.1:671b-cloud' }] }
      });
      axios.post.mockResolvedValue({
        data: { response: 'test successful' }
      });
      
      const result = await provider.test({ model: 'deepseek-v3.1:671b-cloud' });
      expect(result.success).toBe(true);
    });

    it('should return failure when model not available', async () => {
      const axios = require('axios');
      axios.get.mockResolvedValue({
        data: { models: [{ name: 'other-model' }] }
      });
      
      const result = await provider.test({ model: 'missing-model' });
      expect(result.success).toBe(false);
    });

    it('should handle connection refused', async () => {
      const axios = require('axios');
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      axios.get.mockRejectedValue(error);
      
      const result = await provider.test({});
      expect(result.success).toBe(false);
    });
  });

  describe('generateCommitMessages', () => {
    it('should generate commit messages', async () => {
      const mockResponse = {
        data: { response: 'feat: add new feature' }
      };
      provider.circuitBreaker.execute.mockResolvedValue(mockResponse);
      
      const result = await provider.generateCommitMessages('test diff');
      expect(result).toBeDefined();
    });

    it('should throw error when no response content', async () => {
      provider.circuitBreaker.execute.mockResolvedValue({
        data: { response: null }
      });
      
      await expect(provider.generateCommitMessages('test diff'))
        .rejects.toThrow('No response content');
    });
  });

  describe('generateResponse', () => {
    it('should generate response', async () => {
      const mockResponse = {
        data: { response: 'Here is the fixed code' }
      };
      provider.circuitBreaker.execute.mockResolvedValue(mockResponse);
      
      const result = await provider.generateResponse('Fix this');
      expect(result).toBeDefined();
    });
  });

  describe('getAvailableModels', () => {
    it('should return models from API', async () => {
      const axios = require('axios');
      axios.get.mockResolvedValue({
        data: { models: [{ name: 'deepseek-v3.1:671b-cloud', size: 1000 }] }
      });
      
      const models = await provider.getAvailableModels();
      expect(Array.isArray(models)).toBe(true);
      expect(models[0]).toHaveProperty('id');
    });

    it('should return fallback models when API fails', async () => {
      const axios = require('axios');
      axios.get.mockRejectedValue(new Error('API failed'));
      
      const models = await provider.getAvailableModels();
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe('getModelDescription', () => {
    it('should return description for known model', () => {
      const desc = provider.getModelDescription('deepseek-v3.1:671b-cloud');
      expect(desc).toContain('Large language model');
    });

    it('should return generic description for unknown model', () => {
      const desc = provider.getModelDescription('unknown-model:latest');
      expect(desc).toContain('AI model');
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', () => {
      provider.client = {};
      provider.cleanup();
      expect(provider.client).toBeNull();
    });
  });
});
