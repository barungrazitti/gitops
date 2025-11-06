/**
 * AI Commit Message Generator - Main Class
 */

const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const GitManager = require('./core/git-manager');
const ConfigManager = require('./core/config-manager');
const AIProviderFactory = require('./providers/ai-provider-factory');
const CacheManager = require('./core/cache-manager');
const AnalysisEngine = require('./core/analysis-engine');
const MessageFormatter = require('./core/message-formatter');
const StatsManager = require('./core/stats-manager');
const HookManager = require('./core/hook-manager');
const ActivityLogger = require('./core/activity-logger');
const fs = require('fs-extra');

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
  }

  /**
   * Generate AI commit messages
   */
  async generate(options = {}) {
    const spinner = ora('Initializing AI commit generator...').start();
    const startTime = Date.now();

    try {
      await this.activityLogger.info('generate_started', { options });

      // Load configuration
      const config = await this.configManager.load();
      const mergedOptions = { ...config, ...options };

      // Validate git repository
      spinner.text = 'Checking git repository...';
      await this.gitManager.validateRepository();
      await this.activityLogger.logGitOperation('validate_repository', { success: true });

      // Get staged changes
      spinner.text = 'Analyzing staged changes...';
      const diff = await this.gitManager.getStagedDiff();

      if (!diff || diff.trim().length === 0) {
        spinner.fail(
          'No staged changes found. Please stage your changes first.'
        );
        await this.activityLogger.warn('generate_failed', { reason: 'no_staged_changes' });
        return;
      }

      // Check cache with enhanced validation
      let messages = [];
      if (mergedOptions.cache !== false) {
        spinner.text = 'Checking cache...';
        messages = await this.cacheManager.getValidated(diff);
        if (messages && messages.length > 0) {
          await this.activityLogger.debug('cache_hit', { diffLength: diff.length });
        } else {
          await this.activityLogger.debug('cache_miss', { diffLength: diff.length });
        }
      }

      // Advanced analysis and generation with intelligent merging
      if (!messages || messages.length === 0) {
        // Analyze repository context
        spinner.text = 'Analyzing repository context...';
        const context = await this.analysisEngine.analyzeRepository();

        // Generate commit messages with intelligent merging
        spinner.text = 'Generating commit messages with AI...';
        messages = await this.generateWithIntelligentMerging(diff, {
          context,
          count: parseInt(mergedOptions.count) || 3,
          type: mergedOptions.type,
          language: mergedOptions.language || 'en',
          conventional:
            mergedOptions.conventional || config.conventionalCommits,
          preferredProvider: mergedOptions.provider || config.defaultProvider,
        });

        // Cache results with validation
        if (mergedOptions.cache !== false) {
          await this.cacheManager.setValidated(diff, messages);
        }
      }

      spinner.succeed('Commit messages generated successfully!');

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

      const selectedMessage = await this.selectMessage(formattedMessages);

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
      spinner.fail(`Failed to generate commit message: ${error.message}`);
      await this.activityLogger.error('generate_failed', { 
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Interactive message selection
   */
  async selectMessage(messages) {
    const choices = [
      ...messages.map((msg, index) => ({
        name: `${index + 1}. ${msg}`,
        value: msg,
        short: `Message ${index + 1}`,
      })),
      {
        name: chalk.gray('🔄 Regenerate messages'),
        value: 'regenerate',
      },
      {
        name: chalk.gray('✏️  Write custom message'),
        value: 'custom',
      },
      {
        name: chalk.gray('❌ Cancel'),
        value: 'cancel',
      },
    ];

    const { selectedMessage } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedMessage',
        message: 'Select a commit message:',
        choices,
        pageSize: 10,
      },
    ]);

    if (selectedMessage === 'cancel') {
      console.log(chalk.yellow('Commit cancelled.'));
      return null;
    }

    if (selectedMessage === 'regenerate') {
      // TODO: Implement regeneration logic
      console.log(chalk.yellow('Regeneration not implemented yet.'));
      return null;
    }

    if (selectedMessage === 'custom') {
      const { customMessage } = await inquirer.prompt([
        {
          type: 'input',
          name: 'customMessage',
          message: 'Enter your custom commit message:',
          validate: (input) =>
            input.trim().length > 0 || 'Message cannot be empty',
        },
      ]);
      return customMessage;
    }

    return selectedMessage;
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
    } else if (options.list) {
      const config = await this.configManager.load();
      console.log(chalk.cyan('Current configuration:'));
      Object.entries(config).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
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

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'provider',
        message: 'Select your preferred AI provider:',
        choices: [
          { name: 'Groq (Fast Cloud)', value: 'groq' },
          { name: 'Ollama (Local)', value: 'ollama' },
        ],
      },
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your API key:',
        when: (answers) => answers.provider !== 'ollama',
        validate: (input) => input.trim().length > 0 || 'API key is required',
      },
      {
        type: 'confirm',
        name: 'conventionalCommits',
        message: 'Use conventional commit format?',
        default: true,
      },
      {
        type: 'list',
        name: 'language',
        message: 'Select commit message language:',
        choices: [
          { name: 'English', value: 'en' },
          { name: 'Spanish', value: 'es' },
          { name: 'French', value: 'fr' },
          { name: 'German', value: 'de' },
          { name: 'Chinese', value: 'zh' },
          { name: 'Japanese', value: 'ja' },
        ],
        default: 'en',
      },
    ]);

    // Save configuration
    await this.configManager.setMultiple({
      defaultProvider: answers.provider,
      apiKey: answers.apiKey,
      conventionalCommits: answers.conventionalCommits,
      language: answers.language,
    });

    console.log(chalk.green('\n✅ Setup completed successfully!'));
    console.log(
      chalk.cyan('You can now use "aicommit" to generate commit messages.')
    );
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
   * Chunk large diffs into smaller pieces for AI processing
   */
  /**
   * Smart chunking that respects semantic boundaries
   */
  chunkDiff(diff, maxTokens = 6000) {
    const lines = diff.split('\n');
    const chunks = [];
    let currentChunk = [];
    let currentTokens = 0;

    // Rough estimation: 1 token ≈ 4 characters
    const estimateTokens = (text) => Math.ceil(text.length / 4);

    // Helper to detect semantic boundaries
    const isSemanticBoundary = (line) => {
      return line.startsWith('diff --git') ||
        line.startsWith('index ') ||
        line.startsWith('---') ||
        line.startsWith('+++') ||
        (line.startsWith('@@') && currentChunk.length > 10) || // New hunk with existing content
        (/^(function|class|def|const|let|var)\s+\w+/.test(line) && currentChunk.length > 5);
    };

    // Helper to find good break point near token limit
    const findBreakPoint = (startIdx, maxTokens) => {
      let tokenCount = 0;
      let bestBreakIdx = startIdx;
      
      for (let i = startIdx; i < lines.length; i++) {
        tokenCount += estimateTokens(lines[i]);
        
        if (tokenCount > maxTokens) {
          break;
        }
        
        // Prefer breaking at semantic boundaries
        if (isSemanticBoundary(lines[i])) {
          bestBreakIdx = i;
        }
      }
      
      return bestBreakIdx;
    };

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const lineTokens = estimateTokens(line);

      // If single line is extremely large, split it
      if (lineTokens > maxTokens) {
        // Flush current chunk if it has content
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join('\n'));
          currentChunk = [];
          currentTokens = 0;
        }

        // Split large line into smaller pieces
        const chunksNeeded = Math.ceil(lineTokens / maxTokens);
        const chunkSize = Math.ceil(line.length / chunksNeeded);

        for (let j = 0; j < chunksNeeded; j++) {
          const start = j * chunkSize;
          const end = Math.min(start + chunkSize, line.length);
          chunks.push(line.substring(start, end));
        }
        i++;
        continue;
      }

      // Check if we need to start a new chunk
      if (currentTokens + lineTokens > maxTokens && currentChunk.length > 0) {
        // Find a good break point if possible
        const breakIdx = findBreakPoint(i, maxTokens - currentTokens);
        
        if (breakIdx > i) {
          // Add lines up to break point
          for (; i <= breakIdx && i < lines.length; i++) {
            currentChunk.push(lines[i]);
            currentTokens += estimateTokens(lines[i]);
          }
        }
        
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
        currentTokens = 0;
        continue;
      }

      // Add line to current chunk
      currentChunk.push(line);
      currentTokens += lineTokens;
      i++;
    }

    // Add last chunk if it has content
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks;
  }

  /**
   * Select best commit messages from chunked results
   */
  selectBestMessages(messages, count = 3) {
    if (!messages || messages.length === 0) return [];

    // Remove duplicates
    const uniqueMessages = [...new Set(messages)];

    // Score messages based on quality factors
    const scored = uniqueMessages.map((msg) => ({
      message: msg,
      score: this.scoreCommitMessage(msg),
    }));

    // Sort by score and take best ones
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, count).map((item) => item.message);
  }

  /**
   * Score a commit message based on quality factors
   */
  scoreCommitMessage(message) {
    let score = 0;

    // Prefer conventional commit format
    if (
      /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?:/.test(
        message
      )
    ) {
      score += 10;
    }

    // Prefer reasonable length (not too short, not too long)
    const length = message.length;
    if (length >= 20 && length <= 100) {
      score += 5;
    } else if (length >= 10 && length <= 150) {
      score += 2;
    }

    // Prefer messages with proper capitalization
    if (
      message[0] === message[0].toUpperCase() &&
      message[0] !== message[0].toLowerCase()
    ) {
      score += 2;
    }

    // Prefer messages without period at the end (conventional commit standard)
    if (!message.endsWith('.')) {
      score += 1;
    }

    // REWARD specific technical terms
    const specificPatterns = [
      /\b[A-Z][a-zA-Z]*\b/, // Class names
      /\b\w+\(\)/, // Function calls
      /\b(add|create|implement|remove|delete|update)\s+\w+/i, // Specific actions
      /\b(class|function|const|let|var)\s+\w+/i, // Code constructs
    ];

    specificPatterns.forEach((pattern) => {
      if (pattern.test(message)) {
        score += 3;
      }
    });

    // HEAVILY PENALIZE generic messages
    const genericPatterns = [
      /\b(add|update|fix|change|modify|remove)\s+(functionality|features?|code|files?)\b/i,
      /\b(new|additional|extra)\s+(stuff|things|items)\b/i,
      /\b(general|misc|various|multiple)\s+(changes|updates|fixes)\b/i,
    ];

    genericPatterns.forEach((pattern) => {
      if (pattern.test(message)) {
        score -= 5;
      }
    });

    // Penalize very short, non-specific messages
    if (message.split(' ').length <= 3 && !/[A-Z]\w+/.test(message)) {
      score -= 3;
    }

    return score;
  }

  /**
   * Build prompt using base provider logic
   */
  buildPrompt(diff, options) {
    const BaseProvider = require('./providers/base-provider');
    const tempProvider = new BaseProvider();
    return tempProvider.buildPrompt(diff, options);
  }

  /**
   * Generate commit messages with intelligent merging
   */
  async generateWithIntelligentMerging(diff, options) {
    const { preferredProvider, context, ...generationOptions } = options;
    const providers = ['ollama', 'groq'];
    
    console.log(chalk.blue('🤖 Running intelligent AI merging...'));
    
    // Enrich options with enhanced context
    const enrichedOptions = {
      ...generationOptions,
      context: {
        ...context,
        enhanced: true,
        semanticAnalysis: context?.files?.semantic || {},
        hasSemanticContext: !!(
          context?.files?.semantic &&
          Object.keys(context.files.semantic).length > 0
        ),
      },
    };

    // Try to use both providers in parallel for intelligent merging
    const allProviderResults = {};
    let successfulProviders = [];

    for (const providerName of providers) {
      try {
        const provider = AIProviderFactory.create(providerName);
        
        // Check if diff is too large and needs chunking
        const estimatedTokens = Math.ceil(diff.length / 4);
        let messages;

        if (estimatedTokens > 4000) {
          console.log(
            chalk.blue(
              `📦 Chunking large diff for ${providerName}...`
            )
          );

          const chunks = this.chunkDiff(diff, 3000);
          const chunkMessages = [];

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const isLastChunk = i === chunks.length - 1;

            const chunkOptions = {
              ...enrichedOptions,
              chunkIndex: i,
              totalChunks: chunks.length,
              isLastChunk,
              chunkContext: isLastChunk ? 'final' : i === 0 ? 'initial' : 'middle',
            };

            const chunkResult = await provider.generateCommitMessages(chunk, chunkOptions);
            if (chunkResult && chunkResult.length > 0) {
              chunkMessages.push(...chunkResult);
            }
          }

          messages = this.selectBestMessages(chunkMessages, generationOptions.count || 5);
        } else {
          messages = await provider.generateCommitMessages(diff, enrichedOptions);
        }

        if (messages && messages.length > 0) {
          allProviderResults[providerName] = messages;
          successfulProviders.push(providerName);
          
          console.log(
            chalk.green(`✅ ${providerName} generated ${messages.length} messages`)
          );
        }
      } catch (error) {
        console.warn(
          chalk.yellow(`⚠️  ${providerName} provider failed: ${error.message}`)
        );
      }
    }

    // Intelligent merging logic
    if (successfulProviders.length === 0) {
      throw new Error('All AI providers failed to generate commit messages');
    }

    if (successfulProviders.length === 1) {
      // Only one provider worked, use its results
      const providerName = successfulProviders[0];
      await this.statsManager.recordCommit(providerName);
      return allProviderResults[providerName];
    }

    // Multiple providers succeeded - intelligent merging
    console.log(chalk.cyan('🧠 Merging results from multiple providers...'));
    
    const mergedMessages = this.intelligentlyMergeResults(
      allProviderResults,
      generationOptions.count || 3,
      preferredProvider
    );

    // Record usage for all successful providers
    for (const providerName of successfulProviders) {
      await this.statsManager.recordCommit(providerName);
    }

    // Log context usage for debugging
    if (enrichedOptions.context.hasSemanticContext) {
      console.log(
        chalk.blue(`🧠 Used semantic context with intelligent merging`)
      );
    }

    return mergedMessages;
  }

  /**
   * Intelligently merge results from multiple AI providers
   */
  intelligentlyMergeResults(providerResults, targetCount, preferredProvider = null) {
    const allMessages = [];
    const messageSources = new Map();

    // Collect all messages with their source providers
    for (const [providerName, messages] of Object.entries(providerResults)) {
      messages.forEach((message, index) => {
        const normalizedMessage = message.trim().toLowerCase();
        
        if (!messageSources.has(normalizedMessage)) {
          messageSources.set(normalizedMessage, {
            message: message.trim(),
            providers: [providerName],
            originalIndex: index,
          });
          allMessages.push(messageSources.get(normalizedMessage));
        } else {
          // Message already seen from another provider - merge
          const existing = messageSources.get(normalizedMessage);
          if (!existing.providers.includes(providerName)) {
            existing.providers.push(providerName);
          }
        }
      });
    }

    // Score messages based on multiple factors
    const scoredMessages = allMessages.map((item) => {
      let score = this.scoreCommitMessage(item.message);
      
      // Bonus for messages from multiple providers (consensus)
      if (item.providers.length > 1) {
        score += 15 * item.providers.length; // 15 points per additional provider
      }
      
      // Bonus for preferred provider
      if (preferredProvider && item.providers.includes(preferredProvider)) {
        score += 10;
      }
      
      // Bonus for Ollama (local, typically more context-aware)
      if (item.providers.includes('ollama')) {
        score += 5;
      }
      
      // Bonus for Groq (fast, typically good for conventional commits)
      if (item.providers.includes('groq')) {
        score += 3;
      }

      return {
        ...item,
        score,
      };
    });

    // Sort by score and take best ones
    scoredMessages.sort((a, b) => b.score - a.score);
    
    const bestMessages = scoredMessages.slice(0, targetCount);
    
    // Log merge details
    console.log(chalk.cyan('\n🎯 Intelligent merging results:'));
    bestMessages.forEach((item, index) => {
      const providersStr = item.providers.join(' + ');
      console.log(
        chalk.dim(`  ${index + 1}. [${providersStr}] ${item.message}`)
      );
    });

    return bestMessages.map((item) => item.message);
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
      console.log(`  ${provider}: ${count} (${Math.round(count / analysis.aiInteractions * 100)}%)`);
    });
    
    if (analysis.averageResponseTime > 0) {
      console.log(chalk.yellow('\n⚡ Performance:'));
      console.log(`  Average Response Time: ${analysis.averageResponseTime}ms`);
    }
    
    if (Object.keys(analysis.messagePatterns).length > 0) {
      console.log(chalk.yellow('\n📝 Commit Patterns:'));
      Object.entries(analysis.messagePatterns)
        .sort(([,a], [,b]) => b - a)
        .forEach(([type, count]) => {
          const percentage = Math.round(count / analysis.successfulCommits * 100);
          console.log(`  ${type}: ${count} (${percentage}%)`);
        });
    }
    
    if (Object.keys(analysis.commonErrors).length > 0) {
      console.log(chalk.yellow('\n❌ Common Errors:'));
      Object.entries(analysis.commonErrors)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .forEach(([error, count]) => {
          console.log(`  ${error}: ${count}`);
        });
    }
    
    if (Object.keys(analysis.peakUsageHours).length > 0) {
      console.log(chalk.yellow('\n🕐 Peak Usage Hours:'));
      Object.entries(analysis.peakUsageHours)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .forEach(([hour, count]) => {
          console.log(`  ${hour.toString().padStart(2, '0')}:00 - ${count} interactions`);
        });
    }
    
    console.log(chalk.dim('\n💡 Tip: Use --export to get detailed data for further analysis'));
  }


}

module.exports = AICommitGenerator;// Test change for prompt improvement
// Fix timeout handling to prevent null errors
