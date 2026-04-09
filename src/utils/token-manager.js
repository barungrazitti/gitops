/**
 * Token Manager - Handles token estimation and management for AI providers
 */

const PerformanceUtils = require('./performance-utils');

class TokenManager {
  constructor(options = {}) {
    this.defaultMaxTokens = options.defaultMaxTokens || 4096;
    this.reserveTokens = options.reserveTokens || 500; // Reserve tokens for response
  }

  /**
   * Estimate token count in text
   * Uses the same logic as PerformanceUtils.estimateTokens for consistency
   */
  estimateTokens(text) {
    if (!text) return 0;
    
    // Simple estimation: ~4 characters per token for English text
    // This is a rough approximation - actual tokenization depends on the model
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate available tokens for prompt after reserving for response
   */
  availableTokensForPrompt(maxTokens = this.defaultMaxTokens) {
    return Math.max(0, maxTokens - this.reserveTokens);
  }

  /**
   * Truncate text to fit within token limit
   */
  truncateForTokens(text, maxTokens) {
    if (!text) return '';
    
    const estimatedTokens = this.estimateTokens(text);
    if (estimatedTokens <= maxTokens) {
      return text;
    }
    
    // Calculate target length based on token estimation
    const targetLength = Math.floor(maxTokens * 4); // 4 chars per token estimate
    if (targetLength >= text.length) {
      return text;
    }
    
    // Try to truncate at a reasonable boundary (line break)
    const truncated = text.substring(0, targetLength);
    const lastNewline = truncated.lastIndexOf('\n');
    
    if (lastNewline > targetLength * 0.8) { // If we can keep 80% and break at line
      return truncated.substring(0, lastNewline);
    }
    
    return truncated + '... [truncated]';
  }

  /**
   * Check if text fits within token limit
   */
  fitsWithinLimit(text, maxTokens) {
    return this.estimateTokens(text) <= maxTokens;
  }

  /**
   * Get token estimation details
   */
  getTokenEstimationDetails(text) {
    const tokenCount = this.estimateTokens(text);
    return {
      tokenCount: tokenCount,
      characterCount: text ? text.length : 0,
      charsPerToken: text ? text.length / tokenCount : 0,
      fitsInDefaultLimit: tokenCount <= this.defaultMaxTokens
    };
  }
}

module.exports = TokenManager;