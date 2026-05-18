/**
 * RateLimiter Tests
 */

describe('RateLimiter', () => {
  let RateLimiter;

  beforeEach(() => {
    jest.resetModules();
    RateLimiter = require('../../src/utils/rate-limiter');
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const limiter = new RateLimiter();
      expect(limiter.maxRequests).toBe(60);
      expect(limiter.windowMs).toBe(60000);
    });

    it('should accept custom options', () => {
      const limiter = new RateLimiter({
        maxRequests: 10,
        windowMs: 5000,
      });
      expect(limiter.maxRequests).toBe(10);
      expect(limiter.windowMs).toBe(5000);
    });
  });

  describe('canMakeRequest', () => {
    it('should allow request when under limit', () => {
      const limiter = new RateLimiter({ maxRequests: 5 });
      expect(limiter.canMakeRequest()).toBe(true);
    });

    it('should deny request when at limit', () => {
      const limiter = new RateLimiter({ maxRequests: 2 });
      limiter.recordRequest();
      limiter.recordRequest();
      expect(limiter.canMakeRequest()).toBe(false);
    });
  });

  describe('recordRequest', () => {
    it('should record request timestamp', () => {
      const limiter = new RateLimiter();
      limiter.recordRequest();
      expect(limiter.requests.length).toBe(1);
    });
  });

  describe('getWaitTime', () => {
    it('should return 0 when under limit', () => {
      const limiter = new RateLimiter({ maxRequests: 5 });
      expect(limiter.getWaitTime()).toBe(0);
    });

    it('should return positive time when at limit', () => {
      const limiter = new RateLimiter({ maxRequests: 1, windowMs: 1000 });
      limiter.recordRequest();
      const waitTime = limiter.getWaitTime();
      expect(waitTime).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should clear all requests', () => {
      const limiter = new RateLimiter();
      limiter.recordRequest();
      limiter.recordRequest();
      limiter.reset();
      expect(limiter.requests.length).toBe(0);
    });
  });

  describe('getStatus', () => {
    it('should return correct status object', () => {
      const limiter = new RateLimiter({ maxRequests: 10 });
      const status = limiter.getStatus();
      expect(status).toHaveProperty('currentRequests', 0);
      expect(status).toHaveProperty('maxRequests', 10);
      expect(status).toHaveProperty('windowMs', 60000);
      expect(status).toHaveProperty('canMakeRequest', true);
    });

    it('should show cannot make request when at limit', () => {
      const limiter = new RateLimiter({ maxRequests: 1 });
      limiter.recordRequest();
      const status = limiter.getStatus();
      expect(status.canMakeRequest).toBe(false);
    });
  });
});