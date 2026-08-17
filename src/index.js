/**
 * AI Commit Message Generator - Main Class
 */

const chalk = require('chalk');
const ora = require('ora');
const GitManager = require('./core/git-manager');
const ConfigManager = require('./core/config-manager');
const AIProviderFactory = require('./providers/ai-provider-factory');
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
const CLIPresenter = require('./cli-presenter');
const ErrorHandler = require('./utils/error-handler');
const MetricsScorer = require('./utils/metrics-scorer');
const DiffShaper = require('./core/diff-shaper');

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
    this.efficientPromptBuilder = new EfficientPromptBuilder();
    this.metricsScorer = new MetricsScorer();
    this.errorHandler = new ErrorHandler();
    this.diffShaper = new DiffShaper();
    this.messageRanker = new MessageRanker();
    this.messageValidator = new MessageValidator();
    this.conflictResolver = new ConflictResolver({
      configManager: this.configManager,
      gitManager: this.gitManager,
      activityLogger: this.activityLogger,
    });
    this.cliPresenter = new CLIPresenter(this);
  }

  /**
   * Check if AI provider is available and configured
   */
  isAIAvailable(options = {}) {
    try {
      // Merge options with config to get effective configuration
      const config = this.configManager.getAll(); // Synchronous version for this check
      const provider = options.provider || config.defaultProvider || 'groq';

      // Check if provider is configured
      if (provider === 'ollama') {
        // For Ollama, we assume it's available if selected (user would have set it up)
        return true;
      }
      if (provider === 'groq') {
        // For Groq, check if API key is configured
        const apiKey = config.apiKey || process.env.GROQ_API_KEY;
        return !!apiKey && apiKey.trim().length > 0;
      }

      // For other providers, check if they have configuration
      return true;
    } catch (error) {
      // If we can't check configuration, assume not available to be safe
      return false;
    }
  }

  /**
   * Get AI-powered suggestion for an error
   */
  async getAISuggestion(error, options = {}) {
    try {
      // Get effective configuration
      const config = await this.configManager.getAll();
      const providerName = options.provider || config.defaultProvider || 'groq';

      // Create provider instance
      const provider = AIProviderFactory.create(providerName);

      // Build prompt for AI suggestion
      const prompt = `I encountered an error while trying to generate a git commit message.
Error: ${error.message}
Operation: ${options.operation || 'generate_commit'}
Context: ${providerName} provider was being used.

Please provide a short, 1-sentence actionable suggestion for the developer to fix this.
Do not explain the error, just provide the solution.`;

      // Generate response from AI provider
      const response = await provider.generateResponse(prompt, {
        maxTokens: 100,
      });

      // Extract and clean the suggestion
      if (response && typeof response === 'string') {
        // Clean up any extra whitespace or formatting
        let suggestion = response.trim();
        // Remove any numbering or bullet points that might be added
        suggestion = suggestion.replace(/^\d+\.?\s*/, '').replace(/^[-*]\s*/, '');
        // Ensure it's a reasonable length
        if (suggestion.length > 0 && suggestion.length < 200) {
          return suggestion;
        }
      }

      return null;
    } catch (aiError) {
      // Log AI failure for debugging but don't throw - we'll fall back to local suggestions
      await this.activityLogger.debug('ai_suggestion_failed', {
        error: aiError.message,
        provider: options.provider || 'unknown',
      });
      return null;
    }
  }

  identifyErrorType(error) {
    return this.errorHandler.identifyErrorType(error);
  }

  getLocalSuggestion(type) {
    return this.errorHandler.getLocalSuggestion(type);
  }

  async provideErrorSuggestions(error, options = {}) {
    return this.errorHandler.provideErrorSuggestions(error, options);
  }

  /**
   * Generate AI commit messages
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

          // Group by category for cleaner output
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

        // Generate commit messages with sequential fallback
        spinner.text = chalk.blue('🤖 Generating commit messages with AI...');
        messages = await this.generateWithSequentialFallback(diff, {
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

      const selectedMessage = await this.selectMessage(formattedMessages, mergedOptions);

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
   * Identify the type of error to provide better suggestions
   */

  /**
   * Interactive message selection
   */
  async selectMessage(messages, options = {}) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = prompt =>
      new Promise(resolve => {
        rl.question(prompt, resolve);
      });

    try {
      console.log(chalk.cyan('\n📝 Generated commit messages:'));

      const showScores = options.quiet !== true;
      const diff = options.diff || '';

      messages.forEach((msg, index) => {
        console.log(chalk.green(`${index + 1}. ${msg}`));
        if (showScores) {
          const score = this.metricsScorer.calculateOverallScore(msg, diff);
          const { category, color } = this.metricsScorer.categorizeScore(score);
          console.log(chalk[color](`   └─ Score: ${score}/100 (${category})`));
        }
      });

      console.log(chalk.gray(`${messages.length + 1}. 🔄 Regenerate messages`));
      console.log(chalk.gray(`${messages.length + 2}. ✏️  Write custom message`));
      console.log(chalk.gray(`${messages.length + 3}. ❌ Cancel`));

      const choice = await question(`\nSelect option (1-${messages.length + 3}, default: 1): `);
      const choiceNum = parseInt(choice) || 1;

      if (choiceNum === messages.length + 3) {
        console.log(chalk.yellow('Commit cancelled.'));
        return null;
      }

      if (choiceNum === messages.length + 1) {
        console.log(chalk.yellow('Regenerating commit messages...'));
        rl.close();
        // Return special value to trigger regeneration
        return 'regenerate';
      }

      if (choiceNum === messages.length + 2) {
        const customMessage = await question('Enter your custom commit message: ');
        if (!customMessage.trim()) {
          console.log(chalk.red('Message cannot be empty'));
          return null;
        }
        rl.close();
        return customMessage.trim();
      }

      if (choiceNum >= 1 && choiceNum <= messages.length) {
        rl.close();
        return messages[choiceNum - 1];
      }

      console.log(chalk.red('Invalid choice'));
      rl.close();
      return null;
    } catch (error) {
      rl.close();
      this.provideErrorSuggestions(error);
      throw error;
    }
  }

  /**
   * Configuration management
   */
  async config(options) {
    if (options.set) {
      const [key, value] = options.set.split('=');
      await this.configManager.set(key, value);
      console.log(chalk.green(`✅ Configuration updated: ${key} = ${value}`));
    } else if (options.get) {
      const value = await this.configManager.get(options.get);
      console.log(`${options.get}: ${value || 'not set'}`);
    } else if (options.list || (!options.set && !options.get && !options.reset)) {
      const config = await this.configManager.load();
      console.log(chalk.cyan('Current configuration:'));
      Object.entries(config).forEach(([key, value]) => {
        // Never print secrets in plaintext
        const display = key === 'apiKey' && value ? '***configured***' : value;
        console.log(`  ${key}: ${display}`);
      });
    } else if (options.reset) {
      await this.configManager.reset();
      console.log(chalk.green('✅ Configuration reset to defaults'));
    }
  }

  /**
   * Interactive setup wizard
   */
  async setup() {
    console.log(chalk.cyan('🚀 AI Commit Generator Setup Wizard\n'));

    // Simple command-line setup (compatible with Node.js v25)
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = prompt =>
      new Promise(resolve => {
        rl.question(prompt, resolve);
      });

    try {
      console.log('Select your preferred AI provider:');
      console.log('1. Groq (Fast Cloud)');
      console.log('2. Ollama (Local)');

      const providerChoice = await question('Enter choice (1-2, default: 1): ');
      const provider = providerChoice === '2' ? 'ollama' : 'groq';

      let apiKey = '';
      if (provider !== 'ollama') {
        apiKey = await question('Enter your Groq API key: ');
        if (!apiKey.trim()) {
          console.log(chalk.red('❌ API key is required for Groq'));
          rl.close();
          return;
        }
      }

      const conventionalChoice = await question(
        'Use conventional commit format? (Y/n, default: Y): '
      );
      const conventionalCommits = conventionalChoice.toLowerCase() !== 'n';

      console.log('Select commit message language:');
      console.log('1. English');
      console.log('2. Spanish');
      console.log('3. French');
      console.log('4. German');
      console.log('5. Chinese');
      console.log('6. Japanese');

      const langChoice = await question('Enter choice (1-6, default: 1): ');
      const languages = {
        1: 'en',
        2: 'es',
        3: 'fr',
        4: 'de',
        5: 'zh',
        6: 'ja',
      };
      const language = languages[langChoice] || 'en';

      // Save configuration
      await this.configManager.setMultiple({
        defaultProvider: provider,
        apiKey,
        conventionalCommits,
        language,
      });

      console.log(chalk.green('\n✅ Setup completed successfully!'));
      console.log(chalk.cyan('You can now use "aic" to generate commit messages.'));
    } catch (error) {
      console.error(chalk.red('Setup failed:'), error.message);
    } finally {
      rl.close();
    }
  }

  /**
   * Git hook management
   */
  async hook(options) {
    if (options.install) {
      await this.hookManager.install();
      console.log(chalk.green('✅ Git hook installed successfully!'));
    } else if (options.uninstall) {
      await this.hookManager.uninstall();
      console.log(chalk.green('✅ Git hook uninstalled successfully!'));
    } else {
      console.log(chalk.yellow('Please specify --install or --uninstall'));
    }
  }

  /**
   * Select best commit messages from chunked results
   */
  selectBestMessages(messages, count = 3, diff = null) {
    return this.messageRanker.selectBestMessages(messages, count, diff);
  }

  /**
   * Score a commit message for quality
   */
  scoreCommitMessage(message, diff = null) {
    return this.messageRanker.scoreCommitMessage(message, diff);
  }

  /**
   * Generate commit messages with sequential fallback (preferred provider first, then backup)
   */
  async generateWithSequentialFallback(diff, options) {
    const { preferredProvider, context, ...generationOptions } = options;

    // Determine providers to use - preferred first, then fallback
    const allProviders = ['ollama', 'groq'];
    const providers = preferredProvider
      ? [preferredProvider, ...allProviders.filter(p => p !== preferredProvider)]
      : allProviders;

    const mode = preferredProvider ? 'sequential fallback' : 'parallel';
    console.log(chalk.blue(`🤖 Using ${mode} provider mode...`));

    // Enrich options with context first
    const enrichedOptions = {
      ...generationOptions,
      context: {
        ...context,
        hasSemanticContext: !!(
          context?.files?.semantic && Object.keys(context.files.semantic).length > 0
        ),
      },
    };

    // Step 1: Intelligent diff management with semantic context
    const diffManagement = this.manageDiffForAI(diff, enrichedOptions);
    console.log(chalk.blue(`📊 Diff strategy: ${diffManagement.info.strategy}`));
    console.log(chalk.dim(`   Reasoning: ${diffManagement.info.reasoning}`));

    // Step 2: Use sequential fallback mode
    return await this.generateWithSequentialProviders(diffManagement, enrichedOptions, providers);
  }

  /**
   * Generate commit messages with sequential provider processing (with fallback)
   */
  async generateWithSequentialProviders(diffManagement, options, providers) {
    const startTime = Date.now();

    // Try providers sequentially
    for (const providerName of providers) {
      try {
        const startProviderTime = Date.now();
        const provider = AIProviderFactory.create(providerName);

        let messages;
        let actualPrompt;

        // Handle different diff strategies
        if (diffManagement.strategy === 'full' || diffManagement.strategy === 'smart-truncated') {
          // Simple case: diff in one prompt (full or smart-truncated)
          const prompt = provider.buildPrompt(diffManagement.data, options);
          messages = await provider.generateCommitMessages(diffManagement.data, options);
          actualPrompt = prompt;
        } else {
          // Complex case: chunked processing
          console.log(
            chalk.blue(`📦 Processing ${diffManagement.chunks} chunks with ${providerName}...`)
          );

          const chunkMessages = [];

          for (let i = 0; i < diffManagement.data.length; i++) {
            const chunk = diffManagement.data[i];
            const isLastChunk = i === diffManagement.data.length - 1;

            const chunkOptions = {
              ...options,
              chunkIndex: i,
              totalChunks: diffManagement.data.length,
              isLastChunk,
              chunkContext: isLastChunk ? 'final' : i === 0 ? 'initial' : 'middle',
              // Add chunk-specific context
              context: {
                ...options.context,
                chunkInfo: {
                  index: i,
                  total: diffManagement.data.length,
                  size: chunk.size,
                  files: chunk.context.files,
                  functions: chunk.context.functions,
                  classes: chunk.context.classes,
                  hasSignificantChanges: chunk.context.hasSignificantChanges,
                },
              },
            };

            // Generate with this chunk
            const chunkPrompt = provider.buildPrompt(chunk.content, chunkOptions);
            const chunkResult = await provider.generateCommitMessages(chunk.content, chunkOptions);

            if (chunkResult && chunkResult.length > 0) {
              chunkMessages.push(...chunkResult);

              // Log the actual prompt for this chunk
              await this.activityLogger.logAIInteraction(
                providerName,
                'commit_generation_chunk',
                chunkPrompt,
                chunkResult[0], // Log first message
                Date.now() - startProviderTime,
                true
              );
            }
          }

          messages = this.selectBestMessages(chunkMessages, options.count || 3);
          actualPrompt = `Chunked processing (${diffManagement.chunks} chunks)`;
        }

        const responseTime = Date.now() - startProviderTime;

        if (messages && messages.length > 0) {
          await this.statsManager.recordCommit(providerName);

          console.log(
            chalk.green(
              `✅ ${providerName} generated ${messages.length} messages in ${responseTime}ms`
            )
          );

          // Log the actual interaction with full prompt
          await this.activityLogger.logAIInteraction(
            providerName,
            'commit_generation',
            actualPrompt,
            messages.join('\n'),
            responseTime,
            true
          );

          // Log diff management info
          await this.activityLogger.info('diff_management', {
            ...diffManagement.info,
            provider: providerName,
            responseTime,
            success: true,
          });

          // Log context usage for debugging
          if (options.context.hasSemanticContext) {
            console.log(chalk.blue(`🧠 Used semantic context for ${providerName}`));
          }

          // QUAL-01/QUAL-02 quality gates (observability)
          const batch = this.messageValidator.validateBatch(messages);
          const thresholds = this.messageValidator.checkQualityThresholds(batch);
          await this.activityLogger.info('quality_gates', {
            provider: providerName,
            stats: batch.stats,
            thresholds,
          });

          return messages;
        }
      } catch (error) {
        const responseTime = Date.now() - startTime;

        console.warn(chalk.yellow(`⚠️  ${providerName} provider failed: ${error.message}`));

        // Log failed interaction
        await this.activityLogger.logAIInteraction(
          providerName,
          'commit_generation',
          diffManagement.strategy === 'full' || diffManagement.strategy === 'smart-truncated'
            ? diffManagement.data
            : `Chunked processing (${diffManagement.chunks} chunks)`,
          null,
          responseTime,
          false
        );

        // Log diff management info for failure
        await this.activityLogger.info('diff_management', {
          ...diffManagement.info,
          provider: providerName,
          responseTime,
          success: false,
          error: error.message,
        });

        // Continue to next provider in sequence
        continue;
      }
    }

    throw new Error('All AI providers failed to generate commit messages.');
  }

  /**
   * Intelligently merge results from multiple AI providers
   */

  /**
   * Intelligent diff management for optimal AI generation
   * Smart truncation that preserves file headers and prioritizes significant changes
   */
  manageDiffForAI(diff, options = {}) {
    return this.diffShaper.manageDiffForAI(diff, options);
  }

  /**
   * Parse conflict markers from content and extract both versions
   */
  parseConflictBlocks(content) {
    return this.conflictResolver.parseConflictBlocks(content);
  }

  /**
   * Resolve a single conflict block using AI
   */
  async resolveConflictWithAI(filePath, currentVersion, incomingVersion, language = 'javascript') {
    return this.conflictResolver.resolveConflictWithAI(filePath, currentVersion, incomingVersion, language);
  }

  /**
   * Detect and clean up conflict markers in all staged files using AI
   */
  async detectAndCleanupConflictMarkers() {
    return this.conflictResolver.detectAndCleanupConflictMarkers();
  }

  /**
   * Clean conflict markers from content string (simple version - keeps HEAD)
   */
  cleanConflictMarkers(content) {
    return this.conflictResolver.cleanConflictMarkers(content);
  }

  /**
   * Show usage statistics
   */
  async stats(options) {
    if (options.reset) {
      await this.statsManager.reset();
      console.log(chalk.green('✅ Statistics reset successfully!'));
      return;
    }

    if (options.analyze) {
      const analysis = await this.activityLogger.analyzeLogs(options.days || 30);
      this.displayLogAnalysis(analysis);
      return;
    }

    if (options.export) {
      const format = options.format || 'json';
      const exportData = await this.activityLogger.exportLogs(options.days || 30, format);

      if (format === 'json') {
        console.log(JSON.stringify(JSON.parse(exportData), null, 2));
      } else {
        console.log(exportData);
      }
      return;
    }

    const stats = await this.statsManager.getStats();
    console.log(chalk.cyan('\n📊 Usage Statistics:'));
    console.log(`Total commits: ${stats.totalCommits}`);
    console.log(`Most used provider: ${stats.mostUsedProvider}`);
    console.log(`Average response time: ${stats.averageResponseTime}ms`);
    console.log(`Cache hit rate: ${stats.cacheHitRate}%`);
  }

  /**
   * Display log analysis results
   */
  displayLogAnalysis(analysis) {
    console.log(chalk.cyan('\n📈 Activity Analysis (Last 30 days):'));

    console.log(chalk.yellow('\n🔥 Usage Metrics:'));
    console.log(`  Total Sessions: ${analysis.totalSessions}`);
    console.log(`  AI Interactions: ${analysis.aiInteractions}`);
    console.log(`  Successful Commits: ${analysis.successfulCommits}`);
    console.log(`  Conflict Resolutions: ${analysis.conflictResolutions}`);

    console.log(chalk.yellow('\n🤖 Provider Usage:'));
    Object.entries(analysis.providerUsage).forEach(([provider, count]) => {
      console.log(
        `  ${provider}: ${count} (${Math.round((count / analysis.aiInteractions) * 100)}%)`
      );
    });

    if (analysis.averageResponseTime > 0) {
      console.log(chalk.yellow('\n⚡ Performance:'));
      console.log(`  Average Response Time: ${analysis.averageResponseTime}ms`);
    }

    if (Object.keys(analysis.messagePatterns).length > 0) {
      console.log(chalk.yellow('\n📝 Commit Patterns:'));
      Object.entries(analysis.messagePatterns)
        .sort(([, a], [, b]) => b - a)
        .forEach(([type, count]) => {
          const percentage = Math.round((count / analysis.successfulCommits) * 100);
          console.log(`  ${type}: ${count} (${percentage}%)`);
        });
    }

    if (Object.keys(analysis.commonErrors).length > 0) {
      console.log(chalk.yellow('\n❌ Common Errors:'));
      Object.entries(analysis.commonErrors)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .forEach(([error, count]) => {
          console.log(`  ${error}: ${count}`);
        });
    }

    if (Object.keys(analysis.peakUsageHours).length > 0) {
      console.log(chalk.yellow('\n🕐 Peak Usage Hours:'));
      Object.entries(analysis.peakUsageHours)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .forEach(([hour, count]) => {
          console.log(`  ${hour.toString().padStart(2, '0')}:00 - ${count} interactions`);
        });
    }

    console.log(chalk.dim('\n💡 Tip: Use --export to get detailed data for further analysis'));
  }
}

module.exports = AICommitGenerator; // Test change for prompt improvement
// Fix timeout handling to prevent null errors
