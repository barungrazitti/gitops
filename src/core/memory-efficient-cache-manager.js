/**
 * Memory-Efficient Cache Manager with Semantic Similarity
 */

const NodeCache = require('node-cache');
const crypto = require('crypto');

class MemoryEfficientCacheManager {
  constructor(options = {}) {
    // Initialize with memory limits
    this.options = {
      stdTTL: options.stdTTL || 3600, // 1 hour default
      checkperiod: options.checkperiod || 120, // Check every 2 minutes
      maxKeys: options.maxKeys || 1000, // Maximum number of keys to store
      maxSize: options.maxSize || 50 * 1024 * 1024, // 50MB max cache size
      useClones: false, // Don't clone objects to save memory
      ...options
    };

    this.cache = new NodeCache(this.options);
    this.currentSize = 0;
    this.keySizes = new Map(); // Track size of each cached item
    this.similarityThreshold = options.similarityThreshold || 0.8; // 80% similarity threshold
  }

  /**
   * Calculate approximate size of an object in bytes
   */
  calculateSize(obj) {
    if (obj === null || obj === undefined) return 0;
    if (typeof obj === 'string') return Buffer.byteLength(obj, 'utf8');
    if (typeof obj === 'number') return 8;
    if (typeof obj === 'boolean') return 4;
    if (typeof obj === 'object') {
      try {
        return Buffer.byteLength(JSON.stringify(obj), 'utf8');
      } catch (e) {
        // Fallback for circular references or non-stringifiable objects
        return 1024; // Conservative estimate
      }
    }
    return 0;
  }

  /**
   * Check if adding an item would exceed size limits
   */
  wouldExceedLimits(key, value) {
    const itemSize = this.calculateSize(value);
    const totalSizeAfterAdd = this.currentSize + itemSize;
    
    return totalSizeAfterAdd > this.options.maxSize || 
           this.cache.keys().length >= this.options.maxKeys;
  }

  /**
   * Evict oldest entries to make space
   */
  evictOldestEntries(sizeNeeded) {
    const keys = this.cache.keys();
    if (keys.length === 0) return false;

    // Sort keys by creation time (oldest first)
    const sortedKeys = keys.sort((a, b) => {
      const aDetails = this.cache.getTtl(a);
      const bDetails = this.cache.getTtl(b);
      return (aDetails ? aDetails.end : 0) - (bDetails ? bDetails.end : 0);
    });

    let freedSize = 0;
    for (const key of sortedKeys) {
      const itemSize = this.keySizes.get(key) || 0;
      this.cache.del(key);
      this.keySizes.delete(key);
      this.currentSize -= itemSize;
      freedSize += itemSize;

      if (freedSize >= sizeNeeded) {
        break;
      }
    }

    return freedSize >= sizeNeeded;
  }

  /**
   * Set a value in cache with size tracking
   */
  set(key, value, ttl = this.options.stdTTL) {
    const itemSize = this.calculateSize(value);

    // Check if we need to evict entries
    if (this.wouldExceedLimits(key, value)) {
      // Try to evict oldest entries to make space
      if (!this.evictOldestEntries(itemSize)) {
        // If we can't make enough space, don't cache this item
        console.warn('Cache is full and cannot evict enough entries to store new item');
        return false;
      }
    }

    const success = this.cache.set(key, value, ttl);
    if (success) {
      this.keySizes.set(key, itemSize);
      this.currentSize += itemSize;
    }

    return success;
  }

  /**
   * Get a value from cache
   */
  get(key) {
    return this.cache.get(key);
  }

  /**
   * Delete a key from cache
   */
  del(key) {
    const itemSize = this.keySizes.get(key) || 0;
    const deleted = this.cache.del(key);
    
    if (deleted) {
      this.keySizes.delete(key);
      this.currentSize -= itemSize;
    }

    return deleted;
  }

