/**
 * Unit tests for Activity Logger - Target 90% Coverage
 */

jest.mock('fs-extra');
const ActivityLogger = require('../src/core/activity-logger');
const fs = require('fs-extra');

describe('ActivityLogger - Target 90% Coverage', () => {
  let activityLogger;
  let mockFs;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockFs = {
      pathExists: jest.fn(),
      writeFile: jest.fn(),
      readFile: jest.fn(),
      ensureDir: jest.fn(),
      stat: jest.fn(),
      readdir: jest.fn(),
      remove: jest.fn()
    };

    jest.spyOn(require('fs-extra'), 'pathExists').mockImplementation(mockFs.pathExists);
    jest.spyOn(require('fs-extra'), 'writeFile').mockImplementation(mockFs.writeFile);
    jest.spyOn(require('fs-extra'), 'readFile').mockImplementation(mockFs.readFile);
    jest.spyOn(require('fs-extra'), 'ensureDir').mockImplementation(mockFs.ensureDir);
    jest.spyOn(require('fs-extra'), 'stat').mockImplementation(mockFs.stat);
    jest.spyOn(require('fs-extra'), 'readdir').mockImplementation(mockFs.readdir);
    jest.spyOn(require('fs-extra'), 'remove').mockImplementation(mockFs.remove);

    activityLogger = new ActivityLogger();
    activityLogger.logBuffer = [];
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const logger = new ActivityLogger();

      expect(logger.options).toBeDefined();
      expect(logger.options.logLevel).toBe('info');
      expect(logger.options.maxLogSize).toBe(10 * 1024 * 1024); // 10MB
      expect(logger.options.maxLogFiles).toBe(5);
      expect(logger.options.logDirectory).toBeDefined();
    });

    it('should initialize with custom options', () => {
      const customOptions = {
        logLevel: 'debug',
        maxLogSize: 5 * 1024 * 1024, // 5MB
        maxLogFiles: 10,
        logDirectory: '/custom/logs'
      };

      const logger = new ActivityLogger(customOptions);

      expect(logger.options.logLevel).toBe('debug');
      expect(logger.options.maxLogSize).toBe(5 * 1024 * 1024);
      expect(logger.options.maxLogFiles).toBe(10);
      expect(logger.options.logDirectory).toBe('/custom/logs');
    });

    it('should ensure log directory exists', () => {
      mockFs.pathExists.mockResolvedValue(false);

      new ActivityLogger({ logDirectory: '/test/logs' });

      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/logs');
    });

    it('should set up log rotation monitoring', () => {
      const logger = new ActivityLogger();

      expect(logger.logBuffer).toBeDefined();
      expect(Array.isArray(logger.logBuffer)).toBe(true);
    });
  });

  describe('log', () => {
    it('should log basic activity', () => {
      const activity = {
        action: 'generate',
        provider: 'groq',
        duration: 1000
      };

      activityLogger.log(activity);

      expect(activityLogger.logBuffer).toHaveLength(1);
      expect(activityLogger.logBuffer[0]).toMatchObject(activity);
      expect(activityLogger.logBuffer[0].timestamp).toBeDefined();
    });

    it('should log activity with custom timestamp', () => {
      const customTimestamp = Date.now();
      const activity = {
        action: 'test',
        timestamp: customTimestamp
      };

      activityLogger.log(activity);

      expect(activityLogger.logBuffer[0].timestamp).toBe(customTimestamp);
    });

    it('should add metadata to log entries', () => {
      const activity = { action: 'test' };

      activityLogger.log(activity);

      const logged = activityLogger.logBuffer[0];
      expect(logged.id).toBeDefined();
      expect(logged.sessionId).toBeDefined();
      expect(logged.version).toBeDefined();
    });

    it('should handle null activities gracefully', () => {
      activityLogger.log(null);

      expect(activityLogger.logBuffer).toHaveLength(0);
    });

    it('should handle undefined activities gracefully', () => {
      activityLogger.log(undefined);

      expect(activityLogger.logBuffer).toHaveLength(0);
    });

    it('should handle activities with special characters', () => {
      const activity = {
        action: '测试操作',
        details: '活动详情 🎉',
        error: '错误信息'
      };

      activityLogger.log(activity);

      expect(activityLogger.logBuffer[0].action).toBe('测试操作');
      expect(activityLogger.logBuffer[0].details).toBe('活动详情 🎉');
      expect(activityLogger.logBuffer[0].error).toBe('错误信息');
    });

    it('should validate required activity fields', () => {
      const invalidActivity = { details: 'no action field' };

      activityLogger.log(invalidActivity);

      expect(activityLogger.logBuffer).toHaveLength(0);
    });

    it('should handle circular reference activities', () => {
      const circularActivity = {};
      circularActivity.self = circularActivity;
      circularActivity.action = 'test';

      activityLogger.log(circularActivity);

      expect(activityLogger.logBuffer).toHaveLength(1);
      expect(activityLogger.logBuffer[0].action).toBe('test');
    });

    it('should sanitize sensitive data', () => {
      const sensitiveActivity = {
        action: 'authenticate',
        apiKey: 'sk-1234567890abcdef',
        password: 'secret123',
        token: 'token123'
      };

      activityLogger.log(sensitiveActivity);

      const logged = activityLogger.logBuffer[0];
      expect(logged.apiKey).toBe('[REDACTED]');
      expect(logged.password).toBe('[REDACTED]');
      expect(logged.token).toBe('[REDACTED]');
    });

    it('should handle very large activity objects', () => {
      const largeActivity = {
        action: 'large-operation',
        data: 'x'.repeat(10000)
      };

      activityLogger.log(largeActivity);

      expect(activityLogger.logBuffer).toHaveLength(1);
      expect(activityLogger.logBuffer[0].data).toBe('x'.repeat(10000));
    });

    it('should handle activity with arrays', () => {
      const arrayActivity = {
        action: 'batch-operation',
        files: ['file1.js', 'file2.js', 'file3.js']
      };

      activityLogger.log(arrayActivity);

      expect(activityLogger.logBuffer[0].files).toEqual(['file1.js', 'file2.js', 'file3.js']);
    });

    it('should handle activity with nested objects', () => {
      const nestedActivity = {
        action: 'complex-operation',
        config: {
          provider: {
            name: 'groq',
            settings: {
              model: 'mixtral',
              temperature: 0.7
            }
          }
        }
      };

      activityLogger.log(nestedActivity);

      expect(activityLogger.logBuffer[0].config).toEqual(nestedActivity.config);
    });
  });

  describe('logLevel validation', () => {
    it('should log error level activities', () => {
      const errorActivity = {
        action: 'error',
        level: 'error',
        message: 'Something went wrong'
      };

      activityLogger.log(errorActivity);

      expect(activityLogger.logBuffer).toHaveLength(1);
      expect(activityLogger.logBuffer[0].level).toBe('error');
    });

    it('should log warning level activities', () => {
      const warningActivity = {
        action: 'warning',
        level: 'warning',
        message: 'Potential issue'
      };

      activityLogger.log(warningActivity);

      expect(activityLogger.logBuffer).toHaveLength(1);
      expect(activityLogger.logBuffer[0].level).toBe('warning');
    });

    it('should log info level activities', () => {
      const infoActivity = {
        action: 'info',
        level: 'info',
        message: 'Information'
      };

      activityLogger.log(infoActivity);

      expect(activityLogger.logBuffer).toHaveLength(1);
      expect(activityLogger.logBuffer[0].level).toBe('info');
    });

    it('should filter out debug activities when not in debug mode', () => {
      const debugLogger = new ActivityLogger({ logLevel: 'info' });
      const debugActivity = {
        action: 'debug',
        level: 'debug',
        message: 'Debug information'
      };

      debugLogger.log(debugActivity);

      expect(debugLogger.logBuffer).toHaveLength(0);
    });

    it('should log debug activities when in debug mode', () => {
      const debugLogger = new ActivityLogger({ logLevel: 'debug' });
      const debugActivity = {
        action: 'debug',
        level: 'debug',
        message: 'Debug information'
      };

      debugLogger.log(debugActivity);

      expect(debugLogger.logBuffer).toHaveLength(1);
    });

    it('should handle invalid log levels', () => {
      const invalidActivity = {
        action: 'test',
        level: 'invalid'
      };

      activityLogger.log(invalidActivity);

      expect(activityLogger.logBuffer).toHaveLength(1);
      expect(activityLogger.logBuffer[0].level).toBe('info'); // Default to info
    });
  });

  describe('flush', () => {
    it('should flush buffer to file', async () => {
      const activity = { action: 'flush-test' };
      activityLogger.log(activity);
      activityLogger.logBuffer = [activity];

      mockFs.pathExists.mockResolvedValue(false);
      mockFs.writeFile.mockResolvedValue();

      await activityLogger.flush();

      expect(mockFs.writeFile).toHaveBeenCalled();
      expect(activityLogger.logBuffer).toHaveLength(0);
    });

    it('should append to existing log file', async () => {
      const activity = { action: 'append-test' };
      activityLogger.log(activity);

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(JSON.stringify([activity]));
      mockFs.writeFile.mockResolvedValue();

      await activityLogger.flush();

      expect(mockFs.readFile).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should handle file write errors', async () => {
      const activity = { action: 'error-test' };
      activityLogger.log(activity);

      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      await expect(activityLogger.flush()).rejects.toThrow('Write failed');
    });

    it('should handle empty buffer flush', async () => {
      await activityLogger.flush();

      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should create log rotation when file is too large', async () => {
      const activity = { action: 'rotation-test' };
      activityLogger.log(activity);

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.stat.mockResolvedValue({ size: 15 * 1024 * 1024 }); // 15MB
      mockFs.readFile.mockResolvedValue('[]');
      mockFs.writeFile.mockResolvedValue();

      await activityLogger.flush();

      expect(mockFs.remove).toHaveBeenCalled();
    });

    it('should handle concurrent flush operations', async () => {
      const activities = [
        { action: 'concurrent1' },
        { action: 'concurrent2' },
        { action: 'concurrent3' }
      ];

      activities.forEach(activity => activityLogger.log(activity));

      mockFs.pathExists.mockResolvedValue(false);
      mockFs.writeFile.mockResolvedValue();

      await Promise.all([
        activityLogger.flush(),
        activityLogger.flush(),
        activityLogger.flush()
      ]);

      expect(activityLogger.logBuffer).toHaveLength(0);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      activityLogger.logBuffer = [
        { action: 'test1', level: 'info', timestamp: Date.now() - 5000 },
        { action: 'test2', level: 'error', timestamp: Date.now() - 3000 },
        { action: 'test3', level: 'warning', timestamp: Date.now() - 1000 },
        { action: 'test1', level: 'info', timestamp: Date.now() }
      ];
    });

    it('should search activities by action', () => {
      const results = activityLogger.search({ action: 'test1' });

      expect(results).toHaveLength(2);
      expect(results.every(r => r.action === 'test1')).toBe(true);
    });

    it('should search activities by level', () => {
      const results = activityLogger.search({ level: 'error' });

      expect(results).toHaveLength(1);
      expect(results[0].level).toBe('error');
    });

    it('should search activities by time range', () => {
      const now = Date.now();
      const results = activityLogger.search({
        startTime: now - 2000,
        endTime: now
      });

      expect(results).toHaveLength(2);
    });

    it('should search activities by multiple criteria', () => {
      const results = activityLogger.search({
        action: 'test1',
        level: 'info'
      });

      expect(results).toHaveLength(2);
      expect(results.every(r => r.action === 'test1' && r.level === 'info')).toBe(true);
    });

    it('should return empty results for non-matching criteria', () => {
      const results = activityLogger.search({ action: 'nonexistent' });

      expect(results).toHaveLength(0);
    });

    it('should handle empty search criteria', () => {
      const results = activityLogger.search({});

      expect(results).toHaveLength(4);
    });

    it('should handle null search criteria', () => {
      const results = activityLogger.search(null);

      expect(results).toHaveLength(4);
    });

    it('should limit search results', () => {
      const results = activityLogger.search({}, 2);

      expect(results).toHaveLength(2);
    });

    it('should sort search results by timestamp', () => {
      const results = activityLogger.search({});

      expect(results[0].timestamp).toBeGreaterThanOrEqual(results[1].timestamp);
      expect(results[1].timestamp).toBeGreaterThanOrEqual(results[2].timestamp);
      expect(results[2].timestamp).toBeGreaterThanOrEqual(results[3].timestamp);
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      const now = Date.now();
      activityLogger.logBuffer = [
        { action: 'generate', level: 'info', timestamp: now - 5000, duration: 1000 },
        { action: 'generate', level: 'info', timestamp: now - 4000, duration: 1500 },
        { action: 'error', level: 'error', timestamp: now - 3000, error: 'Test error' },
        { action: 'warning', level: 'warning', timestamp: now - 2000, warning: 'Test warning' },
        { action: 'validate', level: 'info', timestamp: now - 1000, duration: 500 }
      ];
    });

    it('should return comprehensive statistics', () => {
      const stats = activityLogger.getStats();

      expect(stats.totalActivities).toBe(5);
      expect(stats.errorCount).toBe(1);
      expect(stats.warningCount).toBe(1);
      expect(stats.infoCount).toBe(3);
      expect(stats.averageDuration).toBeCloseTo(1000, 0);
    });

    it('should calculate action statistics', () => {
      const stats = activityLogger.getStats();

      expect(stats.actionCounts).toBeDefined();
      expect(stats.actionCounts.generate).toBe(2);
      expect(stats.actionCounts.error).toBe(1);
      expect(stats.actionCounts.warning).toBe(1);
      expect(stats.actionCounts.validate).toBe(1);
    });

    it('should calculate level distribution', () => {
      const stats = activityLogger.getStats();

      expect(stats.levelDistribution).toBeDefined();
      expect(stats.levelDistribution.info).toBe(3);
      expect(stats.levelDistribution.error).toBe(1);
      expect(stats.levelDistribution.warning).toBe(1);
    });

    it('should calculate time range statistics', () => {
      const stats = activityLogger.getStats();

      expect(stats.timeRange).toBeDefined();
      expect(stats.timeRange.oldest).toBeDefined();
      expect(stats.timeRange.newest).toBeDefined();
      expect(stats.timeRange.oldest).toBeLessThan(stats.timeRange.newest);
    });

    it('should handle empty buffer stats', () => {
      activityLogger.logBuffer = [];
      const stats = activityLogger.getStats();

      expect(stats.totalActivities).toBe(0);
      expect(stats.errorCount).toBe(0);
      expect(stats.warningCount).toBe(0);
      expect(stats.infoCount).toBe(0);
      expect(stats.averageDuration).toBe(0);
    });

    it('should calculate performance metrics', () => {
      const stats = activityLogger.getStats();

      expect(stats.performance).toBeDefined();
      expect(stats.performance.minDuration).toBe(500);
      expect(stats.performance.maxDuration).toBe(1500);
      expect(stats.performance.averageDuration).toBeCloseTo(1000, 0);
    });
  });

  describe('exportLogs', () => {
    beforeEach(() => {
      activityLogger.logBuffer = [
        { action: 'test1', level: 'info', timestamp: Date.now() },
        { action: 'test2', level: 'error', timestamp: Date.now() }
      ];
    });

    it('should export logs to JSON', async () => {
      mockFs.writeFile.mockResolvedValue();

      const result = await activityLogger.exportLogs('/path/to/export.json');

      expect(result.success).toBe(true);
      expect(result.exported).toBe(2);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/path/to/export.json',
        expect.any(String)
      );
    });

    it('should export logs to CSV', async () => {
      mockFs.writeFile.mockResolvedValue();

      const result = await activityLogger.exportLogs('/path/to/export.csv', 'csv');

      expect(result.success).toBe(true);
      expect(result.exported).toBe(2);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/path/to/export.csv',
        expect.stringContaining('action,level,timestamp')
      );
    });

    it('should export logs with filters', async () => {
      mockFs.writeFile.mockResolvedValue();

      const result = await activityLogger.exportLogs(
        '/path/to/export.json',
        'json',
        { level: 'error' }
      );

      expect(result.success).toBe(true);
      expect(result.exported).toBe(1);
    });

    it('should handle export errors', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Export failed'));

      const result = await activityLogger.exportLogs('/path/to/export.json');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle unsupported export formats', async () => {
      const result = await activityLogger.exportLogs(
        '/path/to/export.xml',
        'xml'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported format');
    });

    it('should export logs with date range', async () => {
      const now = Date.now();
      const filter = {
        startTime: now - 2000,
        endTime: now
      };

      mockFs.writeFile.mockResolvedValue();

      const result = await activityLogger.exportLogs('/path/to/export.json', 'json', filter);

      expect(result.success).toBe(true);
    });
  });

  describe('archive', () => {
    it('should archive old logs', async () => {
      mockFs.readdir.mockResolvedValue(['log1.json', 'log2.json', 'log3.json']);
      mockFs.stat.mockImplementation((file) => {
        const age = file.includes('log1') ? 30 : 1; // log1 is 30 days old
        return Promise.resolve({ 
          size: 1000,
          mtime: new Date(Date.now() - age * 24 * 60 * 60 * 1000)
        });
      });

      const result = await activityLogger.archive(7); // Archive logs older than 7 days

      expect(result.success).toBe(true);
      expect(result.archived).toBe(1);
    });

    it('should handle archive errors', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Archive failed'));

      const result = await activityLogger.archive(7);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should create archive directory if not exists', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      mockFs.readdir.mockResolvedValue([]);
      mockFs.ensureDir.mockResolvedValue();

      const result = await activityLogger.archive(7);

      expect(result.success).toBe(true);
      expect(mockFs.ensureDir).toHaveBeenCalled();
    });

    it('should compress archived logs', async () => {
      mockFs.readdir.mockResolvedValue(['old-log.json']);
      mockFs.stat.mockResolvedValue({
        size: 1000,
        mtime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days old
      });

      const result = await activityLogger.archive(7);

      expect(result.success).toBe(true);
      expect(result.compressed).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should clean up old log files', async () => {
      mockFs.readdir.mockResolvedValue([
        'log1.json',
        'log2.json',
        'log3.json',
        'log4.json',
        'log5.json',
        'log6.json'
      ]);
      mockFs.stat.mockImplementation((file) => {
        const age = parseInt(file.replace('log', '').replace('.json', ''));
        return Promise.resolve({ 
          size: 1000,
          mtime: new Date(Date.now() - age * 24 * 60 * 60 * 1000)
        });
      });

      const result = await activityLogger.cleanup(3); // Keep only 3 most recent

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(3);
    });

    it('should handle cleanup errors', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Cleanup failed'));

      const result = await activityLogger.cleanup(3);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should respect max log files setting', async () => {
      const logger = new ActivityLogger({ maxLogFiles: 3 });
      mockFs.readdir.mockResolvedValue([
        'log1.json',
        'log2.json',
        'log3.json',
        'log4.json'
      ]);

      const result = await logger.cleanup();

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(1);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete log lifecycle', async () => {
      const activities = [
        { action: 'start', level: 'info' },
        { action: 'process', level: 'info', duration: 1000 },
        { action: 'warning', level: 'warning' },
        { action: 'complete', level: 'info', duration: 500 }
      ];

      activities.forEach(activity => activityLogger.log(activity));

      // Search logs
      const searchResults = activityLogger.search({ level: 'warning' });
      expect(searchResults).toHaveLength(1);

      // Get stats
      const stats = activityLogger.getStats();
      expect(stats.totalActivities).toBe(4);
      expect(stats.warningCount).toBe(1);

      // Export logs
      mockFs.pathExists.mockResolvedValue(false);
      mockFs.writeFile.mockResolvedValue();

      const exportResult = await activityLogger.exportLogs('/test/export.json');
      expect(exportResult.success).toBe(true);
      expect(exportResult.exported).toBe(4);

      // Flush logs
      await activityLogger.flush();
      expect(activityLogger.logBuffer).toHaveLength(0);
    });

    it('should handle high-volume logging efficiently', async () => {
      const start = Date.now();
      
      // Log 1000 activities
      for (let i = 0; i < 1000; i++) {
        activityLogger.log({
          action: `high-volume-${i}`,
          level: 'info',
          data: `data-${i}`
        });
      }

      const logTime = Date.now() - start;

      // Search performance
      const searchStart = Date.now();
      const results = activityLogger.search({ action: 'high-volume-500' });
      const searchTime = Date.now() - searchStart;

      expect(activityLogger.logBuffer).toHaveLength(1000);
      expect(results).toHaveLength(1);
      expect(logTime).toBeLessThan(1000);
      expect(searchTime).toBeLessThan(100);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle malformed log entries', () => {
      const malformedActivity = {
        action: 'test',
        duration: 'invalid-duration',
        timestamp: 'invalid-timestamp'
      };

      activityLogger.log(malformedActivity);

      expect(activityLogger.logBuffer).toHaveLength(1);
    });

    it('should handle logging during file operations', async () => {
      const activity = { action: 'file-test' };
      
      activityLogger.log(activity);
      
      mockFs.pathExists.mockResolvedValue(false);
      mockFs.writeFile.mockImplementation(() => {
        // Log during file write
        activityLogger.log({ action: 'during-write' });
        return Promise.resolve();
      });

      await activityLogger.flush();

      expect(activityLogger.logBuffer).toHaveLength(1);
    });

    it('should handle very long log messages', () => {
      const longMessage = 'x'.repeat(10000);
      
      activityLogger.log({
        action: 'long-message',
        message: longMessage
      });

      expect(activityLogger.logBuffer[0].message).toBe(longMessage);
    });

    it('should handle Unicode log messages', () => {
      const unicodeMessage = 'Unicode: 测试 русский العربية 🎉';
      
      activityLogger.log({
        action: 'unicode-test',
        message: unicodeMessage
      });

      expect(activityLogger.logBuffer[0].message).toBe(unicodeMessage);
    });

    it('should handle buffer overflow protection', () => {
      activityLogger.options.maxBufferSize = 10;

      // Log more than max buffer size
      for (let i = 0; i < 20; i++) {
        activityLogger.log({ action: `overflow-${i}` });
      }

      expect(activityLogger.logBuffer.length).toBeLessThanOrEqual(10);
    });
  });
});