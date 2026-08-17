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
}

module.exports = TokenCounter;
