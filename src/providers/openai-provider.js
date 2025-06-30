/**
 * OpenAI Provider - GPT-3.5 and GPT-4 integration with dynamic model fetching
 */

const OpenAI = require('openai');
const BaseProvider = require('./base-provider');

class OpenAIProvider extends BaseProvider {
  constructor() {
    super();
    this.name = 'openai';
    this.client = null;
    this.cachedModels = null;
    this.modelsCacheTime = null;
  }

  /**
   * Initialize OpenAI client
   */
  async initializeClient() {
    if (this.client) return;

    const config = await this.getConfig();
    
    if (!config.apiKey) {
      throw new Error('OpenAI API key not configured. Run "aicommit setup" to configure.');
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.timeout || 30000,
      maxRetries: config.retries || 3
    });
  }

  /**
   * Generate commit messages using OpenAI
   */
  async generateCommitMessages(diff, options = {}) {
    await this.initializeClient();
    const config = await this.getConfig();

    // Auto-select best available model if not specified
    if (!config.model) {
      const models = await this.getAvailableModels();
      const recommendedModel = models.find(m => m.recommended) || models[0];
      config.model = recommendedModel?.id || 'gpt-3.5-turbo';
      console.log(`Auto-selected model: ${config.model}`);
    }

    const prompt = this.buildPrompt(diff, options);

    return await this.withRetry(async () => {
      try {
        const response = await this.client.chat.completions.create({
          model: config.model,
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
          temperature: config.temperature || 0.7,
          n: 1
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response content from OpenAI');
        }

        const messages = this.parseResponse(content);
        return messages.filter(msg => this.validateCommitMessage(msg));

      } catch (error) {
        this.handleError(error, 'OpenAI');
      }
    }, config.retries || 3);
  }

  /**
   * Get available models (cached with dynamic fetching)
   */
  async getAvailableModels(forceRefresh = false) {
    // Check cache first
    if (!forceRefresh && this.cachedModels && this.modelsCacheTime && 
        Date.now() - this.modelsCacheTime < 3600000) { // 1 hour cache
      return this.cachedModels;
    }

    await this.initializeClient();
    
    try {
      console.log('Fetching available OpenAI models...');
      const models = await this.client.models.list();
      
      // Filter and sort models by relevance for commit messages
      const availableModels = models.data
        .filter(model => {
          const id = model.id.toLowerCase();
          return (id.includes('gpt') && !id.includes('instruct') && 
                  !id.includes('edit') && !id.includes('embedding') &&
                  !id.includes('whisper') && !id.includes('tts') &&
                  !id.includes('dall-e'));
        })
        .sort((a, b) => {
          // Prioritize newer and better models
          const priority = this.getModelPriority(a.id) - this.getModelPriority(b.id);
          return priority;
        })
        .map(model => ({
          id: model.id,
          name: this.getModelDisplayName(model.id),
          description: this.getModelDescription(model.id),
          available: true,
          recommended: this.isRecommendedModel(model.id),
          contextLength: this.getModelContextLength(model.id),
          costTier: this.getModelCostTier(model.id)
        }));

      // Cache results
      this.cachedModels = availableModels;
      this.modelsCacheTime = Date.now();
      
      console.log(`Found ${availableModels.length} available OpenAI models`);
      return availableModels;
      
    } catch (error) {
      console.warn(`Failed to fetch OpenAI models: ${error.message}`);
      
      // Return default models if API call fails
      const defaultModels = this.getDefaultModels();
      this.cachedModels = defaultModels;
      this.modelsCacheTime = Date.now();
      return defaultModels;
    }
  }

  /**
   * Get default models (fallback)
   */
  getDefaultModels() {
    return [
      { 
        id: 'gpt-3.5-turbo', 
        name: 'GPT-3.5 Turbo', 
        description: 'Fast and efficient for most tasks',
        available: true,
        recommended: true,
        contextLength: 4096,
        costTier: 'low'
      },
      { 
        id: 'gpt-4', 
        name: 'GPT-4', 
        description: 'Most capable model with better reasoning',
        available: true,
        recommended: false,
        contextLength: 8192,
        costTier: 'high'
      },
      { 
        id: 'gpt-4-turbo-preview', 
        name: 'GPT-4 Turbo', 
        description: 'Latest GPT-4 with improved performance',
        available: true,
        recommended: false,
        contextLength: 128000,
        costTier: 'medium'
      }
    ];
  }

  /**
   * Get model priority for sorting
   */
  getModelPriority(modelId) {
    const priorities = {
      'gpt-4-turbo': 1,
      'gpt-4': 2,
      'gpt-3.5-turbo': 3,
      'gpt-3.5': 4
    };
    
    for (const [key, priority] of Object.entries(priorities)) {
      if (modelId.includes(key)) {
        return priority;
      }
    }
    return 99; // Low priority for unknown models
  }

  /**
   * Get model display name
   */
  getModelDisplayName(modelId) {
    const names = {
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'gpt-3.5-turbo-16k': 'GPT-3.5 Turbo 16K',
      'gpt-4': 'GPT-4',
      'gpt-4-32k': 'GPT-4 32K',
      'gpt-4-turbo-preview': 'GPT-4 Turbo',
      'gpt-4-vision-preview': 'GPT-4 Vision',
      'gpt-4-1106-preview': 'GPT-4 Turbo (Nov 2023)',
      'gpt-4-0125-preview': 'GPT-4 Turbo (Jan 2024)'
    };
    return names[modelId] || modelId;
  }

  /**
   * Get model description
   */
  getModelDescription(modelId) {
    const descriptions = {
      'gpt-3.5-turbo': 'Fast and efficient for most tasks',
      'gpt-3.5-turbo-16k': 'Extended context version of GPT-3.5',
      'gpt-4': 'Most capable model with better reasoning',
      'gpt-4-32k': 'Extended context version of GPT-4',
      'gpt-4-turbo-preview': 'Latest GPT-4 with improved performance and lower cost',
      'gpt-4-vision-preview': 'GPT-4 with vision capabilities',
      'gpt-4-1106-preview': 'GPT-4 Turbo with 128K context',
      'gpt-4-0125-preview': 'Latest GPT-4 Turbo with reduced laziness'
    };
    return descriptions[modelId] || 'OpenAI language model';
  }

  /**
   * Check if model is recommended for commit messages
   */
  isRecommendedModel(modelId) {
    const recommended = ['gpt-3.5-turbo', 'gpt-4-turbo-preview'];
    return recommended.some(rec => modelId.includes(rec));
  }

  /**
   * Get model context length
   */
  getModelContextLength(modelId) {
    const contextLengths = {
      'gpt-3.5-turbo': 4096,
      'gpt-3.5-turbo-16k': 16384,
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'gpt-4-turbo-preview': 128000,
      'gpt-4-1106-preview': 128000,
      'gpt-4-0125-preview': 128000
    };
    return contextLengths[modelId] || 4096;
  }

  /**
   * Get model cost tier
   */
  getModelCostTier(modelId) {
    if (modelId.includes('gpt-3.5')) return 'low';
    if (modelId.includes('gpt-4-turbo')) return 'medium';
    if (modelId.includes('gpt-4')) return 'high';
    return 'unknown';
  }

  /**
   * Get best available model for commit messages
   */
  async getBestAvailableModel() {
    const models = await this.getAvailableModels();
    
    // Prefer recommended models first
    const recommended = models.filter(m => m.recommended);
    if (recommended.length > 0) {
      return recommended[0];
    }
    
    // Fall back to first available model
    return models[0] || { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' };
  }

  /**
   * Validate OpenAI configuration
   */
  async validate(config) {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    // Validate API key format
    if (!config.apiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format');
    }

    // Validate model if specified
    if (config.model) {
      const models = await this.getAvailableModels();
      const modelExists = models.some(m => m.id === config.model);
      if (!modelExists) {
        console.warn(`Model ${config.model} not found in available models. Will use default.`);
      }
    }

    return true;
  }

  /**
   * Test OpenAI connection and model availability
   */
  async test(config) {
    try {
      const client = new OpenAI({
        apiKey: config.apiKey,
        timeout: 10000
      });

      // Get available models first
      const models = await this.getAvailableModels();
      const modelToTest = config.model || models.find(m => m.recommended)?.id || 'gpt-3.5-turbo';

      // Test with a simple request
      const response = await client.chat.completions.create({
        model: modelToTest,
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
        throw new Error('No response from OpenAI');
      }

      return {
        success: true,
        message: 'OpenAI connection successful',
        model: modelToTest,
        response: content.trim(),
        availableModels: models.length,
        recommendedModels: models.filter(m => m.recommended).length
      };

    } catch (error) {
      return {
        success: false,
        message: `OpenAI connection failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Estimate token usage
   */
  estimateTokens(text) {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate approximate cost
   */
  calculateCost(inputTokens, outputTokens, model = 'gpt-3.5-turbo') {
    // Pricing as of 2024 (per 1K tokens)
    const pricing = {
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
      'gpt-4-1106-preview': { input: 0.01, output: 0.03 },
      'gpt-4-0125-preview': { input: 0.01, output: 0.03 }
    };

    const modelPricing = pricing[model] || pricing['gpt-3.5-turbo'];
    const inputCost = (inputTokens / 1000) * modelPricing.input;
    const outputCost = (outputTokens / 1000) * modelPricing.output;
    
    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
      currency: 'USD'
    };
  }
}

module.exports = OpenAIProvider;