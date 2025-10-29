/**
 * Ollama Provider - Local AI models integration
 */

const axios = require('axios');
const BaseProvider = require('./base-provider');

class OllamaProvider extends BaseProvider {
  constructor() {
    super();
    this.name = 'ollama';
    this.baseURL = 'http://localhost:11434';
  }

  /**
   * Generate commit messages using Ollama
   */
  async generateCommitMessages(diff, options = {}) {
    const config = await this.getConfig();
    const model = options.model || config.model || 'deepseek-v3.1:671b-cloud';

    const prompt = this.buildPrompt(diff, options);

    return await this.withRetry(async () => {
      try {
        const response = await axios.post(
          `${this.baseURL}/api/generate`,
          {
            model: model,
            prompt: prompt,
            stream: false,
            options: {
              temperature: config.temperature || 0.7,
              num_predict: config.maxTokens || 150,
            },
          },
          {
            timeout: config.timeout || 30000, // Reduced timeout for faster failure
          }
        );

        const content = response.data.response;
        if (!content) {
          throw new Error('No response content from Ollama');
        }

        const messages = this.parseResponse(content);
        return messages.filter((msg) => this.validateCommitMessage(msg));
      } catch (error) {
        throw this.handleError(error, 'Ollama');
      }
    }, config.retries || 3);
  }

  /**
   * Generate AI response for general prompts
   */
  async generateResponse(prompt, options = {}) {
    const config = await this.getConfig();
    const model = options.model || config.model || 'deepseek-v3.1:671b-cloud';

    const fullPrompt = `You are an expert software developer who helps fix code issues and improve code quality.\n\n${prompt}`;

    return await this.withRetry(async () => {
      try {
        const response = await axios.post(
          `${this.baseURL}/api/generate`,
          {
            model: model,
            prompt: fullPrompt,
            stream: false,
            options: {
              temperature: options.temperature || 0.3,
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

        return [content.trim()];
      } catch (error) {
        throw this.handleError(error, 'Ollama');
      }
    }, config.retries || 3);
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

      if (!availableModels.some((m) => m.name === model)) {
        return {
          success: false,
          message: `Model "${model}" not found. Available models: ${availableModels.map((m) => m.name).join(', ')}`,
          availableModels: availableModels.map((m) => m.name),
        };
      }

      // Test with a simple request
      const response = await axios.post(
        `${this.baseURL}/api/generate`,
        {
          model: model,
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
        model: model,
        response: content.trim(),
        availableModels: availableModels.map((m) => m.name),
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

  /**
   * Get available models from Ollama
   */
  async getAvailableModels() {
    try {
      const response = await axios.get(`${this.baseURL}/api/tags`, {
        timeout: 5000,
      });
      const models = response.data.models || [];

      return models.map((model) => ({
        id: model.name,
        name: model.name,
        description: this.getModelDescription(model.name),
        size: model.size,
        modified: model.modified_at,
        available: true,
        recommended: model.name.includes('deepseek-v3.1'),
      }));
    } catch (error) {
      // Return your specific models if API call fails
      return [
        {
          id: 'deepseek-v3.1:671b-cloud',
          name: 'DeepSeek V3.1 (671B)',
          description:
            'Large language model with advanced reasoning capabilities',
          available: true,
          recommended: true,
        },
        {
          id: 'qwen3-coder:480b-cloud',
          name: 'Qwen3 Coder (480B)',
          description:
            'Code-specialized model with excellent programming skills',
          available: true,
          recommended: false,
        },
        {
          id: 'qwen2.5-coder:latest',
          name: 'Qwen2.5 Coder (7.6B)',
          description: 'Efficient code generation model',
          available: true,
          recommended: false,
        },
        {
          id: 'mistral:7b-instruct',
          name: 'Mistral 7B Instruct',
          description: 'Instruction-tuned model for general tasks',
          available: true,
          recommended: false,
        },
        {
          id: 'deepseek-r1:8b',
          name: 'DeepSeek R1 (8B)',
          description: 'Reasoning-optimized model',
          available: true,
          recommended: false,
        },
      ];
    }
  }

  /**
   * Get model description based on model name
   */
  getModelDescription(modelName) {
    const descriptions = {
      'deepseek-v3.1:671b-cloud':
        'Large language model with advanced reasoning capabilities (671B parameters)',
      'qwen3-coder:480b-cloud':
        'Code-specialized model with excellent programming skills (480B parameters)',
      'qwen2.5-coder:latest':
        'Efficient code generation model (7.6B parameters)',
      'mistral:7b-instruct':
        'Instruction-tuned model for general tasks (7.2B parameters)',
      'deepseek-r1:8b': 'Reasoning-optimized model (8.2B parameters)',
    };
    return descriptions[modelName] || `AI model: ${modelName}`;
  }

  /**
   * Format file size
   */
  formatSize(bytes) {
    if (!bytes) return 'Unknown';

    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(modelName) {
    try {
      await axios.post(
        `${this.baseURL}/api/pull`,
        {
          name: modelName,
        },
        {
          timeout: 300000, // 5 minutes for model download
        }
      );

      return {
        success: true,
        message: `Model "${modelName}" pulled successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to pull model "${modelName}": ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Handle Ollama-specific errors
   */
  handleError(error, providerName) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error(
        'Ollama service is not running. Please start Ollama with "ollama serve".'
      );
    }

    if (error.response && error.response.status === 404) {
      throw new Error(
        'Model not found. Please pull the model first with "ollama pull <model-name>".'
      );
    }

    super.handleError(error, providerName);
  }
}

module.exports = OllamaProvider;
