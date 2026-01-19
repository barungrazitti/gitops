/**
 * Unit tests for PerformanceUtils
 */

describe('PerformanceUtils', () => {
  let PerformanceUtils;

  beforeEach(() => {
    jest.resetModules();
    PerformanceUtils = require('../src/utils/performance-utils');
  });

  describe('estimateTokens', () => {
    it('should return 0 for null or undefined', () => {
      expect(PerformanceUtils.estimateTokens(null)).toBe(0);
      expect(PerformanceUtils.estimateTokens(undefined)).toBe(0);
    });

    it('should estimate tokens for text', () => {
      const tokens = PerformanceUtils.estimateTokens('hello world');
      expect(tokens).toBeGreaterThan(0);
    });

    it('should estimate tokens for code', () => {
      const tokens = PerformanceUtils.estimateTokens('function test() { return true; }');
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('isCodeContent', () => {
    it('should return true for JavaScript code', () => {
      expect(PerformanceUtils.isCodeContent('function test() { }')).toBe(true);
    });

    it('should return true for Python code', () => {
      expect(PerformanceUtils.isCodeContent('def test(): return True')).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(PerformanceUtils.isCodeContent('This is normal text')).toBe(false);
    });

    it('should handle empty string', () => {
      expect(PerformanceUtils.isCodeContent('')).toBe(false);
    });
  });

  describe('executeInParallel', () => {
    it('should execute tasks in parallel', async () => {
      const tasks = [
        () => Promise.resolve(1),
        () => Promise.resolve(2),
        () => Promise.resolve(3)
      ];

      const result = await PerformanceUtils.executeInParallel(tasks);
      expect(result.results).toEqual([1, 2, 3]);
    });

    it('should handle task errors', async () => {
      const tasks = [
        () => Promise.resolve(1),
        () => Promise.reject(new Error('fail')),
        () => Promise.resolve(3)
      ];

      const result = await PerformanceUtils.executeInParallel(tasks);
      expect(result.results).toEqual([1, 3]);
      expect(result.errors.length).toBe(1);
    });

    it('should handle empty array', async () => {
      const result = await PerformanceUtils.executeInParallel([]);
      expect(result.results).toEqual([]);
    });
  });

  describe('withTimeout', () => {
    it('should return value if completes before timeout', async () => {
      const promise = Promise.resolve('success');
      const result = await PerformanceUtils.withTimeout(promise, 1000);
      expect(result).toBe('success');
    });

    it('should throw if operation times out', async () => {
      const promise = new Promise(resolve => setTimeout(() => resolve('slow'), 200));
      await expect(PerformanceUtils.withTimeout(promise, 50))
        .rejects.toThrow('Operation timed out');
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should delay function execution', () => {
      const func = jest.fn();
      const debounced = PerformanceUtils.debounce(func, 100);
      
      debounced();
      expect(func).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(100);
      expect(func).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments', () => {
      const func = jest.fn();
      const debounced = PerformanceUtils.debounce(func, 100);
      
      debounced('arg1', 'arg2');
      jest.advanceTimersByTime(100);
      
      expect(func).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should limit function calls', () => {
      const func = jest.fn();
      const throttled = PerformanceUtils.throttle(func, 100);
      
      throttled();
      throttled();
      throttled();
      
      expect(func).toHaveBeenCalledTimes(1);
    });
  });
});
