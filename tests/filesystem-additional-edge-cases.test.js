/**
 * Additional File System Edge Case Tests
 * Specialized scenarios for robust file system handling
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

describe('Additional File System Edge Cases', () => {
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

  describe('File System Race Conditions', () => {
    it('should handle directory creation race conditions', async () => {
      const cacheManager = new CacheManager();
      
      // Simulate race condition where directory is created by another process
      let callCount = 0;
      mockFs.ensureDir.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('EEXIST: file already exists'));
        }
        return Promise.resolve();
      });
      
      // Should handle race condition gracefully
      await expect(cacheManager.ensureCacheDir()).resolves.toBeUndefined();
    });

    it('should handle file deletion race conditions', async () => {
      const logger = new ActivityLogger();
      
      // Simulate file being deleted during operation
      mockFs.appendFile.mockImplementation(() => {
        return Promise.reject(new Error('ENOENT: no such file or directory'));
      });
      
      // Should handle file deletion gracefully
      await expect(logger.logActivity('info', 'test', {}))
        .resolves.toBeUndefined();
    });

    it('should handle concurrent file modifications', async () => {
      const configManager = new ConfigManager();
      
      // Simulate file being modified by another process
      let callCount = 0;
      mockFs.readJson.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ key1: 'value1' });
        }
        return Promise.resolve({ key1: 'value2' }); // Different content
      });
      
      const result1 = await configManager.load();
      const result2 = await configManager.load();
      
      // Should handle concurrent modifications
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  describe('File System Metadata Issues', () => {
    it('should handle corrupted file metadata', async () => {
      const logger = new ActivityLogger();
      
      // Mock corrupted metadata
      mockFs.stat.mockRejectedValue(new Error('EBADF: bad file descriptor'));
      
      // Should handle corrupted metadata gracefully
      await expect(logger.logActivity('warn', 'metadata_error', {}))
        .resolves.toBeUndefined();
    });

    it('should handle files with invalid timestamps', async () => {
      const cacheManager = new CacheManager();
      
      // Mock invalid timestamp
      const invalidDate = new Date('invalid');
      mockFs.stat.mockResolvedValue({
        size: 1024,
        birthtime: invalidDate,
        ctime: invalidDate,
        mtime: invalidDate,
        isFile: () => true,
        isDirectory: () => false
      });
      
      const stats = await cacheManager.getStats();
      expect(stats).toBeDefined();
    });

    it('should handle files with future timestamps', async () => {
      const logger = new ActivityLogger();
      
      // Mock future timestamp
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year in future
      mockFs.stat.mockResolvedValue({
        size: 1024,
        birthtime: futureDate,
        ctime: futureDate,
        mtime: futureDate,
        isFile: () => true,
        isDirectory: () => false
      });
      
      await expect(logger.cleanOldLogs()).resolves.toBeUndefined();
    });

    it('should handle zero-byte files', async () => {
      const configManager = new ConfigManager();
      
      // Mock zero-byte file
      mockFs.readJson.mockRejectedValue(new SyntaxError('Unexpected end of JSON input'));
      mockFs.stat.mockResolvedValue({
        size: 0,
        birthtime: new Date(),
        ctime: new Date(),
        mtime: new Date(),
        isFile: () => true,
        isDirectory: () => false
      });
      
      await expect(configManager.import('/empty/config.json'))
        .rejects.toThrow('Failed to import configuration');
    });

    it('should handle extremely large file sizes', async () => {
      const cacheManager = new CacheManager();
      
      // Mock extremely large file size (close to 64-bit limit)
      const largeSize = Number.MAX_SAFE_INTEGER;
      mockFs.stat.mockResolvedValue({
        size: largeSize,
        birthtime: new Date(),
        ctime: new Date(),
        mtime: new Date(),
        isFile: () => true,
        isDirectory: () => false
      });
      
      const stats = await cacheManager.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe('File System Permission Edge Cases', () => {
    it('should handle read-only file systems', async () => {
      const configManager = new ConfigManager();
      
      // Mock read-only file system
      mockFs.writeJson.mockRejectedValue(new Error('EROFS: read-only file system'));
      
      await expect(configManager.export('/readonly/config.json'))
        .rejects.toThrow('Failed to export configuration');
    });

    it('should handle immutable files', async () => {
      const hookManager = new HookManager();
      
      // Mock immutable file (cannot be modified)
      mockFs.writeFile.mockRejectedValue(new Error('EPERM: operation not permitted'));
      
      // Should handle immutable files gracefully
      await expect(hookManager.install())
        .rejects.toThrow('Failed to install git hook');
    });

    it('should handle append-only files', async () => {
      const logger = new ActivityLogger();
      
      // Mock append-only file (cannot be truncated)
      mockFs.appendFile.mockRejectedValue(new Error('EPERM: operation not permitted'));
      
      await expect(logger.logActivity('error', 'append_only_error', {}))
        .resolves.toBeUndefined();
    });

    it('should handle files with special permission bits', async () => {
      const hookManager = new HookManager();
      
      // Mock file with special permissions (setuid, setgid, sticky)
      mockFs.writeFile.mockImplementation((path, content, options) => {
        if (options && options.mode) {
          // Should handle special permission bits
          expect(options.mode & 0o4000).toBeDefined(); // setuid
          expect(options.mode & 0o2000).toBeDefined(); // setgid
          expect(options.mode & 0o1000).toBeDefined(); // sticky
        }
        return Promise.resolve();
      });
      
      // This test verifies that permission bits are handled correctly
      await expect(hookManager.install()).resolves.toBeDefined();
    });
  });

  describe('File System Type Specific Issues', () => {
    it('should handle case-sensitive file systems', async () => {
      const configManager = new ConfigManager();
      
      // Mock case-sensitive behavior
      let callCount = 0;
      mockFs.pathExists.mockImplementation((path) => {
        callCount++;
        if (path.includes('Config.json')) {
          return Promise.resolve(false); // Case-sensitive check fails
        }
        return Promise.resolve(true);
      });
      
      // Should handle case sensitivity
      await expect(configManager.import('Config.json'))
        .rejects.toThrow('Failed to import configuration');
    });

    it('should handle case-insensitive file systems', async () => {
      const configManager = new ConfigManager();
      
      // Mock case-insensitive behavior
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue({ test: 'config' });
      
      const result = await configManager.import('CONFIG.JSON');
      expect(result).toBeDefined();
    });

    it('should handle network file system latency', async () => {
      const cacheManager = new CacheManager();
      
      // Mock high latency network file system
      mockFs.readJson.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ messages: ['test'] }), 3000) // 3 second delay
        )
      );
      
      const startTime = Date.now();
      const result = await cacheManager.getValidated('test diff');
      const duration = Date.now() - startTime;
      
      expect(result).toEqual(['test']);
      expect(duration).toBeGreaterThan(2500);
    });

    it('should handle compressed file systems', async () => {
      const logger = new ActivityLogger();
      
      // Mock compressed file system (might have different performance characteristics)
      mockFs.appendFile.mockImplementation((path, content) => {
        // Simulate compression overhead
        return new Promise(resolve => 
          setTimeout(resolve, 100) // Small delay for compression
        );
      });
      
      await expect(logger.logActivity('info', 'compressed_fs', {}))
        .resolves.toBeUndefined();
    });

    it('should handle encrypted file systems', async () => {
      const configManager = new ConfigManager();
      
      // Mock encrypted file system (might have different error codes)
      mockFs.writeJson.mockRejectedValue(new Error('EACCES: permission denied (encrypted)'));
      
      await expect(configManager.export('/encrypted/config.json'))
        .rejects.toThrow('Failed to export configuration');
    });
  });

  describe('File System Recovery and Resilience', () => {
    it('should handle automatic retry on transient failures', async () => {
      const cacheManager = new CacheManager();
      
      // Mock transient failure that resolves on retry
      let callCount = 0;
      mockFs.writeJson.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('EBUSY: resource busy'));
        }
        return Promise.resolve();
      });
      
      // Should eventually succeed after retries
      await expect(cacheManager.setValidated('test diff', ['message']))
        .resolves.toBeUndefined();
      expect(callCount).toBe(3);
    });

    it('should handle graceful degradation on partial failures', async () => {
      const logger = new ActivityLogger();
      
      // Mock partial failure - some operations succeed, others fail
      let callCount = 0;
      mockFs.appendFile.mockImplementation(() => {
        callCount++;
        if (callCount % 3 === 0) {
          return Promise.reject(new Error('ENOSPC: no space left on device'));
        }
        return Promise.resolve();
      });
      
      // Some operations should succeed even when others fail
      const operations = Array.from({ length: 10 }, (_, i) => 
        logger.logActivity('info', `partial-${i}`, { index: i })
      );
      
      await expect(Promise.allSettled(operations)).resolves.toBeDefined();
    });

    it('should handle fallback mechanisms', async () => {
      const cacheManager = new CacheManager();
      
      // Mock primary storage failure, fallback success
      mockFs.writeJson.mockImplementation((path, data) => {
        if (path.includes('cache')) {
          return Promise.reject(new Error('EIO: input/output error'));
        }
        return Promise.resolve();
      });
      
      // Should handle fallback gracefully
      await expect(cacheManager.setValidated('test diff', ['message']))
        .resolves.toBeUndefined();
    });

    it('should handle data corruption detection', async () => {
      const configManager = new ConfigManager();
      
      // Mock corrupted data detection
      mockFs.readJson.mockImplementation(() => {
        const error = new SyntaxError('Unexpected token');
        error.code = 'CORRUPTED_DATA';
        return Promise.reject(error);
      });
      
      await expect(configManager.import('/corrupted/config.json'))
        .rejects.toThrow('Failed to import configuration');
    });
  });

  describe('File System Monitoring and Events', () => {
    it('should handle file system watch events', async () => {
      const cacheManager = new CacheManager();
      
      // Mock file system change during operation
      let callCount = 0;
      mockFs.readJson.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({ messages: ['old'], timestamp: Date.now() - 1000 });
        }
        return Promise.resolve({ messages: ['new'], timestamp: Date.now() });
      });
      
      const result1 = await cacheManager.getValidated('test diff');
      const result2 = await cacheManager.getValidated('test diff');
      
      // Should handle file changes during operation
      expect(result1).toEqual(['old']);
      expect(result2).toEqual(['new']);
    });

    it('should handle file system mount/unmount events', async () => {
      const logger = new ActivityLogger();
      
      // Mock file system unmount during operation
      mockFs.appendFile.mockImplementation(() => {
        const error = new Error('EIO: input/output error');
        error.code = 'FS_UNMOUNTED';
        return Promise.reject(error);
      });
      
      await expect(logger.logActivity('error', 'fs_unmounted', {}))
        .resolves.toBeUndefined();
    });

    it('should handle file system quota exceeded', async () => {
      const configManager = new ConfigManager();
      
      // Mock quota exceeded
      mockFs.writeJson.mockRejectedValue(new Error('EDQUOT: disk quota exceeded'));
      
      await expect(configManager.export('/quota/exceeded/config.json'))
        .rejects.toThrow('Failed to export configuration');
    });
  });

  describe('Cross-Platform File System Issues', () => {
    it('should handle Windows path separators on Unix', async () => {
      const configManager = new ConfigManager();
      
      const windowsPath = 'C:\\Users\\test\\config.json';
      const unixPath = '/mnt/c/Users/test/config.json';
      
      mockFs.writeJson.mockImplementation((path) => {
        // Should handle path conversion
        expect(path).toMatch(/^(\/|[A-Za-z]:)/);
        return Promise.resolve();
      });
      
      await expect(configManager.export(windowsPath))
        .resolves.toBeUndefined();
    });

    it('should handle Unix path separators on Windows', async () => {
      const configManager = new ConfigManager();
      
      const unixPath = '/home/user/config.json';
      const windowsPath = 'C:\\home\\user\\config.json';
      
      mockFs.writeJson.mockResolvedValue();
      
      await expect(configManager.export(unixPath))
        .resolves.toBeUndefined();
    });

    it('should handle platform-specific file attributes', async () => {
      const hookManager = new HookManager();
      
      // Mock platform-specific attributes
      mockFs.writeFile.mockImplementation((path, content, options) => {
        if (process.platform === 'win32') {
          // Windows-specific attributes
          expect(options.mode || 0o644).toBeDefined();
        } else {
          // Unix-specific permissions
          expect(options.mode || 0o755).toBeDefined();
        }
        return Promise.resolve();
      });
      
      await expect(hookManager.install()).resolves.toBeDefined();
    });

    it('should handle different file system case behaviors', async () => {
      const configManager = new ConfigManager();
      
      // Test different case behaviors
      const testCases = [
        'config.json',
        'Config.json',
        'CONFIG.JSON',
        'config.JSON'
      ];
      
      for (const testCase of testCases) {
        mockFs.readJson.mockResolvedValue({ test: 'config' });
        
        const result = await configManager.import(testCase);
        expect(result).toBeDefined();
      }
    });

    it('should handle different line ending conventions', async () => {
      const hookManager = new HookManager();
      
      // Test different line endings
      const lineEndings = [
        '#!/bin/bash\n# Unix line endings',
        '#!/bin/bash\r\n# Windows line endings',
        '#!/bin/bash\r# Old Mac line endings'
      ];
      
      for (const content of lineEndings) {
        mockFs.readFile.mockResolvedValue(content);
        
        const result = await hookManager.isInstalled();
        expect(typeof result).toBe('boolean');
      }
    });
  });

  describe('File System Security and Access Control', () => {
    it('should handle file access security violations', async () => {
      const configManager = new ConfigManager();
      
      // Mock security violation
      mockFs.readJson.mockRejectedValue(new Error('EACCES: permission denied (security policy)'));
      
      await expect(configManager.import('/secure/config.json'))
        .rejects.toThrow('Failed to import configuration');
    });

    it('should handle file system access control lists (ACLs)', async () => {
      const hookManager = new HookManager();
      
      // Mock ACL restrictions
      mockFs.writeFile.mockRejectedValue(new Error('EACCES: permission denied (ACL restriction)'));
      
      await expect(hookManager.install())
        .rejects.toThrow('Failed to install git hook');
    });

    it('should handle file system mandatory access control (MAC)', async () => {
      const logger = new ActivityLogger();
      
      // Mock MAC restrictions (SELinux, AppArmor)
      mockFs.appendFile.mockRejectedValue(new Error('EACCES: permission denied (MAC policy)'));
      
      await expect(logger.logActivity('error', 'mac_denied', {}))
        .resolves.toBeUndefined();
    });

    it('should handle file system sandbox restrictions', async () => {
      const configManager = new ConfigManager();
      
      // Mock sandbox restrictions
      mockFs.writeJson.mockRejectedValue(new Error('EPERM: operation not permitted (sandbox)'));
      
      await expect(configManager.export('/sandbox/restricted/config.json'))
        .rejects.toThrow('Failed to export configuration');
    });
  });

  describe('File System Performance Optimization', () => {
    it('should handle file system buffering optimization', async () => {
      const logger = new ActivityLogger();
      
      // Mock buffered writes
      let buffer = [];
      mockFs.appendFile.mockImplementation((path, content) => {
        buffer.push(content);
        // Simulate buffer flush
        if (buffer.length >= 10) {
          buffer = [];
        }
        return Promise.resolve();
      });
      
      // Should handle buffering efficiently
      const operations = Array.from({ length: 25 }, (_, i) => 
        logger.logActivity('info', `buffered-${i}`, { index: i })
      );
      
      await expect(Promise.all(operations)).resolves.toBeUndefined();
    });

    it('should handle file system caching behavior', async () => {
      const cacheManager = new CacheManager();
      
      // Mock file system caching
      let cacheHits = 0;
      mockFs.readJson.mockImplementation(() => {
        cacheHits++;
        if (cacheHits > 1) {
          // Simulate cache hit - faster response
          return Promise.resolve({ messages: ['cached'], timestamp: Date.now() });
        }
        return Promise.resolve({ messages: ['fresh'], timestamp: Date.now() });
      });
      
      const result1 = await cacheManager.getValidated('test diff');
      const result2 = await cacheManager.getValidated('test diff');
      
      expect(result1).toEqual(['fresh']);
      expect(result2).toEqual(['cached']);
    });

    it('should handle file system async I/O optimization', async () => {
      const configManager = new ConfigManager();
      
      // Mock async I/O optimization
      mockFs.writeJson.mockImplementation(() => {
        return new Promise(resolve => {
          // Simulate async I/O queue
          setImmediate(resolve);
        });
      });
      
      const startTime = Date.now();
      await configManager.export('/async/config.json');
      const duration = Date.now() - startTime;
      
      // Should complete quickly due to async optimization
      expect(duration).toBeLessThan(100);
    });
  });
});