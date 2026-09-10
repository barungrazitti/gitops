/**
 * Ollama Provider - Local AI models integration
 */

const axios = require('axios');
const BaseProvider = require('./base-provider');
const CircuitBreaker = require('../core/circuit-breaker');

class OllamaProvider extends BaseProvider {
  constructor(deps = {}) {
    super(deps);
    this.name = 'ollama';
    this.baseURL = 'http://localhost:11434';

    // Initialize circuit breaker for Ollama
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      timeout: 120000, // 2 minutes for local models
      monitoringPeriod: 30000, // 30 seconds
    });
  }

  /**
   * Generate AI response for a prompt (text in → text out).
   * Prompt assembly (including the commit-isolation preamble) happens in
   * the pipeline; this adapter only transports.
   */
  async generateResponse(prompt, options = {}) {
    const config = await this.getConfig();
    const model = options.model || config.model || 'qwen2.5-coder:latest';

    const systemPrompt =
      options.systemPrompt ||
      'You are an expert software developer who helps fix code issues and improve code quality.';
    const fullPrompt = `${systemPrompt}\n\n${prompt}`;

    return await this.withRetry(
      async () =>
        await this.circuitBreaker.execute(
          async () => {
            const response = await axios.post(
              `${this.baseURL}/api/generate`,
              {
                model,
                prompt: fullPrompt,
                stream: false,
                options: {
                  temperature: options.temperature || config.temperature || 0.3,
                  num_predict: options.maxTokens || 2000,
                },
              },
              {
                timeout: config.timeout || 60000, // Longer timeout for code fixing
              }
            );

            const content = response.data.response;
            if (!content) {
              throw new Error('No response content from Ollama');
            }

            return content.trim();
          },
          { provider: 'ollama' }
        )
    );
  }

  /**
   * Validate Ollama configuration
   */
  async validate(_config) {
    // Check if Ollama is running
    try {
      await axios.get(`${this.baseURL}/api/tags`, { timeout: 5000 });
      return true;
    } catch (error) {
      throw new Error('Ollama is not running. Please start Ollama service.');
    }
  }

}

module.exports = OllamaProvider;
