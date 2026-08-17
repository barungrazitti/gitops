/**
 * AI Provider Factory - Creates AI provider instances.
 * create(name, deps) threads shared collaborators (configManager,
 * activityLogger) into adapters so they are not fabricated per call.
 */

const GroqProvider = require('./groq-provider');
const OllamaProvider = require('./ollama-provider');

class AIProviderFactory {
  /**
   * Create an AI provider instance
   * @param {string} providerName - Name of the provider ('groq' | 'ollama').
   * @param {Object} [deps] - Shared collaborators for the adapter.
   * @param {Object} [deps.configManager] - Config store instance.
   * @param {Object} [deps.activityLogger] - Activity logger instance.
   */
  static create(providerName, deps = {}) {
    if (!providerName) {
      throw new Error(
        `Provider name is required. Got: ${providerName}. Available providers: groq, ollama`
      );
    }

    switch (providerName.toLowerCase()) {
      case 'groq':
        return new GroqProvider(deps);
      case 'ollama':
        return new OllamaProvider(deps);
      default:
        throw new Error(
          `Unsupported AI provider: ${providerName}. Supported providers: groq, ollama`
        );
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
}

module.exports = AIProviderFactory;