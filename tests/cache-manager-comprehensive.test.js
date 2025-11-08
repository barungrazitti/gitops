/**
 * Unit tests for Cache Manager - Comprehensive Coverage
 */

const CacheManager = require('../src/core/cache-manager');
const fs = require('fs-extra');

describe('CacheManager - Comprehensive Coverage', () => {
  let cacheManager;
  let mockFs;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockFs = {
      pathExists: jest.fn(),
      writeFile: jest.fn(),
      readFile: jest.fn(),
      remove: jest.fn(),
      ensureDir: jest.fn(),
      stat: jest.fn(),
      mkdir: jest.fn(),
      readdir: jest.fn()
    };

    jest.spyOn(require('fs-extra'), 'pathExists').mockImplementation(mockFs.pathExists);
    jest.spyOn(require('fs-extra'), 'writeFile').mockImplementation(mockFs.writeFile);
    jest.spyOn(require('fs-extra'), 'readFile').mockImplementation(mockFs.readFile);
    jest.spyOn(require('fs-extra'), 'remove').mockImplementation(mockFs.remove);
    jest.spyOn(require('fs-extra'), 'ensureDir').mockImplementation(mockFs.ensureDir);
    jest.spyOn(require('fs-extra'), 'stat').mockImplementation(mockFs.stat);
    jest.spyOn(require('fs-extra'), 'mkdir').mockImplementation(mockFs.mkdir);
    jest.spyOn(require('fs-extra'), 'readdir').mockImplementation(mockFs.readdir);

    cacheManager = new CacheManager();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const manager = new CacheManager();

      expect(manager.cache).toEqual({});
      expect(manager.options.maxSize).toBe(100);
      expect(manager.options.ttl).toBe(3600000); // 1 hour
      expect(manager.options.directory).toBeDefined();
    });

    it('should initialize with custom options', () => {
      const customOptions = {
        maxSize: 50,
        ttl: 1800000, // 30 minutes
        directory: '/custom/cache'
      };

      const manager = new CacheManager(customOptions);

      expect(manager.options.maxSize).toBe(50);
      expect(manager.options.ttl).toBe(1800000);
      expect(manager.options.directory).toBe('/custom/cache');
    });

    it('should ensure cache directory exists', () => {
      mockFs.pathExists.mockResolvedValue(false);

      new CacheManager({ directory: '/test/cache' });

      expect(mockFs.ensureDir).toHaveBeenCalledWith('/test/cache');
    });
  });

  describe('set', () => {
    it('should set cache value', () => {
      cacheManager.set('test-key', 'test-value');

      const cached = cacheManager.get('test-key');
      expect(cached).toBe('test-value');
    });

    it('should set cache value with TTL', () => {
      cacheManager.set('test-key', 'test-value', 60000); // 1 minute

      const cached = cacheManager.get('test-key');
      expect(cached).toBe('test-value');
    });

    it('should handle object cache values', () => {
      const testObject = { name: 'test', data: [1, 2, 3] };
      
      cacheManager.set('object-key', testObject);
      
      const cached = cacheManager.get('object-key');
      expect(cached).toEqual(testObject);
    });

    it('should handle array cache values', () => {
      const testArray = ['item1', 'item2', 'item3'];
      
      cacheManager.set('array-key', testArray);
      
      const cached = cacheManager.get('array-key');
      expect(cached).toEqual(testArray);
    });

    it('should handle null cache values', () => {
      cacheManager.set('null-key', null);
      
      const cached = cacheManager.get('null-key');
      expect(cached).toBeNull();
    });

    it('should handle undefined cache values', () => {
      cacheManager.set('undefined-key', undefined);
      
      const cached = cacheManager.get('undefined-key');
      expect(cached).toBeUndefined();
    });

    it('should overwrite existing cache values', () => {
      cacheManager.set('test-key', 'value1');
      cacheManager.set('test-key', 'value2');
      
      const cached = cacheManager.get('test-key');
      expect(cached).toBe('value2');
    });

    it('should enforce maximum cache size', () => {
      const smallCacheManager = new CacheManager({ maxSize: 2 });

      smallCacheManager.set('key1', 'value1');
      smallCacheManager.set('key2', 'value2');
      smallCacheManager.set('key3', 'value3'); // Should remove oldest

      expect(smallCacheManager.get('key1')).toBeUndefined();
      expect(smallCacheManager.get('key2')).toBe('value2');
      expect(smallCacheManager.get('key3')).toBe('value3');
    });

    it('should use LRU eviction strategy', () => {
      const smallCacheManager = new CacheManager({ maxSize: 2 });

      smallCacheManager.set('key1', 'value1');
      smallCacheManager.set('key2', 'value2');
      smallCacheManager.get('key1'); // Access key1, making it most recent
      smallCacheManager.set('key3', 'value3'); // Should remove key2

      expect(smallCacheManager.get('key2')).toBeUndefined();
      expect(smallCacheManager.get('key1')).toBe('value1');
      expect(smallCacheManager.get('key3')).toBe('value3');
    });

    it('should handle very long cache keys', () => {
      const longKey = 'k'.repeat(1000);
      
      cacheManager.set(longKey, 'long-key-value');
      
      const cached = cacheManager.get(longKey);
      expect(cached).toBe('long-key-value');
    });

    it('should handle cache keys with special characters', () => {
      const specialKey = 'test@#$%^&*()_+-={}[]|\\:";\'<>?,./';
      
      cacheManager.set(specialKey, 'special-key-value');
      
      const cached = cacheManager.get(specialKey);
      expect(cached).toBe('special-key-value');
    });

    it('should handle Unicode cache keys', () => {
      const unicodeKey = '测试键_русский_العربية';
      
      cacheManager.set(unicodeKey, 'unicode-key-value');
      
      const cached = cacheManager.get(unicodeKey);
      expect(cached).toBe('unicode-key-value');
    });
  });

  describe('get', () => {
    beforeEach(() => {
      cacheManager.set('existing-key', 'existing-value');
      cacheManager.set('expired-key', 'expired-value', -1000); // Already expired
    });

    it('should return cached value', () => {
      const cached = cacheManager.get('existing-key');
      expect(cached).toBe('existing-value');
    });

    it('should return undefined for non-existent key', () => {
      const cached = cacheManager.get('non-existent-key');
      expect(cached).toBeUndefined();
    });

    it('should return undefined for expired cache', () => {
      const cached = cacheManager.get('expired-key');
      expect(cached).toBeUndefined();
    });

    it('should remove expired cache entries', () => {
      cacheManager.get('expired-key');
      
      const cached = cacheManager.get('expired-key');
      expect(cached).toBeUndefined();
    });

    it('should update access time on cache hit', () => {
      cacheManager.get('existing-key');
      
      const accessTime = cacheManager.cache['existing-key']?.accessTime;
      expect(accessTime).toBeDefined();
      expect(accessTime).toBeGreaterThan(Date.now() - 1000);
    });

    it('should handle circular reference cache values', () => {
      const circular = {};
      circular.self = circular;
      
      cacheManager.set('circular-key', circular);
      
      const cached = cacheManager.get('circular-key');
      expect(cached).toBe(circular);
    });

    it('should handle very large cache values', () => {
      const largeValue = 'x'.repeat(100000);
      
      cacheManager.set('large-key', largeValue);
      
      const cached = cacheManager.get('large-key');
      expect(cached).toBe(largeValue);
    });

    it('should handle binary cache values', () => {
      const binaryValue = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
      
      cacheManager.set('binary-key', binaryValue);
      
      const cached = cacheManager.get('binary-key');
      expect(Buffer.isBuffer(cached)).toBe(true);
      expect(cached.toString()).toBe('Hello');
    });
  });

  describe('has', () => {
    beforeEach(() => {
      cacheManager.set('existing-key', 'existing-value');
      cacheManager.set('expired-key', 'expired-value', -1000);
    });

    it('should return true for existing cache', () => {
      const exists = cacheManager.has('existing-key');
      expect(exists).toBe(true);
    });

    it('should return false for non-existent cache', () => {
      const exists = cacheManager.has('non-existent-key');
      expect(exists).toBe(false);
    });

    it('should return false for expired cache', () => {
      const exists = cacheManager.has('expired-key');
      expect(exists).toBe(false);
    });

    it('should not update access time when checking existence', () => {
      const initialAccessTime = cacheManager.cache['existing-key']?.accessTime;
      
      cacheManager.has('existing-key');
      
      const finalAccessTime = cacheManager.cache['existing-key']?.accessTime;
      expect(finalAccessTime).toBe(initialAccessTime);
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      cacheManager.set('existing-key', 'existing-value');
      cacheManager.set('another-key', 'another-value');
    });

    it('should delete existing cache', () => {
      cacheManager.delete('existing-key');
      
      expect(cacheManager.has('existing-key')).toBe(false);
      expect(cacheManager.get('existing-key')).toBeUndefined();
    });

    it('should handle deleting non-existent cache', () => {
      cacheManager.delete('non-existent-key');
      
      expect(cacheManager.has('existing-key')).toBe(true); // Should not affect other entries
    });

    it('should return true when cache existed and was deleted', () => {
      const deleted = cacheManager.delete('existing-key');
      expect(deleted).toBe(true);
    });

    it('should return false when cache did not exist', () => {
      const deleted = cacheManager.delete('non-existent-key');
      expect(deleted).toBe(false);
    });

    it('should handle deleting all cache entries', () => {
      cacheManager.delete('existing-key');
      cacheManager.delete('another-key');
      
      expect(cacheManager.size()).toBe(0);
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      cacheManager.set('key1', 'value1');
      cacheManager.set('key2', 'value2');
      cacheManager.set('key3', 'value3');
    });

    it('should clear all cache entries', () => {
      cacheManager.clear();
      
      expect(cacheManager.size()).toBe(0);
      expect(cacheManager.get('key1')).toBeUndefined();
      expect(cacheManager.get('key2')).toBeUndefined();
      expect(cacheManager.get('key3')).toBeUndefined();
    });

    it('should handle clearing empty cache', () => {
      cacheManager.clear();
      cacheManager.clear(); // Should not error
      
      expect(cacheManager.size()).toBe(0);
    });

    it('should reset cache metadata', () => {
      cacheManager.clear();
      
      expect(cacheManager.cache).toEqual({});
    });
  });

  describe('size', () => {
    it('should return zero for empty cache', () => {
      const size = cacheManager.size();
      expect(size).toBe(0);
    });

    it('should return correct size for populated cache', () => {
      cacheManager.set('key1', 'value1');
      cacheManager.set('key2', 'value2');
      cacheManager.set('key3', 'value3');
      
      const size = cacheManager.size();
      expect(size).toBe(3);
    });

    it('should not count expired entries', () => {
      cacheManager.set('key1', 'value1');
      cacheManager.set('expired-key', 'expired-value', -1000);
      
      cacheManager.get('expired-key'); // Remove expired entry
      
      const size = cacheManager.size();
      expect(size).toBe(1);
    });
  });

  describe('keys', () => {
    beforeEach(() => {
      cacheManager.set('key1', 'value1');
      cacheManager.set('key2', 'value2');
      cacheManager.set('expired-key', 'expired-value', -1000);
    });

    it('should return all cache keys', () => {
      const keys = cacheManager.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('expired-key');
    });

    it('should not include expired keys after access', () => {
      cacheManager.get('expired-key'); // Remove expired entry
      
      const keys = cacheManager.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).not.toContain('expired-key');
    });

    it('should return keys in insertion order', () => {
      const testManager = new CacheManager();
      
      testManager.set('a', 'value1');
      testManager.set('b', 'value2');
      testManager.set('c', 'value3');
      
      const keys = testManager.keys();
      expect(keys).toEqual(['a', 'b', 'c']);
    });
  });

  describe('ttl', () => {
    it('should respect custom TTL on get', (done) => {
      cacheManager.set('ttl-key', 'ttl-value', 100); // 100ms
      
      expect(cacheManager.get('ttl-key')).toBe('ttl-value');
      
      setTimeout(() => {
        const cached = cacheManager.get('ttl-key');
        expect(cached).toBeUndefined();
        done();
      }, 150);
    });

    it('should use default TTL when not specified', (done) => {
      const defaultTTLManager = new CacheManager({ ttl: 100 }); // 100ms
      
      defaultTTLManager.set('default-ttl-key', 'default-ttl-value');
      
      expect(defaultTTLManager.get('default-ttl-key')).toBe('default-ttl-value');
      
      setTimeout(() => {
        const cached = defaultTTLManager.get('default-ttl-key');
        expect(cached).toBeUndefined();
        done();
      }, 150);
    });

    it('should handle zero TTL (no expiration)', (done) => {
      cacheManager.set('no-expire-key', 'no-expire-value', 0);
      
      expect(cacheManager.get('no-expire-key')).toBe('no-expire-value');
      
      setTimeout(() => {
        const cached = cacheManager.get('no-expire-key');
        expect(cached).toBe('no-expire-value');
        done();
      }, 100);
    });

    it('should handle negative TTL (already expired)', () => {
      cacheManager.set('negative-ttl-key', 'negative-ttl-value', -1000);
      
      const cached = cacheManager.get('negative-ttl-key');
      expect(cached).toBeUndefined();
    });
  });

  describe('persist', () => {
    beforeEach(() => {
      mockFs.ensureDir.mockResolvedValue();
      mockFs.writeFile.mockResolvedValue();
      mockFs.pathExists.mockResolvedValue(false);
    });

    it('should persist cache to file', async () => {
      cacheManager.set('persist-key1', 'persist-value1');
      cacheManager.set('persist-key2', 'persist-value2');
      
      const result = await cacheManager.persist();
      
      expect(result.success).toBe(true);
      expect(mockFs.writeFile).toHaveBeenCalled();
      expect(mockFs.ensureDir).toHaveBeenCalled();
    });

    it('should create cache directory if it does not exist', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      
      await cacheManager.persist();
      
      expect(mockFs.ensureDir).toHaveBeenCalled();
    });

    it('should serialize cache correctly', async () => {
      const testObject = { name: 'test', data: [1, 2, 3] };
      cacheManager.set('object-key', testObject);
      
      await cacheManager.persist();
      
      const writeCall = mockFs.writeFile.mock.calls[0];
      const serializedData = JSON.parse(writeCall[1]);
      
      expect(serializedData['object-key'].value).toEqual(testObject);
      expect(serializedData['object-key'].accessTime).toBeDefined();
      expect(serializedData['object-key'].ttl).toBeDefined();
    });

    it('should handle persistence errors gracefully', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));
      
      const result = await cacheManager.persist();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle empty cache persistence', async () => {
      const result = await cacheManager.persist();
      
      expect(result.success).toBe(true);
      const writeCall = mockFs.writeFile.mock.calls[0];
      const serializedData = JSON.parse(writeCall[1]);
      expect(serializedData).toEqual({});
    });
  });

  describe('load', () => {
    beforeEach(() => {
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 100
      });
    });

    it('should load cache from file', async () => {
      const cacheData = {
        'load-key1': {
          value: 'load-value1',
          accessTime: Date.now() - 1000,
          ttl: Date.now() + 3600000
        },
        'load-key2': {
          value: 'load-value2',
          accessTime: Date.now() - 1000,
          ttl: Date.now() + 3600000
        }
      };
      
      mockFs.readFile.mockResolvedValue(JSON.stringify(cacheData));
      
      const result = await cacheManager.load();
      
      expect(result.success).toBe(true);
      expect(result.loaded).toBe(2);
      expect(cacheManager.get('load-key1')).toBe('load-value1');
      expect(cacheManager.get('load-key2')).toBe('load-value2');
    });

    it('should skip expired cache entries', async () => {
      const cacheData = {
        'valid-key': {
          value: 'valid-value',
          accessTime: Date.now() - 1000,
          ttl: Date.now() + 3600000
        },
        'expired-key': {
          value: 'expired-value',
          accessTime: Date.now() - 1000,
          ttl: Date.now() - 1000 // Expired
        }
      };
      
      mockFs.readFile.mockResolvedValue(JSON.stringify(cacheData));
      
      const result = await cacheManager.load();
      
      expect(result.success).toBe(true);
      expect(result.loaded).toBe(1);
      expect(cacheManager.get('valid-key')).toBe('valid-value');
      expect(cacheManager.get('expired-key')).toBeUndefined();
    });

    it('should handle missing cache file', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      
      const result = await cacheManager.load();
      
      expect(result.success).toBe(true);
      expect(result.loaded).toBe(0);
    });

    it('should handle corrupted cache file', async () => {
      mockFs.readFile.mockResolvedValue('invalid json {');
      
      const result = await cacheManager.load();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle read errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Read failed'));
      
      const result = await cacheManager.load();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle empty cache file', async () => {
      mockFs.readFile.mockResolvedValue('{}');
      
      const result = await cacheManager.load();
      
      expect(result.success).toBe(true);
      expect(result.loaded).toBe(0);
      expect(cacheManager.size()).toBe(0);
    });

    it('should merge with existing cache', async () => {
      cacheManager.set('existing-key', 'existing-value');
      
      const cacheData = {
        'new-key': {
          value: 'new-value',
          accessTime: Date.now() - 1000,
          ttl: Date.now() + 3600000
        }
      };
      
      mockFs.readFile.mockResolvedValue(JSON.stringify(cacheData));
      
      const result = await cacheManager.load();
      
      expect(result.success).toBe(true);
      expect(cacheManager.get('existing-key')).toBe('existing-value');
      expect(cacheManager.get('new-key')).toBe('new-value');
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', async () => {
      cacheManager.set('valid-key1', 'valid-value1', 3600000);
      cacheManager.set('valid-key2', 'valid-value2', 3600000);
      cacheManager.set('expired-key1', 'expired-value1', -1000);
      cacheManager.set('expired-key2', 'expired-value2', -1000);
      
      const result = await cacheManager.cleanup();
      
      expect(result.removed).toBe(2);
      expect(cacheManager.get('valid-key1')).toBe('valid-value1');
      expect(cacheManager.get('valid-key2')).toBe('valid-value2');
      expect(cacheManager.get('expired-key1')).toBeUndefined();
      expect(cacheManager.get('expired-key2')).toBeUndefined();
    });

    it('should return zero when no expired entries', async () => {
      cacheManager.set('valid-key1', 'valid-value1', 3600000);
      cacheManager.set('valid-key2', 'valid-value2', 3600000);
      
      const result = await cacheManager.cleanup();
      
      expect(result.removed).toBe(0);
      expect(cacheManager.size()).toBe(2);
    });

    it('should handle empty cache cleanup', async () => {
      const result = await cacheManager.cleanup();
      
      expect(result.removed).toBe(0);
      expect(result.success).toBe(true);
    });
  });

  describe('statistics', () => {
    it('should return cache statistics', () => {
      cacheManager.set('stat-key1', 'stat-value1');
      cacheManager.set('stat-key2', 'stat-value2');
      
      const stats = cacheManager.getStats();
      
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(100);
      expect(stats.hits).toBeDefined();
      expect(stats.misses).toBeDefined();
      expect(stats.hitRate).toBeDefined();
    });

    it('should calculate hit rate correctly', () => {
      cacheManager.set('key1', 'value1');
      cacheManager.set('key2', 'value2');
      
      // Generate some hits and misses
      cacheManager.get('key1'); // hit
      cacheManager.get('key2'); // hit
      cacheManager.get('non-existent1'); // miss
      cacheManager.get('non-existent2'); // miss
      
      const stats = cacheManager.getStats();
      
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should handle zero hit rate calculation', () => {
      cacheManager.get('non-existent'); // miss
      
      const stats = cacheManager.getStats();
      
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0);
    });

    it('should handle perfect hit rate calculation', () => {
      cacheManager.set('key', 'value');
      cacheManager.get('key'); // hit
      
      const stats = cacheManager.getStats();
      
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(1);
    });
  });

  describe('integration scenarios', () => {
    it('should handle set-get-delete cycle', () => {
      const testKey = 'integration-key';
      const testValue = 'integration-value';
      
      cacheManager.set(testKey, testValue);
      expect(cacheManager.get(testKey)).toBe(testValue);
      
      cacheManager.delete(testKey);
      expect(cacheManager.get(testKey)).toBeUndefined();
    });

    it('should handle TTL expiration cycle', (done) => {
      const testKey = 'ttl-integration-key';
      const testValue = 'ttl-integration-value';
      
      cacheManager.set(testKey, testValue, 50); // 50ms
      
      expect(cacheManager.get(testKey)).toBe(testValue);
      expect(cacheManager.has(testKey)).toBe(true);
      
      setTimeout(() => {
        expect(cacheManager.get(testKey)).toBeUndefined();
        expect(cacheManager.has(testKey)).toBe(false);
        done();
      }, 100);
    });

    it('should handle max size enforcement cycle', () => {
      const smallCache = new CacheManager({ maxSize: 2 });
      
      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      expect(smallCache.size()).toBe(2);
      
      smallCache.set('key3', 'value3'); // Should remove key1
      expect(smallCache.get('key1')).toBeUndefined();
      expect(smallCache.get('key2')).toBe('value2');
      expect(smallCache.get('key3')).toBe('value3');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle very long cache values', () => {
      const longValue = 'x'.repeat(100000);
      
      cacheManager.set('long-value-key', longValue);
      
      const cached = cacheManager.get('long-value-key');
      expect(cached).toBe(longValue);
    });

    it('should handle deep object cache values', () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep value'
              }
            }
          }
        }
      };
      
      cacheManager.set('deep-object-key', deepObject);
      
      const cached = cacheManager.get('deep-object-key');
      expect(cached).toEqual(deepObject);
    });

    it('should handle cache values with special characters', () => {
      const specialValue = 'Special chars: !@#$%^&*()_+-={}[]|\\:";\'<>?,./\n\t';
      
      cacheManager.set('special-value-key', specialValue);
      
      const cached = cacheManager.get('special-value-key');
      expect(cached).toBe(specialValue);
    });

    it('should handle Unicode cache values', () => {
      const unicodeValue = 'Unicode: 测试 русский العربية 🎉';
      
      cacheManager.set('unicode-value-key', unicodeValue);
      
      const cached = cacheManager.get('unicode-value-key');
      expect(cached).toBe(unicodeValue);
    });

    it('should handle concurrent operations safely', async () => {
      const promises = [];
      
      // Concurrent set operations
      for (let i = 0; i < 10; i++) {
        promises.push(Promise.resolve(cacheManager.set(`key${i}`, `value${i}`)));
      }
      
      await Promise.all(promises);
      
      // Verify all values were set
      for (let i = 0; i < 10; i++) {
        expect(cacheManager.get(`key${i}`)).toBe(`value${i}`);
      }
    });

    it('should handle cache corruption gracefully', () => {
      // Simulate corrupted cache structure
      cacheManager.cache = null;
      
      expect(() => cacheManager.get('test-key')).not.toThrow();
      expect(() => cacheManager.set('test-key', 'value')).not.toThrow();
    });
  });

  describe('performance and optimization', () => {
    it('should handle large number of cache entries efficiently', () => {
      const start = Date.now();
      
      // Add 1000 entries
      for (let i = 0; i < 1000; i++) {
        cacheManager.set(`perf-key${i}`, `perf-value${i}`);
      }
      
      const insertTime = Date.now() - start;
      
      // Test retrieval performance
      const retrieveStart = Date.now();
      for (let i = 0; i < 1000; i++) {
        cacheManager.get(`perf-key${i}`);
      }
      const retrieveTime = Date.now() - retrieveStart;
      
      expect(cacheManager.size()).toBe(1000);
      expect(insertTime).toBeLessThan(1000); // Should insert quickly
      expect(retrieveTime).toBeLessThan(500); // Should retrieve quickly
    });

    it('should maintain O(1) performance for cache operations', () => {
      // Add many entries to test scalability
      for (let i = 0; i < 10000; i++) {
        cacheManager.set(`scale-key${i}`, `scale-value${i}`);
      }
      
      const start = Date.now();
      cacheManager.get('scale-key9999');
      const time = Date.now() - start;
      
      // Should maintain constant time regardless of cache size
      expect(time).toBeLessThan(10);
    });

    it('should handle memory efficiency', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Add and remove entries to test memory management
      for (let i = 0; i < 1000; i++) {
        cacheManager.set(`memory-key${i}`, `x`.repeat(100));
      }
      
      for (let i = 0; i < 1000; i++) {
        cacheManager.delete(`memory-key${i}`);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    });
  });
});