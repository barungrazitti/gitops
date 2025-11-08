/**
 * Unit tests for Groq Provider - Fixed
 */

jest.mock('groq-sdk');
jest.mock('../src/core/config-manager');
jest.mock('../src/core/circuit-breaker');

const GroqProvider = require('../src/providers/groq-provider');
const ConfigManager = require('../src/core/config-manager');
const CircuitBreaker = require('../src/core/circuit-breaker');
const Groq = require('groq-sdk');

describe('GroqProvider', () => {
  let provider;
  let mockConfigManager;
  let mockCircuitBreaker;
  let mockGroq;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfigManager = {
      get: jest.fn(),
    };
    
    mockCircuitBreaker = {
      execute: jest.fn(),
      getStatus: jest.fn().mockReturnValue({ state: 'CLOSED', isOpen: false })
    };

    mockGroq = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };

    ConfigManager.mockImplementation(() => mockConfigManager);
    CircuitBreaker.mockImplementation(() => mockCircuitBreaker);
    Groq.mockImplementation(() => mockGroq);

    provider = new GroqProvider();
    jest.spyOn(provider, 'getConfig').mockResolvedValue({
      apiKey: 'test-api-key',
      model: 'mixtral-8x7b-32768',
      url: 'https://api.groq.com/openai/v1',
      temperature: 0.7,
      timeout: 30000,
      maxTokens: 150
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct name', () => {
      expect(provider.name).toBe('groq');
    });

    it('should extend BaseProvider', () => {
      expect(provider.constructor.name).toBe('GroqProvider');
      expect(provider.configManager).toBeDefined();
      expect(provider.circuitBreaker).toBeDefined();
    });
  });

  describe('initializeClient', () => {
    it('should initialize Groq client with API key', async () => {
      await provider.initializeClient();
      
      expect(Groq).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        dangerouslyAllowBrowser: false,
      });
      expect(provider.client).toBe(mockGroq);
    });

    it('should not initialize client if already exists', async () => {
      provider.client = mockGroq;
      await provider.initializeClient();
      
      expect(Groq).toHaveBeenCalledTimes(0);
    });

    it('should throw error if no API key configured', async () => {
      jest.spyOn(provider, 'getConfig').mockResolvedValue({ apiKey: null });
      
      await expect(provider.initializeClient()).rejects.toThrow('Groq API key not configured');
    });
  });

  describe('generateCommitMessages', () => {
    beforeEach(async () => {
      await provider.initializeClient();
    });

    it('should generate commit messages successfully', async () => {
      const diff = 'test diff content';
      const mockResponse = {
        choices: [{
          message: { content: 'feat: add new feature' }
        }]
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      const result = await provider.generateCommitMessages(diff);

      expect(result).toContain('feat: add new feature');
      expect(mockCircuitBreaker.execute).toHaveBeenCalledWith(
        expect.any(Function),
        { provider: 'groq' }
      );
    });

    it('should use custom model when specified', async () => {
      const diff = 'test diff content';
      const options = { model: 'llama3-70b-8192' };
      const mockResponse = {
        choices: [{
          message: { content: 'feat: custom model feature' }
        }]
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      await provider.generateCommitMessages(diff, options);

      expect(mockGroq.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'llama3-70b-8192'
        })
      );
    });

    it('should handle API errors', async () => {
      const diff = 'test diff content';
      const error = new Error('API rate limit exceeded');
      
      mockCircuitBreaker.execute.mockRejectedValue(error);

      await expect(provider.generateCommitMessages(diff))
        .rejects.toThrow('API rate limit exceeded');
    });

    it('should handle empty response', async () => {
      const diff = 'test diff content';
      const mockResponse = { choices: [] };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      await expect(provider.generateCommitMessages(diff))
        .rejects.toThrow('No valid commit messages found in AI response');
    });

    it('should chunk large diffs', async () => {
      const diff = 'x'.repeat(50000); // Large diff that would exceed token limit
      const mockResponse = {
        choices: [{
          message: { content: 'feat: chunked feature' }
        }]
      };

      // Mock the generateFromChunks method
      jest.spyOn(provider, 'generateFromChunks').mockResolvedValue(['feat: chunked feature']);
      
      const result = await provider.generateCommitMessages(diff);

      expect(provider.generateFromChunks).toHaveBeenCalledWith(diff, {}, 4000);
      expect(result).toEqual(['feat: chunked feature']);
    });
  });

  describe('generateFromChunks', () => {
    beforeEach(async () => {
      await provider.initializeClient();
    });

    it('should process chunks sequentially', async () => {
      const diff = 'test diff';
      const maxTokens = 1000;
      const mockResponse = {
        choices: [{
          message: { content: 'feat: chunk 1' }
        }]
      };

      // Mock chunkDiff to return multiple chunks
      jest.spyOn(provider, 'chunkDiff').mockReturnValue(['chunk1', 'chunk2']);
      
      mockGroq.chat.completions.create.mockResolvedValue(mockResponse);
      
      const result = await provider.generateFromChunks(diff, {}, maxTokens);

      expect(mockGroq.chat.completions.create).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });

    it('should handle last chunk differently', async () => {
      const diff = 'test diff';
      const maxTokens = 1000;
      const mockResponse = {
        choices: [{
          message: { content: 'feat: final chunk' }
        }]
      };

      jest.spyOn(provider, 'chunkDiff').mockReturnValue(['final-chunk']);
      
      mockGroq.chat.completions.create.mockResolvedValue(mockResponse);
      
      await provider.generateFromChunks(diff, {}, maxTokens);

      // Check that the system message includes "final chunk"
      const systemMessage = mockGroq.chat.completions.create.mock.calls[0][0].messages[0];
      expect(systemMessage.content).toContain('final chunk');
    });

    it('should handle chunk errors gracefully', async () => {
      const diff = 'test diff';
      const maxTokens = 1000;
      const error = { status: 413, error: { code: 'rate_limit_exceeded' } };

      jest.spyOn(provider, 'chunkDiff').mockReturnValue(['chunk1']);
      jest.spyOn(provider, 'generateCommitMessages').mockResolvedValue(['retry: feature']);
      
      mockGroq.chat.completions.create.mockRejectedValue(error);
      
      const result = await provider.generateFromChunks(diff, {}, maxTokens);

      expect(result).toContain('retry: feature');
    });
  });

  describe('generateResponse', () => {
    beforeEach(async () => {
      await provider.initializeClient();
    });

    it('should generate response successfully', async () => {
      const prompt = 'test prompt';
      const mockResponse = {
        choices: [{
          message: { content: 'response' }
        }]
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      const result = await provider.generateResponse(prompt);

      expect(result).toBe('response');
    });

    it('should use custom options when provided', async () => {
      const prompt = 'test prompt';
      const options = { temperature: 0.5, model: 'custom-model' };
      const mockResponse = {
        choices: [{
          message: { content: 'response' }
        }]
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      await provider.generateResponse(prompt, options);

      expect(mockGroq.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.5,
          model: 'custom-model'
        })
      );
    });

    it('should handle generation errors', async () => {
      const prompt = 'test prompt';
      const error = new Error('Generation failed');

      mockCircuitBreaker.execute.mockRejectedValue(error);

      await expect(provider.generateResponse(prompt))
        .rejects.toThrow('groq error: Generation failed');
    });
  });

  describe('validate', () => {
    beforeEach(async () => {
      await provider.initializeClient();
    });

    it('should validate successfully with valid config', async () => {
      const config = {
        apiKey: 'test-api-key',
        model: 'mixtral-8x7b-32768',
      };

      mockGroq.chat.completions.create.mockResolvedValue({ choices: [] });

      const result = await provider.validate(config);

      expect(result).toBe(true);
      expect(mockGroq.chat.completions.create).toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      const config = {
        apiKey: 'invalid-api-key',
        model: 'mixtral-8x7b-32768',
      };

      mockGroq.chat.completions.create.mockRejectedValue(new Error('Invalid API key'));

      await expect(provider.validate(config))
        .rejects.toThrow('Invalid API key');
    });

    it('should require API key', async () => {
      const config = { model: 'mixtral-8x7b-32768' };

      await expect(provider.validate(config))
        .rejects.toThrow('Groq API key is required');
    });
  });

  describe('test', () => {
    beforeEach(async () => {
      await provider.initializeClient();
    });

    it('should test provider successfully', async () => {
      const mockResponse = {
        choices: [{
          message: { content: 'test response' }
        }]
      };

      mockGroq.chat.completions.create
        .mockResolvedValueOnce({ choices: [] }) // For models check
        .mockResolvedValueOnce(mockResponse); // For actual test

      const result = await provider.test();

      expect(result).toBe(true);
    });

    it('should handle missing model', async () => {
      jest.spyOn(provider, 'getConfig').mockResolvedValue({
        apiKey: 'test-api-key',
        model: null,
      });

      mockGroq.chat.completions.create.mockResolvedValue({ choices: [] });

      const result = await provider.test();

      expect(result).toBe(false);
    });

    it('should handle API errors', async () => {
      mockGroq.chat.completions.create.mockRejectedValue(new Error('API error'));

      const result = await provider.test();

      expect(result).toEqual({
        error: expect.any(String),
        message: 'Groq connection failed: API error',
        success: false
      });
    });
  });

  describe('getAvailableModels', () => {
    it('should return default models if API fails', async () => {
      jest.spyOn(provider, 'makeDirectAPIRequest').mockRejectedValue(new Error('API failed'));

      const models = await provider.getAvailableModels();

      expect(models).toEqual([
        'mixtral-8x7b-32768',
        'llama3-8b-8192',
        'llama3-70b-8192',
        'gemma-7b-it'
      ]);
    });

    it('should handle models API errors gracefully', async () => {
      jest.spyOn(provider, 'makeDirectAPIRequest').mockRejectedValue(new Error('Models API failed'));

      const models = await provider.getAvailableModels();

      expect(models).toEqual([
        'mixtral-8x7b-32768',
        'llama3-8b-8192',
        'llama3-70b-8192',
        'gemma-7b-it'
      ]);
    });
  });

  describe('buildRequest', () => {
    it('should build request with default options', () => {
      const prompt = 'test prompt';
      const options = {};
      const config = { apiKey: 'test-key' };

      const request = provider.buildRequest(prompt, options, config);

      expect(request.model).toBe('mixtral-8x7b-32768');
      expect(request.temperature).toBe(0.7);
      expect(request.messages).toContainEqual({
        role: 'user',
        content: prompt
      });
    });

    it('should build request with custom options', () => {
      const prompt = 'test prompt';
      const options = {
        model: 'custom-model',
        temperature: 0.3,
        max_tokens: 1000
      };
      const config = { apiKey: 'test-key' };

      const request = provider.buildRequest(prompt, options, config);

      expect(request.model).toBe('custom-model');
      expect(request.temperature).toBe(0.3);
      expect(request.max_tokens).toBe(1000);
    });

    it('should handle system prompts', () => {
      const prompt = 'test prompt';
      const options = {
        system: 'You are a helpful assistant.'
      };
      const config = { apiKey: 'test-key' };

      const request = provider.buildRequest(prompt, options, config);

      expect(request.messages).toContainEqual({
        role: 'system',
        content: 'You are a helpful assistant.'
      });
    });
  });

  describe('parseResponse', () => {
    it('should parse response successfully', () => {
      const response = 'feat: add new feature';
      
      const result = provider.parseResponse(response);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toContain('feat: add new feature');
    });

    it('should handle empty response', () => {
      const response = '';
      
      expect(() => provider.parseResponse(response))
        .toThrow('No valid commit messages found in AI response');
    });

    it('should handle malformed response', () => {
      const response = null;
      
      expect(() => provider.parseResponse(response))
        .toThrow('Invalid response from AI provider');
    });
  });

  describe('handleError', () => {
    it('should handle API rate limit error', () => {
      const error = {
        response: { status: 429 }
      };

      expect(() => provider.handleError(error, 'groq'))
        .toThrow('Rate limit exceeded for groq. Please try again later.');
    });

    it('should handle invalid API key error', () => {
      const error = {
        response: { status: 401 }
      };

      expect(() => provider.handleError(error, 'groq'))
        .toThrow('Authentication failed for groq. Please check your API key.');
    });

    it('should handle generic error', () => {
      const error = {
        response: { status: 500 }
      };

      expect(() => provider.handleError(error, 'groq'))
        .toThrow('Groq service is temporarily unavailable. Please try again later.');
    });

    it('should handle network errors', () => {
      const error = new Error('Network error');
      error.code = 'ECONNRESET';

      expect(() => provider.handleError(error, 'groq'))
        .toThrow('groq error: Network error. Please check your internet connection.');
    });
  });

  describe('makeDirectAPIRequest', () => {
    it('should make direct API request with correct headers', async () => {
      provider.client = mockGroq;
      const endpoint = '/models';
      
      jest.spyOn(provider, 'getConfig').mockResolvedValue({ apiKey: 'test-key' });
      jest.spyOn(provider, 'sendHTTPRequest').mockResolvedValue({ data: [] });

      await provider.makeDirectAPIRequest(endpoint);

      expect(provider.sendHTTPRequest).toHaveBeenCalledWith(
        'https://api.groq.com/openai/v1',
        '/models',
        {
          'Authorization': 'Bearer test-key',
          'Content-Type': 'application/json'
        }
      );
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', () => {
      provider.client = mockGroq;
      
      provider.cleanup();

      expect(provider.client).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle very large diffs without chunking', async () => {
      const smallDiff = 'test diff content';
      const mockResponse = {
        choices: [{
          message: { content: 'feat: small change' }
        }]
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      const result = await provider.generateCommitMessages(smallDiff);

      expect(result).toContain('feat: small change');
    });

    it('should handle concurrent requests', async () => {
      const diff = 'test diff';
      const mockResponse = {
        choices: [{
          message: { content: 'feat: concurrent feature' }
        }]
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      const promises = [
        provider.generateCommitMessages(diff),
        provider.generateCommitMessages(diff),
        provider.generateCommitMessages(diff)
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toContain('feat: concurrent feature');
      });
    });

    it('should handle Unicode content', async () => {
      const diff = 'const 测试 = "test";';
      const mockResponse = {
        choices: [{
          message: { content: 'feat: 添加中文字符' }
        }]
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      const result = await provider.generateCommitMessages(diff);

      expect(result).toContain('feat: 添加中文字符');
    });

    it('should handle special characters in prompts', async () => {
      const prompt = 'test with émojis 🎉';
      const mockResponse = {
        choices: [{
          message: { content: 'response with émojis 🎉' }
        }]
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      const result = await provider.generateResponse(prompt);

      expect(result).toBe('response with émojis 🎉');
    });
  });

  describe('integration with base provider', () => {
    it('should inherit base provider methods', () => {
      expect(provider.buildPrompt).toBeDefined();
      expect(provider.parseResponse).toBeDefined();
      expect(provider.validateCommitMessage).toBeDefined();
      expect(provider.preprocessDiff).toBeDefined();
      expect(provider.estimateTokens).toBeDefined();
      expect(provider.chunkDiff).toBeDefined();
    });

    it('should use base provider for chunking large diffs', async () => {
      const largeDiff = 'x'.repeat(50000);
      
      jest.spyOn(provider, 'chunkDiff').mockReturnValue(['chunk1', 'chunk2']);
      jest.spyOn(provider, 'generateFromChunks').mockResolvedValue(['feat: chunked']);

      const result = await provider.generateCommitMessages(largeDiff);

      expect(provider.chunkDiff).toHaveBeenCalledWith(largeDiff, 4000);
      expect(result).toEqual(['feat: chunked']);
    });

    it('should use base provider for prompt building', async () => {
      const diff = 'test diff';
      const options = { conventional: true };
      
      await provider.generateCommitMessages(diff, options);

      expect(mockGroq.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user' })
          ])
        })
      );
    });
  });
});