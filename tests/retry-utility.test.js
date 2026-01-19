/**
 * Unit tests for RetryUtility
 */

describe('RetryUtility', () => {
  let RetryUtility;

  beforeEach(() => {
    jest.resetModules();
    RetryUtility = require('../src/utils/retry-utility');
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const retry = new RetryUtility();
      expect(retry.options.maxRetries).toBe(3);
    });

    it('should initialize with custom options', () => {
      const retry = new RetryUtility({ maxRetries: 5 });
      expect(retry.options.maxRetries).toBe(5);
    });
  });

  describe('calculateDelay', () => {
    it('should calculate exponential delay', () => {
      const retry = new RetryUtility({ baseDelay: 100, factor: 2, jitter: false });
      const delay = retry.calculateDelay(0, retry.options);
      expect(delay).toBe(100);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for network errors', () => {
      const retry = new RetryUtility();
      expect(retry.isRetryableError({ message: 'ECONNRESET' })).toBe(true);
    });

    it('should return true for HTTP 5xx', () => {
      const retry = new RetryUtility();
      expect(retry.isRetryableError({ status: 500 })).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const retry = new RetryUtility();
      expect(retry.isRetryableError({ message: 'Invalid input' })).toBe(false);
    });
  });

  describe('execute', () => {
    it('should return result on first success', async () => {
      const retry = new RetryUtility();
      const fn = jest.fn().mockResolvedValue('success');
      const result = await retry.execute(fn);
      expect(result).toBe('success');
    });

    it('should throw after max retries', async () => {
      const retry = new RetryUtility({ maxRetries: 2, baseDelay: 1, jitter: false });
      const fn = jest.fn().mockRejectedValue(new Error('fail'));
      await expect(retry.execute(fn)).rejects.toThrow('fail');
    });

    it('should not retry non-retryable errors', async () => {
      const retry = new RetryUtility({ maxRetries: 3 });
      const fn = jest.fn().mockRejectedValue(new Error('Invalid input'));
      await expect(retry.execute(fn)).rejects.toThrow('Invalid input');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('sleep', () => {
    it('should pause execution', async () => {
      const retry = new RetryUtility();
      const start = Date.now();
      await retry.sleep(10);
      expect(Date.now() - start).toBeGreaterThanOrEqual(5);
    });
  });
});
