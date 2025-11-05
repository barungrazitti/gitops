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
   * Generate cache key from diff content
   */
  generateKey(diff) {
    // Normalize diff by removing timestamps and file paths that might change
    const normalizedDiff = diff
      .replace(/^index [a-f0-9]+\.\.[a-f0-9]+.*$/gm, '') // Remove index lines
      .replace(/^@@.*@@$/gm, '') // Remove hunk headers
      .replace(/^\+\+\+ .*$/gm, '') // Remove +++ lines
      .replace(/^--- .*$/gm, '') // Remove --- lines
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    return crypto.createHash('sha256').update(normalizedDiff).digest('hex');
  }

  /**
   * Ultra-fast cache get with semantic similarity
   */
  async getUltraFast(diff) {
    try {
      const key = this.generateKey(diff);

      // Try memory cache first (fastest)
      let cached = this.memoryCache.get(key);
      if (cached) {
        return cached.messages;
      }

 // DISABLED: Semantic similarity matching causing context contamination
      // Try semantic similarity matching for near-instant hits
      // const similarKey = await this.findSimilarKey(diff);
      // if (similarKey) {
      //   const similarCached = this.memoryCache.get(similarKey);
      //   if (similarCached) {
      //     return similarCached.messages;
      //   }
      // }

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
        } else {
          // Remove expired cache file
          await fs.remove(cacheFile);
        }
      }

      return null;
    } catch (error) {
      console.warn('Ultra-fast cache get error:', error.message);
      return null;
    }
  }

  /**
   * Get cached commit messages
   */
  async get(diff) {
    try {
      const key = this.generateKey(diff);

      // Try memory cache first
      let cached = this.memoryCache.get(key);
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
        } else {
          // Remove expired cache file
          await fs.remove(cacheFile);
        }
      }

      return null;
    } catch (error) {
      console.warn('Cache get error:', error.message);
      return null;
    }
  }

  /**
   * Set cached commit messages
   */
  async set(diff, messages) {
    try {
      const key = this.generateKey(diff);
      const cacheData = {
        messages,
        timestamp: Date.now(),
        diff: this.truncateDiff(diff), // Store truncated diff for debugging
        diffHash: this.quickHash(diff), // Quick hash for ultra-fast similarity
      };

      // Set in memory cache
      this.memoryCache.set(key, cacheData);

      // Set in persistent cache
      const cacheFile = path.join(this.cacheDir, `${key}.json`);
      await fs.writeJson(cacheFile, cacheData);
    } catch (error) {
      console.warn('Cache set error:', error.message);
    }
  }

  /**
   * Truncate diff for storage (keep first 500 chars for debugging)
   */
  truncateDiff(diff) {
    return diff.length > 500 ? diff.substring(0, 500) + '...' : diff;
  }

  /**
   * Clear all cache
   */
  async clear() {
    try {
      // Clear memory cache
      this.memoryCache.flushAll();

      // Clear persistent cache
      if (await fs.pathExists(this.cacheDir)) {
        const files = await fs.readdir(this.cacheDir);
        await Promise.all(
          files.map((file) => fs.remove(path.join(this.cacheDir, file)))
        );
      }
    } catch (error) {
      console.warn('Cache clear error:', error.message);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      const memoryStats = this.memoryCache.getStats();

      // Count persistent cache files
      let persistentCount = 0;
      let persistentSize = 0;

      if (await fs.pathExists(this.cacheDir)) {
        const files = await fs.readdir(this.cacheDir);
        persistentCount = files.length;

        for (const file of files) {
          const filePath = path.join(this.cacheDir, file);
          const stats = await fs.stat(filePath);
          persistentSize += stats.size;
        }
      }

      return {
        memory: {
          keys: memoryStats.keys,
          hits: memoryStats.hits,
          misses: memoryStats.misses,
          hitRate:
            (memoryStats.hits / (memoryStats.hits + memoryStats.misses)) * 100,
        },
        persistent: {
          files: persistentCount,
          sizeBytes: persistentSize,
          sizeMB: (persistentSize / 1024 / 1024).toFixed(2),
        },
      };
    } catch (error) {
      console.warn('Cache stats error:', error.message);
      return {
        memory: { keys: 0, hits: 0, misses: 0, hitRate: 0 },
        persistent: { files: 0, sizeBytes: 0, sizeMB: '0.00' },
      };
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
      const now = Date.now();
      let cleanedCount = 0;

      for (const file of files) {
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

      return cleanedCount;
    } catch (error) {
      console.warn('Cache cleanup error:', error.message);
      return 0;
    }
  }

  /**
   * Find similar key in memory cache for ultra-fast matching
   */
  async findSimilarKey(diff, threshold = 0.75) {
    try {
      const keys = this.memoryCache.keys();
      const diffHash = this.quickHash(diff);
      
      for (const key of keys) {
        const cached = this.memoryCache.get(key);
        if (cached && cached.diffHash) {
          // Quick hash comparison first
          if (Math.abs(diffHash - cached.diffHash) < 100) {
            return key;
          }
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Quick hash for fast similarity comparison
   */
  quickHash(text) {
    let hash = 0;
    const words = text.toLowerCase().split(/\s+/).slice(0, 50); // First 50 words
    for (const word of words) {
      hash += word.charCodeAt(0) * word.length;
    }
    return hash;
  }

  /**
   * Check if diff is similar to cached diffs
   */
  async findSimilar(diff, threshold = 0.8) {
    try {
      const diffLines = diff
        .split('\n')
        .filter((line) => line.startsWith('+') || line.startsWith('-'));

      if (!(await fs.pathExists(this.cacheDir))) {
        return null;
      }

      const files = await fs.readdir(this.cacheDir);

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);

        try {
          const cacheData = await fs.readJson(filePath);
          const cachedDiffLines = cacheData.diff
            .split('\n')
            .filter((line) => line.startsWith('+') || line.startsWith('-'));

          const similarity = this.calculateSimilarity(
            diffLines,
            cachedDiffLines
          );

          if (similarity >= threshold) {
            return cacheData.messages;
          }
        } catch (error) {
          // Skip corrupted files
          continue;
        }
      }

      return null;
    } catch (error) {
      console.warn('Similar cache search error:', error.message);
      return null;
    }
  }

  /**
   * Calculate similarity between two diff arrays
   */
  calculateSimilarity(diff1, diff2) {
    if (diff1.length === 0 && diff2.length === 0) return 1;
    if (diff1.length === 0 || diff2.length === 0) return 0;

    const set1 = new Set(diff1);
    const set2 = new Set(diff2);
    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }
}

module.exports = CacheManager;
