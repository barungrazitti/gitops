/**
 * Base AI Provider - Abstract class for all AI providers
 *
 * Heavy logic extracted to: utils/prompt-builder, utils/response-parser,
 * utils/token-manager, utils/diff-analyzer, utils/error-handler,
 * utils/diff-preprocessor, utils/commit-message-validator
 */

const fs = require('fs');
const path = require('path');
const ConfigManager = require('../core/config-manager');

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

<<<<<<< HEAD
    let processed = diff;

    // Split into lines for intelligent processing
    const processedLines = [];
    const importantLines = [];
    const contextLines = [];
    const functionSignatures = [];

    // First pass: identify important patterns and filter assets
    const lines = diff.split('\n');
    const assetFiles = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect file headers - check for assets
      if (line.startsWith('diff --git')) {
        const fileMatch = line.match(/diff --git a\/(.+?) b\/(.+)/);
        if (fileMatch) {
          const filePath = fileMatch[2];
          const ext = filePath.split('.').pop().toLowerCase();

          // Check if it's an asset file (images, fonts, media, etc.)
          const assetExtensions = ['svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'woff', 'woff2', 'ttf', 'eot', 'mp4', 'mp3', 'pdf', 'zip', 'tar', 'gz'];
          
          if (assetExtensions.includes(ext) || /^Binary files/.test(lines[i + 1] || '')) {
            assetFiles.push(filePath);
            processedLines.push(`# Asset file added: ${filePath}`);
            
            // Skip ahead to next diff --git (don't include asset content)
            while (i + 1 < lines.length && !lines[i + 1].startsWith('diff --git')) {
              i++;
            }
            continue;
          }
        }
      }

      // Always keep diff headers
      if (
        line.startsWith('diff --git') ||
        line.startsWith('index ') ||
        line.startsWith('---') ||
        line.startsWith('+++') ||
        line.startsWith('@@')
      ) {
        processedLines.push(line);
        continue;
      }

      // Keep ALL added/removed lines (no more filtering)
      if (line.startsWith('+') || line.startsWith('-')) {
        importantLines.push(line);

        // Extract function signatures from changes
        const trimmedLine = line.substring(1).trim();
        if (trimmedLine.match(/^(function|class|def|const|let|var)\s+\w+/)) {
          functionSignatures.push(trimmedLine);
        }
        continue;
      }

      // Keep ALL context lines (no more filtering)
      contextLines.push(line);
    }

    // Combine lines to preserve full context
    processedLines.push(...importantLines);
    processedLines.push(...contextLines.map((line) => ` ${  line}`));

    // Only limit if extremely large (preserve much more content)
    const maxLines = 1000; // Increased from 250 to 1000
    if (processedLines.length > maxLines) {
      // Prioritize keeping headers and changes, limit context
      const headers = processedLines.filter(
        (line) =>
          line.startsWith('diff --git') ||
          line.startsWith('index ') ||
          line.startsWith('---') ||
          line.startsWith('+++') ||
          line.startsWith('@@')
      );

      const changes = processedLines.filter(
        (line) => line.startsWith('+') || line.startsWith('-')
      );

      const context = processedLines.filter(
        (line) =>
          !line.startsWith('diff --git') &&
          !line.startsWith('index ') &&
          !line.startsWith('---') &&
          !line.startsWith('+++') &&
          !line.startsWith('@@') &&
          !line.startsWith('+') &&
          !line.startsWith('-') &&
          !line.startsWith('[Binary')
      );

      // Keep all headers, all changes, and as much context as possible
      const finalLines = [
        ...headers,
        ...changes,
        ...context.slice(0, maxLines - headers.length - changes.length),
      ];

      processed = `${finalLines.join('\n')  }\n... (diff truncated for size)`;
    } else {
      processed = processedLines.join('\n');
    }

    // Add asset summary at the beginning if assets were filtered
    if (assetFiles.length > 0) {
      const assetSummary = this.generateAssetSummary(assetFiles);
      processed = assetSummary + processed;
    }

    return processed;
  }

  /**
   * Check if a context line is important (disabled - keeping all context)
   */
  isImportantContext(line) {
    // Always return true to keep all context lines
    return line.trim().length > 0;
  }

  /**
   * Prioritize context lines based on relevance to function signatures
   */
  prioritizeContextLines(contextLines, functionSignatures) {
    if (functionSignatures.length === 0) return contextLines;

    const prioritized = [];
    const remaining = [...contextLines];

    // Prioritize lines that are near function signatures
    for (const signature of functionSignatures) {
      const functionName = signature.match(/\w+/)?.[0];
      if (!functionName) continue;

      for (let i = 0; i < remaining.length; i++) {
        const line = remaining[i];
        if (line.includes(functionName) && line !== signature) {
          prioritized.push(line);
          remaining.splice(i, 1);
          break;
        }
      }
    }

    // Add remaining lines
    prioritized.push(...remaining);
    return prioritized;
  }

  /**
   * Check if a change is trivial (only filter out truly empty changes)
   */
  isTrivialChange(line) {
    const content = line.substring(1).trim(); // Remove + or - prefix

    // Only ignore truly empty changes
    if (!content) return true;

    // Keep everything else - no more aggressive filtering
    return false;
  }

  /**
   * Generate a summary of asset files
   */
  generateAssetSummary(assetFiles) {
    if (assetFiles.length === 0) return '';

    // Group by type
    const byType = {};
    assetFiles.forEach(file => {
      const ext = file.split('.').pop().toLowerCase();
      const type = this.getAssetType(ext);
      byType[type] = (byType[type] || 0) + 1;
    });

    // Build summary
    const summary = [];
    if (byType.images > 0) summary.push(`${byType.images} image(s)`);
    if (byType.fonts > 0) summary.push(`${byType.fonts} font(s)`);
    if (byType.media > 0) summary.push(`${byType.media} media file(s)`);
    if (byType.other > 0) summary.push(`${byType.other} other asset(s)`);

    return `# ASSETS SUMMARY: ${summary.join(', ')} added\n`;
  }

  /**
   * Get asset type from extension
   */
  getAssetType(ext) {
    const imageTypes = ['svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp'];
    const fontTypes = ['woff', 'woff2', 'ttf', 'eot', 'otf'];
    const mediaTypes = ['mp4', 'mp3', 'wav', 'ogg', 'webm', 'avi', 'mov'];

    if (imageTypes.includes(ext)) return 'images';
    if (fontTypes.includes(ext)) return 'fonts';
    if (mediaTypes.includes(ext)) return 'media';
    return 'other';
  }

  /**
   * Build enhanced prompt for commit message generation using improved approach
   */
