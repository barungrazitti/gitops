/**
 * CircuitBreaker Tests
 */

describe('CircuitBreaker', () => {
  let CircuitBreaker;
  let circuitBreaker;

  beforeEach(() => {
    jest.resetModules();
    CircuitBreaker = require('../../src/utils/circuit-breaker');
    circuitBreaker = new CircuitBreaker({
      threshold: 3,
      resetTimeout: 1000,
    });
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const cb = new CircuitBreaker();
      expect(cb.options.threshold).toBe(5);
      expect(cb.options.resetTimeout).toBe(30000);
      expect(cb.state).toBe('CLOSED');
    });

    it('should initialize with custom options', () => {
      expect(circuitBreaker.options.threshold).toBe(3);
      expect(circuitBreaker.options.resetTimeout).toBe(1000);
      expect(circuitBreaker.state).toBe('CLOSED');
    });
  });

  describe('canExecute', () => {
    it('should return true in CLOSED state', () => {
      expect(circuitBreaker.canExecute()).toBe(true);
    });

    it('should return false in OPEN state before timeout', () => {
      circuitBreaker.state = 'OPEN';
      circuitBreaker.nextAttemptTime = Date.now() + 10000;
      expect(circuitBreaker.canExecute()).toBe(false);
    });

    it('should transition to HALF_OPEN and return true after timeout', () => {
      circuitBreaker.state = 'OPEN';
      circuitBreaker.nextAttemptTime = Date.now() - 100;
      expect(circuitBreaker.canExecute()).toBe(true);
      expect(circuitBreaker.state).toBe('HALF_OPEN');
    });

    it('should return true in HALF_OPEN before success', () => {
      circuitBreaker.state = 'HALF_OPEN';
      circuitBreaker.successOnHalfOpen = false;
      expect(circuitBreaker.canExecute()).toBe(true);
    });

    it('should return false in HALF_OPEN after success', () => {
      circuitBreaker.state = 'HALF_OPEN';
      circuitBreaker.successOnHalfOpen = true;
      expect(circuitBreaker.canExecute()).toBe(false);
    });
  });

  describe('onSuccess', () => {
    it('should reset failure count and close circuit', () => {
      circuitBreaker.failureCount = 5;
      circuitBreaker.state = 'HALF_OPEN';
      circuitBreaker.onSuccess();
      expect(circuitBreaker.failureCount).toBe(0);
      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.successOnHalfOpen).toBe(true);
    });
  });

  describe('onFailure', () => {
    it('should increment failure count', () => {
      circuitBreaker.onFailure();
      expect(circuitBreaker.failureCount).toBe(1);
    });

    it('should open circuit when threshold reached', () => {
      circuitBreaker.options.threshold = 3;
      circuitBreaker.onFailure();
      circuitBreaker.onFailure();
      circuitBreaker.onFailure();
      expect(circuitBreaker.state).toBe('OPEN');
      expect(circuitBreaker.lastFailureTime).not.toBeNull();
    });
  });

  describe('getState', () => {
    it('should return complete state object', () => {
      const state = circuitBreaker.getState();
      expect(state).toHaveProperty('state', 'CLOSED');
      expect(state).toHaveProperty('failureCount', 0);
      expect(state).toHaveProperty('threshold', 3);
      expect(state).toHaveProperty('isOpen', false);
      expect(state).toHaveProperty('isClosed', true);
      expect(state).toHaveProperty('isHalfOpen', false);
    });

    it('should calculate timeUntilReset when open', () => {
      circuitBreaker.state = 'OPEN';
      circuitBreaker.nextAttemptTime = Date.now() + 5000;
      const state = circuitBreaker.getState();
      expect(state.timeUntilReset).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      circuitBreaker.state = 'OPEN';
      circuitBreaker.failureCount = 10;
      circuitBreaker.successOnHalfOpen = true;
      circuitBreaker.lastFailureTime = Date.now();
      circuitBreaker.nextAttemptTime = Date.now() + 10000;

      circuitBreaker.reset();

      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.failureCount).toBe(0);
      expect(circuitBreaker.successOnHalfOpen).toBe(false);
      expect(circuitBreaker.lastFailureTime).toBeNull();
      expect(circuitBreaker.nextAttemptTime).toBeNull();
    });
  });

  describe('execute', () => {
    it('should execute function successfully', async () => {
      const result = await circuitBreaker.execute(async () => 'success');
      expect(result).toBe('success');
      expect(circuitBreaker.state).toBe('CLOSED');
    });

    it('should throw when circuit is open', async () => {
      circuitBreaker.state = 'OPEN';
      circuitBreaker.nextAttemptTime = Date.now() + 10000;

      await expect(
        circuitBreaker.execute(async () => 'should not run')
      ).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should record failure on error', async () => {
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Test error');
        });
      } catch (e) {
        // Expected
      }
      expect(circuitBreaker.failureCount).toBe(1);
    });

    it('should transition to half-open when OPEN and timeout expires', async () => {
      circuitBreaker.state = 'OPEN';
      circuitBreaker.nextAttemptTime = Date.now() - 100;

      // canExecute() should transition to HALF_OPEN
      expect(circuitBreaker.canExecute()).toBe(true);
      expect(circuitBreaker.state).toBe('HALF_OPEN');
    });
  });
});