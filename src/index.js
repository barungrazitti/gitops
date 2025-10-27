/**
 * AI Commit Message Generator - Main Class
 */

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
const TestValidator = require('./core/test-validator');
const AutoCorrector = require('./core/auto-corrector');

class AICommitGenerator {
  constructor() {
    this.gitManager = new GitManager();
    this.configManager = new ConfigManager();
    this.cacheManager = new CacheManager();
    this.analysisEngine = new AnalysisEngine();
    this.messageFormatter = new MessageFormatter();
    this.statsManager = new StatsManager();
    this.hookManager = new HookManager();
    this.testValidator = new TestValidator();
    this.autoCorrector = new AutoCorrector();
  }

  /**
   * Generate AI commit messages
   */
  async generate(options = {}) {
    const spinner = ora('Initializing AI commit generator...').start();

    try {
      // Load configuration
      const config = await this.configManager.load();
      const mergedOptions = { ...config, ...options };

      // Validate git repository
      spinner.text = 'Checking git repository...';
      await this.gitManager.validateRepository();

      // Get staged changes
      spinner.text = 'Analyzing staged changes...';
      const diff = await this.gitManager.getStagedDiff();

      if (!diff || diff.trim().length === 0) {
        spinner.fail(
          'No staged changes found. Please stage your changes first.'
        );
        return;
      }

      // Test validation workflow
      let fixes = null;
      if (mergedOptions.testValidate) {
        spinner.text = 'Running test validation...';
        fixes = await this.runTestValidation(mergedOptions);

        if (!fixes && !mergedOptions.autoFix) {
          spinner.fail('Validation failed and auto-fix is disabled.');
          return;
        }
      }

      // Advanced formatting workflow
      if (mergedOptions.formatCode && !mergedOptions.testValidate) {
        spinner.text = 'Running advanced formatting...';
        const formatResults = await this.runAdvancedFormatting(mergedOptions);

        if (formatResults && formatResults.summary.formatted > 0) {
          console.log(
            chalk.green(
              `✅ Formatted ${formatResults.summary.formatted} file(s)`
            )
          );
        }
      }

      // Check cache
      let messages = [];
      if (mergedOptions.cache !== false) {
        spinner.text = 'Checking cache...';
        messages = await this.cacheManager.get(diff);
      }

      if (!messages || messages.length === 0) {
        // Analyze repository context
        spinner.text = 'Analyzing repository context...';
        const context = await this.analysisEngine.analyzeRepository();

        // Generate commit messages using AI with fallback logic
        spinner.text = 'Generating commit messages...';
        messages = await this.generateWithFallback(diff, {
          context,
          count: parseInt(mergedOptions.count) || 3,
          type: mergedOptions.type,
          language: mergedOptions.language || 'en',
          conventional:
            mergedOptions.conventional || config.conventionalCommits,
          preferredProvider: mergedOptions.provider || config.defaultProvider,
        });

        // Cache the results
        if (mergedOptions.cache !== false) {
          await this.cacheManager.set(diff, messages);
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
        return;
      }

      const selectedMessage = await this.selectMessage(formattedMessages);

      if (selectedMessage) {
        // Create dual commits if validation was run
        if (mergedOptions.testValidate) {
          spinner.text = 'Creating commits...';
          const commits = await this.gitManager.createDualCommits(
            selectedMessage,
            fixes
          );

          console.log(chalk.green(`\n✅ Created ${commits.length} commit(s):`));
          commits.forEach((commit, index) => {
            const type =
              commit.type === 'original' ? '📝 Original' : '🔧 Corrected';
            console.log(
              chalk.cyan(
                `  ${index + 1}. ${type}: ${commit.hash.substring(0, 8)}`
              )
            );
          });

          // Push if requested
          if (mergedOptions.push) {
            spinner.text = 'Pushing to remote...';
            await this.gitManager.pushCommits();
            console.log(chalk.green('✅ Pushed to remote successfully!'));
          }
        } else {
          // Standard single commit
          await this.gitManager.commit(selectedMessage);
          console.log(chalk.green('\n✅ Commit created successfully!'));
        }

        // Update statistics
        await this.statsManager.recordCommit(
          mergedOptions.provider || config.defaultProvider
        );
      }
    } catch (error) {
      spinner.fail(`Failed to generate commit message: ${error.message}`);
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
          { name: 'OpenAI (GPT-3.5/GPT-4)', value: 'openai' },
          { name: 'Anthropic Claude', value: 'anthropic' },
          { name: 'Google Gemini', value: 'gemini' },
          { name: 'Mistral AI', value: 'mistral' },
          { name: 'Cohere', value: 'cohere' },
          { name: 'Groq', value: 'groq' },
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
   * Generate commit messages with fallback logic
   */
  /**
   * Chunk large diffs into smaller pieces for AI processing
   */
  chunkDiff(diff, maxTokens = 4000) {
    const lines = diff.split('\n');
    const chunks = [];
    let currentChunk = [];
    let currentTokens = 0;

    // Rough estimation: 1 token ≈ 4 characters
    const estimateTokens = (text) => Math.ceil(text.length / 4);

    for (const line of lines) {
      const lineTokens = estimateTokens(line);

      // If single line is too large, split it
      if (lineTokens > maxTokens) {
        // Flush current chunk if it has content
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join('\n'));
          currentChunk = [];
          currentTokens = 0;
        }

        // Split the large line into smaller pieces
        const chunksNeeded = Math.ceil(lineTokens / maxTokens);
        const chunkSize = Math.ceil(line.length / chunksNeeded);

        for (let i = 0; i < chunksNeeded; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, line.length);
          chunks.push(line.substring(start, end));
        }
        continue;
      }

      // Check if adding this line would exceed the limit
      if (currentTokens + lineTokens > maxTokens && currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [line];
        currentTokens = lineTokens;
      } else {
        currentChunk.push(line);
        currentTokens += lineTokens;
      }
    }

    // Add the last chunk if it has content
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks;
  }

