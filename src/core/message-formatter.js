/**
 * Message Formatter - Formats commit messages according to conventions
 */

class MessageFormatter {
  constructor() {
    this.conventionalTypes = [
      'feat', 'fix', 'docs', 'style', 'refactor', 
      'perf', 'test', 'chore', 'ci', 'build'
    ];
  }

  /**
   * Format commit message according to options
   */
  format(message, options = {}) {
    if (!message || typeof message !== 'string') {
      return message;
    }

    let formatted = message.trim();

    // Apply conventional commit format if requested
    if (options.conventional) {
      formatted = this.applyConventionalFormat(formatted, options);
    }

    // Apply language-specific formatting
    if (options.language && options.language !== 'en') {
      formatted = this.applyLanguageFormatting(formatted, options.language);
    }

    // Apply length constraints
    formatted = this.applyLengthConstraints(formatted);

    // Clean up formatting
    formatted = this.cleanupFormatting(formatted);

    return formatted;
  }

  /**
   * Apply conventional commit format
   */
  applyConventionalFormat(message, options) {
    // If already in conventional format, return as is
    if (this.isConventionalFormat(message)) {
      return message;
    }

    // Extract type from options or infer from message
    const type = options.type || this.inferType(message);
    const scope = options.scope || this.inferScope(message, options.context);

    // Build conventional format
    let conventional = type;
    if (scope) {
      conventional += `(${scope})`;
    }
    conventional += ': ';

    // Clean the message description
    const description = this.cleanDescription(message);
    conventional += description;

    return conventional;
  }

  /**
   * Check if message is already in conventional format
   */
  isConventionalFormat(message) {
    const conventionalPattern = /^(\w+)(\(.+\))?: .+/;
    return conventionalPattern.test(message);
  }

  /**
   * Infer commit type from message content
   */
  inferType(message) {
    const lowerMessage = message.toLowerCase();

    const typePatterns = {
      'feat': /add|new|implement|create|introduce|feature/,
      'fix': /fix|bug|issue|error|problem|resolve|correct/,
      'docs': /doc|readme|comment|documentation/,
      'style': /format|style|lint|prettier|whitespace/,
      'refactor': /refactor|restructure|reorganize|clean/,
      'perf': /performance|perf|optimize|speed|fast/,
      'test': /test|spec|coverage|jest|mocha/,
      'chore': /chore|maintenance|update|upgrade|bump/,
      'ci': /ci|pipeline|workflow|github|gitlab/,
      'build': /build|webpack|rollup|babel|compile/
    };

    for (const [type, pattern] of Object.entries(typePatterns)) {
      if (pattern.test(lowerMessage)) {
        return type;
      }
    }

    // Default fallback
    return 'chore';
  }

  /**
   * Infer scope from message and context
   */
  inferScope(message, context) {
    if (!context || !context.files) {
      return null;
    }

    // Use the inferred scope from file analysis
    const fileScope = context.files.scope;
    if (fileScope && fileScope !== 'general' && fileScope !== 'unknown') {
      return fileScope;
    }

    // Try to infer from message content
    const lowerMessage = message.toLowerCase();
    const scopePatterns = {
      'api': /api|endpoint|route|server/,
      'ui': /ui|component|interface|frontend/,
      'auth': /auth|login|user|session/,
      'db': /database|db|model|schema/,
      'config': /config|setting|env/,
      'deps': /dependency|package|npm|yarn/
    };

    for (const [scope, pattern] of Object.entries(scopePatterns)) {
      if (pattern.test(lowerMessage)) {
        return scope;
      }
    }

    return null;
  }

