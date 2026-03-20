/**
 * Token Counter - Accurate token counting using tiktoken
 */

const { encoding_for_model } = require('tiktoken');

class TokenCounter {
  constructor() {
    // Cache encoding for performance
    this.encodingCache = new Map();
  }

  /**
   * Count tokens in text using tiktoken
   * @param {string} text - Text to count tokens for
   * @param {string} model - Model name for encoding (default: gpt-4)
   * @returns {number} Token count
   */
  countTokens(text, model = 'gpt-4') {
    if (!text || typeof text !== 'string') {
      return 0;
    }

    try {
      const encoding = this.getEncoding(model);
      const tokens = encoding.encode(text);
      return tokens.length;
    } catch (error) {
      // Fallback to simple estimation if tiktoken fails
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Get or create encoding for model
   * @param {string} model - Model name
   * @returns {object} Tiktoken encoding
   */
  getEncoding(model) {
    if (!this.encodingCache.has(model)) {
      const encoding = encoding_for_model(model);
      this.encodingCache.set(model, encoding);
    }
    return this.encodingCache.get(model);
  }

  /**
   * Clear encoding cache
   */
  clearCache() {
    this.encodingCache.clear();
  }

  /**
   * Estimate cost for tokens (used for budget tracking)
   * @param {number} tokens - Token count
   * @param {string} provider - Provider name (groq, ollama, etc.)
   * @returns {number} Estimated cost in USD
   */
  estimateCost(tokens, provider = 'groq') {
    const costs = {
      groq: 0.0000001, // Approximate cost per token
      ollama: 0, // Local models are free
      openai: 0.00003,
    };

    const costPerToken = costs[provider] || costs.groq;
    return tokens * costPerToken;
  }
}

module.exports = TokenCounter;
