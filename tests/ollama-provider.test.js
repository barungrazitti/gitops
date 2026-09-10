/**
 * Unit tests for OllamaProvider
 */

describe('OllamaProvider', () => {
  let OllamaProvider;
  let provider;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    jest.mock('axios');
    jest.mock('../src/core/config-manager', () =>
      jest.fn().mockImplementation(() => ({
        get: jest.fn().mockReturnValue('test-host'),
        getProviderConfig: jest.fn().mockResolvedValue({
          url: 'http://localhost:11434',
          model: 'qwen2.5-coder:latest',
          temperature: 0.3,
        }),
      }))
    );
    jest.mock('../src/core/circuit-breaker', () =>
      jest.fn().mockImplementation(() => ({
        execute: jest.fn(),
        getStatus: jest.fn().mockReturnValue({ state: 'CLOSED' }),
      }))
    );

    OllamaProvider = require('../src/providers/ollama-provider');
    provider = new OllamaProvider();
  });

  describe('constructor', () => {
    it('should initialize with correct name', () => {
      expect(provider.name).toBe('ollama');
    });

    it('should set default base URL', () => {
      expect(provider.baseURL).toBe('http://localhost:11434');
    });

    it('should initialize circuit breaker', () => {
      expect(provider.circuitBreaker).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should return true when Ollama is running', async () => {
      const axios = require('axios');
      axios.get.mockResolvedValue({ data: {} });

      const result = await provider.validate({});
      expect(result).toBe(true);
    });

    it('should throw error when not running', async () => {
      const axios = require('axios');
      axios.get.mockRejectedValue(new Error('Connection refused'));

      await expect(provider.validate({})).rejects.toThrow('Ollama is not running');
    });
  });

  describe('generateResponse', () => {
    it('should return response text for a plain string prompt', async () => {
      const axios = require('axios');
      axios.post.mockResolvedValue({
        data: { response: 'feat: add new feature' },
      });
      provider.circuitBreaker.execute.mockImplementation(cb => cb());

      const result = await provider.generateResponse('Generate a commit message for this diff');
      expect(result).toBe('feat: add new feature');
    });

    it('should pass systemPrompt through to the prompt body', async () => {
      const axios = require('axios');
      axios.post.mockResolvedValue({
        data: { response: 'ok' },
      });
      provider.circuitBreaker.execute.mockImplementation(cb => cb());

      await provider.generateResponse('prompt body', { systemPrompt: 'CUSTOM SYSTEM' });

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({
          prompt: expect.stringContaining('CUSTOM SYSTEM'),
        }),
        expect.anything()
      );
    });

    it('should throw when response has no content', async () => {
      const axios = require('axios');
      axios.post.mockResolvedValue({
        data: { response: '' },
      });
      provider.circuitBreaker.execute.mockImplementation(cb => cb());

      await expect(provider.generateResponse('Fix this')).rejects.toThrow(
        'No response content from Ollama'
      );
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', () => {
      provider.client = {};
      provider.cleanup();
      expect(provider.client).toBeNull();
    });
  });
});
