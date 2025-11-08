/**
 * Unit tests for Circuit Breaker
 */

const CircuitBreaker = require('../src/core/circuit-breaker');

describe('CircuitBreaker', () => {
  let circuitBreaker;
  let mockFn;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFn = jest.fn();
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      timeout: 1000,
      monitoringPeriod: 500,
    });
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const cb = new CircuitBreaker();

      expect(cb.failureThreshold).toBe(5);
      expect(cb.timeout).toBe(60000);
      expect(cb.monitoringPeriod).toBe(60000);
      expect(cb.state).toBe('CLOSED');
      expect(cb.failureCount).toBe(0);
      expect(cb.lastFailureTime).toBe(null);
      expect(cb.successCount).toBe(0);
      expect(cb.totalRequests).toBe(0);
    });

    it('should initialize with custom values', () => {
      const cb = new CircuitBreaker({
        failureThreshold: 10,
        timeout: 5000,
        monitoringPeriod: 30000,
      });

      expect(cb.failureThreshold).toBe(10);
      expect(cb.timeout).toBe(5000);
      expect(cb.monitoringPeriod).toBe(30000);
    });
  });

  describe('execute', () => {
    it('should execute function successfully when closed', async () => {
      mockFn.mockResolvedValue('success');

      const result = await circuitBreaker.execute(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.successCount).toBe(1);
      expect(circuitBreaker.failureCount).toBe(0);
      expect(circuitBreaker.totalRequests).toBe(1);
    });

    it('should handle function failure when closed', async () => {
      mockFn.mockRejectedValue(new Error('Test error'));

      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Test error');
      expect(circuitBreaker.failureCount).toBe(1);
      expect(circuitBreaker.successCount).toBe(0);
      expect(circuitBreaker.totalRequests).toBe(1);
    });

    it('should open circuit when failure threshold reached', async () => {
      mockFn.mockRejectedValue(new Error('Test error'));

      // Fail 3 times to reach threshold
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.state).toBe('OPEN');
      expect(circuitBreaker.failureCount).toBe(3);
    });

    it('should reject immediately when circuit is open', async () => {
      // First, open the circuit
      mockFn.mockRejectedValue(new Error('Test error'));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected to fail
        }
      }

      // Now circuit should be open
      mockFn.mockResolvedValue('success'); // Function would work now
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Circuit breaker is OPEN');

      // Original function should not be called
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should transition to half-open after timeout', async () => {
      // Open the circuit first
      mockFn.mockRejectedValue(new Error('Test error'));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.state).toBe('OPEN');

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 600));

      // Next call should put circuit in half-open state
      mockFn.mockResolvedValue('success');
      const result = await circuitBreaker.execute(mockFn);

      expect(result).toBe('success');
      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.failureCount).toBe(0); // Should reset on success
    });

    it('should handle non-async functions', async () => {
      mockFn.mockReturnValue('sync-success');

      const result = await circuitBreaker.execute(mockFn);

      expect(result).toBe('sync-success');
    });

    it('should pass arguments to function', async () => {
      mockFn.mockReturnValue('result');

      await circuitBreaker.execute(mockFn, 'arg1', 'arg2');

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      expect(circuitBreaker.getState()).toBe('CLOSED');

      // Manually change state for testing
      circuitBreaker.state = 'OPEN';
      expect(circuitBreaker.getState()).toBe('OPEN');
    });
  });

  describe('reset', () => {
    it('should reset circuit breaker to initial state', async () => {
      // Open the circuit first
      mockFn.mockRejectedValue(new Error('Test error'));
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.state).toBe('OPEN');
      expect(circuitBreaker.failureCount).toBe(3);

      // Reset
      circuitBreaker.reset();

      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.failureCount).toBe(0);
      expect(circuitBreaker.successCount).toBe(0);
      expect(circuitBreaker.totalRequests).toBe(0);
      expect(circuitBreaker.lastFailureTime).toBe(null);
    });
  });

  describe('stats', () => {
    it('should return circuit breaker statistics', async () => {
      // Execute some requests to generate stats
      mockFn.mockResolvedValue('success');
      await circuitBreaker.execute(mockFn);

      mockFn.mockRejectedValue(new Error('Test error'));
      try {
        await circuitBreaker.execute(mockFn);
      } catch (error) {
        // Expected to fail
      }

      const stats = circuitBreaker.getStats();

      expect(stats).toMatchObject({
        state: 'CLOSED',
        failureCount: 1,
        successCount: 1,
        totalRequests: 2,
        successRate: 50,
        failureThreshold: 3,
        timeout: 1000,
        monitoringPeriod: 500,
      });
    });

    it('should handle zero requests', () => {
      const stats = circuitBreaker.getStats();

      expect(stats.successRate).toBe(0);
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle function throwing non-Error', async () => {
      mockFn.mockImplementation(() => {
        throw 'string error';
      });

      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('string error');
      expect(circuitBreaker.failureCount).toBe(1);
    });

    it('should handle undefined return value', async () => {
      mockFn.mockReturnValue(undefined);

      const result = await circuitBreaker.execute(mockFn);

      expect(result).toBeUndefined();
      expect(circuitBreaker.successCount).toBe(1);
    });

    it('should handle rejection with undefined error', async () => {
      mockFn.mockRejectedValue(undefined);

      await expect(circuitBreaker.execute(mockFn)).rejects.toBeUndefined();
      expect(circuitBreaker.failureCount).toBe(1);
    });
  });

  describe('timeout behavior', () => {
    it('should handle slow function execution', async () => {
      // Mock slow function
      mockFn.mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 200));
      });

      const startTime = Date.now();
      const result = await circuitBreaker.execute(mockFn);
      const endTime = Date.now();

      expect(result).toBeUndefined();
      expect(endTime - startTime).toBeGreaterThanOrEqual(200);
    });
  });
});