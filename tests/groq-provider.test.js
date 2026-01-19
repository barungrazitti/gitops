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
      get: jest.fn().mockReturnValue('test-api-key'),
      getProviderConfig: jest.fn().mockResolvedValue({
        apiKey: 'test-api-key',
        model: 'llama-3.1-8b-instant',
        url: 'https://api.groq.com/openai/v1',
        temperature: 0.7,
        timeout: 30000,
      })
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
    provider.client = mockGroq;
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

  describe('validate', () => {
    it('should validate successfully with valid config', async () => {
      const config = {
        apiKey: 'test-api-key',
        model: 'llama-3.1-8b-instant',
      };

      const result = await provider.validate(config);

      expect(result).toBe(true);
    });

    it('should handle validation errors', async () => {
      const config = {
        apiKey: null,
        model: 'llama-3.1-8b-instant',
      };

      await expect(provider.validate(config))
        .rejects.toThrow('Groq API key is required');
    });

    it('should require API key', async () => {
      const config = { model: 'llama-3.1-8b-instant' };

      await expect(provider.validate(config))
        .rejects.toThrow('Groq API key is required');
    });
  });

  describe('parseResponse', () => {
    it('should parse response successfully', () => {
      const response = {
        choices: [{ message: { content: 'feat: add new feature' } }]
      };
      
      const result = provider.parseResponse(response);

      expect(result).toEqual(['feat: add new feature']);
    });

    it('should handle empty response', () => {
      const response = { choices: [] };
      
      expect(() => provider.parseResponse(response))
        .toThrow('No choices returned from Groq API');
    });

    it('should handle malformed response', () => {
      const response = null;
      
      expect(() => provider.parseResponse(response))
        .toThrow('Invalid response format from Groq API');
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
