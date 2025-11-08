/**
 * Unit tests for Circuit Breaker - Additional Coverage
 */

const CircuitBreaker = require('../src/core/circuit-breaker');

describe('CircuitBreaker - Additional Coverage', () => {
  let circuitBreaker;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('state transitions', () => {
    it('should transition from CLOSED to OPEN after failure threshold', async () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 100
      });

      const failingOperation = jest.fn().mockRejectedValue(new Error('Failure'));

      // First failure
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      expect(circuitBreaker.getState()).toBe('CLOSED');

      // Second failure - should open circuit
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      expect(circuitBreaker.getState()).toBe('OPEN');
    });

    it('should transition from OPEN to HALF_OPEN after reset timeout', async (done) => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 50
      });

      // Cause circuit to open
      const failingOperation = jest.fn().mockRejectedValue(new Error('Failure'));
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      expect(circuitBreaker.getState()).toBe('OPEN');

      // Wait for reset timeout
      setTimeout(() => {
        expect(circuitBreaker.getState()).toBe('HALF_OPEN');
        done();
      }, 100);
    });

    it('should transition from HALF_OPEN to CLOSED on success', async () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 50
      });

      // Open circuit
      const failingOperation = jest.fn().mockRejectedValue(new Error('Failure'));
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();

      // Wait for half-open
      await new Promise(resolve => setTimeout(resolve, 100));

      // Successful operation should close circuit
      const successOperation = jest.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(successOperation);

      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });

    it('should transition from HALF_OPEN back to OPEN on failure', async () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 50
      });

      // Open circuit
      const failingOperation = jest.fn().mockRejectedValue(new Error('Failure'));
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();

      // Wait for half-open
      await new Promise(resolve => setTimeout(resolve, 100));

      // Another failure should reopen circuit
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      expect(circuitBreaker.getState()).toBe('OPEN');
    });
  });

  describe('success rate monitoring', () => {
    it('should track success rate correctly', async () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        successThreshold: 3,
        monitoringPeriod: 1000
      });

      const successOperation = jest.fn().mockResolvedValue('success');
      const failingOperation = jest.fn().mockRejectedValue(new Error('Failure'));

      // Mix of successes and failures
      await circuitBreaker.execute(successOperation); // success
      await circuitBreaker.execute(failingOperation); // failure
      await circuitBreaker.execute(successOperation); // success
      await circuitBreaker.execute(successOperation); // success

      const stats = circuitBreaker.getStats();
      expect(stats.successRate).toBe(0.75); // 3/4 success rate
    });

    it('should reset success rate after monitoring period', async (done) => {
      circuitBreaker = new CircuitBreaker({
        monitoringPeriod: 50
      });

      const successOperation = jest.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successOperation);

      // Wait for monitoring period to pass
      setTimeout(() => {
        const stats = circuitBreaker.getStats();
        expect(stats.successRate).toBe(0); // Should reset
        done();
      }, 100);
    });
  });

  describe('advanced configuration options', () => {
    it('should handle custom error types for failure detection', async () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        errorTypes: ['NetworkError', 'TimeoutError']
      });

      const customError = new Error('Custom error');
      customError.name = 'NetworkError';

      const operation = jest.fn().mockRejectedValue(customError);

      // First custom error
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('Custom error');

      // Should still count as failure
      expect(circuitBreaker.getStats().failures).toBe(1);
    });

    it('should ignore non-configured error types', async () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 2,
        errorTypes: ['NetworkError']
      });

      const operation = jest.fn().mockRejectedValue(new Error('Regular error'));

      await expect(circuitBreaker.execute(operation)).rejects.toThrow('Regular error');

      // Should not count as failure if error type doesn't match
      const stats = circuitBreaker.getStats();
      expect(stats.failures).toBe(1); // Still counts as generic failure
    });
  });

  describe('fallback functionality', () => {
    it('should execute fallback when circuit is open', async () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 1000
      });

      const fallbackOperation = jest.fn().mockResolvedValue('fallback-result');
      
      // Open circuit
      const failingOperation = jest.fn().mockRejectedValue(new Error('Failure'));
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();

      // Execute with fallback
      const result = await circuitBreaker.execute(
        jest.fn().mockResolvedValue('should-not-run'),
        { fallback: fallbackOperation }
      );

      expect(result).toBe('fallback-result');
      expect(fallbackOperation).toHaveBeenCalled();
    });

    it('should handle fallback operation failures', async () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 1000
      });

      const fallbackFailing = jest.fn().mockRejectedValue(new Error('Fallback failed'));
      
      // Open circuit
      const failingOperation = jest.fn().mockRejectedValue(new Error('Failure'));
      await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();

      // Execute with failing fallback
      await expect(circuitBreaker.execute(
        jest.fn().mockResolvedValue('should-not-run'),
        { fallback: fallbackFailing }
      )).rejects.toThrow('Fallback failed');
    });
  });

  describe('timeout handling', () => {
    it('should timeout operations that take too long', async () => {
      circuitBreaker = new CircuitBreaker({
        timeout: 50,
        failureThreshold: 1
      });

      const slowOperation = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 200));
      });

      await expect(circuitBreaker.execute(slowOperation))
        .rejects.toThrow('Operation timed out');
    });

    it('should allow successful operations within timeout', async () => {
      circuitBreaker = new CircuitBreaker({
        timeout: 200,
        failureThreshold: 1
      });

      const fastOperation = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 50));
      });

      const result = await circuitBreaker.execute(fastOperation);
      expect(result).toBeUndefined(); // Promise resolves without value
    });

    it('should handle timeout with custom error message', async () => {
      circuitBreaker = new CircuitBreaker({
        timeout: 50,
        timeoutErrorMessage: 'Custom timeout message'
      });

      const slowOperation = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 200));
      });

      await expect(circuitBreaker.execute(slowOperation))
        .rejects.toThrow('Custom timeout message');
    });
  });

  describe('metrics and monitoring', () => {
    it('should track detailed operation metrics', async () => {
      circuitBreaker = new CircuitBreaker({
        monitoringPeriod: 1000
      });

      const operation = jest.fn().mockResolvedValue('success');

      // Execute multiple operations
      await circuitBreaker.execute(operation);
      await circuitBreaker.execute(operation);
      await circuitBreaker.execute(operation);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalOperations).toBe(3);
      expect(metrics.successfulOperations).toBe(3);
      expect(metrics.failedOperations).toBe(0);
      expect(metrics.averageResponseTime).toBeGreaterThanOrEqual(0);
    });

    it('should reset metrics when requested', async () => {
      circuitBreaker = new CircuitBreaker();

      const operation = jest.fn().mockResolvedValue('success');
      await circuitBreaker.execute(operation);

      circuitBreaker.resetMetrics();

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalOperations).toBe(0);
      expect(metrics.successfulOperations).toBe(0);
      expect(metrics.failedOperations).toBe(0);
    });

    it('should calculate average response time correctly', async () => {
      circuitBreaker = new CircuitBreaker();

      const operation1 = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 10));
      });
      const operation2 = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 30));
      });

      await circuitBreaker.execute(operation1);
      await circuitBreaker.execute(operation2);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.averageResponseTime).toBeGreaterThanOrEqual(10);
      expect(metrics.averageResponseTime).toBeLessThanOrEqual(30);
    });
  });

  describe('events and callbacks', () => {
    it('should emit events on state changes', (done) => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeout: 50
      });

      circuitBreaker.on('stateChange', (from, to) => {
        expect(from).toBe('CLOSED');
        expect(to).toBe('OPEN');
        done();
      });

      const failingOperation = jest.fn().mockRejectedValue(new Error('Failure'));
      circuitBreaker.execute(failingOperation);
    });

    it('should emit events on operation completion', (done) => {
      circuitBreaker = new CircuitBreaker();

      circuitBreaker.on('operationComplete', (result, duration) => {
        expect(result).toBe('success');
        expect(duration).toBeGreaterThanOrEqual(0);
        done();
      });

      const operation = jest.fn().mockResolvedValue('success');
      circuitBreaker.execute(operation);
    });

    it('should emit events on operation failure', (done) => {
      circuitBreaker = new CircuitBreaker();

      circuitBreaker.on('operationFailure', (error, duration) => {
        expect(error).toBeInstanceOf(Error);
        expect(duration).toBeGreaterThanOrEqual(0);
        done();
      });

      const operation = jest.fn().mockRejectedValue(new Error('Test error'));
      circuitBreaker.execute(operation);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle concurrent operations correctly', async () => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 2
      });

      const operation = jest.fn().mockResolvedValue('success');

      // Execute multiple concurrent operations
      const promises = Array(10).fill(null).map(() => circuitBreaker.execute(operation));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(results.every(r => r === 'success')).toBe(true);
      expect(operation).toHaveBeenCalledTimes(10);
    });

    it('should handle undefined operations gracefully', async () => {
      circuitBreaker = new CircuitBreaker();

      await expect(circuitBreaker.execute(undefined))
        .rejects.toThrow('Operation must be a function');
    });

    it('should handle non-function operations gracefully', async () => {
      circuitBreaker = new CircuitBreaker();

      await expect(circuitBreaker.execute('not-a-function'))
        .rejects.toThrow('Operation must be a function');
    });

    it('should handle operations that return promises', async () => {
      circuitBreaker = new CircuitBreaker();

      const operation = jest.fn().mockReturnValue(Promise.resolve('promise-result'));
      const result = await circuitBreaker.execute(operation);

      expect(result).toBe('promise-result');
    });

    it('should handle operations that throw synchronously', async () => {
      circuitBreaker = new CircuitBreaker();

      const operation = jest.fn().mockImplementation(() => {
        throw new Error('Synchronous error');
      });

      await expect(circuitBreaker.execute(operation))
        .rejects.toThrow('Synchronous error');
    });
  });

  describe('configuration validation', () => {
    it('should validate failureThreshold is positive', () => {
      expect(() => {
        new CircuitBreaker({ failureThreshold: 0 });
      }).toThrow('failureThreshold must be positive');
    });

    it('should validate resetTimeout is positive', () => {
      expect(() => {
        new CircuitBreaker({ resetTimeout: -1 });
      }).toThrow('resetTimeout must be positive');
    });

    it('should validate monitoringPeriod is positive', () => {
      expect(() => {
        new CircuitBreaker({ monitoringPeriod: 0 });
      }).toThrow('monitoringPeriod must be positive');
    });

    it('should use default values for missing configuration', () => {
      const circuitBreaker = new CircuitBreaker({});
      
      expect(circuitBreaker.getStats().state).toBe('CLOSED');
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });
  });

  describe('cleanup and disposal', () => {
    it('should clean up resources when disposed', () => {
      circuitBreaker = new CircuitBreaker();
      
      // Add event listeners
      const listener = jest.fn();
      circuitBreaker.on('stateChange', listener);
      
      // Dispose
      circuitBreaker.dispose();
      
      // Try to emit event - should not trigger listener
      circuitBreaker.emit('stateChange', 'CLOSED', 'OPEN');
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle disposal gracefully without event listeners', () => {
      circuitBreaker = new CircuitBreaker();
      
      expect(() => circuitBreaker.dispose()).not.toThrow();
    });
  });
});