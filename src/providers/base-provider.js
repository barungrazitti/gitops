/**
 * Base AI Provider - Abstract class for all AI providers
 */

const ConfigManager = require('../core/config-manager');

class BaseProvider {
  constructor() {
    this.configManager = new ConfigManager();
    this.name = 'base';
  }

  /**
   * Generate commit messages - must be implemented by subclasses
   */
  async generateCommitMessages(diff, options = {}) {
    throw new Error('generateCommitMessages must be implemented by subclass');
  }

  /**
   * Validate provider configuration
   */
  async validate(config) {
    throw new Error('validate must be implemented by subclass');
  }

  /**
   * Test provider connection
   */
  async test(config) {
    throw new Error('test must be implemented by subclass');
  }

  /**
   * Build prompt for commit message generation
   */
  buildPrompt(diff, options = {}) {
    const { context, type, language, conventional } = options;
    
    let prompt = `You are an expert software developer. Analyze the following git diff and generate ${options.count || 3} concise, meaningful commit messages.

Requirements:
- Be specific about what changed
- Use active voice and imperative mood
- Keep messages under 72 characters for the title
- Focus on the "what" and "why", not the "how"`;

    if (conventional) {
      prompt += `
- Use conventional commit format: type(scope): description
- Available types: feat, fix, docs, style, refactor, perf, test, chore, ci, build
- Include scope when relevant (e.g., api, ui, auth, db)`;
    }

    if (type) {
      prompt += `\n- Prefer commit type: ${type}`;
    }

    if (language !== 'en') {
      prompt += `\n- Write commit messages in ${this.getLanguageName(language)}`;
    }

    if (context && context.patterns) {
      prompt += `\n\nRepository context:
- Preferred commit format: ${context.patterns.preferredFormat}
- Common types used: ${context.patterns.mostUsedTypes.map(([type]) => type).join(', ')}
- Average message length: ${Math.round(context.patterns.averageLength)} characters`;
    }

    prompt += `\n\nGit diff:
\`\`\`diff
${this.preprocessDiff(diff)}
\`\`\`

Generate ${options.count || 3} commit messages (one per line, no numbering or bullets):`;

    return prompt;
  }

  /**
   * Preprocess diff to make it more AI-friendly
   */
  preprocessDiff(diff) {
    // Remove binary file indicators
    let processed = diff.replace(/^Binary files? .* differ$/gm, '[Binary file modified]');
    
    // Limit diff size to prevent token overflow
    const maxLines = 100;
    const lines = processed.split('\n');
    if (lines.length > maxLines) {
      processed = lines.slice(0, maxLines).join('\n') + '\n... (diff truncated)';
    }
    
    // Remove very long lines that might be minified code
    processed = processed.replace(/^.{200,}$/gm, '[Long line truncated]');
    
    return processed;
  }

  /**
   * Get language name from code
   */
  getLanguageName(code) {
    const languages = {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'zh': 'Chinese',
      'ja': 'Japanese'
    };
    return languages[code] || 'English';
  }

  /**
   * Parse AI response into commit messages
   */
  parseResponse(response) {
    if (!response || typeof response !== 'string') {
      throw new Error('Invalid response from AI provider');
    }

    // Split by lines and clean up
    const messages = response
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !line.match(/^\d+\.?\s/)) // Remove numbered items
      .filter(line => !line.startsWith('-')) // Remove bullet points
      .filter(line => !line.startsWith('*')) // Remove asterisk bullets
      .slice(0, 10); // Limit to 10 messages max

    if (messages.length === 0) {
      throw new Error('No valid commit messages found in AI response');
    }

    return messages;
  }

  /**
   * Handle API errors consistently
   */
  handleError(error, providerName) {
    if (error.response) {
      // HTTP error response
      const status = error.response.status;
      const message = error.response.data?.error?.message || error.response.statusText;
      
      switch (status) {
        case 401:
          throw new Error(`Authentication failed for ${providerName}. Please check your API key.`);
        case 403:
          throw new Error(`Access forbidden for ${providerName}. Please check your permissions.`);
        case 429:
          throw new Error(`Rate limit exceeded for ${providerName}. Please try again later.`);
        case 500:
        case 502:
        case 503:
        case 504:
          throw new Error(`${providerName} service is temporarily unavailable. Please try again later.`);
        default:
          throw new Error(`${providerName} API error (${status}): ${message}`);
      }
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error(`Cannot connect to ${providerName}. Please check your internet connection.`);
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error(`Request to ${providerName} timed out. Please try again.`);
    } else {
      throw new Error(`${providerName} error: ${error.message}`);
    }
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
        
        // Don't retry on authentication errors
        if (error.message.includes('Authentication failed') || 
            error.message.includes('API key')) {
          throw error;
        }
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Validate commit message format
   */
  validateCommitMessage(message) {
    if (!message || typeof message !== 'string') {
      return false;
    }
    
    const trimmed = message.trim();
    
    // Basic validation
    if (trimmed.length < 10 || trimmed.length > 200) {
      return false;
    }
    
    // Should not contain newlines in title
    if (trimmed.includes('\n') && trimmed.indexOf('\n') < 50) {
      return false;
    }
    
    // Should not start with special characters
    if (/^[^\w]/.test(trimmed)) {
      return false;
    }
    
    return true;
  }

  /**
   * Get provider-specific configuration
   */
  async getConfig() {
    return await this.configManager.getProviderConfig(this.name);
  }
}

module.exports = BaseProvider;