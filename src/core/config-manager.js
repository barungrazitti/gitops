/**
 * Configuration Manager - Handles application configuration
 */

const Conf = require('conf');

const fs = require('fs-extra');
const Joi = require('joi');

class ConfigManager {
  constructor() {
    this.config = new Conf({
      projectName: 'ai-commit-generator',
      defaults: this.getDefaults(),
    });

    this.schema = this.getValidationSchema();
  }

  /**
   * Get default configuration
   */
  getDefaults() {
    return {
      defaultProvider: 'groq',
      apiKey: null,
      model: null,
      conventionalCommits: true,
      language: 'en',
      messageCount: 1,
      maxTokens: 150,
      temperature: 0.7,
      cache: true,
      cacheExpiry: 86400000, // 24 hours in milliseconds
      proxy: null,
      timeout: 120000, // 2 minutes for large files
      retries: 3,
      customPrompts: {},
      excludeFiles: [
        '*.log',
        '*.tmp',
        'node_modules/**',
        '.git/**',
        'dist/**',
        'build/**',
      ],
      // Security settings
      sanitize: true, // Auto-redact secrets and PII before sending to AI
      redactionLog: true, // Log what was redacted for transparency
      
      // Test validation settings
      testValidation: {
        enabled: false,
        autoFix: true,
        testCommand: 'npm run test:quick',
        lintCommand: 'npm run lint',
        formatCommand: 'npm run format',
        aiProvider: 'ollama',
        confirmFixes: true,
        timeout: 120000,
        pushAfterValidation: false,
      },
      // Advanced code formatting settings
      codeFormatting: {
        enabled: false,
        useAdvancedFormatting: true,
        phpTools: true,
        htmlTools: true,
        cssTools: true,
        jsTools: true,
        prettierConfig: null,
        formatTimeout: 30000,
        autoSetupConfigs: true,
      },
      commitTypes: [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'chore',
        'ci',
        'build',
      ],
      scopes: [],
      templates: {
        conventional: '{type}({scope}): {description}',
        simple: '{description}',
        detailed: '{type}({scope}): {description}\n\n{body}',
      },

      // Diff categorization thresholds
      categorization: {
        small: {
          tokens: 100,
          files: 2,
          entities: 5,
        },
        medium: {
          tokens: 2000,
          files: 10,
          entities: 20,
        },
      },
    };
  }

  /**
   * Get validation schema
   */
  getValidationSchema() {
    return Joi.object({
      defaultProvider: Joi.string().valid('groq', 'ollama').required(),
      encryptedApiKey: Joi.object().allow(null),
      apiKey: Joi.string().allow(null),
      model: Joi.string().allow(null),
      conventionalCommits: Joi.boolean(),
      language: Joi.string().valid('en', 'es', 'fr', 'de', 'zh', 'ja'),
      messageCount: Joi.number().integer().min(1).max(10),
      maxTokens: Joi.number().integer().min(50).max(1000),
      temperature: Joi.number().min(0).max(2),
      cache: Joi.boolean(),
      cacheExpiry: Joi.number().integer().min(0),
      proxy: Joi.string().allow(null),
      timeout: Joi.number().integer().min(1000),
      retries: Joi.number().integer().min(0).max(10),
      customPrompts: Joi.object(),
      excludeFiles: Joi.array().items(Joi.string()),
      sanitize: Joi.boolean(),
      redactionLog: Joi.boolean(),
      commitTypes: Joi.array().items(Joi.string()),
      testValidation: Joi.object({
        enabled: Joi.boolean(),
        autoFix: Joi.boolean(),
        testCommand: Joi.string(),
        lintCommand: Joi.string(),
        formatCommand: Joi.string(),
        aiProvider: Joi.string().valid('groq', 'ollama'),
        confirmFixes: Joi.boolean(),
        timeout: Joi.number().integer().min(5000),
        pushAfterValidation: Joi.boolean(),
      }),
      codeFormatting: Joi.object({
        enabled: Joi.boolean(),
        useAdvancedFormatting: Joi.boolean(),
        phpTools: Joi.boolean(),
        htmlTools: Joi.boolean(),
        cssTools: Joi.boolean(),
        jsTools: Joi.boolean(),
        prettierConfig: Joi.string().allow(null),
        formatTimeout: Joi.number().integer().min(5000),
        autoSetupConfigs: Joi.boolean(),
      }),
      scopes: Joi.array().items(Joi.string()),
      templates: Joi.object(),
      categorization: Joi.object({
        small: Joi.object({
          tokens: Joi.number().integer().min(0),
          files: Joi.number().integer().min(1),
          entities: Joi.number().integer().min(0),
        }),
        medium: Joi.object({
          tokens: Joi.number().integer().min(0),
          files: Joi.number().integer().min(1),
          entities: Joi.number().integer().min(0),
        }),
      }),
    });
  }

