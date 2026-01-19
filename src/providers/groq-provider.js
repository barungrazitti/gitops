/**
 * Groq Provider - Fast inference models
 */

const Groq = require('groq-sdk');
const BaseProvider = require('./base-provider');
const CircuitBreaker = require('../core/circuit-breaker');

class GroqProvider extends BaseProvider {
  constructor() {
    super();
    this.name = 'groq';
    this.client = null;
    
    // Initialize circuit breaker for Groq
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      timeout: 60000, // 1 minute for cloud API
      monitoringPeriod: 15000 // 15 seconds
    });
  }

  /**
   * Initialize Groq client
   */
  async initializeClient() {
    if (this.client) return;

    const config = await this.getConfig();

    if (!config.apiKey) {
      throw new Error(
        'Groq API key not configured. Run "aicommit setup" to configure.'
      );
    }

    this.client = new Groq({
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: false,
    });
  }

  /**
   * Generate commit messages using Groq
   */
  async generateCommitMessages(diff, options = {}) {
    await this.initializeClient();
    const config = await this.getConfig();

    // Send full diff without chunking for fast processing
    const prompt = this.buildPrompt(diff, options);

    return await this.withRetry(async () => {
      return await this.circuitBreaker.execute(async () => {
        const response = await this.client.chat.completions.create({
          model: options.model || config.model || 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: 'You are an expert software developer who writes clear, concise commit messages. CRITICAL: Output ONLY commit messages. Never include instructions, warnings, or deployment advice. Only analyze the provided diff, do not reference any previous commits or external context.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: config.maxTokens || 150,
          temperature: config.temperature || 0.3,
        });

        const messages = this.parseResponse(response);
        return messages.filter((msg) => this.validateMessage(msg));
      }, { provider: 'groq' });
    });
  }

  /**
   * Simple validation for commit messages
   */
  validateMessage(message) {
    if (!message || typeof message !== 'string') return false;
    const trimmed = message.trim();
    return trimmed.length >= 10 && trimmed.length <= 200;
  }

  /**
   * Generate AI response for general prompts
   */
  async generateResponse(prompt, options = {}) {
    try {
      await this.initializeClient();
      const config = await this.getConfig();

      const maxTokens = options.maxTokens || 2000;
      const fullPrompt = `You are an expert software developer who helps fix code issues and improve code quality.\n\n${prompt}`;

      // Check if we need to chunk the prompt
      const estimatedTokens = this.estimateTokens(fullPrompt);
      if (estimatedTokens > maxTokens) {
        // For code fixing, we'll try to fit in one request by truncating if needed
        const truncatedPrompt = fullPrompt.substring(0, maxTokens * 3); // Rough estimate
        return await this.generateSingleResponse(
          truncatedPrompt,
          options,
          config
        );
      } else {
        return await this.generateSingleResponse(fullPrompt, options, config);
      }
    } catch (error) {
      throw this.handleError(error, 'Groq');
    }
  }

  /**
   * Generate single response
   */
  async generateSingleResponse(prompt, options, config) {
    return await this.withRetry(async () => {
      return await this.circuitBreaker.execute(async () => {
        const response = await this.client.chat.completions.create({
          model: config.model || 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content:
                'You are an expert software developer who helps fix code issues and improve code quality.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: options.maxTokens || 2000,
          temperature: options.temperature || 0.3,
          n: 1,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response content from Groq');
        }

        return [content.trim()];
      }, { provider: 'groq' });
    });
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
        apiKey: config.apiKey,
      });

      const response = await client.chat.completions.create({
        model: config.model || 'llama-3.1-8b-instant',
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
        throw new Error('No response from Groq');
      }

      return {
        success: true,
        message: 'Groq connection successful',
        model: config.model || 'llama-3.1-8b-instant',
        response: content.trim(),
      };
    } catch (error) {
      return {
        success: false,
        message: `Groq connection failed: ${error.message}`,
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
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B Instant',
        description: 'Fast and efficient model by Meta (recommended)',
      },
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B Versatile',
        description: 'High-performance model by Meta for complex tasks',
      },
      {
        id: 'openai/gpt-oss-120b',
        name: 'GPT-OSS 120B',
        description: 'OpenAI\'s flagship open-weight model with reasoning',
      },
      {
        id: 'qwen/qwen3-32b',
        name: 'Qwen 3 32B',
        description: 'High-performance model by Alibaba Cloud',
      },
    ];
  }

  /**
   * Build the request object for Groq API
   */
  buildRequest(prompt, options = {}, config = {}) {
    return {
      model: options.model || config.model || this.model,
      messages: [
        {
          role: 'system',
          content: options.systemPrompt || 'You are an expert software developer who helps generate concise, meaningful commit messages.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: options.temperature ?? config.temperature ?? this.temperature,
      max_tokens: options.maxTokens ?? config.maxTokens ?? this.maxTokens,
      timeout: options.timeout ?? config.timeout ?? this.timeout,
    };
  }

  /**
   * Parse the response from Groq API
   */
  parseResponse(response) {
    if (!response || !response.choices || !Array.isArray(response.choices)) {
      throw new Error('Invalid response format from Groq API');
    }

    if (response.choices.length === 0) {
      throw new Error('No choices returned from Groq API');
    }

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No message content in Groq response');
    }

    // Split content by newlines and clean up
    const messages = content
      .split('\n')
      .map(msg => msg.trim())
      .filter(msg => msg.length > 0);

    return messages;
  }

  /**
   * Make direct API request to Groq
   */
  async makeDirectAPIRequest(endpoint, params = {}) {
    try {
      const config = await this.getConfig();
      const response = await this.sendHTTPRequest(
        `${this.baseURL}${endpoint}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
          },
          ...params
        }
      );
      return response;
    } catch (error) {
      throw new Error(`Groq direct API request failed: ${error.message}`);
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.client = null;
  }
}

module.exports = GroqProvider;
