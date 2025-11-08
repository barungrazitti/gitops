/**
 * Unit tests for OllamaProvider class
 */

// Mock all dependencies before requiring
jest.mock('../src/providers/base-provider');
jest.mock('../src/core/config-manager');
jest.mock('axios');

const OllamaProvider = require('../src/providers/ollama-provider');
const BaseProvider = require('../src/providers/base-provider');
const ConfigManager = require('../src/core/config-manager');
const axios = require('axios');

describe('OllamaProvider', () => {
  let ollamaProvider;
  let mockConfigManager;
  let mockAxios;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock config manager
    mockConfigManager = {
      get: jest.fn(),
    };
    ConfigManager.mockImplementation(() => mockConfigManager);

    // Setup mock axios
    mockAxios = {
      post: jest.fn(),
      create: jest.fn(() => ({
        post: jest.fn(),
      })),
    };

    // Create provider instance
    ollamaProvider = new OllamaProvider();
    ollamaProvider.axios = mockAxios;
  });

  describe('constructor', () => {
    it('should initialize with correct name', () => {
      expect(ollamaProvider.name).toBe('ollama');
    });

    it('should extend BaseProvider', () => {
      expect(ollamaProvider).toBeInstanceOf(BaseProvider);
    });
  });

  describe('generateCommitMessages', () => {
    beforeEach(() => {
      // Mock the getConfig method directly
      jest.spyOn(ollamaProvider, 'getConfig').mockResolvedValue({
        model: 'codellama',
        url: 'http://localhost:11434',
        temperature: 0.3,
        timeout: 120000,
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should generate commit messages successfully', async () => {
      const diff = 'test diff';
      const mockResponse = {
        data: {
          response: `feat: add new feature
fix: fix bug
docs: update readme`,
        },
      };

      mockAxios.post.mockResolvedValue(mockResponse);

      const result = await ollamaProvider.generateCommitMessages(diff);

      expect(result).toEqual([
        'feat: add new feature',
        'fix: fix bug', 
        'docs: update readme'
      ]);
      expect(mockAxios.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          model: 'qwen2.5-coder:latest',
          prompt: expect.stringContaining(diff),
        })
      );
    });

    it('should handle empty response', async () => {
      const diff = 'test diff';
      const mockResponse = {
        data: { response: '' },
      };

      mockAxios.post.mockResolvedValue(mockResponse);

      await expect(ollamaProvider.generateCommitMessages(diff))
        .rejects.toThrow('No valid commit messages found in AI response');
    });

    it('should handle API errors', async () => {
      const diff = 'test diff';
      const error = new Error('API error');
      
      mockAxios.post.mockRejectedValue(error);

      await expect(ollamaProvider.generateCommitMessages(diff))
        .rejects.toThrow('API error');
    });

    it('should use custom model when specified', async () => {
      const diff = 'test diff';
      const options = { model: 'llama2' };
      const mockResponse = {
        data: { response: 'feat: add feature' },
      };

      mockAxios.post.mockResolvedValue(mockResponse);

      await ollamaProvider.generateCommitMessages(diff, options);

      expect(mockAxios.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          model: 'llama2',
        })
      );
    });

    it('should handle response parsing correctly', async () => {
      const diff = 'test diff';
      const mockResponse = {
        data: {
          response: `1. feat: add feature
- fix: fix bug
* docs: update readme`,
        },
      };

      mockAxios.post.mockResolvedValue(mockResponse);

      const result = await ollamaProvider.generateCommitMessages(diff);

      expect(result).toEqual([
        'feat: add feature',
        'fix: fix bug', 
        'docs: update readme'
      ]);
    });
  });

  describe('generateResponse', () => {
    beforeEach(() => {
      mockConfigManager.getProviderConfig = jest.fn().mockResolvedValue({
        model: 'codellama',
        url: 'http://localhost:11434',
        temperature: 0.3,
        timeout: 60000,
      });
    });

    it('should generate response successfully', async () => {
      const prompt = 'test prompt';
      const mockResponse = {
        data: { response: 'test response' },
      };

      mockAxios.post.mockResolvedValue(mockResponse);

      const result = await ollamaProvider.generateResponse(prompt);

      expect(result).toEqual(['test response']);
      expect(mockAxios.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          model: 'deepseek-v3.1:671b-cloud',
          prompt: expect.stringContaining(prompt),
        })
      );
    });

    it('should use custom options when provided', async () => {
      const prompt = 'test prompt';
      const options = { model: 'llama2', temperature: 0.8 };
      const mockResponse = {
        data: { response: 'test response' },
      };

      mockAxios.post.mockResolvedValue(mockResponse);

      await ollamaProvider.generateResponse(prompt, options);

      expect(mockAxios.post).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          model: 'llama2',
          prompt: expect.stringContaining(prompt),
        })
      );
    });
  });

  describe('validate', () => {
    it('should validate Ollama server availability', async () => {
      mockAxios.get = jest.fn().mockResolvedValue({ data: {} });

      const result = await ollamaProvider.validate({});

      expect(result).toBe(true);
      expect(mockAxios.get).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        { timeout: 5000 }
      );
    });

    it('should handle server unavailable', async () => {
      mockAxios.get = jest.fn().mockRejectedValue(new Error('Connection refused'));

      await expect(ollamaProvider.validate({}))
        .rejects.toThrow('Ollama is not running. Please start Ollama service.');
    });
  });

  describe('test', () => {
    it('should test connection and model availability', async () => {
      const config = { model: 'codellama' };
      const mockTagsResponse = {
        data: {
          models: [
            { name: 'codellama' },
            { name: 'llama2' }
          ]
        }
      };
      const mockGenerateResponse = {
        data: { response: 'test successful' }
      };

      mockAxios.get = jest.fn().mockResolvedValue(mockTagsResponse);
      mockAxios.post = jest.fn().mockResolvedValue(mockGenerateResponse);

      const result = await ollamaProvider.test(config);

      expect(result.success).toBe(true);
      expect(mockAxios.get).toHaveBeenCalled();
      expect(mockAxios.post).toHaveBeenCalled();
    });

    it('should handle missing model', async () => {
      const config = { model: 'missing-model' };
      const mockTagsResponse = {
        data: {
          models: [
            { name: 'codellama' },
            { name: 'llama2' }
          ]
        }
      };

      mockAxios.get = jest.fn().mockResolvedValue(mockTagsResponse);

      const result = await ollamaProvider.test(config);

      expect(result.success).toBe(false);
      expect(result.message).toContain('missing-model');
    });
  });

  describe('getConfig', () => {
    it('should get Ollama provider config', async () => {
      const expectedConfig = {
        url: 'http://localhost:11434',
        model: 'codellama',
        temperature: 0.3,
      };

      mockConfigManager.getProviderConfig = jest.fn().mockResolvedValue(expectedConfig);

      const config = await ollamaProvider.getConfig();

      expect(config).toEqual(expectedConfig);
      expect(mockConfigManager.getProviderConfig).toHaveBeenCalledWith('ollama');
    });
  });

  describe('circuit breaker', () => {
    it('should initialize circuit breaker', () => {
      expect(ollamaProvider.circuitBreaker).toBeDefined();
      expect(ollamaProvider.circuitBreaker.failureThreshold).toBe(3);
    });
  });
});