/**
 * Comprehensive Tests for Cache Manager
 */

const CacheManager = require('../src/core/cache-manager');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

jest.mock('fs-extra');

describe('CacheManager', () => {
  let cacheManager;
  const mockCachePath = '/mock/cache/path';

  beforeEach(() => {
    jest.clearAllMocks();
    cacheManager = new CacheManager(mockCachePath);
  });

  describe('constructor', () => {
    test('should initialize with default cache path', () => {
      const defaultManager = new CacheManager();
      expect(defaultManager.cachePath).toContain('ai-commit-cache.json');
    });

    test('should initialize with custom cache path', () => {
      expect(cacheManager.cachePath).toBe(mockCachePath);
    });
  });

  describe('generateKey', () => {
    test('should generate consistent key for same input', () => {
      const input = 'test diff content';
      const key1 = cacheManager.generateKey(input);
      const key2 = cacheManager.generateKey(input);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hash
    });

    test('should generate different keys for different inputs', () => {
      const key1 = cacheManager.generateKey('input1');
      const key2 = cacheManager.generateKey('input2');

      expect(key1).not.toBe(key2);
    });
  });

  describe('loadCache', () => {
    test('should load existing cache successfully', async () => {
      const mockCache = {
        'key1': { messages: ['msg1'], timestamp: Date.now() },
        'key2': { messages: ['msg2'], timestamp: Date.now() }
      };
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue(mockCache);

      const result = await cacheManager.loadCache();

      expect(result).toEqual(mockCache);
      expect(fs.pathExists).toHaveBeenCalledWith(mockCachePath);
      expect(fs.readJson).toHaveBeenCalledWith(mockCachePath);
    });

    test('should return empty object when cache file does not exist', async () => {
      fs.pathExists.mockResolvedValue(false);

      const result = await cacheManager.loadCache();

      expect(result).toEqual({});
      expect(fs.readJson).not.toHaveBeenCalled();
    });

    test('should handle read errors gracefully', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockRejectedValue(new Error('Read error'));

      const result = await cacheManager.loadCache();

      expect(result).toEqual({});
    });
  });

  describe('saveCache', () => {
    test('should save cache successfully', async () => {
      const cache = { 'key1': { messages: ['msg1'] } };
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();

      await cacheManager.saveCache(cache);

      expect(fs.ensureDir).toHaveBeenCalledWith(path.dirname(mockCachePath));
      expect(fs.writeJson).toHaveBeenCalledWith(mockCachePath, cache, { spaces: 2 });
    });

    test('should handle save errors', async () => {
      const cache = { 'key1': { messages: ['msg1'] } };
      fs.ensureDir.mockRejectedValue(new Error('Save error'));

      await expect(cacheManager.saveCache(cache)).rejects.toThrow('Failed to save cache');
    });
  });

  describe('get', () => {
    test('should get cached messages successfully', async () => {
      const key = 'testkey';
      const mockCache = {
        [key]: { messages: ['msg1', 'msg2'], timestamp: Date.now() }
      };
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue(mockCache);

      const result = await cacheManager.get(key);

      expect(result).toEqual(['msg1', 'msg2']);
    });

    test('should return null for non-existent key', async () => {
      const mockCache = { 'otherkey': { messages: ['msg1'] } };
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue(mockCache);

      const result = await cacheManager.get('nonexistent');

      expect(result).toBeNull();
    });

    test('should return null for expired cache', async () => {
      const key = 'testkey';
      const expiredTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const mockCache = {
        [key]: { messages: ['msg1'], timestamp: expiredTimestamp }
      };
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue(mockCache);

      const result = await cacheManager.get(key);

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    test('should set cache successfully', async () => {
      const key = 'testkey';
      const messages = ['msg1', 'msg2'];
      const mockCache = {};
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue(mockCache);
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();

      await cacheManager.set(key, messages);

      const expectedCache = {
        [key]: {
          messages,
          timestamp: expect.any(Number)
        }
      };
      expect(fs.writeJson).toHaveBeenCalledWith(mockCachePath, expectedCache, { spaces: 2 });
    });

    test('should create new cache if none exists', async () => {
      const key = 'testkey';
      const messages = ['msg1'];
      fs.pathExists.mockResolvedValue(false);
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();

      await cacheManager.set(key, messages);

      const expectedCache = {
        [key]: {
          messages,
          timestamp: expect.any(Number)
        }
      };
      expect(fs.writeJson).toHaveBeenCalledWith(mockCachePath, expectedCache, { spaces: 2 });
    });
  });

  describe('getValidated', () => {
    test('should get validated cache messages', async () => {
      const diff = 'test diff';
      const key = cacheManager.generateKey(diff);
      const mockCache = {
        [key]: { messages: ['msg1', 'msg2'], timestamp: Date.now() }
      };
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue(mockCache);

      const result = await cacheManager.getValidated(diff);

      expect(result).toEqual(['msg1', 'msg2']);
    });

    test('should return empty array for non-existent cache', async () => {
      const diff = 'test diff';
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue({});

      const result = await cacheManager.getValidated(diff);

      expect(result).toEqual([]);
    });
  });

  describe('setValidated', () => {
    test('should set validated cache successfully', async () => {
      const diff = 'test diff';
      const messages = ['msg1', 'msg2'];
      const key = cacheManager.generateKey(diff);
      const mockCache = {};
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue(mockCache);
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();

      await cacheManager.setValidated(diff, messages);

      const expectedCache = {
        [key]: {
          messages,
          timestamp: expect.any(Number)
        }
      };
      expect(fs.writeJson).toHaveBeenCalledWith(mockCachePath, expectedCache, { spaces: 2 });
    });
  });

  describe('clear', () => {
    test('should clear cache successfully', async () => {
      fs.remove.mockResolvedValue();

      await cacheManager.clear();

      expect(fs.remove).toHaveBeenCalledWith(mockCachePath);
    });

    test('should handle clear errors', async () => {
      fs.remove.mockRejectedValue(new Error('Clear error'));

      await expect(cacheManager.clear()).rejects.toThrow('Failed to clear cache');
    });
  });

  describe('cleanup', () => {
    test('should remove expired entries', async () => {
      const validTimestamp = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
      const expiredTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const mockCache = {
        'valid1': { messages: ['msg1'], timestamp: validTimestamp },
        'expired1': { messages: ['msg2'], timestamp: expiredTimestamp },
        'valid2': { messages: ['msg3'], timestamp: validTimestamp }
      };
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue(mockCache);
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();

      await cacheManager.cleanup();

      const expectedCache = {
        'valid1': { messages: ['msg1'], timestamp: validTimestamp },
        'valid2': { messages: ['msg3'], timestamp: validTimestamp }
      };
      expect(fs.writeJson).toHaveBeenCalledWith(mockCachePath, expectedCache, { spaces: 2 });
    });

    test('should handle empty cache', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue({});
      fs.ensureDir.mockResolvedValue();
      fs.writeJson.mockResolvedValue();

      await cacheManager.cleanup();

      expect(fs.writeJson).toHaveBeenCalledWith(mockCachePath, {}, { spaces: 2 });
    });
  });

  describe('getStats', () => {
    test('should return cache statistics', async () => {
      const validTimestamp = Date.now() - (2 * 60 * 60 * 1000);
      const expiredTimestamp = Date.now() - (25 * 60 * 60 * 1000);
      const mockCache = {
        'valid1': { messages: ['msg1'], timestamp: validTimestamp },
        'expired1': { messages: ['msg2'], timestamp: expiredTimestamp },
        'valid2': { messages: ['msg3'], timestamp: validTimestamp }
      };
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue(mockCache);

      const stats = await cacheManager.getStats();

      expect(stats).toEqual({
        totalEntries: 3,
        validEntries: 2,
        expiredEntries: 1,
        cacheSize: expect.any(String)
      });
    });

    test('should handle empty cache stats', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readJson.mockResolvedValue({});

      const stats = await cacheManager.getStats();

      expect(stats).toEqual({
        totalEntries: 0,
        validEntries: 0,
        expiredEntries: 0,
        cacheSize: '0 B'
      });
    });
  });
});