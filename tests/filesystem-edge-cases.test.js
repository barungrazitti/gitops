/**
 * Comprehensive File System Edge Case Tests
 * Tests for extreme file system scenarios and edge cases
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const GitManager = require('../src/core/git-manager');
const ConfigManager = require('../src/core/config-manager');
const CacheManager = require('../src/core/cache-manager');
const ActivityLogger = require('../src/core/activity-logger');
const HookManager = require('../src/core/hook-manager');
const AutoGit = require('../src/auto-git');

// Mock external dependencies
jest.mock('fs-extra');
jest.mock('simple-git');
jest.mock('conf');

describe('File System Edge Cases', () => {
  let mockFs;
  let mockGit;
  let mockConf;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup comprehensive mocks
    mockFs = require('fs-extra');
    mockGit = require('simple-git')();
    mockConf = require('conf');
    
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

  describe('1. Extremely Large Files', () => {
    describe('GitManager with large diffs', () => {
      it('should handle extremely large diff files (>100MB)', async () => {
        const gitManager = new GitManager();
        const largeDiff = 'a'.repeat(100 * 1024 * 1024); // 100MB
        
        mockGit.diff.mockResolvedValue(largeDiff);
        
        // Should handle large files without memory issues
        const result = await gitManager.getStagedDiff();
        expect(result).toBe(largeDiff);
        expect(mockGit.diff).toHaveBeenCalled();
      });

      it('should handle binary file diffs gracefully', async () => {
        const gitManager = new GitManager();
        const binaryDiff = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        
        mockGit.diff.mockResolvedValue(binaryDiff.toString('binary'));
        
        const result = await gitManager.getStagedDiff();
        expect(typeof result).toBe('string');
      });

      it('should handle memory pressure from large file operations', async () => {
        const gitManager = new GitManager();
        
        // Simulate memory pressure
        const originalMemoryUsage = process.memoryUsage;
        process.memoryUsage = jest.fn().mockReturnValue({
          rss: 16 * 1024 * 1024 * 1024, // 16GB
          heapUsed: 8 * 1024 * 1024 * 1024, // 8GB
          heapTotal: 12 * 1024 * 1024 * 1024, // 12GB
          external: 1 * 1024 * 1024 * 1024, // 1GB
          arrayBuffers: 500 * 1024 * 1024 // 500MB
        });
        
        try {
          const largeDiff = 'x'.repeat(50 * 1024 * 1024); // 50MB
          mockGit.diff.mockResolvedValue(largeDiff);
          
          const result = await gitManager.getStagedDiff();
          expect(result).toBeDefined();
        } finally {
          process.memoryUsage = originalMemoryUsage;
        }
      });
    });

    describe('CacheManager with large cache files', () => {
      it('should handle large cache file operations', async () => {
        const cacheManager = new CacheManager();
        const largeData = 'data'.repeat(10 * 1024 * 1024); // 40MB
        
        mockFs.readJson.mockResolvedValue({
          messages: ['test'],
          timestamp: Date.now(),
          diff: largeData
        });
        
        const result = await cacheManager.getValidated('test diff');
        expect(result).toEqual(['test']);
      });

      it('should handle cache directory size limits', async () => {
        const cacheManager = new CacheManager();
        
        // Mock many large cache files
        const largeFiles = Array.from({ length: 100 }, (_, i) => `cache-${i}.json`);
        mockFs.readdir.mockResolvedValue(largeFiles);
        
        const largeStats = largeFiles.map(() => ({
          size: 10 * 1024 * 1024, // 10MB each
          birthtime: new Date(),
          ctime: new Date(),
          mtime: new Date()
        }));
        
        mockFs.stat.mockImplementation((filePath) => {
          const index = largeFiles.indexOf(path.basename(filePath));
          return Promise.resolve(largeStats[index] || { size: 0, mtime: new Date() });
        });
        
        const stats = await cacheManager.getStats();
        expect(stats.persistent).toBeDefined();
      });
    });

    describe('ActivityLogger with large log files', () => {
      it('should handle log rotation for large files', async () => {
        const logger = new ActivityLogger();
        
        // Mock large log file that needs rotation
        mockFs.stat.mockResolvedValue({
          size: 15 * 1024 * 1024, // 15MB (exceeds 10MB limit)
          mtime: new Date()
        });
        
        await logger.logActivity('info', 'test', { data: 'large'.repeat(1000000) });
        
        expect(mockFs.appendFile).toHaveBeenCalled();
        expect(mockFs.move).toHaveBeenCalled(); // Should rotate
      });

      it('should handle large log content during export', async () => {
        const logger = new ActivityLogger();
        
        const largeLogContent = Array.from({ length: 10000 }, (_, i) => 
          JSON.stringify({
            timestamp: new Date().toISOString(),
            sessionId: `session-${i}`,
            level: 'INFO',
            action: 'test',
            data: { largeData: 'x'.repeat(1000) }
          })
        ).join('\n');
        
        mockFs.readFile.mockResolvedValue(largeLogContent);
        
        const exported = await logger.exportLogs('json');
        expect(typeof exported).toBe('string');
        expect(exported.length).toBeGreaterThan(1000000);
      });
    });
  });

  describe('2. Permission Issues', () => {
    it('should handle read-only directory access', async () => {
      const configManager = new ConfigManager();
      
      // Mock EACCES error (permission denied)
      mockFs.ensureDir.mockRejectedValue(new Error('EACCES: permission denied'));
      
      await expect(configManager.export('/readonly/path/config.json'))
        .rejects.toThrow('Failed to export configuration');
    });

    it('should handle protected file access', async () => {
      const hookManager = new HookManager();
      
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockRejectedValue(new Error('EACCES: permission denied'));
      
      await expect(hookManager.isInstalled())
        .resolves.toBe(false); // Should gracefully handle permission error
    });

    it('should handle cache directory permission errors', async () => {
      const cacheManager = new CacheManager();
      
      // Mock permission error during cache directory creation
      mockFs.ensureDir.mockRejectedValue(new Error('EPERM: operation not permitted'));
      
      // Should not throw, but handle gracefully
      await expect(cacheManager.ensureCacheDir()).resolves.toBeUndefined();
    });

    it('should handle log file permission errors', async () => {
      const logger = new ActivityLogger();
      
      mockFs.appendFile.mockRejectedValue(new Error('EACCES: permission denied'));
      
      // Should handle gracefully and not crash
      await expect(logger.logActivity('info', 'test', {}))
        .resolves.toBeUndefined();
    });

    it('should handle git hook permission issues', async () => {
      const hookManager = new HookManager();
      
      mockGit.revparse.mockResolvedValue('/repo/root');
      mockFs.ensureDir.mockResolvedValue();
      mockFs.pathExists.mockResolvedValue(false);
      mockFs.writeFile.mockRejectedValue(new Error('EACCES: permission denied'));
      
      await expect(hookManager.install())
        .rejects.toThrow('Failed to install git hook');
    });
  });

  describe('3. Disk Space Exhaustion', () => {
    it('should handle ENOSPC errors during file writes', async () => {
      const configManager = new ConfigManager();
      
      mockFs.writeJson.mockRejectedValue(new Error('ENOSPC: no space left on device'));
      
      await expect(configManager.export('/full/disk/config.json'))
        .rejects.toThrow('Failed to export configuration');
    });

    it('should handle disk full during cache operations', async () => {
      const cacheManager = new CacheManager();
      
      mockFs.writeJson.mockRejectedValue(new Error('ENOSPC: no space left on device'));
      
      // Should handle gracefully without crashing
      await expect(cacheManager.setValidated('test diff', ['message']))
        .resolves.toBeUndefined();
    });

    it('should handle disk full during logging', async () => {
      const logger = new ActivityLogger();
      
      mockFs.appendFile.mockRejectedValue(new Error('ENOSPC: no space left on device'));
      
      // Should handle gracefully
      await expect(logger.logActivity('error', 'disk_full', {}))
        .resolves.toBeUndefined();
    });

    it('should handle quota exceeded scenarios', async () => {
      const configManager = new ConfigManager();
      
      mockFs.writeJson.mockRejectedValue(new Error('EDQUOT: disk quota exceeded'));
      
      await expect(configManager.export('/quota/exceeded/config.json'))
        .rejects.toThrow('Failed to export configuration');
    });
  });

  describe('4. File System Corruption and Invalid Paths', () => {
    it('should handle corrupted cache files', async () => {
      const cacheManager = new CacheManager();
      
      // Mock corrupted JSON
      mockFs.readJson.mockRejectedValue(new SyntaxError('Unexpected token'));
      
      const result = await cacheManager.getValidated('test diff');
      expect(result).toBeNull(); // Should handle corrupted file gracefully
    });

    it('should handle invalid file paths', async () => {
      const configManager = new ConfigManager();
      
      const invalidPaths = [
        '',
        null,
        undefined,
        '/dev/null/config.json',
        '/proc/version',
        'C:\\con\\config.txt', // Windows reserved name
        'file<>name.json', // Invalid characters
        'path/with/\0/null.json' // Null byte
      ];
      
      for (const invalidPath of invalidPaths) {
        mockFs.writeJson.mockRejectedValue(new Error('EINVAL: invalid argument'));
        
        await expect(configManager.export(invalidPath))
          .rejects.toThrow('Failed to export configuration');
      }
    });

    it('should handle broken symbolic links', async () => {
      const cacheManager = new CacheManager();
      
      // Mock broken symlink
      mockFs.pathExists.mockResolvedValue(false);
      mockFs.readJson.mockRejectedValue(new Error('ENOENT: no such file or directory'));
      
      const result = await cacheManager.getValidated('test diff');
      expect(result).toBeNull();
    });

    it('should handle file system during mount/unmount', async () => {
      const logger = new ActivityLogger();
      
      // Mock filesystem unmounted
      mockFs.appendFile.mockRejectedValue(new Error('EIO: input/output error'));
      
      await expect(logger.logActivity('warn', 'fs_error', {}))
        .resolves.toBeUndefined();
    });

    it('should handle extremely long file paths', async () => {
      const configManager = new ConfigManager();
      
      // Create path that exceeds typical limits (260 chars on Windows, 4096 on Unix)
      const longPath = '/very/long/path/' + 'a'.repeat(500) + '/config.json';
      
      mockFs.writeJson.mockRejectedValue(new Error('ENAMETOOLONG: file name too long'));
      
      await expect(configManager.export(longPath))
        .rejects.toThrow('Failed to export configuration');
    });
  });

  describe('5. Symbolic Links and Circular References', () => {
    it('should handle symbolic link loops', async () => {
      const cacheManager = new CacheManager();
      
      // Mock symlink loop detection
      mockFs.readdir.mockRejectedValue(new Error('ELOOP: too many levels of symbolic links'));
      
      const stats = await cacheManager.getStats();
      expect(stats.persistent.files).toBe(0); // Should handle gracefully
    });

    it('should handle symbolic link to directory', async () => {
      const hookManager = new HookManager();
      
      mockGit.revparse.mockResolvedValue('/repo/root');
      mockFs.ensureDir.mockResolvedValue();
      mockFs.pathExists.mockResolvedValue(false);
      
      // Mock symlink scenario
      mockFs.writeFile.mockImplementation((filePath, content) => {
        if (filePath.includes('hooks')) {
          return Promise.reject(new Error('EISDIR: is a directory'));
        }
        return Promise.resolve();
      });
      
      await expect(hookManager.install())
        .rejects.toThrow('Failed to install git hook');
    });

    it('should handle dangling symbolic links', async () => {
      const logger = new ActivityLogger();
      
      // Mock dangling symlink
      mockFs.stat.mockRejectedValue(new Error('ENOENT: no such file or directory'));
      
      await expect(logger.logActivity('info', 'test', {}))
        .resolves.toBeUndefined();
    });

    it('should handle hard links to same file', async () => {
      const configManager = new ConfigManager();
      
      // Mock hard link scenario
      mockFs.readJson.mockResolvedValue({ test: 'config' });
      
      const result = await configManager.import('/hard/link/config.json');
      expect(result).toBeDefined();
    });
  });

  describe('6. Network File Systems and Latency', () => {
    it('should handle network file system timeouts', async () => {
      const cacheManager = new CacheManager();
      
      // Mock network timeout
      mockFs.readJson.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('ETIMEDOUT: operation timed out')), 100)
        )
      );
      
      const result = await cacheManager.getValidated('test diff');
      expect(result).toBeNull();
    });

    it('should handle slow network file operations', async () => {
      const configManager = new ConfigManager();
      
      // Mock slow network operation
      mockFs.writeJson.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(resolve, 5000) // 5 second delay
        )
      );
      
      const startTime = Date.now();
      await configManager.export('/nfs/config.json');
      const duration = Date.now() - startTime;
      
      expect(duration).toBeGreaterThan(4000);
    });

    it('should handle network file system disconnection', async () => {
      const logger = new ActivityLogger();
      
      // Mock network disconnection
      mockFs.appendFile.mockRejectedValue(new Error('ECONNRESET: connection reset by peer'));
      
      await expect(logger.logActivity('error', 'network_error', {}))
        .resolves.toBeUndefined();
    });

    it('should handle file locking on network shares', async () => {
      const configManager = new ConfigManager();
      
      // Mock file locking
      mockFs.writeJson.mockRejectedValue(new Error('EBUSY: resource busy'));
      
      await expect(configManager.export('/locked/share/config.json'))
        .rejects.toThrow('Failed to export configuration');
    });
  });

  describe('7. Concurrent File Access and Locking', () => {
    it('should handle concurrent cache access', async () => {
      const cacheManager = new CacheManager();
      
      // Simulate concurrent access
      const promises = Array.from({ length: 10 }, (_, i) => 
        cacheManager.setValidated(`diff-${i}`, [`message-${i}`])
      );
      
      await expect(Promise.all(promises)).resolves.toBeUndefined();
    });

    it('should handle file locking scenarios', async () => {
      const configManager = new ConfigManager();
      
      // Mock file locked by another process
      mockFs.writeJson.mockRejectedValue(new Error('EBUSY: resource busy or locked'));
      
      await expect(configManager.export('/locked/config.json'))
        .rejects.toThrow('Failed to export configuration');
    });

    it('should handle race conditions in log writing', async () => {
      const logger = new ActivityLogger();
      
      // Simulate concurrent logging
      const promises = Array.from({ length: 100 }, (_, i) => 
        logger.logActivity('info', `concurrent-${i}`, { id: i })
      );
      
      await expect(Promise.all(promises)).resolves.toBeUndefined();
    });

    it('should handle simultaneous hook operations', async () => {
      const hookManager = new HookManager();
      
      mockGit.revparse.mockResolvedValue('/repo/root');
      mockFs.ensureDir.mockResolvedValue();
      mockFs.pathExists.mockResolvedValue(false);
      
      // Simulate concurrent hook installations
      const promises = Array.from({ length: 5 }, () => hookManager.install());
      
      const results = await Promise.allSettled(promises);
      // Some might fail due to race conditions, but shouldn't crash
      expect(results.length).toBe(5);
    });
  });

  describe('8. Special Characters in Filenames and Paths', () => {
    it('should handle Unicode characters in paths', async () => {
      const configManager = new ConfigManager();
      
      const unicodePath = '/路径/配置/файл/🚀.json';
      mockFs.writeJson.mockResolvedValue();
      
      await expect(configManager.export(unicodePath))
        .resolves.toBeUndefined();
    });

    it('should handle spaces and special characters', async () => {
      const hookManager = new HookManager();
      
      mockGit.revparse.mockResolvedValue('/repo/root');
      mockFs.ensureDir.mockResolvedValue();
      mockFs.pathExists.mockResolvedValue(false);
      
      const specialPath = '/path with spaces/file (1).json';
      mockFs.writeFile.mockImplementation((path, content) => {
        expect(path).toContain('path with spaces');
        return Promise.resolve();
      });
      
      await expect(hookManager.install()).resolves.toBeDefined();
    });

    it('should handle emoji and non-ASCII characters', async () => {
      const logger = new ActivityLogger();
      
      const emojiData = { message: '🚀 Test with emoji: ñáéíóú' };
      mockFs.appendFile.mockResolvedValue();
      
      await expect(logger.logActivity('info', 'emoji_test', emojiData))
        .resolves.toBeUndefined();
    });

    it('should handle control characters in paths', async () => {
      const configManager = new ConfigManager();
      
      const controlCharPath = '/path\twith\ncontrol\rchars.json';
      mockFs.writeJson.mockRejectedValue(new Error('EINVAL: invalid argument'));
      
      await expect(configManager.export(controlCharPath))
        .rejects.toThrow('Failed to export configuration');
    });

    it('should handle reserved Windows filenames', async () => {
      const configManager = new ConfigManager();
      
      const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1'];
      
      for (const name of reservedNames) {
        mockFs.writeJson.mockRejectedValue(new Error('EINVAL: invalid argument'));
        
        await expect(configManager.export(`${name}.json`))
          .rejects.toThrow('Failed to export configuration');
      }
    });
  });

  describe('9. File Encoding Issues', () => {
    it('should handle UTF-8 encoding issues', async () => {
      const hookManager = new HookManager();
      
      // Mock invalid UTF-8 sequence
      const invalidUtf8 = Buffer.from([0xFF, 0xFE, 0xFD]);
      mockFs.readFile.mockResolvedValue(invalidUtf8.toString('binary'));
      
      const result = await hookManager.isInstalled();
      expect(typeof result).toBe('boolean');
    });

    it('should handle mixed encoding files', async () => {
      const configManager = new ConfigManager();
      
      // Mock mixed encoding content
      const mixedEncoding = 'Valid UTF-8: ñáéíóú\nInvalid: \xFF\xFE\xFD';
      mockFs.readJson.mockRejectedValue(new SyntaxError('Unexpected token'));
      
      await expect(configManager.import('/mixed/encoding.json'))
        .rejects.toThrow('Failed to import configuration');
    });

    it('should handle BOM (Byte Order Mark)', async () => {
      const hookManager = new HookManager();
      
      // Mock BOM at start of file
      const bomContent = '\uFEFF#!/bin/bash\n# Hook script';
      mockFs.readFile.mockResolvedValue(bomContent);
      
      const result = await hookManager.isInstalled();
      expect(typeof result).toBe('boolean');
    });

    it('should handle different line endings', async () => {
      const cacheManager = new CacheManager();
      
      // Mock different line endings
      const windowsLineEndings = 'line1\r\nline2\r\nline3\r\n';
      const unixLineEndings = 'line1\nline2\nline3\n';
      const oldMacLineEndings = 'line1\rline2\rline3\r';
      
      for (const content of [windowsLineEndings, unixLineEndings, oldMacLineEndings]) {
        mockFs.readJson.mockResolvedValue({
          messages: ['test'],
          timestamp: Date.now(),
          diff: content
        });
        
        const result = await cacheManager.getValidated('test diff');
        expect(result).toEqual(['test']);
      }
    });
  });

  describe('10. Temporary File Cleanup and Resource Management', () => {
    it('should handle temporary file cleanup failures', async () => {
      const cacheManager = new CacheManager();
      
      // Mock cleanup failure
      mockFs.remove.mockRejectedValue(new Error('EBUSY: resource busy'));
      
      // Should not throw during cleanup
      await expect(cacheManager.cleanup()).resolves.toBeDefined();
    });

    it('should handle resource leaks in cache operations', async () => {
      const cacheManager = new CacheManager();
      
      // Simulate many operations without cleanup
      const operations = Array.from({ length: 1000 }, (_, i) => 
        cacheManager.setValidated(`diff-${i}`, [`message-${i}`])
      );
      
      await expect(Promise.all(operations)).resolves.toBeUndefined();
      
      // Memory usage should be reasonable
      const memUsage = process.memoryUsage();
      expect(memUsage.heapUsed).toBeLessThan(1024 * 1024 * 1024); // Less than 1GB
    });

    it('should handle orphaned temporary files', async () => {
      const logger = new ActivityLogger();
      
      // Mock orphaned temp files
      const tempFiles = ['temp-1.log.tmp', 'temp-2.log.tmp', 'temp-3.log.tmp'];
      mockFs.readdir.mockResolvedValue(tempFiles);
      
      // Mock cleanup of orphaned files
      mockFs.remove.mockResolvedValue();
      
      await expect(logger.cleanOldLogs()).resolves.toBeUndefined();
    });

    it('should handle file descriptor exhaustion', async () => {
      const configManager = new ConfigManager();
      
      // Mock too many open files
      mockFs.writeJson.mockRejectedValue(new Error('EMFILE: too many open files'));
      
      await expect(configManager.export('/many/files/config.json'))
        .rejects.toThrow('Failed to export configuration');
    });

    it('should handle graceful shutdown during file operations', async () => {
      const cacheManager = new CacheManager();
      
      // Mock interruption during operation
      mockFs.writeJson.mockImplementation(() => {
        const error = new Error('EINTR: interrupted system call');
        error.code = 'EINTR';
        return Promise.reject(error);
      });
      
      // Should handle interruption gracefully
      await expect(cacheManager.setValidated('test diff', ['message']))
        .resolves.toBeUndefined();
    });
  });

  describe('Integration Tests - Multiple Failure Scenarios', () => {
    it('should handle cascading file system failures', async () => {
      const autoGit = new AutoGit();
      
      // Mock cascading failures
      mockGit.checkIsRepo.mockRejectedValue(new Error('EIO: input/output error'));
      mockFs.ensureDir.mockRejectedValue(new Error('ENOSPC: no space left on device'));
      mockFs.appendFile.mockRejectedValue(new Error('EACCES: permission denied'));
      
      await expect(autoGit.run()).rejects.toThrow();
    });

    it('should handle partial failure scenarios', async () => {
      const cacheManager = new CacheManager();
      
      // Mock partial failure - some operations work, others fail
      let callCount = 0;
      mockFs.readJson.mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          return Promise.reject(new Error('EIO: input/output error'));
        }
        return Promise.resolve({ messages: ['test'], timestamp: Date.now() });
      });
      
      // Should handle mixed success/failure gracefully
      const result1 = await cacheManager.getValidated('test1');
      const result2 = await cacheManager.getValidated('test2');
      
      expect(result1).toEqual(['test']);
      expect(result2).toBeNull();
    });

    it('should handle recovery after transient failures', async () => {
      const configManager = new ConfigManager();
      
      // Mock transient failure then recovery
      let callCount = 0;
      mockFs.writeJson.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('EBUSY: resource busy'));
        }
        return Promise.resolve();
      });
      
      // First call fails
      await expect(configManager.export('/busy/config.json'))
        .rejects.toThrow('Failed to export configuration');
      
      // Second call succeeds
      await expect(configManager.export('/busy/config.json'))
        .resolves.toBeUndefined();
    });
  });

  describe('Performance and Resource Limits', () => {
    it('should handle high-frequency file operations', async () => {
      const logger = new ActivityLogger();
      
      const startTime = Date.now();
      const operations = Array.from({ length: 1000 }, (_, i) => 
        logger.logActivity('info', `perf-test-${i}`, { 
          data: 'x'.repeat(100), 
          timestamp: Date.now(),
          index: i 
        })
      );
      
      await Promise.all(operations);
      const duration = Date.now() - startTime;
      
      // Should complete 1000 operations in reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle memory pressure during large operations', async () => {
      const cacheManager = new CacheManager();
      
      // Simulate memory pressure
      const originalMemoryUsage = process.memoryUsage;
      let memoryCallCount = 0;
      process.memoryUsage = jest.fn().mockImplementation(() => {
        memoryCallCount++;
        return {
          rss: 8 * 1024 * 1024 * 1024 + (memoryCallCount * 100 * 1024 * 1024), // Increasing memory
          heapUsed: 4 * 1024 * 1024 * 1024 + (memoryCallCount * 50 * 1024 * 1024),
          heapTotal: 6 * 1024 * 1024 * 1024,
          external: 500 * 1024 * 1024,
          arrayBuffers: 200 * 1024 * 1024
        };
      });
      
      try {
        const largeData = 'data'.repeat(1000000); // 4MB
        await cacheManager.setValidated('large-diff', [largeData]);
        
        // Should handle memory pressure gracefully
        expect(mockFs.writeJson).toHaveBeenCalled();
      } finally {
        process.memoryUsage = originalMemoryUsage;
      }
    });

    it('should handle CPU throttling scenarios', async () => {
      const gitManager = new GitManager();
      
      // Mock slow git operations (simulating CPU throttling)
      mockGit.diff.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve('slow diff result'), 2000) // 2 second delay
        )
      );
      
      const startTime = Date.now();
      const result = await gitManager.getStagedDiff();
      const duration = Date.now() - startTime;
      
      expect(result).toBe('slow diff result');
      expect(duration).toBeGreaterThan(1500);
    });
  });
});