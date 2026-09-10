/**
 * Message Formatter - Formats commit messages according to conventions
 */

class MessageFormatter {
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
   * Apply conventional commit format
   */
  applyConventionalFormat(message, options) {
    if (this.isConventionalFormat(message)) return message;

    const type = options.type || this.inferType(message);
    const scope = options.scope || this.inferScope(message, options.context);
    const breaking = options.breaking ? '!' : '';
    const conventional = type + (scope ? `(${scope})` : '') + breaking + ': ';
    return conventional + this.cleanDescription(message);
  }

  /**
   * Check if message is already in conventional format
   */
  isConventionalFormat(message) {
    // Matches: type(scope): desc, type!: desc, type(scope)!: desc
    return /^(\w+)(\(.+\))?!?: .+/.test(message);
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
      formattedTitle = lastSpace > 40 ? truncated.substring(0, lastSpace) : truncated;
    }
    return body ? formattedTitle + '\n\n' + body : formattedTitle;
  }

  /**
   * Clean up formatting issues
   */
  cleanupFormatting(message) {
    return message
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  }
}

module.exports = MessageFormatter;
