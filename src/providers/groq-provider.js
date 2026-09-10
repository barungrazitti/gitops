/**
 * Groq Provider - Fast inference models
 */

const BaseProvider = require('./base-provider');
const CircuitBreaker = require('../core/circuit-breaker');

let Groq = null;

class GroqProvider extends BaseProvider {
  constructor(deps = {}) {
    super(deps);
    this.name = 'groq';
    this.model = 'openai/gpt-oss-20b';
    this.client = null;

    // Initialize circuit breaker for Groq
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      timeout: 60000, // 1 minute for cloud API
      monitoringPeriod: 15000, // 15 seconds
    });
  }

  /**
   * Initialize Groq client
   */
  async initializeClient() {
    if (this.client) return;

    if (!Groq) {
      Groq = require('groq-sdk');
    }

    const config = await this.getConfig();

    if (!config.apiKey) {
      throw new Error('Groq API key not configured. Run "aic setup" to configure.');
    }

    this.client = new Groq({
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: false,
    });
  }

  /**
   * Generate AI response for a prompt (text in → text out).
   * Prompt assembly happens in the pipeline; this adapter only transports.
   */
  async generateResponse(prompt, options = {}) {
    try {
      await this.initializeClient();
      const config = await this.getConfig();
      const model = options.model || config.model || 'openai/gpt-oss-20b';

      // Reasoning models (gpt-oss) spend tokens on internal reasoning
      // before emitting content - a low max_tokens yields an empty
      // message.content ("No message content in Groq response").
      const isReasoningModel = model.includes('gpt-oss');
      const maxTokens = isReasoningModel
        ? Math.max(options.maxTokens || 0, 2000)
        : options.maxTokens || config.maxTokens || 2000;

      const systemPrompt =
        options.systemPrompt ||
        'You are an expert software developer who helps fix code issues and improve code quality.';

      // Groq free tier: 6000 TPM; reserve tokens for output and prompt overhead.
      // DiffShaper owns the diff budget and should keep input well under this limit.
      const maxInputTokens = 4500;
      const estimatedTokens = this.estimateTokens(`${systemPrompt}\n\n${prompt}`);
      if (estimatedTokens > maxInputTokens) {
        throw new Error(
          `Prompt too large for Groq (~${estimatedTokens} tokens > ${maxInputTokens} limit). ` +
            'Stage fewer files, or lower categorization thresholds via "aic config --set categorization.small.tokens=100".'
        );
      }
      const finalPrompt = prompt;

      return await this.withRetry(
        async () =>
          await this.circuitBreaker.execute(
            async () => {
              const response = await this.client.chat.completions.create({
                model,
                messages: [
                  {
                    role: 'system',
                    content: systemPrompt,
                  },
                  {
                    role: 'user',
                    content: finalPrompt,
                  },
                ],
                max_tokens: maxTokens,
                temperature: options.temperature || config.temperature || 0.3,
                n: 1,
              });

              const content = response.choices[0]?.message?.content;
              if (!content) {
                throw new Error('No response content from Groq');
              }

              return content.trim();
            },
            { provider: 'groq' }
          )
      );
    } catch (error) {
      throw this.handleError(error, 'Groq');
    }
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
   * Estimate token count for TPM-limit guard
   */
  estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }
}

module.exports = GroqProvider;