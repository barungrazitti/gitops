/**
 * Input Sanitizer - Utility for sanitizing inputs to prevent injection attacks
 */

const path = require('path');
const SecretScanner = require('./secret-scanner');
const secretScanner = new SecretScanner();

class InputSanitizer {
  /**
   * Sanitize file paths to prevent directory traversal
   */
  static sanitizeFilePath(inputPath) {
    if (!inputPath) return null;
    
    // Normalize the path to remove .. and . components
    const normalizedPath = path.normalize(inputPath);
    
    // Check for directory traversal attempts
    if (normalizedPath.includes('..')) {
      throw new Error('Invalid path: Directory traversal detected');
    }
    
    // Ensure path starts with a valid character (not absolute path manipulation)
    if (path.isAbsolute(normalizedPath)) {
      throw new Error('Invalid path: Absolute paths not allowed');
    }
    
    // Prevent certain dangerous patterns
    const dangerousPatterns = [
      /[\x00-\x1f\x7f]/, // Control characters
      /^\s+|\s+$/, // Leading/trailing whitespace
      /[\r\n]/, // Newline characters (potential command injection)
      /\.\.\//, // Explicit parent directory references
      /\/\/+/ // Multiple slashes
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(normalizedPath)) {
        throw new Error(`Invalid path: Contains dangerous pattern: ${pattern}`);
      }
    }
    
    return normalizedPath;
  }

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
    
    // Remove control characters
    let sanitized = message.replace(/[\x00-\x1f\x7f]/g, '');
    
    // Remove potential command injection characters
    sanitized = sanitized.replace(/[;&|$`]/g, '');
    
    // Remove newlines that could break git commands
    sanitized = sanitized.replace(/[\r\n]+/g, ' ');
    
    // Limit length to prevent oversized commits
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

  /**
   * Sanitize diff content to remove potential secrets
   */
  static sanitizeDiffContent(diff) {
    if (typeof diff !== 'string') {
      return diff;
    }

    // Use the advanced secret scanner to redact secrets
    return secretScanner.scanAndRedact(diff);
  }
  
  /**
   * Sanitize repository URL
   */
  static sanitizeRepoUrl(url) {
    if (typeof url !== 'string') {
      return url;
    }
    
    try {
      const parsed = new URL(url);
      
      // Only allow http/https/ssh protocols
      if (!['http:', 'https:', 'ssh:'].includes(parsed.protocol)) {
        throw new Error('Invalid protocol');
      }
      
      // Basic validation of hostname
      if (!parsed.hostname || parsed.hostname.length > 255) {
        throw new Error('Invalid hostname');
      }
      
      // Check for suspicious patterns in URL
      if (parsed.href.includes(';') || parsed.href.includes('&') || parsed.href.includes('|')) {
        throw new Error('Suspicious characters in URL');
      }
      
      return parsed.href;
    } catch (error) {
      throw new Error(`Invalid repository URL: ${error.message}`);
    }
  }
}

module.exports = InputSanitizer;