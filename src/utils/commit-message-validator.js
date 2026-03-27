/**
 * Commit Message Validator - Retry logic and validation for commit generation
 */

class CommitMessageValidator {
  /**
   * Generate commit messages with intelligent retry and validation
   */
  async generateWithValidation(provider, diff, options = {}) {
    const MessageFormatter = require('../core/message-formatter');
    const messageFormatter = new MessageFormatter();

    let lastError;
    const maxRetries = options.maxRetries || 2;
    const enableFallback = options.enableFallback !== false;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const messages = await provider.generateCommitMessages(diff, {
          ...options,
          attempt: attempt
        });

        const validMessages = [];
        const invalidMessages = [];
        const messageScores = [];

        for (const message of messages) {
          const validation = messageFormatter.getCommitMessageValidation(message);
          const relevanceScore = messageFormatter.calculateRelevanceScore(message);

          messageScores.push({ message, validation, relevanceScore });

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

        messageScores.sort((a, b) => b.relevanceScore - a.relevanceScore);

        if (validMessages.length === 0 && messageScores.length > 0) {
          const bestMessage = messageScores[0];
          if (bestMessage.relevanceScore >= 40) {
            const suggestions = messageFormatter.getImprovedMessageSuggestions(bestMessage.message, options.context);
            if (suggestions.length > 0) {
              validMessages.push(suggestions[0]);
            }
          }
        }

        if (validMessages.length > 0) {
          if (provider.activityLogger) {
            await provider.activityLogger.info('commit_message_validation', {
              provider: provider.name, attempt, validMessages: validMessages.length,
              invalidMessages: invalidMessages.length, totalMessages: messages.length
            });
          }
          return validMessages;
        }

        const errorDetails = {
          provider: provider.name, attempt, invalidMessages,
          allExplanatory: invalidMessages.every(m => m.isExplanatory),
          allGeneric: invalidMessages.every(m => m.isGeneric)
        };

        if (provider.activityLogger) {
          await provider.activityLogger.warn('commit_message_validation_failed', errorDetails);
        }

        const error = new Error(`All generated commit messages are invalid: ${invalidMessages.map(m => m.issues.join('; ')).join(' | ')}`);
        error.validationDetails = errorDetails;
        throw error;
      } catch (error) {
        lastError = error;
        if (error.message.includes('Authentication') || error.message.includes('permission') || error.message.includes('401') || error.message.includes('403')) {
          throw error;
        }
        if (provider.activityLogger) {
          await provider.activityLogger.debug('commit_generation_retry', {
            provider: provider.name, attempt, maxRetries, error: error.message,
            willRetry: attempt < maxRetries
          });
        }
        if (attempt === maxRetries) break;
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    if (enableFallback && provider.name !== 'groq') {
      try {
        if (provider.activityLogger) {
          await provider.activityLogger.info('fallback_to_groq', {
            originalProvider: provider.name, originalError: lastError.message, attempts: maxRetries
          });
        }
        const GroqProvider = require('../providers/groq-provider');
        const groqProvider = new GroqProvider();
        if (provider.activityLogger) groqProvider.activityLogger = provider.activityLogger;
        return await groqProvider.generateCommitMessagesWithValidation(diff, {
          ...options, maxRetries: 1, enableFallback: false, isFallback: true
        });
      } catch (fallbackError) {
        if (provider.activityLogger) {
          await provider.activityLogger.error('fallback_to_groq_failed', {
            originalProvider: provider.name, originalError: lastError.message,
            fallbackError: fallbackError.message
          });
        }
        const combinedError = new Error(`Primary provider (${provider.name}) failed after ${maxRetries} attempts: ${lastError.message}. Fallback to Groq also failed: ${fallbackError.message}`);
        combinedError.originalError = lastError;
        combinedError.fallbackError = fallbackError;
        throw combinedError;
      }
    }

    throw lastError;
  }

  /**
   * Generate commit messages with enhanced prompt for problematic cases
   */
  async generateWithEnhancedPrompt(provider, diff, options = {}) {
    if (options.attempt > 1 || options.isFallback) {
      options.enhancedPrompt = true;
      options.strictValidation = true;

      if (options.validationDetails?.allExplanatory) {
        options.promptInstructions = `
CRITICAL: Generate ONLY commit messages, not explanations.
DO NOT start with "Here's", "This is", "The following", etc.
Output ONLY the commit message itself.

Examples of GOOD responses:
- fix(auth): resolve login timeout issue
- refactor(theme): improve topbar shortcode structure
- feat(api): add user authentication endpoint
`;
      } else if (options.validationDetails?.allGeneric) {
        options.promptInstructions = `
CRITICAL: Be SPECIFIC about what changed.
Avoid generic terms like "modularized", "updated", "changed".
Use concrete, actionable descriptions.

Instead of: "The code has been modularized"
Use: "refactor(utils): extract validation logic into separate functions"
`;
      }
    }
    return await provider.generateCommitMessages(diff, options);
  }
}

module.exports = new CommitMessageValidator();
