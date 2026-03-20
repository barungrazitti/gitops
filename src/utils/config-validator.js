/**
 * Enhanced Configuration Validator with Better Error Messages
 */

class ConfigValidator {
  constructor() {
    this.validationRules = {
      defaultProvider: {
        type: 'string',
        required: true,
        enum: ['groq', 'ollama'],
        message: 'Provider must be either "groq" or "ollama"'
      },
      apiKey: {
        type: 'string',
        required: false, // Not required for ollama
        minLength: 10,
        message: 'API key must be at least 10 characters long'
      },
      model: {
        type: 'string',
        required: false,
        message: 'Model name must be a valid string'
      },
      conventionalCommits: {
        type: 'boolean',
        required: false,
        default: true,
        message: 'Conventional commits setting must be true or false'
      },
      language: {
        type: 'string',
        required: false,
        enum: ['en', 'es', 'fr', 'de', 'zh', 'ja'],
        default: 'en',
        message: 'Language must be one of: en, es, fr, de, zh, ja'
      },
      messageCount: {
        type: 'number',
        required: false,
        min: 1,
        max: 10,
        default: 3,
        message: 'Message count must be between 1 and 10'
      },
      maxTokens: {
        type: 'number',
        required: false,
        min: 50,
        max: 1000,
        default: 150,
        message: 'Max tokens must be between 50 and 1000'
      },
      temperature: {
        type: 'number',
        required: false,
        min: 0,
        max: 2,
        default: 0.7,
        message: 'Temperature must be between 0 and 2'
      },
      cache: {
        type: 'boolean',
        required: false,
        default: true,
        message: 'Cache setting must be true or false'
      },
      cacheExpiry: {
        type: 'number',
        required: false,
        min: 0,
        default: 86400000, // 24 hours
        message: 'Cache expiry must be a positive number (milliseconds)'
      },
      proxy: {
        type: 'string',
        required: false,
        message: 'Proxy URL must be a valid string'
      },
      timeout: {
        type: 'number',
        required: false,
        min: 1000,
        default: 120000, // 2 minutes
        message: 'Timeout must be at least 1000ms (1 second)'
      },
      retries: {
        type: 'number',
        required: false,
        min: 0,
        max: 10,
        default: 3,
        message: 'Retries must be between 0 and 10'
      }
    };
  }

  /**
   * Validate a configuration object
   */
  validate(config) {
    const errors = [];
    const warnings = [];
    const validatedConfig = { ...config };

    for (const [key, rule] of Object.entries(this.validationRules)) {
      const value = config[key];
      
      // Check if required field is missing
      if (rule.required && (value === undefined || value === null)) {
        errors.push(`Missing required configuration: ${key} - ${rule.message}`);
        continue;
      }

      // Skip validation if value is undefined and not required
      if (value === undefined || value === null) {
        if ('default' in rule) {
          validatedConfig[key] = rule.default;
        }
        continue;
      }

      // Type validation
      const valueType = typeof value;
      if (rule.type && valueType !== rule.type) {
        errors.push(`Invalid type for ${key}: expected ${rule.type}, got ${valueType} - ${rule.message}`);
        continue;
      }

      // Enum validation
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(`Invalid value for ${key}: "${value}" - ${rule.message}. Valid values: ${rule.enum.join(', ')}`);
        continue;
      }

      // Numeric range validation
      if (rule.type === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`Value for ${key} is too low: ${value} - minimum is ${rule.min}. ${rule.message}`);
          continue;
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push(`Value for ${key} is too high: ${value} - maximum is ${rule.max}. ${rule.message}`);
          continue;
        }
      }

      // String length validation
      if (rule.type === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(`Value for ${key} is too short: ${value.length} characters - minimum is ${rule.minLength}. ${rule.message}`);
          continue;
        }
        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(`Value for ${key} is too long: ${value.length} characters - maximum is ${rule.maxLength}. ${rule.message}`);
          continue;
        }
      }

      // Special validation for API key when provider is not ollama
      if (key === 'defaultProvider' && value !== 'ollama') {
        const {apiKey} = config;
        if (!apiKey || apiKey.length < 10) {
          errors.push('API key is required when using providers other than ollama');
        }
      }

      // Set validated value
      validatedConfig[key] = value;
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      config: validatedConfig
    };
  }

  /**
   * Validate provider-specific configuration
   */
  validateProviderConfig(provider, config) {
    const result = this.validate(config);
    
    // Additional provider-specific validation
    if (provider === 'groq') {
      if (!config.apiKey) {
        result.errors.push('Groq provider requires an API key. Get one at https://console.groq.com/keys');
      } else if (config.apiKey.length < 20) {
        result.errors.push('Groq API key appears to be invalid (too short). Please verify your API key.');
      }
    } else if (provider === 'ollama') {
      if (config.apiKey) {
        result.warnings.push('Ollama provider does not require an API key. The API key setting will be ignored.');
      }
    }

    return {
      ...result,
      valid: result.valid && result.errors.length === 0
    };
  }

  /**
   * Get detailed validation report
   */
  getValidationReport(config) {
    const result = this.validate(config);
    
    return {
      isValid: result.valid,
      totalErrors: result.errors.length,
      totalWarnings: result.warnings.length,
      errors: result.errors,
      warnings: result.warnings,
      suggestions: this.generateSuggestions(result, config),
      severity: result.errors.length > 0 ? 'error' : result.warnings.length > 0 ? 'warning' : 'ok'
    };
  }

  /**
   * Generate helpful suggestions based on validation results
   */
  generateSuggestions(result, config) {
    const suggestions = [];

    if (result.errors.length > 0) {
      suggestions.push('Please fix the configuration errors above before continuing.');
    }

    if (config.defaultProvider === 'groq' && !config.apiKey) {
      suggestions.push('To get a Groq API key: Visit https://console.groq.com/keys and create a new key.');
    }

    if (config.defaultProvider === 'ollama' && !this.isOllamaRunning()) {
      suggestions.push('Make sure Ollama is running: Run "ollama serve" in a terminal before using the tool.');
    }

    if (config.messageCount && config.messageCount > 5) {
      suggestions.push('Consider reducing messageCount to improve performance and reduce costs.');
    }

    if (config.temperature && config.temperature > 1.0) {
      suggestions.push('High temperature values may result in less predictable outputs.');
    }

    return suggestions;
  }

  /**
   * Check if Ollama is running
   */
  isOllamaRunning() {
    try {
      // This is a simplified check - in a real implementation, you'd make an actual request
      // to the Ollama server to verify it's running
      return true; // Placeholder - would implement actual check
    } catch (error) {
      return false;
    }
  }

  /**
   * Get configuration schema for documentation
   */
  getSchema() {
    return {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(this.validationRules).map(([key, rule]) => [
          key,
          {
            type: rule.type,
            ...(rule.enum && { enum: rule.enum }),
            ...(rule.min !== undefined && { minimum: rule.min }),
            ...(rule.max !== undefined && { maximum: rule.max }),
            ...(rule.minLength !== undefined && { minLength: rule.minLength }),
            ...(rule.maxLength !== undefined && { maxLength: rule.maxLength }),
            ...(rule.default !== undefined && { default: rule.default }),
            description: rule.message
          }
        ])
      ),
      required: Object.entries(this.validationRules)
        .filter(([_, rule]) => rule.required)
        .map(([key]) => key)
    };
  }
}

module.exports = ConfigValidator;