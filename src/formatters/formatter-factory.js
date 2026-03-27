/**
 * FormatterFactory - Creates appropriate commit message formatters
 *
 * Strategy pattern for selecting commit message formatting approach:
 * - Conventional format: type(scope): description
 * - Freeform format: Natural language description
 * - Custom format: Template-based formatting
 *
 * Per FMT-04: Factory pattern for extensible formatting strategies
 */

const WhatChangedFormatter = require('./sections/what-changed');
const WhyChangedFormatter = require('./sections/why-changed');
const ImpactFormatter = require('./sections/impact');

class FormatterFactory {
  constructor() {
    this.formatters = {
      conventional: new ConventionalFormatter(),
      freeform: new FreeformFormatter()
    };
    this.defaultFormat = 'conventional';
  }

  /**
   * Get formatter by type
   * @param {string} type - Formatter type ('conventional' | 'freeform')
   * @returns {Object} Formatter instance
   */
  getFormatter(type) {
    return this.formatters[type] || this.formatters[this.defaultFormat];
  }

  /**
   * Create composite formatter with all sections
   * @param {Object} options - Formatting options
   * @returns {Object} Composite formatter
   */
  createCompositeFormatter(options = {}) {
    return new CompositeFormatter(
      new WhatChangedFormatter(),
      new WhyChangedFormatter(),
      new ImpactFormatter(),
      options
    );
  }

  /**
   * Format commit message with strategy
   * @param {string} message - Commit message
   * @param {Object} context - Detector context
   * @param {Object} options - Formatting options
   * @returns {string} Formatted message
   */
  format(message, context, options = {}) {
    const formatType = options.conventional ? 'conventional' : 'freeform';
    const formatter = this.getFormatter(formatType);
    return formatter.format(message, context, options);
  }
}

/**
 * Conventional commit formatter
 */
class ConventionalFormatter {
  constructor() {
    this.types = [
      'feat', 'fix', 'docs', 'style', 'refactor',
      'perf', 'test', 'chore', 'ci', 'build'
    ];
  }

  /**
   * Format message in conventional commit format
   * @param {string} message - Commit message
   * @param {Object} context - Detector context
   * @param {Object} options - Formatting options
   * @returns {string} Formatted conventional commit
   */
  format(message, context, options = {}) {
    if (!message) return '';

    // If already conventional, return as-is
    if (this.isConventional(message)) {
      return message;
    }

    const type = options.type || this.inferType(message, context);
    const scope = options.scope || this.inferScope(message, context);

    let formatted = type;
    if (scope) {
      formatted += `(${scope})`;
    }
    formatted += `: ${this.cleanDescription(message)}`;

    return formatted;
  }

  /**
   * Check if message is already in conventional format
   * @param {string} message - Commit message
   * @returns {boolean} Whether it's conventional
   */
  isConventional(message) {
    return /^(\w+)(\([^)]+\))?: .+/.test(message);
  }

  /**
   * Infer commit type from message
   * @param {string} message - Commit message
   * @param {Object} context - Detector context
   * @returns {string} Commit type
   */
  inferType(message, context) {
    // Use context if available
    if (context?.conventions?.commitType && this.types.includes(context.conventions.commitType)) {
      return context.conventions.commitType;
    }

    const lower = message.toLowerCase();

    // Pattern matching
    const typePatterns = {
      feat: /add|new|create|implement|introduce|enable/i,
      fix: /fix|bug|issue|error|resolve|correct|prevent/i,
      docs: /doc|readme|comment|guide|tutorial/i,
      style: /format|style|lint|prettier|whitespace/i,
      refactor: /refactor|restructure|clean|improve|optimize/i,
      perf: /performance|optimize|speed|cache|lazy/i,
      test: /test|spec|coverage|jest|mock/i,
      chore: /chore|update|upgrade|bump|dependency/i,
      ci: /ci|pipeline|workflow|action|deploy/i,
      build: /build|webpack|rollup|babel|compile/i
    };

    for (const [type, pattern] of Object.entries(typePatterns)) {
      if (pattern.test(lower)) {
        return type;
      }
    }

    return 'chore';
  }

  /**
   * Infer scope from context
   * @param {string} message - Commit message
   * @param {Object} context - Detector context
   * @returns {string} Scope or null
   */
  inferScope(message, context) {
    // Priority 1: Component detector scope
    if (context?.components?.scope) {
      return context.components.scope;
    }

    // Priority 2: File analysis scope
    if (context?.files?.scope) {
      return context.files.scope;
    }

    // Priority 3: WordPress context
    if (context?.files?.wordpress?.isWordPress) {
      const wp = context.files.wordpress;
      if (wp.plugins?.length === 1) return wp.plugins[0];
      if (wp.themes?.length === 1) return wp.themes[0];
    }

    return null;
  }

  /**
   * Clean message description
   * @param {string} message - Commit message
   * @returns {string} Cleaned description
   */
  cleanDescription(message) {
    let desc = message.trim();

    // Remove conventional prefix if present
    desc = desc.replace(/^(\w+)(\([^)]+\))?:\s*/, '');

    // Remove common prefixes
    desc = desc.replace(/^(add|added|fix|fixed|update|updated|remove|removed)\s+/i, '');

    // Lowercase first letter
    if (desc.length > 0) {
      desc = desc.charAt(0).toLowerCase() + desc.slice(1);
    }

    // Remove trailing period
    desc = desc.replace(/\.$/, '');

    return desc;
  }
}

/**
 * Freeform commit formatter
 */
class FreeformFormatter {
  /**
   * Format message in freeform natural language
   * @param {string} message - Commit message
   * @param {Object} context - Detector context
   * @param {Object} options - Formatting options
   * @returns {string} Formatted freeform message
   */
  format(message, context, options = {}) {
    if (!message) return '';

    // Apply minimal cleanup
    return this.cleanupMessage(message);
  }

  /**
   * Clean up message formatting
   * @param {string} message - Commit message
   * @returns {string} Cleaned message
   */
  cleanupMessage(message) {
    return message
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  }
}

/**
 * Composite formatter combining all sections
 */
class CompositeFormatter {
  constructor(whatChanged, whyChanged, impact, options = {}) {
    this.whatChanged = whatChanged;
    this.whyChanged = whyChanged;
    this.impact = impact;
    this.options = options;
    this.includeSections = options.includeSections ?? ['what', 'why', 'impact'];
  }

  /**
   * Format complete commit message with all sections
   * @param {string} message - Base commit message
   * @param {Object} context - Detector context
   * @returns {string} Complete formatted message
   */
  format(message, context) {
    const lines = [];

    // Base message (conventional or freeform)
    const baseFormatter = this.options.conventional
      ? new ConventionalFormatter()
      : new FreeformFormatter();
    
    const baseMessage = baseFormatter.format(message, context, this.options);
    if (baseMessage) {
      lines.push(baseMessage);
    }

    // What Changed section
    if (this.includeSections.includes('what')) {
      const whatSection = this.whatChanged.format(context, message);
      if (whatSection) {
        lines.push(whatSection);
      }
    }

    // Why Changed section
    if (this.includeSections.includes('why')) {
      const whySection = this.whyChanged.format(context, message);
      if (whySection) {
        lines.push(whySection);
      }
    }

    // Impact section
    if (this.includeSections.includes('impact')) {
      const impactSection = this.impact.format(context, message);
      if (impactSection) {
        lines.push(impactSection);
      }
    }

    return lines.join('\n');
  }
}

module.exports = FormatterFactory;
