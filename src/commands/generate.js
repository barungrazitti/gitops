/**
 * Generate commit messages command
 */

const chalk = require('chalk');
const ora = require('ora');
const SecretScanner = require('../utils/secret-scanner');
const fs = require('fs-extra');

class GenerateCommand {
  constructor(generator) {
    this.generator = generator;
    this.gitManager = generator.gitManager;
    this.configManager = generator.configManager;
    this.cacheManager = generator.cacheManager;
    this.analysisEngine = generator.analysisEngine;
    this.messageFormatter = generator.messageFormatter;
    this.statsManager = generator.statsManager;
    this.hookManager = generator.hookManager;
    this.activityLogger = generator.activityLogger;
    this.efficientPromptBuilder = generator.efficientPromptBuilder;
    this.diffProcessor = generator.diffProcessor;
    this.providerOrchestrator = generator.providerOrchestrator;
    this.diffManager = generator.diffManager;
    this.conflictResolver = generator.conflictResolver;
    this.messageSelector = generator.messageSelector;
  }

  /**
   * Generate AI commit messages
   */
  async execute(options = {}) {
    const spinner = ora({
      text: chalk.blue('🚀 Initializing AI commit generator...'),
      spinner: 'clock'
    }).start();
    const startTime = Date.now();
    let mergedOptions = {};
    let diff = '';

    try {
      await this.activityLogger.info('generate_started', { options });

      // Load configuration
      const config = await this.configManager.load();
      mergedOptions = { ...config, ...options };

      // Validate git repository
      spinner.text = chalk.blue('🔍 Checking git repository...');
      await this.gitManager.validateRepository();
      await this.activityLogger.logGitOperation('validate_repository', { success: true });

      // Get staged changes
      spinner.text = chalk.blue('📋 Analyzing staged changes...');
      let diff = await this.gitManager.getStagedDiff();

      if (!diff || diff.trim().length === 0) {
        spinner.fail(
          chalk.red('❌ No staged changes found. Please stage your changes first.')
        );
        await this.activityLogger.warn('generate_failed', { reason: 'no_staged_changes' });
        return;
      }

      // SECURITY: Sanitize diff to remove secrets and PII before sending to AI
      const secretScanner = new SecretScanner();
      const shouldSanitize = mergedOptions.sanitize !== false; // Default: true
      
      if (shouldSanitize) {
        spinner.text = chalk.blue('🔒 Scanning for sensitive information...');
        const originalLength = diff.length;
        
        diff = secretScanner.scanAndRedact(diff, true);
        const redactionSummary = secretScanner.getRedactionSummary();
        
        if (redactionSummary.found) {
          console.log(chalk.yellow(`\n⚠️  Found and redacted ${redactionSummary.redacted} sensitive item(s):`));
          
          // Group by category for cleaner output
          const categories = Object.entries(redactionSummary.byCategory || {});
          if (categories.length > 0) {
            categories.forEach(([category, count]) => {
              const categoryEmoji = category === 'pii' ? '👤' : '🔑';
              console.log(chalk.gray(`   ${categoryEmoji} ${category.toUpperCase()}: ${count} item(s)`));
            });
          }
          
          // Log to activity logger for audit trail
          await this.activityLogger.warn('sensitive_data_redacted', {
            redacted: redactionSummary.redacted,
            byCategory: redactionSummary.byCategory,
            byType: redactionSummary.byType,
            originalSize: originalLength,
            sanitizedSize: diff.length
          });
          
          spinner.text = chalk.blue('🤖 Generating commit messages with AI...');
        } else {
          await this.activityLogger.info('no_secrets_found', { diffLength: diff.length });
        }
        
        secretScanner.clearRedactionLog();
      }

      // Advanced cache check with semantic similarity
      let messages = [];
      let fromCache = false;
      if (mergedOptions.cache !== false) {
        spinner.text = chalk.blue('💾 Checking for cached results...');
        // Only cache exact matches to avoid complexity
        messages = await this.cacheManager.getValidated(diff);
        if (messages && messages.length > 0) {
          await this.activityLogger.debug('cache_hit', { diffLength: diff.length });
          spinner.text = chalk.blue('💾 Found cached results');
          fromCache = true;
        } else {
          await this.activityLogger.debug('cache_miss', { diffLength: diff.length });
        }
      }

      // Generate commit messages if not from cache
      if (!messages || messages.length === 0) {
        // Analyze repository context
        spinner.text = chalk.blue('🧩 Analyzing repository context...');
        const context = await this.analysisEngine.analyzeRepository();

        // Generate commit messages with sequential fallback
        spinner.text = chalk.blue('🤖 Generating commit messages with AI...');
        messages = await this.providerOrchestrator.generateWithSequentialFallback(diff, {
          context,
          count: parseInt(mergedOptions.count) || 1,
          type: mergedOptions.type,
          language: mergedOptions.language || 'en',
          conventional:
            mergedOptions.conventional || config.conventionalCommits,
          preferredProvider: mergedOptions.provider || config.defaultProvider,
        }, this.activityLogger, this.statsManager);

        // Cache results (simple exact match)
        if (mergedOptions.cache !== false) {
          await this.cacheManager.setValidated(diff, messages);
        }
      }

      spinner.succeed(chalk.green('✅ Commit messages generated successfully!'));

      // Format messages
      const formattedMessages = messages.map((msg) =>
        this.messageFormatter.format(msg, mergedOptions)
      );

      // Show interactive selection
      if (mergedOptions.dryRun) {
        console.log(chalk.yellow('\n🔍 Dry run - Generated messages:'));
        formattedMessages.forEach((msg, index) => {
          console.log(chalk.cyan(`\n${index + 1}. ${msg}`));
        });
        await this.activityLogger.info('dry_run_completed', { messagesCount: formattedMessages.length });
        return;
      }

      const selectedMessage = await this.generator.selectMessage(formattedMessages);

      if (selectedMessage) {
        await this.gitManager.commit(selectedMessage);
        console.log(chalk.green('\n✅ Commit created successfully!'));

        // Update statistics
        await this.statsManager.recordCommit(
          mergedOptions.provider || config.defaultProvider
        );

        // Log successful commit
        await this.activityLogger.logGitOperation('commit', { 
          message: selectedMessage,
          success: true,
          duration: Date.now() - startTime,
        });

        // Update commit generation log with selected message
        await this.activityLogger.info('commit_completed', { 
          selectedMessage,
          messagesGenerated: messages.length,
        });
      }
    } catch (error) {
      spinner.fail(chalk.red(`❌ Failed to generate commit message: ${error.message}`));
      await this.activityLogger.logDetailedError(error, {
        operation: 'generate_commit',
        duration: Date.now() - startTime,
        provider: mergedOptions?.provider || (await this.configManager.get('defaultProvider')),
        diffLength: diff?.length,
        cacheEnabled: mergedOptions?.cache !== false,
        conventionalCommits: mergedOptions?.conventional,
      });

      // Provide helpful suggestions based on error type
      this.provideErrorSuggestions(error, mergedOptions);

      throw error;
    }
  }

