/**
 * Configuration Manager - Handles application configuration
 */

const Conf = require('conf');
const path = require('path');
const fs = require('fs-extra');
const Joi = require('joi');

class ConfigManager {
  constructor() {
    this.config = new Conf({
      projectName: 'ai-commit-generator',
      defaults: this.getDefaults()
    });
    
    this.schema = this.getValidationSchema();
  }

  /**
   * Get default configuration
   */
  getDefaults() {
    return {
      defaultProvider: 'openai',
      apiKey: null,
      model: null,
      conventionalCommits: true,
      language: 'en',
      messageCount: 3,
      maxTokens: 150,
      temperature: 0.7,
      cache: true,
      cacheExpiry: 86400000, // 24 hours in milliseconds
      proxy: null,
      timeout: 30000, // 30 seconds
      retries: 3,
      customPrompts: {},
      excludeFiles: [
        '*.log',
        '*.tmp',
        'node_modules/**',
        '.git/**',
        'dist/**',
        'build/**'
      ],
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
        'build'
      ],
      scopes: [],
      templates: {
        conventional: '{type}({scope}): {description}',
        simple: '{description}',
        detailed: '{type}({scope}): {description}\n\n{body}'
      }
    };
  }

  /**
   * Get validation schema
   */
  getValidationSchema() {
    return Joi.object({
      defaultProvider: Joi.string().valid(
        'openai', 'anthropic', 'gemini', 'mistral', 
        'cohere', 'groq', 'ollama'
      ).required(),
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
      commitTypes: Joi.array().items(Joi.string()),
      scopes: Joi.array().items(Joi.string()),
      templates: Joi.object()
    });
  }

  /**
   * Load configuration
   */
  async load() {
    try {
      const config = { ...this.getDefaults(), ...this.config.store };
      const { error, value } = this.schema.validate(config);

      if (error) {
        throw new Error(`Invalid configuration: ${error.message}`);
      }

      return value;
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
  }

  /**
   * Get a specific configuration value
   */
  async get(key) {
    try {
      return this.config.get(key);
    } catch (error) {
      throw new Error(`Failed to get configuration value: ${error.message}`);
    }
  }

  /**
   * Set a configuration value
   */
  async set(key, value) {
    try {
      // Validate the key-value pair
      const config = { ...this.getDefaults(), ...this.config.store };
      const testConfig = { ...config, [key]: value };
      const { error } = this.schema.validate(testConfig);

      if (error) {
        throw new Error(`Invalid configuration value: ${error.message}`);
      }

      this.config.set(key, value);
    } catch (error) {
      throw new Error(`Failed to set configuration value: ${error.message}`);
    }
  }

  /**
   * Set multiple configuration values
   */
  async setMultiple(values) {
    try {
      // Validate all values
      const config = { ...this.getDefaults(), ...this.config.store };
      const testConfig = { ...config, ...values };
      const { error } = this.schema.validate(testConfig);

      if (error) {
        throw new Error(`Invalid configuration values: ${error.message}`);
      }

      Object.entries(values).forEach(([key, value]) => {
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
        model: config.model,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        timeout: config.timeout,
        retries: config.retries,
        proxy: config.proxy
      };

      // Provider-specific defaults
      switch (provider) {
        case 'openai':
          providerConfig.model = providerConfig.model || 'gpt-3.5-turbo';
          break;
        case 'anthropic':
          providerConfig.model = providerConfig.model || 'claude-3-sonnet-20240229';
          break;
        case 'gemini':
          providerConfig.model = providerConfig.model || 'gemini-pro';
          break;
        case 'mistral':
          providerConfig.model = providerConfig.model || 'mistral-medium';
          break;
        case 'cohere':
          providerConfig.model = providerConfig.model || 'command';
          break;
        case 'groq':
          providerConfig.model = providerConfig.model || 'mixtral-8x7b-32768';
          break;
        case 'ollama':
          providerConfig.model = providerConfig.model || 'llama2';
          providerConfig.baseURL = 'http://localhost:11434';
          break;
      }

      return providerConfig;
    } catch (error) {
      throw new Error(`Failed to get provider configuration: ${error.message}`);
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
      throw new Error(`API key not configured for ${provider}. Run 'aicommit setup' to configure.`);
    }
    
    return true;
  }
}

module.exports = ConfigManager;