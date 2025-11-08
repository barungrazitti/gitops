/**
 * Unit tests for Cache Manager - covering uncovered lines
 */

jest.mock('fs-extra');
jest.mock('crypto');

const CacheManager = require('../src/core/cache-manager');
const fs = require('fs-extra');
const crypto = require('crypto');

describe('CacheManager - Additional Coverage', () => {
  let cacheManager;
  let mockFs;
  let mockCrypto;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockFs = {
      ensureDir: jest.fn(),
      pathExists: jest.fn(),
      readJson: jest.fn(),
      writeJson: jest.fn(),
      remove: jest.fn(),
      readdir: jest.fn(),
      stat: jest.fn()
    };
    
    mockCrypto = {
      createHash: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('mock-hash')
      })
    };
    
    Object.assign(fs, mockFs);
    Object.assign(crypto, mockCrypto);

    cacheManager = new CacheManager();
    // Clear memory cache
    cacheManager.memoryCache.clear();
  });

  describe('getValidated', () => {
    it('should return cached messages with valid semantic similarity', async () => {
      const diff = 'test diff content';
      const cacheData = {
        messages: ['feat: add test feature'],
        diff: 'test diff content',
        timestamp: Date.now() - 1000
      };
      const cacheKey = 'test-key';

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(cacheData);
      cacheManager.memoryCache.set(cacheKey, cacheData);

      const result = await cacheManager.getValidated(diff);

      expect(result).toEqual(cacheData.messages);
    });

    it('should remove invalid cache entry from memory', async () => {
      const diff = 'test diff content';
      const cacheData = {
        messages: ['feat: add test feature'],
        diff: 'different diff content',
        timestamp: Date.now() - 1000
      };
      const cacheKey = 'test-key';

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(cacheData);
      cacheManager.memoryCache.set(cacheKey, cacheData);
      cacheManager.validateSemanticSimilarity = jest.fn().mockReturnValue(false);

      const result = await cacheManager.getValidated(diff);

      expect(result).toBeNull();
      expect(cacheManager.memoryCache.has(cacheKey)).toBe(false);
    });

    it('should try persistent cache when memory cache miss', async () => {
      const diff = 'test diff content';
      const cacheData = {
        messages: ['feat: add test feature'],
        diff: 'test diff content',
        timestamp: Date.now() - 1000
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(cacheData);

      const result = await cacheManager.getValidated(diff);

      expect(result).toEqual(cacheData.messages);
    });

    it('should handle expired cache', async () => {
      const diff = 'test diff content';
      const cacheData = {
        messages: ['feat: add test feature'],
        diff: 'test diff content',
        timestamp: Date.now() - (86400000 + 1000) // Over 24 hours
      };

      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockResolvedValue(cacheData);

      const result = await cacheManager.getValidated(diff);

      expect(result).toBeNull();
      expect(mockFs.remove).toHaveBeenCalled();
    });

    it('should handle cache errors gracefully', async () => {
      const diff = 'test diff content';
      
      mockFs.pathExists.mockRejectedValue(new Error('Cache read error'));

      const result = await cacheManager.getValidated(diff);

      expect(result).toBeNull();
    });
  });

  describe('setValidated', () => {
    it('should set cache with validation', async () => {
      const diff = 'test diff content';
      const messages = ['feat: add test feature'];

      mockFs.writeJson.mockResolvedValue();

      await cacheManager.setValidated(diff, messages);

      expect(mockFs.writeJson).toHaveBeenCalled();
      expect(cacheManager.memoryCache.size).toBeGreaterThan(0);
    });

    it('should handle cache set errors', async () => {
      const diff = 'test diff content';
      const messages = ['feat: add test feature'];

      mockFs.writeJson.mockRejectedValue(new Error('Cache write error'));

      await expect(cacheManager.setValidated(diff, messages)).resolves.toBeUndefined();
    });
  });

  describe('validateSemanticSimilarity', () => {
    it('should return true for identical fingerprints', () => {
      const fingerprint = 'test-fingerprint';

      const result = cacheManager.validateSemanticSimilarity(
        'test diff',
        'test diff'
      );

      expect(result).toBe(true);
    });

    it('should return false for different fingerprints', () => {
      const result = cacheManager.validateSemanticSimilarity(
        'test diff',
        'different diff'
      );

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', () => {
      // Mock extractSemanticFingerprint to throw error
      cacheManager.extractSemanticFingerprint = jest.fn().mockImplementation(() => {
        throw new Error('Extraction error');
      });

      const result = cacheManager.validateSemanticSimilarity('test diff', 'test diff');

      expect(result).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should clean expired cache files', async () => {
      const oldFile = 'old-cache.json';
      const recentFile = 'recent-cache.json';
      const fileList = [oldFile, recentFile];
      
      mockFs.readdir.mockResolvedValue(fileList);
      mockFs.stat
        .mockResolvedValueOnce({ mtime: new Date(Date.now() - 86400000 - 1000) }) // Old
        .mockResolvedValueOnce({ mtime: new Date(Date.now() - 1000) }); // Recent

      const cleaned = await cacheManager.cleanup();

      expect(cleaned).toBe(1);
      expect(mockFs.remove).toHaveBeenCalledWith(expect.stringContaining(oldFile));
      expect(mockFs.remove).not.toHaveBeenCalledWith(expect.stringContaining(recentFile));
    });

    it('should handle cleanup errors gracefully', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Directory read error'));

      const cleaned = await cacheManager.cleanup();

      expect(cleaned).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      const fileList = ['cache1.json', 'cache2.json', 'cache3.json'];
      
      mockFs.readdir.mockResolvedValue(fileList);
      cacheManager.memoryCache.set('key1', { messages: [] });
      cacheManager.memoryCache.set('key2', { messages: [] });

      const stats = await cacheManager.getStats();

      expect(stats.memoryCacheSize).toBe(2);
      expect(stats.diskCacheSize).toBe(3);
      expect(stats.cacheDir).toBeDefined();
    });

    it('should handle stats errors gracefully', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Stats error'));

      const stats = await cacheManager.getStats();

      expect(stats.memoryCacheSize).toBe(0);
      expect(stats.diskCacheSize).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty diff in validation', () => {
      const result = cacheManager.validateSemanticSimilarity('', '');

      expect(result).toBe(true);
    });

    it('should handle null/undefined inputs', () => {
      expect(() => cacheManager.validateSemanticSimilarity(null, null)).not.toThrow();
      expect(() => cacheManager.validateSemanticSimilarity(undefined, undefined)).not.toThrow();
    });

    it('should handle very long diffs', () => {
      const longDiff = 'x'.repeat(10000);
      
      expect(() => cacheManager.validateSemanticSimilarity(longDiff, longDiff)).not.toThrow();
    });

    it('should handle special characters in diffs', () => {
      const specialDiff = 'test with émojis 🎉 and spëcial chars';

      const result = cacheManager.validateSemanticSimilarity(specialDiff, specialDiff);

      expect(result).toBe(true);
    });

    it('should handle Unicode content', () => {
      const unicodeDiff = '测试内容 with 中文 characters';

      const result = cacheManager.validateSemanticSimilarity(unicodeDiff, unicodeDiff);

      expect(result).toBe(true);
    });

    it('should handle binary-like content', () => {
      const binaryDiff = '\x00\x01\x02binary content';

      const result = cacheManager.validateSemanticSimilarity(binaryDiff, binaryDiff);

      expect(result).toBe(true);
    });
  });

  describe('findSimilarKey', () => {
    it('should find similar cache key', async () => {
      const diff = 'test diff content';
      const similarDiff = 'test diff similar content';
      const fileList = ['cache1.json', 'cache2.json'];
      
      mockFs.readdir.mockResolvedValue(fileList);
      mockFs.readJson
        .mockResolvedValueOnce({ fingerprint: 'fingerprint1' })
        .mockResolvedValueOnce({ fingerprint: 'fingerprint2' });

      cacheManager.extractSemanticFingerprint = jest.fn()
        .mockReturnValueOnce('fingerprint1')
        .mockReturnValueOnce('fingerprint2');

      const result = await cacheManager.findSimilarKey(diff);

      expect(result).toBe('cache1');
    });

    it('should return null when no similar key found', async () => {
      const diff = 'test diff content';
      const fileList = ['cache1.json'];
      
      mockFs.readdir.mockResolvedValue(fileList);
      mockFs.readJson.mockResolvedValue({ fingerprint: 'different-fingerprint' });

      cacheManager.extractSemanticFingerprint = jest.fn().mockReturnValue('fingerprint1');

      const result = await cacheManager.findSimilarKey(diff);

      expect(result).toBeNull();
    });
  });

  describe('findSimilar', () => {
    it('should find similar cached messages', async () => {
      const diff = 'test diff content';
      const cacheData = {
        messages: ['feat: add test feature'],
        fingerprint: 'fingerprint1'
      };
      
      mockFs.readdir.mockResolvedValue(['cache1.json']);
      mockFs.readJson.mockResolvedValue(cacheData);

      cacheManager.extractSemanticFingerprint = jest.fn().mockReturnValue('fingerprint1');

      const result = await cacheManager.findSimilar(diff);

      expect(result).toEqual(cacheData.messages);
    });

    it('should return null when no similar messages found', async () => {
      const diff = 'test diff content';
      
      mockFs.readdir.mockResolvedValue(['cache1.json']);
      mockFs.readJson.mockResolvedValue({ fingerprint: 'different-fingerprint' });

      cacheManager.extractSemanticFingerprint = jest.fn().mockReturnValue('fingerprint1');

      const result = await cacheManager.findSimilar(diff);

      expect(result).toBeNull();
    });
  });

  describe('advanced fingerprint extraction', () => {
    it('should extract semantic fingerprint from complex diff', () => {
      const complexDiff = `diff --git a/src/api/user.js b/src/api/user.js
+ function createUser(userData) {
+   return db.users.create(userData);
+ }
- function createUser(name, email) {
-   return { name, email };
- }`;

      const fingerprint = cacheManager.extractSemanticFingerprint(complexDiff);

      expect(fingerprint).toBeDefined();
      expect(typeof fingerprint).toBe('string');
    });

    it('should filter out comments and context', () => {
      const diffWithComments = `+ // This is a comment
+ function test() {
+   /* Multi-line comment */
+   return true;
+ }`;

      const fingerprint = cacheManager.extractSemanticFingerprint(diffWithComments);

      expect(fingerprint).not.toContain('This is a comment');
      expect(fingerprint).not.toContain('Multi-line comment');
    });

    it('should extract structural fingerprint from file paths', () => {
      const fileDiff = `diff --git a/src/components/Button.jsx b/src/components/Button.jsx
diff --git a/src/utils/format.js b/src/utils/format.js`;

      const fingerprint = cacheManager.extractStructuralFingerprint(fileDiff);

      expect(fingerprint).toContain('Button.jsx');
      expect(fingerprint).toContain('format.js');
    });
  });

  describe('code change extraction', () => {
    it('should extract code changes from diff', () => {
      const codeDiff = `+ function newUser(name) {
+   return { name, created: new Date() };
+ }
- function createUser(name) {
-   return { name };
- }`;

      const changes = cacheManager.extractCodeChanges(codeDiff);

      expect(changes).toContain('function newUser(name)');
      expect(changes).toContain('return { name, created: new Date() }');
    });

    it('should filter out comments and short lines', () => {
      const diffWithComments = `+ // Add new feature
+ function test() {
+ }
- // Remove old feature`;

      const changes = cacheManager.extractCodeChanges(diffWithComments);

      expect(changes).not.toContain('Add new feature');
      expect(changes).not.toContain('Remove old feature');
      expect(changes).toContain('function test()');
    });

    it('should handle empty diff', () => {
      const changes = cacheManager.extractCodeChanges('');

      expect(changes).toBe('');
    });
  });

  describe('error handling', () => {
    it('should handle file system permission errors', async () => {
      mockFs.pathExists.mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(cacheManager.getUltraFast('test diff')).resolves.toBeNull();
    });

    it('should handle corrupted cache files', async () => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readJson.mockRejectedValue(new Error('Invalid JSON'));

      const result = await cacheManager.getUltraFast('test diff');

      expect(result).toBeNull();
    });

    it('should handle disk space issues', async () => {
      mockFs.writeJson.mockRejectedValue(new Error('ENOSPC: no space left on device'));

      await expect(cacheManager.setValidated('test diff', ['test message'])).resolves.toBeUndefined();
    });
  });

  describe('performance optimizations', () => {
    it('should use memory cache for repeated requests', async () => {
      const diff = 'test diff content';
      const messages = ['feat: add test feature'];

      // First call - should hit disk
      mockFs.pathExists.mockResolvedValueOnce(false);
      await cacheManager.setValidated(diff, messages);

      // Reset mocks
      jest.clearAllMocks();

      // Second call - should hit memory
      mockFs.pathExists.mockResolvedValueOnce(false);
      const result = await cacheManager.getValidated(diff);

      expect(result).toEqual(messages);
      expect(mockFs.readJson).not.toHaveBeenCalled();
    });

    it('should limit memory cache size', async () => {
      const messages = ['feat: add test feature'];
      
      // Add many entries to exceed memory limit
      for (let i = 0; i < 150; i++) {
        await cacheManager.setValidated(`diff ${i}`, messages);
      }

      expect(cacheManager.memoryCache.size).toBeLessThanOrEqual(100);
    });
  });
});