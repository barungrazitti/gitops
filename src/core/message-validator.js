/**
 * MessageValidator - Quality validation for commit messages
 *
 * Enforces QUAL-01 (<5% generic messages) and QUAL-02 (>90% with reasoning)
 * Validates specificity, reasoning, and component scope in commit messages.
 *
 * Per QUAL-01: Rejects generic messages like "update code" or "fix bug"
 * Per QUAL-02: Requires reasoning/why sections in >90% of messages
 * Per D-06: Returns flat context objects (no wrappers/metadata)
 */

class MessageValidator {
  constructor() {
    // Generic patterns that indicate low-quality messages (QUAL-01)
    this.genericPatterns = [
      /\b(update|change|modify|fix|add)\s+(code|bug|stuff|things|features?|files?)\b/i,
      /\b(new|additional|extra)\s+(stuff|things|items)\b/i,
      /\b(general|misc|various|multiple)\s+(changes|updates|fixes|improvements?)\b/i,
      /^\s*(improvements?|bug fix|updates?|refactor|changes)\s*$/i,
      /^\s*(update|fix|change|modify|add)\s*$/i,
      /\bfix\s+bug\b/i,
      /\bupdate\s+code\b/i,
      /\bmake\s+changes\b/i,
      /\bapply\s+fixes\b/i,
    ];

    // Banned patterns - instant rejection (single word or extremely vague)
    this.bannedPatterns = [
      /^\s*update\s*$/i,
      /^\s*fix\s*$/i,
      /^\s*commit\s*$/i,
      /^\s*changes\s*$/i,
      /^\s*misc\s*$/i,
      /^\s*stuff\s*$/i,
    ];

    // Reasoning indicators (QUAL-02)
    this.reasoningIndicators = [
      /\bto\s+\w+\b/i, // "to fix", "to add"
      /\bfor\s+\w+\b/i, // "for user", "for performance"
      /\bso\s+that\b/i,
      /\benables?\s+\w+/i,
      /\ballows?\s+\w+/i,
      /\bimproves?\s+\w+/i,
      /\bfixes?\s+\w+/i,
      /\bresolves?\s+\w+/i,
      /\bprevents?\s+\w+/i,
      /\bbecause\b/i,
      /\bdue\s+to\b/i,
      /\bin\s+order\s+to\b/i,
      /\bwhich\s+(enables|allows|fixes|improves)\b/i,
    ];

    // Specific technical term patterns (reward specificity)
    this.specificPatterns = [
      /\b[A-Z][a-zA-Z]*\b/, // Class names (PascalCase)
      /\b\w+\(\)/, // Function calls
      /\b(add|create|remove|delete|update|fix|implement)\s+\w+\b/i, // Specific actions
      /\b(class|function|const|let|var|import|export)\s+\w+/i, // Code constructs
      /\b[\w\-\/]+\.(js|ts|py|java|json|yaml|yml|md)\b/, // File paths
      /\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/, // CamelCase identifiers
    ];

    // Conventional commit type pattern
    this.conventionalTypePattern = /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?:/i;
  }

  /**
   * Validate a single commit message
   * @param {string} message - Commit message to validate
   * @param {Object} [context] - Optional context (components, fileTypes, etc.)
   * @returns {Object} Validation result: { valid, score, issues, suggestions }
   */
  validate(message, context = {}) {
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return {
        valid: false,
        score: 0,
        issues: ['empty-message'],
        suggestions: ['Provide a non-empty commit message']
      };
    }

    const trimmed = message.trim();
    const issues = [];
    const suggestions = [];
    let score = 50; // Start at neutral score

    // Check banned patterns (instant low score)
    for (const pattern of this.bannedPatterns) {
      if (pattern.test(trimmed)) {
        score = -100;
        issues.push('banned-pattern');
        suggestions.push('Message is too vague. Be specific about what changed.');
        return this._buildResult(false, score, issues, suggestions);
      }
    }

    // Check generic patterns (QUAL-01 enforcement)
    let isGeneric = false;
    for (const pattern of this.genericPatterns) {
      if (pattern.test(trimmed)) {
        isGeneric = true;
        score -= 30;
        issues.push('generic');
        suggestions.push('Be more specific: mention function/class names or files changed');
        break;
      }
    }

    // Check for conventional commit format (reward)
    if (this.conventionalTypePattern.test(trimmed)) {
      score += 20;
    }

    // Check for specific technical terms (reward specificity)
    let hasSpecificTerms = false;
    for (const pattern of this.specificPatterns) {
      if (pattern.test(trimmed)) {
        hasSpecificTerms = true;
        score += 15;
        break;
      }
    }

    // Check for reasoning (QUAL-02 enforcement)
    let hasReasoning = false;
    for (const pattern of this.reasoningIndicators) {
      if (pattern.test(trimmed)) {
        hasReasoning = true;
        score += 15;
        break;
      }
    }

    if (!hasReasoning && !isGeneric) {
      // Only flag if not already generic (avoid double penalty)
      issues.push('no-reasoning');
      suggestions.push('Add why: "to fix X bug", "enables Y feature", "improves Z performance"');
    }

    // Check component scope (if context provided and components detected)
    if (context.components && context.components.length > 0) {
      const hasScope = this._checkComponentScope(trimmed, context.components);
      if (!hasScope) {
        score += 5; // Small penalty, just a warning
        issues.push('no-scope');
        suggestions.push(`Consider adding scope: "feat(${context.components[0]}): ..."`);
      } else {
        score += 10; // Reward for matching scope
      }
    }

