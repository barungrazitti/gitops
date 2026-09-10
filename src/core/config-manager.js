/**
 * Configuration Manager - Handles application configuration
 */

const Conf = require('conf');
const path = require('path');

// quiet: true suppresses dotenv's per-run "injected env" banner (dotenv 17+).
// Path is resolved from this module (not cwd) so `aic` finds the .env bundled
// with this project no matter which repo it is run from.
require('dotenv').config({
  quiet: true,
  path: path.resolve(__dirname, '..', '..', '.env'),
});

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
      excludeFiles: ['*.log', '*.tmp', 'node_modules/**', '.git/**', 'dist/**', 'build/**'],
      // Security settings
      sanitize: true, // Auto-redact secrets and PII before sending to AI
      redactionLog: true, // Log what was redacted for transparency

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
   * Apply .env / environment overrides to a config object
   */
  _applyEnvOverrides(config) {
    if (process.env.GROQ_API_KEY) {
      config.apiKey = process.env.GROQ_API_KEY;
    }
    if (process.env.AIC_MODEL) {
      config.model = process.env.AIC_MODEL;
    }
    if (process.env.AIC_PROVIDER) {
      config.defaultProvider = process.env.AIC_PROVIDER;
    }
    return config;
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

      // .env / environment overrides (do not persist to the conf store)
      this._applyEnvOverrides(value);

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
              : 'openai/gpt-oss-20b';
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
      const config = await this.load();
      return config;
    } catch (error) {
      throw new Error(`Failed to get all configuration: ${error.message}`);
    }
  }

  /**
   * Helper function to validate URL format
   */
  isValidUrl(string) {
    try {
      new URL(string); // eslint-disable-line no-new
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
        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value) &&
          typeof result[key] === 'object' &&
          result[key] !== null
        ) {
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
    return path
      .split('.')
      .reduce(
        (current, key) => (current && current[key] !== undefined ? current[key] : undefined),
        obj
      );
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
