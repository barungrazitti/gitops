/**
 * Google Gemini Provider
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const BaseProvider = require('./base-provider');

class GeminiProvider extends BaseProvider {
  constructor() {
    super();
    this.name = 'gemini';
    this.client = null;
  }

  /**
   * Initialize Gemini client
   */
  async initializeClient() {
    if (this.client) return;

    const config = await this.getConfig();

    if (!config.apiKey) {
      throw new Error(
        'Google Gemini API key not configured. Run "aicommit setup" to configure.'
      );
    }

    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  /**
   * Generate commit messages using Gemini
   */
  async generateCommitMessages(diff, options = {}) {
    await this.initializeClient();
    const config = await this.getConfig();

    const prompt = this.buildPrompt(diff, options);

    return await this.withRetry(async () => {
      try {
        const model = this.client.getGenerativeModel({
          model: config.model || 'gemini-pro',
        });

        const result = await model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            maxOutputTokens: config.maxTokens || 150,
            temperature: config.temperature || 0.7,
          },
        });

        const response = await result.response;
        const content = response.text();

        if (!content) {
          throw new Error('No response content from Gemini');
        }

        const messages = this.parseResponse(content);
        return messages.filter((msg) => this.validateCommitMessage(msg));
      } catch (error) {
        throw this.handleError(error, 'Gemini');
      }
    }, config.retries || 3);
  }

  /**
   * Validate Gemini configuration
   */
  async validate(config) {
    if (!config.apiKey) {
      throw new Error('Google Gemini API key is required');
    }

    return true;
  }

  /**
   * Test Gemini connection
   */
  async test(config) {
    try {
      const client = new GoogleGenerativeAI(config.apiKey);
      const model = client.getGenerativeModel({
        model: config.model || 'gemini-pro',
      });

      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Say "test successful" if you can read this.' }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 10,
          temperature: 0,
        },
      });

      const response = await result.response;
      const content = response.text();

      if (!content) {
        throw new Error('No response from Gemini');
      }

      return {
        success: true,
        message: 'Gemini connection successful',
        model: config.model || 'gemini-pro',
        response: content.trim(),
      };
    } catch (error) {
      return {
        success: false,
        message: `Gemini connection failed: ${error.message}`,
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
        id: 'gemini-pro',
        name: 'Gemini Pro',
        description: 'Most capable model for text generation',
      },
      {
        id: 'gemini-pro-vision',
        name: 'Gemini Pro Vision',
        description: 'Multimodal model with vision capabilities',
      },
    ];
  }
}

module.exports = GeminiProvider;
