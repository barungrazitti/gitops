/**
 * Unit tests for CacheManager
 */

jest.mock('fs-extra');
jest.mock('crypto', () => ({
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnValue({
      digest: jest.fn().mockReturnValue('abc123'),
    }),
  }),
}));

const fs = require('fs-extra');

describe('CacheManager', () => {
  let CacheManager;
  let cacheManager;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    fs.ensureDir.mockResolvedValue();
    fs.pathExists.mockResolvedValue(true);
    fs.readJson.mockResolvedValue({});
    fs.writeJson.mockResolvedValue();
    fs.readdir.mockResolvedValue([]);
    fs.remove.mockResolvedValue();

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
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
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
      const setSpy = jest.spyOn(cacheManager.memoryCache, 'set');
      await cacheManager.setValidated('test diff', ['feat: test']);
      expect(setSpy).toHaveBeenCalled();
      setSpy.mockRestore();
    });
  });

});
