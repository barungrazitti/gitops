/**
 * Secure Configuration Manager - Handles encrypted application configuration
 */

const Conf = require('conf');
const crypto = require('crypto');
const fs = require('fs-extra');
const Joi = require('joi');
const ConfigValidator = require('../utils/config-validator');
const configValidator = new ConfigValidator();

class SecureConfigManager {
  constructor() {
    // Generate a key for encryption (in a real app, this should be stored securely)
    this.key = this.generateOrLoadKey();
    this.algorithm = 'aes-256-gcm';
    
    this.config = new Conf({
      projectName: 'ai-commit-generator',
      defaults: this.getDefaults(),
    });

    this.schema = this.getValidationSchema();
  }

  /**
   * Generate or load encryption key
   */
  generateOrLoadKey() {
    // In a real application, you'd want to store this key securely
    // For now, we'll derive it from a consistent source
    const keyPath = this.getKeyFilePath();
    
    if (fs.existsSync(keyPath)) {
      return Buffer.from(fs.readFileSync(keyPath, 'utf8'), 'hex');
    } else {
      // Generate a new key and save it
      const newKey = crypto.randomBytes(32); // 256-bit key
      fs.ensureDirSync(require('path').dirname(keyPath));
      fs.writeFileSync(keyPath, newKey.toString('hex'));
      return newKey;
    }
  }

  /**
   * Get path for storing the encryption key
   */
  getKeyFilePath() {
    const os = require('os');
    const path = require('path');
    return path.join(os.homedir(), '.ai-commit-generator', 'encryption.key');
  }

  /**
   * Encrypt data
   */
  encrypt(data) {
    if (!data) return null;
    
    const iv = crypto.randomBytes(16); // Initialization vector
    const cipher = crypto.createCipher(this.algorithm, this.key);
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    // Return encrypted data with IV and auth tag
    return {
      data: encrypted.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Decrypt data
   */
  decrypt(encryptedObj) {
    if (!encryptedObj) return null;
    
    const decipher = crypto.createDecipher(this.algorithm, this.key);
    decipher.setAuthTag(Buffer.from(encryptedObj.authTag, 'hex'));
    decipher.setAAD(Buffer.from('', 'utf8')); // No additional authenticated data
    
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedObj.data, 'hex')),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  }

  /**
   * Get default configuration
   */
  getDefaults() {
    return {
      defaultProvider: 'groq',
      encryptedApiKey: null, // Store encrypted API key
      model: null,
      conventionalCommits: true,
      language: 'en',
      messageCount: 3,
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
    };
  }

  /**
   * Get validation schema
   */
  getValidationSchema() {
    return Joi.object({
      defaultProvider: Joi.string().valid('groq', 'ollama').required(),
      encryptedApiKey: Joi.object().allow(null), // Changed to object for encrypted data
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
      testValidation: Joi.object({
        enabled: Joi.boolean(),
        autoFix: Joi.boolean(),
        testCommand: Joi.string(),
        lintCommand: Joi.string(),
        formatCommand: Joi.string(),
        aiProvider: Joi.string().valid(
          'openai',
          'anthropic',
          'gemini',
          'mistral',
          'cohere',
          'groq',
          'ollama'
        ),
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
   * Get a specific configuration value
   */
  async get(key) {
    try {
      if (key === 'apiKey') {
        // Special handling for API key - decrypt it
        const encryptedApiKey = this.config.get('encryptedApiKey');
        return encryptedApiKey ? this.decrypt(encryptedApiKey) : null;
      }
      
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
      const testConfig = { ...this.config.store };
      
      if (key === 'apiKey') {
        // Special handling for API key - encrypt it
        const encryptedValue = this.encrypt(value);
        testConfig.encryptedApiKey = encryptedValue;
      } else {
        testConfig[key] = value;
      }
      
      const { error } = this.schema.validate(testConfig);

      if (error) {
        throw new Error(`Invalid configuration value: ${error.message}`);
      }

      if (key === 'apiKey') {
        this.config.set('encryptedApiKey', encryptedValue);
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
      const testConfig = { ...this.config.store };
      
      let encryptedApiKey = null;
      if (values.apiKey !== undefined) {
        encryptedApiKey = this.encrypt(values.apiKey);
        testConfig.encryptedApiKey = encryptedApiKey;
        delete values.apiKey;
      }
      
      Object.assign(testConfig, values);
      
      const { error } = this.schema.validate(testConfig);

      if (error) {
        throw new Error(`Invalid configuration values: ${error.message}`);
      }

      if (encryptedApiKey) {
        this.config.set('encryptedApiKey', encryptedApiKey);
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
      // Decrypt API key for export (should be used carefully)
      const exportedConfig = { ...config };
      if (exportedConfig.encryptedApiKey) {
        exportedConfig.apiKey = this.decrypt(exportedConfig.encryptedApiKey);
        delete exportedConfig.encryptedApiKey;
      }
      await fs.writeJson(filePath, exportedConfig, { spaces: 2 });
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

      // Encrypt API key if present in imported config
      if (config.apiKey) {
        const encryptedApiKey = this.encrypt(config.apiKey);
        delete config.apiKey; // Remove unencrypted key
        config.encryptedApiKey = encryptedApiKey;
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
      const apiKey = await this.get('apiKey'); // Get decrypted API key
      
      const providerConfig = {
        apiKey: apiKey,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        timeout: config.timeout,
        retries: config.retries,
        proxy: config.proxy,
      };

      // Provider-specific model handling - don't use global model for different providers
      switch (provider) {
      case 'openai':
        providerConfig.model =
            config.model && config.model.startsWith('gpt')
              ? config.model
              : 'gpt-3.5-turbo';
        break;
      case 'anthropic':
        providerConfig.model =
            config.model && config.model.startsWith('claude')
              ? config.model
              : 'claude-3-sonnet-20240229';
        break;
      case 'gemini':
        providerConfig.model =
            config.model && config.model.includes('gemini')
              ? config.model
              : 'gemini-pro';
        break;
      case 'mistral':
        providerConfig.model =
            config.model && config.model.includes('mistral')
              ? config.model
              : 'mistral-medium';
        break;
      case 'cohere':
        providerConfig.model =
            config.model && config.model.includes('command')
              ? config.model
              : 'command';
        break;
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
        // For Ollama, always use the default unless it's explicitly an Ollama model
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
        // For unknown providers, use basic config
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
      const config = this.config.store;
      const allConfig = { ...config };
      
      // Decrypt API key for return
      if (allConfig.encryptedApiKey) {
        allConfig.apiKey = this.decrypt(allConfig.encryptedApiKey);
        delete allConfig.encryptedApiKey;
      }
      
      return allConfig;
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

    const apiKey = await this.get('apiKey'); // Get decrypted API key
    if (!apiKey) {
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
        errors: [`Unknown provider: ${provider}. Available providers: ${availableProviders.join(', ')}`],
        suggestions: ['Check the provider name spelling', 'Refer to documentation for supported providers']
      };
    }

    // Use enhanced validator
    const result = configValidator.validateProviderConfig(provider, config);

    return {
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
      suggestions: result.suggestions
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
}

module.exports = SecureConfigManager;