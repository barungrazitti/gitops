/**
 * AI Commit Message Generator - wiring and orchestration entry point.
 *
 * Two deep modules sit behind this class:
 *  - GenerationPipeline (src/core/generation-pipeline.js): generate(diff, options) → messages
 *  - CLIPresenter (src/cli-presenter.js): all console interaction
 * Generation bugs live in the pipeline; UI bugs live in the presenter.
 */

const chalk = require('chalk');
const ora = require('ora');
const GitManager = require('./core/git-manager');
const ConfigManager = require('./core/config-manager');
const CacheManager = require('./core/cache-manager');
const AnalysisEngine = require('./core/analysis-engine');
const MessageFormatter = require('./core/message-formatter');
const MessageRanker = require('./core/message-ranker');
const MessageValidator = require('./core/message-validator');
const ConflictResolver = require('./core/conflict-resolver');
const StatsManager = require('./core/stats-manager');
const HookManager = require('./core/hook-manager');
const ActivityLogger = require('./core/activity-logger');
const SecretScanner = require('./utils/secret-scanner');
const EfficientPromptBuilder = require('./utils/efficient-prompt-builder');
const ErrorHandler = require('./utils/error-handler');
const MetricsScorer = require('./utils/metrics-scorer');
const DiffShaper = require('./core/diff-shaper');
const GenerationPipeline = require('./core/generation-pipeline');
const CLIPresenter = require('./cli-presenter');
const AIProviderFactory = require('./providers/ai-provider-factory');

class AICommitGenerator {
  constructor() {
    this.gitManager = new GitManager();
    this.configManager = new ConfigManager();
    this.cacheManager = new CacheManager();
    this.analysisEngine = new AnalysisEngine();
    this.messageFormatter = new MessageFormatter();
    this.statsManager = new StatsManager();
    this.hookManager = new HookManager();
    this.activityLogger = new ActivityLogger();
    this.diffShaper = new DiffShaper();
    this.messageRanker = new MessageRanker();
    this.messageValidator = new MessageValidator();
    this.metricsScorer = new MetricsScorer();
    this.errorHandler = new ErrorHandler(this);
    this.aiProviderFactory = AIProviderFactory;
    this.conflictResolver = new ConflictResolver({
      configManager: this.configManager,
      gitManager: this.gitManager,
      activityLogger: this.activityLogger,
    });

    this.generationPipeline = new GenerationPipeline({
      diffShaper: this.diffShaper,
      promptBuilder: new EfficientPromptBuilder({ diffShaper: this.diffShaper }),
      messageRanker: this.messageRanker,
      messageValidator: this.messageValidator,
      activityLogger: this.activityLogger,
      statsManager: this.statsManager,
    });

    this.cliPresenter = new CLIPresenter({
      configManager: this.configManager,
      statsManager: this.statsManager,
      activityLogger: this.activityLogger,
      hookManager: this.hookManager,
      metricsScorer: this.metricsScorer,
    });
  }

