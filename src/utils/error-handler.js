const chalk = require('chalk');

class ErrorHandler {
  constructor(generator) {
    this.generator = generator;
  }

  identifyErrorType(error) {
    const message = error.message.toLowerCase();
    if (message.includes('no staged changes')) return 'git_no_changes';
    if (message.includes('not a git repository')) return 'git_not_repo';
    if (message.includes('401') || message.includes('unauthorized') || message.includes('api key')) return 'ai_auth_error';
    if (message.includes('429') || message.includes('too many requests') || message.includes('rate limit')) return 'ai_rate_limit';
    if (message.includes('econnrefused') || message.includes('enotfound')) return 'ai_connection_error';
    if (message.includes('context length exceeded') || message.includes('too large')) return 'ai_context_limit';
    return 'unknown';
  }

  getLocalSuggestion(type) {
    const suggestions = {
      git_no_changes: 'No changes are staged. Use "git add <file>" to stage changes.',
      git_not_repo: 'This directory is not a git repository. Run "git init".',
      ai_auth_error: 'AI provider authentication failed. Run "aic setup".',
      ai_rate_limit: 'AI provider rate limit reached. Please wait or switch providers.',
      ai_connection_error: 'Could not connect to AI provider. Check internet/Ollama.',
      ai_context_limit: 'Diff is too large. Stage fewer files.',
      unknown: 'An unexpected error occurred.',
    };
    return suggestions[type] || suggestions.unknown;
  }

  async provideErrorSuggestions(error, options = {}) {
    try {
      const errorType = this.identifyErrorType(error);

      if (this.generator && this.generator.isAIAvailable(options)) {
        try {
          const suggestion = await this.generator.getAISuggestion(error, options);
          if (suggestion) {
            console.log(chalk.yellow(`\n💡 AI Suggestion: ${suggestion}`));
            return;
          }
        } catch (aiError) {
          // Silently fall back to local suggestions
        }
      }

      const localSuggestion = this.getLocalSuggestion(errorType);
      if (localSuggestion) {
        console.log(chalk.yellow(`\n💡 Suggestion: ${localSuggestion}`));
      }
    } catch (fallbackError) {
      // Fail silently to avoid crashing the error handler itself
    }
  }
}

module.exports = ErrorHandler;