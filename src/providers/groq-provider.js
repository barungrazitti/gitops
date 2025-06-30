/**
 * Groq Provider - Fast inference models
 */

const Groq = require('groq-sdk');
const BaseProvider = require('./base-provider');

class GroqProvider extends BaseProvider {
  constructor() {
    super();
    this.name = 'groq';
    this.client = null;
  }

  /**
   * Initialize Groq client
   */
  async initializeClient() {
    if (this.client) return;

    const config = await this.getConfig();
    
    if (!config.apiKey) {
      throw new Error('Groq API key not configured. Run "aicommit setup" to configure.');
    }

    this.client = new Groq({
      apiKey: config.apiKey
    });
  }

  /**
   * Generate commit messages using Groq
   */
  async generateCommitMessages(diff, options = {}) {
    await this.initializeClient();
    const config = await this.getConfig();

    const prompt = this.buildPrompt(diff, options);

    return await this.withRetry(async () => {
      try {
        const response = await this.client.chat.completions.create({
          model: config.model || 'mixtral-8x7b-32768',
          messages: [
            {
              role: 'system',
              content: 'You are an expert software developer who writes clear, concise commit messages.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: config.maxTokens || 150,
          temperature: config.temperature || 0.7
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response content from Groq');
        }

        const messages = this.parseResponse(content);
        return messages.filter(msg => this.validateCommitMessage(msg));

      } catch (error) {
        this.handleError(error, 'Groq');
      }
    }, config.retries || 3);
  }

  /**
   * Validate Groq configuration
   */
  async validate(config) {
    if (!config.apiKey) {
      throw new Error('Groq API key is required');
    }

    return true;
  }

  /**
   * Test Groq connection
   */
  async test(config) {
    try {
      const client = new Groq({
        apiKey: config.apiKey
      });

      const response = await client.chat.completions.create({
        model: config.model || 'mixtral-8x7b-32768',
        messages: [
          {
            role: 'user',
            content: 'Say "test successful" if you can read this.'
          }
        ],
        max_tokens: 10,
        temperature: 0
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from Groq');
      }

      return {
        success: true,
        message: 'Groq connection successful',
        model: config.model || 'mixtral-8x7b-32768',
        response: content.trim()
      };

    } catch (error) {
      return {
        success: false,
        message: `Groq connection failed: ${error.message}`,
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
        id: 'mixtral-8x7b-32768', 
        name: 'Mixtral 8x7B', 
        description: 'High-performance mixture of experts model' 
      },
      { 
        id: 'llama2-70b-4096', 
        name: 'Llama 2 70B', 
        description: 'Large language model by Meta' 
      },
      { 
        id: 'gemma-7b-it', 
        name: 'Gemma 7B IT', 
        description: 'Instruction-tuned model by Google' 
      }
    ];
  }
}

module.exports = GroqProvider;