  /**
   * Check if AI provider is available and configured
   */
  isAIAvailable(options = {}) {
    try {
      const config = this.configManager.getAll(); // Synchronous version for this check
      const provider = options.provider || config.defaultProvider || 'groq';

      if (provider === 'ollama') {
        return true;
      }
      if (provider === 'groq') {
        const apiKey = config.apiKey || process.env.GROQ_API_KEY;
        return !!apiKey && apiKey.trim().length > 0;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get AI-powered suggestion for an error
   */
  async getAISuggestion(error, options = {}) {
    try {
      const config = await this.configManager.getAll();
      const providerName = options.provider || config.defaultProvider || 'groq';

      const provider = this.aiProviderFactory.create(providerName);

      const prompt = `I encountered an error while trying to generate a git commit message.
Error: ${error.message}
Operation: ${options.operation || 'generate_commit'}
Context: ${providerName} provider was being used.

Please provide a short, 1-sentence actionable suggestion for the developer to fix this.
Do not explain the error, just provide the solution.`;

      const response = await provider.generateResponse(prompt, {
        maxTokens: 100,
      });

      if (response && typeof response === 'string') {
        let suggestion = response.trim();
        // Remove any numbering or bullet points that might be added
        suggestion = suggestion.replace(/^\d+\.?\s*/, '').replace(/^[-*]\s*/, '');
        if (suggestion.length > 0 && suggestion.length < 200) {
          return suggestion;
        }
      }

      return null;
    } catch (aiError) {
      // Log AI failure for debugging but don't throw - fall back to local suggestions
      await this.activityLogger.debug('ai_suggestion_failed', {
        error: aiError.message,
        provider: options.provider || 'unknown',
      });
      return null;
    }
  }

  async provideErrorSuggestions(error, options = {}) {
    return this.errorHandler.provideErrorSuggestions(error, options);
  }

  /**
   * Generate AI commit messages (orchestration: repo → diff → sanitize →
   * cache → pipeline → format → select → commit)
   */
  async generate(options = {}) {
    const spinner = ora({
      text: chalk.blue('🚀 Initializing AI commit generator...'),
      spinner: 'clock',
    }).start();
    const startTime = Date.now();
    let mergedOptions = {};
    const diff = '';

    try {
      await this.activityLogger.info('generate_started', { options });

      // Load configuration
      const config = await this.configManager.load();
      mergedOptions = { ...config, ...options };

      // Validate git repository
      spinner.text = chalk.blue('🔍 Checking git repository...');
      await this.gitManager.validateRepository();
      await this.activityLogger.logGitOperation('validate_repository', {
        success: true,
      });

      // Get staged changes
      spinner.text = chalk.blue('📋 Analyzing staged changes...');
      let diff = await this.gitManager.getStagedDiff();

      if (!diff || diff.trim().length === 0) {
        spinner.fail(chalk.red('❌ No staged changes found. Please stage your changes first.'));
        await this.activityLogger.warn('generate_failed', {
          reason: 'no_staged_changes',
        });
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
          console.log(
            chalk.yellow(`\n⚠️  Found and redacted ${redactionSummary.redacted} sensitive item(s):`)
          );

          const categories = Object.entries(redactionSummary.byCategory || {});
          if (categories.length > 0) {
            categories.forEach(([category, count]) => {
              const categoryEmoji = category === 'pii' ? '👤' : '🔑';
              console.log(
                chalk.gray(`   ${categoryEmoji} ${category.toUpperCase()}: ${count} item(s)`)
              );
            });
          }

          // Log to activity logger for audit trail
          await this.activityLogger.warn('sensitive_data_redacted', {
            redacted: redactionSummary.redacted,
            byCategory: redactionSummary.byCategory,
            byType: redactionSummary.byType,
            originalSize: originalLength,
            sanitizedSize: diff.length,
          });

          spinner.text = chalk.blue('🤖 Generating commit messages with AI...');
        } else {
          await this.activityLogger.info('no_secrets_found', {
            diffLength: diff.length,
          });
        }

        secretScanner.clearRedactionLog();
      }

      // Advanced cache check with semantic similarity
      let messages = [];
      if (mergedOptions.cache !== false) {
        spinner.text = chalk.blue('💾 Checking for cached results...');
        messages = await this.cacheManager.getValidated(diff);
        if (messages && messages.length > 0) {
          await this.activityLogger.debug('cache_hit', {
            diffLength: diff.length,
          });
          spinner.succeed(chalk.green('✅ Found cached results'));
        } else {
          await this.activityLogger.debug('cache_miss', {
            diffLength: diff.length,
          });
        }
      }

      // Advanced analysis and generation with intelligent merging
      if (!messages || messages.length === 0) {
        // Analyze repository context
        spinner.text = chalk.blue('🧩 Analyzing repository context...');
        const context = await this.analysisEngine.analyzeRepository();

        // Generate commit messages via the pipeline (sequential fallback inside)
        spinner.text = chalk.blue('🤖 Generating commit messages with AI...');
        messages = await this.generationPipeline.generate(diff, {
          context,
          count: parseInt(mergedOptions.count) || 1,
          type: mergedOptions.type,
          language: mergedOptions.language || 'en',
          conventional: mergedOptions.conventional || config.conventionalCommits,
          preferredProvider: mergedOptions.provider || config.defaultProvider,
        });

        // Cache results
        if (mergedOptions.cache !== false) {
          await this.cacheManager.setValidated(diff, messages);
        }
      }

      spinner.succeed(chalk.green('✅ Commit messages generated successfully!'));

      // Format messages
      const formattedMessages = messages.map(msg =>
        this.messageFormatter.format(msg, mergedOptions)
      );

      // Show interactive selection
      if (mergedOptions.dryRun) {
        console.log(chalk.yellow('\n🔍 Dry run - Generated messages:'));
        formattedMessages.forEach((msg, index) => {
          console.log(chalk.cyan(`\n${index + 1}. ${msg}`));
        });
        await this.activityLogger.info('dry_run_completed', {
          messagesCount: formattedMessages.length,
        });
        return;
      }

      const selectedMessage = await this.cliPresenter.selectMessage(formattedMessages, {
        ...mergedOptions,
        diff,
      });

      if (selectedMessage) {
        await this.gitManager.commit(selectedMessage);
        console.log(chalk.green('\n✅ Commit created successfully!'));

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
   * CLI commands - UI delegated to CLIPresenter
   */
  async config(options) {
    return this.cliPresenter.config(options);
  }

  async setup() {
    return this.cliPresenter.setup();
  }

  async hook(options) {
    return this.cliPresenter.hook(options);
  }

  async stats(options) {
    return this.cliPresenter.stats(options);
  }
}

module.exports = AICommitGenerator;
