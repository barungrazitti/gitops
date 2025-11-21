/**
 * Comprehensive Edge Case Tests for Circuit Breaker
 * Tests circuit breaker under extreme conditions and failure scenarios
 */

const CircuitBreaker = require('../src/core/circuit-breaker');

describe('Circuit Breaker Extreme Edge Cases', () => {
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

  describe('Extreme Failure Scenarios', () => {
    it('should handle rapid successive failures', async () => {
      mockFn.mockRejectedValue(new Error('Rapid failure'));

      // Execute 10 failures rapidly
      const promises = Array(10).fill(null).map(() => 
        circuitBreaker.execute(mockFn).catch(e => e.message)
      );

      const results = await Promise.all(promises);
      
      // First 3 should fail with original error, rest with circuit breaker open
      expect(results.slice(0, 3).every(r => r === 'Rapid failure')).toBe(true);
      expect(results.slice(3).every(r => r.includes('Circuit breaker is OPEN'))).toBe(true);
    });

    it('should handle mixed success and failure patterns', async () => {
      let callCount = 0;
      mockFn.mockImplementation(() => {
        callCount++;
        if (callCount % 3 === 0) {
          return Promise.resolve('success');
        }
        return Promise.reject(new Error('pattern failure'));
      });

      const promises = Array(10).fill(null).map(() => 
        circuitBreaker.execute(mockFn).catch(e => e.message)
      );

      const results = await Promise.all(promises);
      const successes = results.filter(r => r === 'success');
      const failures = results.filter(r => r.includes('pattern failure'));
      const circuitOpen = results.filter(r => r.includes('Circuit breaker is OPEN'));

      expect(successes.length).toBeGreaterThan(0);
      expect(failures.length).toBeGreaterThan(0);
    });

    it('should handle failure with different error types', async () => {
      const errors = [
        new Error('Standard error'),
        new TypeError('Type error'),
        new RangeError('Range error'),
        'String error',
        500,
        null,
        undefined,
        { custom: 'object error' }
      ];

      for (const error of errors) {
        mockFn.mockRejectedValueOnce(error);
        
        try {
          await circuitBreaker.execute(mockFn);
        } catch (e) {
          // Should handle all error types gracefully
          expect(e).toBeDefined();
        }
      }

      const stats = circuitBreaker.getStats();
      expect(stats.failedRequests).toBe(errors.length);
    });

    it('should handle extremely slow operations', async () => {
      mockFn.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 2000))
      );

      const startTime = Date.now();
      await circuitBreaker.execute(mockFn);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThan(1900);
      
      const stats = circuitBreaker.getStats();
      expect(stats.successfulRequests).toBe(1);
      expect(stats.averageResponseTime).toBeGreaterThan(1900);
    });
  });

  describe('State Transition Edge Cases', () => {
    it('should handle rapid state changes', async () => {
      mockFn.mockImplementation(() => {
        const random = Math.random();
        if (random < 0.3) {
          return Promise.resolve('success');
        }
        return Promise.reject(new Error('random failure'));
      });

      // Execute many operations to trigger state changes
      for (let i = 0; i < 20; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Ignore failures for this test
        }
      }

      const stats = circuitBreaker.getStats();
      expect(stats.totalRequests).toBe(20);
      expect(['CLOSED', 'OPEN', 'HALF_OPEN']).toContain(stats.state);
    });

    it('should handle state transition during timeout period', async () => {
      // Open the circuit first
      mockFn.mockRejectedValue(new Error('Initial failure'));
      
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getState()).toBe('OPEN');

      // Wait for timeout period
      await new Promise(resolve => setTimeout(resolve, 600));

      // Next call should transition to HALF_OPEN
      mockFn.mockResolvedValue('success after timeout');
      
      const result = await circuitBreaker.execute(mockFn);
      expect(result).toBe('success after timeout');
      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
    });

    it('should handle immediate re-opening after half-open failure', async () => {
      // Open circuit
      mockFn.mockRejectedValue(new Error('Failure'));
      for (let i = 0; i < 3; i++) {
        try { await circuitBreaker.execute(mockFn); } catch (e) {}
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 600));

      // Fail in half-open state
      mockFn.mockRejectedValue(new Error('Half-open failure'));
      
      try {
        await circuitBreaker.execute(mockFn);
      } catch (error) {
        expect(error.message).toBe('Half-open failure');
      }

      expect(circuitBreaker.getState()).toBe('OPEN');
    });

    it('should handle multiple consecutive successes in half-open', async () => {
      // Open circuit
      mockFn.mockRejectedValue(new Error('Failure'));
      for (let i = 0; i < 3; i++) {
        try { await circuitBreaker.execute(mockFn); } catch (e) {}
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 600));

      // Multiple successes to close circuit
      mockFn.mockResolvedValue('success');
      
      await circuitBreaker.execute(mockFn); // First success
      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
      
      await circuitBreaker.execute(mockFn); // Second success
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });
  });

  describe('Concurrent Access Edge Cases', () => {
    it('should handle concurrent executions during state transition', async () => {
      // Open circuit first
      mockFn.mockRejectedValue(new Error('Initial failure'));
      for (let i = 0; i < 3; i++) {
        try { await circuitBreaker.execute(mockFn); } catch (e) {}
      }

      // Wait for timeout period
      await new Promise(resolve => setTimeout(resolve, 600));

      // Execute multiple concurrent requests during transition
      mockFn.mockResolvedValue('concurrent success');
      
      const promises = Array(10).fill(null).map(() => 
        circuitBreaker.execute(mockFn)
      );

      const results = await Promise.all(promises);
      expect(results.every(r => r === 'concurrent success')).toBe(true);
    });

    it('should handle concurrent failures', async () => {
      mockFn.mockRejectedValue(new Error('Concurrent failure'));

      const promises = Array(10).fill(null).map(() => 
        circuitBreaker.execute(mockFn).catch(e => e.message)
      );

      const results = await Promise.all(promises);
      
      // Should handle concurrent failures gracefully
      expect(results.every(r => r === 'Concurrent failure' || r.includes('Circuit breaker is OPEN'))).toBe(true);
    });

    it('should handle mixed concurrent operations', async () => {
      let callCount = 0;
      mockFn.mockImplementation(() => {
        callCount++;
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            if (callCount % 2 === 0) {
              resolve('success');
            } else {
              reject(new Error('failure'));
            }
          }, Math.random() * 100);
        });
      });

      const promises = Array(20).fill(null).map(() => 
        circuitBreaker.execute(mockFn).catch(e => e.message)
      );

      const results = await Promise.all(promises);
      const successes = results.filter(r => r === 'success');
      const failures = results.filter(r => r === 'failure');
      const circuitOpen = results.filter(r => r.includes('Circuit breaker is OPEN'));

      expect(successes.length + failures.length + circuitOpen.length).toBe(20);
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle large number of operations without memory leaks', async () => {
      mockFn.mockResolvedValue('memory test success');

      // Execute many operations
      for (let i = 0; i < 1000; i++) {
        await circuitBreaker.execute(mockFn);
      }

      const stats = circuitBreaker.getStats();
      expect(stats.totalRequests).toBe(1000);
      expect(stats.successfulRequests).toBe(1000);
      expect(stats.successRate).toBe(100);
    });

    it('should handle very fast operations', async () => {
      mockFn.mockReturnValue('instant success');

      const startTime = Date.now();
      
      // Execute many fast operations
      for (let i = 0; i < 100; i++) {
        await circuitBreaker.execute(mockFn);
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete quickly (under 1 second for 100 operations)
      expect(totalTime).toBeLessThan(1000);
      
      const stats = circuitBreaker.getStats();
      expect(stats.totalRequests).toBe(100);
    });

    it('should handle operations with varying response times', async () => {
      const responseTimes = [10, 50, 100, 200, 500, 1000];
      let timeIndex = 0;

      mockFn.mockImplementation(() => {
        const delay = responseTimes[timeIndex % responseTimes.length];
        timeIndex++;
        return new Promise(resolve => setTimeout(resolve, delay));
      });

      // Execute operations with varying times
      for (let i = 0; i < responseTimes.length * 2; i++) {
        await circuitBreaker.execute(mockFn);
      }

      const stats = circuitBreaker.getStats();
      expect(stats.averageResponseTime).toBeGreaterThan(0);
      expect(stats.averageResponseTime).toBeLessThan(1000);
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle zero failure threshold', () => {
      const cb = new CircuitBreaker({
        failureThreshold: 0,
        timeout: 1000,
        monitoringPeriod: 500
      });

      expect(cb.failureThreshold).toBe(0);
    });

    it('should handle negative timeout', () => {
      const cb = new CircuitBreaker({
        failureThreshold: 5,
        timeout: -1000,
        monitoringPeriod: 500
      });

      expect(cb.timeout).toBe(-1000);
    });

    it('should handle zero monitoring period', () => {
      const cb = new CircuitBreaker({
        failureThreshold: 5,
        timeout: 1000,
        monitoringPeriod: 0
      });

      expect(cb.monitoringPeriod).toBe(0);
    });

    it('should handle extremely large values', () => {
      const cb = new CircuitBreaker({
        failureThreshold: Number.MAX_SAFE_INTEGER,
        timeout: Number.MAX_SAFE_INTEGER,
        monitoringPeriod: Number.MAX_SAFE_INTEGER
      });

      expect(cb.failureThreshold).toBe(Number.MAX_SAFE_INTEGER);
      expect(cb.timeout).toBe(Number.MAX_SAFE_INTEGER);
      expect(cb.monitoringPeriod).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle floating point values', () => {
      const cb = new CircuitBreaker({
        failureThreshold: 3.7,
        timeout: 1500.5,
        monitoringPeriod: 750.25
      });

      expect(cb.failureThreshold).toBe(3.7);
      expect(cb.timeout).toBe(1500.5);
      expect(cb.monitoringPeriod).toBe(750.25);
    });
  });

  describe('Statistics and Metrics Edge Cases', () => {
    it('should handle statistics calculation with zero requests', () => {
      const stats = circuitBreaker.getStats();
      
      expect(stats.successRate).toBe(100); // Should default to 100% for no requests
      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(0);
    });

    it('should handle statistics with only failures', async () => {
      mockFn.mockRejectedValue(new Error('All failures'));

      for (let i = 0; i < 10; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected
        }
      }

      const stats = circuitBreaker.getStats();
      expect(stats.successRate).toBe(0);
      expect(stats.totalRequests).toBe(10);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(10);
    });

    it('should handle statistics with mixed results', async () => {
      let callCount = 0;
      mockFn.mockImplementation(() => {
        callCount++;
        if (callCount <= 7) {
          return Promise.resolve('success');
        }
        return Promise.reject(new Error('failure'));
      });

      // 7 successes, 3 failures
      for (let i = 0; i < 10; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected for failures
        }
      }

      const stats = circuitBreaker.getStats();
      expect(stats.successRate).toBe(70);
      expect(stats.totalRequests).toBe(10);
      expect(stats.successfulRequests).toBe(7);
      expect(stats.failedRequests).toBe(3);
    });

    it('should handle average response time calculation', async () => {
      const responseTimes = [100, 200, 300, 400, 500];
      let timeIndex = 0;

      mockFn.mockImplementation(() => {
        const delay = responseTimes[timeIndex % responseTimes.length];
        timeIndex++;
        return new Promise(resolve => setTimeout(resolve, delay));
      });

      for (let i = 0; i < 5; i++) {
        await circuitBreaker.execute(mockFn);
      }

      const stats = circuitBreaker.getStats();
      expect(stats.averageResponseTime).toBeGreaterThan(0);
      expect(stats.averageResponseTime).toBeLessThan(500);
    });
  });

  describe('Reset and Cleanup Edge Cases', () => {
    it('should handle reset during active operations', async () => {
      mockFn.mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 200));
      });

      // Start some operations
      const promises = Array(5).fill(null).map(() => circuitBreaker.execute(mockFn));
      
      // Reset during operations
      circuitBreaker.reset();
      
      // Operations should still complete
      const results = await Promise.all(promises);
      expect(results.every(r => r === undefined)).toBe(true);
      
      // Stats should be reset
      const stats = circuitBreaker.getStats();
      expect(stats.totalRequests).toBe(0);
    });

    it('should handle multiple rapid resets', () => {
      for (let i = 0; i < 10; i++) {
        circuitBreaker.reset();
      }

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe('CLOSED');
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
    });

    it('should handle reset after extreme failure count', async () => {
      mockFn.mockRejectedValue(new Error('Massive failure'));

      // Generate many failures
      for (let i = 0; i < 100; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe('OPEN');

      // Reset should clear all state
      circuitBreaker.reset();

      expect(circuitBreaker.getState()).toBe('CLOSED');
      expect(circuitBreaker.getStats().totalRequests).toBe(0);
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle function that throws synchronously', async () => {
      mockFn.mockImplementation(() => {
        throw new Error('Synchronous error');
      });

      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Synchronous error');
      
      const stats = circuitBreaker.getStats();
      expect(stats.failedRequests).toBe(1);
    });

    it('should handle function that returns undefined', async () => {
      mockFn.mockReturnValue(undefined);

      const result = await circuitBreaker.execute(mockFn);
      expect(result).toBeUndefined();
      
      const stats = circuitBreaker.getStats();
      expect(stats.successfulRequests).toBe(1);
    });

    it('should handle function that returns null', async () => {
      mockFn.mockReturnValue(null);

      const result = await circuitBreaker.execute(mockFn);
      expect(result).toBeNull();
      
      const stats = circuitBreaker.getStats();
      expect(stats.successfulRequests).toBe(1);
    });

    it('should handle function that rejects with undefined', async () => {
      mockFn.mockRejectedValue(undefined);

      await expect(circuitBreaker.execute(mockFn)).rejects.toBeUndefined();
      
      const stats = circuitBreaker.getStats();
      expect(stats.failedRequests).toBe(1);
    });
  });

  describe('Timing and Concurrency Edge Cases', () => {
    it('should handle operations that complete exactly at timeout boundary', async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 3,
        timeout: 100,
        monitoringPeriod: 50
      });

      mockFn.mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 100));
      });

      const startTime = Date.now();
      await cb.execute(mockFn);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    it('should handle operations with microsecond timing', async () => {
      mockFn.mockImplementation(() => {
        return new Promise(resolve => {
          setImmediate(() => resolve('micro success'));
        });
      });

      const result = await circuitBreaker.execute(mockFn);
      expect(result).toBe('micro success');
    });

    it('should handle concurrent operations with different timeouts', async () => {
      const cb1 = new CircuitBreaker({ timeout: 100 });
      const cb2 = new CircuitBreaker({ timeout: 200 });

      mockFn.mockImplementation((delay) => {
        return new Promise(resolve => setTimeout(resolve, delay));
      });

      const promises = [
        cb1.execute(() => mockFn(50)),
        cb2.execute(() => mockFn(150)),
        cb1.execute(() => mockFn(75)),
        cb2.execute(() => mockFn(100))
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(4);
    });
  });

  describe('Resource Management Edge Cases', () => {
    it('should handle disposal during active operations', async () => {
      mockFn.mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 200));
      });

      const promise = circuitBreaker.execute(mockFn);
      
      // Dispose during operation
      circuitBreaker.dispose();
      
      // Operation should still complete
      const result = await promise;
      expect(result).toBeUndefined();
    });

    it('should handle multiple disposal calls', () => {
      expect(() => {
        circuitBreaker.dispose();
        circuitBreaker.dispose();
        circuitBreaker.dispose();
      }).not.toThrow();
    });

    it('should handle operations after disposal', async () => {
      circuitBreaker.dispose();
      
      mockFn.mockResolvedValue('post-disposal success');
      
      const result = await circuitBreaker.execute(mockFn);
      expect(result).toBe('post-disposal success');
    });
  });
});