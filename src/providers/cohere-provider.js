/**
 * Cohere Provider
 */

const { CohereClient } = require('cohere-ai');
const BaseProvider = require('./base-provider');

class CohereProvider extends BaseProvider {
  constructor() {
    super();
    this.name = 'cohere';
    this.client = null;
  }

  /**
   * Initialize Cohere client
   */
  async initializeClient() {
    if (this.client) return;

    const config = await this.getConfig();
    
    if (!config.apiKey) {
      throw new Error('Cohere API key not configured. Run "aicommit setup" to configure.');
    }

    this.client = new CohereClient({
      token: config.apiKey
    });
  }

  /**
   * Generate commit messages using Cohere
   */
  async generateCommitMessages(diff, options = {}) {
    await this.initializeClient();
    const config = await this.getConfig();

    const prompt = this.buildPrompt(diff, options);

    return await this.withRetry(async () => {
      try {
        const response = await this.client.generate({
          model: config.model || 'command',
          prompt: prompt,
          max_tokens: config.maxTokens || 150,
          temperature: config.temperature || 0.7,
          stop_sequences: ['\n\n']
        });

        const content = response.generations[0]?.text;
        if (!content) {
          throw new Error('No response content from Cohere');
        }

        const messages = this.parseResponse(content);
        return messages.filter(msg => this.validateCommitMessage(msg));

      } catch (error) {
        this.handleError(error, 'Cohere');
      }
    }, config.retries || 3);
  }

  /**
   * Validate Cohere configuration
   */
  async validate(config) {
    if (!config.apiKey) {
      throw new Error('Cohere API key is required');
    }

    return true;
  }

  /**
   * Test Cohere connection
   */
  async test(config) {
    try {
      const client = new CohereClient({
        token: config.apiKey
      });

      const response = await client.generate({
        model: config.model || 'command',
        prompt: 'Say "test successful" if you can read this.',
        max_tokens: 10,
        temperature: 0
      });

      const content = response.generations[0]?.text;
      if (!content) {
        throw new Error('No response from Cohere');
      }

      return {
        success: true,
        message: 'Cohere connection successful',
        model: config.model || 'command',
        response: content.trim()
      };

    } catch (error) {
      return {
        success: false,
        message: `Cohere connection failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Get available models
   */
  async getAvailableModels() {
    return [
      { 
        id: 'command', 
        name: 'Command', 
        description: 'Most capable model for text generation' 
      },
      { 
        id: 'command-light', 
        name: 'Command Light', 
        description: 'Faster and more economical model' 
      },
      { 
        id: 'command-nightly', 
        name: 'Command Nightly', 
        description: 'Latest experimental features' 
      }
    ];
  }
}

module.exports = CohereProvider;