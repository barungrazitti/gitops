/**
 * Unit tests for OllamaProvider
 */

describe('OllamaProvider', () => {
  let OllamaProvider;
  let provider;
  let fetchSpy;

  const jsonResponse = (payload, { ok = true, status = 200, statusText = 'OK' } = {}) => ({
    ok,
    status,
    statusText,
    json: async () => payload,
  });

  // Module graph is built once per file: conf -> atomically registers a
  // process exit listener on every fresh require, and re-requiring it in
  // beforeEach (the old setup) tripped MaxListenersExceededWarning at the
  // 11th test. Each test still gets a brand-new provider + mock instances.
  beforeAll(() => {
    jest.resetModules();

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
  });

  beforeEach(() => {
    jest.clearAllMocks();

    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({}));

    provider = new OllamaProvider();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
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
      fetchSpy.mockResolvedValue(jsonResponse({}));

      const result = await provider.validate({});
      expect(result).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/tags'),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('should throw error when not running', async () => {
      fetchSpy.mockRejectedValue(new TypeError('fetch failed'));

      await expect(provider.validate({})).rejects.toThrow('Ollama is not running');
    });
  });

  describe('generateResponse', () => {
    it('should return response text for a plain string prompt', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ response: 'feat: add new feature' }));
      provider.circuitBreaker.execute.mockImplementation(cb => cb());

      const result = await provider.generateResponse('Generate a commit message for this diff');
      expect(result).toBe('feat: add new feature');
    });

    it('should pass systemPrompt through to the prompt body', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ response: 'ok' }));
      provider.circuitBreaker.execute.mockImplementation(cb => cb());

      await provider.generateResponse('prompt body', { systemPrompt: 'CUSTOM SYSTEM' });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('CUSTOM SYSTEM'),
        })
      );
    });

    it('should throw when response has no content', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ response: '' }));
      provider.circuitBreaker.execute.mockImplementation(cb => cb());

      await expect(provider.generateResponse('Fix this')).rejects.toThrow(
        'No response content from Ollama'
      );
    });

    it('should throw when the API responds with an error status', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({}, { ok: false, status: 500, statusText: 'Internal Server Error' })
      );
      provider.circuitBreaker.execute.mockImplementation(cb => cb());

      jest.useFakeTimers();
      try {
        const pending = provider.generateResponse('Fix this');
        const assertion = expect(pending).rejects.toThrow(
          'Ollama API error (500): Internal Server Error'
        );
        await jest.runAllTimersAsync();
        await assertion;
      } finally {
        jest.useRealTimers();
      }
    });

    it('should retry and then propagate a network refusal', async () => {
      jest.useFakeTimers();
      try {
        fetchSpy.mockRejectedValue(new TypeError('fetch failed'));
        provider.circuitBreaker.execute.mockImplementation(cb => cb());
        provider.activityLogger = { debug: jest.fn() };

        const pending = provider.generateResponse('Fix this');
        const assertion = expect(pending).rejects.toThrow('fetch failed');
        await jest.runAllTimersAsync();
        await assertion;

        expect(fetchSpy).toHaveBeenCalledTimes(3);
      } finally {
        jest.useRealTimers();
      }
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