=======
>>>>>>> cea4c8218d91195730c9ef779506932cef526efa
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

<<<<<<< HEAD
  /**
   * Handle API errors consistently
   */
  handleError(error, providerName) {
    // Log the original error for debugging
    console.warn(`Original error from ${providerName}:`, error);

    if (error.response) {
      // HTTP error response
      const {status} = error.response;
      const message =
        error.response.data?.error?.message || error.response.statusText;

      switch (status) {
      case 401:
        throw new Error(
          `Authentication failed for ${providerName}. Please check your API key.`
        );
      case 403:
        throw new Error(
          `Access forbidden for ${providerName}. Please check your permissions.`
        );
      case 429:
        throw new Error(
          `Rate limit exceeded for ${providerName}. Please try again later.`
        );
      case 500:
      case 502:
      case 503:
      case 504:
        throw new Error(
          `${providerName} service is temporarily unavailable. Please try again later.`
        );
      default:
        throw new Error(`${providerName} API error (${status}): ${message}`);
      }
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error(
        `Cannot connect to ${providerName}. Please check your internet connection.`
      );
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error(
        `Request to ${providerName} timed out. Please try again.`
      );
    } else {
      // Handle undefined error message safely
      const errorMessage = error?.message || 'Unknown error occurred';
      throw new Error(`${providerName} error: ${errorMessage}`);
    }
  }

  /**
   * Parse AI response into commit messages
   */
  parseResponse(response) {
    let content;

    // Handle different response formats
    if (typeof response === 'string') {
      // Direct string response
      content = response;
    } else if (response && typeof response === 'object') {
      // Handle Groq response format (with choices)
      if (response.choices && Array.isArray(response.choices) && response.choices.length > 0) {
        content = response.choices[0]?.message?.content;
      } else {
        // If it's an object but not expected Groq format
        content = response.content || JSON.stringify(response);
      }
    } else {
      throw new Error('Invalid response from AI provider');
    }

    if (typeof content !== 'string') {
      throw new Error('Invalid response content from AI provider');
    }

    // Split by lines and clean up
    const messages = content
      .split('\n')
      .map(
        (line) =>
          line
            .trim()
            .replace(/^\d+\.?\s*/, '') // Strip numbering
            .replace(/^- \s*/, '') // Strip dashes
            .replace(/^\* \s*/, '') // Strip asterisks
            .replace(/^["']|["']$/g, '') // Strip surrounding quotes
      )
      .filter((line) => line.length > 0)
      .slice(0, 1); // Only take first message (best one)

    if (messages.length === 0) {
      throw new Error('No valid commit messages found in AI response');
    }

    return messages;
  }

  /**
   * Generate commit messages with intelligent retry and validation
   */
  async generateCommitMessagesWithValidation(diff, options = {}) {
    const MessageFormatter = require('../core/message-formatter');
    const messageFormatter = new MessageFormatter();
    
    let lastError;
    const maxRetries = options.maxRetries || 2;
    const enableFallback = options.enableFallback !== false;
    
    // Try with current provider first
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Generate messages
        const messages = await this.generateCommitMessages(diff, {
          ...options,
          attempt
        });
        
        // Validate each message and score relevance
        const validMessages = [];
        const invalidMessages = [];
        const messageScores = [];
        
        for (const message of messages) {
          const validation = messageFormatter.getCommitMessageValidation(message);
          const relevanceScore = messageFormatter.calculateRelevanceScore(message);
          
          messageScores.push({
            message,
            validation,
            relevanceScore
          });
          
          if (validation.isValid && relevanceScore >= 60) {
            validMessages.push(message);
          } else {
            invalidMessages.push({
              message,
              issues: validation.issues,
              isExplanatory: validation.isExplanatory,
              isGeneric: validation.isGeneric,
              relevanceScore
            });
          }
        }
        
        // Sort messages by relevance score (highest first)
        messageScores.sort((a, b) => b.relevanceScore - a.relevanceScore);
        
        // If no valid messages, try to improve the best ones
        if (validMessages.length === 0 && messageScores.length > 0) {
          const bestMessage = messageScores[0];
          if (bestMessage.relevanceScore >= 40) {
            // Try to get suggestions for improvement
            const suggestions = messageFormatter.getImprovedMessageSuggestions(bestMessage.message, options.context);
            if (suggestions.length > 0) {
              validMessages.push(suggestions[0]); // Use the best suggestion
            }
          }
        }
        
        // If we have valid messages, return them
        if (validMessages.length > 0) {
          // Log successful validation
          if (this.activityLogger) {
            await this.activityLogger.info('commit_message_validation', {
              provider: this.name,
              attempt,
              validMessages: validMessages.length,
              invalidMessages: invalidMessages.length,
              totalMessages: messages.length
            });
          }
          
          return validMessages;
        }
        
        // If all messages are invalid, log and prepare for retry
        const errorDetails = {
          provider: this.name,
          attempt,
          invalidMessages,
          allExplanatory: invalidMessages.every(m => m.isExplanatory),
          allGeneric: invalidMessages.every(m => m.isGeneric)
        };
        
        // Log validation failure
        if (this.activityLogger) {
          await this.activityLogger.warn('commit_message_validation_failed', errorDetails);
        }
        
        // Create error for retry logic
        const error = new Error(`All generated commit messages are invalid: ${invalidMessages.map(m => m.issues.join('; ')).join(' | ')}`);
        error.validationDetails = errorDetails;
        throw error;
        
      } catch (error) {
        lastError = error;
        
        // Don't retry on authentication or permission errors
        if (error.message.includes('Authentication') || error.message.includes('permission') || error.message.includes('401') || error.message.includes('403')) {
          throw error;
        }
        
        // Log retry attempt
        if (this.activityLogger) {
          await this.activityLogger.debug('commit_generation_retry', {
            provider: this.name,
            attempt,
            maxRetries,
            error: error.message,
            willRetry: attempt < maxRetries
          });
        }
        
        // If this is the last attempt for this provider, break
        if (attempt === maxRetries) {
          break;
        }
        
        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * 2**(attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // If we get here, all retries failed
    if (enableFallback && this.name !== 'groq') {
      // Try fallback to Groq
      try {
        if (this.activityLogger) {
          await this.activityLogger.info('fallback_to_groq', {
            originalProvider: this.name,
            originalError: lastError.message,
            attempts: maxRetries
          });
        }
        
        const GroqProvider = require('./groq-provider');
        const groqProvider = new GroqProvider();
        
        // Copy activity logger if available
        if (this.activityLogger) {
          groqProvider.activityLogger = this.activityLogger;
        }
        
        // Try with Groq (single attempt to avoid infinite loops)
        return await groqProvider.generateCommitMessagesWithValidation(diff, {
          ...options,
          maxRetries: 1,
          enableFallback: false, // Prevent infinite fallback loops
          isFallback: true
        });
        
      } catch (fallbackError) {
        if (this.activityLogger) {
          await this.activityLogger.error('fallback_to_groq_failed', {
            originalProvider: this.name,
            originalError: lastError.message,
            fallbackError: fallbackError.message
          });
        }
        
        // Combine errors for better context
        const combinedError = new Error(`Primary provider (${this.name}) failed after ${maxRetries} attempts: ${lastError.message}. Fallback to Groq also failed: ${fallbackError.message}`);
        combinedError.originalError = lastError;
        combinedError.fallbackError = fallbackError;
        throw combinedError;
      }
    }
    
    // No fallback or fallback failed, throw the last error
    throw lastError;
  }

  /**
   * Generate commit messages with enhanced prompt for problematic cases
   */
  async generateCommitMessagesWithEnhancedPrompt(diff, options = {}) {
    // If this is a retry or fallback, use enhanced prompt
    if (options.attempt > 1 || options.isFallback) {
      options.enhancedPrompt = true;
      options.strictValidation = true;
      
      // Add specific instructions for problematic cases
      if (options.validationDetails?.allExplanatory) {
        options.promptInstructions = `
CRITICAL: Generate ONLY commit messages, not explanations.
DO NOT start with "Here's", "This is", "The following", etc.
DO NOT provide breakdowns or explanations.
Output ONLY the commit message itself.

Examples of GOOD responses:
- fix(auth): resolve login timeout issue
- refactor(theme): improve topbar shortcode structure
- feat(api): add user authentication endpoint

Examples of BAD responses:
- Here's a breakdown of what the code does:
- The JavaScript code has been modularized...
- This change updates the following:
`;
      } else if (options.validationDetails?.allGeneric) {
        options.promptInstructions = `
CRITICAL: Be SPECIFIC about what changed.
Avoid generic terms like "modularized", "updated", "changed".
Use concrete, actionable descriptions.

Instead of: "The code has been modularized"
Use: "refactor(utils): extract validation logic into separate functions"

Instead of: "Update the configuration"
Use: "config: update database connection settings for production"
`;
      }
    }
    
    return await this.generateCommitMessages(diff, options);
  }

  /**
   * Retry logic for API calls
   */
  async withRetry(fn, maxRetries = 3, delay = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Do not retry on client-side errors (e.g., 401, 403)
        const status = error.response?.status;
        if (status && status >= 400 && status < 500) {
          throw error;
        }

        // Log retryable errors but don't show them to user
        this.logError(error, `Attempt ${attempt}/${maxRetries} failed`);

        if (attempt < maxRetries) {
          // Use exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, delay * 2**(attempt - 1))
          );
        }
      }
    }
    throw lastError;
  }

  /**
   * Simple validation for commit messages (for backward compatibility)
   */
