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
const OptimizedDiffProcessor = require('./utils/optimized-diff-processor');
const EfficientPromptBuilder = require('./utils/efficient-prompt-builder');
const PerformanceUtils = require('./utils/performance-utils');

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

      // Simplified cache check (exact match only)
      let messages = [];
      if (mergedOptions.cache !== false) {
        spinner.text = 'Checking cache...';
        // Only cache exact matches to avoid complexity
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

        // Generate commit messages with sequential fallback
        spinner.text = 'Generating commit messages with AI...';
        messages = await this.generateWithSequentialFallback(diff, {
          context,
          count: parseInt(mergedOptions.count) || 3,
          type: mergedOptions.type,
          language: mergedOptions.language || 'en',
          conventional:
            mergedOptions.conventional || config.conventionalCommits,
          preferredProvider: mergedOptions.provider || config.defaultProvider,
        });

        // Cache results (simple exact match)
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
      console.log(chalk.yellow('Regenerating commit messages...'));
      // Regenerate with same options
      const regeneratedMessages = await this.generateWithSequentialFallback(diff, {
        context,
        count: parseInt(mergedOptions.count) || 3,
        type: mergedOptions.type,
        language: mergedOptions.language || 'en',
        conventional: mergedOptions.conventional || config.conventionalCommits,
        preferredProvider: mergedOptions.provider || config.defaultProvider,
      });
      
      // Show regenerated messages
      const { regenerate } = await this.selectMessage(regeneratedMessages, { 
        allowRegenerate: false, 
        title: 'Select from regenerated messages:' 
      });
      return regenerate;
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
    } else if (options.list || !options.set && !options.get && !options.reset) {
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
   * Build prompt using efficient prompt builder
   */
  buildPrompt(diff, options) {
    return this.efficientPromptBuilder.buildPrompt(diff, options);
  }

  /**
   * Generate commit messages with sequential fallback (Ollama first, Groq on failure)
   */
  async generateWithSequentialFallback(diff, options) {
    const { preferredProvider, context, ...generationOptions } = options;
    const providers = preferredProvider ? [preferredProvider] : ['ollama', 'groq'];
    
    console.log(chalk.blue('🤖 Using sequential AI generation (Ollama first)...'));
    
    // Step 1: Intelligent diff management
    const diffManagement = this.manageDiffForAI(diff);
    console.log(chalk.blue(`📊 Diff strategy: ${diffManagement.info.strategy}`));
    console.log(chalk.dim(`   Reasoning: ${diffManagement.info.reasoning}`));
    
    // Special indicator for plugin updates
    if (diffManagement.info.pluginUpdate) {
      console.log(chalk.yellow(`🔌 Plugin/dependency update detected - avoiding chunking`));
    }
    
    // Enrich options with context
    const enrichedOptions = {
      ...generationOptions,
      context: {
        ...context,
        hasSemanticContext: !!(
          context?.files?.semantic &&
          Object.keys(context.files.semantic).length > 0
        ),
      },
    };

    // Step 2: Try providers sequentially
    for (const providerName of providers) {
      const startTime = Date.now();
      
      try {
        const provider = AIProviderFactory.create(providerName);
        let messages;
        let actualPrompt;

        // Step 3: Handle different diff strategies
        if (diffManagement.strategy === 'full') {
          // Simple case: full diff in one prompt
          const prompt = provider.buildPrompt(diffManagement.data, enrichedOptions);
          messages = await provider.generateCommitMessages(diffManagement.data, enrichedOptions);
          actualPrompt = prompt;
          
        } else {
          // Complex case: chunked processing
          console.log(
            chalk.blue(
              `📦 Processing ${diffManagement.chunks} chunks with ${providerName}...`
            )
          );

          const chunkMessages = [];
          
          for (let i = 0; i < diffManagement.data.length; i++) {
            const chunk = diffManagement.data[i];
            const isLastChunk = i === diffManagement.data.length - 1;

            const chunkOptions = {
              ...enrichedOptions,
              chunkIndex: i,
              totalChunks: diffManagement.data.length,
              isLastChunk,
              chunkContext: isLastChunk ? 'final' : i === 0 ? 'initial' : 'middle',
              // Add chunk-specific context
              context: {
                ...enrichedOptions.context,
                chunkInfo: {
                  index: i,
                  total: diffManagement.data.length,
                  size: chunk.size,
                  files: chunk.context.files,
                  functions: chunk.context.functions,
                  classes: chunk.context.classes,
                  hasSignificantChanges: chunk.context.hasSignificantChanges
                }
              }
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
                Date.now() - startTime,
                true
              );
            }
          }

          messages = this.selectBestMessages(chunkMessages, generationOptions.count || 3);
          actualPrompt = `Chunked processing (${diffManagement.chunks} chunks)`;
        }

        const responseTime = Date.now() - startTime;
        
        if (messages && messages.length > 0) {
          await this.statsManager.recordCommit(providerName);
          
          console.log(
            chalk.green(`✅ ${providerName} generated ${messages.length} messages in ${responseTime}ms`)
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
            success: true
          });
          
          // Log context usage for debugging
          if (enrichedOptions.context.hasSemanticContext) {
            console.log(
              chalk.blue(`🧠 Used semantic context for ${providerName}`)
            );
          }

          return messages;
        }
      } catch (error) {
        const responseTime = Date.now() - startTime;
        
        console.warn(
          chalk.yellow(`⚠️  ${providerName} provider failed: ${error.message}`)
        );
        
        // Log failed interaction
        await this.activityLogger.logAIInteraction(
          providerName,
          'commit_generation',
          diffManagement.strategy === 'full' ? diff : `Chunked processing (${diffManagement.chunks} chunks)`,
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
          error: error.message
        });
        
        // If preferred provider fails, try Groq as fallback
        if (providerName === preferredProvider && preferredProvider !== 'groq') {
          console.log(chalk.blue('🔄 Falling back to Groq...'));
          try {
            const groqProvider = AIProviderFactory.create('groq');
            const messages = await groqProvider.generateCommitMessages(diffManagement.data, enrichedOptions);
            if (messages && messages.length > 0) {
              await this.statsManager.recordCommit('groq');
              console.log(chalk.green(`✅ Groq fallback generated ${messages.length} messages`));
              return messages;
            }
          } catch (fallbackError) {
            console.warn(chalk.yellow(`⚠️  Groq fallback also failed: ${fallbackError.message}`));
          }
        }
      }
    }

    throw new Error('All AI providers failed to generate commit messages');
  }

  /**
   * Intelligently merge results from multiple AI providers
   */







  /**
   * Intelligent diff management for optimal AI generation
   */
  manageDiffForAI(diff, options = {}) {
    const MAX_DIFF_SIZE = 15000; // 15K chars max for single prompt
    const CHUNK_SIZE = 8000; // 8K chars for chunks
    const MAX_CONTEXT_LINES = 50; // Max context lines per chunk

    const diffSize = diff.length;

    // Check if this is a plugin/dependency update that should avoid chunking
    const isPluginUpdate = this.detectPluginUpdate(diff);

    // Strategy 1: Use full diff if under limit OR if plugin update (even if large)
    if (diffSize <= MAX_DIFF_SIZE || isPluginUpdate) {
      const reasoning = isPluginUpdate
        ? 'Plugin/dependency update detected, avoiding chunking for better context'
        : 'Diff size manageable, using full content';

      return {
        strategy: 'full',
        data: diff,
        chunks: null,
        info: {
          strategy: 'full',
          size: diffSize,
          chunks: 1,
          reasoning,
          pluginUpdate: isPluginUpdate
        }
      };
    }

    // Strategy 2: Chunk large diffs intelligently
    const lines = diff.split('\n');
    const chunks = [];
    let currentChunk = [];
    let currentSize = 0;
    let inContext = false;
    let contextBuffer = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSize = line.length + 1; // +1 for newline

      // Detect diff headers and file boundaries
      const isFileHeader = line.startsWith('diff --git') ||
                           line.startsWith('index ') ||
                           line.startsWith('---') ||
                           line.startsWith('+++');

      const isContextLine = line.startsWith(' ') || line.startsWith('');
      const isCodeLine = line.startsWith('+') || line.startsWith('-');

      // Start new chunk if size limit reached and we're at a good boundary
      if (currentSize + lineSize > CHUNK_SIZE &&
          (isFileHeader || (inContext && contextBuffer.length >= MAX_CONTEXT_LINES))) {

        // Add current chunk to list
        chunks.push({
          content: currentChunk.join('\n'),
          size: currentSize,
          lines: currentChunk.length,
          context: this.extractChunkContext(currentChunk.join('\n'))
        });

        // Reset for next chunk, but carry some context
        currentChunk = [...contextBuffer.slice(-10)]; // Keep last 10 context lines
        currentSize = currentChunk.join('\n').length + 1;
        contextBuffer = [];
        inContext = false;
      }

      // Add line to current chunk
      currentChunk.push(line);
      currentSize += lineSize;

      // Track context for intelligent boundaries
      if (isContextLine) {
        contextBuffer.push(line);
        inContext = true;
      } else if (isCodeLine) {
        inContext = false;
      }

      // Reset context buffer at file boundaries
      if (isFileHeader) {
        contextBuffer = [];
      }
    }

    // Add final chunk
    if (currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join('\n'),
        size: currentChunk.join('\n').length,
        lines: currentChunk.length,
        context: this.extractChunkContext(currentChunk.join('\n'))
      });
    }

    return {
      strategy: 'chunked',
      data: chunks,
      chunks: chunks.length,
      info: {
        strategy: 'intelligent_chunking',
        originalSize: diffSize,
        chunkCount: chunks.length,
        avgChunkSize: Math.round(diffSize / chunks.length),
        reasoning: `Diff too large (${diffSize} chars), intelligently chunked into ${chunks.length} parts with preserved context`
      }
    };
  }
  
  /**
   * Detect if diff represents a plugin/dependency update
   */
  detectPluginUpdate(diff) {
    // Check for package manager files
    const packageFiles = [
      'package.json',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'composer.json',
      'composer.lock',
      'requirements.txt',
      'Pipfile.lock',
      'Gemfile.lock',
      'Cargo.lock',
      'go.mod',
      'go.sum',
      'pom.xml',
      'build.gradle'
    ];
    
    // Check for WordPress plugin/theme patterns
    const wordpressPatterns = [
      /wp-content\/plugins\//,
      /wp-content\/themes\//,
      /plugins\//,
      /themes\//
    ];
    
    // Extract file paths from diff
    const filePaths = (diff.match(/\+\+\+ b\/(.+)/g) || [])
      .map(f => f.replace('+++ b/', '').trim());
    
    // Check if any changed files are package managers
    const hasPackageFiles = filePaths.some(file => 
      packageFiles.some(pkg => file.endsWith(pkg))
    );
    
    // Check if this is a WordPress plugin/theme update
    const hasWordPressUpdate = filePaths.some(file => 
      wordpressPatterns.some(pattern => pattern.test(file))
    );
    
    // Check for dependency update patterns in diff content
    const depPatterns = [
      /^\s*["'][^"']+"\s*:\s*["'][\^~\d][^"']*["']/gm, // package.json version updates
      /^\+.*version\s*[:=]\s*["'][\d][^"']*["']/gm, // version property updates
      /^\+.*\b(upgraded|updated|downgraded|bumped)\b.*\b(version|dependency|package)\b/gmi,
      /^\+.*\b(install|require|include)\b.*\b(package|dependency|module|plugin)\b/gmi
    ];
    
    const hasDependencyChanges = depPatterns.some(pattern => pattern.test(diff));
    
    // Also check for large lock files or vendor directories
    const hasVendorChanges = filePaths.some(file => 
      /vendor|node_modules|wp-content\/(plugins|themes)/.test(file) &&
      (file.includes('lock') || file.endsWith('.json') || file.endsWith('.lock'))
    );
    
    return hasPackageFiles || hasWordPressUpdate || hasDependencyChanges || hasVendorChanges;
  }

  /**
   * Extract key context from chunk for better generation
   */
  extractChunkContext(chunkContent) {
    const files = chunkContent.match(/\+\+\+ b\/(.+)/g) || [];
    const fileNames = files.map(f => f.replace('+++ b/', '').trim());
    
    const functions = (chunkContent.match(/\+.*function\s+(\w+)/g) || [])
      .map(m => m.replace(/\+.*function\s+/, ''));
    
    const classes = (chunkContent.match(/\+.*class\s+(\w+)/g) || [])
      .map(m => m.replace(/\+.*class\s+/, ''));
    
    return {
      files: fileNames,
      functions: functions.slice(0, 5), // Top 5 functions
      classes: classes.slice(0, 5), // Top 5 classes
      hasSignificantChanges: functions.length > 0 || classes.length > 0
    };
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
