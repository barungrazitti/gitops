/**
 * Token Counter - Lightweight token estimation (length/4 heuristic)
 */

class TokenCounter {
  /**
   * Estimate token count in text
   * @param {string} text - Text to count tokens for
   * @returns {number} Token count estimate
   */
  countTokens(text) {
    if (!text || typeof text !== 'string') {
      return 0;
    }
    return Math.ceil(text.length / 4);
  }
}

module.exports = TokenCounter;
