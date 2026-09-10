/**
 * Cache Manager - Handles caching of AI responses
 */

const NodeCache = require('node-cache');
const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class CacheManager {
  constructor() {
    // Initialize in-memory cache with 24 hour TTL
    this.memoryCache = new NodeCache({
      stdTTL: 86400, // 24 hours
      checkperiod: 3600, // Check for expired keys every hour
    });

    // Persistent cache directory
    this.cacheDir = path.join(os.homedir(), '.ai-commit-generator', 'cache');
    this.ensureCacheDir();

    // Clean expired entries on startup (fire-and-forget)
    this.cleanup().catch(() => {});
  }

  /**
   * Ensure cache directory exists
   */
  async ensureCacheDir() {
    try {
      await fs.ensureDir(this.cacheDir);
    } catch (error) {
      console.warn('Failed to create cache directory:', error.message);
    }
  }

  /**
   * Generate cache key with content fingerprinting
   */
  generateKey(diff) {
    const semanticFingerprint = this.extractSemanticFingerprint(diff);
    const structuralFingerprint = this.extractStructuralFingerprint(diff);
    const combined = `${semanticFingerprint}:${structuralFingerprint}`;

    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Extract semantic fingerprint for similarity detection
   */
  extractSemanticFingerprint(diff) {
    const lines = diff.split('\n');
    const semanticLines = lines
      .filter(line => {
        const trimmed = line.substring(1).trim();
        // Focus on actual code changes, not context
        return (
          (line.startsWith('+') || line.startsWith('-')) &&
          trimmed.length > 3 &&
          !trimmed.startsWith('//') &&
          !trimmed.startsWith('*') &&
          !trimmed.startsWith('*/')
        );
      })
      .map(line => line.substring(1).trim())
      .join('|');

    return crypto.createHash('md5').update(semanticLines).digest('hex').substring(0, 16);
  }

  /**
   * Extract structural fingerprint for file-level context
   */
  extractStructuralFingerprint(diff) {
    const files = diff.match(/\+\+\+ b\/(.+)/g) || [];
    const fileNames = files
      .map(f => f.replace('+++ b/', '').trim())
      .sort()
      .join(',');
    return crypto.createHash('md5').update(fileNames).digest('hex').substring(0, 16);
  }

  /**
   * Get cached commit messages with validation
   */
  async getValidated(diff) {
    try {
      const key = this.generateKey(diff);

      // Try memory cache first
      const cached = this.memoryCache.get(key);
      if (cached) {
        return cached.messages;
      }

      // Try persistent cache
      const cacheFile = path.join(this.cacheDir, `${key}.json`);
      if (await fs.pathExists(cacheFile)) {
        const cacheData = await fs.readJson(cacheFile);

        // Check if cache is still valid
        const now = Date.now();
        if (now - cacheData.timestamp < 86400000) {
          // 24 hours
          // Add to memory cache for faster access
          this.memoryCache.set(key, cacheData);
          return cacheData.messages;
        }
        // Remove expired cache file
        await fs.remove(cacheFile);
      }

      return null;
    } catch (error) {
      console.warn('Validated cache get error:', error.message);
      return null;
    }
  }

  /**
   * Set cached commit messages with validation
   */
  async setValidated(diff, messages) {
    try {
      const key = this.generateKey(diff);
      const diffHash = crypto.createHash('sha256').update(diff).digest('hex');
      const cacheData = {
        messages,
        timestamp: Date.now(),
        diffHash,
        semanticFingerprint: this.extractSemanticFingerprint(diff),
        structuralFingerprint: this.extractStructuralFingerprint(diff),
      };

      // Set in memory cache
      this.memoryCache.set(key, cacheData);

      // Set in persistent cache
      const cacheFile = path.join(this.cacheDir, `${key}.json`);
      await fs.writeJson(cacheFile, cacheData);
    } catch (error) {
      console.warn('Validated cache set error:', error.message);
    }
  }

  /**
   * Clean expired cache entries
   */
  async cleanup() {
    try {
      if (!(await fs.pathExists(this.cacheDir))) {
        return;
      }

      const files = await fs.readdir(this.cacheDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      const now = Date.now();
      let cleanedCount = 0;

      // Remove expired files
      for (const file of jsonFiles) {
        const filePath = path.join(this.cacheDir, file);

        try {
          const cacheData = await fs.readJson(filePath);

          // Remove if older than 24 hours
          if (now - cacheData.timestamp > 86400000) {
            await fs.remove(filePath);
            cleanedCount++;
          }
        } catch (error) {
          // Remove corrupted cache files
          await fs.remove(filePath);
          cleanedCount++;
        }
      }

      // Enforce max count limit (500 files)
      const MAX_CACHE_FILES = 500;
      const remainingFiles = await fs.readdir(this.cacheDir);
      const remainingJson = remainingFiles.filter(f => f.endsWith('.json'));
      if (remainingJson.length > MAX_CACHE_FILES) {
        // Sort by modification time (oldest first) and remove excess
        const filesWithStats = await Promise.all(
          remainingJson.map(async (file) => {
            const filePath = path.join(this.cacheDir, file);
            const stats = await fs.stat(filePath);
            return { file, mtime: stats.mtimeMs };
          })
        );
        filesWithStats.sort((a, b) => a.mtime - b.mtime);
        const toRemove = filesWithStats.slice(0, remainingJson.length - MAX_CACHE_FILES);
        for (const { file } of toRemove) {
          await fs.remove(path.join(this.cacheDir, file));
          cleanedCount++;
        }
      }

      return cleanedCount;
    } catch (error) {
      console.warn('Cache cleanup error:', error.message);
      return 0;
    }
  }
}

module.exports = CacheManager;
