/**
 * Performance Utilities - Enhanced performance optimization tools
 */

class PerformanceUtils {
  /**
   * High-performance token estimation for AI models
   * More accurate than simple character counting
   * Uses 3.5-4 chars per token as conservative estimate
   */
  static estimateTokens(text) {
    if (!text) return 0;

    // Method 1: Character-based (most reliable for mixed content)
    const charBased = Math.ceil(text.length / 3.75);

    // Method 2: Word-based for text content
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const avgTokensPerWord = this.isCodeContent(text) ? 1.1 : 0.9;
    const wordBased = Math.ceil(words.length * avgTokensPerWord);

    // Use the more conservative (higher) estimate
    return Math.max(charBased, wordBased);
  }

  /**
   * Quick check if content appears to be code
   */
  static isCodeContent(text) {
    const codeIndicators = [
      'function', 'class', 'const', 'let', 'var', 'import', 'export',
      'if ', 'else ', 'for ', 'while ', 'def ', 'class ', '{', '}',
      'return', 'async', 'await', 'try', 'catch', 'throw', '=>',
      '===', '==', '=', '+', '-', '*', '/', '%', '||', '&&'
    ];
    
    const sample = text.slice(0, 500).toLowerCase();
    return codeIndicators.some(indicator => sample.includes(indicator));
  }

  /**
   * Parallel processing for AI provider calls
   */
  static async executeInParallel(tasks, options = {}) {
    const { 
      maxConcurrent = 3, 
      timeout = 30000 
    } = options;

    const results = [];
    const errors = [];

    for (let i = 0; i < tasks.length; i += maxConcurrent) {
      const batch = tasks.slice(i, i + maxConcurrent);
      
      try {
        const batchPromises = batch.map(task => task());
        const batchResults = await Promise.allSettled(
          batchPromises.map(p => this.withTimeout(p, timeout))
        );

        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            errors.push({
              index: i + index,
              error: result.reason
            });
          }
        });
      } catch (error) {
        console.error('Batch execution error:', error.message);
      }
    }

    return { results, errors };
  }

  /**
   * Add timeout wrapper for async operations
   */
  static async withTimeout(promise, timeoutMs) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Debounced function execution
   */
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Throttled function execution
   */
  static throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Memoize function results
   */
  static memoize(fn) {
    const cache = new Map();
    return function(...args) {
      const key = JSON.stringify(args);
      if (cache.has(key)) {
        return cache.get(key);
      }
      const result = fn.apply(this, args);
      cache.set(key, result);
      return result;
    };
  }

  /**
   * Measure execution time of a function
   */
  static async measureTime(fn, ...args) {
    const start = process.hrtime.bigint();
    try {
      const result = await (typeof fn === 'function' ? fn(...args) : fn);
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to milliseconds
      return { result, duration };
    } catch (error) {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000;
      throw { error, duration };
    }
  }

  /**
   * Batch process items with concurrency control
   */
  static async batchProcess(items, processor, options = {}) {
    const {
      batchSize = 10,
      delay = 0
    } = options;

    const results = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (item, index) => {
        if (delay && index > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        return processor(item, i + index);
      });

      const batchResults = await Promise.allSettled(
        batchPromises.map(p => this.withTimeout(p, 30000))
      );

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push({ index: i + index, result: result.value, error: null });
        } else {
          results.push({ index: i + index, result: null, error: result.reason });
        }
      });
    }

    return results;
  }

  /**
   * Get memory usage information
   */
  static getMemoryUsage() {
    const used = process.memoryUsage();
    return {
      rss: Math.round(used.rss / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(used.heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(used.heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(used.external / 1024 / 1024 * 100) / 100,
      arrayBuffers: Math.round(used.arrayBuffers / 1024 / 1024 * 100) / 100
    };
  }

  /**
   * Optimize diff processing for performance
   */
  static optimizeDiffProcessing(diff, options = {}) {
    const {
      maxDiffSize = 50000, // 50KB
      maxLineLength = 500
    } = options;

    if (diff.length > maxDiffSize) {
      // For very large diffs, we need to optimize processing
      const lines = diff.split('\n');
      const processedLines = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Preserve diff headers and context markers
        if (line.startsWith('diff --git') || 
            line.startsWith('index ') || 
            line.startsWith('---') || 
            line.startsWith('+++') || 
            line.startsWith('@@')) {
          processedLines.push(line);
          continue;
        }
        
        // Truncate very long lines
        if (line.length > maxLineLength) {
          processedLines.push(`${line.substring(0, maxLineLength)  }...[truncated]`);
          continue;
        }
        
        // Keep code changes but limit context
        if (line.startsWith('+') || line.startsWith('-')) {
          processedLines.push(line);
        } else if (line.startsWith(' ')) {
          // Only keep context lines around changes
          const hasNearbyChange = 
            (i > 0 && lines[i - 1] && (lines[i - 1].startsWith('+') || lines[i - 1].startsWith('-'))) ||
            (i < lines.length - 1 && lines[i + 1] && (lines[i + 1].startsWith('+') || lines[i + 1].startsWith('-')));
          
          if (hasNearbyChange) {
            processedLines.push(line);
          }
        } else {
          processedLines.push(line);
        }
      }
      
      return processedLines.join('\n');
    }
    
    return diff;
  }
}

module.exports = PerformanceUtils;