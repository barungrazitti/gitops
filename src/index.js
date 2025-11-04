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

      // Check cache
      let messages = [];
      if (mergedOptions.cache !== false) {
        spinner.text = 'Checking cache...';
        messages = await this.cacheManager.get(diff);
        if (messages && messages.length > 0) {
          await this.activityLogger.debug('cache_hit', { diffLength: diff.length });
        } else {
          await this.activityLogger.debug('cache_miss', { diffLength: diff.length });
        }
      }

      // Advanced analysis and generation with fallback
      if (!messages || messages.length === 0) {
        // Analyze repository context
        spinner.text = 'Analyzing repository context...';
        const context = await this.analysisEngine.analyzeRepository();

        // Generate commit messages with fallback
        spinner.text = 'Generating commit messages with AI...';
        messages = await this.generateWithFallback(diff, {
          context,
          count: parseInt(mergedOptions.count) || 3,
          type: mergedOptions.type,
          language: mergedOptions.language || 'en',
          conventional:
            mergedOptions.conventional || config.conventionalCommits,
          preferredProvider: mergedOptions.provider || config.defaultProvider,
        });

        // Cache results
        if (mergedOptions.cache !== false) {
          await this.cacheManager.set(diff, messages);
          await this.activityLogger.debug('cache_set', { messagesCount: messages.length });
        }

        // Log commit generation details
        await this.activityLogger.logCommitGeneration(diff, messages, null, context, 
          mergedOptions.provider || config.defaultProvider);
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

        // Split large line into smaller pieces
        const chunksNeeded = Math.ceil(lineTokens / maxTokens);
        const chunkSize = Math.ceil(line.length / chunksNeeded);

        for (let i = 0; i < chunksNeeded; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, line.length);
          chunks.push(line.substring(start, end));
        }
        continue;
      }

      // Check if adding this line would exceed limit
      if (currentTokens + lineTokens > maxTokens && currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [line];
        currentTokens = lineTokens;
      } else {
        currentChunk.push(line);
        currentTokens += lineTokens;
      }
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
   * Generate commit messages with fallback from Ollama to Groq
   */
  async generateWithFallback(diff, options) {
    const { preferredProvider, context, ...generationOptions } = options;
    const providers = preferredProvider ? [preferredProvider] : ['ollama', 'groq'];
    
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

    // Try providers sequentially: Ollama first, then Groq as fallback
    for (const providerName of providers) {
      const providerStartTime = Date.now();
      try {
        console.log(chalk.blue(`🤖 Trying ${providerName}...`));
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
          let totalChunkTime = 0;

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const isLastChunk = i === chunks.length - 1;
            const chunkStartTime = Date.now();

            const chunkOptions = {
              ...enrichedOptions,
              chunkIndex: i,
              totalChunks: chunks.length,
              isLastChunk,
              chunkContext: isLastChunk ? 'final' : i === 0 ? 'initial' : 'middle',
            };

            const chunkResult = await provider.generateCommitMessages(chunk, chunkOptions);
            totalChunkTime += Date.now() - chunkStartTime;
            
            if (chunkResult && chunkResult.length > 0) {
              chunkMessages.push(...chunkResult);
            }
          }

          const responseTime = totalChunkTime; // Use total time for all chunks
          messages = this.selectBestMessages(chunkMessages, generationOptions.count || 5);
          
          // Log AI interaction for chunking case
          if (messages && messages.length > 0) {
            await this.activityLogger.logAIInteraction(
              providerName, 
              'commit_generation', 
              `CHUNKED_PROMPT (${chunks.length} chunks) - First chunk:\n${chunks[0].substring(0, 2000)}...`, 
              messages.join('\n'), 
              responseTime, 
              true
            );
          }
        } else {
          const prompt = this.buildPrompt(diff, enrichedOptions);
          messages = await provider.generateCommitMessages(prompt, enrichedOptions);
          
          const responseTime = Date.now() - providerStartTime;
          
          if (messages && messages.length > 0) {
            await this.statsManager.recordCommit(providerName);
            console.log(
              chalk.green(`✅ ${providerName} generated ${messages.length} messages`)
            );
            
            // Log AI interaction with actual prompt
            await this.activityLogger.logAIInteraction(
              providerName, 
              'commit_generation', 
              prompt, // Use actual prompt, not just diff
              messages.join('\n'), 
              responseTime, 
              true
            );
            
            // Log context usage for debugging
            if (enrichedOptions.context.hasSemanticContext) {
              console.log(
                chalk.blue(`🧠 Used semantic context for better analysis`)
              );
            }
            
            return messages;
          }
          
        }
      } catch (error) {
        const responseTime = Date.now() - providerStartTime;
        
        // Use actual prompt for logging failed attempts too
        const prompt = estimatedTokens > 4000 ? 
          `CHUNKED_PROMPT (${this.chunkDiff(diff, 3000).length} chunks)` : 
          this.buildPrompt(diff, enrichedOptions);
        
        if (providerName === 'ollama') {
          console.warn(
            chalk.yellow(`⚠️  ${providerName} failed, trying Groq as fallback: ${error.message}`)
          );
        } else {
          console.warn(
            chalk.yellow(`⚠️  ${providerName} provider failed: ${error.message}`)
          );
        }

        // Log failed AI interaction
        await this.activityLogger.logAIInteraction(
          providerName, 
          'commit_generation', 
          prompt, // Use actual prompt even for failed attempts
          null, 
          responseTime, 
          false
        );
      }
    }

    throw new Error('All AI providers failed to generate commit messages');
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

  /**
   * Resolve merge conflicts using AI with intelligent merging
   */
  async resolveConflictWithAI(conflictContext) {
    const spinner = ora('🤖 AI analyzing conflicts...').start();
    const startTime = Date.now();
    
    try {
      // Try Ollama first, then fallback to Groq
      const providers = ['ollama', 'groq'];
      
      for (const providerName of providers) {
        const providerStartTime = Date.now();
        try {
          const provider = AIProviderFactory.create(providerName);
          spinner.text = `🤖 Using ${providerName} to resolve conflicts...`;
          
          // Create conflict resolution prompt
          const conflictPrompt = this.buildConflictResolutionPrompt(conflictContext);
          
          // Check if content is too large and needs chunking
          const estimatedTokens = Math.ceil(conflictPrompt.length / 4);
          
          if (estimatedTokens > 4000) {
            spinner.text = `📦 Chunking large conflict for ${providerName}...`;
            const resolvedContent = await this.resolveLargeConflictWithChunking(
              provider, 
              conflictContext, 
              conflictPrompt
            );
            spinner.succeed(`AI resolved conflicts using ${providerName}`);
            
            const responseTime = Date.now() - providerStartTime;
            await this.activityLogger.logAIInteraction(
              providerName, 
              'conflict_resolution', 
              conflictPrompt, 
              resolvedContent, 
              responseTime, 
              true
            );
            
            return resolvedContent;
          } else {
            const resolutionOptions = {
              type: 'conflict-resolution',
              context: {
                ...conflictContext,
                filePath: conflictContext.filePath,
                hasSemanticContext: true,
              },
            };
            
            const resolutions = await provider.generateCommitMessages(conflictPrompt, resolutionOptions);
            const responseTime = Date.now() - providerStartTime;
            
            if (resolutions && resolutions.length > 0) {
              // Extract actual resolved content from AI response
              const resolvedContent = this.extractResolvedContent(resolutions[0], conflictContext.conflictedContent);
              spinner.succeed(`AI resolved conflicts using ${providerName}`);
              await this.statsManager.recordCommit(providerName);
              
              await this.activityLogger.logAIInteraction(
                providerName, 
                'conflict_resolution', 
                conflictPrompt, 
                resolvedContent, 
                responseTime, 
                true
              );
              
              return resolvedContent;
            } else {
              await this.activityLogger.logAIInteraction(
                providerName, 
                'conflict_resolution', 
                conflictPrompt, 
                null, 
                responseTime, 
                false
              );
            }
          }
        } catch (error) {
          const responseTime = Date.now() - providerStartTime;
          
          if (providerName === 'ollama') {
            spinner.text = `⚠️  ${providerName} failed, trying Groq as fallback: ${error.message}`;
          } else {
            spinner.fail(`⚠️  ${providerName} failed: ${error.message}`);
          }
          
          await this.activityLogger.logAIInteraction(
            providerName, 
            'conflict_resolution', 
            this.buildConflictResolutionPrompt(conflictContext), 
            null, 
            responseTime, 
            false
          );
        }
      }
      
      throw new Error('All AI providers failed to resolve conflicts');
    } catch (error) {
      spinner.fail('AI conflict resolution failed');
      await this.activityLogger.error('conflict_resolution_failed', {
        error: error.message,
        filePath: conflictContext.filePath,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Build comprehensive conflict resolution prompt
   */
  buildConflictResolutionPrompt(conflictContext) {
    const { filePath, originalContent, currentChanges, incomingChanges, conflictedContent } = conflictContext;
    
    return `You are an expert Git conflict resolver. Analyze and resolve the merge conflicts in the following file.

FILE: ${filePath}

ORIGINAL VERSION (before any changes):
\`\`\`
${originalContent}
\`\`\`

CURRENT/REMOTE CHANGES (theirs - what's already in the branch):
\`\`\`
${currentChanges}
\`\`\`

INCOMING/LOCAL CHANGES (ours - what we're trying to merge):
\`\`\`
${incomingChanges}
\`\`\`

CONFLICTED CONTENT (with Git conflict markers):
\`\`\`
${conflictedContent}
\`\`\`

INSTRUCTIONS:
1. Analyze both changes carefully
2. Preserve the best elements from both versions
3. Merge changes intelligently to create the final resolved file
4. Remove all Git conflict markers (<<<<<<<, =======, >>>>>>>)
5. Ensure the result is syntactically correct and makes logical sense
6. For code files, ensure all imports/dependencies are properly handled
7. For config files, preserve important settings from both versions
8. For documentation/text, merge content to be coherent

RESPONSE FORMAT:
Provide ONLY the final resolved file content. Do NOT include explanations, conflict markers, or any additional text. Just the pure resolved content that should replace the conflicted file.

RESOLVED CONTENT:`;
  }

  /**
   * Extract resolved content from AI response
   */
  extractResolvedContent(aiResponse, originalConflictedContent) {
    // Remove any common AI response prefixes/suffixes
    let resolvedContent = aiResponse
      .replace(/^(RESOLVED CONTENT:|Here is the resolved content:|Final resolved content:)\s*/i, '')
      .replace(/^```[\w]*\n?/, '') // Remove code block markers
      .replace(/```\s*$/, '') // Remove closing code block markers
      .trim();
    
    // If AI didn't actually resolve conflicts (still has markers), use a simple merge strategy
    if (resolvedContent.includes('<<<<<<<') || resolvedContent.includes('>>>>>>>')) {
      console.log(chalk.yellow('⚠️  AI didn\'t fully resolve conflicts, using intelligent fallback'));
      return this.intelligentFallbackMerge(originalConflictedContent);
    }
    
    return resolvedContent;
  }

  /**
   * Intelligent fallback merge when AI fails to fully resolve
   */
  intelligentFallbackMerge(conflictedContent) {
    const lines = conflictedContent.split('\n');
    const resolvedLines = [];
    let inConflict = false;
    let conflictSection = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('<<<<<<<')) {
        inConflict = true;
        conflictSection = '';
        continue;
      }
      
      if (line.startsWith('=======')) {
        // Switch to second part of conflict, continue collecting
        continue;
      }
      
      if (line.startsWith('>>>>>>>')) {
        inConflict = false;
        // For simple fallback, prefer the second version (ours) but include both if different
        const conflictLines = conflictSection.split('\n').filter(l => l.trim());
        if (conflictLines.length > 0) {
          // Add non-empty lines from conflict resolution
          resolvedLines.push(...conflictLines);
        }
        continue;
      }
      
      if (inConflict) {
        conflictSection += line + '\n';
      } else {
        resolvedLines.push(line);
      }
    }
    
    return resolvedLines.join('\n');
  }

  /**
   * Handle large conflicts by chunking them for AI processing
   */
  async resolveLargeConflictWithChunking(provider, conflictContext, fullPrompt) {
    const { conflictedContent, filePath } = conflictContext;
    
    // Split conflict into chunks around conflict markers
    const chunks = this.chunkConflictContent(conflictedContent);
    const resolvedChunks = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      if (chunk.hasConflicts) {
        const chunkPrompt = this.buildChunkConflictPrompt(conflictContext, chunk, i, chunks.length);
        
        const chunkOptions = {
          type: 'conflict-resolution',
          context: {
            ...conflictContext,
            filePath,
            chunkIndex: i,
            totalChunks: chunks.length,
            isLastChunk: i === chunks.length - 1,
            hasSemanticContext: true,
          },
        };
        
        const resolutions = await provider.generateCommitMessages(chunkPrompt, chunkOptions);
        
        if (resolutions && resolutions.length > 0) {
          const resolvedChunk = this.extractResolvedContent(resolutions[0], chunk.content);
          resolvedChunks.push(resolvedChunk);
        } else {
          // Fallback to intelligent merge for this chunk
          resolvedChunks.push(this.intelligentFallbackMerge(chunk.content));
        }
      } else {
        // No conflicts in this chunk, keep as is
        resolvedChunks.push(chunk.content);
      }
    }
    
    // Reassemble the resolved content
    return resolvedChunks.join('\n');
  }

  /**
   * Split conflicted content into manageable chunks
   */
  chunkConflictContent(conflictedContent) {
    const lines = conflictedContent.split('\n');
    const chunks = [];
    let currentChunk = {
      content: '',
      hasConflicts: false,
      lineNumber: 0,
    };
    
    let currentTokens = 0;
    const maxTokens = 3000;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineTokens = Math.ceil(line.length / 4);
      
      // Check if line starts a new conflict section
      const startsConflict = line.startsWith('<<<<<<<');
      const endsConflict = line.startsWith('>>>>>>>');
      
      // If we're at a chunk boundary and not in the middle of a conflict
      if (currentTokens + lineTokens > maxTokens && 
          !currentChunk.hasConflicts && 
          !startsConflict) {
        // Save current chunk and start a new one
        chunks.push(currentChunk);
        currentChunk = {
          content: '',
          hasConflicts: false,
          lineNumber: i,
        };
        currentTokens = 0;
      }
      
      // Add line to current chunk
      currentChunk.content += line + '\n';
      currentTokens += lineTokens;
      
      // Track if this chunk has conflicts
      if (startsConflict || endsConflict || line.startsWith('=======')) {
        currentChunk.hasConflicts = true;
      }
    }
    
    // Add the last chunk if it has content
    if (currentChunk.content.trim()) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }

  /**
   * Build prompt for conflict chunk resolution
   */
  buildChunkConflictPrompt(conflictContext, chunk, chunkIndex, totalChunks) {
    const { filePath, originalContent, currentChanges, incomingChanges } = conflictContext;
    
    // Extract relevant context for this chunk
    const originalChunk = this.extractRelevantContext(originalContent, chunk);
    const currentChunk = this.extractRelevantContext(currentChanges, chunk);
    const incomingChunk = this.extractRelevantContext(incomingChanges, chunk);
    
    return `You are resolving a merge conflict chunk (${chunkIndex + 1}/${totalChunks}) for file: ${filePath}

ORIGINAL CONTEXT:
\`\`\`
${originalChunk}
\`\`\`

CURRENT CHANGES:
\`\`\`
${currentChunk}
\`\`\`

INCOMING CHANGES:
\`\`\`
${incomingChunk}
\`\`\`

CONFLICTED CHUNK:
\`\`\`
${chunk.content}
\`\`\`

Resolve this conflict chunk intelligently. Remove all conflict markers and create the best merged version. Focus on the immediate conflict but consider the broader context.

RESOLVED CHUNK:`;
  }

  /**
   * Extract relevant context from full content for a chunk
   */
  extractRelevantContext(fullContent, chunk) {
    // Simple implementation: get a few lines around the chunk area
    const chunkLines = chunk.content.split('\n');
    const fullLines = fullContent.split('\n');
    
    // Find approximate location and extract context
    const contextStart = Math.max(0, chunk.lineNumber - 10);
    const contextEnd = Math.min(fullLines.length, chunk.lineNumber + chunkLines.length + 10);
    
    return fullLines.slice(contextStart, contextEnd).join('\n');
  }
}

module.exports = AICommitGenerator;