  /**
   * Clear all cache entries
   */
  flushAll() {
    this.cache.flushAll();
    this.keySizes.clear();
    this.currentSize = 0;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      keys: this.cache.keys().length,
      currentSize: this.currentSize,
      maxSize: this.options.maxSize,
      utilization: (this.currentSize / this.options.maxSize) * 100,
      hitCount: this.cache.getStats().hits,
      missCount: this.cache.getStats().misses,
      hitRate: this.cache.getStats().hitRate
    };
  }

  /**
   * Generate a hash for content to use as cache key
   */
  generateHash(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Get validated cached results with exact match
   */
  async getValidated(diff) {
    if (!diff) return null;

    const hash = this.generateHash(diff);
    return this.get(hash);
  }

  /**
   * Set validated cached results
   */
  async setValidated(diff, messages) {
    if (!diff || !messages) return false;

    const hash = this.generateHash(diff);
    return this.set(hash, messages);
  }

  /**
   * Find semantically similar diffs using simple string similarity
   */
  async findSimilar(diff, threshold = this.similarityThreshold) {
    if (!diff) return [];

    const allKeys = this.cache.keys();
    const similarResults = [];

    for (const key of allKeys) {
      const cachedDiff = this.get(key); // This would be the original diff content
      if (cachedDiff && typeof cachedDiff === 'string') {
        const similarity = this.calculateTextSimilarity(diff, cachedDiff);
        if (similarity >= threshold) {
          // Get the actual cached messages for this key
          const messages = this.get(key);
          similarResults.push({
            similarity,
            messages,
            key
          });
        }
      }
    }

    // Sort by similarity (highest first)
    return similarResults.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Calculate text similarity using a simple algorithm
   */
  calculateTextSimilarity(text1, text2) {
    // Normalize the texts
    const normalize = (text) => {
      return text.toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '')
        .trim();
    };

    const norm1 = normalize(text1);
    const norm2 = normalize(text2);

    // If texts are identical
    if (norm1 === norm2) return 1.0;

    // Calculate similarity using a variation of Jaccard similarity
    const words1 = new Set(norm1.split(/\s+/));
    const words2 = new Set(norm2.split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    // Jaccard similarity coefficient
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Set with semantic similarity check
   */
  async setWithSimilarityCheck(diff, messages, ttl = this.options.stdTTL) {
    if (!diff || !messages) return false;

    // First, check if there's already a very similar diff cached
    const similarResults = await this.findSimilar(diff, 0.95); // Very high threshold for deduplication
    
    if (similarResults.length > 0) {
      // If we already have a nearly identical diff, don't cache again
      return false;
    }

    // Store with the hash of the diff as key
    const hash = this.generateHash(diff);
    return this.set(hash, messages, ttl);
  }

  /**
   * Get with semantic similarity fallback
   */
  async getWithSimilarityFallback(diff, threshold = this.similarityThreshold) {
    if (!diff) return null;

    // First try exact match
    const exactMatch = await this.getValidated(diff);
    if (exactMatch) {
      return { exact: true, result: exactMatch };
    }

    // Then try similar matches
    const similarResults = await this.findSimilar(diff, threshold);
    if (similarResults.length > 0) {
      return { 
        exact: false, 
        result: similarResults[0].messages,
        similarity: similarResults[0].similarity
      };
    }

    return null;
  }

  /**
   * Clean expired entries manually (in addition to automatic cleanup)
   */
  cleanExpired() {
    const allKeys = this.cache.keys();
    const now = Date.now();
    
    for (const key of allKeys) {
      const ttl = this.cache.getTtl(key);
      if (ttl && ttl.end < now) {
        this.del(key);
      }
    }
  }

  /**
   * Get memory usage information
   */
  getMemoryInfo() {
    const usage = process.memoryUsage();
    return {
      cacheSize: this.currentSize,
      cacheUtilization: (this.currentSize / this.options.maxSize * 100).toFixed(2) + '%',
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      rss: usage.rss
    };
  }
}

module.exports = MemoryEfficientCacheManager;