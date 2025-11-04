/**
 * Anthropic Provider - Claude integration
 */

const Anthropic = require('@anthropic-ai/sdk');
const BaseProvider = require('./base-provider');

class AnthropicProvider extends BaseProvider {
  constructor() {
    super();
    this.name = 'anthropic';
    this.client = null;
    this.cachedModels = null;
    this.modelsCacheTime = null;
  }

  /**
   * Initialize Anthropic client
   */
  async initializeClient() {
    if (this.client) return;

    const config = await this.getConfig();

    if (!config.apiKey) {
      throw new Error(
        'Anthropic API key not configured. Run "aicommit setup" to configure.'
      );
    }

    this.client = new Anthropic({
      apiKey: config.apiKey,
      timeout: config.timeout || 30000,
      maxRetries: config.retries || 3,
    });
  }

  /**
   * Generate commit messages using Claude
   */
  async generateCommitMessages(diff, options = {}) {
    await this.initializeClient();
    const config = await this.getConfig();

    // Auto-select best available model if not specified
    if (!config.model) {
      const bestModel = await this.getBestAvailableModel();
      config.model = bestModel?.id || 'claude-3-haiku-20240307';
      console.log(`Auto-selected model: ${config.model}`);
    }

    const prompt = this.buildPrompt(diff, options);

    return await this.withRetry(async () => {
      try {
        const response = await this.client.messages.create({
          model: config.model,
          max_tokens: config.maxTokens || 150,
          temperature: config.temperature || 0.7,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        const content = response.content[0]?.text;
        if (!content) {
          throw new Error('No response content from Anthropic');
        }

        const messages = this.parseResponse(content);
        return messages.filter((msg) => this.validateCommitMessage(msg));
      } catch (error) {
        throw this.handleError(error, 'Anthropic');
      }
    }, config.retries || 3);
  }

  /**
   * Generate AI response for general prompts
   */
  async generateResponse(prompt, options = {}) {
    await this.initializeClient();
    const config = await this.getConfig();

    // Auto-select best available model if not specified
    if (!config.model) {
      const bestModel = await this.getBestAvailableModel();
      config.model = bestModel?.id || 'claude-3-haiku-20240307';
    }

    try {
      const response = await this.withRetry(async () => {
        return this.client.messages.create({
          model: config.model,
          max_tokens: options.maxTokens || 2000,
          temperature: options.temperature || 0.3,
          messages: [
            {
              role: 'user',
              content: `You are an expert software developer who helps fix code issues and improve code quality.\n\n${prompt}`,
            },
          ],
        });
      }, config.retries || 3);

      const content = response.content[0]?.text;
      if (!content) {
        throw new Error('No response content from Anthropic');
      }

      return [content.trim()];
    } catch (error) {
      throw this.handleError(error, 'Anthropic');
    }
  }

  /**
   * Validate Anthropic configuration
   */
  async validate(config) {
    if (!config.apiKey) {
      throw new Error('Anthropic API key is required');
    }

    // Validate API key format
    if (!config.apiKey.startsWith('sk-ant-')) {
      throw new Error('Invalid Anthropic API key format');
    }

    return true;
  }

  /**
   * Test Anthropic connection
   */
  async test(config) {
    try {
      const client = new Anthropic({
        apiKey: config.apiKey,
        timeout: 10000,
      });

      // Test with a simple request
      const response = await client.messages.create({
        model: config.model || 'claude-3-sonnet-20240229',
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Say "test successful" if you can read this.',
          },
        ],
      });

      const content = response.content[0]?.text;
      if (!content) {
        throw new Error('No response from Anthropic');
      }

      return {
        success: true,
        message: 'Anthropic connection successful',
        model: config.model || 'claude-3-sonnet-20240229',
        response: content.trim(),
      };
    } catch (error) {
      return {
        success: false,
        message: `Anthropic connection failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Get available models (with caching and dynamic detection)
   */
  async getAvailableModels(forceRefresh = false) {
    // Check cache first
    if (
      !forceRefresh &&
      this.cachedModels &&
      this.modelsCacheTime &&
      Date.now() - this.modelsCacheTime < 3600000
    ) {
      // 1 hour cache
      return this.cachedModels;
    }

    try {
      console.log('Checking available Anthropic models...');

      // Anthropic doesn't have a models API endpoint, so we test known models
      const knownModels = [
        {
          id: 'claude-3-haiku-20240307',
          name: 'Claude 3 Haiku',
          description: 'Fastest and most compact model',
          recommended: true,
          contextLength: 200000,
          costTier: 'low',
        },
        {
          id: 'claude-3-sonnet-20240229',
          name: 'Claude 3 Sonnet',
          description: 'Balanced performance and speed',
          recommended: false,
          contextLength: 200000,
          costTier: 'medium',
        },
        {
          id: 'claude-3-opus-20240229',
          name: 'Claude 3 Opus',
          description: 'Most powerful model for complex tasks',
          recommended: false,
          contextLength: 200000,
          costTier: 'high',
        },
        {
          id: 'claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          description: 'Latest and most capable model',
          recommended: true,
          contextLength: 200000,
          costTier: 'medium',
        },
      ];

      // Test model availability by making a small request
      const availableModels = [];

      for (const model of knownModels) {
        try {
          const isAvailable = await this.testModelAvailability(model.id);
          if (isAvailable) {
            availableModels.push({
              ...model,
              available: true,
            });
          }
        } catch (error) {
          console.warn(`Model ${model.id} not available: ${error.message}`);
          availableModels.push({
            ...model,
            available: false,
          });
        }
      }

      // Cache results
      this.cachedModels = availableModels;
      this.modelsCacheTime = Date.now();

      const availableCount = availableModels.filter((m) => m.available).length;
      console.log(`Found ${availableCount} available Anthropic models`);

      return availableModels;
    } catch (error) {
      console.warn(`Failed to check Anthropic models: ${error.message}`);

      // Return default models if check fails
      const defaultModels = [
        {
          id: 'claude-3-haiku-20240307',
          name: 'Claude 3 Haiku',
          description: 'Fastest and most compact model',
          available: true,
          recommended: true,
          contextLength: 200000,
          costTier: 'low',
        },
        {
          id: 'claude-3-sonnet-20240229',
          name: 'Claude 3 Sonnet',
          description: 'Balanced performance and speed',
          available: true,
          recommended: false,
          contextLength: 200000,
          costTier: 'medium',
        },
      ];

      this.cachedModels = defaultModels;
      this.modelsCacheTime = Date.now();
      return defaultModels;
    }
  }

  /**
   * Test if a specific model is available
   */
  async testModelAvailability(modelId) {
    if (!this.client) {
      await this.initializeClient();
    }

    try {
      const response = await this.client.messages.create({
        model: modelId,
        max_tokens: 5,
        messages: [
          {
            role: 'user',
            content: 'Hi',
          },
        ],
      });

      return response && response.content && response.content.length > 0;
    } catch (error) {
      // If error is about model not found, return false
      if (
        error.message.includes('model') ||
        error.message.includes('not found')
      ) {
        return false;
      }
      // For other errors (like rate limits), assume model is available
      return true;
    }
  }

  /**
   * Get best available model for commit messages
   */
  async getBestAvailableModel() {
    const models = await this.getAvailableModels();

    // Prefer available recommended models first
    const availableRecommended = models.filter(
      (m) => m.available && m.recommended
    );
    if (availableRecommended.length > 0) {
      return availableRecommended[0];
    }

    // Fall back to first available model
    const available = models.filter((m) => m.available);
    return (
      available[0] || { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
    );
  }
}

module.exports = AnthropicProvider;
