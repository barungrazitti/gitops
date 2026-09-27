/**
 * Input Sanitizer - Utility for sanitizing inputs to prevent injection attacks
 */

class InputSanitizer {
  /**
   * Sanitize git command arguments
   */
  static sanitizeGitArgs(args) {
    if (!Array.isArray(args)) {
      args = [args];
    }

    return args.map(arg => {
      if (typeof arg !== 'string') {
        return arg;
      }

      // Check for command injection patterns
      const dangerousChars = /[;&|$`]/g;
      if (dangerousChars.test(arg)) {
        throw new Error(`Invalid argument: Contains dangerous characters: ${arg}`);
      }

      // Additional checks for git-specific patterns
      if (arg.startsWith('-') && arg.includes('=')) {
        // For arguments like --message=..., validate the value part
        const [flag, value] = arg.split('=');
        if (value) {
          return `${flag}=${this.sanitizeString(value)}`;
        }
      }

      return this.sanitizeString(arg);
    });
  }

  /**
   * Sanitize general string input
   */
  static sanitizeString(input) {
    if (typeof input !== 'string') {
      return input;
    }

    // Remove control characters
    let sanitized = input.replace(/[\x00-\x1f\x7f]/g, '');

    // Remove potential command injection characters
    sanitized = sanitized.replace(/[;&|$`]/g, '');

    // Remove newlines that could break command structure
    sanitized = sanitized.replace(/[\r\n]/g, ' ');

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
  }

  /**
   * Sanitize commit messages
   */
  static sanitizeCommitMessage(message) {
    if (typeof message !== 'string') {
      return message;
    }

    // Remove control characters EXCEPT \n — multi-line commit bodies are
    // legitimate (bullets, Refs trailers); simple-git passes argv, not a shell.
    let sanitized = message.replace(/[\x00-\x09\x0b-\x1f\x7f]/g, '');

    // Strip trailing whitespace per line to keep the git command safe.
    sanitized = sanitized
      .split(/\r?\n/)
      .map(l => l.trimEnd())
      .join('\n');

    // Limit length to prevent oversized commits (raw body length).
    if (sanitized.length > 1000) {
      sanitized = sanitized.substring(0, 1000);
    }

    return sanitized.trim();
  }

  /**
   * Validate git reference names (branches, tags)
   */
  static validateGitReference(refName) {
    if (typeof refName !== 'string') {
      return false;
    }

    // Git reference validation rules
    // - Cannot start with /
    // - Cannot end with .lock
    // - Cannot contain .. or // or @{
    // - Cannot contain ASCII control characters
    // - Cannot contain space, ~, ^, :, ?, *, [

    if (refName.startsWith('/')) {
      return false;
    }

    if (refName.endsWith('.lock')) {
      return false;
    }

    const invalidPatterns = [
      /\.\./, // Double dots
      /\/\//, // Double slashes
      /@\{/, // At-brace
      /[\x00-\x20\x7f]/, // Control characters
      /[ ~^:?"*\[]/, // Special characters
      /\.\.$/, // Ends with double dot
    ];

    for (const pattern of invalidPatterns) {
      if (pattern.test(refName)) {
        return false;
      }
    }

    return true;
  }
}

module.exports = InputSanitizer;
