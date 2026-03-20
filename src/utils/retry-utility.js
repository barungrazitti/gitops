/**
 * Retry Utility with Exponential Backoff
 */

class RetryUtility {
  constructor(options = {}) {
    this.options = {
      maxRetries: options.maxRetries || 3,
      baseDelay: options.baseDelay || 1000, // 1 second
      maxDelay: options.maxDelay || 30000, // 30 seconds
      factor: options.factor || 2, // Exponential factor
      jitter: options.jitter || true, // Add randomness to delay
      retryableErrors: options.retryableErrors || [
        'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND',
        'Network Error', 'Request Timeout', 'Gateway Timeout',
        'Service Unavailable', 'Too Many Requests'
      ],
      ...options
    };
  }

  /**
   * Execute a function with retry logic
   */
  async execute(fn, options = {}) {
    const opts = { ...this.options, ...options };
    let lastError;
    
    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      try {
        return await fn(attempt);
      } catch (error) {
        lastError = error;
        
        // If this was the last attempt, don't retry
        if (attempt === opts.maxRetries) {
          break;
        }
        
        // Check if error is retryable
        if (!this.isRetryableError(error, opts.retryableErrors)) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt, opts);
        
        console.warn(`Attempt ${attempt + 1} failed: ${error.message}. Retrying in ${delay}ms...`);
        
        // Wait for the calculated delay
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Calculate delay with exponential backoff
   */
  calculateDelay(attempt, options) {
    let delay = options.baseDelay * options.factor**attempt;
    
    // Cap the delay at maxDelay
    delay = Math.min(delay, options.maxDelay);
    
    // Add jitter to prevent thundering herd
    if (options.jitter) {
      delay *= (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error, retryableErrors = null) {
    const errors = retryableErrors || this.options.retryableErrors;
    const errorMessage = error.message || error.toString();
    
    // Check against known retryable error patterns
    for (const retryable of errors) {
      if (errorMessage.includes(retryable)) {
        return true;
      }
    }
    
    // Check for network-related errors
    if (error.code) {
      const networkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'ENETUNREACH'];
      if (networkErrors.includes(error.code)) {
        return true;
      }
    }
    
    // Check for HTTP status codes if available
    if (error.status) {
      // 5xx server errors and 429 rate limiting
      if ((error.status >= 500 && error.status < 600) || error.status === 429) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute multiple operations with individual retry logic
   */
  async executeAll(tasks, options = {}) {
    const results = [];
    const errors = [];
    
    for (const [index, task] of tasks.entries()) {
      try {
        const result = await this.execute(task, options);
        results[index] = { success: true, result };
      } catch (error) {
        errors[index] = { success: false, error };
        results[index] = { success: false, error };
      }
    }
    
    return results;
  }

  /**
   * Execute with custom condition for retries
   */
  async executeWithCondition(fn, shouldRetry, options = {}) {
    const opts = { ...this.options, ...options };
    let lastResult;
    let lastError;
    
    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      try {
        const result = await fn(attempt);
        lastResult = result;
        
        // Check if we should retry based on custom condition
        if (!shouldRetry(result, attempt)) {
          return result;
        }
        
        if (attempt < opts.maxRetries) {
          const delay = this.calculateDelay(attempt, opts);
          await this.sleep(delay);
        }
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        if (!this.isRetryableError(error, opts.retryableErrors)) {
          break;
        }
        
        if (attempt < opts.maxRetries) {
          const delay = this.calculateDelay(attempt, opts);
          await this.sleep(delay);
        }
      }
    }
    
    if (lastError) {
      throw lastError;
    }
    
    return lastResult;
  }
}

module.exports = RetryUtility;