/**
 * Additional Edge Case Tests for AI Providers
 * Focus on extreme scenarios and boundary conditions
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

describe('AI Provider Extreme Edge Cases', () => {
  let mockConfigManager;
  let mockCircuitBreaker;
  let mockGroq;
  let mockAxios;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfigManager = {
      get: jest.fn(),
      getProviderConfig: jest.fn(),
    };
    
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

    mockGroq = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };

    mockAxios = {
      post: jest.fn(),
      get: jest.fn(),
      isAxiosError: jest.fn(() => true)
    };

    ConfigManager.mockImplementation(() => mockConfigManager);
    CircuitBreaker.mockImplementation(() => mockCircuitBreaker);
    Groq.mockImplementation(() => mockGroq);
  });

  describe('Extreme Input Validation', () => {
    describe('Null and Undefined Inputs', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });
      });

      it('should handle null diff input', async () => {
        mockCircuitBreaker.execute.mockResolvedValue(['feat: handle null input']);

        const result = await provider.generateCommitMessages(null);
        expect(result).toContain('feat: handle null input');
      });

      it('should handle undefined diff input', async () => {
        mockCircuitBreaker.execute.mockResolvedValue(['feat: handle undefined input']);

        const result = await provider.generateCommitMessages(undefined);
        expect(result).toContain('feat: handle undefined input');
      });

      it('should handle empty string diff', async () => {
        mockCircuitBreaker.execute.mockResolvedValue(['feat: handle empty diff']);

        const result = await provider.generateCommitMessages('');
        expect(result).toContain('feat: handle empty diff');
      });

      it('should handle whitespace-only diff', async () => {
        mockCircuitBreaker.execute.mockResolvedValue(['feat: handle whitespace diff']);

        const result = await provider.generateCommitMessages('   \n\t  ');
        expect(result).toContain('feat: handle whitespace diff');
      });
    });

    describe('Extreme String Lengths', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });
      });

      it('should handle extremely long single line diff', async () => {
        const longLine = '+' + 'a'.repeat(100000);

        mockCircuitBreaker.execute.mockResolvedValue(['feat: handle extremely long line']);

        const result = await provider.generateCommitMessages(longLine);
        expect(result).toContain('feat: handle extremely long line');
      });

      it('should handle diff with many short lines', async () => {
        const manyLines = Array(10000).fill('+line').join('\n');

        mockCircuitBreaker.execute.mockResolvedValue(['feat: handle many lines']);

        const result = await provider.generateCommitMessages(manyLines);
        expect(result).toContain('feat: handle many lines');
      });

      it('should handle diff with special characters', async () => {
        const specialChars = '+!@#$%^&*()_+-=[]{}|;:,.<>?~`'.repeat(1000);

        mockCircuitBreaker.execute.mockResolvedValue(['feat: handle special chars']);

        const result = await provider.generateCommitMessages(specialChars);
        expect(result).toContain('feat: handle special chars');
      });

      it('should handle diff with Unicode characters', async () => {
        const unicode = '+🚀 🎉 🎊 🎈 🎁 🎂 🍰 🎪 🎭 🎨'.repeat(1000);

        mockCircuitBreaker.execute.mockResolvedValue(['feat: handle unicode']);

        const result = await provider.generateCommitMessages(unicode);
        expect(result).toContain('feat: handle unicode');
      });
    });

    describe('Malformed Diff Structures', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });
      });

      it('should handle diff without proper headers', async () => {
        const malformedDiff = '+some code\n-more code\n+even more code';

        mockCircuitBreaker.execute.mockResolvedValue(['feat: handle malformed diff']);

        const result = await provider.generateCommitMessages(malformedDiff);
        expect(result).toContain('feat: handle malformed diff');
      });

      it('should handle diff with invalid git format', async () => {
        const invalidDiff = 'invalid git diff format\n+some changes';

        mockCircuitBreaker.execute.mockResolvedValue(['feat: handle invalid format']);

        const result = await provider.generateCommitMessages(invalidDiff);
        expect(result).toContain('feat: handle invalid format');
      });

      it('should handle diff with binary file indicators', async () => {
        const binaryDiff = 'Binary files a/image.png and b/image.png differ\n+some code';

        mockCircuitBreaker.execute.mockResolvedValue(['feat: handle binary files']);

        const result = await provider.generateCommitMessages(binaryDiff);
        expect(result).toContain('feat: handle binary files');
      });
    });
  });

  describe('Extreme Configuration Scenarios', () => {
    describe('Invalid Configuration Values', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
      });

      it('should handle negative timeout values', async () => {
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant',
          timeout: -1000
        });

        mockCircuitBreaker.execute.mockResolvedValue(['feat: handle negative timeout']);

        const result = await provider.generateCommitMessages('test diff');
        expect(result).toContain('feat: handle negative timeout');
      });

      it('should handle extremely large timeout values', async () => {
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant',
          timeout: Number.MAX_SAFE_INTEGER
        });

        mockCircuitBreaker.execute.mockResolvedValue(['feat: handle large timeout']);

        const result = await provider.generateCommitMessages('test diff');
        expect(result).toContain('feat: handle large timeout');
      });

      it('should handle zero maxTokens', async () => {
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant',
          maxTokens: 0
        });

        mockCircuitBreaker.execute.mockResolvedValue(['feat: handle zero tokens']);

        const result = await provider.generateCommitMessages('test diff');
        expect(result).toContain('feat: handle zero tokens');
      });

      it('should handle negative temperature values', async () => {
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant',
          temperature: -1.0
        });

        mockCircuitBreaker.execute.mockResolvedValue(['feat: handle negative temp']);

        const result = await provider.generateCommitMessages('test diff');
        expect(result).toContain('feat: handle negative temp');
      });

      it('should handle temperature > 1.0', async () => {
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant',
          temperature: 2.0
        });

        mockCircuitBreaker.execute.mockResolvedValue(['feat: handle high temp']);

        const result = await provider.generateCommitMessages('test diff');
        expect(result).toContain('feat: handle high temp');
      });
    });

    describe('Missing Configuration', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
      });

      it('should handle completely missing config', async () => {
        jest.spyOn(provider, 'getConfig').mockResolvedValue({});

        await expect(provider.initializeClient())
          .rejects.toThrow('Groq API key not configured');
      });

      it('should handle config with only null values', async () => {
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: null,
          model: null,
          timeout: null,
          temperature: null
        });

        await expect(provider.initializeClient())
          .rejects.toThrow('Groq API key not configured');
      });

      it('should handle config throwing error', async () => {
        jest.spyOn(provider, 'getConfig').mockRejectedValue(
          new Error('Config system unavailable')
        );

        await expect(provider.initializeClient())
          .rejects.toThrow('Config system unavailable');
      });
    });
  });

  describe('Extreme Network Conditions', () => {
    describe('Intermittent Connectivity', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });
      });

      it('should handle alternating success and failure', async () => {
        mockCircuitBreaker.execute
          .mockResolvedValueOnce({
            choices: [{ message: { content: 'feat: success 1' } }]
          })
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce({
            choices: [{ message: { content: 'feat: success 2' } }]
          });

        const results = await Promise.allSettled([
          provider.generateCommitMessages('test diff 1'),
          provider.generateCommitMessages('test diff 2'),
          provider.generateCommitMessages('test diff 3')
        ]);

        expect(results[0].status).toBe('fulfilled');
        expect(results[1].status).toBe('rejected');
        expect(results[2].status).toBe('fulfilled');
      });

      it('should handle slow network with intermittent timeouts', async () => {
        let callCount = 0;
        mockCircuitBreaker.execute.mockImplementation(() => {
          callCount++;
          if (callCount % 2 === 0) {
            return new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 100)
            );
          }
          return Promise.resolve({
            choices: [{ message: { content: 'feat: slow network success' } }]
          });
        });

        const results = await Promise.allSettled([
          provider.generateCommitMessages('test diff 1'),
          provider.generateCommitMessages('test diff 2'),
          provider.generateCommitMessages('test diff 3'),
          provider.generateCommitMessages('test diff 4')
        ]);

        expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(2);
        expect(results.filter(r => r.status === 'rejected')).toHaveLength(2);
      });
    });

    describe('DNS and Resolution Issues', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });
      });

      it('should handle DNS resolution failure', async () => {
        const dnsError = new Error('getaddrinfo ENOTFOUND api.groq.com');
        dnsError.code = 'ENOTFOUND';
        mockCircuitBreaker.execute.mockRejectedValue(dnsError);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Cannot connect to Groq. Please check your internet connection.');
      });

      it('should handle DNS timeout', async () => {
        const dnsTimeoutError = new Error('DNS timeout');
        dnsTimeoutError.code = 'ETIMEOUT';
        mockCircuitBreaker.execute.mockRejectedValue(dnsTimeoutError);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow();
      });
    });
  });

  describe('Extreme API Response Scenarios', () => {
    describe('Unexpected Response Formats', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });
      });

      it('should handle response with nested objects', async () => {
        mockCircuitBreaker.execute.mockResolvedValue(['feat: nested object response']);

        const result = await provider.generateCommitMessages('test diff');
        expect(result[0]).toContain('feat: nested object response');
      });

      it('should handle response with HTML content', async () => {
        mockCircuitBreaker.execute.mockResolvedValue(['<div>feat: html response</div>']);

        const result = await provider.generateCommitMessages('test diff');
        expect(result[0]).toContain('<div>feat: html response</div>');
      });

      it('should handle response with JavaScript code', async () => {
        mockCircuitBreaker.execute.mockResolvedValue(['console.log("feat: js response");']);

        const result = await provider.generateCommitMessages('test diff');
        expect(result[0]).toContain('console.log("feat: js response");');
      });

      it('should handle response with SQL injection attempts', async () => {
        mockCircuitBreaker.execute.mockResolvedValue(["feat: sql response'; DROP TABLE commits; --"]);

        const result = await provider.generateCommitMessages('test diff');
        expect(result[0]).toContain("feat: sql response'; DROP TABLE commits; --");
      });
    });

    describe('Streaming and Partial Responses', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });
      });

      it('should handle incomplete streaming response', async () => {
        mockCircuitBreaker.execute.mockResolvedValue(['feat: incomplete response']);

        const result = await provider.generateCommitMessages('test diff');
        expect(result).toContain('feat: incomplete response');
      });

      it('should handle response with usage metadata', async () => {
        mockCircuitBreaker.execute.mockResolvedValue(['feat: response with metadata']);

        const result = await provider.generateCommitMessages('test diff');
        expect(result).toContain('feat: response with metadata');
      });
    });
  });

  describe('Extreme Memory and Performance Scenarios', () => {
    describe('Memory Pressure', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });
      });

      it('should handle processing many large diffs sequentially', async () => {
        const largeDiff = 'a'.repeat(50000);

        mockCircuitBreaker.execute.mockResolvedValue(['feat: large diff processed']);

        // Process 10 large diffs sequentially
        for (let i = 0; i < 10; i++) {
          const result = await provider.generateCommitMessages(largeDiff);
          expect(result).toContain('feat: large diff processed');
        }

        expect(mockCircuitBreaker.execute).toHaveBeenCalledTimes(10);
      });

      it('should handle rapid successive requests', async () => {
        mockCircuitBreaker.execute.mockResolvedValue(['feat: rapid request']);

        // Make 100 rapid requests
        const promises = Array(100).fill(null).map((_, i) =>
          provider.generateCommitMessages(`test diff ${i}`)
        );

        const results = await Promise.all(promises);
        expect(results).toHaveLength(100);
        expect(results.every(r => r.includes('rapid request'))).toBe(true);
      });
    });

    describe('CPU Intensive Operations', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });
      });

      it('should handle complex diff analysis', async () => {
        const complexDiff = `
diff --git a/complex-file.js b/complex-file.js
index 1234567..abcdefg 100644
--- a/complex-file.js
+++ b/complex-file.js
@@ -1,1000 +1,1000 @@
 class VeryComplexClass {
   constructor() {
     ${Array(500).fill('this.property' + Math.random() + ' = value;').join('\n     ')}
   }
   
   ${Array(500).fill(`
   veryComplexMethod${Math.random()}() {
     ${Array(100).fill('const variable' + Math.random() + ' = "complex string";').join('\n     ')}
     return ${Array(50).fill('"concatenated" + ').join('')}'"result"';
   }`).join('\n   ')}
 }
        `.trim();

        mockCircuitBreaker.execute.mockResolvedValue({
          choices: [{ message: { content: 'refactor: complex class restructuring' } }]
        });

        const result = await provider.generateCommitMessages(complexDiff);
        expect(result).toContain('refactor: complex class restructuring');
      });
    });
  });

  describe('Extreme Error Scenarios', () => {
    describe('Cascading Failures', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });
      });

      it('should handle circuit breaker cascade', async () => {
        // Simulate circuit breaker opening due to cascading failures
        mockCircuitBreaker.execute.mockRejectedValue(
          new Error('Circuit breaker is OPEN - cascading failure detected')
        );
        mockCircuitBreaker.getStatus.mockReturnValue({
          state: 'OPEN',
          isOpen: true
        });

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Circuit breaker is OPEN');
      });

      it('should handle memory exhaustion simulation', async () => {
        const memoryError = new Error('JavaScript heap out of memory');
        mockCircuitBreaker.execute.mockRejectedValue(memoryError);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('JavaScript heap out of memory');
      });

      it('should handle stack overflow simulation', async () => {
        const stackError = new Error('Maximum call stack size exceeded');
        mockCircuitBreaker.execute.mockRejectedValue(stackError);

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Maximum call stack size exceeded');
      });
    });

    describe('Unexpected Error Types', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });
      });

      it('should handle throwing strings instead of Error objects', async () => {
        mockCircuitBreaker.execute.mockImplementation(() => {
          throw 'String error message';
        });

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('String error message');
      });

      it('should handle throwing numbers', async () => {
        mockCircuitBreaker.execute.mockImplementation(() => {
          throw 500;
        });

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow(500);
      });

      it('should handle throwing objects', async () => {
        mockCircuitBreaker.execute.mockImplementation(() => {
          throw { customError: 'object error', code: 'CUSTOM' };
        });

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow();
      });

      it('should handle throwing null', async () => {
        mockCircuitBreaker.execute.mockImplementation(() => {
          throw null;
        });

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow();
      });

      it('should handle throwing undefined', async () => {
        mockCircuitBreaker.execute.mockImplementation(() => {
          throw undefined;
        });

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow();
      });
    });
  });

  describe('Extreme Timing Scenarios', () => {
    describe('Race Conditions', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });
      });

      it('should handle concurrent client initialization', async () => {
        const initPromises = Array(10).fill(null).map(() => 
          provider.initializeClient()
        );

        await Promise.all(initPromises);
        
        // Should only initialize once
        expect(Groq).toHaveBeenCalledTimes(1);
      });

      it('should handle rapid config changes', async () => {
        const configs = [
          { apiKey: 'key1', model: 'model1' },
          { apiKey: 'key2', model: 'model2' },
          { apiKey: 'key3', model: 'model3' }
        ];

        const promises = configs.map((config, index) => {
          jest.spyOn(provider, 'getConfig').mockResolvedValueOnce(config);
          return provider.generateCommitMessages(`test diff ${index}`);
        });

        mockCircuitBreaker.execute.mockResolvedValue({
          choices: [{ message: { content: 'feat: config change handled' } }]
        });

        const results = await Promise.all(promises);
        expect(results).toHaveLength(3);
        expect(results.every(r => r.includes('config change handled'))).toBe(true);
      });
    });

    describe('Timeout Edge Cases', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant',
          timeout: 100 // Very short timeout
        });
      });

      it('should handle immediate timeout', async () => {
        mockCircuitBreaker.execute.mockImplementation(() => 
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Immediate timeout')), 1)
          )
        );

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Immediate timeout');
      });

      it('should handle timeout exactly at limit', async () => {
        mockCircuitBreaker.execute.mockImplementation(() => 
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Exact timeout')), 100)
          )
        );

        await expect(provider.generateCommitMessages('test diff'))
          .rejects.toThrow('Exact timeout');
      });
    });
  });

  describe('Extreme Data Corruption Scenarios', () => {
    describe('Response Corruption', () => {
      let provider;

      beforeEach(() => {
        provider = new GroqProvider();
        jest.spyOn(provider, 'getConfig').mockResolvedValue({
          apiKey: 'test-api-key',
          model: 'llama-3.1-8b-instant'
        });
      });

      it('should handle response with null bytes', async () => {
        const corruptedResponse = 'feat: response\x00with\x00null\x00bytes';
        
        mockCircuitBreaker.execute.mockResolvedValue({
          choices: [{ message: { content: corruptedResponse } }]
        });

        const result = await provider.generateCommitMessages('test diff');
        expect(result[0]).toContain('feat: response');
      });

      it('should handle response with control characters', async () => {
        const controlCharsResponse = 'feat: response\r\nwith\tcontrol\vcharacters';
        
        mockCircuitBreaker.execute.mockResolvedValue({
          choices: [{ message: { content: controlCharsResponse } }]
        });

        const result = await provider.generateCommitMessages('test diff');
        expect(result[0]).toContain('feat: response');
      });

      it('should handle response with high Unicode characters', async () => {
        const highUnicodeResponse = 'feat: response with \uD800\uDC00\uD801\uDC01 characters';
        
        mockCircuitBreaker.execute.mockResolvedValue({
          choices: [{ message: { content: highUnicodeResponse } }]
        });

        const result = await provider.generateCommitMessages('test diff');
        expect(result[0]).toContain('feat: response with');
      });
    });
  });
});