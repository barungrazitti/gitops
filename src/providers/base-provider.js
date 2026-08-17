/**
 * Base AI Provider - Abstract class for all AI providers.
 * Thin adapters: text in (prompt + options) → text out (generateResponse).
 * Prompt assembly lives in the pipeline layer, not in adapters.
 */

const ConfigManager = require('../core/config-manager');
const ActivityLogger = require('../core/activity-logger');

class BaseProvider {
  /**
   * @param {Object} [deps] - Shared collaborators (from the composition root).
   * @param {Object} [deps.configManager] - Config store instance.
   * @param {Object} [deps.activityLogger] - Activity logger instance.
   */
  constructor({ configManager = new ConfigManager(), activityLogger = new ActivityLogger() } = {}) {
    this.configManager = configManager;
    this.activityLogger = activityLogger;
    this.name = 'base';
    this.client = null;
  }

  /**
   * Generate AI response for a prompt - must be implemented by subclasses.
   * @param {string} prompt - Full prompt text (assembled by the pipeline).
   * @param {object} options - Transport knobs: systemPrompt, maxTokens, temperature, model.
   * @returns {Promise<string>} The response content.
   */
  async generateResponse(prompt, _options = {}) {
    throw new Error('generateResponse must be implemented by subclass');
  }

  /**
   * Validate provider configuration
   */
  async validate(_config) {
    throw new Error('validate must be implemented by subclass');
  }

  /**
   * Handle API errors consistently
   */
  handleError(error, providerName) {
    console.warn(`Original error from ${providerName}:`, error);
    if (error.response) {
      const { status } = error.response;
      const message = error.response.data?.error?.message || error.response.statusText;
      switch (status) {
        case 401: throw new Error(`Authentication failed for ${providerName}. Please check your API key.`);
        case 403: throw new Error(`Access forbidden for ${providerName}. Please check your permissions.`);
        case 429: throw new Error(`Rate limit exceeded for ${providerName}. Please try again later.`);
        case 500: case 502: case 503: case 504:
          throw new Error(`${providerName} service is temporarily unavailable. Please try again later.`);
        default: throw new Error(`${providerName} API error (${status}): ${message}`);
      }
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error(`Cannot connect to ${providerName}. Please check your internet connection.`);
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error(`Request to ${providerName} timed out. Please try again.`);
    } else {
      const errorMessage = error?.message || 'Unknown error occurred';
      throw new Error(`${providerName} error: ${errorMessage}`);
    }
  }

  /**
   * Retry logic for API calls
   */
  async withRetry(fn, maxRetries = 3, delay = 1000) {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const status = error.response?.status;
        if (status && status >= 400 && status < 500 && status !== 413 && status !== 429) {
          throw error;
        }
        await this.activityLogger.debug('provider_api_retry', {
          provider: this.name,
          error: error.message,
          status,
          attempt,
          willRetry: attempt < maxRetries - 1,
        });
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * 2 ** attempt));
        } else {
          throw error;
        }
      }
    }
    throw lastError;
  }

  /**
   * Get provider configuration
   */
  async getConfig() {
    try {
      const config = await this.configManager.getProviderConfig(this.name);
      return config || {};
    } catch (error) {
      console.warn(`Failed to get config for ${this.name}:`, error.message);
      return {};
    }
  }

  /**
   * Send HTTP request with error handling
   */
  async sendHTTPRequest(url, options = {}) {
    try {
      const config = await this.getConfig();
      const axios = require('axios');
      const requestOptions = {
        timeout: config.timeout || 120000,
        ...options,
      };
      const response = await axios(url, requestOptions);
      return response.data;
    } catch (error) {
      this.handleError(error, this.name);
    }
  }

  /**
   * Cleanup method for resource release
   */
  cleanup() {
    this.client = null;
  }
}

module.exports = BaseProvider;
