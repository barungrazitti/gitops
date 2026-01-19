/**
 * Secret Scanner - Advanced detection and redaction of sensitive information
 */

class SecretScanner {
  constructor() {
    // Comprehensive list of patterns for detecting secrets
    this.secretPatterns = [
      // API keys
      {
        name: 'generic_api_key',
        pattern: /\b(?:api[_-]?key|secret|token|password|pwd|pass|credential|auth|bearer)[\s:=]+['"]?([A-Za-z0-9_\-+=]{20,})['"]?/gi,
        replacement: '[REDACTED_API_KEY]'
      },
      // AWS credentials
      {
        name: 'aws_access_key',
        pattern: /\b(AKIA|ABIA|ACGA|AGPA|AIDA|AIPA|ANPA|ANVA|APKA|AROA|ASCA|ASIA)[A-Z0-9]{16}\b/g,
        replacement: '[REDACTED_AWS_ACCESS_KEY]'
      },
      {
        name: 'aws_secret_key',
        pattern: /\b(?:aws_)?secret[_-]?key[\s:=]+['"]?([A-Za-z0-9\/+]{40})['"]?/gi,
        replacement: '[REDACTED_AWS_SECRET_KEY]'
      },
      // Google service account keys
      {
        name: 'google_service_account',
        pattern: /\b"private_key_id"[^}]{0,200}?"private_key"/i,
        replacement: '"private_key_id": "[REDACTED]", "private_key": "[REDACTED]"'
      },
      // OAuth tokens
      {
        name: 'oauth_token',
        pattern: /\b(oauth_)?token[\s:=]+['"]?([A-Za-z0-9_\-]{20,})['"]?/gi,
        replacement: '[REDACTED_OAUTH_TOKEN]'
      },
      // Database connection strings
      {
        name: 'database_connection',
        pattern: /\b(?:mongodb|postgres|mysql|mariadb|redis|sqlserver):\/\/[\s\S]*?(?=["'\s])/gi,
        replacement: '[REDACTED_DATABASE_CONNECTION]'
      },
      // SSH keys
      {
        name: 'ssh_private_key',
        pattern: /-----BEGIN (?:RSA |EC |DSA |SSH2 )?PRIVATE KEY-----(?:\n|\r\n)[\s\S]*?(?:\n|\r\n)-----END (?:RSA |EC |DSA |SSH2 )?PRIVATE KEY-----/g,
        replacement: '[REDACTED_SSH_PRIVATE_KEY]'
      },
      // Passwords in URLs
      {
        name: 'password_in_url',
        pattern: /:\/\/[^:]+:[^@]+@/g,
        replacement: '://[USER]:[PASSWORD]@'
      },
      // Credit card numbers (basic pattern)
      {
        name: 'credit_card',
        pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        replacement: '[REDACTED_CREDIT_CARD]'
      },
      // Email addresses (optional - depends on privacy requirements)
      {
        name: 'email_address',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        replacement: '[REDACTED_EMAIL]'
      }
    ];
  }

  /**
   * Scan and redact secrets from content
   */
  scanAndRedact(content) {
    if (typeof content !== 'string') {
      return content;
    }

    let redactedContent = content;

    for (const patternInfo of this.secretPatterns) {
      redactedContent = redactedContent.replace(patternInfo.pattern, patternInfo.replacement);
    }

    return redactedContent;
  }

  /**
   * Scan content and return detected secrets (without redacting)
   */
  scan(content) {
    if (typeof content !== 'string') {
      return [];
    }

    const detectedSecrets = [];

    for (const patternInfo of this.secretPatterns) {
      const matches = content.match(patternInfo.pattern) || [];
      for (const match of matches) {
        detectedSecrets.push({
          type: patternInfo.name,
          value: match,
          pattern: patternInfo.pattern.toString()
        });
      }
    }

    return detectedSecrets;
  }

  /**
   * Check if content contains secrets
   */
  containsSecrets(content) {
    return this.scan(content).length > 0;
  }

  /**
   * Enhanced scan for diff content specifically
   */
  scanDiffContent(diffContent) {
    if (typeof diffContent !== 'string') {
      return { hasSecrets: false, redactedContent: diffContent, detectedSecrets: [] };
    }

    const detectedSecrets = this.scan(diffContent);
    const hasSecrets = detectedSecrets.length > 0;
    const redactedContent = hasSecrets ? this.scanAndRedact(diffContent) : diffContent;

    return {
      hasSecrets,
      redactedContent,
      detectedSecrets,
      count: detectedSecrets.length
    };
  }

  /**
   * Add a custom pattern for secret detection
   */
  addCustomPattern(name, pattern, replacement) {
    this.secretPatterns.push({
      name,
      pattern: new RegExp(pattern, 'gi'),
      replacement
    });
  }

  /**
   * Get list of all known patterns
   */
  getKnownPatterns() {
    return this.secretPatterns.map(pattern => ({
      name: pattern.name,
      pattern: pattern.pattern.toString(),
      description: this.getDescriptionForPattern(pattern.name)
    }));
  }

  /**
   * Get description for a pattern type
   */
  getDescriptionForPattern(patternName) {
    const descriptions = {
      'generic_api_key': 'Generic API keys, secrets, tokens, or passwords',
      'aws_access_key': 'AWS access keys',
      'aws_secret_key': 'AWS secret keys',
      'google_service_account': 'Google service account keys',
      'oauth_token': 'OAuth tokens',
      'database_connection': 'Database connection strings',
      'ssh_private_key': 'SSH private keys',
      'password_in_url': 'Passwords embedded in URLs',
      'credit_card': 'Credit card numbers',
      'email_address': 'Email addresses'
    };

    return descriptions[patternName] || 'Custom secret pattern';
  }
}

module.exports = SecretScanner;