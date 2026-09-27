/**
 * AI Provider Factory - Creates AI provider instances.
 * create(name, deps) threads shared collaborators (configManager,
 * activityLogger) into adapters so they are not fabricated per call.
 */

const GroqProvider = require('./groq-provider');
const OllamaProvider = require('./ollama-provider');

const instances = new Map();

class AIProviderFactory {
  /**
   * Create (or return the cached) AI provider instance. Providers own
   * stateful CircuitBreakers — a fresh instance per call made the breaker
   * unreachable, so instances are reused per (name, deps identity).
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

    const key = providerName.toLowerCase();
    const cached = instances.get(key);
    if (
      cached &&
      cached.deps.configManager === deps.configManager &&
      cached.deps.activityLogger === deps.activityLogger
    ) {
      return cached.instance;
    }

    let instance;
    switch (key) {
      case 'groq':
        instance = new GroqProvider(deps);
        break;
      case 'ollama':
        instance = new OllamaProvider(deps);
        break;
      default:
        throw new Error(
          `Unsupported AI provider: ${providerName}. Supported providers: groq, ollama`
        );
    }

    instances.set(key, { instance, deps });
    return instance;
  }

  /** Test hook: drop cached instances. */
  static resetInstances() {
    instances.clear();
  }
}

module.exports = AIProviderFactory;