    // Check message length
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount < 3) {
      score -= 10;
      issues.push('too-short');
      suggestions.push('Message is too short. Provide more detail about the change.');
    } else if (wordCount > 50) {
      score -= 5;
      issues.push('too-long');
      suggestions.push('Consider shortening the title and moving details to the body.');
    }

    // Check capitalization
    if (trimmed[0] === trimmed[0].toUpperCase() && trimmed[0] !== trimmed[0].toLowerCase()) {
      score += 2;
    }

    // Check for period at end (conventional commits don't use periods)
    if (!trimmed.endsWith('.')) {
      score += 1;
    }

    // Normalize score to 0-100 range
    score = Math.max(0, Math.min(100, score));

    const valid = score >= 60 && !issues.includes('banned-pattern') && !issues.includes('generic');

    return this._buildResult(valid, score, issues, suggestions);
  }

  /**
   * Validate a batch of messages
   * @param {string[]} messages - Array of commit messages
   * @param {Object} [context] - Optional context
   * @returns {Object} Batch validation result with stats
   */
  validateBatch(messages, context = {}) {
    if (!Array.isArray(messages) || messages.length === 0) {
      return {
        validMessages: [],
        invalidMessages: [],
        stats: {
          total: 0,
          validCount: 0,
          genericCount: 0,
          withReasoning: 0,
          qualityRate: 0
        }
      };
    }

    const validMessages = [];
    const invalidMessages = [];
    let genericCount = 0;
    let withReasoning = 0;

    for (const message of messages) {
      const result = this.validate(message, context);
      const messageData = {
        message,
        score: result.score,
        issues: result.issues
      };

      if (result.valid) {
        validMessages.push(messageData);
      } else {
        invalidMessages.push({
          ...messageData,
          suggestions: result.suggestions
        });
      }

      // Track stats
      if (result.issues.includes('generic')) {
        genericCount++;
      }
      if (!result.issues.includes('no-reasoning')) {
        withReasoning++;
      }
    }

    const total = messages.length;
    const qualityRate = validMessages.length / total;

    return {
      validMessages,
      invalidMessages,
      stats: {
        total,
        validCount: validMessages.length,
        genericCount,
        withReasoning,
        qualityRate
      }
    };
  }

  /**
   * Check if quality thresholds are met (QUAL-01, QUAL-02)
   * @param {Object} batchResult - Result from validateBatch()
   * @returns {Object} Threshold check result
   */
  checkQualityThresholds(batchResult) {
    const { stats } = batchResult;
    const { total, genericCount, withReasoning } = stats;

    if (total === 0) {
      return {
        qual01Pass: true,
        qual02Pass: true,
        failures: []
      };
    }

    const genericRate = genericCount / total;
    const reasoningRate = withReasoning / total;

    const failures = [];

    // QUAL-01: <5% generic messages
    const qual01Pass = genericRate < 0.05;
    if (!qual01Pass) {
      failures.push({
        requirement: 'QUAL-01',
        description: 'Too many generic messages',
        threshold: '<5% generic',
        actual: `${(genericRate * 100).toFixed(1)}% generic`
      });
    }

    // QUAL-02: >90% with reasoning
    const qual02Pass = reasoningRate >= 0.90;
    if (!qual02Pass) {
      failures.push({
        requirement: 'QUAL-02',
        description: 'Insufficient reasoning in messages',
        threshold: '>90% with reasoning',
        actual: `${(reasoningRate * 100).toFixed(1)}% with reasoning`
      });
    }

    return {
      qual01Pass,
      qual02Pass,
      failures
    };
  }

  /**
   * Generate suggestions for improving a message
   * @param {string[]} issues - List of issues found
   * @returns {string[]} Suggestions for improvement
   */
  generateSuggestions(issues) {
    const suggestions = [];

    if (issues.includes('generic')) {
      suggestions.push('Be more specific: mention function/class names changed');
      suggestions.push('Example: "fix AuthService token validation" instead of "fix bug"');
    }

    if (issues.includes('no-reasoning')) {
      suggestions.push('Add why: "to fix X bug", "enables Y feature", "improves Z performance"');
      suggestions.push('Example: "add caching to reduce API calls" instead of "add caching"');
    }

    if (issues.includes('no-scope')) {
      suggestions.push('Consider adding scope: "feat(auth): add login validation"');
    }

    if (issues.includes('too-short')) {
      suggestions.push('Provide more detail: what changed and why it matters');
    }

    if (issues.includes('too-long')) {
      suggestions.push('Move details to commit body, keep title under 72 chars');
    }

    if (issues.includes('banned-pattern')) {
      suggestions.push('Use conventional commit format: type(scope): description');
      suggestions.push('Example: "feat(api): add user authentication endpoint"');
    }

    return suggestions;
  }

  /**
   * Check if message includes component scope
   * @private
   */
  _checkComponentScope(message, components) {
    if (!components || components.length === 0) {
      return true; // No components to check
    }

    const lowerMessage = message.toLowerCase();
    return components.some(comp =>
      lowerMessage.includes(comp.toLowerCase()) ||
      message.includes(`(${comp})`)
    );
  }

  /**
   * Build validation result object
   * @private
   */
  _buildResult(valid, score, issues, suggestions) {
    return {
      valid,
      score: Math.round(score),
      issues,
      suggestions: suggestions.length > 0 ? suggestions : []
    };
  }
}

module.exports = MessageValidator;
