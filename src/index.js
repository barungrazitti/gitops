/**
 * AI Commit Message Generator - Facade
 *
 * This class acts as a thin facade that delegates to extracted modules.
 * All business logic lives in dedicated modules under commands/, core/, ui/, and utils/.
 */

const GitManager = require('./core/git-manager');
const ConfigManager = require('./core/config-manager');
const CacheManager = require('./core/cache-manager');
const AnalysisEngine = require('./core/analysis-engine');
const MessageFormatter = require('./core/message-formatter');
const StatsManager = require('./core/stats-manager');
const HookManager = require('./core/hook-manager');
const ActivityLogger = require('./core/activity-logger');
const EfficientPromptBuilder = require('./utils/efficient-prompt-builder');
const OptimizedDiffProcessor = require('./utils/optimized-diff-processor');
const ProviderOrchestrator = require('./core/provider-orchestrator');
const DiffManager = require('./core/diff-manager');
const ConflictResolver = require('./core/conflict-resolver');
const MessageSelector = require('./ui/message-selector');

class AICommitGenerator {
  constructor() {
    // Core infrastructure
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

    // Extracted modules
    this.providerOrchestrator = new ProviderOrchestrator();
    this.diffManager = new DiffManager();
    this.conflictResolver = new ConflictResolver(this.activityLogger, this.configManager);
    this.messageSelector = new MessageSelector();
  }

  // ── Command Delegates ──────────────────────────────────────────────

  /**
   * Generate AI commit messages
   */
  async generate(options = {}) {
    const GenerateCommand = require('./commands/generate');
    const command = new GenerateCommand(this);
    await command.execute(options);
  }

  /**
   * Configuration management
   */
  async config(options) {
    const ConfigCommand = require('./commands/config');
    const command = new ConfigCommand(this.configManager);
    await command.execute(options);
  }

  /**
   * Interactive setup wizard
   */
  async setup(options) {
    const SetupCommand = require('./commands/setup');
    const command = new SetupCommand(this.configManager);
    await command.execute(options);
  }

  /**
   * Git hook management
   */
  async hook(options) {
    const HookCommand = require('./commands/hook');
    const command = new HookCommand(this.hookManager);
    await command.execute(options);
  }

  /**
   * Show usage statistics
   */
  async stats(options) {
    const StatsCommand = require('./commands/stats');
    const command = new StatsCommand(this.statsManager, this.activityLogger);
    await command.execute(options);
  }

  // ── UI Delegates ───────────────────────────────────────────────────

  /**
   * Interactive message selection (delegates to MessageSelector)
   */
  async selectMessage(messages) {
    return this.messageSelector.select(messages);
  }

  // ── Diff Management Delegates ──────────────────────────────────────

  /**
   * Intelligently manage diff for optimal AI generation
   */
  manageDiffForAI(diff, options = {}) {
    return this.diffManager.manageDiffForAI(diff, options);
  }

  /**
   * Smart truncate diff to preserve most relevant content
   */
  smartTruncateDiff(diff, maxSize, semanticContext) {
    return this.diffManager.smartTruncateDiff(diff, maxSize, semanticContext);
  }

  /**
   * Parse diff into individual file chunks with headers and content
   */
  parseDiffIntoFileChunks(diff) {
    return this.diffManager.parseDiffIntoFileChunks(diff);
  }

  /**
   * Score a file chunk by significance (higher = more important)
   */
  scoreFileChunk(chunk, semanticContext) {
    return this.diffManager.scoreFileChunk(chunk, semanticContext);
  }

  /**
   * Build a summary of skipped files grouped by pattern
   */
  buildSkippedFileSummary(skippedFiles) {
    return this.diffManager.buildSkippedFileSummary(skippedFiles);
  }

  /**
   * Chunk large diffs into smaller pieces for AI processing
   */
  chunkDiff(diff, maxTokens = 6000) {
    return this.diffManager.chunkDiff(diff, maxTokens);
  }

  // ── Provider Orchestration Delegates ────────────────────────────────

  /**
   * Generate commit messages with sequential fallback (preferred provider first, then backup)
   */
  async generateWithSequentialFallback(diff, options) {
    return this.providerOrchestrator.generateWithSequentialFallback(
      diff, options, this.activityLogger, this.statsManager
    );
  }

  /**
   * Select best commit messages from chunked results
   */
  selectBestMessages(messages, count = 3, diff = null) {
    return this.providerOrchestrator.selectBestMessages(messages, count, diff);
  }

  /**
   * Score a commit message based on quality factors
   */
  scoreCommitMessage(message, diff = null) {
    return this.providerOrchestrator.scoreCommitMessage(message, diff);
  }

  // ── Conflict Resolution Delegates ──────────────────────────────────

  /**
   * Parse conflict blocks from content and extract both versions
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
   * Handle conflict markers in a diff using AI-powered resolution
   */
  async handleConflictMarkers(diff, filePath) {
    return this.conflictResolver.handleConflictMarkers(diff, filePath);
  }

  /**
   * Detect and clean up conflict markers in all staged files using AI
   */
  async detectAndCleanupConflictMarkers() {
    // Need to pass gitManager to conflictResolver
    this.conflictResolver.gitManager = this.gitManager;
    return this.conflictResolver.detectAndCleanupConflictMarkers();
  }

  /**
   * Clean conflict markers from content string (simple version - keeps HEAD)
   */
  cleanConflictMarkers(content) {
    return this.conflictResolver.cleanConflictMarkers(content);
  }

  /**
   * Provide helpful suggestions based on error type
   */
  provideErrorSuggestions(error, options) {
    const chalk = require('chalk');
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

  /**
   * Display log analysis results
   */
  displayLogAnalysis(analysis) {
    const StatsCommand = require('./commands/stats');
    const command = new StatsCommand(this.statsManager, this.activityLogger);
    command.displayLogAnalysis(analysis);
  }
}

module.exports = AICommitGenerator;
