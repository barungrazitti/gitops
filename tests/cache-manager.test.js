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

  describe('persistence (real fs, temp dir)', () => {
    const os = require('os');
    const path = require('path');
    const realFs = require('fs');

    let CacheManagerReal;
    let cm;
    let tempDir;

    beforeEach(() => {
      // Bypass the file-level fs-extra/crypto mocks for these tests
      jest.unmock('fs-extra');
      jest.unmock('crypto');
      jest.resetModules();

      CacheManagerReal = require('../src/core/cache-manager');
      cm = new CacheManagerReal();
      tempDir = realFs.mkdtempSync(path.join(realFs.realpathSync(os.tmpdir()), 'aic-cache-'));
      cm.cacheDir = tempDir;
    });

    afterEach(() => {
      realFs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('round-trips messages through the disk cache with a fresh instance', async () => {
      const diff = 'diff --git a/x.js b/x.js\n--- a/x.js\n+++ b/x.js\n+const a = 1;';
      await cm.setValidated(diff, ['feat: x']);

      const fresh = new CacheManagerReal();
      fresh.cacheDir = tempDir;

      const result = await fresh.getValidated(diff);
      expect(result).toEqual(['feat: x']);
    });

    it('expires entries older than 24h and removes the file', async () => {
      const diff = 'diff --git a/y.js b/y.js\n--- a/y.js\n+++ b/y.js\n+const b = 2;';
      const key = cm.generateKey(diff);
      const file = path.join(tempDir, `${key}.json`);
      realFs.writeFileSync(
        file,
        JSON.stringify({ messages: ['old'], timestamp: Date.now() - 86400001 })
      );

      const result = await cm.getValidated(diff);

      expect(result).toBeNull();
      expect(realFs.existsSync(file)).toBe(false);
    });

    it('enforces the 500-file cap during cleanup', async () => {
      for (let i = 0; i < 502; i++) {
        realFs.writeFileSync(
          path.join(tempDir, `fake-${i}.json`),
          JSON.stringify({ timestamp: Date.now() })
        );
      }

      await cm.cleanup();

      const remaining = realFs
        .readdirSync(tempDir)
        .filter(f => f.endsWith('.json')).length;
      expect(remaining).toBeLessThanOrEqual(500);
    });

    it('removes corrupted cache files during cleanup', async () => {
      const bad = path.join(tempDir, 'corrupt.json');
      realFs.writeFileSync(bad, '{not valid json');

      const removed = await cm.cleanup();

      expect(removed).toBeGreaterThanOrEqual(1);
      expect(realFs.existsSync(bad)).toBe(false);
    });
  });

});
