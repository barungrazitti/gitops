/**
 * Unit tests for AIProviderFactory instance sharing
 */

const AIProviderFactory = require('../src/providers/ai-provider-factory');

describe('AIProviderFactory', () => {
  afterEach(() => {
    AIProviderFactory.resetInstances();
  });

  describe('create()', () => {
    it('returns the SAME instance for repeated create() calls with identical deps', () => {
      const deps = { configManager: { get: jest.fn() }, activityLogger: { info: jest.fn() } };

      const first = AIProviderFactory.create('groq', deps);
      const second = AIProviderFactory.create('groq', deps);

      expect(second).toBe(first);
    });

    it('returns a new instance when the injected deps change identity', () => {
      const depsA = { configManager: { get: jest.fn() }, activityLogger: { info: jest.fn() } };
      const depsB = { configManager: { get: jest.fn() }, activityLogger: { info: jest.fn() } };

      const first = AIProviderFactory.create('groq', depsA);
      const second = AIProviderFactory.create('groq', depsB);

      expect(second).not.toBe(first);
    });

    it('resetInstances() forces a new instance on the next create()', () => {
      const deps = { configManager: { get: jest.fn() }, activityLogger: { info: jest.fn() } };

      const first = AIProviderFactory.create('groq', deps);
      AIProviderFactory.resetInstances();
      const second = AIProviderFactory.create('groq', deps);

      expect(second).not.toBe(first);
    });

    it('preserves circuit breaker continuity across create() calls', () => {
      const deps = { configManager: { get: jest.fn() }, activityLogger: { info: jest.fn() } };

      const first = AIProviderFactory.create('groq', deps);
      const second = AIProviderFactory.create('groq', deps);

      expect(second.circuitBreaker).toBe(first.circuitBreaker);
    });

    it('still validates the provider name', () => {
      expect(() => AIProviderFactory.create()).toThrow('Provider name is required');
      expect(() => AIProviderFactory.create('bogus')).toThrow('Unsupported AI provider');
    });
  });
});
