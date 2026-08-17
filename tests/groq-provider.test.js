/**
 * Unit tests for Groq Provider
 */

jest.mock('groq-sdk');
jest.mock('../src/core/config-manager');
jest.mock('../src/core/circuit-breaker');

const Groq = require('groq-sdk');
const GroqProvider = require('../src/providers/groq-provider');
const ConfigManager = require('../src/core/config-manager');
const CircuitBreaker = require('../src/core/circuit-breaker');

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
      }),
    };

    mockCircuitBreaker = {
      execute: jest.fn(),
      getStatus: jest.fn().mockReturnValue({ state: 'CLOSED', isOpen: false }),
    };

    mockGroq = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
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

      await expect(provider.validate(config)).rejects.toThrow('Groq API key is required');
    });

    it('should require API key', async () => {
      const config = { model: 'llama-3.1-8b-instant' };

      await expect(provider.validate(config)).rejects.toThrow('Groq API key is required');
    });
  });

  describe('generateResponse', () => {
    it('should return response text for a plain string prompt', async () => {
      mockGroq.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'feat: add new feature' } }],
      });
      mockCircuitBreaker.execute.mockImplementation(cb => cb());

      const result = await provider.generateResponse('Generate a commit message for this diff');

      expect(result).toBe('feat: add new feature');
    });

    it('should pass the pipeline systemPrompt as the system message', async () => {
      mockGroq.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'ok' } }],
      });
      mockCircuitBreaker.execute.mockImplementation(cb => cb());

      await provider.generateResponse('prompt body', { systemPrompt: 'CUSTOM SYSTEM' });

      const request = mockGroq.chat.completions.create.mock.calls[0][0];
      expect(request.messages[0]).toEqual({ role: 'system', content: 'CUSTOM SYSTEM' });
      expect(request.messages[1]).toEqual({ role: 'user', content: 'prompt body' });
    });

    it('should enforce the reasoning-model max_tokens floor', async () => {
      mockConfigManager.getProviderConfig.mockResolvedValue({
        apiKey: 'test-api-key',
        model: 'openai/gpt-oss-20b',
      });
      mockGroq.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'ok' } }],
      });
      mockCircuitBreaker.execute.mockImplementation(cb => cb());

      await provider.generateResponse('prompt', { maxTokens: 150 });

      const request = mockGroq.chat.completions.create.mock.calls[0][0];
      expect(request.max_tokens).toBeGreaterThanOrEqual(2000);
    });

    it('should throw when response has no content', async () => {
      mockGroq.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });
      mockCircuitBreaker.execute.mockImplementation(cb => cb());

      await expect(provider.generateResponse('prompt')).rejects.toThrow(
        'No response content from Groq'
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
});
