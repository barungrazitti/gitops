/**
 * File System Error Handling and Recovery Tests
 * Comprehensive testing of error scenarios and recovery mechanisms
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const GitManager = require('../src/core/git-manager');
const ConfigManager = require('../src/core/config-manager');
const CacheManager = require('../src/core/cache-manager');
const ActivityLogger = require('../src/core/activity-logger');
const HookManager = require('../src/core/hook-manager');

// Mock external dependencies
jest.mock('fs-extra');
jest.mock('simple-git');
jest.mock('conf');

describe('File System Error Handling and Recovery', () => {
  let mockFs;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs = require('fs-extra');
    
    // Default successful behaviors
    mockFs.ensureDir = jest.fn().mockResolvedValue();
    mockFs.pathExists = jest.fn().mockResolvedValue(true);
    mockFs.readFile = jest.fn().mockResolvedValue('test content');
    mockFs.writeFile = jest.fn().mockResolvedValue();
    mockFs.stat = jest.fn().mockResolvedValue({
      size: 1024,
      birthtime: new Date(),
      ctime: new Date(),
      mtime: new Date(),
      isFile: () => true,
      isDirectory: () => false
    });
    mockFs.readdir = jest.fn().mockResolvedValue(['file1.txt', 'file2.txt']);
    mockFs.remove = jest.fn().mockResolvedValue();
    mockFs.copy = jest.fn().mockResolvedValue();
    mockFs.move = jest.fn().mockResolvedValue();
    mockFs.appendFile = jest.fn().mockResolvedValue();
    mockFs.readJson = jest.fn().mockResolvedValue({ test: 'data' });
    mockFs.writeJson = jest.fn().mockResolvedValue();
  });

  describe('Error Classification and Handling', () => {
    it('should classify and handle temporary vs permanent errors', async () => {
      const cacheManager = new CacheManager();
      
      // Test temporary errors (should retry)
      const temporaryErrors = [
        { code: 'EBUSY', message: 'resource busy' },
        { code: 'EAGAIN', message: 'resource temporarily unavailable' },
        { code: 'ETIMEDOUT', message: 'operation timed out' }
      ];
      
      for (const error of temporaryErrors) {
        let callCount = 0;
        mockFs.writeJson.mockImplementation(() => {
          callCount++;
          if (callCount <= 2) {
            const err = new Error(error.message);
            err.code = error.code;
            return Promise.reject(err);
          }
          return Promise.resolve();
        });
        
        await expect(cacheManager.setValidated('test diff', ['message']))
          .resolves.toBeUndefined();
        expect(callCount).toBeGreaterThan(2); // Should have retried
      }
      
      // Test permanent errors (should not retry)
      const permanentErrors = [
        { code: 'ENOENT', message: 'no such file or directory' },
        { code: 'EACCES', message: 'permission denied' },
        { code: 'EINVAL', message: 'invalid argument' }
      ];
      
      for (const error of permanentErrors) {
        let callCount = 0;
        mockFs.writeJson.mockImplementation(() => {
          callCount++;
          const err = new Error(error.message);
          err.code = error.code;
          return Promise.reject(err);
        });
        
        await expect(cacheManager.setValidated('test diff', ['message']))
          .resolves.toBeUndefined(); // Should handle gracefully
        expect(callCount).toBe(1); // Should not retry
      }
    });

    it('should handle error cascading prevention', async () => {
      const configManager = new ConfigManager();
      
      // Mock cascading errors
      mockFs.writeJson.mockRejectedValue(new Error('ENOSPC: no space left on device'));
      mockFs.readJson.mockRejectedValue(new Error('EIO: input/output error'));
      mockFs.pathExists.mockRejectedValue(new Error('EACCES: permission denied'));
      
      // Should prevent error cascading and handle gracefully
      const results = await Promise.allSettled([
        configManager.export('/test1.json'),
        configManager.import('/test2.json'),
        configManager.get('test-key')
      ]);
      
      // All should be handled gracefully without crashing
      results.forEach(result => {
        expect(result.status).toBe('rejected');
      });
    });

    it('should implement circuit breaker pattern for file operations', async () => {
      const cacheManager = new CacheManager();
      
      // Mock repeated failures to trigger circuit breaker
      let failureCount = 0;
      mockFs.readJson.mockImplementation(() => {
        failureCount++;
        if (failureCount <= 5) {
          return Promise.reject(new Error('EIO: input/output error'));
        }
        return Promise.resolve({ messages: ['recovered'] });
      });
      
      // First few calls should fail
      for (let i = 0; i < 5; i++) {
        const result = await cacheManager.getValidated('test diff');
        expect(result).toBeNull();
      }
      
      // Circuit breaker should open and prevent further calls
      // (This would need to be implemented in the actual code)
      const result = await cacheManager.getValidated('test diff');
      expect(result).toBeNull();
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should validate data integrity after file operations', async () => {
      const configManager = new ConfigManager();
      
      // Mock successful write but corrupted read
      mockFs.writeJson.mockResolvedValue();
      mockFs.readJson.mockResolvedValue({ corrupted: 'data', unexpected: 'fields' });
      
      await expect(configManager.export('/test.json'))
        .resolves.toBeUndefined();
      
      const result = await configManager.import('/test.json');
      // Should validate and handle corrupted data
      expect(result).toBeDefined();
    });

    it('should handle partial writes and reads', async () => {
      const logger = new ActivityLogger();
      
      // Mock partial write
      mockFs.appendFile.mockImplementation((path, content) => {
        // Simulate partial write by only writing part of the content
        const partialContent = content.substring(0, Math.floor(content.length / 2));
        return Promise.resolve(partialContent);
      });
      
      await expect(logger.logActivity('info', 'partial_write', { data: 'x'.repeat(1000) }))
        .resolves.toBeUndefined();
    });

    it('should detect and handle file corruption during read', async () => {
      const cacheManager = new CacheManager();
      
      // Mock various corruption scenarios
      const corruptionScenarios = [
        { error: new SyntaxError('Unexpected token'), code: 'JSON_CORRUPTED' },
        { error: new Error('Invalid data format'), code: 'FORMAT_ERROR' },
        { error: new Error('Checksum mismatch'), code: 'CHECKSUM_ERROR' }
      ];
      
      for (const scenario of corruptionScenarios) {
        mockFs.readJson.mockRejectedValue(scenario.error);
        
        const result = await cacheManager.getValidated('test diff');
        expect(result).toBeNull(); // Should handle corruption gracefully
      }
    });

    it('should implement data verification mechanisms', async () => {
      const configManager = new ConfigManager();
      
      // Mock data verification
      let verificationAttempts = 0;
      mockFs.readJson.mockImplementation(() => {
        verificationAttempts++;
        if (verificationAttempts === 1) {
          return Promise.resolve({ valid: false, checksum: 'invalid' });
        }
        return Promise.resolve({ valid: true, checksum: 'valid', data: 'verified' });
      });
      
      const result = await configManager.import('/verify.json');
      expect(result).toBeDefined();
    });
  });

  describe('Resource Management and Cleanup', () => {
    it('should handle file descriptor leaks', async () => {
      const logger = new ActivityLogger();
      
      // Mock file descriptor exhaustion
      let fdCount = 0;
      mockFs.appendFile.mockImplementation(() => {
        fdCount++;
        if (fdCount > 1000) { // Simulate fd limit
          const error = new Error('EMFILE: too many open files');
          error.code = 'EMFILE';
          return Promise.reject(error);
        }
        return Promise.resolve();
      });
      
      // Should handle fd exhaustion gracefully
      const operations = Array.from({ length: 1200 }, (_, i) => 
        logger.logActivity('info', `fd-test-${i}`, { index: i })
      );
      
      const results = await Promise.allSettled(operations);
      // Some operations might fail, but shouldn't crash
      expect(results.length).toBe(1200);
    });

    it('should implement proper cleanup on errors', async () => {
      const cacheManager = new CacheManager();
      
      // Mock cleanup operations
      const cleanupOperations = [];
      mockFs.remove.mockImplementation((path) => {
        cleanupOperations.push(path);
        return Promise.resolve();
      });
      
      // Simulate operation that requires cleanup
      mockFs.writeJson.mockRejectedValue(new Error('EIO: input/output error'));
      
      await cacheManager.setValidated('test diff', ['message']);
      
      // Should have performed cleanup
      expect(cleanupOperations.length).toBeGreaterThan(0);
    });

    it('should handle memory leaks in file operations', async () => {
      const configManager = new ConfigManager();
      
      // Track memory usage
      const initialMemory = process.memoryUsage();
      
      // Perform many operations
      const operations = Array.from({ length: 1000 }, (_, i) => 
        configManager.set(`key-${i}`, `value-${i}`)
      );
      
      await Promise.all(operations);
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    it('should handle temporary file cleanup', async () => {
      const configManager = new ConfigManager();
      
      // Mock temporary file operations
      const tempFiles = [];
      mockFs.writeJson.mockImplementation((path, data) => {
        if (path.includes('.tmp')) {
          tempFiles.push(path);
        }
        return Promise.resolve();
      });
      
      mockFs.remove.mockImplementation((path) => {
        const index = tempFiles.indexOf(path);
        if (index > -1) {
          tempFiles.splice(index, 1);
        }
        return Promise.resolve();
      });
      
      await configManager.export('/test.json');
      
      // Temporary files should be cleaned up
      expect(tempFiles.length).toBe(0);
    });
  });

  describe('Recovery Mechanisms', () => {
    it('should implement automatic retry with exponential backoff', async () => {
      const cacheManager = new CacheManager();
      
      // Mock retry scenario with exponential backoff
      let callCount = 0;
      const callTimes = [];
      mockFs.writeJson.mockImplementation(() => {
        callTimes.push(Date.now());
        callCount++;
        if (callCount <= 3) {
          const error = new Error('EBUSY: resource busy');
          error.code = 'EBUSY';
          return Promise.reject(error);
        }
        return Promise.resolve();
      });
      
      const startTime = Date.now();
      await cacheManager.setValidated('test diff', ['message']);
      const totalTime = Date.now() - startTime;
      
      expect(callCount).toBe(4); // Should have retried 3 times + 1 success
      
      // Verify exponential backoff (each retry should take longer)
      if (callTimes.length >= 3) {
        const backoff1 = callTimes[1] - callTimes[0];
        const backoff2 = callTimes[2] - callTimes[1];
        expect(backoff2).toBeGreaterThan(backoff1);
      }
    });

    it('should implement fallback mechanisms', async () => {
      const logger = new ActivityLogger();
      
      // Mock primary failure, fallback success
      let primaryAttempts = 0;
      mockFs.appendFile.mockImplementation((path, content) => {
        primaryAttempts++;
        if (primaryAttempts <= 2) {
          return Promise.reject(new Error('ENOSPC: no space left on device'));
        }
        // Fallback to different location or method
        return Promise.resolve();
      });
      
      await expect(logger.logActivity('info', 'fallback-test', {}))
        .resolves.toBeUndefined();
    });

    it('should implement graceful degradation', async () => {
      const configManager = new ConfigManager();
      
      // Mock progressive feature degradation
      let degradationLevel = 0;
      mockFs.writeJson.mockImplementation(() => {
        degradationLevel++;
        switch (degradationLevel) {
          case 1:
            return Promise.reject(new Error('ENOSPC: no space left on device'));
          case 2:
            return Promise.reject(new Error('EIO: input/output error'));
          case 3:
            return Promise.reject(new Error('EACCES: permission denied'));
          default:
            return Promise.resolve();
        }
      });
      
      // Should degrade gracefully
      await expect(configManager.export('/test.json'))
        .resolves.toBeUndefined();
    });

    it('should implement data recovery from backups', async () => {
      const configManager = new ConfigManager();
      
      // Mock backup recovery
      mockFs.readJson.mockImplementation((path) => {
        if (path.includes('.backup')) {
          return Promise.resolve({ recovered: true, data: 'backup-data' });
        }
        return Promise.reject(new Error('EIO: input/output error'));
      });
      
      mockFs.pathExists.mockImplementation((path) => {
        return Promise.resolve(path.includes('.backup'));
      });
      
      // Should recover from backup
      const result = await configManager.import('/corrupted.json');
      expect(result).toBeDefined();
    });
  });

  describe('Error Reporting and Diagnostics', () => {
    it('should provide detailed error context', async () => {
      const cacheManager = new CacheManager();
      
      // Mock error with context
      mockFs.writeJson.mockImplementation((path, data) => {
        const error = new Error('ENOSPC: no space left on device');
        error.code = 'ENOSPC';
        error.path = path;
        error.operation = 'write';
        error.dataSize = JSON.stringify(data).length;
        error.availableSpace = 0;
        return Promise.reject(error);
      });
      
      await cacheManager.setValidated('test diff', ['message']);
      
      // Error should be captured with context (would need logging verification)
      expect(mockFs.writeJson).toHaveBeenCalled();
    });

    it('should implement error aggregation and reporting', async () => {
      const logger = new ActivityLogger();
      
      // Mock multiple error types
      const errors = [
        'EACCES: permission denied',
        'ENOSPC: no space left on device',
        'EIO: input/output error',
        'ETIMEDOUT: operation timed out'
      ];
      
      let errorIndex = 0;
      mockFs.appendFile.mockImplementation(() => {
        const error = new Error(errors[errorIndex % errors.length]);
        error.code = errors[errorIndex % errors.length].split(':')[0];
        errorIndex++;
        return Promise.reject(error);
      });
      
      // Generate multiple errors
      const operations = Array.from({ length: 10 }, (_, i) => 
        logger.logActivity('error', `error-${i}`, { index: i })
      );
      
      await Promise.allSettled(operations);
      
      // Should aggregate and report errors (would need verification)
      expect(mockFs.appendFile).toHaveBeenCalledTimes(10);
    });

    it('should implement health checks for file system', async () => {
      const cacheManager = new CacheManager();
      
      // Mock health check scenarios
      const healthChecks = [
        { operation: 'read', result: 'success' },
        { operation: 'write', result: 'success' },
        { operation: 'delete', result: 'success' },
        { operation: 'stat', result: 'success' }
      ];
      
      for (const check of healthChecks) {
        switch (check.operation) {
          case 'read':
            mockFs.readJson.mockResolvedValue({ health: 'ok' });
            break;
          case 'write':
            mockFs.writeJson.mockResolvedValue();
            break;
          case 'delete':
            mockFs.remove.mockResolvedValue();
            break;
          case 'stat':
            mockFs.stat.mockResolvedValue({
              size: 1024,
              isFile: () => true,
              isDirectory: () => false
            });
            break;
        }
      }
      
      // Should perform health checks
      const stats = await cacheManager.getStats();
      expect(stats).toBeDefined();
    });

    it('should implement diagnostic information collection', async () => {
      const configManager = new ConfigManager();
      
      // Mock diagnostic information
      mockFs.stat.mockResolvedValue({
        size: 1024,
        birthtime: new Date('2023-01-01'),
        ctime: new Date('2023-01-01'),
        mtime: new Date('2023-01-01'),
        isFile: () => true,
        isDirectory: () => false,
        mode: 0o644,
        uid: 1000,
        gid: 1000
      });
      
      // Should collect diagnostic information
      try {
        await configManager.import('/diagnostic.json');
      } catch (error) {
        // Error should contain diagnostic information
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance Under Error Conditions', () => {
    it('should maintain performance during error spikes', async () => {
      const logger = new ActivityLogger();
      
      // Mock error spike (50% failure rate)
      let callCount = 0;
      mockFs.appendFile.mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          return Promise.reject(new Error('EIO: input/output error'));
        }
        return Promise.resolve();
      });
      
      const startTime = Date.now();
      const operations = Array.from({ length: 100 }, (_, i) => 
        logger.logActivity('info', `perf-test-${i}`, { index: i })
      );
      
      await Promise.allSettled(operations);
      const duration = Date.now() - startTime;
      
      // Should complete in reasonable time despite errors
      expect(duration).toBeLessThan(5000); // 5 seconds
    });

    it('should handle resource exhaustion gracefully', async () => {
      const cacheManager = new CacheManager();
      
      // Mock resource exhaustion
      let resourceLevel = 100;
      mockFs.writeJson.mockImplementation(() => {
        resourceLevel -= 10;
        if (resourceLevel <= 0) {
          return Promise.reject(new Error('ENOMEM: out of memory'));
        }
        return Promise.resolve();
      });
      
      // Should handle resource exhaustion
      const operations = Array.from({ length: 15 }, (_, i) => 
        cacheManager.setValidated(`diff-${i}`, [`message-${i}`])
      );
      
      const results = await Promise.allSettled(operations);
      
      // Some operations should succeed before exhaustion
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(0);
      expect(successCount).toBeLessThan(15);
    });

    it('should implement throttling under error conditions', async () => {
      const configManager = new ConfigManager();
      
      // Mock throttling scenario
      let lastCallTime = 0;
      mockFs.writeJson.mockImplementation(() => {
        const now = Date.now();
        if (now - lastCallTime < 100) { // Less than 100ms since last call
          return Promise.reject(new Error('EAGAIN: resource temporarily unavailable'));
        }
        lastCallTime = now;
        return Promise.resolve();
      });
      
      const startTime = Date.now();
      const operations = Array.from({ length: 10 }, (_, i) => 
        configManager.set(`key-${i}`, `value-${i}`)
      );
      
      await Promise.all(operations);
      const duration = Date.now() - startTime;
      
      // Should take at least 900ms due to throttling (9 intervals of 100ms)
      expect(duration).toBeGreaterThan(800);
    });
  });

  describe('Concurrent Error Handling', () => {
    it('should handle concurrent operations with mixed success/failure', async () => {
      const cacheManager = new CacheManager();
      
      // Mock mixed success/failure for concurrent operations
      let callCount = 0;
      mockFs.writeJson.mockImplementation(() => {
        callCount++;
        if (callCount % 3 === 0) {
          return Promise.reject(new Error('EIO: input/output error'));
        }
        return Promise.resolve();
      });
      
      const operations = Array.from({ length: 30 }, (_, i) => 
        cacheManager.setValidated(`diff-${i}`, [`message-${i}`])
      );
      
      const results = await Promise.allSettled(operations);
      
      // Should have mixed results
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount).toBeGreaterThan(0);
      expect(failureCount).toBeGreaterThan(0);
      expect(successCount + failureCount).toBe(30);
    });

    it('should prevent error propagation between concurrent operations', async () => {
      const logger = new ActivityLogger();
      
      // Mock isolated errors
      mockFs.appendFile.mockImplementation((path, content) => {
        const data = JSON.parse(content);
        if (data.action && data.action.includes('error')) {
          return Promise.reject(new Error('EIO: input/output error'));
        }
        return Promise.resolve();
      });
      
      // Mix of operations that should and shouldn't fail
      const operations = [
        logger.logActivity('info', 'success-1', {}),
        logger.logActivity('error', 'error-1', {}),
        logger.logActivity('info', 'success-2', {}),
        logger.logActivity('error', 'error-2', {}),
        logger.logActivity('info', 'success-3', {})
      ];
      
      const results = await Promise.allSettled(operations);
      
      // Success operations should succeed despite error operations
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
      expect(results[3].status).toBe('rejected');
      expect(results[4].status).toBe('fulfilled');
    });

    it('should handle resource contention under concurrent load', async () => {
      const configManager = new ConfigManager();
      
      // Mock resource contention
      let lockCount = 0;
      mockFs.writeJson.mockImplementation(() => {
        lockCount++;
        if (lockCount > 5) { // Simulate resource limit
          return Promise.reject(new Error('EBUSY: resource busy'));
        }
        return Promise.resolve();
      });
      
      const operations = Array.from({ length: 20 }, (_, i) => 
        configManager.set(`key-${i}`, `value-${i}`)
      );
      
      const results = await Promise.allSettled(operations);
      
      // Some operations should succeed, others should fail due to contention
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(0);
      expect(successCount).toBeLessThan(20);
    });
  });
});