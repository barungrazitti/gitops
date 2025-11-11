/**
 * Comprehensive Tests for Groq Provider
 */

const GroqProvider = require('../src/providers/groq-provider');
const axios = require('axios');

jest.mock('axios');

describe('GroqProvider', () => {
  let provider;
  const mockConfig = {
    apiKey: 'sk-test-key',
    model: 'mixtral-8x7b-32768',
    maxTokens: 4096,
    temperature: 0.7
  };

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new GroqProvider(mockConfig);
  });

  describe('constructor', () => {
    test('should initialize with config', () => {
      expect(provider.config).toEqual(mockConfig);
      expect(provider.name).toBe('groq');
    });

    test('should use default config if none provided', () => {
      const defaultProvider = new GroqProvider();
      expect(defaultProvider.config.apiKey).toBe('');
      expect(defaultProvider.config.model).toBe('mixtral-8x7b-32768');
    });
  });

  describe('generateCommitMessages', () => {
    test('should generate commit messages successfully', async () => {
      const diff = 'diff --git a/file.js b/file.js\n+ new content';
      const mockResponse = {
        data: {
          choices: [{
            message: {
              content: 'feat: add new feature\nfix: resolve bug\ndocs: update documentation'
            }
          }]
        }
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await provider.generateCommitMessages(diff);

      expect(result).toEqual([
        'feat: add new feature',
        'fix: resolve bug',
        'docs: update documentation'
      ]);
      expect(axios.post).toHaveBeenCalledWith(
        'https://api.groq.com/openai/v1/chat/completions',
        expect.objectContaining({
          model: mockConfig.model,
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('commit message')
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining(diff)
            })
          ]),
          max_tokens: mockConfig.maxTokens,
          temperature: mockConfig.temperature
        }),
        expect.objectContaining({
          headers: {
            'Authorization': `Bearer ${mockConfig.apiKey}`,
            'Content-Type': 'application/json'
          }
        })
      );
    });

    test('should handle API errors', async () => {
      const diff = 'test diff';
      const error = new Error('API Error');
      error.response = { status: 401, data: { error: 'Invalid API key' } };
      axios.post.mockRejectedValue(error);

      await expect(provider.generateCommitMessages(diff)).rejects.toThrow('Failed to generate commit messages with Groq');
    });

    test('should handle empty response', async () => {
      const diff = 'test diff';
      axios.post.mockResolvedValue({ data: { choices: [] } });

      const result = await provider.generateCommitMessages(diff);

      expect(result).toEqual([]);
    });

    test('should handle malformed response', async () => {
      const diff = 'test diff';
      axios.post.mockResolvedValue({ data: { choices: [{ message: {} }] } });

      const result = await provider.generateCommitMessages(diff);

      expect(result).toEqual([]);
    });
  });

  describe('buildPrompt', () => {
    test('should build prompt with default options', () => {
      const diff = 'test diff';
      const options = {};

      const prompt = provider.buildPrompt(diff, options);

      expect(prompt).toContain('system');
      expect(prompt).toContain('user');
      expect(prompt).toContain(diff);
      expect(prompt).toContain('commit message');
    });

    test('should build prompt with custom options', () => {
      const diff = 'test diff';
      const options = {
        count: 5,
        language: 'es',
        conventional: true,
        context: { projectType: 'react' }
      };

      const prompt = provider.buildPrompt(diff, options);

      expect(prompt).toContain('5');
      expect(prompt).toContain('español');
      expect(prompt).toContain('conventional');
      expect(prompt).toContain('react');
    });

    test('should handle chunk context', () => {
      const diff = 'chunk diff';
      const options = {
        chunkIndex: 1,
        totalChunks: 3,
        chunkContext: 'middle'
      };

      const prompt = provider.buildPrompt(diff, options);

      expect(prompt).toContain('chunk 1 of 3');
      expect(prompt).toContain('middle');
    });
  });

  describe('validateConfig', () => {
    test('should validate valid config', () => {
      expect(() => provider.validateConfig(mockConfig)).not.toThrow();
    });

    test('should reject config without API key', () => {
      const invalidConfig = { ...mockConfig, apiKey: '' };
      expect(() => provider.validateConfig(invalidConfig)).toThrow('API key is required');
    });

    test('should reject config with invalid model', () => {
      const invalidConfig = { ...mockConfig, model: '' };
      expect(() => provider.validateConfig(invalidConfig)).toThrow('Model is required');
    });

    test('should reject config with invalid max tokens', () => {
      const invalidConfig = { ...mockConfig, maxTokens: -1 };
      expect(() => provider.validateConfig(invalidConfig)).toThrow('Max tokens must be positive');
    });

    test('should reject config with invalid temperature', () => {
      const invalidConfigs = [
        { ...mockConfig, temperature: -1 },
        { ...mockConfig, temperature: 2 }
      ];
      invalidConfigs.forEach(config => {
        expect(() => provider.validateConfig(config)).toThrow('Temperature must be between 0 and 1');
      });
    });
  });

  describe('testConnection', () => {
    test('should test connection successfully', async () => {
      const mockResponse = {
        data: {
          choices: [{
            message: { content: 'Connection test successful' }
          }]
        }
      };
      axios.post.mockResolvedValue(mockResponse);

      const result = await provider.testConnection();

      expect(result).toBe(true);
      expect(axios.post).toHaveBeenCalled();
    });

    test('should handle connection test failure', async () => {
      const error = new Error('Connection failed');
      axios.post.mockRejectedValue(error);

      const result = await provider.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('getModelInfo', () => {
    test('should return model information', () => {
      const modelInfo = provider.getModelInfo();

      expect(modelInfo).toEqual({
        name: mockConfig.model,
        provider: 'groq',
        maxTokens: mockConfig.maxTokens,
        supportsStreaming: true,
        pricing: { model: 'per-token', input: 0.0000005, output: 0.0000015 }
      });
    });
  });

  describe('estimateTokens', () => {
    test('should estimate tokens for text', () => {
      const text = 'This is a test message for token estimation';
      const tokens = provider.estimateTokens(text);

      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe('number');
    });

    test('should handle empty text', () => {
      const tokens = provider.estimateTokens('');

      expect(tokens).toBe(0);
    });

    test('should handle long text', () => {
      const longText = 'word '.repeat(1000);
      const tokens = provider.estimateTokens(longText);

      expect(tokens).toBeGreaterThan(500); // Rough estimate
    });
  });

  describe('formatResponse', () => {
    test('should format API response correctly', () => {
      const apiResponse = {
        data: {
          choices: [{
            message: {
              content: 'feat: add feature\nfix: resolve bug'
            }
          }]
        }
      };

      const formatted = provider.formatResponse(apiResponse);

      expect(formatted).toEqual(['feat: add feature', 'fix: resolve bug']);
    });

    test('should handle empty choices', () => {
      const apiResponse = { data: { choices: [] } };

      const formatted = provider.formatResponse(apiResponse);

      expect(formatted).toEqual([]);
    });

    test('should handle missing content', () => {
      const apiResponse = {
        data: {
          choices: [{
            message: {}
          }]
        }
      };

      const formatted = provider.formatResponse(apiResponse);

      expect(formatted).toEqual([]);
    });
  });

  describe('error handling', () => {
    test('should handle rate limit errors', async () => {
      const error = new Error('Rate limit exceeded');
      error.response = { status: 429 };
      axios.post.mockRejectedValue(error);

      await expect(provider.generateCommitMessages('test')).rejects.toThrow('Rate limit exceeded');
    });

    test('should handle invalid API key errors', async () => {
      const error = new Error('Invalid API key');
      error.response = { status: 401 };
      axios.post.mockRejectedValue(error);

      await expect(provider.generateCommitMessages('test')).rejects.toThrow('Invalid API key');
    });

    test('should handle model not found errors', async () => {
      const error = new Error('Model not found');
      error.response = { status: 404 };
      axios.post.mockRejectedValue(error);

      await expect(provider.generateCommitMessages('test')).rejects.toThrow('Model not found');
    });

    test('should handle timeout errors', async () => {
      const error = new Error('timeout of 30000ms exceeded');
      error.code = 'ECONNABORTED';
      axios.post.mockRejectedValue(error);

      await expect(provider.generateCommitMessages('test')).rejects.toThrow('Request timeout');
    });
  });
});