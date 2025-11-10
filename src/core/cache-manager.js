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
   * Generate cache key with content fingerprinting
   */
  generateKey(diff) {
    // More robust key generation that preserves semantic context
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
        return (line.startsWith('+') || line.startsWith('-')) &&
               trimmed.length > 3 &&
               !trimmed.startsWith('//') &&
               !trimmed.startsWith('*') &&
               !trimmed.startsWith('*/');
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
    const fileNames = files.map(f => f.replace('+++ b/', '').trim()).sort().join(',');
    return crypto.createHash('md5').update(fileNames).digest('hex').substring(0, 16);
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
   * Get cached commit messages with validation
   */
  async getValidated(diff) {
    try {
      const key = this.generateKey(diff);
      const semanticFingerprint = this.extractSemanticFingerprint(diff);

      // Try memory cache first
      let cached = this.memoryCache.get(key);
      if (cached) {
        // Validate semantic similarity before returning
        if (this.validateSemanticSimilarity(diff, cached.diff || '')) {
          return cached.messages;
        } else {
          // Remove invalid cache entry
          this.memoryCache.del(key);
        }
      }

      // Try persistent cache
      const cacheFile = path.join(this.cacheDir, `${key}.json`);
      if (await fs.pathExists(cacheFile)) {
        const cacheData = await fs.readJson(cacheFile);

        // Check if cache is still valid
        const now = Date.now();
        if (now - cacheData.timestamp < 86400000) { // 24 hours
          // Validate semantic similarity
          if (this.validateSemanticSimilarity(diff, cacheData.diff || '')) {
            // Add to memory cache for faster access
            this.memoryCache.set(key, cacheData);
            return cacheData.messages;
          } else {
            // Remove invalid cache file
            await fs.remove(cacheFile);
          }
        } else {
          // Remove expired cache file
          await fs.remove(cacheFile);
        }
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
      const cacheData = {
        messages,
        timestamp: Date.now(),
        diff: this.truncateDiff(diff), // Store truncated diff for validation
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
   * Truncate diff for storage (keep more content for debugging)
   */
  truncateDiff(diff) {
    return diff.length > 2000 ? diff.substring(0, 2000) + '...' : diff;
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
   * Validate semantic similarity between current and cached diff
   */
  validateSemanticSimilarity(currentDiff, cachedDiff, threshold = 0.7) {
    try {
      const currentSemantic = this.extractSemanticFingerprint(currentDiff);
      const cachedSemantic = this.extractSemanticFingerprint(cachedDiff);
      
      // If fingerprints are identical, high similarity
      if (currentSemantic === cachedSemantic) {
        return true;
      }
      
      // Extract actual code changes for comparison
      const currentChanges = this.extractCodeChanges(currentDiff);
      const cachedChanges = this.extractCodeChanges(cachedDiff);
      
      if (currentChanges.length === 0 || cachedChanges.length === 0) {
        return false;
      }
      
      // Calculate Jaccard similarity
      const currentSet = new Set(currentChanges);
      const cachedSet = new Set(cachedChanges);
      const intersection = new Set([...currentSet].filter(x => cachedSet.has(x)));
      const union = new Set([...currentSet, ...cachedSet]);
      
      const similarity = intersection.size / union.size;
      return similarity >= threshold;
    } catch (error) {
      console.warn('Semantic validation error:', error.message);
      return false; // Fail safe - don't use cached result
    }
  }

  /**
   * Extract actual code changes from diff
   */
  extractCodeChanges(diff) {
    const lines = diff.split('\n');
    return lines
      .filter(line => {
        const trimmed = line.substring(1).trim();
        return (line.startsWith('+') || line.startsWith('-')) &&
               trimmed.length > 3 &&
               !trimmed.startsWith('//') &&
               !trimmed.startsWith('*') &&
               !trimmed.startsWith('*/') &&
               !trimmed.match(/^\/\/\s*$/) &&
               !trimmed.match(/^\/\*.*\*\/$/);
      })
      .map(line => line.substring(1).trim().toLowerCase());
  }

  /**
   * Validate semantic similarity between diffs
   */
  validateSemanticSimilarity(diff1, diff2, threshold = 0.7) {
    try {
      const fingerprint1 = this.extractSemanticFingerprint(diff1);
      const fingerprint2 = this.extractSemanticFingerprint(diff2);
      
      if (fingerprint1 === fingerprint2) {
        return true; // Exact match
      }
      
      // Extract actual code changes for comparison
      const changes1 = this.extractCodeChanges(diff1);
      const changes2 = this.extractCodeChanges(diff2);
      
      if (changes1.length === 0 || changes2.length === 0) {
        return false; // Nothing to compare
      }
      
      // Calculate Jaccard similarity for code changes
      const set1 = new Set(changes1);
      const set2 = new Set(changes2);
      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);
      
      const similarity = intersection.size / union.size;
      return similarity >= threshold;
    } catch (error) {
      console.warn('Cache similarity validation error:', error.message);
      return false;
    }
  }

  /**
   * Get cache statistics that includes both memory and persistent cache
   */
  getStats() {
    const memoryStats = this.memoryCache.getStats();
    
    return {
      memory: {
        keys: memoryStats.keys,
        hits: memoryStats.hits,
        misses: memoryStats.misses,
        hitRate: memoryStats.hits + memoryStats.misses > 0 
          ? (memoryStats.hits / (memoryStats.hits + memoryStats.misses)) * 100 
          : 0
      },
      persistent: {
        directory: this.cacheDir,
        fileCount: 0, // Placeholder - would require counting cache files
        size: 0       // Placeholder - would require calculating cache size
      },
      totalSize: memoryStats.keys + this.getPersistentCacheCount()
    };
  }

  /**
   * Get count of persistent cache files
   */
  async getPersistentCacheCount() {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        return 0;
      }
      const files = await fs.readdir(this.cacheDir);
      return files.filter(f => f.endsWith('.json')).length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Find similar cache key
   */
  async findSimilarKey(targetDiff, threshold = 0.7) {
    const keys = this.memoryCache.keys();
    
    for (const key of keys) {
      const cached = this.memoryCache.get(key);
      if (cached && cached.diff) {
        if (this.validateSemanticSimilarity(targetDiff, cached.diff, threshold)) {
          return key;
        }
      }
    }
    
    // Also check persistent cache
    if (fs.existsSync(this.cacheDir)) {
      const files = await fs.readdir(this.cacheDir);
      const cacheFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of cacheFiles) {
        const filePath = path.join(this.cacheDir, file);
        try {
          const cacheData = await fs.readJson(filePath);
          if (cacheData.diff && this.validateSemanticSimilarity(targetDiff, cacheData.diff, threshold)) {
            return file.replace('.json', '');
          }
        } catch (error) {
          // Skip corrupted files
          continue;
        }
      }
    }
    
    return null;
  }

  /**
   * Find similar cached entries
   */
  async findSimilar(diff, threshold = 0.7) {
    const similarKey = await this.findSimilarKey(diff, threshold);
    if (similarKey) {
      const cached = this.memoryCache.get(similarKey);
      if (cached) {
        return cached.messages;
      }
    }
    
    return null;
  }
}

module.exports = CacheManager;
