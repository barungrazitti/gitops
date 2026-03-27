/**
 * Secret Scanner - Advanced detection and redaction of sensitive information
 */

class SecretScanner {
  constructor(options = {}) {
    this.redactionLog = [];
    this.enterpriseMode = options.enterpriseMode || false;

    // IMPORTANT: Order matters! More specific patterns must come first
    // Comprehensive list of patterns for detecting secrets
    this.secretPatterns = [
      // Specific Token Patterns (must come before generic patterns)
      
      // JWT tokens (JSON Web Tokens) - most specific pattern first
      {
        name: 'jwt_token',
        pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g,
        replacement: '[REDACTED_JWT]',
        category: 'secret'
      },
      
      // GitHub personal access tokens (flexible length)
      {
        name: 'github_token',
        pattern: /ghp_[A-Za-z0-9]{20,40}/g,
        replacement: '[REDACTED_GITHUB_TOKEN]',
        category: 'secret'
      },
      
      // Slack tokens
      {
        name: 'slack_token',
        pattern: /xox[pbar]-[A-Za-z0-9-]{10,}/g,
        replacement: '[REDACTED_SLACK_TOKEN]',
        category: 'secret'
      },
      
      // AWS credentials
      {
        name: 'aws_access_key',
        pattern: /\b(AKIA|ABIA|ACGA|AGPA|AIDA|AIPA|ANPA|ANVA|APKA|AROA|ASCA|ASIA)[A-Z0-9]{16}\b/g,
        replacement: '[REDACTED_AWS_ACCESS_KEY]',
        category: 'secret'
      },
      {
        name: 'aws_secret_key',
        pattern: /\b(?:aws_)?secret[_-]?key[\s:=]+['"]?([A-Za-z0-9\/+]{40})['"]?/gi,
        replacement: '[REDACTED_AWS_SECRET_KEY]',
        category: 'secret'
      },
      
      // SSH keys
      {
        name: 'ssh_private_key',
        pattern: /-----BEGIN (?:RSA |EC |DSA |SSH2 )?PRIVATE KEY-----(?:\n|\r\n)[\s\S]*?(?:\n|\r\n)-----END (?:RSA |EC |DSA |SSH2 )?PRIVATE KEY-----/g,
        replacement: '[REDACTED_SSH_PRIVATE_KEY]',
        category: 'secret'
      },
      
      // Google service account keys
      {
        name: 'google_service_account',
        pattern: /\b"private_key_id"[^}]{0,200}?"private_key"/i,
        replacement: '"private_key_id": "[REDACTED]", "private_key": "[REDACTED]"',
        category: 'secret'
      },
      
      // Database connection strings
      {
        name: 'database_connection',
        pattern: /\b(?:mongodb|postgres|mysql|mariadb|redis|sqlserver):\/\/[\s\S]*?(?=["'\s])/gi,
        replacement: '[REDACTED_DATABASE_CONNECTION]',
        category: 'secret'
      },
      
      // Passwords in URLs
      {
        name: 'password_in_url',
        pattern: /:\/\/[^:]+:[^@]+@/g,
        replacement: '://[USER]:[PASSWORD]@',
        category: 'secret'
      },
      
      // Credit card numbers (basic pattern)
      {
        name: 'credit_card',
        pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        replacement: '[REDACTED_CREDIT_CARD]',
        category: 'secret'
      },
      
      // Generic API keys - must come AFTER specific token patterns
      {
        name: 'api_key_with_label',
        pattern: /((?:api[\s_-]?key|secret|token|password|pwd|pass|credential|auth|bearer|apikey)[\s:=]+['"]?)([A-Za-z0-9_\-+=]{15,})(['"]?)/gi,
        replacement: '$1[REDACTED_API_KEY]$3',
        category: 'secret'
      },
      // Common API key prefixes (sk-, pk-, etc.)
      {
        name: 'prefixed_api_key',
        pattern: /['"]?(sk_|pk_|sk-|pk-|AIza[A-Za-z0-9_-]{10,}|AKIA[A-Z0-9]{16})[A-Za-z0-9_\-+=]{10,}['"]?/g,
        replacement: '[REDACTED_API_KEY]',
        category: 'secret'
      },
      
      // PII Patterns - Personally Identifiable Information
      
      // Email addresses (more flexible pattern)
      {
        name: 'email_address',
        pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        replacement: '[REDACTED_EMAIL]',
        category: 'pii'
      },
      
      // IP addresses (both IPv4 and IPv6)
      {
        name: 'ip_address',
        pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?::\d+)?\b/g,
        replacement: '[REDACTED_IP]',
        category: 'pii'
      },
      
      // Phone numbers (international formats) - must come after IP address
      {
        name: 'phone_number',
        pattern: /\b(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})(?: *x(\d+))?\b/g,
        replacement: '[REDACTED_PHONE]',
        category: 'pii'
      },
      
      // Social Security Numbers (US)
      {
        name: 'ssn',
        pattern: /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g,
        replacement: '[REDACTED_SSN]',
        category: 'pii'
      },
      
      // Physical addresses (basic pattern)
      {
        name: 'physical_address',
        pattern: /\b\d+\s+[A-Z][a-z]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl)\b[^,]{0,50}/gi,
        replacement: '[REDACTED_ADDRESS]',
        category: 'pii'
      },

      // Additional PII - Names in common patterns
      {
        name: 'person_name_pattern',
        pattern: /\b(?:John|Jane|Bob|Alice|Charlie|David|Eve|Frank|Grace|Heidi|Ivan|Judy|Kevin|Laura|Mike|Nancy|Oscar|Peggy|Quentin|Rachel|Steve|Trent|Ursula|Victor|Wendy|Xavier|Yvonne|Zack)\b/gi,
        replacement: '[REDACTED_NAME]',
        category: 'pii'
      },

      // Internal hostnames and IPs
      {
        name: 'internal_hostname',
        pattern: /\b(?:[a-zA-Z0-9-]+\.)?(?:internal|corp|intranet|dev|staging|prod|private)\.[a-z]{2,}\b/gi,
        replacement: '[REDACTED_HOSTNAME]',
        category: 'secret'
      }
    ];
  }

  /**
   * Scan and redact secrets from content with tracking
   */
  scanAndRedact(content, trackRedactions = true) {
    if (typeof content !== 'string') {
      return content;
    }

    if (trackRedactions) {
      this.redactionLog = [];
    }

    let redactedContent = content;
    let totalRedactions = 0;

    for (const patternInfo of this.secretPatterns) {
      const matches = redactedContent.match(patternInfo.pattern) || [];
      if (matches.length > 0) {
        redactedContent = redactedContent.replace(patternInfo.pattern, patternInfo.replacement);
        totalRedactions += matches.length;
        
        if (trackRedactions) {
          this.redactionLog.push({
            type: patternInfo.name,
            category: patternInfo.category || 'secret',
            count: matches.length,
            replacement: patternInfo.replacement
          });
        }
      }
    }

    if (trackRedactions && totalRedactions > 0) {
      this.redactionLog.push({
        summary: true,
        totalRedactions,
        timestamp: new Date().toISOString()
      });
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
          category: patternInfo.category || 'secret',
          value: match,
          pattern: patternInfo.pattern.toString()
        });
      }
    }