=======
>>>>>>> cea4c8218d91195730c9ef779506932cef526efa
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

<<<<<<< HEAD
  /**
   * Infer likely purpose of changes
   */
  inferLikelyPurpose(changes) {
    if (changes.some(change => change.file && change.file.includes('test'))) {
      return 'test-related changes';
    } if (changes.some(change => change.file && /\.(js|ts|jsx|tsx)$/.test(change.file))) {
      return 'javascript/typescript changes';
    } if (changes.some(change => change.file && /\.(py)$/.test(change.file))) {
      return 'python changes';
    } if (changes.some(change => change.file && /\.(php)$/.test(change.file))) {
      return 'php changes';
    } if (changes.some(change => change.changes && change.changes.some(c => 
        c.content && /\b(bug|fix|error|issue|resolve|correct)\b/i.test(c.content)
      ))) {
      return 'bug fix';
    } if (changes.some(change => change.changes && change.changes.some(c => 
        c.content && /\b(feature|add|implement|create|new)\b/i.test(c.content)
      ))) {
      return 'feature addition';
    } 
      return 'general modification';
    
=======
  /** @see utils/commit-message-validator.js */
  async generateCommitMessagesWithValidation(diff, options = {}) {
    return require('../utils/commit-message-validator').generateWithValidation(this, diff, options);
  }

  /** @see utils/commit-message-validator.js */
  async generateCommitMessagesWithEnhancedPrompt(diff, options = {}) {
    return require('../utils/commit-message-validator').generateWithEnhancedPrompt(this, diff, options);
>>>>>>> cea4c8218d91195730c9ef779506932cef526efa
  }

  async generateFromChunks(diff, options = {}, maxTokens = 4000) {
    const chunks = this.chunkDiff(diff, maxTokens);
    const allMessages = [];
    for (let i = 0; i < chunks.length; i++) {
      const isLastChunk = i === chunks.length - 1;
<<<<<<< HEAD
      const chunkOptions = {
        ...options,
        chunkIndex: i,
        totalChunks: chunks.length,
        isLastChunk,
        chunkContext: isLastChunk ? 'final' : i === 0 ? 'initial' : 'middle'
      };

=======
>>>>>>> cea4c8218d91195730c9ef779506932cef526efa
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
      await this.getConfig();
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
