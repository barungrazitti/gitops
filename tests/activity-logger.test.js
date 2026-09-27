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
    jest.mock('conf', () =>
      jest.fn().mockImplementation(() => ({
        get: jest.fn(key => {
          if (key === 'logLevel') return 'info';
          return null;
        }),
      }))
    );

    // Mock fs-extra
    jest.mock('fs-extra', () => ({
      ensureDir: jest.fn().mockResolvedValue(),
      readdir: jest.fn().mockResolvedValue([]),
      stat: jest.fn().mockResolvedValue({ size: 1000 }),
      appendFile: jest.fn().mockResolvedValue(),
      remove: jest.fn().mockResolvedValue(),
      chmod: jest.fn().mockResolvedValue(),
      move: jest.fn().mockResolvedValue(),
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
    it('should return false for debug when level is info', () => {
      expect(logger.shouldLog('debug')).toBe(false);
    });

    it('should return true for info when level is info', () => {
      expect(logger.shouldLog('info')).toBe(true);
    });
  });

  describe('logActivity', () => {
    it('should log activity', async () => {
      await logger.logActivity('info', 'test_action', { key: 'value' });
    });

    it('secures the log file with 0o600 on first write', async () => {
      const fsExtra = require('fs-extra');
      await logger.logActivity('info', 'test_action', { key: 'value' });

      expect(fsExtra.chmod).toHaveBeenCalledWith(logger.currentLogFile, 0o600);
    });
  });

  describe('logAIInteraction', () => {
    const rawPrompt = 'diff --git a/f.js b/f.js\n+const superSecretPromptPayload = 1;';

    afterEach(() => {
      delete process.env.AIC_LOG_PROMPTS;
    });

    it('logs prompt length and hash, never the raw prompt, by default', async () => {
      const fsExtra = require('fs-extra');
      delete process.env.AIC_LOG_PROMPTS;

      await logger.logAIInteraction('groq', 'commit_generation', rawPrompt, 'feat: x', 100, true);

      expect(fsExtra.appendFile).toHaveBeenCalled();
      const logLine = fsExtra.appendFile.mock.calls.pop()[1];
      const entry = JSON.parse(logLine.trim());

      expect(entry.data.promptLength).toBe(rawPrompt.length);
      expect(entry.data.promptHash).toMatch(/^[a-f0-9]{12}$/);
      expect(logLine).not.toContain('superSecretPromptPayload');
      expect(entry.data.prompt).toBeUndefined();
    });

    it('includes the raw prompt only when AIC_LOG_PROMPTS=1', async () => {
      const fsExtra = require('fs-extra');
      process.env.AIC_LOG_PROMPTS = '1';

      await logger.logAIInteraction('groq', 'commit_generation', rawPrompt, 'feat: x', 100, true);

      const logLine = fsExtra.appendFile.mock.calls.pop()[1];
      const entry = JSON.parse(logLine.trim());

      expect(entry.data.prompt).toContain('superSecretPromptPayload');
      expect(entry.data.promptHash).toMatch(/^[a-f0-9]{12}$/);
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
    it('should stay quiet for info by default (file log only)', () => {
      console.info = jest.fn();
      logger.logToConsole('info', 'test', {});
      expect(console.info).not.toHaveBeenCalled();
    });

    it('should mirror info to console with verbose enabled', () => {
      console.info = jest.fn();
      logger.setVerbose(true);
      logger.logToConsole('info', 'test', {});
      expect(console.info).toHaveBeenCalled();
    });

    it('should always print warnings without verbose', () => {
      console.warn = jest.fn();
      logger.logToConsole('warn', 'test', {});
      expect(console.warn).toHaveBeenCalled();
    });
  });
});
