/**
 * Unit tests for CacheManager
 */

jest.mock('node-cache');
jest.mock('fs-extra');
jest.mock('crypto');

const NodeCache = require('node-cache');
const fs = require('fs-extra');
const crypto = require('crypto');

describe('CacheManager', () => {
  let CacheManager;
  let cacheManager;
  let mockNodeCache;
  let mockFs;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    
    mockNodeCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      flushAll: jest.fn(),
    };
    
    NodeCache.mockImplementation(() => mockNodeCache);
    
    mockFs = {
      ensureDir: jest.fn().mockResolvedValue(),
      pathExists: jest.fn().mockResolvedValue(false),
      readJson: jest.fn().mockResolvedValue({}),
      writeJson: jest.fn().mockResolvedValue(),
      remove: jest.fn().mockResolvedValue(),
    };
    
    fs.ensureDir.mockResolvedValue();
    fs.pathExists.mockResolvedValue(false);
    fs.readJson.mockResolvedValue({});
    fs.writeJson.mockResolvedValue();
    
    crypto.createHash = jest.fn().mockReturnValue({
      update: jest.fn().mockReturnValue({
        digest: jest.fn().mockReturnValue('abc123')
      })
    });
    
    CacheManager = require('../src/core/cache-manager');
    cacheManager = new CacheManager();
  });

  describe('constructor', () => {
    it('should initialize memory cache', () => {
      expect(cacheManager.memoryCache).toBeDefined();
    });

    it('should set cache directory', () => {
      expect(cacheManager.cacheDir).toContain('.ai-commit-generator');
    });
  });

  describe('generateKey', () => {
    it('should generate hash key', () => {
      const diff = 'test diff';
      const key = cacheManager.generateKey(diff);
      expect(key).toBe('abc123');
    });
  });

  describe('extractSemanticFingerprint', () => {
    it('should extract semantic lines', () => {
      const diff = 'diff --git a/test.js b/test.js\n+ const x = 1;';
      const fingerprint = cacheManager.extractSemanticFingerprint(diff);
      expect(fingerprint).toBeDefined();
    });
  });

  describe('extractStructuralFingerprint', () => {
    it('should extract file names', () => {
      const diff = 'diff --git a/src/index.js b/src/index.js\n+ const x = 1;';
      const fingerprint = cacheManager.extractStructuralFingerprint(diff);
      expect(fingerprint).toBeDefined();
    });
  });

  describe('getValidated', () => {
    it('should return null when not cached', async () => {
      const result = await cacheManager.getValidated('test diff');
      expect(result).toBeNull();
    });
  });

  describe('setValidated', () => {
    it('should cache messages', async () => {
      await cacheManager.setValidated('test diff', ['feat: test']);
      expect(mockNodeCache.set).toHaveBeenCalled();
    });
  });

  describe('invalidate', () => {
    it('should delete from cache', async () => {
      await cacheManager.invalidate('test diff');
      expect(mockNodeCache.del).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('should clear all caches', async () => {
      await cacheManager.clear();
      expect(mockNodeCache.flushAll).toHaveBeenCalled();
    });
  });

  describe('validateSemanticSimilarity', () => {
    it('should return true for identical diffs', () => {
      const diff1 = 'diff --git a/test.js b/test.js\n+ const x = 1;';
      const diff2 = 'diff --git a/test.js b/test.js\n+ const x = 1;';
      const result = cacheManager.validateSemanticSimilarity(diff1, diff2);
      expect(result).toBe(true);
    });
  });
});
