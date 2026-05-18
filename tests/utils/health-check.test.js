/**
 * Health Check and Metrics Tests
 */

const { HealthCheck, MetricsCollector } = require('../../src/utils/health-check');

describe('HealthCheck', () => {
  let healthCheck;

  beforeEach(() => {
    jest.resetModules();
    const healthModule = require('../../src/utils/health-check');
    healthCheck = new healthModule.HealthCheck();
  });

  describe('registerCheck', () => {
    it('should register a health check', () => {
      healthCheck.registerCheck('test', () => true);
      expect(healthCheck.checks.size).toBe(1);
    });
  });

  describe('runChecks', () => {
    it('should run all registered checks', async () => {
      healthCheck.registerCheck('check1', () => true);
      healthCheck.registerCheck('check2', () => true);

      const results = await healthCheck.runChecks();
      expect(results.checks.check1).toBeDefined();
      expect(results.checks.check2).toBeDefined();
    });

    it('should return pass status for successful checks', async () => {
      healthCheck.registerCheck('passing', () => true);
      const results = await healthCheck.runChecks();
      expect(results.checks.passing.status).toBe('pass');
    });

    it('should return fail status for failed checks', async () => {
      healthCheck.registerCheck('failing', () => false);
      const results = await healthCheck.runChecks();
      expect(results.checks.failing.status).toBe('fail');
    });

    it('should return error status for throwing checks', async () => {
      healthCheck.registerCheck('error', () => {
        throw new Error('Check failed');
      });
      const results = await healthCheck.runChecks();
      expect(results.checks.error.status).toBe('error');
    });

    it('should set overall status to degraded when any check fails', async () => {
      healthCheck.registerCheck('passing', () => true);
      healthCheck.registerCheck('failing', () => false);
      const results = await healthCheck.runChecks();
      expect(results.status).toBe('degraded');
    });
  });

  describe('getSummary', () => {
    it('should return summary with checks count', () => {
      healthCheck.registerCheck('test', () => true);
      const summary = healthCheck.getSummary();
      expect(summary.checksRegistered).toBe(1);
    });
  });
});

describe('MetricsCollector', () => {
  let metrics;

  beforeEach(() => {
    jest.resetModules();
    const healthModule = require('../../src/utils/health-check');
    metrics = new healthModule.MetricsCollector();
  });

  describe('record', () => {
    it('should record metric values', () => {
      metrics.record('responseTime', 100);
      const stats = metrics.getStats('responseTime');
      expect(stats.count).toBe(1);
    });

    it('should aggregate multiple values', () => {
      metrics.record('responseTime', 100);
      metrics.record('responseTime', 200);
      const stats = metrics.getStats('responseTime');
      expect(stats.count).toBe(2);
      expect(stats.sum).toBe(300);
    });
  });

  describe('getStats', () => {
    it('should calculate average correctly', () => {
      metrics.record('responseTime', 100);
      metrics.record('responseTime', 200);
      const stats = metrics.getStats('responseTime');
      expect(stats.avg).toBe(150);
    });

    it('should track min and max', () => {
      metrics.record('responseTime', 50);
      metrics.record('responseTime', 200);
      metrics.record('responseTime', 100);
      const stats = metrics.getStats('responseTime');
      expect(stats.min).toBe(50);
      expect(stats.max).toBe(200);
    });

    it('should return null for unknown metric', () => {
      expect(metrics.getStats('unknown')).toBeNull();
    });
  });

  describe('getAllStats', () => {
    it('should return stats for all metrics', () => {
      metrics.record('metric1', 100);
      metrics.record('metric2', 200);
      const allStats = metrics.getAllStats();
      expect(allStats.metric1).toBeDefined();
      expect(allStats.metric2).toBeDefined();
    });
  });

  describe('clear', () => {
    it('should clear all metrics', () => {
      metrics.record('test', 100);
      metrics.clear();
      expect(metrics.getAllStats()).toEqual({});
    });
  });
});