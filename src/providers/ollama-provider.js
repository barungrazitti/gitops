/**
 * Ollama Provider - Local AI models integration
 */

const axios = require("axios");
const BaseProvider = require("./base-provider");

class OllamaProvider extends BaseProvider {
  constructor() {
    super();
    this.name = "ollama";
    this.baseURL = "http://localhost:11434";
  }

  /**
   * Generate commit messages using Ollama
   */
  async generateCommitMessages(diff, options = {}) {
    const config = await this.getConfig();
    const model = config.model || "qwen2.5-coder:latest";

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
            timeout: config.timeout || 60000, // Ollama can be slower
          },
        );

        const content = response.data.response;
        if (!content) {
          throw new Error("No response content from Ollama");
        }

        const messages = this.parseResponse(content);
        return messages.filter((msg) => this.validateCommitMessage(msg));
      } catch (error) {
        this.handleError(error, "Ollama");
      }
    }, config.retries || 3);
  }

  /**
   * Validate Ollama configuration
   */
  async validate(config) {
    // Check if Ollama is running
    try {
      await axios.get(`${this.baseURL}/api/tags`, { timeout: 5000 });
      return true;
    } catch (error) {
      throw new Error("Ollama is not running. Please start Ollama service.");
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

      const model = config.model || "mistral:7b-instruct";
      const availableModels = tagsResponse.data.models || [];

      if (!availableModels.some((m) => m.name.includes(model))) {
        return {
          success: false,
          message: `Model "${model}" not found. Available models: ${availableModels.map((m) => m.name).join(", ")}`,
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
        },
      );

      const content = response.data.response;
      if (!content) {
        throw new Error("No response from Ollama");
      }

      return {
        success: true,
        message: "Ollama connection successful",
        model: model,
        response: content.trim(),
        availableModels: availableModels.map((m) => m.name),
      };
    } catch (error) {
      if (error.code === "ECONNREFUSED") {
        return {
          success: false,
          message: "Ollama service is not running. Please start Ollama.",
          error: "Connection refused",
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
        description: `Size: ${this.formatSize(model.size)}`,
        size: model.size,
        modified: model.modified_at,
      }));
    } catch (error) {
      // Return common models if API call fails
      return [
        { id: "llama2", name: "Llama 2", description: "Meta's Llama 2 model" },
        {
          id: "codellama",
          name: "Code Llama",
          description: "Code-specialized Llama model",
        },
        { id: "mistral", name: "Mistral", description: "Mistral 7B model" },
        {
          id: "neural-chat",
          name: "Neural Chat",
          description: "Intel's neural chat model",
        },
      ];
    }
  }

  /**
   * Format file size
   */
  formatSize(bytes) {
    if (!bytes) return "Unknown";

    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(modelName) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/pull`,
        {
          name: modelName,
        },
        {
          timeout: 300000, // 5 minutes for model download
        },
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
    if (error.code === "ECONNREFUSED") {
      throw new Error(
        'Ollama service is not running. Please start Ollama with "ollama serve".',
      );
    }

    if (error.response && error.response.status === 404) {
      throw new Error(
        'Model not found. Please pull the model first with "ollama pull <model-name>".',
      );
    }

    super.handleError(error, providerName);
  }
}

module.exports = OllamaProvider;
