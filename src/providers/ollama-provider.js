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

  /**
   * Test Ollama connection
   */
  async test(config) {
    try {
      // Check if service is running
      const tagsResponse = await axios.get(`${this.baseURL}/api/tags`, {
        timeout: 5000,
      });

      const model = config.model || 'deepseek-v3.1:671b-cloud';
      const availableModels = tagsResponse.data.models || [];

      if (!availableModels.some(m => m.name === model)) {
        return {
          success: false,
          message: `Model "${model}" not found. Available models: ${availableModels.map(m => m.name).join(', ')}`,
          availableModels: availableModels.map(m => m.name),
        };
      }

      // Test with a simple request
      const response = await axios.post(
        `${this.baseURL}/api/generate`,
        {
          model,
          prompt: 'Say "test successful" if you can read this.',
          stream: false,
          options: {
            num_predict: 10,
          },
        },
        {
          timeout: 30000,
        }
      );

      const content = response.data.response;
      if (!content) {
        throw new Error('No response from Ollama');
      }

      return {
        success: true,
        message: 'Ollama connection successful',
        model,
        response: content.trim(),
        availableModels: availableModels.map(m => m.name),
      };
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          message: 'Ollama service is not running. Please start Ollama.',
          error: 'Connection refused',
        };
      }

      return {
        success: false,
        message: `Ollama connection failed: ${error.message}`,
        error: error.message,
      };
    }
  }

}

module.exports = OllamaProvider;