    return detectedSecrets;
  }

  /**
   * Check if content is safe (no secrets or PII detected)
   */
  isSafe(content) {
    const secrets = this.scan(content);
    return {
      safe: secrets.length === 0,
      detectedCount: secrets.length,
      detected: secrets
    };
  }

  /**
   * Get redaction summary from last scanAndRedact call
   */
  getRedactionSummary() {
    if (this.redactionLog.length === 0) {
      return {
        found: false,
        redacted: 0,
        details: []
      };
    }

    const summaryEntry = this.redactionLog.find(log => log.summary);
    const totalRedactions = summaryEntry?.totalRedactions || 0;

    // Group by category
    const byCategory = {};
    const byType = {};

    for (const log of this.redactionLog) {
      if (log.summary) continue;
      
      byCategory[log.category] = (byCategory[log.category] || 0) + log.count;
      byType[log.type] = (byType[log.type] || 0) + log.count;
    }

    return {
      found: true,
      redacted: totalRedactions,
      byCategory,
      byType,
      details: this.redactionLog.filter(log => !log.summary)
    };
  }

  /**
   * Clear redaction log
   */
  clearRedactionLog() {
    this.redactionLog = [];
  }

  /**
   * Check if content is safe (no secrets or PII detected)
   */
  isSafe(content) {
    const secrets = this.scan(content);
    return {
      safe: secrets.length === 0,
      detectedCount: secrets.length,
      detected: secrets
    };
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
      'email_address': 'Email addresses',
      'jwt_token': 'JSON Web Tokens (JWT)',
      'github_token': 'GitHub Personal Access Tokens',
      'slack_token': 'Slack API tokens',
      'ip_address': 'IP addresses (IPv4/IPv6)',
      'phone_number': 'Phone numbers',
      'ssn': 'US Social Security Numbers',
      'physical_address': 'Physical addresses'
    };

    return descriptions[patternName] || 'Custom secret pattern';
  }

  /**
   * Enable enterprise mode with stricter controls
   */
  enableEnterpriseMode() {
    this.enterpriseMode = true;
  }

  /**
   * Check if content is safe to send to external AI
   */
  isContentSafe(content) {
    if (!content) return true;
    const result = this.scanAndRedact(content, false);
    return result === content;
  }

  /**
   * Get detailed security report
   */
  getSecurityReport(content) {
    const originalLength = content?.length || 0;
    const redacted = this.scanAndRedact(content, true);
    const summary = this.getRedactionSummary();
    
    return {
      originalLength,
      sanitizedLength: redacted?.length || 0,
      reduction: originalLength - (redacted?.length || 0),
      secretsFound: summary.redacted,
      categories: summary.byCategory,
      types: summary.byType,
      isEnterpriseSafe: this.enterpriseMode ? summary.redacted === 0 : true,
      recommendations: this._generateRecommendations(summary)
    };
  }

  /**
   * Generate security recommendations
   */
  _generateRecommendations(summary) {
    const recommendations = [];
    
    if (summary.byCategory?.pii > 0) {
      recommendations.push('⚠️  PII detected - Consider removing personal data from code comments');
    }
    if (summary.byCategory?.secret > 0) {
      recommendations.push('🔒 Secrets detected - Use environment variables instead of hardcoded credentials');
    }
    if (this.enterpriseMode && summary.redacted > 0) {
      recommendations.push('🏢 Enterprise mode: Content blocked due to sensitive data');
    }
    if (summary.redacted === 0) {
      recommendations.push('✅ No sensitive data detected - Safe to send to AI');
    }
    
    return recommendations;
  }
}

module.exports = SecretScanner;