/**
 * Base AI Provider - Abstract class for all AI providers
 *
 * Heavy logic extracted to: utils/prompt-builder, utils/response-parser,
 * utils/token-manager, utils/diff-analyzer, utils/error-handler,
 * utils/diff-preprocessor, utils/commit-message-validator
 */

const ConfigManager = require('../core/config-manager');
const fs = require('fs');
const path = require('path');

class BaseProvider {
  constructor() {
    this.configManager = new ConfigManager();
    this.name = 'base';
    this.client = null;
    this.baseURL = '';
    this.activityLogger = null;
  }

  // ── Abstract methods ──────────────────────────────────────────────

  async generateCommitMessages(diff, _options = {}) {
    throw new Error('generateCommitMessages must be implemented by subclass');
  }

  async generateResponse(prompt, _options = {}) {
    throw new Error('generateResponse must be implemented by subclass');
  }

  async validate(_config) {
    throw new Error('validate must be implemented by subclass');
  }

  // ── Delegated methods ────────────────────────────────────────────

  buildPrompt(diff, options = {}) {
    const DiffFactAnalyzer = require('../utils/diff-fact-analyzer');
    const EfficientPromptBuilder = require('../utils/efficient-prompt-builder');

    const diffFactAnalyzer = new DiffFactAnalyzer();
    const promptBuilder = new EfficientPromptBuilder({
      maxPromptLength: this.config?.maxPromptLength || 8000,
      preserveContext: true
    });

    const diffFacts = diffFactAnalyzer.analyze(diff);
    return promptBuilder.buildPrompt(diff, { ...options, diffFacts });
  }

  analyzeDiffContent(diff) {
    const DiffAnalyzer = require('../utils/diff-analyzer');
    return new DiffAnalyzer().analyzeDiffContent(diff);
  }

  analyzeDiff(diff) {
    const DiffAnalyzer = require('../utils/diff-analyzer');
    return new DiffAnalyzer().analyzeDiffWithSummary(diff);
  }

  parseResponse(response) {
    const ResponseParser = require('../utils/response-parser');
    return new ResponseParser().parseResponse(response);
  }

  handleError(error, providerName) {
    return require('../utils/error-handler').handleError(error, providerName);
  }

  estimateTokens(text) {
    return new (require('../utils/token-manager'))().estimateTokens(text);
  }

  preprocessDiff(diff, maxChunkSize = 4000) {
    return new (require('../utils/diff-preprocessor'))().preprocessDiffWithAssets(diff, maxChunkSize);
  }

  chunkDiff(diff, maxTokens = 4000) {
    return new (require('../utils/diff-preprocessor'))().chunkDiff(diff, maxTokens);
  }

  // ── Utilities ─────────────────────────────────────────────────────

  getLanguageName(code) {
    const languages = {
      en: 'English', es: 'Spanish', fr: 'French',
      de: 'German', zh: 'Chinese', ja: 'Japanese',
    };
    return languages[code] || 'English';
  }

  validateMessage(message) {
    if (!message || typeof message !== 'string') return false;
    const trimmed = message.trim();
    return trimmed.length >= 10 && trimmed.length <= 200;
  }

  validateCommitMessage(message) {
    return this.validateMessage(message);
  }

  async getConfig() {
    try {
      const config = await this.configManager.getProviderConfig(this.name);
      return config || {};
    } catch (error) {
      console.warn(`Failed to get config for ${this.name}:`, error.message);
      return {};
    }
  }

  async withRetry(fn, maxRetries = 3, delay = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const status = error.response?.status;
        if (status && status >= 400 && status < 500) throw error;
        this.logError(error, `Attempt ${attempt}/${maxRetries} failed`);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
        }
      }
    }
    throw lastError;
  }

  /** @see utils/commit-message-validator.js */
  async generateCommitMessagesWithValidation(diff, options = {}) {
    return require('../utils/commit-message-validator').generateWithValidation(this, diff, options);
  }

  /** @see utils/commit-message-validator.js */
  async generateCommitMessagesWithEnhancedPrompt(diff, options = {}) {
    return require('../utils/commit-message-validator').generateWithEnhancedPrompt(this, diff, options);
  }

  async generateFromChunks(diff, options = {}, maxTokens = 4000) {
    const chunks = this.chunkDiff(diff, maxTokens);
    const allMessages = [];
    for (let i = 0; i < chunks.length; i++) {
      const isLastChunk = i === chunks.length - 1;
      try {
        const messages = await this.generateCommitMessages(chunks[i], {
          ...options, chunkIndex: i, totalChunks: chunks.length,
          isLastChunk, chunkContext: isLastChunk ? 'final' : i === 0 ? 'initial' : 'middle'
        });
        allMessages.push(...messages);
      } catch (error) { throw error; }
    }
    return [...new Set(allMessages)];
  }

  async sendHTTPRequest(url, options = {}) {
    try {
      const config = await this.getConfig();
      const axios = require('axios');
      const response = await axios(url, { timeout: config.timeout || 120000, ...options });
      return response.data;
    } catch (error) {
      this.handleError(error, this.name);
    }
  }

  async makeDirectAPIRequest(endpoint, params = {}) {
    try {
      const config = await this.getConfig();
      return await this.sendHTTPRequest(`${this.baseURL}${endpoint}`, params);
    } catch (error) {
      throw new Error(`Direct API request failed: ${error.message}`);
    }
  }

  logError(error, context = '') {
    try {
      const logDir = path.join(process.cwd(), '.aic-logs');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
      const logFile = path.join(logDir, 'errors.log');
      const timestamp = new Date().toISOString();
      fs.appendFileSync(logFile, `[${timestamp}] ${context}\n${error.stack || error.message}\n\n`);
    } catch (_) { /* silently fail */ }
  }

  cleanup() {
    this.client = null;
  }
}

module.exports = BaseProvider;
