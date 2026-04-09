/**
 * Message Formatter - Formats commit messages according to conventions
 *
 * Refactored to delegate to modular formatters (Phase 3: Formatters Module)
 * - WhatChangedFormatter: Component and file-level change descriptions
 * - WhyChangedFormatter: Motivation and reasoning detection
 * - ImpactFormatter: Breaking changes and dependency impact
 * - FormatterFactory: Strategy selection (conventional/freeform)
 */

const FormatterFactory = require('../formatters/formatter-factory');

class MessageFormatter {
  constructor() {
    this.formatterFactory = new FormatterFactory();
  }

  /**
   * Format commit message according to options
   */
  format(message, options = {}) {
    if (!message || typeof message !== 'string') return message;

    let formatted = message.trim();
    if (options.conventional) {
      formatted = this.applyConventionalFormat(formatted, options);
    }
    return this.cleanupFormatting(this.applyLengthConstraints(formatted));
  }

  /**
   * Format message with full context (what/why/impact)
   */
  formatWithContext(message, context, options = {}) {
    if (!message) return message;
    const composite = this.formatterFactory.createCompositeFormatter({
      conventional: options.conventional,
      includeSections: options.includeSections || ['what', 'why', 'impact'],
    });
    return composite.format(message, context);
  }

  /**
   * Apply conventional commit format
   */
  applyConventionalFormat(message, options) {
    if (this.isConventionalFormat(message)) return message;

    const type = options.type || this.inferType(message);
    const scope = options.scope || this.inferScope(message, options.context);
    let conventional = type + (scope ? `(${scope})` : '') + ': ';
    return conventional + this.cleanDescription(message);
  }

  /**
   * Check if message is already in conventional format
   */
  isConventionalFormat(message) {
    return /^(\w+)(\(.+\))?: .+/.test(message);
  }

  /**
   * Infer commit type from message content
   */
  inferType(message) {
    const lower = message.toLowerCase();
    const patterns = {
      feat: /add|new|create|implement|introduce|enable/i,
      fix: /fix|bug|issue|error|resolve|correct|prevent/i,
      docs: /doc|readme|comment|guide|tutorial/i,
      style: /format|style|lint|prettier|whitespace/i,
      refactor: /refactor|restructure|clean|improve|optimize/i,
      perf: /performance|optimize|speed|cache|lazy/i,
      test: /test|spec|coverage|jest|mock/i,
      chore: /chore|update|upgrade|bump|dependency/i,
      ci: /ci|pipeline|workflow|action|deploy/i,
      build: /build|webpack|rollup|babel|compile/i,
    };
    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(lower)) return type;
    }
    return 'chore';
  }

  /**
   * Infer scope from message and context
   */
  inferScope(message, context) {
    if (!context?.files && !context?.components) return null;
    if (context?.components?.scope) return context.components.scope;
    if (context?.files?.scope) return context.files.scope;
    if (context?.files?.wordpress?.isWordPress) {
      const wp = context.files.wordpress;
      if (wp.plugins?.length === 1) return wp.plugins[0];
      if (wp.themes?.length === 1) return wp.themes[0];
    }
    return null;
  }

  /**
   * Clean message description
   */
  cleanDescription(message) {
    let desc = message.trim();
    const prefixes = [
      /^(add|added|adds)\s+/i,
      /^(fix|fixed|fixes)\s+/i,
      /^(update|updated|updates)\s+/i,
      /^(remove|removed|removes)\s+/i,
      /^(implement|implemented|implements)\s+/i,
    ];
    for (const prefix of prefixes) desc = desc.replace(prefix, '');
    if (desc.length > 0) desc = desc.charAt(0).toLowerCase() + desc.slice(1);
    return desc.replace(/\.$/, '');
  }

  /**
   * Apply length constraints
   */
  applyLengthConstraints(message) {
    const lines = message.split('\n');
    const title = lines[0];
    const body = lines.slice(1).join('\n').trim();
    let formattedTitle = title;
    if (title.length > 72) {
      const truncated = title.substring(0, 72);
      const lastSpace = truncated.lastIndexOf(' ');
      formattedTitle =
        lastSpace > 40 ? truncated.substring(0, lastSpace) : truncated;
    }
    return body ? formattedTitle + '\n\n' + body : formattedTitle;
  }

  /**
   * Clean up formatting issues
   */
  cleanupFormatting(message) {
    return message
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  }

  /**
   * Validate commit message
   */
  validate(message, options = {}) {
    const errors = [],
      warnings = [];
    if (!message || typeof message !== 'string') {
      errors.push('Message is required');
      return { valid: false, errors, warnings };
    }
    const trimmed = message.trim();
    const title = trimmed.split('\n')[0];
    if (title.length === 0) errors.push('Title cannot be empty');
    else if (title.length > 72)
      warnings.push('Title should be 72 characters or less');
    if (options.conventional && !this.isConventionalFormat(title)) {
      errors.push(
        'Conventional commit format required: type(scope): description'
      );
    }
    if (title.endsWith('.'))
      warnings.push('Title should not end with a period');
    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate if response is a valid commit message
   */
  isValidCommitMessage(message) {
    if (!message || typeof message !== 'string') return false;
    const trimmed = message.trim();
    if (trimmed.length === 0) return false;
    const invalid = [
      /^(here's|here is|this is|the following)/i,
      /^(breakdown|explanation|description|summary)/i,
      /^(what|how|why|when|where)\s+(does|do|is|are)/i,
      /:$/,
      /^.{100,}$/,
    ];
    for (const pattern of invalid) if (pattern.test(trimmed)) return false;
    const valid = [
      /^(\w+)(\(.+\))?: .+/,
      /^(add|fix|remove|update|create|delete|implement|refactor)/i,
    ];
    return valid.some((p) => p.test(trimmed));
  }

  /**
   * Calculate relevance score for commit message (0-100)
   */
  calculateRelevanceScore(message) {
    let score = 50;
    const trimmed = message.toLowerCase().trim();
    if (/^\w+\(\w+\):/.test(message)) score += 15;
    const actions = [
      'add',
      'fix',
      'remove',
      'update',
      'improve',
      'optimize',
      'refactor',
    ];
    if (actions.some((w) => trimmed.includes(w))) score += 10;
    if (/\((auth|api|ui|db|config|theme|plugin|utils|test)\)/.test(message))
      score += 10;
    const vague = ['update', 'change', 'modify', 'improve'];
    score -= vague.filter((t) => trimmed.includes(t)).length * 5;
    return Math.max(0, Math.min(100, score));
  }
}

module.exports = MessageFormatter;
