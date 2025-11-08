/**
 * AI Provider Factory - Creates AI provider instances
 */

const GroqProvider = require('./groq-provider');
const OllamaProvider = require('./ollama-provider');

class AIProviderFactory {
  /**
   * Create an AI provider instance
   */
  static create(providerName) {
    if (!providerName) {
      throw new Error(
        `Provider name is required. Got: ${providerName}. Available providers: groq, ollama`
      );
    }

    switch (providerName.toLowerCase()) {
    case 'groq':
      return new GroqProvider();
    case 'ollama':
      return new OllamaProvider();
    default:
      throw new Error(
        `Unsupported AI provider: ${providerName}. Supported providers: groq, ollama`
      );
    }
  }

  /**
   * Get list of available providers
   */
  static getAvailableProviders() {
    return [
      {
        name: 'groq',
        displayName: 'Groq',
        description: 'Fast inference models',
        requiresApiKey: true,
        models: [
          'mixtral-8x7b-32768',
          'llama2-70b-4096',
          'gemma-7b-it',
          'llama3-8b-8192',
          'llama3-70b-8192',
        ],
      },
      {
        name: 'ollama',
        displayName: 'Ollama (Local)',
        description: 'Local models via Ollama',
        requiresApiKey: false,
        models: [
          'deepseek-v3.1:671b-cloud',
          'qwen3-coder:480b-cloud',
          'qwen2.5-coder:latest',
          'mistral:7b-instruct',
          'deepseek-r1:8b',
        ],
      },
    ];
  }

  /**
   * Check if a provider is available
   */
  static isProviderAvailable(providerName) {
    const providers = this.getAvailableProviders();
    return providers.some(p => p.name === providerName.toLowerCase());
  }

  /**
   * Get default provider with fallback
   */
  static getDefaultProvider() {
    try {
      const configManager = require('../core/config-manager');
      const manager = new configManager();
      const defaultProvider = manager.get('provider');

      if (defaultProvider && this.isProviderAvailable(defaultProvider)) {
        return this.create(defaultProvider);
      }
    } catch (error) {
      // Fall through to fallback
    }

    // Fallback to groq
    return this.create('groq');
  }

  /**
   * Get provider configuration
   */
  static getProviderConfig(providerName) {
    try {
      const configManager = require('../core/config-manager');
      const manager = new configManager();
      return manager.get(providerName) || {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Validate provider configuration
   */
  static async validateProvider(providerName, config) {
    try {
      const provider = this.create(providerName);
      return await provider.validate(config);
    } catch (error) {
      throw new Error(`Provider validation failed: ${error.message}`);
    }
  }

  /**
   * Test provider connection
   */
  static async testProvider(providerName, config) {
    try {
      const provider = this.create(providerName);
      return await provider.test(config);
    } catch (error) {
      throw new Error(`Provider test failed: ${error.message}`);
    }
  }

  /**
   * Get available models for a specific provider
   */
  static async getProviderModels(providerName, config = {}) {
    try {
      const provider = this.create(providerName);

      // Set config if provided
      if (config.apiKey) {
        provider.config = config;
      }

      return await provider.getAvailableModels();
    } catch (error) {
      console.warn(
        `Failed to get models for ${providerName}: ${error.message}`
      );
      return [];
    }
  }

  /**
   * Get available models for all providers
   */
  static async getAllAvailableModels(configs = {}) {
    const providers = this.getAvailableProviders();
    const results = {};

    for (const providerInfo of providers) {
      try {
        const config = configs[providerInfo.name] || {};
        const models = await this.getProviderModels(providerInfo.name, config);

        results[providerInfo.name] = {
          ...providerInfo,
          models: models,
          available: models.length > 0,
          lastChecked: new Date().toISOString(),
        };
      } catch (error) {
        results[providerInfo.name] = {
          ...providerInfo,
          models: [],
          available: false,
          error: error.message,
          lastChecked: new Date().toISOString(),
        };
      }
    }

    return results;
  }

  /**
   * Get best available model across all providers
   */
  static async getBestAvailableModel(configs = {}) {
    const allModels = await this.getAllAvailableModels(configs);

    // Priority order for providers (best to worst for commit messages)
    const providerPriority = ['ollama', 'groq'];

    for (const providerName of providerPriority) {
      const providerData = allModels[providerName];
      if (
        providerData &&
        providerData.available &&
        providerData.models.length > 0
      ) {
        // Find recommended model or use first available
        const recommendedModel = providerData.models.find(
          (m) => m.recommended && m.available
        );
        const firstAvailable = providerData.models.find((m) => m.available);

        const selectedModel = recommendedModel || firstAvailable;

        if (selectedModel) {
          return {
            provider: providerName,
            model: selectedModel,
            providerInfo: providerData,
          };
        }
      }
    }

    return null;
  }

  /**
   * Auto-configure provider with best available model
   */
  static async autoConfigureProvider(configs = {}) {
    const bestOption = await this.getBestAvailableModel(configs);

    if (!bestOption) {
      throw new Error(
        'No available AI providers found. Please configure at least one provider.'
      );
    }

    return {
      provider: bestOption.provider,
      model: bestOption.model.id,
      recommendation: {
        reason: `Selected ${bestOption.model.name} from ${bestOption.providerInfo.displayName}`,
        alternatives: Object.keys(configs)
          .filter((p) => ['groq', 'ollama'].includes(p))
          .filter((p) => p !== bestOption.provider),
      },
    };
  }
}

module.exports = AIProviderFactory;
