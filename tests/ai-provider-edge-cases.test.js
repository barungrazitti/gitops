/**
 * Comprehensive Edge Case Tests for AI Providers
 * Tests for Groq and Ollama providers under extreme conditions
 */

jest.mock('groq-sdk');
jest.mock('axios');
jest.mock('../src/core/config-manager');
jest.mock('../src/core/circuit-breaker');

const GroqProvider = require('../src/providers/groq-provider');
const OllamaProvider = require('../src/providers/ollama-provider');
const ConfigManager = require('../src/core/config-manager');
const CircuitBreaker = require('../src/core/circuit-breaker');
const Groq = require('groq-sdk');
const axios = require('axios');

describe('AI Provider Edge Cases', () => {
  let mockConfigManager;
  let mockCircuitBreaker;
  let mockGroq;
  let mockAxios;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock config manager
    mockConfigManager = {
      get: jest.fn(),
      getProviderConfig: jest.fn(),
    };
    
    // Setup mock circuit breaker
    mockCircuitBreaker = {
      execute: jest.fn(),
      getStatus: jest.fn().mockReturnValue({ 
        state: 'CLOSED', 
        isOpen: false,
        isHalfOpen: false 
      }),
      reset: jest.fn(),
      getStats: jest.fn().mockReturnValue({
        state: 'CLOSED',
        successRate: 100,
        totalRequests: 0
      })
    };

    // Setup mock Groq
    mockGroq = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };

    // Setup mock axios
    mockAxios = {
      post: jest.fn(),
      get: jest.fn(),
      isAxiosError: jest.fn(() => true)
    };

    ConfigManager.mockImplementation(() => mockConfigManager);
    CircuitBreaker.mockImplementation(() => mockCircuitBreaker);
    Groq.mockImplementation(() => mockGroq);
  });

  describe('Connection Failures and Network Timeouts', () => {
    describe('Groq Provider', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant',
          timeout: 5000
        });
      });

      it('should handle ECONNREFUSED errors', async () => {
        const error = new Error('Connection refused');
        error.code = 'ECONNREFUSED';
        mockCircuitBreaker.execute.mockRejectedValue(error);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Cannot connect to Groq. Please check your internet connection.');
      });

      it('should handle ETIMEDOUT errors', async () => {
        const error = new Error('Request timeout');
        error.code = 'ETIMEDOUT';
        mockCircuitBreaker.execute.mockRejectedValue(error);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Request to Groq timed out. Please try again.');
      });

      it('should handle ENOTFOUND errors (DNS resolution failure)', async () => {
        const error = new Error('getaddrinfo ENOTFOUND api.groq.com');
        error.code = 'ENOTFOUND';
        mockCircuitBreaker.execute.mockRejectedValue(error);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Cannot connect to Groq. Please check your internet connection.');
      });

      it('should handle network interruption during streaming', async () => {
        const error = new Error('Network interruption');
        error.code = 'ECONNRESET';
        mockCircuitBreaker.execute.mockRejectedValue(error);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Cannot connect to Groq. Please check your internet connection.');
      });

      it('should handle slow network with custom timeout', async () => {
        const provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          timeout: 1000 // Very short timeout
        });

        // Mock a slow response
        mockCircuitBreaker.execute.mockImplementation(() => 
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 1500)
          )
        );

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow();
      });
    });

    describe('Ollama Provider', () => {
      let provider;

      beforeEach(() => {
        provider = new OllamaProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          model: 'qwen2.5-coder:latest',
          timeout: 5000
        });
      });

      it('should handle Ollama service not running', async () => {
        const error = new Error('Connection refused');
        error.code = 'ECONNREFUSED';
        mockAxios.post.mockRejectedValue(error);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Ollama service is not running. Please start Ollama with "ollama serve".');
      });

      it('should handle Ollama service timeout', async () => {
        const error = new Error('Timeout of 5000ms exceeded');
        error.code = 'ECONNABORTED';
        mockAxios.post.mockRejectedValue(error);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow();
      });

      it('should handle Ollama service crash during request', async () => {
        // First call succeeds, second fails (service crash)
        mockAxios.post
          .mockResolvedValueOnce({ data: { response: 'partial response' } })
          .mockRejectedValueOnce(new Error('Service unavailable'));

        // First call should work
        await expect(provider.generateCommitMessages('test diff')).resolves.toBeDefined();
        
        // Second call should fail
        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow();
      });
    });
  });

  describe('Empty or Null Responses', () => {
    describe('Groq Provider', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });
      });

      it('should handle null response', async () => {
        mockCircuitBreaker.execute.mockResolvedValue(null);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Invalid response from AI provider');
      });

      it('should handle undefined response', async () => {
        mockCircuitBreaker.execute.mockResolvedValue(undefined);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Invalid response from AI provider');
      });

      it('should handle empty response object', async () => {
        mockCircuitBreaker.execute.mockResolvedValue({});

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Invalid response format from Groq API');
      });

      it('should handle empty choices array', async () => {
        mockCircuitBreaker.execute.mockResolvedValue({ choices: [] });

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('No choices returned from Groq API');
      });

      it('should handle null message content', async () => {
        mockCircuitBreaker.execute.mockResolvedValue({
          choices: [{ message: { content: null } }]
        });

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('No message content in Groq response');
      });

      it('should handle empty string content', async () => {
        mockCircuitBreaker.execute.mockResolvedValue({
          choices: [{ message: { content: '' } }]
        });

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('No valid commit messages found in AI response');
      });

      it('should handle whitespace-only content', async () => {
        mockCircuitBreaker.execute.mockResolvedValue({
          choices: [{ message: { content: '   \n\t  ' } }]
        });

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('No valid commit messages found in AI response');
      });
    });

    describe('Ollama Provider', () => {
      let provider;

      beforeEach(() => {
        provider = new OllamaProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          model: 'qwen2.5-coder:latest'
        });
      });

      it('should handle null response data', async () => {
        mockAxios.post.mockResolvedValue({ data: null });

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('No response content from Ollama');
      });

      it('should handle undefined response field', async () => {
        mockAxios.post.mockResolvedValue({ data: {} });

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('No response content from Ollama');
      });

      it('should handle empty response string', async () => {
        mockAxios.post.mockResolvedValue({ data: { response: '' } });

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('No valid commit messages found in AI response');
      });
    });
  });

  describe('Malformed Responses', () => {
    describe('Groq Provider', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });
      });

      it('should handle non-string response content', async () => {
        mockCircuitBreaker.execute.mockResolvedValue({
          choices: [{ message: { content: 12345 } }]
        });

        const result = await provider.generateCommitMessages('test diff');
        expect(result).toEqual(['12345']); // Should convert to string
      });

      it('should handle response with invalid JSON structure', async () => {
        mockCircuitBreaker.execute.mockResolvedValue({
          choices: [{ message: { content: 'Invalid JSON: {"incomplete":' } }]
        });

        // Should still parse the text content
        const result = await provider.generateCommitMessages('test diff');
        expect(result).toContain('Invalid JSON:');
      });

      it('should handle response with only special characters', async () => {
        mockCircuitBreaker.execute.mockResolvedValue({
          choices: [{ message: { content: '!@#$%^&*()_+-=[]{}|;:,.<>?' } }]
        });

        const result = await provider.generateCommitMessages('test diff');
        expect(result).toContain('!@#$%^&*()_+-=[]{}|;:,.<>?');
      });

      it('should handle response with extremely long lines', async () => {
        const longLine = 'a'.repeat(10000);
        mockCircuitBreaker.execute.mockResolvedValue({
          choices: [{ message: { content: longLine } }]
        });

        const result = await provider.generateCommitMessages('test diff');
        expect(result[0].length).toBeGreaterThan(5000);
      });
    });

    describe('Ollama Provider', () => {
      let provider;

      beforeEach(() => {
        provider = new OllamaProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          model: 'qwen2.5-coder:latest'
        });
      });

      it('should handle response with unexpected data structure', async () => {
        mockAxios.post.mockResolvedValue({
          data: { 
            response: 'valid response',
            unexpected_field: 'should not break'
          }
        });

        const result = await provider.generateCommitMessages('test diff');
        expect(result).toContain('valid response');
      });

      it('should handle response with array instead of string', async () => {
        mockAxios.post.mockResolvedValue({
          data: { response: ['feat: add feature', 'fix: fix bug'] }
        });

        // Should handle gracefully by converting array to string
        const result = await provider.generateCommitMessages('test diff');
        expect(result).toBeDefined();
      });
    });
  });

  describe('Rate Limiting and API Quota Exceeded', () => {
    describe('Groq Provider', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });
      });

      it('should handle 429 rate limit error', async () => {
        const error = {
          response: { status: 429, statusText: 'Too Many Requests' }
        };
        mockCircuitBreaker.execute.mockRejectedValue(error);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Rate limit exceeded for Groq. Please try again later.');
      });

      it('should handle rate limit with retry-after header', async () => {
        const error = {
          response: { 
            status: 429, 
            statusText: 'Too Many Requests',
            headers: { 'retry-after': '60' }
          }
        };
        mockCircuitBreaker.execute.mockRejectedValue(error);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Rate limit exceeded for Groq. Please try again later.');
      });

      it('should handle quota exceeded error', async () => {
        const error = {
          response: { 
            status: 429,
            data: { error: { message: 'Quota exceeded' } }
          }
        };
        mockCircuitBreaker.execute.mockRejectedValue(error);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Rate limit exceeded for Groq. Please try again later.');
      });

      it('should handle rate limit during chunked requests', async () => {
        const provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });

        // Mock large diff that requires chunking
        const largeDiff = 'a'.repeat(5000);
        
        // First chunk succeeds, second hits rate limit
        mockCircuitBreaker.execute
          .mockResolvedValueOnce({
            choices: [{ message: { content: 'feat: first chunk' } }]
          })
          .mockRejectedValueOnce({
            response: { status: 429 }
          });

        await expect(provider.generateCommitMessages(largeDiff))
          .rejects.toThrow('Rate limit exceeded for Groq. Please try again later.');
      });
    });

    describe('Ollama Provider', () => {
      let provider;

      beforeEach(() => {
        provider = new OllamaProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          model: 'qwen2.5-coder:latest'
        });
      });

      it('should handle Ollama server overload', async () => {
        const error = {
          response: { status: 503, statusText: 'Service Unavailable' }
        };
        mockAxios.post.mockRejectedValue(error);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Ollama service is temporarily unavailable. Please try again later.');
      });

      it('should handle concurrent request limits', async () => {
        const error = new Error('Too many concurrent requests');
        error.code = 'ECONNRESET';
        mockAxios.post.mockRejectedValue(error);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow();
      });
    });
  });

  describe('Invalid API Keys or Authentication Failures', () => {
    describe('Groq Provider', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
      });

      it('should handle 401 unauthorized error', async () => {
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'invalid-key',
          model: 'llama-3.1-8b-instant'
        });

        const error = {
          response: { status: 401, statusText: 'Unauthorized' }
        };
        mockCircuitBreaker.execute.mockRejectedValue(error);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Authentication failed for Groq. Please check your API key.');
      });

      it('should handle 403 forbidden error', async () => {
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'expired-key',
          model: 'llama-3.1-8b-instant'
        });

        const error = {
          response: { status: 403, statusText: 'Forbidden' }
        };
        mockCircuitBreaker.execute.mockRejectedValue(error);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Access forbidden for Groq. Please check your permissions.');
      });

      it('should handle missing API key during initialization', async () => {
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: null,
          model: 'llama-3.1-8b-instant'
        });

        await expect(provider.initializeClient())
          .rejects.toThrow('Groq API key not configured. Run "aicommit setup" to configure.');
      });

      it('should handle empty API key string', async () => {
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: '',
          model: 'llama-3.1-8b-instant'
        });

        await expect(provider.initializeClient())
          .rejects.toThrow('Groq API key not configured. Run "aicommit setup" to configure.');
      });
    });
  });

  describe('Model Unavailability or Service Downtime', () => {
    describe('Groq Provider', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'unavailable-model'
        });
      });

      it('should handle model not found error', async () => {
        const error = {
          response: { 
            status: 404,
            data: { error: { message: 'Model not found' } }
          }
        };
        mockCircuitBreaker.execute.mockRejectedValue(error);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Groq API error (404): Model not found');
      });

      it('should handle model deprecated error', async () => {
        const error = {
          response: { 
            status: 410,
            data: { error: { message: 'Model deprecated' } }
          }
        };
        mockCircuitBreaker.execute.mockRejectedValue(error);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Groq API error (410): Model deprecated');
      });

      it('should handle service maintenance mode', async () => {
        const error = {
          response: { 
            status: 503,
            data: { error: { message: 'Service under maintenance' } }
          }
        };
        mockCircuitBreaker.execute.mockRejectedValue(error);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Groq service is temporarily unavailable. Please try again later.');
      });
    });

    describe('Ollama Provider', () => {
      let provider;

      beforeEach(() => {
        provider = new OllamaProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          model: 'nonexistent-model'
        });
      });

      it('should handle model not found in Ollama', async () => {
        const error = {
          response: { status: 404 }
        };
        mockAxios.post.mockRejectedValue(error);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Model not found. Please pull the model first with "ollama pull <model-name>".');
      });

      it('should handle model not available during test', async () => {
        mockAxios.get.mockResolvedValue({
          data: { models: [{ name: 'available-model' }] }
        });

        const result = await provider.test({ model: 'missing-model' });
        expect(result.success).toBe(false);
        expect(result.message).toContain('missing-model');
      });

      it('should handle Ollama service returning empty models list', async () => {
        mockAxios.get.mockResolvedValue({
          data: { models: [] }
        });

        const result = await provider.test({ model: 'any-model' });
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Extremely Large Diffs Exceeding Token Limits', () => {
    describe('Groq Provider', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant',
          maxTokens: 150
        });
      });

      it('should handle extremely large diffs with chunking', async () => {
        // Create a very large diff (50KB)
        const largeDiff = 'diff --git a/large-file.js b/large-file.js\n' +
          Array(1000).fill('+line ' + 'a'.repeat(50)).join('\n');

        // Mock successful chunked responses
        mockCircuitBreaker.execute.mockResolvedValue({
          choices: [{ message: { content: 'feat: implement large feature' } }]
        });

        const result = await provider.generateCommitMessages(largeDiff);
        expect(result).toContain('feat: implement large feature');
        expect(mockCircuitBreaker.execute).toHaveBeenCalled();
      });

      it('should handle chunking failure with recursive retry', async () => {
        const provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });

        const largeDiff = 'a'.repeat(10000);
        
        // Mock rate limit error to trigger recursive chunking
        const rateLimitError = {
          response: { status: 429 },
          error: { code: 'rate_limit_exceeded' }
        };
        
        mockCircuitBreaker.execute.mockRejectedValue(rateLimitError);

        // Should attempt recursive chunking
        await expect(provider.generateCommitMessages(largeDiff))
          .rejects.toThrow();
      });

      it('should handle minimum chunk size limit', async () => {
        const provider = new GroqProvider();
        
        // Test chunkDiff with very small maxTokens
        const chunks = provider.chunkDiff('a'.repeat(1000), 10);
        
        // Should not create infinite chunks
        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks.length).toBeLessThan(100);
      });

      it('should handle diff with extremely long lines', async () => {
        const longLineDiff = 'diff --git a/file.js b/file.js\n' +
          '+' + 'a'.repeat(10000) + '\n' +
          '+' + 'b'.repeat(10000) + '\n';

        mockCircuitBreaker.execute.mockResolvedValue({
          choices: [{ message: { content: 'feat: add long lines' } }]
        });

        const result = await provider.generateCommitMessages(longLineDiff);
        expect(result).toContain('feat: add long lines');
      });
    });

    describe('Ollama Provider', () => {
      let provider;

      beforeEach(() => {
        provider = new OllamaProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          model: 'qwen2.5-coder:latest',
          timeout: 120000
        });
      });

      it('should handle large diffs without chunking (Ollama handles larger context)', async () => {
        const largeDiff = 'a'.repeat(50000);
        
        mockAxios.post.mockResolvedValue({
          data: { response: 'feat: large implementation' }
        });

        const result = await provider.generateCommitMessages(largeDiff);
        expect(result).toContain('feat: large implementation');
        expect(mockAxios.post).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            prompt: expect.stringContaining(largeDiff)
          }),
          expect.any(Object)
        );
      });

      it('should handle timeout with very large diffs', async () => {
        const largeDiff = 'a'.repeat(100000);
        
        const timeoutError = new Error('Timeout exceeded');
        timeoutError.code = 'ECONNABORTED';
        mockAxios.post.mockRejectedValue(timeoutError);

        await expect(provider.generateCommitMessages(largeDiff))
          .rejects.toThrow();
      });
    });
  });

  describe('Concurrent Request Handling', () => {
    describe('Groq Provider', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });
      });

      it('should handle multiple concurrent requests', async () => {
        const promises = Array(5).fill(null).map(() => 
          provider.generateCommitMessages('test diff')
        );

        mockCircuitBreaker.execute.mockResolvedValue({
          choices: [{ message: { content: 'feat: concurrent test' } }]
        });

        const results = await Promise.all(promises);
        expect(results).toHaveLength(5);
        expect(results.every(r => r.includes('concurrent test'))).toBe(true);
        expect(mockCircuitBreaker.execute).toHaveBeenCalledTimes(5);
      });

      it('should handle concurrent requests with mixed success/failure', async () => {
        const promises = Array(3).fill(null).map((_, i) => 
          provider.generateCommitMessages(`test diff ${i}`)
        );

        mockCircuitBreaker.execute
          .mockResolvedValueOnce({
            choices: [{ message: { content: 'feat: success 1' } }]
          })
          .mockRejectedValueOnce(new Error('Request failed'))
          .mockResolvedValueOnce({
            choices: [{ message: { content: 'feat: success 3' } }]
          });

        const results = await Promise.allSettled(promises);
        expect(results[0].status).toBe('fulfilled');
        expect(results[1].status).toBe('rejected');
        expect(results[2].status).toBe('fulfilled');
      });

      it('should handle race conditions in client initialization', async () => {
        const promises = Array(3).fill(null).map(() => 
          provider.generateCommitMessages('test diff')
        );

        mockCircuitBreaker.execute.mockResolvedValue({
          choices: [{ message: { content: 'feat: race condition test' } }]
        });

        await Promise.all(promises);
        
        // Client should only be initialized once
        expect(Groq).toHaveBeenCalledTimes(1);
      });
    });

    describe('Ollama Provider', () => {
      let provider;

      beforeEach(() => {
        provider = new OllamaProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          model: 'qwen2.5-coder:latest'
        });
      });

      it('should handle concurrent Ollama requests', async () => {
        const promises = Array(5).fill(null).map((_, i) => 
          provider.generateCommitMessages(`test diff ${i}`)
        );

        mockAxios.post.mockResolvedValue({
          data: { response: `feat: concurrent ${Math.random()}` }
        });

        const results = await Promise.all(promises);
        expect(results).toHaveLength(5);
        expect(mockAxios.post).toHaveBeenCalledTimes(5);
      });

      it('should handle Ollama server overload from concurrent requests', async () => {
        const promises = Array(10).fill(null).map(() => 
          provider.generateCommitMessages('test diff')
        );

        // Simulate server overload after 5 requests
        mockAxios.post
          .mockResolvedValueTimes(5, {
            data: { response: 'feat: success' }
          })
          .mockRejectedValue(new Error('Server overloaded'));

        const results = await Promise.allSettled(promises);
        
        const successful = results.filter(r => r.status === 'fulfilled');
        const failed = results.filter(r => r.status === 'rejected');
        
        expect(successful).toHaveLength(5);
        expect(failed).toHaveLength(5);
      });
    });
  });

  describe('Circuit Breaker Functionality', () => {
    describe('Circuit Breaker Integration', () => {
      let provider;
      let mockCircuitBreakerInstance;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });

        mockCircuitBreakerInstance = {
          execute: jest.fn(),
          getStatus: jest.fn(),
          reset: jest.fn(),
          getStats: jest.fn()
        };
        
        CircuitBreaker.mockImplementation(() => mockCircuitBreakerInstance);
        provider = new GroqProvider();
      });

      it('should open circuit after failure threshold', async () => {
        // Simulate circuit breaker opening
        mockCircuitBreakerInstance.execute.mockRejectedValue(
          new Error('Circuit breaker is OPEN')
        );
        mockCircuitBreakerInstance.getStatus.mockReturnValue({
          state: 'OPEN',
          isOpen: true
        });

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Circuit breaker is OPEN');
      });

      it('should reset circuit breaker when requested', async () => {
        provider.circuitBreaker.reset();
        
        expect(mockCircuitBreakerInstance.reset).toHaveBeenCalled();
      });

      it('should get circuit breaker statistics', async () => {
        mockCircuitBreakerInstance.getStats.mockReturnValue({
          state: 'CLOSED',
          successRate: 95,
          totalRequests: 100
        });

        const stats = provider.circuitBreaker.getStats();
        
        expect(mockCircuitBreakerInstance.getStats).toHaveBeenCalled();
        expect(stats.state).toBe('CLOSED');
      });

      it('should handle circuit breaker in half-open state', async () => {
        mockCircuitBreakerInstance.getStatus.mockReturnValue({
          state: 'HALF_OPEN',
          isHalfOpen: true
        });
        
        mockCircuitBreakerInstance.execute.mockResolvedValue({
          choices: [{ message: { content: 'feat: half-open success' } }]
        });

        const result = await provider.generateCommitMessages('test diff');
        expect(result).toContain('feat: half-open success');
      });

      it('should handle circuit breaker timeout during execution', async () => {
        mockCircuitBreakerInstance.execute.mockImplementation(() => 
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Circuit breaker timeout')), 100)
          )
        );

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Circuit breaker timeout');
      });
    });
  });

  describe('Provider Fallback Mechanisms', () => {
    describe('AI Provider Factory Fallback', () => {
      const AIProviderFactory = require('../src/providers/ai-provider-factory');

      it('should fallback from Ollama to Groq when Ollama fails', async () => {
        const ollamaProvider = new OllamaProvider();
        const groqProvider = new GroqProvider();

        jest.spyOn(ollamaProvider, 'generateCommitMessages')
          .mockRejectedValue(new Error('Ollama not available'));
        
        jest.spyOn(groqProvider, 'generateCommitMessages')
          .mockResolvedValue(['feat: fallback success']);

        jest.spyOn(groqProvider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });

        // Simulate factory fallback logic
        try {
          await ollamaProvider.generateCommitMessages('test diff');
        } catch (error) {
          const result = await groqProvider.generateCommitMessages('test diff');
          expect(result).toContain('feat: fallback success');
        }
      });

      it('should handle both providers unavailable', async () => {
        const ollamaProvider = new OllamaProvider();
        const groqProvider = new GroqProvider();

        jest.spyOn(ollamaProvider, 'generateCommitMessages')
          .mockRejectedValue(new Error('Ollama not running'));
        
        jest.spyOn(groqProvider, 'generateCommitMessages')
          .mockRejectedValue(new Error('Groq API key invalid'));

        await expect(ollamaProvider.generateCommitMessages('test diff'))
          .rejects.toThrow('Ollama not running');
        
        await expect(groqProvider.generateCommitMessages('test diff'))
          .rejects.toThrow('Groq API key invalid');
      });

      it('should handle provider creation with invalid name', () => {
        expect(() => AIProviderFactory.create('invalid-provider'))
          .toThrow('Unsupported AI provider: invalid-provider');
      });

      it('should handle provider creation with null name', () => {
        expect(() => AIProviderFactory.create(null))
          .toThrow('Provider name is required');
      });

      it('should handle provider creation with undefined name', () => {
        expect(() => AIProviderFactory.create(undefined))
          .toThrow('Provider name is required');
      });
    });
  });

  describe('Memory and Resource Management', () => {
    describe('Large Response Handling', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });
      });

      it('should handle extremely large AI responses', async () => {
        const largeResponse = 'feat: ' + 'very large feature description '.repeat(1000);
        
        mockCircuitBreaker.execute.mockResolvedValue({
          choices: [{ message: { content: largeResponse } }]
        });

        const result = await provider.generateCommitMessages('test diff');
        expect(result[0].length).toBeGreaterThan(10000);
      });

      it('should handle memory cleanup after large requests', async () => {
        const largeDiff = 'a'.repeat(100000);
        
        mockCircuitBreaker.execute.mockResolvedValue({
          choices: [{ message: { content: 'feat: processed large diff' } }]
        });

        await provider.generateCommitMessages(largeDiff);
        
        // Cleanup should not throw errors
        expect(() => provider.cleanup()).not.toThrow();
      });
    });

    describe('Resource Cleanup', () => {
      it('should cleanup Groq provider resources', () => {
        const provider = new GroqProvider();
        provider.client = mockGroq;
        
        provider.cleanup();
        
        expect(provider.client).toBeNull();
      });

      it('should handle cleanup when no client exists', () => {
        const provider = new GroqProvider();
        provider.client = null;
        
        expect(() => provider.cleanup()).not.toThrow();
      });

      it('should handle multiple cleanup calls', () => {
        const provider = new GroqProvider();
        provider.client = mockGroq;
        
        provider.cleanup();
        provider.cleanup();
        provider.cleanup();
        
        expect(provider.client).toBeNull();
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    describe('Retry Logic', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant',
          retries: 3
        });
      });

      it('should retry on transient failures', async () => {
        // Fail twice, then succeed
        mockCircuitBreaker.execute
          .mockRejectedValueOnce(new Error('Network error'))
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce({
            choices: [{ message: { content: 'feat: retry success' } }]
          });

        const result = await provider.generateCommitMessages('test diff');
        expect(result).toContain('feat: retry success');
        expect(mockCircuitBreaker.execute).toHaveBeenCalledTimes(3);
      });

      it('should not retry on client errors (4xx)', async () => {
        const clientError = {
          response: { status: 401 }
        };
        mockCircuitBreaker.execute.mockRejectedValue(clientError);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Authentication failed for Groq. Please check your API key.');
        
        // Should not retry
        expect(mockCircuitBreaker.execute).toHaveBeenCalledTimes(1);
      });

      it('should exhaust retries and fail', async () => {
        mockCircuitBreaker.execute.mockRejectedValue(new Error('Persistent error'));

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Persistent error');
        
        expect(mockCircuitBreaker.execute).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
      });
    });

    describe('Graceful Degradation', () => {
      it('should handle partial response parsing', async () => {
        const provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });

        mockCircuitBreaker.execute.mockResolvedValue({
          choices: [{ 
            message: { 
              content: '1. feat: valid commit\n\ninvalid line\n2. fix: another commit' 
            } 
          }]
        });

        const result = await provider.generateCommitMessages('test diff');
        expect(result).toContain('feat: valid commit');
        expect(result).toContain('fix: another commit');
      });

      it('should handle malformed but parseable responses', async () => {
        const provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });

        mockCircuitBreaker.execute.mockResolvedValue({
          choices: [{ 
            message: { 
              content: 'feat: commit with **markdown** formatting and [links](http://example.com)' 
            } 
          }]
        });

        const result = await provider.generateCommitMessages('test diff');
        expect(result[0]).toContain('feat: commit with **markdown** formatting');
      });
    });
  });
});