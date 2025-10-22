/**
 * Mistral AI Provider
 */

const MistralClient = require('@mistralai/mistralai');
const BaseProvider = require('./base-provider');

class MistralProvider extends BaseProvider {
  constructor() {
    super();
    this.name = 'mistral';
    this.client = null;
  }

  /**
   * Initialize Mistral client
   */
  async initializeClient() {
    if (this.client) return;

    const config = await this.getConfig();

    if (!config.apiKey) {
      throw new Error(
        'Mistral API key not configured. Run "aicommit setup" to configure.'
      );
    }

    this.client = new MistralClient(config.apiKey);
  }

  /**
   * Generate commit messages using Mistral
   */
  async generateCommitMessages(diff, options = {}) {
    await this.initializeClient();
    const config = await this.getConfig();

    const prompt = this.buildPrompt(diff, options);

    return await this.withRetry(async () => {
      try {
        const response = await this.client.chat({
          model: config.model || 'mistral-medium',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: config.maxTokens || 150,
          temperature: config.temperature || 0.7,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response content from Mistral');
        }

        const messages = this.parseResponse(content);
        return messages.filter((msg) => this.validateCommitMessage(msg));
      } catch (error) {
        this.handleError(error, 'Mistral');
      }
    }, config.retries || 3);
  }

  /**
   * Validate Mistral configuration
   */
  async validate(config) {
    if (!config.apiKey) {
      throw new Error('Mistral API key is required');
    }

    return true;
  }

  /**
   * Test Mistral connection
   */
  async test(config) {
    try {
      const client = new MistralClient(config.apiKey);

      const response = await client.chat({
        model: config.model || 'mistral-medium',
        messages: [
          {
            role: 'user',
            content: 'Say "test successful" if you can read this.',
          },
        ],
        max_tokens: 10,
        temperature: 0,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from Mistral');
      }

      return {
        success: true,
        message: 'Mistral connection successful',
        model: config.model || 'mistral-medium',
        response: content.trim(),
      };
    } catch (error) {
      return {
        success: false,
        message: `Mistral connection failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  /**
   * Get available models
   */
  async getAvailableModels() {
    return [
      {
        id: 'mistral-tiny',
        name: 'Mistral Tiny',
        description: 'Fastest and most economical model',
      },
      {
        id: 'mistral-small',
        name: 'Mistral Small',
        description: 'Balanced performance and cost',
      },
      {
        id: 'mistral-medium',
        name: 'Mistral Medium',
        description: 'Higher performance for complex tasks',
      },
      {
        id: 'mistral-large-latest',
        name: 'Mistral Large',
        description: 'Most capable model',
      },
    ];
  }
}

module.exports = MistralProvider;