  /**
   * Clean message description
   */
  cleanDescription(message) {
    let description = message.trim();

    // Remove common prefixes
    const prefixes = [
      /^(add|added|adds)\s+/i,
      /^(fix|fixed|fixes)\s+/i,
      /^(update|updated|updates)\s+/i,
      /^(remove|removed|removes)\s+/i,
      /^(implement|implemented|implements)\s+/i
    ];

    for (const prefix of prefixes) {
      description = description.replace(prefix, '');
    }

    // Ensure first letter is lowercase (conventional commit style)
    if (description.length > 0) {
      description = description.charAt(0).toLowerCase() + description.slice(1);
    }

    // Remove trailing periods
    description = description.replace(/\.$/, '');

    return description;
  }

  /**
   * Apply language-specific formatting
   */
  applyLanguageFormatting(message, language) {
    // For now, just return the message as-is
    // In the future, this could handle language-specific conventions
    return message;
  }

  /**
   * Apply length constraints
   */
  applyLengthConstraints(message) {
    const lines = message.split('\n');
    const title = lines[0];
    const body = lines.slice(1).join('\n').trim();

    // Limit title to 72 characters (GitHub's limit)
    let formattedTitle = title;
    if (title.length > 72) {
      formattedTitle = title.substring(0, 69) + '...';
    }

    // If there's a body, add it back
    if (body) {
      return formattedTitle + '\n\n' + body;
    }

    return formattedTitle;
  }

  /**
   * Clean up formatting issues
   */
  cleanupFormatting(message) {
    return message
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Multiple newlines to double newline
      .trim();
  }

  /**
   * Format message with template
   */
  formatWithTemplate(data, template) {
    const { type, scope, description, body } = data;
    
    return template
      .replace('{type}', type || '')
      .replace('{scope}', scope || '')
      .replace('{description}', description || '')
      .replace('{body}', body || '')
      .replace(/\(\)/g, '') // Remove empty parentheses
      .replace(/\s+/g, ' ') // Clean up spaces
      .trim();
  }

  /**
   * Parse conventional commit message
   */
  parseConventionalCommit(message) {
    const match = message.match(/^(\w+)(\(([^)]+)\))?: (.+)$/);
    
    if (!match) {
      return {
        type: null,
        scope: null,
        description: message,
        body: null
      };
    }

    const [, type, , scope, description] = match;
    const lines = message.split('\n');
    const body = lines.slice(1).join('\n').trim() || null;

    return {
      type,
      scope: scope || null,
      description,
      body
    };
  }

  /**
   * Validate commit message format
   */
  validate(message, options = {}) {
    const errors = [];
    const warnings = [];

    if (!message || typeof message !== 'string') {
      errors.push('Message is required');
      return { valid: false, errors, warnings };
    }

    const trimmed = message.trim();
    
    // Length validation
    const lines = trimmed.split('\n');
    const title = lines[0];
    
    if (title.length === 0) {
      errors.push('Title cannot be empty');
    } else if (title.length > 72) {
      warnings.push('Title should be 72 characters or less');
    }

    // Conventional commit validation
    if (options.conventional) {
      const parsed = this.parseConventionalCommit(title);
      
      if (!parsed.type) {
        errors.push('Conventional commit format required: type(scope): description');
      } else if (!this.conventionalTypes.includes(parsed.type)) {
        warnings.push(`Unknown commit type: ${parsed.type}`);
      }
    }

    // General formatting validation
    if (title.endsWith('.')) {
      warnings.push('Title should not end with a period');
    }

    if (title.charAt(0) === title.charAt(0).toUpperCase() && !options.conventional) {
      warnings.push('Title should start with lowercase letter');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get formatting suggestions
   */
  getSuggestions(message, options = {}) {
    const suggestions = [];
    const validation = this.validate(message, options);

    if (validation.warnings.length > 0) {
      suggestions.push(...validation.warnings.map(w => `Consider: ${w}`));
    }

    // Suggest conventional format if not used
    if (options.conventional && !this.isConventionalFormat(message)) {
      const formatted = this.applyConventionalFormat(message, options);
      suggestions.push(`Conventional format: ${formatted}`);
    }

    return suggestions;
  }
}

module.exports = MessageFormatter;