  /**
   * Load configuration
   */
  async load() {
    try {
      const config = this.config.store;
      const defaults = this.getDefaults();

      // Merge existing config with defaults to handle new properties
      const mergedConfig = { ...defaults, ...config };

      const { error, value } = this.schema.validate(mergedConfig);

      if (error) {
        throw new Error(`Invalid configuration: ${error.message}`);
      }

      // Update the stored config with new defaults if needed
      if (JSON.stringify(config) !== JSON.stringify(value)) {
        Object.entries(value).forEach(([key, val]) => {
          this.config.set(key, val);
        });
      }

      return value;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }

  /**
   * Get a specific configuration value (supports dot notation)
   * @param {string} key - Configuration key (supports 'categorization.small.tokens')
   * @returns {*} Configuration value
   */
  async get(key) {
    try {
      if (key.includes('.')) {
        return this.getNestedValue(this.config.store, key);
      }
      return this.config.get(key);
    } catch (error) {
      throw new Error(`Failed to get configuration value: ${error.message}`);
    }
  }

  /**
   * Set a configuration value (supports dot notation)
   * @param {string} key - Configuration key (supports 'categorization.small.tokens')
   * @param {*} value - Value to set
   */
  async set(key, value) {
    try {
      let testConfig;

      if (key.includes('.')) {
        // For dot notation, build the nested structure
        testConfig = this.buildNestedObject(key, value);
        // Merge with existing config
        testConfig = this.mergeConfig(this.config.store, testConfig);
      } else {
        testConfig = { ...this.config.store, [key]: value };
      }

      // Validate the updated configuration
      const { error } = this.schema.validate(testConfig);

      if (error) {
        throw new Error(`Invalid configuration value: ${error.message}`);
      }

      if (key.includes('.')) {
        this.setNestedValue(this.config.store, key, value);
      } else {
        this.config.set(key, value);
      }
    } catch (error) {
      throw new Error(`Failed to set configuration value: ${error.message}`);
    }
  }

  /**
   * Set multiple configuration values
   */
  async setMultiple(values) {
    try {
      // Strip any encryptedApiKey since ConfigManager doesn't handle encryption
      const { ...cleanValues } = values;
       
      // Validate all values
      const testConfig = { ...this.config.store, ...cleanValues };
      const { error } = this.schema.validate(testConfig);

      if (error) {
        throw new Error(`Invalid configuration values: ${error.message}`);
      }

      Object.entries(cleanValues).forEach(([key, value]) => {
        this.config.set(key, value);
      });
    } catch (error) {
      throw new Error(`Failed to set configuration values: ${error.message}`);
    }
  }

  /**
   * Reset configuration to defaults
   */
  async reset() {
    try {
      this.config.clear();
      const defaults = this.getDefaults();
      Object.entries(defaults).forEach(([key, value]) => {
        this.config.set(key, value);
      });
    } catch (error) {
      throw new Error(`Failed to reset configuration: ${error.message}`);
    }
  }

  /**
   * Get configuration file path
   */
  getConfigPath() {
    return this.config.path;
  }

  /**
   * Export configuration to file
   */
  async export(filePath) {
    try {
      const config = this.config.store;
      await fs.writeJson(filePath, config, { spaces: 2 });
    } catch (error) {
      throw new Error(`Failed to export configuration: ${error.message}`);
    }
  }

  /**
   * Import configuration from file
   */
  async import(filePath) {
    try {
      const config = await fs.readJson(filePath);
      const { error } = this.schema.validate(config);

      if (error) {
        throw new Error(`Invalid configuration file: ${error.message}`);
      }

      this.config.store = config;
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error.message}`);
    }
  }

  /**
   * Get provider-specific configuration
   */
  async getProviderConfig(provider) {
    try {
      const config = await this.load();
      const providerConfig = {
        apiKey: config.apiKey,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        timeout: config.timeout,
        retries: config.retries,
        proxy: config.proxy,
      };

      // Provider-specific model handling - don't use global model for different providers
      switch (provider) {
      case 'groq':
        providerConfig.model =
            config.model &&
            (config.model.includes('mixtral') ||
              config.model.includes('llama') ||
              config.model.includes('gemma') ||
              config.model.includes('llama-3.1') ||
              config.model.includes('llama-3.3') ||
              config.model.includes('gpt-oss') ||
              config.model.includes('qwen'))
              ? config.model
              : 'llama-3.1-8b-instant';
        break;
      case 'ollama': {
        const ollamaModels = [
          'qwen2.5-coder:latest',
          'deepseek-v3.1:671b-cloud',
          'qwen3-coder:480b-cloud',
          'mistral:7b-instruct',
          'deepseek-r1:8b',
        ];
        providerConfig.model = ollamaModels.includes(config.model || '')
          ? config.model
          : 'qwen2.5-coder:latest';
        providerConfig.baseURL = 'http://localhost:11434';
        break;
      }
      default:
        providerConfig.model = config.model || 'default-model';
        break;
      }

      return providerConfig;
    } catch (error) {
      throw new Error(`Failed to get provider configuration: ${error.message}`);
    }
  }

  /**
   * Get all configuration
   */
  async getAll() {
    try {
      return this.config.store;
    } catch (error) {
      throw new Error(`Failed to get all configuration: ${error.message}`);
    }
  }

  /**
   * Validate API key for provider
   */
  async validateApiKey(provider) {
    const config = await this.load();

    if (provider === 'ollama') {
      return true; // Ollama doesn't require API key
    }

    if (!config.apiKey) {
      throw new Error(
        `API key not configured for ${provider}. Run 'aicommit setup' to configure.`
      );
    }

    return true;
  }

  /**
   * Validate provider configuration
   */
  async validateProviderConfig(provider, config = {}) {
    if (!provider) {
      throw new Error('Provider name is required');
    }

    const availableProviders = ['groq', 'ollama'];
    if (!availableProviders.includes(provider.toLowerCase())) {
      return {
        valid: false,
        errors: [`Unknown provider: ${provider}`]
      };
    }

    const errors = [];

    switch (provider.toLowerCase()) {
      case 'groq':
        if (!config.apiKey) {
          errors.push('API key is required');
        }
        break;
      case 'ollama':
        // Ollama doesn't require API key but may need other validations
        if (config.url && !this.isValidUrl(config.url)) {
          errors.push('Invalid URL format for Ollama');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Helper function to validate URL format
   */
  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Merge configuration objects
   */
  mergeConfig(base, override) {
    if (!base && !override) return {};
    if (!base) return override;
    if (!override) return base;

    const result = { ...base };

    for (const [key, value] of Object.entries(override)) {
      if (value !== undefined && value !== null) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value) && typeof result[key] === 'object' && result[key] !== null) {
          result[key] = this.mergeConfig(result[key], value);
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Get nested value using dot notation
   * @param {object} obj - Object to traverse
   * @param {string} path - Dot-notation path (e.g., 'categorization.small.tokens')
   * @returns {*} Nested value or undefined
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => (current && current[key] !== undefined ? current[key] : undefined), obj);
  }

  /**
   * Set nested value using dot notation
   * @param {object} obj - Object to modify
   * @param {string} path - Dot-notation path (e.g., 'categorization.small.tokens')
   * @param {*} value - Value to set
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Build nested object from dot notation path
   * @param {string} path - Dot-notation path
   * @param {*} value - Value to set
   * @returns {object} Nested object
   */
  buildNestedObject(path, value) {
    const keys = path.split('.');
    const result = {};
    let current = result;
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    return result;
  }
}

module.exports = ConfigManager;
