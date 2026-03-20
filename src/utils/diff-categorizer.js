/**
 * Diff Categorizer - Categorize diffs by size using hybrid metrics
 */

const TokenCounter = require('./token-counter');

class DiffCategorizer {
  constructor() {
    this.tokenCounter = new TokenCounter();

    // Default thresholds
    this.defaultThresholds = {
      tokens: { small: 100, medium: 2000 },
      files: { small: 2, medium: 10 },
      entities: { small: 5, medium: 20 },
    };

    // Entity extraction patterns
    this.entityPatterns = [
      /function\s+(\w+)/g,
      /const\s+(\w+)\s*=/g,
      /let\s+(\w+)\s*=/g,
      /var\s+(\w+)\s*=/g,
      /class\s+(\w+)/g,
    ];
  }

  /**
   * Categorize diff using hybrid metrics with strict AND logic
   * @param {string} diff - Git diff content
   * @param {object} thresholds - Optional custom thresholds
   * @returns {object} { category: 'small'|'medium'|'large', metrics: { tokens, files, entities } }
   */
  categorizeDiff(diff, thresholds = {}) {
    if (!diff) {
      return {
        category: 'small',
        metrics: { tokens: 0, files: 0, entities: 0 },
      };
    }

    // Merge with default thresholds
    const mergedThresholds = {
      tokens: { ...this.defaultThresholds.tokens, ...thresholds.tokens },
      files: { ...this.defaultThresholds.files, ...thresholds.files },
      entities: { ...this.defaultThresholds.entities, ...thresholds.entities },
    };

    // Calculate metrics
    const metrics = this.calculateMetrics(diff);

    // Categorize each metric
    const tokenCategory = this.categorizeMetric(metrics.tokens, mergedThresholds.tokens);
    const fileCategory = this.categorizeMetric(metrics.files, mergedThresholds.files);
    const entityCategory = this.categorizeMetric(metrics.entities, mergedThresholds.entities);

    // Strict AND logic: all 3 metrics must agree, default to smallest
    const category = this.resolveCategory([tokenCategory, fileCategory, entityCategory]);

    return {
      category,
      metrics,
    };
  }

  /**
   * Calculate metrics for diff
   * @param {string} diff - Git diff content
   * @returns {object} { tokens, files, entities }
   */
  calculateMetrics(diff) {
    return {
      tokens: this.tokenCounter.countTokens(diff),
      files: this.countFiles(diff),
      entities: this.extractEntities(diff).length,
    };
  }

  /**
   * Categorize a single metric
   * @param {number} value - Metric value
   * @param {object} threshold - { small, medium } thresholds
   * @returns {string} 'small'|'medium'|'large'
   */
  categorizeMetric(value, threshold) {
    if (value <= threshold.small) {
      return 'small';
    }
    if (value <= threshold.medium) {
      return 'medium';
    }
    return 'large';
  }

  /**
   * Resolve category using strict AND logic
   * All metrics must agree, default to smallest
   * @param {array} categories - Array of category strings
   * @returns {string} Resolved category
   */
  resolveCategory(categories) {
    // If all agree, return that category
    if (categories.every((c) => c === 'small')) {
      return 'small';
    }
    if (categories.every((c) => c === 'medium')) {
      return 'medium';
    }
    if (categories.every((c) => c === 'large')) {
      return 'large';
    }

    // Metrics disagree - default to smallest category present
    if (categories.includes('small')) {
      return 'small';
    }
    if (categories.includes('medium')) {
      return 'medium';
    }
    return 'large';
  }

  /**
   * Count number of files in diff
   * @param {string} diff - Git diff content
   * @returns {number} File count
   */
  countFiles(diff) {
    const matches = diff.match(/^diff --git/gm);
    return matches ? matches.length : 0;
  }

  /**
   * Extract entities from diff using regex patterns
   * @param {string} diff - Git diff content
   * @returns {array} Array of unique entity names
   */
  extractEntities(diff) {
    const entities = new Set();

    for (const pattern of this.entityPatterns) {
      let match;
      // eslint-disable-next-line no-cond-assign
      while ((match = pattern.exec(diff)) !== null) {
        if (match[1]) {
          entities.add(match[1]);
        }
      }
    }

    return Array.from(entities);
  }

  /**
   * Get default thresholds
   * @returns {object} Default thresholds
   */
  getDefaults() {
    return { ...this.defaultThresholds };
  }

  /**
   * Validate thresholds
   * @param {object} thresholds - Thresholds to validate
   * @returns {object} { valid: boolean, errors: array }
   */
  validateThresholds(thresholds) {
    const errors = [];

    if (!thresholds || typeof thresholds !== 'object') {
      return { valid: false, errors: ['Thresholds must be an object'] };
    }

    const validateMetric = (metric, name) => {
      if (!metric || typeof metric !== 'object') {
        errors.push(`${name} must be an object`);
        return false;
      }
      if (typeof metric.small !== 'number' || metric.small < 0) {
        errors.push(`${name}.small must be a non-negative number`);
      }
      if (typeof metric.medium !== 'number' || metric.medium < metric.small) {
        errors.push(`${name}.medium must be a number greater than small`);
      }
      return true;
    };

    if (thresholds.tokens) validateMetric(thresholds.tokens, 'tokens');
    if (thresholds.files) validateMetric(thresholds.files, 'files');
    if (thresholds.entities) validateMetric(thresholds.entities, 'entities');

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

module.exports = DiffCategorizer;
