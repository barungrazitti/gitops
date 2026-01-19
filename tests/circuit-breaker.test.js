/**
 * Unit tests for CircuitBreaker
 */

describe('CircuitBreaker', () => {
  let CircuitBreaker;
  let circuitBreaker;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    CircuitBreaker = require('../src/core/circuit-breaker');
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      timeout: 1000,
      monitoringPeriod: 100
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const cb = new CircuitBreaker();
      expect(cb.failureThreshold).toBe(5);
      expect(cb.timeout).toBe(60000);
      expect(cb.state).toBe('CLOSED');
    });

    it('should initialize with custom options', () => {
      const cb = new CircuitBreaker({
        failureThreshold: 10,
        timeout: 5000,
        monitoringPeriod: 2000
      });
      expect(cb.failureThreshold).toBe(10);
      expect(cb.timeout).toBe(5000);
      expect(cb.monitoringPeriod).toBe(2000);
    });

    it('should initialize metrics', () => {
      expect(circuitBreaker.metrics).toBeDefined();
      expect(circuitBreaker.metrics.totalRequests).toBe(0);
      expect(circuitBreaker.metrics.successfulRequests).toBe(0);
      expect(circuitBreaker.metrics.failedRequests).toBe(0);
    });
  });

  describe('execute', () => {
    it('should execute operation successfully when CLOSED', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const context = { provider: 'test' };

      const result = await circuitBreaker.execute(operation, context);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.metrics.successfulRequests).toBe(1);
    });

    it('should execute operation successfully in HALF_OPEN state', async () => {
      circuitBreaker.setState('HALF_OPEN');
      const operation = jest.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should throw when OPEN and timeout not elapsed', async () => {
      circuitBreaker.setState('OPEN');
      circuitBreaker.lastFailureTime = Date.now();
      const operation = jest.fn();

      await expect(circuitBreaker.execute(operation))
        .rejects.toThrow('Circuit breaker is OPEN');
      expect(operation).not.toHaveBeenCalled();
    });

    it('should transition to HALF_OPEN when timeout elapsed', async () => {
      circuitBreaker.setState('OPEN');
      circuitBreaker.lastFailureTime = Date.now() - 2000; // 2 seconds ago
      const operation = jest.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should handle operation failure', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('fail'));
      const context = { provider: 'test' };

      await expect(circuitBreaker.execute(operation, context))
        .rejects.toThrow('fail');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.metrics.failedRequests).toBe(1);
    });

    it('should increment failure count on error', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('fail'));

      await expect(circuitBreaker.execute(operation))
        .rejects.toThrow('fail');
      expect(circuitBreaker.failureCount).toBe(1);
    });

    it('should open circuit after threshold failures', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('fail'));

      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch (e) {}
      }

      expect(circuitBreaker.failureCount).toBe(3);
      expect(circuitBreaker.state).toBe('OPEN');
    });

    it('should decrement failure count on success in CLOSED state', async () => {
      circuitBreaker.failureCount = 2;
      const operation = jest.fn().mockResolvedValue('success');

      await circuitBreaker.execute(operation);

      expect(circuitBreaker.failureCount).toBe(1);
    });
  });

  describe('setState', () => {
    it('should transition to CLOSED state', () => {
      circuitBreaker.setState('OPEN');
      circuitBreaker.setState('CLOSED');

      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.failureCount).toBe(0);
    });

    it('should transition to OPEN state', () => {
      circuitBreaker.setState('OPEN');

      expect(circuitBreaker.state).toBe('OPEN');
      expect(circuitBreaker.lastFailureTime).toBeDefined();
    });

    it('should transition to HALF_OPEN state', () => {
      circuitBreaker.setState('HALF_OPEN');

      expect(circuitBreaker.state).toBe('HALF_OPEN');
    });
  });

  describe('getStatus', () => {
    it('should return status object', () => {
      circuitBreaker.failureCount = 2;

      const status = circuitBreaker.getStatus();

      expect(status).toHaveProperty('state', 'CLOSED');
      expect(status).toHaveProperty('failureCount', 2);
      expect(status).toHaveProperty('isOpen', false);
      expect(status).toHaveProperty('failureThreshold', 3);
    });
  });

  describe('reset', () => {
    it('should reset circuit breaker to initial state', () => {
      circuitBreaker.failureCount = 5;
      circuitBreaker.state = 'OPEN';
      circuitBreaker.successCount = 2;

      circuitBreaker.reset();

      expect(circuitBreaker.state).toBe('CLOSED');
      expect(circuitBreaker.failureCount).toBe(0);
      expect(circuitBreaker.successCount).toBe(0);
      expect(circuitBreaker.metrics.totalRequests).toBe(0);
    });
  });

  describe('onSuccess', () => {
    it('should update metrics on success', () => {
      circuitBreaker.onSuccess(100);

      expect(circuitBreaker.metrics.successfulRequests).toBe(1);
      expect(circuitBreaker.metrics.averageResponseTime).toBe(100);
    });
  });

  describe('onFailure', () => {
    it('should update metrics on failure', () => {
      const error = new Error('test error');

      circuitBreaker.onFailure(error, 50, { provider: 'test' });

      expect(circuitBreaker.metrics.failedRequests).toBe(1);
      expect(circuitBreaker.failureCount).toBe(1);
      expect(circuitBreaker.lastFailureTime).toBeDefined();
    });
  });
});
