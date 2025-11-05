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
    try {
      await this.initializeClient();
      const config = await this.getConfig();

      // Groq has strict TPM limits, so we need to be more aggressive with chunking
      const maxTokens = 4000; // Leave room for system message and response
      const prompt = this.buildPrompt(diff, options);

      // Check if we need to chunk the diff
      const estimatedTokens = this.estimateTokens(prompt);
      if (estimatedTokens > maxTokens) {
        return await this.generateFromChunks(diff, options, maxTokens);
      }

      return await this.withRetry(async () => {
        try {
          const response = await this.client.chat.completions.create({
            model: options.model || config.model || 'llama-3.1-8b-instant',
            messages: [
              {
                role: 'system',
                content: 'You are an expert software developer who writes clear, concise commit messages. IMPORTANT: Only analyze the provided diff, do not reference any previous commits or external context.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            max_tokens: config.maxTokens || 150,
            temperature: config.temperature || 0.3,
          });

          const content = response.choices[0]?.message?.content;
          if (!content) {
            throw new Error('No response content from Groq');
          }

          const messages = this.parseResponse(content);
          return messages.filter((msg) => this.validateCommitMessage(msg));
        } catch (error) {
          // Handle rate limiting specifically
          if (
            error.status === 413 ||
            error.error?.code === 'rate_limit_exceeded'
          ) {
            // If we hit rate limits, try with smaller chunks
            console.warn('Groq rate limit hit, trying with smaller chunks...');
            return await this.generateFromChunks(
              diff,
              options,
              Math.max(2000, 100)
            );
          }
          throw this.handleError(error, 'Groq');
        }
      }, config.retries || 3);
    } catch (error) {
      throw this.handleError(error, 'Groq');
    }
  }

  /**
   * Generate commit messages from chunked diff
   */
  async generateFromChunks(diff, options, maxTokens) {
    const chunks = this.chunkDiff(diff, maxTokens);
    const chunkMessages = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isLastChunk = i === chunks.length - 1;

      try {
        const chunkPrompt = this.buildPrompt(chunk, {
          ...options,
          chunkIndex: i,
          totalChunks: chunks.length,
          isLastChunk,
          chunkContext: `Processing chunk ${i + 1} of ${chunks.length}`,
        });

        const messages = await this.withRetry(
          async () => {
            const response = await this.client.chat.completions.create({
              model:
                options.model ||
                (await this.getConfig()).model ||
                'llama-3.1-8b-instant',
              messages: [
                {
                  role: 'system',
                  content: isLastChunk
                    ? 'You are an expert software developer who writes clear, concise commit messages. This is the final chunk of changes. IMPORTANT: Only analyze this chunk, do not reference any previous commits or external context.'
                    : 'You are an expert software developer who writes clear, concise commit messages. This is part of a larger diff. IMPORTANT: Only analyze this chunk, do not reference any previous commits or external context.',
                },
                {
                  role: 'user',
                  content: chunkPrompt,
                },
              ],
              max_tokens: (await this.getConfig()).maxTokens || 150,
              temperature: (await this.getConfig()).temperature || 0.3,
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
              throw new Error('No response content from Groq');
            }

            return this.parseResponse(content);
          },
          (await this.getConfig()).retries || 3
        );

        chunkMessages.push(...messages);
      } catch (error) {
        // If chunk fails, try with even smaller size
        if (
          error.status === 413 ||
          error.error?.code === 'rate_limit_exceeded'
        ) {
          console.warn(
            `Chunk ${i + 1} still too large, retrying with smaller size...`
          );

          // Prevent infinite chunking by setting minimum chunk size
          const newMaxTokens = Math.max(Math.floor(maxTokens / 2), 100);
          if (newMaxTokens === maxTokens) {
            console.warn('Minimum chunk size reached, skipping chunk');
            continue;
          }

          const smallerChunks = this.chunkDiff(chunk, newMaxTokens);
          for (const smallerChunk of smallerChunks) {
            try {
              const smallerMessages = await this.generateDirectCommitMessages(
                smallerChunk,
                options
              );
              chunkMessages.push(...smallerMessages);
            } catch (smallerError) {
              console.warn('Even smaller chunk failed:', smallerError.message);
            }
          }
        } else {
          console.warn(`Chunk ${i + 1} failed:`, error.message);
        }
      }
    }

    // Deduplicate and filter messages
    const uniqueMessages = [...new Set(chunkMessages)];
    return uniqueMessages.filter((msg) => this.validateCommitMessage(msg));
  }

  /**
   * Generate commit messages directly without chunking (for recursive calls)
   */
  async generateDirectCommitMessages(diff, options = {}) {
    try {
      await this.initializeClient();
      const config = await this.getConfig();

      const prompt = this.buildPrompt(diff, options);

      return await Promise.race([
        this.withRetry(async () => {
          try {
            const response = await this.client.chat.completions.create({
              model: options.model || config.model || 'llama-3.1-8b-instant',
              messages: [
                {
                  role: 'system',
                  content: 'You are an expert software developer who writes clear, concise commit messages. IMPORTANT: Only analyze the provided diff, do not reference any previous commits or external context.',
                },
                {
                  role: 'user',
                  content: prompt,
                },
              ],
              max_tokens: config.maxTokens || 150,
              temperature: config.temperature || 0.3,
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
              throw new Error('No response content from Groq');
            }

            const messages = this.parseResponse(content);
            return messages.filter((msg) => this.validateCommitMessage(msg));
          } catch (error) {
            // Handle rate limiting specifically
            if (
              error.status === 413 ||
              error.error?.code === 'rate_limit_exceeded'
            ) {
              // If we hit rate limits, try with smaller chunks
              console.warn(
                'Groq rate limit hit, trying with smaller chunks...'
              );
              return await this.generateFromChunks(
                diff,
                options,
                Math.max(2000, 100)
              );
            }
            throw this.handleError(error, 'Groq');
          }
        }, config.retries || 3),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('AI generation timeout')),
            options.timeout || config.timeout || 60000
          )
        ),
      ]);
    } catch (error) {
      throw this.handleError(error, 'Groq');
    }
  }

  /**
   * Estimate token usage for Groq
   */
  estimateTokens(text) {
    // Rough estimation: 1 token ≈ 4 characters for English text
    // Be more conservative for Groq due to strict limits
    return Math.ceil(text.length / 3.5);
  }

  /**
   * Chunk diff into smaller pieces
   */
  chunkDiff(diff, maxTokens) {
    // Prevent infinite chunking with minimum size
    if (maxTokens < 50) {
      return [diff.substring(0, 500)]; // Return a small safe chunk
    }

    const lines = diff.split('\n');
    const chunks = [];
    let currentChunk = [];
    let currentTokens = 0;

    for (const line of lines) {
      const lineTokens = this.estimateTokens(line);

      // If single line is too large, split it
      if (lineTokens > maxTokens) {
        // Flush current chunk if it has content
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join('\n'));
          currentChunk = [];
          currentTokens = 0;
        }

        // Split the large line into smaller pieces
        const chunksNeeded = Math.ceil(lineTokens / maxTokens);
        const chunkSize = Math.ceil(line.length / chunksNeeded);

        for (let i = 0; i < chunksNeeded; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, line.length);
          chunks.push(line.substring(start, end));
        }
      } else if (currentTokens + lineTokens > maxTokens) {
        // Flush current chunk
        chunks.push(currentChunk.join('\n'));
        currentChunk = [line];
        currentTokens = lineTokens;
      } else {
        // Add to current chunk
        currentChunk.push(line);
        currentTokens += lineTokens;
      }
    }

    // Flush final chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks;
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
      const response = await this.client.chat.completions.create({
        model: config.model || 'llama3-8b-8192',
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
        apiKey: config.apiKey,
      });

      const response = await client.chat.completions.create({
        model: config.model || 'mixtral-8x7b-32768',
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
        model: config.model || 'mixtral-8x7b-32768',
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
        id: 'mixtral-8x7b-32768',
        name: 'Mixtral 8x7B',
        description: 'High-performance mixture of experts model',
      },
      {
        id: 'llama2-70b-4096',
        name: 'Llama 2 70B',
        description: 'Large language model by Meta',
      },
      {
        id: 'gemma-7b-it',
        name: 'Gemma 7B IT',
        description: 'Instruction-tuned model by Google',
      },
    ];
  }
}

module.exports = GroqProvider;
