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
const SecretScanner = require('./utils/secret-scanner');
const fs = require('fs-extra');
const EfficientPromptBuilder = require('./utils/efficient-prompt-builder');
const PerformanceUtils = require('./utils/performance-utils');
const OptimizedDiffProcessor = require('./utils/optimized-diff-processor');

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
    this.diffProcessor = new OptimizedDiffProcessor();
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
      } else if (provider === 'groq') {
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
      const response = await provider.generateResponse(prompt, { maxTokens: 100 });
      
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
        provider: options.provider || 'unknown'
      });
      return null;
    }
  }

  /**
   * Generate AI commit messages
   */
  async generate(options = {}) {
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
      if (mergedOptions.cache !== false) {
        spinner.text = chalk.blue('💾 Checking for cached results...');
        messages = await this.cacheManager.getValidated(diff);
        if (messages && messages.length > 0) {
          await this.activityLogger.debug('cache_hit', { diffLength: diff.length });
          spinner.succeed(chalk.green('✅ Found cached results'));
        } else {
          await this.activityLogger.debug('cache_miss', { diffLength: diff.length });
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
            conventional:
              mergedOptions.conventional || config.conventionalCommits,
            preferredProvider: mergedOptions.provider || config.defaultProvider,
          });

        // Cache results
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
  identifyErrorType(error) {
    const message = error.message.toLowerCase();

    if (message.includes('no staged changes')) {
      return 'git_no_changes';
    }

    if (message.includes('not a git repository')) {
      return 'git_not_repo';
    }

    if (message.includes('401') || message.includes('unauthorized') || message.includes('api key')) {
      return 'ai_auth_error';
    }

    if (message.includes('429') || message.includes('too many requests') || message.includes('rate limit')) {
      return 'ai_rate_limit';
    }

    if (message.includes('econnrefused') || message.includes('enotfound')) {
      return 'ai_connection_error';
    }

    if (message.includes('context length exceeded') || message.includes('too large')) {
      return 'ai_context_limit';
    }

    return 'unknown';
  }

  /**
   * Get a local fallback suggestion for an error type
   */
  getLocalSuggestion(type) {
    const suggestions = {
      git_no_changes: 'No changes are staged. Use "git add <file>" to stage changes before running aic.',
      git_not_repo: 'This directory is not a git repository. Run "git init" to initialize one.',
      ai_auth_error: 'AI provider authentication failed. Run "aic setup" to configure your API key.',
      ai_rate_limit: 'AI provider rate limit reached. Please wait a moment or switch providers with "aic setup".',
      ai_connection_error: 'Could not connect to AI provider. Check your internet connection or ensure Ollama is running.',
      ai_context_limit: 'The diff is too large for the AI provider. Try staging fewer files or smaller changes.',
      unknown: 'An unexpected error occurred. Check your internet connection and try again.'
    };

    return suggestions[type] || suggestions.unknown;
  }

  /**
   * Provide helpful suggestions based on error type
   */
  async provideErrorSuggestions(error, options = {}) {
    try {
      // 1. Identify error type
      const errorType = this.identifyErrorType(error);

      // 2. Try AI-powered suggestion if possible
      if (this.isAIAvailable(options)) {
        try {
          const suggestion = await this.getAISuggestion(error, options);
          if (suggestion) {
            console.log(chalk.yellow(`\n💡 AI Suggestion: ${suggestion}`));
            return;
          }
        } catch (aiError) {
          // Silently fall back to local suggestions
          await this.activityLogger.debug('ai_suggestion_failed_in_provide', { 
            error: aiError.message 
          });
        }
      }

      // 3. Fallback to local suggestions
      const localSuggestion = this.getLocalSuggestion(errorType);
      if (localSuggestion) {
        console.log(chalk.yellow(`\n💡 Suggestion: ${localSuggestion}`));
      }
    } catch (fallbackError) {
      // Fail silently to avoid crashing the error handler itself
    }
  }

  /**
   * Interactive message selection
   */
  async selectMessage(messages) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => new Promise(resolve => {
      rl.question(prompt, resolve);
    });

    try {
      console.log(chalk.cyan('\n📝 Generated commit messages:'));
      messages.forEach((msg, index) => {
        console.log(chalk.green(`${index + 1}. ${msg}`));
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

    // Simple command-line setup (compatible with Node.js v25)
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt) => new Promise(resolve => {
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

      const conventionalChoice = await question('Use conventional commit format? (Y/n, default: Y): ');
      const conventionalCommits = conventionalChoice.toLowerCase() !== 'n';

      console.log('Select commit message language:');
      console.log('1. English');
      console.log('2. Spanish');
      console.log('3. French');
      console.log('4. German');
      console.log('5. Chinese');
      console.log('6. Japanese');
      
      const langChoice = await question('Enter choice (1-6, default: 1): ');
      const languages = { '1': 'en', '2': 'es', '3': 'fr', '4': 'de', '5': 'zh', '6': 'ja' };
      const language = languages[langChoice] || 'en';

      // Save configuration
      await this.configManager.setMultiple({
        defaultProvider: provider,
        apiKey: apiKey,
        conventionalCommits: conventionalCommits,
        language: language,
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
  selectBestMessages(messages, count = 3, diff = null) {
    if (!messages || messages.length === 0) return [];

    // Remove duplicates
    const uniqueMessages = [...new Set(messages)];

    // Score messages based on quality factors
    const scored = uniqueMessages.map((msg) => ({
      message: msg,
      score: this.scoreCommitMessage(msg, diff),
    }));

    // Sort by score and take best ones
    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, count).map((item) => item.message);
  }

  /**
   * Score a commit message based on quality factors
   */
  scoreCommitMessage(message, diff = null) {
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
      /^\s*(improvements?|bug fix|updates?|refactor)\s*$/i,
    ];

    genericPatterns.forEach((pattern) => {
      if (pattern.test(message)) {
        score -= 20;
      }
    });

    // BANNED patterns - instant low score
    const bannedPatterns = [
      /^\s*update\s*$/i,
      /^\s*fix\s*$/i,
      /^\s*commit\s*$/i,
      /^\s*changes\s*$/i,
    ];

    bannedPatterns.forEach((pattern) => {
      if (pattern.test(message)) {
        score = -100;
      }
    });

    // Penalize very short, non-specific messages
    if (message.split(' ').length <= 3 && !/[A-Z]\w+/.test(message)) {
      score -= 3;
    }

    // RELEVANCE SCORING - only if diff is provided
    if (diff) {
      score += this.calculateRelevanceScore(message, diff);
    }

    return score;
  }

  /**
   * Calculate relevance score based on how well the commit message matches the actual diff
   */
  calculateRelevanceScore(message, diff) {
    let relevanceScore = 0;

    // Extract key entities from diff (functions, classes, filenames, etc.)
    const entitiesFromDiff = this.extractEntitiesFromDiff(diff);

    // Extract keywords from commit message
    const messageKeywords = this.extractKeywordsFromMessage(message);

    // Calculate overlap between diff entities and message
    const entityOverlap = this.calculateEntityOverlap(entitiesFromDiff, messageKeywords);
    relevanceScore += entityOverlap * 8; // Weight entity overlap heavily

    // Check if the commit type matches the diff type
    const typeMatch = this.checkTypeMatch(message, diff);
    if (typeMatch) {
      relevanceScore += 5;
    }

    // Check if the scope matches the file types changed
    const scopeMatch = this.checkScopeMatch(message, diff);
    if (scopeMatch) {
      relevanceScore += 3;
    }

    // Penalize if message is too generic relative to specific changes
    if (this.isMessageTooGenericForDiff(message, diff)) {
      relevanceScore -= 10;
    }

    return relevanceScore;
  }

  /**
   * Extract key entities from diff (functions, classes, filenames, etc.)
   */
  extractEntitiesFromDiff(diff) {
    const entities = {
      functions: [],
      classes: [],
      variables: [],
      filenames: [],
      fileTypes: [],
      methods: []
    };

    // Extract file names from diff
    const fileMatches = diff.match(/diff --git a\/(.+?) b\/(.+)/g) || [];
    for (const match of fileMatches) {
      const fileMatch = match.match(/diff --git a\/(.+?) b\/(.+)/);
      if (fileMatch) {
        const filePath = fileMatch[2];
        entities.filenames.push(filePath);

        // Extract file type/extension
        const ext = filePath.split('.').pop();
        if (ext) entities.fileTypes.push(ext);
      }
    }

    // Extract function/class definitions from diff
    const functionMatches = diff.match(/(?:function\s+|def\s+)([A-Za-z_][A-Za-z0-9_]*)/g) || [];
    for (const match of functionMatches) {
      const funcName = match.replace(/function\s+|def\s+/, '').trim();
      if (funcName) entities.functions.push(funcName);
    }

    const classMatches = diff.match(/(?:class\s+)([A-Za-z_][A-Za-z0-9_]*)/g) || [];
    for (const match of classMatches) {
      const className = match.replace('class\s+', '').replace('class ', '').trim();
      if (className) entities.classes.push(className);
    }

    // Extract variable declarations
    const varMatches = diff.match(/(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)/g) || [];
    for (const match of varMatches) {
      const varName = match.replace(/(?:const|let|var)\s+/, '').trim();
      if (varName) entities.variables.push(varName);
    }

    // Extract method definitions in diff
    const methodMatches = diff.match(/[A-Za-z_][A-Za-z0-9_]*\s*:\s*function|([A-Za-z_][A-Za-z0-9_]*)\s*\(/g) || [];
    for (const match of methodMatches) {
      const methodName = match.replace(/\s*:\s*function|\s*\(/, '').trim();
      if (methodName && !entities.functions.includes(methodName)) {
        entities.methods.push(methodName);
      }
    }

    // Extract import/module statements
    const importMatches = diff.match(/(?:import|from|require)\s*.*?['"`]([^'"`]+)['"`]/g) || [];
    for (const match of importMatches) {
      const importName = match.replace(/(?:import|from|require)\s*/, '').replace(/['"`].*?['"`]/, '').trim();
      if (importName) entities.variables.push(importName);
    }

    return entities;
  }

  /**
   * Extract keywords from commit message
   */
  extractKeywordsFromMessage(message) {
    // Remove conventional commit prefix (type(scope):) to focus on content
    const content = message.replace(/^[a-z]+(\([^)]+\))?:\s*/, '');

    // Extract words that could be relevant
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.isCommonStopWord(word));

    return [...new Set(words)]; // Remove duplicates
  }

  /**
   * Check if word is a common stop word that should be ignored
   */
  isCommonStopWord(word) {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we',
      'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its',
      'our', 'their', 'what', 'which', 'who', 'when', 'where', 'why', 'how',
      'if', 'then', 'else', 'so', 'than', 'too', 'very', 'just', 'now', 'up',
      'down', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once'
    ]);

    return stopWords.has(word.toLowerCase());
  }

  /**
   * Calculate overlap between entities from diff and keywords from message
   */
  calculateEntityOverlap(entities, messageKeywords) {
    let overlapCount = 0;

    // Check for function name matches
    for (const func of entities.functions) {
      const funcName = func.toLowerCase();
      if (messageKeywords.some(keyword =>
        funcName.includes(keyword) || keyword.includes(funcName)
      )) {
        overlapCount++;
      }
    }

    // Check for class name matches
    for (const cls of entities.classes) {
      const className = cls.toLowerCase();
      if (messageKeywords.some(keyword =>
        className.includes(keyword) || keyword.includes(className)
      )) {
        overlapCount++;
      }
    }

    // Check for variable name matches
    for (const varName of entities.variables) {
      const varNameLower = varName.toLowerCase();
      if (messageKeywords.some(keyword =>
        varNameLower.includes(keyword) || keyword.includes(varNameLower)
      )) {
        overlapCount++;
      }
    }

    // Check for filename matches
    for (const file of entities.filenames) {
      const fileName = file.toLowerCase().replace(/\.[^/.]+$/, ''); // Remove extension
      const fileNameParts = fileName.split(/[\/\\]/); // Split by path separators

      for (const part of fileNameParts) {
        if (messageKeywords.some(keyword =>
          part.includes(keyword) || keyword.includes(part)
        )) {
          overlapCount++;
          break;
        }
      }
    }

    return overlapCount;
  }

  /**
   * Check if commit type matches the type of changes in diff
   */
  checkTypeMatch(message, diff) {
    // Extract type from message
    const typeMatch = message.match(/^([a-z]+)(\(.+\))?:/);
    if (!typeMatch) return false;

    const changeType = typeMatch[1];

    // Determine what type of changes are in the diff
    const diffIndicators = {
      feat: /(\+.*function|\+.*class|\+.*def|\+.*export|\+.*import)/.test(diff),
      fix: /(\-.*bug|\-.*error|\-.*issue|\+.*correct|\+.*resolve|\+.*patch)/i.test(diff),
      docs: /(\+.*\.(md|txt|rst)|\+.*README|\+.*documentation)/i.test(diff),
      refactor: /(\+.*refactor|\+.*restructure|\-.*\s+\+.*\s+.*reorganized)/.test(diff),
      test: /(\+.*test|\+.*spec|\+.*describe|\+.*it\(|\+.*expect|\+.*assert)/i.test(diff),
      style: /(\+.*css|\+.*style|\+.*format|\+.*indent|\+.*prettier)/i.test(diff),
    };

    // Check if the type matches the detected change pattern
    return diffIndicators[changeType] || false;
  }

  /**
   * Check if commit scope matches file types changed
   */
  checkScopeMatch(message, diff) {
    // Extract scope from message
    const scopeMatch = message.match(/^[a-z]+\(([^)]+)\):/);
    if (!scopeMatch) return false;

    const scope = scopeMatch[1];

    // Extract file types from diff
    const fileTypes = this.extractEntitiesFromDiff(diff).fileTypes;

    // Common scope-type mappings
    const scopeTypeMap = {
      'api': ['js', 'ts', 'py', 'php', 'java', 'go', 'rb'],
      'ui': ['jsx', 'tsx', 'vue', 'html', 'css', 'scss', 'sass', 'less'],
      'auth': ['js', 'ts', 'py', 'php', 'java', 'go'],
      'db': ['sql', 'js', 'ts', 'py', 'php'],
      'config': ['json', 'yaml', 'yml', 'env', 'xml', 'toml', 'conf'],
      'test': ['test.js', 'spec.js', 'test.ts', 'spec.ts', 'test.py', 'spec.rb'],
      'docs': ['md', 'txt', 'rst', 'adoc', 'tex'],
      'build': ['js', 'ts', 'json', 'lock', 'yml', 'yaml', 'sh', 'gradle', 'xml'],
      'ci': ['yml', 'yaml', 'sh', 'json'],
      'utils': ['js', 'ts', 'py', 'php', 'java', 'go', 'rb'],
      'types': ['ts', 'js', 'py', 'java', 'go'],
      'perf': ['js', 'ts', 'py', 'java', 'go', 'php'],
      'deps': ['json', 'lock', 'yml', 'yaml', 'xml', 'txt']
    };

    if (scopeTypeMap[scope]) {
      return fileTypes.some(type => scopeTypeMap[scope].includes(type));
    }

    return false;
  }

  /**
   * Check if message is too generic for the specific changes in the diff
   */
  isMessageTooGenericForDiff(message, diff) {
    // If diff contains specific function/class names but message is generic
    const entities = this.extractEntitiesFromDiff(diff);
    const hasSpecificEntities = entities.functions.length > 0 ||
                                entities.classes.length > 0 ||
                                entities.variables.length > 0;

    const genericTerms = [
      /\bchanges?\b/i, /\bupdates?\b/i, /\bfixes?\b/i,
      /\bstuff\b/i, /\bthings?\b/i, /\bvarious\b/i,
      /\bimprovements?\b/i, /\benhancements?\b/i
    ];

    const hasGenericTerms = genericTerms.some(regex => regex.test(message));

    return hasSpecificEntities && hasGenericTerms;
  }

  /**
   * Generate commit messages with sequential fallback (preferred provider first, then backup)
   */
  async generateWithSequentialFallback(diff, options) {
    const { preferredProvider, context, ...generationOptions } = options;

    // Determine providers to use - preferred first, then fallback
    const allProviders = ['ollama', 'groq'];
    const providers = preferredProvider ?
      [preferredProvider, ...allProviders.filter(p => p !== preferredProvider)] :
      allProviders;

    const mode = preferredProvider ? 'sequential fallback' : 'parallel';
    console.log(chalk.blue(`🤖 Using ${mode} provider mode...`));

    // Enrich options with context first
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
            chalk.blue(
              `📦 Processing ${diffManagement.chunks} chunks with ${providerName}...`
            )
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
          if (options.context.hasSemanticContext) {
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
          error: error.message
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
    const diffSize = diff.length;
    const MAX_SAFE_SIZE = 60000; // ~20K tokens, safe for modern Groq (131K context) and Ollama
    const { context } = options;

    if (diffSize <= MAX_SAFE_SIZE) {
      return {
        strategy: 'full',
        data: diff,
        chunks: null,
        info: {
          strategy: 'full',
          size: diffSize,
          chunks: 1,
          reasoning: 'Full diff sent to AI for fast processing',
          pluginUpdate: false
        }
      };
    }

    console.log(chalk.yellow(`⚠️  Very large diff (${Math.round(diffSize/1024)}KB), applying smart truncation`));

    const smartTruncated = this.smartTruncateDiff(diff, MAX_SAFE_SIZE, context);
    return {
      strategy: 'smart-truncated',
      data: smartTruncated.data,
      chunks: null,
      info: {
        strategy: 'smart-truncated',
        size: smartTruncated.data.length,
        chunks: 1,
        reasoning: smartTruncated.reasoning,
        truncated: true,
        originalSize: diffSize,
        preservedFiles: smartTruncated.preservedFiles,
        skippedFiles: smartTruncated.skippedFiles
      }
    };
  }

  /**
   * Smart truncate diff to preserve most relevant content
   */
  smartTruncateDiff(diff, maxSize, semanticContext) {
    const fileChunks = this.parseDiffIntoFileChunks(diff);

    const IGNORED_PATTERNS = [
      'node_modules/', 'dist/', 'build/', 'vendor/', '.git/',
      '.lock', '.min.js', '.min.css', '.map'
    ];

    const filteredChunks = fileChunks.filter(fc => {
      return !IGNORED_PATTERNS.some(pattern => fc.fileName.includes(pattern));
    });

    const scoredChunks = filteredChunks.map(fc => {
      const score = this.scoreFileChunk(fc, semanticContext);
      return { ...fc, score };
    });

    scoredChunks.sort((a, b) => b.score - a.score);

    let selectedContent = [];
    let preservedFiles = [];
    let skippedFiles = [];
    let currentSize = 0;
    const HEADER_BUDGET = Math.min(2000, maxSize * 0.05);

    for (const chunk of scoredChunks) {
      const headerSize = chunk.header.length;
      const contentSize = chunk.content.length;
      const totalSize = headerSize + contentSize;

      if (currentSize + totalSize <= maxSize) {
        selectedContent.push(chunk.header);
        if (chunk.content.trim()) {
          selectedContent.push(chunk.content);
        }
        currentSize += totalSize;
        preservedFiles.push(chunk.fileName);
      } else {
        skippedFiles.push(chunk);
      }

      if (currentSize >= maxSize * 0.9) {
        break;
      }
    }

    let remainingHeaderSpace = Math.max(0, maxSize - currentSize);
    const skippedHeaders = [];
    // Track which files were added from skipped files to preserved files to avoid duplicates
    const additionalPreservedFiles = [];

    for (const chunk of skippedFiles) {
      if (remainingHeaderSpace <= 0) break;
      if (chunk.header.length <= remainingHeaderSpace) {
        skippedHeaders.push(chunk.header);
        remainingHeaderSpace -= chunk.header.length;
        // Only add to preservedFiles if it's not already there to avoid duplicates
        if (!preservedFiles.includes(chunk.fileName)) {
          preservedFiles.push(chunk.fileName);
        }
        additionalPreservedFiles.push(chunk.fileName);
      }
    }

    // Build summary of skipped files for context
    const trulySkipped = skippedFiles
      .filter(f => !additionalPreservedFiles.includes(f.fileName))
      .map(f => f.fileName);

    const skippedFileSummary = this.buildSkippedFileSummary(trulySkipped);

    let reasoning = `Preserved ${preservedFiles.length} files with full content, ${trulySkipped.length} skipped (node_modules ignored)`;
    if (preservedFiles.length === 0 && filteredChunks.length > 0) {
      reasoning = 'No files fit within token limits - diff too large';
    }

    return {
      data: [...selectedContent, ...skippedHeaders, skippedFileSummary].join('\n'),
      reasoning,
      preservedFiles,
      skippedFiles: trulySkipped
    };
  }

  /**
   * Build a summary of skipped files grouped by pattern
   */
  buildSkippedFileSummary(skippedFiles) {
    if (!skippedFiles.length) return '';

    const groups = {
      plugin: [],
      theme: [],
      vendor: [],
      assets: [],
      config: [],
      other: []
    };

    skippedFiles.forEach(file => {
      if (file.includes('/plugins/') || file.includes('\\plugins\\')) {
        groups.plugin.push(file);
      } else if (file.includes('/themes/') || file.includes('\\themes\\')) {
        groups.theme.push(file);
      } else if (file.includes('vendor/') || file.includes('node_modules/')) {
        groups.vendor.push(file);
      } else if (file.match(/\.(js|css|woff|png|jpg|svg|ico)$/i)) {
        groups.assets.push(file);
      } else if (file.match(/\.(json|xml|yml|yaml|lock|config)$/i)) {
        groups.config.push(file);
      } else {
        groups.other.push(file);
      }
    });

    const summary = [];
    summary.push('\n# SKIPPED FILES (too large, but changed):');

    if (groups.plugin.length) {
      const plugins = new Set(groups.plugin.map(f => {
        const match = f.match(/\/plugins\/([^\/]+)/);
        return match ? match[1] : f;
      }));
      summary.push(`# Plugins: ${Array.from(plugins).join(', ')} (${groups.plugin.length} files)`);
    }

    if (groups.theme.length) {
      const themes = new Set(groups.theme.map(f => {
        const match = f.match(/\/themes\/([^\/]+)/);
        return match ? match[1] : f;
      }));
      summary.push(`# Themes: ${Array.from(themes).join(', ')} (${groups.theme.length} files)`);
    }

    if (groups.assets.length > 5) {
      summary.push(`# Assets: ${groups.assets.length} files (JS bundles, CSS, fonts, images)`);
    } else if (groups.assets.length) {
      summary.push(`# Assets: ${groups.assets.map(f => f.split('/').pop()).join(', ')}`);
    }

    if (groups.config.length) {
      summary.push(`# Config files: ${groups.config.map(f => f.split('/').pop()).join(', ')}`);
    }

    if (groups.vendor.length) {
      const vendorTypes = new Set(groups.vendor.map(f => {
        if (f.includes('node_modules')) return 'npm';
        if (f.includes('vendor/composer')) return 'composer';
        return 'vendor';
      }));
      summary.push(`# Dependencies: ${Array.from(vendorTypes).join(', ')} (${groups.vendor.length} files)`);
    }

    if (groups.other.length <= 10) {
      summary.push(`# Other: ${groups.other.join(', ')}`);
    } else if (groups.other.length) {
      summary.push(`# Other: ${groups.other.length} files`);
    }

    return summary.join('\n');
  }

  /**
   * Parse diff into individual file chunks with headers and content
   */
  parseDiffIntoFileChunks(diff) {
    const fileChunks = [];
    const lines = diff.split('\n');
    let currentFile = null;
    let currentContent = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('diff --git')) {
        if (currentFile) {
          fileChunks.push({
            header: currentFile.header,
            content: currentContent.join('\n'),
            fileName: currentFile.fileName,
            isNewFile: currentFile.isNewFile,
            changeCount: currentFile.changeCount
          });
        }

        const fileMatch = line.match(/diff --git a\/(.+?) b\/(.+)/);
        const fileName = fileMatch ? fileMatch[2] : 'unknown';
        let isNewFile = line.includes('/dev/null') || (i > 0 && lines[i - 1] && lines[i - 1].includes('new file mode'));
        if (!isNewFile && lines[i + 1] && lines[i + 1].includes('new file mode')) {
          isNewFile = true;
        }

        currentFile = {
          header: line,
          fileName,
          isNewFile,
          changeCount: 0
        };
        currentContent = [];
      } else if (currentFile && (line.startsWith('@@ ') || line.startsWith('+') || line.startsWith('-'))) {
        currentContent.push(line);
        if (line.startsWith('+') || line.startsWith('-')) {
          currentFile.changeCount++;
        }
      } else if (currentFile) {
        currentContent.push(line);
      }
    }

    if (currentFile) {
      fileChunks.push({
        header: currentFile.header,
        content: currentContent.join('\n'),
        fileName: currentFile.fileName,
        isNewFile: currentFile.isNewFile,
        changeCount: currentFile.changeCount
      });
    }

    return fileChunks;
  }

  /**
   * Score a file chunk by significance (higher = more important)
   */
  scoreFileChunk(chunk, semanticContext) {
    let score = 0;

    if (chunk.isNewFile) {
      score += 50;
      if (chunk.fileName.includes('package.json') ||
          chunk.fileName.includes('composer.json') ||
          chunk.fileName.includes('requirements.txt')) {
        score += 100;
      }
    }

    score += Math.min(chunk.changeCount / 10, 30);

    const ext = chunk.fileName.split('.').pop();
    const importantExts = ['js', 'ts', 'py', 'php', 'java', 'go', 'rs'];
    if (importantExts.includes(ext)) {
      score += 20;
    }

    const ignoredPatterns = ['node_modules', '.git', 'dist', 'build', 'vendor', '.lock'];
    if (ignoredPatterns.some(p => chunk.fileName.includes(p))) {
      score -= 50;
    }

    const semanticFiles = semanticContext?.files?.semantic || {};
    for (const [filePath, info] of Object.entries(semanticFiles)) {
      if (chunk.fileName.includes(filePath) || filePath.includes(chunk.fileName)) {
        if (info?.functions?.length > 0 || info?.classes?.length > 0) {
          score += 40;
        }
        if (info?.significance === 'high') {
          score += 60;
        }
      }
    }

    if (chunk.fileName.includes('index.') ||
        chunk.fileName.includes('main.') ||
        chunk.fileName.includes('app.') ||
        chunk.fileName.includes('config.')) {
      score += 25;
    }

    return score;
  }
  
  /**
   * Parse conflict markers from content and extract both versions
   */
  parseConflictBlocks(content) {
    const conflicts = [];
    const lines = content.split('\n');
    let currentConflict = null;
    let collectingCurrent = false;
    let collectingIncoming = false;

    for (const line of lines) {
      if (line.startsWith('<<<<<<<')) {
        currentConflict = {
          startLine: lines.indexOf(line),
          currentVersion: [],
          incomingVersion: []
        };
        collectingCurrent = true;
        collectingIncoming = false;
      } else if (line.startsWith('=======')) {
        collectingCurrent = false;
        collectingIncoming = true;
      } else if (line.startsWith('>>>>>>>')) {
        if (currentConflict) {
          currentConflict.endLine = lines.indexOf(line);
          currentConflict.currentVersion = currentConflict.currentVersion.join('\n');
          currentConflict.incomingVersion = currentConflict.incomingVersion.join('\n');
          conflicts.push(currentConflict);
        }
        currentConflict = null;
        collectingCurrent = false;
        collectingIncoming = false;
      } else if (currentConflict) {
        if (collectingCurrent) {
          currentConflict.currentVersion.push(line);
        } else if (collectingIncoming) {
          currentConflict.incomingVersion.push(line);
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve a single conflict block using AI
   */
  async resolveConflictWithAI(filePath, currentVersion, incomingVersion, language = 'javascript') {
    const prompt = `You are an expert software developer. Resolve a git merge conflict intelligently.

CONTEXT:
- File: ${filePath}
- Language: ${language}
- Original code (HEAD): The code before the conflict
- Incoming code: The new code that conflicts with HEAD

INSTRUCTIONS:
1. Analyze both versions and their purpose
2. Merge them intelligently - keep functionality from BOTH if possible
3. If the same lines were modified differently, choose the better implementation
4. Return ONLY the resolved code - NO explanations, NO comments about conflicts
5. Preserve all working code from both versions

CURRENT VERSION (HEAD):
\`\`\`
${currentVersion}
\`\`\`

INCOMING VERSION:
\`\`\`
${incomingVersion}
\`\`\`

RESOLVED CODE (output only):
`;

    try {
      const config = await this.configManager.getAll();
      const provider = AIProviderFactory.create(config.defaultProvider || 'groq');
      
      const messages = await provider.generateCommitMessages(
        `RESOLVE CONFLICT IN ${filePath}:\n\n${prompt}`,
        { count: 1 }
      );

      if (messages && messages.length > 0) {
        let resolved = messages[0].trim();
        
        // Clean up any markdown code blocks if present
        resolved = resolved.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
        
        return resolved;
      }
    } catch (error) {
      console.warn(chalk.yellow(`AI resolution failed, using current version: ${error.message}`));
    }

    // Fallback: keep current version
    return currentVersion;
  }

  /**
   * Handle conflict markers in a diff using AI-powered resolution
   */
  async handleConflictMarkers(diff, filePath) {
    const conflictPattern = /<<<<<<< HEAD\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> .+/g;
    const matches = [...diff.matchAll(conflictPattern)];

    if (matches.length === 0) {
      return { cleanedDiff: diff, hasConflicts: false, resolved: [] };
    }

    console.log(chalk.yellow(`⚠️  Found ${matches.length} conflict(s) in ${filePath}`));
    console.log(chalk.blue(`🧠 Using AI to intelligently resolve conflicts...`));

    let cleanedDiff = diff;
    const resolved = [];
    let aiUsed = false;

    for (const match of matches) {
      const currentVersion = match[1].trim();
      const incomingVersion = match[2].trim();
      const conflictBlock = match[0];

      // Detect language from file extension
      const ext = filePath.split('.').pop();
      const langMap = {
        'js': 'javascript', 'ts': 'typescript', 'py': 'python',
        'php': 'php', 'html': 'html', 'css': 'css',
        'json': 'json', 'md': 'markdown', 'sql': 'sql',
        'java': 'java', 'go': 'go', 'rs': 'rust'
      };
      const language = langMap[ext] || 'javascript';

      // Use AI to resolve the conflict
      let resolvedVersion;
      try {
        resolvedVersion = await this.resolveConflictWithAI(
          filePath,
          currentVersion,
          incomingVersion,
          language
        );
        aiUsed = true;
      } catch (error) {
        console.warn(chalk.yellow(`AI resolution failed: ${error.message}`));
        // Fallback to current version
        resolvedVersion = currentVersion;
      }

      // Replace the conflict block with resolved version
      cleanedDiff = cleanedDiff.replace(conflictBlock, resolvedVersion);

      resolved.push({
        file: filePath,
        resolutionType: aiUsed ? 'ai-merged' : 'kept-current',
        linesKept: resolvedVersion.split('\n').length
      });
    }

    const successType = aiUsed ? 'AI-merged' : 'fallback';
    console.log(chalk.green(`✅ Resolved ${resolved.length} conflict(s) in ${filePath} (${successType})`));

    return {
      cleanedDiff,
      hasConflicts: true,
      resolved,
      aiUsed
    };
  }

  /**
   * Detect and clean up conflict markers in all staged files using AI
   */
  async detectAndCleanupConflictMarkers() {
    const diff = await this.gitManager.getStagedDiff();

    if (!diff || !/<<<<<<<|=======|>>>>>>>/.test(diff)) {
      return { cleaned: false, filesFixed: 0, diff };
    }

    console.log(chalk.yellow('\n🔧 Detected conflict markers in staged changes'));

    // Parse diff to find which files have conflicts
    const filePattern = /diff --git a\/(.+?) b\/(.+)/g;
    const files = [];
    let match;
    while ((match = filePattern.exec(diff)) !== null) {
      files.push({ fileA: match[1], fileB: match[2] });
    }

    let cleanedDiff = diff;
    let totalResolved = 0;
    let aiUsed = false;

    for (const file of files) {
      // Extract file diff
      const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const fileDiffPattern = new RegExp(
        `diff --git a/${escapeRegExp(file.fileA)} b/${escapeRegExp(file.fileB)}[\\s\\S]*?(?=diff --git a|$)`,
        'g'
      );
      const fileMatches = [...diff.matchAll(fileDiffPattern)];

      for (const fileMatch of fileMatches) {
        const fileDiff = fileMatch[0];
        if (/<<<<<<<|=======|>>>>>>>/.test(fileDiff)) {
          // Check if file exists and read it
          const fullPath = path.isAbsolute(file.fileB)
            ? file.fileB
            : path.resolve(process.cwd(), file.fileB);

          try {
            const content = await fs.readFile(fullPath, 'utf8');
            if (/<<<<<<<|=======|>>>>>>>/.test(content)) {
              // Parse and resolve conflicts using AI
              const conflicts = this.parseConflictBlocks(content);
              let cleanedContent = content;
              let fileResolved = 0;
              let fileAiUsed = false;

              for (const conflict of conflicts) {
                // Resolve each conflict block
                const ext = file.fileB.split('.').pop();
                const langMap = {
                  'js': 'javascript', 'ts': 'typescript', 'py': 'python',
                  'php': 'php', 'html': 'html', 'css': 'css',
                  'json': 'json', 'md': 'markdown', 'sql': 'sql'
                };
                const language = langMap[ext] || 'javascript';

                try {
                  const resolved = await this.resolveConflictWithAI(
                    file.fileB,
                    conflict.currentVersion,
                    conflict.incomingVersion,
                    language
                  );
                  
                  // Replace the conflict block
                  const conflictBlockStart = content.indexOf('<<<<<<<', conflict.startLine > 0 ? content.lastIndexOf('\n', conflict.startLine) : 0);
                  const conflictBlockEnd = content.indexOf('>>>>>>>', conflictBlockStart) + content.substring(content.indexOf('>>>>>>>', conflictBlockStart)).indexOf('\n') + 1;
                  
                  if (conflictBlockStart >= 0 && conflictBlockEnd > conflictBlockStart) {
                    cleanedContent = content.substring(0, conflictBlockStart) + resolved + '\n' + content.substring(conflictBlockEnd);
                  } else {
                    cleanedContent = cleanedContent.replace(
                      `<<<<<<< HEAD\n${conflict.currentVersion}\n=======\n${conflict.incomingVersion}\n>>>>>>> `,
                      resolved + '\n'
                    );
                  }
                  
                  fileResolved++;
                  fileAiUsed = true;
                } catch (e) {
                  // Fallback: use current version
                  cleanedContent = cleanedContent.replace(
                    `<<<<<<< HEAD\n${conflict.currentVersion}\n=======\n${conflict.incomingVersion}\n>>>>>>> `,
                    conflict.currentVersion + '\n'
                  );
                }
              }

              if (fileResolved > 0) {
                await fs.writeFile(fullPath, cleanedContent, 'utf8');
                console.log(chalk.green(`  ✅ Resolved ${fileResolved} conflict(s) in ${file.fileB}`));
                totalResolved += fileResolved;
                if (fileAiUsed) aiUsed = true;
              }
            }
          } catch (e) {
            // File might not exist (deleted), skip
          }
        }
      }
    }

    return {
      cleaned: totalResolved > 0,
      filesFixed: totalResolved,
      diff: cleanedDiff,
      aiUsed
    };
  }

  /**
   * Clean conflict markers from content string (simple version - keeps HEAD)
   */
  cleanConflictMarkers(content) {
    const lines = content.split('\n');
    const result = [];
    let inConflict = false;
    let collectingHead = true;
    let headLines = [];

    for (const line of lines) {
      if (line.startsWith('<<<<<<<')) {
        inConflict = true;
        collectingHead = true;
        continue;
      }

      if (line.startsWith('=======')) {
        collectingHead = false;
        continue;
      }

      if (line.startsWith('>>>>>>>')) {
        inConflict = false;
        result.push(...headLines);
        headLines = [];
        continue;
      }

      if (inConflict) {
        if (collectingHead) {
          headLines.push(line);
        }
      } else {
        result.push(line);
      }
    }
    return result.join('\n').trim();
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
