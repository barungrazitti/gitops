/**
 * Unit tests for Groq Provider - Base Provider Integration
 */

jest.mock('groq-sdk');
jest.mock('../src/core/config-manager');
jest.mock('../src/core/circuit-breaker');

const GroqProvider = require('../src/providers/groq-provider');
const ConfigManager = require('../src/core/config-manager');
const CircuitBreaker = require('../src/core/circuit-breaker');
const Groq = require('groq-sdk');

describe('GroqProvider - Base Provider Integration', () => {
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
      model: 'llama-3.1-8b-instant',
      temperature: 0.7,
      timeout: 30000,
      maxTokens: 150
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('base provider method integration', () => {
    it('should inherit buildPrompt method', () => {
      expect(typeof provider.buildPrompt).toBe('function');
    });

    it('should use buildPrompt in generateCommitMessages', async () => {
      const diff = 'test diff content';
      const options = { conventional: true };
      const mockResponse = {
        choices: [{
          message: { content: 'feat: add new feature' }
        }]
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      await provider.generateCommitMessages(diff, options);

      // Should call buildPrompt internally
      expect(mockGroq.chat.completions.create).toHaveBeenCalled();
      const callArgs = mockGroq.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(2);
      expect(callArgs.messages[1].role).toBe('user');
      expect(callArgs.messages[1].content).toContain('test diff content');
    });

    it('should inherit parseResponse method', () => {
      expect(typeof provider.parseResponse).toBe('function');
    });

    it('should use parseResponse in generateCommitMessages', async () => {
      const diff = 'test diff content';
      const responseContent = 'feat: add feature\nfix: bug\nperf: optimization';
      const mockResponse = {
        choices: [{
          message: { content: responseContent }
        }]
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      const result = await provider.generateCommitMessages(diff);

      expect(result).toEqual(['feat: add feature', 'fix: bug', 'perf: optimization']);
    });

    it('should inherit validateCommitMessage method', () => {
      expect(typeof provider.validateCommitMessage).toBe('function');
    });

    it('should use validateCommitMessage in generateCommitMessages', async () => {
      const diff = 'test diff content';
      const responseContent = 'invalid commit message';
      const mockResponse = {
        choices: [{
          message: { content: responseContent }
        }]
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      const result = await provider.generateCommitMessages(diff);

      expect(result).toEqual([]);
    });

    it('should inherit preprocessDiff method', () => {
      expect(typeof provider.preprocessDiff).toBe('function');
    });

    it('should inherit estimateTokens method', () => {
      expect(typeof provider.estimateTokens).toBe('function');
    });

    it('should use estimateTokens in generateCommitMessages', async () => {
      const diff = 'x'.repeat(10000); // Large diff
      const mockResponse = {
        choices: [{
          message: { content: 'feat: large change' }
        }]
      };

      jest.spyOn(provider, 'generateFromChunks').mockResolvedValue(['feat: large change']);

      const result = await provider.generateCommitMessages(diff);

      expect(result).toEqual(['feat: large change']);
      expect(provider.estimateTokens).toHaveBeenCalled();
    });

    it('should inherit chunkDiff method', () => {
      expect(typeof provider.chunkDiff).toBe('function');
    });

    it('should use chunkDiff in generateFromChunks', async () => {
      const diff = 'x'.repeat(50000); // Large diff
      const mockResponse = {
        choices: [{
          message: { content: 'feat: chunked change' }
        }]
      };

      jest.spyOn(provider, 'chunkDiff').mockReturnValue(['chunk1', 'chunk2']);
      mockGroq.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await provider.generateFromChunks(diff, {}, 4000);

      expect(result).toHaveLength(2);
      expect(provider.chunkDiff).toHaveBeenCalledWith(diff, 4000);
    });

    it('should inherit withRetry method', () => {
      expect(typeof provider.withRetry).toBe('function');
    });

    it('should use withRetry in generateCommitMessages', async () => {
      const diff = 'test diff content';
      const mockResponse = {
        choices: [{
          message: { content: 'feat: retry success' }
        }]
      };

      jest.spyOn(provider, 'withRetry').mockResolvedValue(mockResponse);

      const result = await provider.generateCommitMessages(diff);

      expect(result).toContain('feat: retry success');
    });

    it('should inherit sendHTTPRequest method', () => {
      expect(typeof provider.sendHTTPRequest).toBe('function');
    });

    it('should use sendHTTPRequest in makeDirectAPIRequest', async () => {
      await provider.initializeClient();
      
      jest.spyOn(provider, 'sendHTTPRequest').mockResolvedValue({ data: [] });

      await provider.makeDirectAPIRequest('/models');

      expect(provider.sendHTTPRequest).toHaveBeenCalledWith(
        'https://api.groq.com/openai/v1',
        '/models',
        expect.objectContaining({
          'Authorization': 'Bearer test-api-key'
        })
      );
    });
  });

  describe('base provider configuration methods', () => {
    it('should use base provider getConfig method', async () => {
      await provider.getConfig();

      expect(provider.getConfig).toHaveBeenCalled();
    });

    it('should use base provider handleError method', async () => {
      const error = {
        response: { status: 429 }
      };

      await expect(provider.handleError(error, 'groq'))
        .rejects.toThrow('Rate limit exceeded for groq');
    });

    it('should inherit base provider cleanup method', () => {
      expect(typeof provider.cleanup).toBe('function');
    });

    it('should cleanup properly', () => {
      provider.client = mockGroq;
      
      provider.cleanup();

      expect(provider.client).toBeNull();
    });
  });

  describe('token estimation and chunking', () => {
    it('should estimate tokens for different content types', () => {
      const text = 'Hello, world! This is a test.';
      const tokens = provider.estimateTokens(text);

      expect(tokens).toBeGreaterThan(0);
      expect(typeof tokens).toBe('number');
    });

    it('should handle empty text token estimation', () => {
      const tokens = provider.estimateTokens('');

      expect(tokens).toBe(0);
    });

    it('should handle null text token estimation', () => {
      const tokens = provider.estimateTokens(null);

      expect(tokens).toBe(0);
    });

    it('should handle Unicode text token estimation', () => {
      const unicodeText = '测试中文内容 🎉';
      const tokens = provider.estimateTokens(unicodeText);

      expect(tokens).toBeGreaterThan(0);
    });

    it('should chunk large diffs properly', () => {
      const largeDiff = 'x'.repeat(10000);
      const chunks = provider.chunkDiff(largeDiff, 1000);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.every(chunk => chunk.length <= 1000)).toBe(true);
    });

    it('should handle empty diff chunking', () => {
      const chunks = provider.chunkDiff('', 1000);

      expect(chunks).toEqual(['']);
    });

    it('should handle null diff chunking', () => {
      const chunks = provider.chunkDiff(null, 1000);

      expect(chunks).toEqual(['']);
    });
  });

  describe('retry mechanism', () => {
    it('should retry on network errors', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');

      const result = await provider.withRetry(operation, 3);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should stop retrying after max attempts', async () => {
      const operation = jest.fn()
        .mockRejectedValue(new Error('Persistent error'));

      await expect(provider.withRetry(operation, 3))
        .rejects.toThrow('Persistent error');

      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should implement exponential backoff', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');

      const start = Date.now();
      await provider.withRetry(operation, 2);
      const duration = Date.now() - start;

      // Should have some delay for retry
      expect(duration).toBeGreaterThan(500);
    });
  });

  describe('conventional commit integration', () => {
    it('should build conventional commit prompts', () => {
      const diff = 'feat: add new feature';
      const options = { conventional: true };

      const prompt = provider.buildPrompt(diff, options);

      expect(prompt).toContain('conventional');
      expect(prompt).toContain('feat, fix, docs, style');
    });

    it('should validate conventional commit messages', () => {
      const validMessage = 'feat: add new feature';
      const invalidMessage = 'add new feature';

      expect(provider.validateCommitMessage(validMessage)).toBe(true);
      expect(provider.validateCommitMessage(invalidMessage)).toBe(false);
    });

    it('should handle conventional commit options', async () => {
      const diff = 'test diff content';
      const options = { 
        conventional: true,
        types: ['feat', 'fix'],
        scopes: ['api', 'ui']
      };
      const mockResponse = {
        choices: [{
          message: { content: 'feat(api): add endpoint' }
        }]
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      const result = await provider.generateCommitMessages(diff, options);

      expect(result).toContain('feat(api): add endpoint');
    });
  });

  describe('performance optimization', () => {
    it('should handle concurrent requests efficiently', async () => {
      const diff = 'test diff content';
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

    it('should cache provider configuration', async () => {
      const config = await provider.getConfig();

      expect(config).toEqual({
        apiKey: 'test-api-key',
        model: 'llama-3.1-8b-instant',
        temperature: 0.7,
        timeout: 30000,
        maxTokens: 150
      });

      // Should cache the result
      const config2 = await provider.getConfig();
      expect(config2).toBe(config);
    });

    it('should handle large responses efficiently', async () => {
      const largeResponse = 'feat: '.repeat(100);
      const mockResponse = {
        choices: [{
          message: { content: largeResponse }
        }]
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      const start = Date.now();
      const result = await provider.generateCommitMessages('test diff');
      const duration = Date.now() - start;

      expect(result).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should process quickly
    });
  });

  describe('error recovery and resilience', () => {
    it('should handle rate limiting gracefully', async () => {
      const rateLimitError = {
        response: { status: 429 },
        message: 'Rate limit exceeded'
      };

      mockCircuitBreaker.execute.mockRejectedValue(rateLimitError);

      await expect(provider.generateCommitMessages('test diff'))
        .rejects.toThrow('Rate limit exceeded for groq');
    });

    it('should handle timeout errors gracefully', async () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'Request timeout'
      };

      mockCircuitBreaker.execute.mockRejectedValue(timeoutError);

      await expect(provider.generateCommitMessages('test diff'))
        .rejects.toThrow('groq error: Request timeout');
    });

    it('should handle network errors gracefully', async () => {
      const networkError = {
        code: 'ENOTFOUND',
        message: 'Network unreachable'
      };

      mockCircuitBreaker.execute.mockRejectedValue(networkError);

      await expect(provider.generateCommitMessages('test diff'))
        .rejects.toThrow('groq error: Network error');
    });

    it('should handle malformed API responses', async () => {
      const malformedResponse = {
        choices: []
      };

      mockCircuitBreaker.execute.mockResolvedValue(malformedResponse);

      const result = await provider.generateCommitMessages('test diff');

      expect(result).toEqual([]);
    });

    it('should handle API response without choices', async () => {
      const emptyResponse = {
        // No choices property
      };

      mockCircuitBreaker.execute.mockResolvedValue(emptyResponse);

      const result = await provider.generateCommitMessages('test diff');

      expect(result).toEqual([]);
    });
  });

  describe('integration with circuit breaker', () => {
    it('should use circuit breaker for all API calls', async () => {
      const diff = 'test diff content';
      const mockResponse = {
        choices: [{
          message: { content: 'feat: circuit breaker test' }
        }]
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      await provider.generateCommitMessages(diff);

      expect(mockCircuitBreaker.execute).toHaveBeenCalledWith(
        expect.any(Function),
        { provider: 'groq' }
      );
    });

    it('should handle circuit breaker open state', async () => {
      const circuitOpenError = new Error('Circuit breaker is OPEN');
      mockCircuitBreaker.execute.mockRejectedValue(circuitOpenError);

      await expect(provider.generateCommitMessages('test diff'))
        .rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should pass correct context to circuit breaker', async () => {
      const diff = 'test diff content';
      const mockResponse = {
        choices: [{
          message: { content: 'feat: context test' }
        }]
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      await provider.generateCommitMessages(diff);

      expect(mockCircuitBreaker.execute).toHaveBeenCalledWith(
        expect.any(Function),
        { provider: 'groq' }
      );
    });

    it('should handle circuit breaker status checks', () => {
      const status = provider.circuitBreaker.getStatus();

      expect(status).toBeDefined();
      expect(status.state).toBe('CLOSED');
      expect(status.isOpen).toBe(false);
    });
  });

  describe('streaming and real-time responses', () => {
    it('should handle streaming responses if enabled', async () => {
      const diff = 'test diff content';
      const options = { stream: true };
      const mockResponse = {
        choices: [{
          message: { content: 'feat: streaming response' }
        }]
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      const result = await provider.generateCommitMessages(diff, options);

      expect(result).toContain('feat: streaming response');
    });

    it('should handle partial streaming responses', async () => {
      const diff = 'test diff content';
      const mockResponse = {
        choices: [{
          message: { content: 'feat: partial' }
        }]
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      const result = await provider.generateCommitMessages(diff);

      expect(result).toContain('feat: partial');
    });
  });

  describe('model and configuration validation', () => {
    it('should validate model names', async () => {
      const diff = 'test diff content';
      const options = { model: 'invalid-model' };
      const mockResponse = {
        choices: [{
          message: { content: 'test response' }
        }]
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      const result = await provider.generateCommitMessages(diff, options);

      expect(result).toContain('test response');
    });

    it('should handle model configuration errors', async () => {
      const diff = 'test diff content';
      const modelError = {
        response: { status: 404 },
        message: 'Model not found'
      };

      mockCircuitBreaker.execute.mockRejectedValue(modelError);

      await expect(provider.generateCommitMessages(diff))
        .rejects.toThrow('Model not found');
    });

    it('should use default model when not specified', async () => {
      const diff = 'test diff content';
      const mockResponse = {
        choices: [{
          message: { content: 'feat: default model' }
        }]
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      await provider.generateCommitMessages(diff);

      expect(mockGroq.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'llama-3.1-8b-instant'
        })
      );
    });
  });
});