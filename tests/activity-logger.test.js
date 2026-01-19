/**
 * Unit tests for ActivityLogger
 */

describe('ActivityLogger', () => {
  let ActivityLogger;
  let logger;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    
    // Mock conf
    jest.mock('conf', () => {
      return jest.fn().mockImplementation(() => ({
        get: jest.fn((key) => {
          if (key === 'logLevel') return 'info';
          return null;
        }),
      }));
    });
    
    // Mock fs-extra
    jest.mock('fs-extra', () => ({
      ensureDir: jest.fn().mockResolvedValue(),
      readdir: jest.fn().mockResolvedValue([]),
      stat: jest.fn().mockResolvedValue({ size: 1000 }),
      appendFile: jest.fn().mockResolvedValue(),
      remove: jest.fn().mockResolvedValue(),
    }));
    
    // Mock os
    jest.mock('os', () => ({
      platform: () => 'darwin',
      homedir: () => '/Users/test',
    }));
    
    ActivityLogger = require('../src/core/activity-logger');
    logger = new ActivityLogger();
  });

  describe('constructor', () => {
    it('should initialize', () => {
      expect(logger.config).toBeDefined();
      expect(logger.sessionId).toBeDefined();
    });

    it('should generate session ID', () => {
      const sessionId = logger.generateSessionId();
      expect(sessionId).toContain('session-');
    });

    it('should return date string', () => {
      const dateStr = logger.getDateString();
      expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('shouldLog', () => {
    it('should return true for debug when level is debug', () => {
      expect(logger.shouldLog('debug')).toBe(true);
      expect(logger.shouldLog('info')).toBe(true);
    });
  });

  describe('logActivity', () => {
    it('should log activity', async () => {
      await logger.logActivity('info', 'test_action', { key: 'value' });
    });
  });

  describe('info', () => {
    it('should log info', async () => {
      await logger.info('test', {});
    });
  });

  describe('warn', () => {
    it('should log warn', async () => {
      await logger.warn('test', {});
    });
  });

  describe('error', () => {
    it('should log error', async () => {
      await logger.error('test', {});
    });
  });

  describe('debug', () => {
    it('should log debug', async () => {
      await logger.debug('test', {});
    });
  });

  describe('logToConsole', () => {
    it('should log to console', () => {
      console.info = jest.fn();
      logger.logToConsole('info', 'test', {});
      expect(console.info).toHaveBeenCalled();
    });
  });
});
