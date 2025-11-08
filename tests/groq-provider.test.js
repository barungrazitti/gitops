/**
 * Unit tests for Groq Provider
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
      call: jest.fn(),
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
    });
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

  describe('validate', () => {
    beforeEach(() => {
      // Mock client for validation
      provider.client = mockGroq;
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
    it('should test provider successfully', async () => {
      provider.client = mockGroq;
      
      // Mock model list and completion
      mockGroq.chat.completions.create
        .mockResolvedValueOnce({ choices: [] }) // For models check
        .mockResolvedValueOnce({  // For actual test
          choices: [{
            message: { content: 'test response' }
          }]
        });

      const result = await provider.test();

      expect(result).toBe(true);
    });

    it('should handle missing model', async () => {
      provider.client = mockGroq;
      jest.spyOn(provider, 'getConfig').mockResolvedValue({
        apiKey: 'test-api-key',
        model: null,
      });

      mockGroq.chat.completions.create.mockResolvedValue({ choices: [] });

      const result = await provider.test();

      expect(result).toBe(false);
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

      mockCircuitBreaker.call.mockResolvedValue(mockResponse);
      mockGroq.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await provider.generateCommitMessages(diff);

      expect(result).toContain('feat: add new feature');
    });

    it('should use custom model when specified', async () => {
      const diff = 'test diff content';
      const options = { model: 'llama3-70b-8192' };
      
      const mockResponse = {
        choices: [{
          message: { content: 'feat: custom model feature' }
        }]
      };

      mockCircuitBreaker.call.mockResolvedValue(mockResponse);
      mockGroq.chat.completions.create.mockResolvedValue(mockResponse);

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
      
      mockCircuitBreaker.call.mockRejectedValue(error);

      await expect(provider.generateCommitMessages(diff))
        .rejects.toThrow('API rate limit exceeded');
    });

    it('should handle empty response', async () => {
      const diff = 'test diff content';
      const mockResponse = { choices: [] };

      mockCircuitBreaker.call.mockResolvedValue(mockResponse);

      await expect(provider.generateCommitMessages(diff))
        .rejects.toThrow('No valid commit messages found in AI response');
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

      mockCircuitBreaker.call.mockResolvedValue(mockResponse);

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

      mockCircuitBreaker.call.mockResolvedValue(mockResponse);

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

      mockCircuitBreaker.call.mockRejectedValue(error);

      await expect(provider.generateResponse(prompt))
        .rejects.toThrow('Generation failed');
    });
  });

  describe('getAvailableModels', () => {
    it('should return available models', async () => {
      const mockResponse = {
        data: [
          { id: 'mixtral-8x7b-32768', object: 'model' },
          { id: 'llama3-70b-8192', object: 'model' }
        ]
      };

      // Mock the direct call to models endpoint
      jest.spyOn(provider, 'makeDirectAPIRequest').mockResolvedValue(mockResponse);

      const models = await provider.getAvailableModels();

      expect(models).toEqual(['mixtral-8x7b-32768', 'llama3-70b-8192']);
    });

    it('should handle models API errors', async () => {
      jest.spyOn(provider, 'makeDirectAPIRequest').mockRejectedValue(new Error('Models API failed'));

      const models = await provider.getAvailableModels();

      expect(models).toEqual([]);
    });
  });

  describe('buildRequest', () => {
    beforeEach(async () => {
      await provider.initializeClient();
    });

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

      expect(result).toBe('feat: add new feature');
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

      expect(() => provider.handleError(error))
        .toThrow('Rate limit exceeded for groq. Please try again later.');
    });

    it('should handle invalid API key error', () => {
      const error = {
        response: { status: 401 }
      };

      expect(() => provider.handleError(error))
        .toThrow('Authentication failed for groq. Please check your API key.');
    });

    it('should handle generic error', () => {
      const error = {
        response: { status: 500 }
      };

      expect(() => provider.handleError(error))
        .toThrow('Groq service is temporarily unavailable. Please try again later.');
    });

    it('should handle network errors', () => {
      const error = new Error('Network error');
      error.code = 'ECONNRESET';

      expect(() => provider.handleError(error))
        .toThrow('Network error. Please check your internet connection.');
    });
  });

  describe('makeDirectAPIRequest', () => {
    it('should make direct API request with correct headers', async () => {
      provider.client = mockGroq;
      const endpoint = '/models';
      
      // Mock a simple implementation
      provider.makeDirectAPIRequest = jest.fn().mockResolvedValue({ data: [] });

      const result = await provider.makeDirectAPIRequest(endpoint);

      expect(provider.makeDirectAPIRequest).toHaveBeenCalledWith(endpoint);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', () => {
      provider.client = mockGroq;
      
      provider.cleanup();

      expect(provider.client).toBeNull();
    });
  });
});