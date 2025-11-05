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
   * Generate commit messages with robust large diff handling
   * Multi-layered strategy for handling diffs of any size
   */
  async generateWithFallback(diff, options) {
    const { preferredProvider, context, ...generationOptions } = options;
    
    // Analyze diff size and complexity
    const estimatedTokens = Math.ceil(diff.length / 4);
    const diffLines = diff.split('\n').length;
    const isVeryLarge = estimatedTokens > 16000; // > 64KB of text
    const isLarge = estimatedTokens > 4000;    // > 16KB of text
    
    console.log(chalk.blue(`📊 Analyzing diff: ${estimatedTokens.toLocaleString()} tokens, ${diffLines.toLocaleString()} lines`));
    
    // Multi-layered strategy - use comprehensive for normal diffs, ultra-fast for large diffs
    const strategies = this.buildProcessingStrategies(diff, estimatedTokens, preferredProvider);
    
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

    // Try each strategy until one succeeds
    for (const strategy of strategies) {
      const strategyStartTime = Date.now();
      try {
        console.log(chalk.blue(`🎯 Trying strategy: ${strategy.description}`));
        
        const messages = await this.executeStrategy(strategy, diff, enrichedOptions);
        
        if (messages && messages.length > 0) {
          const strategyTime = Date.now() - strategyStartTime;
          console.log(chalk.green(`✅ Strategy succeeded in ${(strategyTime / 1000).toFixed(1)}s`));
          return messages;
        }
      } catch (error) {
        const strategyTime = Date.now() - strategyStartTime;
        console.log(chalk.yellow(`⚠️  Strategy failed in ${(strategyTime / 1000).toFixed(1)}s: ${error.message}`));
        
        // Log failed attempt
        await this.activityLogger.logAIInteraction(
          strategy.provider,
          'commit_generation',
          `STRATEGY_FAILED: ${strategy.description}`,
          null,
          strategyTime,
          false
        );
      }
    }

    throw new Error(`All processing strategies failed for diff with ${estimatedTokens.toLocaleString()} tokens`);
  }

  /**
   * Build processing strategies based on diff characteristics
   */
  buildProcessingStrategies(diff, estimatedTokens, preferredProvider) {
    const strategies = [];
    
    // Strategy 0: Comprehensive method (what was working well) - for normal diffs
    if (estimatedTokens <= 4000) {
      strategies.push({
        type: 'comprehensive',
        provider: 'groq', // Use Groq for speed but with full context
        description: 'Comprehensive analysis with full context (20-25s target)',
        chunkSize: null, // No chunking for normal diffs
        maxRetries: 1,
        timeout: 25000, // 25 seconds timeout
        useCache: true,
        fullContext: true, // Use comprehensive context like before
        maxTokens: 100, // Good length for accuracy
        temperature: 0.2 // Balanced for creativity and consistency
      });
    }
    
    // Strategy 1: Ultra-fast - only for large diffs (> 4000 tokens)
    if (estimatedTokens > 4000) {
      strategies.push({
        type: 'ultra_fast',
        provider: 'groq', // Always use Groq for speed
        description: 'Ultra-fast generation for large diffs (10-15s target)',
        chunkSize: 2000, // Light chunking for very large diffs
        maxRetries: 1,
        timeout: 15000, // 15 seconds hard timeout
        useCache: true,
        simplifiedPrompt: true,
        maxTokens: 50, // Very short responses
        temperature: 0.1 // Low temperature for consistency
      });
    }
    
    // Strategy 2: User preference (if specified)
    if (preferredProvider) {
      strategies.push({
        type: 'user_preference',
        provider: preferredProvider,
        description: `User-specified ${preferredProvider}`,
        chunkSize: preferredProvider === 'ollama' ? 2000 : 3000,
        maxRetries: 2
      });
    }
    
    // Strategy 2: Groq with aggressive chunking (for very large diffs)
    if (estimatedTokens > 16000) {
      strategies.push({
        type: 'groq_aggressive',
        provider: 'groq',
        description: 'Groq with aggressive chunking (1500 tokens/chunk)',
        chunkSize: 1500,
        maxRetries: 3,
        timeout: 180000, // 3 minutes
        useSummary: true
      });
    }
    
    // Strategy 3: Groq with standard chunking (for large diffs)
    if (estimatedTokens > 4000) {
      strategies.push({
        type: 'groq_standard',
        provider: 'groq',
        description: 'Groq with standard chunking (3000 tokens/chunk)',
        chunkSize: 3000,
        maxRetries: 2,
        timeout: 120000 // 2 minutes
      });
    }
    
    // Strategy 4: Ollama with conservative chunking
    if (estimatedTokens > 4000) {
      strategies.push({
        type: 'ollama_conservative',
        provider: 'ollama',
        description: 'Ollama with conservative chunking (2000 tokens/chunk)',
        chunkSize: 2000,
        maxRetries: 2,
        timeout: 180000 // 3 minutes
      });
    }
    
    // Strategy 5: Smart summary approach (for extremely large diffs)
    if (estimatedTokens > 24000) {
      strategies.push({
        type: 'summary_approach',
        provider: 'groq',
        description: 'Summary-based approach for extremely large diffs',
        chunkSize: 4000,
        maxRetries: 2,
        timeout: 240000, // 4 minutes
        useSummary: true,
        summarizeFirst: true
      });
    }
    
    // Strategy 6: Fallback single provider (no chunking)
    strategies.push({
      type: 'fallback',
      provider: preferredProvider || 'groq',
      description: 'Fallback: Single provider without chunking',
      chunkSize: null,
      maxRetries: 1,
      timeout: 300000 // 5 minutes
    });
    
    return strategies;
  }

  /**
   * Execute a specific processing strategy
   */
  async executeStrategy(strategy, diff, enrichedOptions) {
    const provider = AIProviderFactory.create(strategy.provider);
    
    // Configure provider with strategy-specific settings
    const strategyOptions = {
      ...enrichedOptions,
      timeout: strategy.timeout,
      maxRetries: strategy.maxRetries,
      maxTokens: strategy.maxTokens,
      temperature: strategy.temperature
    };
    
    let messages;
    
    if (strategy.type === 'comprehensive') {
      // Comprehensive processing (what was working well)
      console.log(chalk.blue(`🧠 Comprehensive analysis mode (${strategy.timeout/1000}s timeout)...`));
      messages = await this.processComprehensive(provider, diff, strategy, strategyOptions);
    } else if (strategy.type === 'ultra_fast') {
      // Ultra-fast processing (only for large diffs)
      console.log(chalk.blue(`⚡ Ultra-fast mode for large diff (${strategy.timeout/1000}s timeout)...`));
      messages = await this.processUltraFast(provider, diff, strategy, strategyOptions);
    } else if (strategy.chunkSize) {
      // Chunked processing
      console.log(chalk.blue(`📦 Processing ${this.chunkDiff(diff, strategy.chunkSize).length} chunks (${strategy.chunkSize} tokens each)...`));
      
      if (strategy.summarizeFirst) {
        // Summary approach: summarize chunks first, then generate commit message
        messages = await this.processWithSummaryApproach(provider, diff, strategy, strategyOptions);
      } else {
        // Standard chunking
        messages = await this.processWithChunking(provider, diff, strategy, strategyOptions);
      }
    } else {
      // Single request processing
      console.log(chalk.blue(`🔄 Processing as single request...`));
      const prompt = this.buildPrompt(diff, strategyOptions);
      messages = await provider.generateCommitMessages(prompt, strategyOptions);
    }
    
    if (messages && messages.length > 0) {
      await this.statsManager.recordCommit(strategy.provider);
      console.log(chalk.green(`✅ ${strategy.provider} generated ${messages.length} messages`));
      return messages;
    }
    
    return null;
  }

  /**
   * Comprehensive processing (what was working well) for normal diffs
   */
  async processComprehensive(provider, diff, strategy, options) {
    // Step 1: Check cache first for instant results
    if (strategy.useCache) {
      const cachedMessages = await this.cacheManager.get(diff);
      if (cachedMessages && cachedMessages.length > 0) {
        console.log(chalk.green(`🧠 Cache hit - instant comprehensive result!`));
        return cachedMessages.slice(0, 3); // Return top 3
      }
    }
    
    // Step 2: Build comprehensive prompt (like what was working before)
    const comprehensivePrompt = this.buildComprehensivePrompt(diff, options);
    
    // Step 3: Generate with full context
    const messages = await provider.generateCommitMessages(comprehensivePrompt, {
      ...options,
      maxTokens: strategy.maxTokens,
      temperature: strategy.temperature,
      count: 1 // One good message is better than multiple bad ones
    });
    
    // Step 4: Cache result for future instant responses
    if (messages && messages.length > 0) {
      await this.cacheManager.set(diff, messages);
      
      // Log comprehensive interaction
      await this.activityLogger.logAIInteraction(
        strategy.provider,
        'commit_generation',
        `COMPREHENSIVE_PROMPT: ${comprehensivePrompt.substring(0, 500)}...`,
        messages[0],
        Date.now(),
        true
      );
    }
    
    return messages;
  }

  /**
   * Build specific, detailed prompt (like what was working)
   */
  buildComprehensivePrompt(diff, options) {
    // Extract key information directly from diff
    const analysis = this.extractKeyChanges(diff);
    
    // Analyze the specific types of changes
    const hasTimeoutChanges = analysis.changes.some(c => c.includes('timeout') && c.includes('30000'));
    const hasProviderLogic = analysis.changes.some(c => c.includes('provider') || c.includes('chunking'));
    const hasConfigChanges = analysis.files.some(f => f.includes('config'));
    const hasOllamaChanges = analysis.files.some(f => f.includes('ollama'));
    
    let prompt = `You are an expert software developer. Analyze the git diff and generate ONE precise commit message.

CRITICAL REQUIREMENTS:
- Be EXTREMELY SPECIFIC about what changed (use actual values/function names)
- Focus on the PRIMARY PURPOSE of the changes
- Use active voice and imperative mood
- Keep message under 72 characters total
- Use conventional format: type(scope): description
- AVOID generic terms like "update", "modify", "change", "implement"
- Use specific technical terms from the actual code

FILES CHANGED:
${analysis.files.join('\n')}

KEY CHANGES DETECTED:`;

    if (hasTimeoutChanges) {
      prompt += `
- TIMEOUT VALUE CHANGES: Look for specific number changes (30000 → 120000)`;
    }
    
    if (hasProviderLogic) {
      prompt += `
- PROVIDER LOGIC: Look for AI provider selection/chunking logic`;
    }
    
    if (hasConfigChanges) {
      prompt += `
- CONFIGURATION: Default timeout settings`;
    }
    
    if (hasOllamaChanges) {
      prompt += `
- OLLAMA PROVIDER: Timeout configuration for local AI`;
    }

    prompt += `

ACTUAL CODE CHANGES:
${analysis.changes.slice(0, 10).join('\n')}

FULL GIT DIFF:
\`\`\`diff
${diff}
\`\`\`

EXAMPLES OF GOOD MESSAGES:
- "feat(timeout): increase default timeout from 30s to 2 minutes"
- "fix(ollama): extend timeout for large file processing"
- "refactor(provider): add auto-selection logic for chunking"
- "chore(config): update timeout values for better performance"

Based on the ACTUAL changes shown above, generate exactly ONE commit message:`;

    return prompt;
  }

  /**
   * Extract key changes directly from diff
   */
  extractKeyChanges(diff) {
    const lines = diff.split('\n');
    const files = [];
    const changes = [];
    let currentFile = '';
    
    for (const line of lines) {
      // Track files
      if (line.startsWith('diff --git')) {
        const match = line.match(/b\/.*?([^\/]+)\.\w+$/);
        if (match) {
          currentFile = match[1];
          files.push(currentFile);
        }
      }
      
      // Track ALL meaningful changes (not just specific keywords)
      if (line.startsWith('+') && !line.startsWith('+++')) {
        const addition = line.substring(1).trim();
        if (addition.length > 3 && addition.length < 120) {
          // Include most meaningful additions
          if (!addition.match(/^[\s{}();,]$/) && // Skip empty syntax
              !addition.includes('*/')) { // Skip comment endings
            changes.push(`+ ${addition}`);
          }
        }
      }
      
      if (line.startsWith('-') && !line.startsWith('---')) {
        const removal = line.substring(1).trim();
        if (removal.length > 3 && removal.length < 120) {
          // Include most meaningful removals
          if (!removal.match(/^[\s{}();,]$/) && // Skip empty syntax
              !removal.includes('*/')) { // Skip comment endings
            changes.push(`- ${removal}`);
          }
        }
      }
    }
    
    // If no changes found, include sample lines anyway
    if (changes.length === 0) {
      for (const line of lines) {
        if ((line.startsWith('+') || line.startsWith('-')) && !line.startsWith('---') && !line.startsWith('+++')) {
          const change = line.substring(1).trim();
          if (change.length > 0 && change.length < 80) {
            changes.push(`${line.startsWith('+') ? '+' : '-'} ${change}`);
            if (changes.length >= 3) break; // Limit to first 3 changes
          }
        }
      }
    }
    
    return { files, changes };
  }

  /**
   * Helper methods for comprehensive prompt building
   */
  getFileTypesFromDiff(diff) {
    const types = new Set();
    const matches = diff.match(/\.\w+$/gm);
    if (matches) {
      matches.forEach(match => {
        const type = match.substring(1);
        if (type.length > 0) types.add(type);
      });
    }
    return types.size > 0 ? Array.from(types).join(', ') : 'unknown';
  }

  inferScopeFromDiff(diff) {
    if (diff.includes('wp-content/themes/') || diff.includes('functions.php')) return 'wordpress';
    if (diff.includes('.js')) return 'frontend';
    if (diff.includes('.php')) return 'backend';
    if (diff.includes('style') || diff.includes('css')) return 'ui';
    return 'general';
  }

  getChangeStats(diff) {
    const additions = (diff.match(/^\+/gm) || []).length;
    const removals = (diff.match(/^-/gm) || []).length;
    return `+${additions} -${removals}`;
  }

  getSemanticContext(context) {
    if (!context || !context.files) return 'No semantic context available';
    
    const semantic = context.files.semantic || {};
    const functions = Object.keys(semantic.functions || {}).slice(0, 3).join(', ');
    const classes = Object.keys(semantic.classes || {}).slice(0, 2).join(', ');
    
    let contextStr = '';
    if (functions) contextStr += `Functions: ${functions}; `;
    if (classes) contextStr += `Classes: ${classes}; `;
    
    return contextStr || 'No semantic context';
  }

  analyzeDiffPurpose(diff) {
    const lines = diff.split('\n');
    const purposes = [];
    
    if (lines.some(line => line.includes('function') || line.includes('class'))) {
      purposes.push('Function or class definition');
    }
    if (lines.some(line => line.includes('style') || line.includes('css'))) {
      purposes.push('CSS styling changes');
    }
    if (lines.some(line => line.includes('require') || line.includes('include'))) {
      purposes.push('Dependency or include modification');
    }
    if (lines.some(line => line.includes('add_action') || line.includes('add_filter'))) {
      purposes.push('WordPress hook or filter modification');
    }
    
    if (purposes.length === 0) {
      purposes.push('Code modification');
    }
    
    return `- Likely purpose: ${purposes.join(', ')}
- Affected areas: ${this.inferScopeFromDiff(diff)}`;
  }

  /**
   * Ultra-fast processing for 10-15 second target
   */
  async processUltraFast(provider, diff, strategy, options) {
    // Step 1: Check ultra-fast cache first for instant results
    if (strategy.useCache) {
      const cachedMessages = await this.cacheManager.getUltraFast(diff);
      if (cachedMessages && cachedMessages.length > 0) {
        console.log(chalk.green(`⚡ Ultra-fast cache hit - instant result!`));
        return cachedMessages.slice(0, 3); // Return top 3
      }
    }
    
    // Step 2: Create ultra-simplified prompt
    const simplifiedPrompt = this.buildUltraFastPrompt(diff);
    
    // Step 3: Generate with minimal tokens and low temperature
    let messages = await provider.generateCommitMessages(simplifiedPrompt, {
      ...options,
      maxTokens: 30, // Extremely short responses
      temperature: 0.1, // Low temperature for consistency
      count: 1 // Just one message for speed
    });
    
    // Step 4: Validate ultra-fast result, fallback if irrelevant
    if (messages && messages.length > 0) {
      const message = messages[0].toLowerCase();
      const diffContent = diff.toLowerCase();
      
      // Check if message is relevant to actual changes
      const hasRelevance = this.validateMessageRelevance(message, diffContent);
      
      if (!hasRelevance) {
        console.log(chalk.yellow(`⚠️  Ultra-fast message irrelevant, trying standard prompt...`));
        
        // Fallback to slightly more detailed prompt
        const fallbackPrompt = this.buildFallbackPrompt(diff);
        messages = await provider.generateCommitMessages(fallbackPrompt, {
          ...options,
          maxTokens: 50,
          temperature: 0.2,
          count: 1
        });
      }
    }
    
    // Step 5: Cache the result for future instant responses
    if (messages && messages.length > 0) {
      await this.cacheManager.set(diff, messages);
      
      // Log ultra-fast interaction
      await this.activityLogger.logAIInteraction(
        strategy.provider,
        'commit_generation',
        `ULTRA_FAST_PROMPT: ${simplifiedPrompt.substring(0, 500)}...`,
        messages[0],
        Date.now(),
        true
      );
    }
    
    return messages;
  }

  /**
   * Validate if generated message is relevant to actual changes
   */
  validateMessageRelevance(message, diffContent) {
    // Extract key terms from diff
    const diffTerms = new Set();
    const words = diffContent.match(/\b\w{3,}\b/g) || [];
    words.forEach(word => diffTerms.add(word));
    
    // Extract key terms from message
    const messageTerms = new Set();
    const messageWords = message.match(/\b\w{3,}\b/g) || [];
    messageWords.forEach(word => messageTerms.add(word));
    
    // Check for common irrelevant patterns
    const irrelevantPatterns = [
      'npm', 'install', 'package', 'dependency', 'update', 'version',
      'merge', 'branch', 'rebase', 'chore', 'refactor'
    ];
    
    const hasIrrelevantTerms = irrelevantPatterns.some(pattern => 
      message.includes(pattern) && !diffContent.includes(pattern)
    );
    
    if (hasIrrelevantTerms) {
      return false;
    }
    
    // Check for relevant terms overlap
    let relevantOverlap = 0;
    for (const term of messageTerms) {
      if (diffTerms.has(term) && term.length > 4) {
        relevantOverlap++;
      }
    }
    
    // Require at least some relevant overlap
    return relevantOverlap >= 1;
  }

  /**
   * Build fallback prompt with more context
   */
  buildFallbackPrompt(diff) {
    const lines = diff.split('\n');
    const keyChanges = [];
    const fileNames = [];
    
    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        const match = line.match(/b\/.*?([^\/]+)\.\w+$/);
        if (match) fileNames.push(match[1]);
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        const addition = line.substring(1).trim();
        if (addition.length > 5 && addition.length < 60) {
          keyChanges.push(addition);
        }
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        const removal = line.substring(1).trim();
        if (removal.length > 5 && removal.length < 60) {
          keyChanges.push(`removed: ${removal}`);
        }
      }
    }
    
    let prompt = `Commit message for ${fileNames.join(', ')} changes: `;
    
    if (keyChanges.length > 0) {
      prompt += keyChanges.slice(0, 3).join('; ');
    } else {
      prompt += 'code modifications';
    }
    
    prompt += '. Max 10 words. Conventional format.';
    
    return prompt;
  }

  /**
   * Build ultra-simplified prompt for speed
   */
  buildUltraFastPrompt(diff) {
    // Extract meaningful changes with better context
    const lines = diff.split('\n');
    const changes = [];
    const removals = [];
    let fileCount = 0;
    const fileTypes = new Set();
    const fileNames = [];
    
    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        fileCount++;
        const match = line.match(/b\/.*?([^\/]+)\.(\w+)$/);
        if (match) {
          fileNames.push(match[1]);
          fileTypes.add(match[2]);
        }
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        const addition = line.substring(1).trim();
        // Filter out empty lines, braces, and simple syntax
        if (addition.length > 3 && 
            !addition.match(/^[\s{}();,]$/) && 
            !addition.includes('?>') &&
            addition.length < 80) {
          changes.push(addition);
        }
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        const removal = line.substring(1).trim();
        if (removal.length > 3 && 
            !removal.match(/^[\s{}();,]$/) && 
            removal.length < 80) {
          removals.push(removal);
        }
      }
    }
    
    // Build contextual prompt
    let prompt = 'Generate commit message for ';
    
    // Add file context
    if (fileNames.length > 0) {
      prompt += `${fileNames.join(', ')} `;
    }
    
    if (fileTypes.size > 0) {
      prompt += `(${Array.from(fileTypes).join('/')}) `;
    }
    
    prompt += 'changes: ';
    
    // Add meaningful changes
    const meaningfulChanges = [];
    
    // Prioritize function calls and assignments
    for (const change of changes) {
      if (change.includes('=') || change.includes('(') || change.includes('return')) {
        meaningfulChanges.push(change);
      } else if (change.includes('color') || change.includes('background') || 
                 change.includes('image') || change.includes('url')) {
        meaningfulChanges.push(change);
      }
    }
    
    // Add key removals
    for (const removal of removals) {
      if (removal.includes('color') || removal.includes('background') || 
          removal.includes('image') || removal.includes('placeholder')) {
        meaningfulChanges.push(`removed ${removal}`);
      }
    }
    
    if (meaningfulChanges.length > 0) {
      const topChanges = meaningfulChanges.slice(0, 2);
      prompt += topChanges.join('; ');
    } else {
      prompt += 'code updates';
    }
    
    prompt += '. Max 8 words. Use conventional format.';
    
    return prompt;
  }

  /**
   * Process diff with standard chunking approach
   */
  async processWithChunking(provider, diff, strategy, options) {
    const chunks = this.chunkDiff(diff, strategy.chunkSize);
    const chunkMessages = [];
    let totalChunkTime = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isLastChunk = i === chunks.length - 1;
      const chunkStartTime = Date.now();

      const chunkOptions = {
        ...options,
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

    const messages = this.selectBestMessages(chunkMessages, options.count || 5);
    
    // Log chunking interaction
    if (messages && messages.length > 0) {
      await this.activityLogger.logAIInteraction(
        strategy.provider,
        'commit_generation',
        `CHUNKED_PROMPT (${chunks.length} chunks, ${strategy.chunkSize} tokens each) - First chunk:\n${chunks[0].substring(0, 2000)}...`,
        messages.join('\n'),
        totalChunkTime,
        true
      );
    }
    
    return messages;
  }

  /**
   * Process diff with summary approach for extremely large diffs
   */
  async processWithSummaryApproach(provider, diff, strategy, options) {
    const chunks = this.chunkDiff(diff, strategy.chunkSize);
    const summaries = [];
    
    console.log(chalk.blue(`📝 Summarizing ${chunks.length} chunks first...`));
    
    // Step 1: Summarize each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const summaryPrompt = `Summarize the key changes in this diff chunk in 1-2 sentences:\n\n${chunk}`;
      
      try {
        const summaryResult = await provider.generateCommitMessages(summaryPrompt, {
          ...options,
          count: 1,
          maxTokens: 100
        });
        
        if (summaryResult && summaryResult.length > 0) {
          summaries.push(`Chunk ${i + 1}: ${summaryResult[0]}`);
        }
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Failed to summarize chunk ${i + 1}`));
        summaries.push(`Chunk ${i + 1}: [Summary failed]`);
      }
    }
    
    // Step 2: Generate commit message from summaries
    const combinedSummary = summaries.join('\n');
    const finalPrompt = `Based on these chunk summaries, generate a concise commit message:\n\n${combinedSummary}`;
    
    const messages = await provider.generateCommitMessages(finalPrompt, {
      ...options,
      count: options.count || 3
    });
    
    // Log summary approach interaction
    if (messages && messages.length > 0) {
      await this.activityLogger.logAIInteraction(
        strategy.provider,
        'commit_generation',
        `SUMMARY_APPROACH (${chunks.length} chunks summarized)\nSummaries:\n${combinedSummary}`,
        messages.join('\n'),
        Date.now(),
        true
      );
    }
    
    return messages;
  }

  /**
   * Enhanced chunking with semantic boundary preservation
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

module.exports = AICommitGenerator;// Test change for prompt improvement