  /**
   * Select the best commit messages from chunked results
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

    // Sort by score and take the best ones
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

  async generateWithFallback(diff, options) {
    const { preferredProvider, context, ...generationOptions } = options;
    const providers = ['groq', 'ollama'];

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

    let providerOrder = preferredProvider ? [preferredProvider] : [];
    providers.forEach((provider) => {
      if (provider !== preferredProvider) {
        providerOrder.push(provider);
      }
    });

    let lastError = null;

    for (const providerName of providerOrder) {
      try {
        const provider = AIProviderFactory.create(providerName);

        // Check if diff is too large and needs chunking
        const estimatedTokens = Math.ceil(diff.length / 4);
        let messages;

        if (estimatedTokens > 4000) {
          console.log(
            chalk.blue(
              `📦 Chunking large diff (${estimatedTokens} tokens) for ${providerName}...`
            )
          );

          const chunks = this.chunkDiff(diff, 3000); // Leave room for prompt
          const chunkMessages = [];

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const isLastChunk = i === chunks.length - 1;

            console.log(
              chalk.dim(`   Processing chunk ${i + 1}/${chunks.length}...`)
            );

            const chunkOptions = {
              ...enrichedOptions,
              chunkIndex: i,
              totalChunks: chunks.length,
              isLastChunk,
              chunkContext: isLastChunk
                ? 'final'
                : i === 0
                  ? 'initial'
                  : 'middle',
            };

            const chunkResult = await provider.generateCommitMessages(
              chunk,
              chunkOptions
            );
            if (chunkResult && chunkResult.length > 0) {
              chunkMessages.push(...chunkResult);
            }
          }

          // Deduplicate and select best messages from all chunks
          messages = this.selectBestMessages(
            chunkMessages,
            generationOptions.count || 3
          );
        } else {
          messages = await provider.generateCommitMessages(
            diff,
            enrichedOptions
          );
        }

        if (messages && messages.length > 0) {
          await this.statsManager.recordCommit(providerName);

          // Log context usage for debugging
          if (enrichedOptions.context.hasSemanticContext) {
            console.log(
              chalk.blue(`🧠 Used semantic context with ${providerName}`)
            );
          }

          return messages;
        }
      } catch (error) {
        lastError = error;
        console.warn(
          chalk.yellow(`⚠️  ${providerName} provider failed: ${error.message}`)
        );
      }
    }

    throw (
      lastError ||
      new Error('All AI providers failed to generate commit messages')
    );
  }

  /**
   * Run advanced formatting workflow
   */
  async runAdvancedFormatting(options) {
    try {
      const files = await this.testValidator.getFilesToValidate(
        this.gitManager
      );
      const allFiles = [...files.staged, ...files.unstaged];

      if (allFiles.length === 0) {
        console.log(chalk.blue('ℹ️  No files to format'));
        return null;
      }

      console.log(chalk.blue(`🎨 Formatting ${allFiles.length} file(s)...`));

      const results =
        await this.autoCorrector.codeFormatter.formatFiles(allFiles);

      // Re-stage formatted files
      if (results.formatted.length > 0) {
        await this.gitManager.git.add(results.formatted.map((f) => f.file));
      }

      return results;
    } catch (error) {
      console.error(chalk.red(`Advanced formatting failed: ${error.message}`));
      return null;
    }
  }

