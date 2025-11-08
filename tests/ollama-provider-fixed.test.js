/**
 * Unit tests for Ollama Provider - Fixed
 */

jest.mock('axios');
jest.mock('../src/core/config-manager');
jest.mock('../src/core/circuit-breaker');

const OllamaProvider = require('../src/providers/ollama-provider');
const ConfigManager = require('../src/core/config-manager');
const CircuitBreaker = require('../src/core/circuit-breaker');
const axios = require('axios');

describe('OllamaProvider', () => {
  let provider;
  let mockConfigManager;
  let mockCircuitBreaker;
  let mockAxios;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfigManager = {
      get: jest.fn(),
    };
    
    mockCircuitBreaker = {
      execute: jest.fn(),
      getStatus: jest.fn().mockReturnValue({ state: 'CLOSED', isOpen: false })
    };

    mockAxios = {
      get: jest.fn(),
      post: jest.fn(),
    };

    ConfigManager.mockImplementation(() => mockConfigManager);
    CircuitBreaker.mockImplementation(() => mockCircuitBreaker);
    axios.get = mockAxios.get;
    axios.post = mockAxios.post;

    provider = new OllamaProvider();
    jest.spyOn(provider, 'getConfig').mockResolvedValue({
      model: 'qwen2.5-coder:latest',
      temperature: 0.3,
      timeout: 120000,
      maxTokens: 150
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct name', () => {
      expect(provider.name).toBe('ollama');
    });

    it('should set correct baseURL', () => {
      expect(provider.baseURL).toBe('http://localhost:11434');
    });

    it('should initialize circuit breaker', () => {
      expect(CircuitBreaker).toHaveBeenCalledWith({
        failureThreshold: 3,
        timeout: 120000,
        monitoringPeriod: 30000
      });
      expect(provider.circuitBreaker).toBeDefined();
    });
  });

  describe('generateCommitMessages', () => {
    it('should generate commit messages successfully', async () => {
      const diff = 'test diff content';
      const mockResponse = {
        data: {
          response: 'feat: add new feature\nfix: fix bug\ndocs: update readme'
        }
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      const result = await provider.generateCommitMessages(diff);

      expect(result).toEqual([
        'feat: add new feature',
        'fix: fix bug', 
        'docs: update readme'
      ]);
    });

    it('should handle empty response', async () => {
      const diff = 'test diff content';
      const mockResponse = { data: { response: '' } };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      await expect(provider.generateCommitMessages(diff))
        .rejects.toThrow('No valid commit messages found in AI response');
    });

    it('should handle API errors', async () => {
      const diff = 'test diff content';
      const error = new Error('API error');

      mockCircuitBreaker.execute.mockRejectedValue(error);

      await expect(provider.generateCommitMessages(diff))
        .rejects.toThrow('API error');
    });

    it('should use custom model when specified', async () => {
      const diff = 'test diff content';
      const options = { model: 'llama2' };
      const mockResponse = {
        data: {
          response: 'feat: custom model feature'
        }
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      await provider.generateCommitMessages(diff, options);

      expect(mockAxios.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          model: 'llama2'
        }),
        expect.any(Object)
      );
    });

    it('should handle response parsing correctly', async () => {
      const diff = 'test diff content';
      const mockResponse = {
        data: {
          response: '1. feat: add feature\n2. fix: bug\n3. docs: update'
        }
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      const result = await provider.generateCommitMessages(diff);

      expect(result).toHaveLength(3);
      expect(result[0]).toBe('feat: add feature');
    });
  });

  describe('generateResponse', () => {
    it('should generate response successfully', async () => {
      const prompt = 'test prompt';
      const mockResponse = {
        data: {
          response: 'response content'
        }
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      const result = await provider.generateResponse(prompt);

      expect(result).toEqual(['response content']);
    });

    it('should use custom options when provided', async () => {
      const prompt = 'test prompt';
      const options = { temperature: 0.5, model: 'llama2' };
      const mockResponse = {
        data: {
          response: 'custom response'
        }
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      await provider.generateResponse(prompt, options);

      expect(mockAxios.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          model: 'llama2',
          options: {
            temperature: 0.5,
            num_predict: 2000
          }
        }),
        expect.any(Object)
      );
    });
  });

  describe('validate', () => {
    it('should validate Ollama server availability', async () => {
      mockAxios.get.mockResolvedValue({ data: { models: [] } });

      const result = await provider.validate({});

      expect(result).toBe(true);
      expect(mockAxios.get).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        { timeout: 5000 }
      );
    });

    it('should handle server unavailable', async () => {
      mockAxios.get.mockRejectedValue(new Error('Connection refused'));

      await expect(provider.validate({}))
        .rejects.toThrow('Ollama is not running. Please start Ollama service.');
    });
  });

  describe('test', () => {
    it('should test connection and model availability', async () => {
      const config = { model: 'qwen2.5-coder:latest' };
      const tagsResponse = {
        data: {
          models: [
            { name: 'qwen2.5-coder:latest' },
            { name: 'other-model' }
          ]
        }
      };
      const generateResponse = {
        data: { response: 'test successful' }
      };

      mockAxios.get.mockResolvedValue(tagsResponse);
      mockAxios.post.mockResolvedValue(generateResponse);

      const result = await provider.test(config);

      expect(result.success).toBe(true);
      expect(result.model).toBe('qwen2.5-coder:latest');
      expect(result.availableModels).toEqual(['qwen2.5-coder:latest', 'other-model']);
    });

    it('should handle missing model', async () => {
      const config = { model: 'non-existent-model' };
      const tagsResponse = {
        data: {
          models: [{ name: 'available-model' }]
        }
      };

      mockAxios.get.mockResolvedValue(tagsResponse);

      const result = await provider.test(config);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Model "non-existent-model" not found');
    });

    it('should handle connection refused', async () => {
      const error = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      mockAxios.get.mockRejectedValue(error);

      const result = await provider.test({});

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });

  describe('getAvailableModels', () => {
    it('should return available models from API', async () => {
      const apiResponse = {
        data: {
          models: [
            { name: 'model1', size: 1000000, modified_at: '2023-01-01' },
            { name: 'model2', size: 2000000, modified_at: '2023-01-02' }
          ]
        }
      };

      mockAxios.get.mockResolvedValue(apiResponse);

      const models = await provider.getAvailableModels();

      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({
        id: 'model1',
        name: 'model1',
        description: expect.any(String),
        size: 1000000,
        modified: '2023-01-01',
        available: true,
        recommended: false
      });
    });

    it('should return default models when API fails', async () => {
      mockAxios.get.mockRejectedValue(new Error('API error'));

      const models = await provider.getAvailableModels();

      expect(models).toHaveLength(5);
      expect(models[0]).toEqual({
        id: 'deepseek-v3.1:671b-cloud',
        name: 'DeepSeek V3.1 (671B)',
        description: 'Large language model with advanced reasoning capabilities',
        available: true,
        recommended: true
      });
    });
  });

  describe('getModelDescription', () => {
    it('should return description for known model', () => {
      const description = provider.getModelDescription('deepseek-v3.1:671b-cloud');
      expect(description).toBe('Large language model with advanced reasoning capabilities (671B parameters)');
    });

    it('should return generic description for unknown model', () => {
      const description = provider.getModelDescription('unknown-model');
      expect(description).toBe('AI model: unknown-model');
    });
  });

  describe('formatSize', () => {
    it('should format bytes correctly', () => {
      expect(provider.formatSize(1024)).toBe('1.0 KB');
      expect(provider.formatSize(1048576)).toBe('1.0 MB');
      expect(provider.formatSize(1073741824)).toBe('1.0 GB');
    });

    it('should handle unknown size', () => {
      expect(provider.formatSize(null)).toBe('Unknown');
      expect(provider.formatSize(undefined)).toBe('Unknown');
    });

    it('should handle zero bytes', () => {
      expect(provider.formatSize(0)).toBe('0.0 B');
    });
  });

  describe('pullModel', () => {
    it('should pull model successfully', async () => {
      const modelName = 'test-model';

      mockAxios.post.mockResolvedValue({ data: {} });

      const result = await provider.pullModel(modelName);

      expect(result.success).toBe(true);
      expect(result.message).toContain('pulled successfully');
      expect(mockAxios.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/pull',
        { name: modelName },
        { timeout: 300000 }
      );
    });

    it('should handle pull failure', async () => {
      const modelName = 'test-model';
      mockAxios.post.mockRejectedValue(new Error('Network error'));

      const result = await provider.pullModel(modelName);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to pull model');
    });
  });

  describe('handleError', () => {
    it('should handle connection refused', () => {
      const error = new Error('Connection failed');
      error.code = 'ECONNREFUSED';

      expect(() => provider.handleError(error, 'ollama'))
        .toThrow('Ollama service is not running. Please start Ollama with "ollama serve".');
    });

    it('should handle 404 error', () => {
      const error = {
        response: { status: 404 }
      };

      expect(() => provider.handleError(error, 'ollama'))
        .toThrow('Model not found. Please pull the model first with "ollama pull <model-name>".');
    });

    it('should fall back to base error handling', () => {
      const error = new Error('Other error');

      expect(() => provider.handleError(error, 'ollama'))
        .toThrow('ollama error: Other error');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle circuit breaker open', async () => {
      const error = new Error('Circuit breaker is OPEN');
      mockCircuitBreaker.execute.mockRejectedValue(error);

      await expect(provider.generateCommitMessages('test diff'))
        .rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should handle timeout errors', async () => {
      const error = new Error('timeout');
      error.code = 'ECONNABORTED';
      mockCircuitBreaker.execute.mockRejectedValue(error);

      await expect(provider.generateCommitMessages('test diff'))
        .rejects.toThrow('timeout');
    });

    it('should handle malformed response', async () => {
      const mockResponse = { data: { response: 'invalid response without valid commits' } };
      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      await expect(provider.generateCommitMessages('test diff'))
        .rejects.toThrow('No valid commit messages found in AI response');
    });

    it('should handle very long responses', async () => {
      const longResponse = 'feat: ' + 'a'.repeat(1000);
      const mockResponse = { data: { response: longResponse } };
      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      const result = await provider.generateCommitMessages('test diff');
      expect(result[0]).toBe(longResponse);
    });

    it('should handle Unicode responses', async () => {
      const unicodeResponse = 'feat: 添加新功能\nfix: 修复错误';
      const mockResponse = { data: { response: unicodeResponse } };
      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      const result = await provider.generateCommitMessages('test diff');
      expect(result).toHaveLength(2);
      expect(result[0]).toBe('feat: 添加新功能');
    });
  });

  describe('integration with base provider', () => {
    it('should inherit base provider methods', () => {
      expect(provider.buildPrompt).toBeDefined();
      expect(provider.parseResponse).toBeDefined();
      expect(provider.validateCommitMessage).toBeDefined();
      expect(provider.preprocessDiff).toBeDefined();
    });

    it('should use base provider for prompt building', () => {
      const diff = 'test diff';
      const options = { conventional: true };
      
      expect(() => provider.buildPrompt(diff, options)).not.toThrow();
    });

    it('should use base provider for response parsing', () => {
      const response = 'feat: add feature\nfix: bug';
      
      const parsed = provider.parseResponse(response);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toContain('feat: add feature');
    });
  });

  describe('performance and reliability', () => {
    it('should use appropriate timeouts for different operations', async () => {
      const mockResponse = { data: { response: 'test' } };
      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      await provider.generateCommitMessages('test diff');
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ timeout: 120000 })
      );

      await provider.generateResponse('test prompt');
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ timeout: 60000 })
      );
    });

    it('should use circuit breaker for all API calls', async () => {
      const mockResponse = { data: { response: 'test' } };
      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      await provider.generateCommitMessages('test');
      await provider.generateResponse('test');
      await provider.test({});

      expect(mockCircuitBreaker.execute).toHaveBeenCalledTimes(3);
      expect(mockCircuitBreaker.execute).toHaveBeenCalledWith(
        expect.any(Function),
        { provider: 'ollama' }
      );
    });
  });
});