  /**
   * Provide helpful suggestions based on error type
   */
  provideErrorSuggestions(error, options) {
    // If we move this to a utils file, we can refactor later
    if (error.message.includes('API key') || error.message.includes('authentication')) {
      console.log(chalk.yellow('\n💡 Suggestion: Check your AI provider API key in configuration'));
      console.log(chalk.yellow('   Run: aic config --set apiKey=your_key_here'));
    } else if (error.message.includes('rate limit') || error.message.includes('quota')) {
      console.log(chalk.yellow('\n💡 Suggestion: You have exceeded your API rate limit'));
      console.log(chalk.yellow('   Try again later or consider using Ollama (local) provider'));
    } else if (error.message.includes('timeout')) {
      console.log(chalk.yellow('\n💡 Suggestion: The request timed out'));
      console.log(chalk.yellow('   Try again with a smaller diff or check your internet connection'));
    } else if (error.message.includes('network')) {
      console.log(chalk.yellow('\n💡 Suggestion: Network error encountered'));
      console.log(chalk.yellow('   Check your internet connection and try again'));
    } else if (error.message.includes('model not found')) {
      console.log(chalk.yellow('\n💡 Suggestion: The specified AI model is not available'));
      console.log(chalk.yellow('   Check your provider configuration and available models'));
    }
  }
}

module.exports = GenerateCommand;