  /**
   * Run test validation and auto-correction workflow
   */
  async runTestValidation(options) {
    try {
      // Check if validation is available
      const isAvailable = await this.testValidator.isValidationAvailable();
      if (!isAvailable) {
        console.log(
          chalk.yellow(
            '⚠️  Test validation not available (no test scripts found)'
          )
        );
        return null;
      }

      // Get files to validate
      const files = await this.testValidator.getFilesToValidate(
        this.gitManager
      );
      const allFiles = [...files.staged, ...files.unstaged];

      if (allFiles.length === 0) {
        console.log(chalk.blue('ℹ️  No relevant files to validate'));
        return null;
      }

      console.log(chalk.blue(`🔍 Validating ${allFiles.length} file(s)...`));

      // Run validation
      const results = await this.testValidator.validateStagedChanges(allFiles);
      const summary = this.testValidator.generateSummary(results);

      // Display results
      console.log(chalk.cyan(`\n📋 Validation Results: ${summary.status}`));
      console.log(
        chalk.gray(
          `   Linting: ${summary.lintStatus} | Tests: ${summary.testStatus}`
        )
      );

      if (summary.errorCount > 0) {
        console.log(
          chalk.red(
            `   Errors: ${summary.errorCount} | Warnings: ${summary.warningCount}`
          )
        );
      }
      if (summary.fixableCount > 0) {
        console.log(chalk.yellow(`   Fixable issues: ${summary.fixableCount}`));
      }

      // If validation passed, return early
      if (results.passed) {
        console.log(chalk.green('✅ All validations passed!'));
        return null;
      }

      // Auto-fix if enabled
      if (options.autoFix !== false) {
        console.log(chalk.blue('\n🔧 Attempting to fix issues...'));
        const fixes = await this.autoCorrector.fixIssues(results, allFiles);
        const fixSummary = this.autoCorrector.generateSummary(fixes);

        console.log(chalk.cyan('\n🔧 Fix Summary:'));
        console.log(
          chalk.gray(
            `   Applied: ${fixSummary.applied} | Failed: ${fixSummary.failed} | Skipped: ${fixSummary.skipped}`
          )
        );

        if (fixSummary.totalFixes > 0) {
          console.log(chalk.green(`   Total fixes: ${fixSummary.totalFixes}`));
          return fixes;
        } else {
          console.log(chalk.yellow('   No fixes were applied'));
        }
      } else {
        console.log(
          chalk.yellow(
            '\n⚠️  Auto-fix is disabled. Commit will proceed with errors.'
          )
        );
      }

      return null;
    } catch (error) {
      console.error(chalk.red(`Validation workflow failed: ${error.message}`));
      return null;
    }
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

    const stats = await this.statsManager.getStats();
    console.log(chalk.cyan('\n📊 Usage Statistics:'));
    console.log(`Total commits: ${stats.totalCommits}`);
    console.log(`Most used provider: ${stats.mostUsedProvider}`);
    console.log(`Average response time: ${stats.averageResponseTime}ms`);
    console.log(`Cache hit rate: ${stats.cacheHitRate}%`);
  }
}

module.exports = AICommitGenerator;
