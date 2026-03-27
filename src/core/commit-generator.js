/**
 * CommitGenerator - Orchestrates commit message generation with context enrichment
 *
 * Coordinates the full pipeline: git diff → run detectors → enrich AI prompts →
 * generate messages → validate quality → commit. Uses ComponentDetector,
 * FileTypeDetector, and DependencyMapper outputs to add context awareness.
 *
 * Per CORE-01: Full git workflow support (stage, commit, pull, push)
 * Per CORE-02: AI provider abstraction with sequential fallback
 * Per CORE-03: Diff processing with context enrichment
 * Per QUAL-01/QUAL-02: Quality validation via MessageValidator
 */

const path = require('path');
const MessageValidator = require('./message-validator');

class CommitGenerator {
  /**
   * Create a CommitGenerator instance
   * @param {Object} dependencies - Dependency injection object
   * @param {GitManager} dependencies.gitManager - Git operations manager
   * @param {ConfigManager} dependencies.configManager - Configuration manager
   * @param {AnalysisEngine} dependencies.analysisEngine - Repository analysis
   * @param {MessageFormatter} dependencies.messageFormatter - Message formatter
   * @param {ProviderOrchestrator} dependencies.providerOrchestrator - AI provider orchestration
   * @param {ActivityLogger} dependencies.activityLogger - Activity logging
   * @param {StatsManager} dependencies.statsManager - Usage statistics
   * @param {typeof ComponentDetector} dependencies.ComponentDetector - Component detector class
   * @param {typeof FileTypeDetector} dependencies.FileTypeDetector - File type detector class
   * @param {typeof DependencyMapper} dependencies.DependencyMapper - Dependency mapper class
   */
  constructor(dependencies) {
    this.gitManager = dependencies.gitManager;
    this.configManager = dependencies.configManager;
    this.analysisEngine = dependencies.analysisEngine;
    this.messageFormatter = dependencies.messageFormatter;
    this.providerOrchestrator = dependencies.providerOrchestrator;
    this.activityLogger = dependencies.activityLogger;
    this.statsManager = dependencies.statsManager;
    this.ComponentDetector = dependencies.ComponentDetector;
    this.FileTypeDetector = dependencies.FileTypeDetector;
    this.DependencyMapper = dependencies.DependencyMapper;
    this.messageValidator = new MessageValidator();
  }

  /**
   * Generate commit messages with full context enrichment
   * @param {Object} options - Generation options
   * @param {number} [options.count=3] - Number of messages to generate
   * @param {string} [options.type] - Conventional commit type (feat, fix, etc.)
   * @param {boolean} [options.conventional=true] - Use conventional commit format
   * @param {string} [options.language='en'] - Message language
   * @param {boolean} [options.dryRun=false] - Preview only, no commit
   * @param {boolean} [options.cache=true] - Enable caching
   * @returns {Promise<string[]>} Formatted commit messages
   */
  async generate(options = {}) {
    const startTime = Date.now();
    const mergedOptions = {
      count: 3,
      conventional: true,
      language: 'en',
      dryRun: false,
      cache: true,
      ...options
    };

    let diff = null;

    try {
      await this.activityLogger.info('commit_generation_started', { options: mergedOptions });

      // Step 1: Get staged diff
      diff = await this.gitManager.getStagedDiff();
      if (!diff || diff.trim().length === 0) {
        throw new Error('No staged changes found. Please stage your changes first.');
      }

      // Step 2: Extract changed file paths
      const filePaths = this.extractFilePathsFromDiff(diff);

      // Step 3: Run detectors in parallel
      const detectorResults = await this.runDetectors(filePaths, diff);

      // Step 4: Build enriched context
      const enrichedContext = this.buildEnrichedContext(detectorResults, diff);

      // Step 5: Generate messages with AI provider
      const config = await this.configManager.load();
      const messages = await this.providerOrchestrator.generateWithSequentialFallback(
        diff,
        {
          context: enrichedContext,
          count: mergedOptions.count,
          type: mergedOptions.type,
          language: mergedOptions.language,
          conventional: mergedOptions.conventional,
          preferredProvider: mergedOptions.provider || config.defaultProvider
        },
        this.activityLogger,
        this.statsManager
      );

      if (!messages || messages.length === 0) {
        throw new Error('AI provider failed to generate commit messages.');
      }

      // Step 6: Validate messages
      const batchValidation = this.messageValidator.validateBatch(messages, enrichedContext);
      const qualityCheck = this.messageValidator.checkQualityThresholds(batchValidation);

      if (!qualityCheck.qual01Pass || !qualityCheck.qual02Pass) {
        const error = new Error(
          `Generated messages did not meet quality standards: ${qualityCheck.failures.map(f => f.description).join(', ')}`
        );
        error.qualityFailures = qualityCheck.failures;
        error.suggestions = this.messageValidator.generateSuggestions(
          batchValidation.invalidMessages.flatMap(m => m.issues)
        );
        throw error;
      }

      // Step 7: Format messages with context enrichment
      const formattedMessages = messages.map((msg) =>
        this.messageFormatter.formatWithContext(msg, enrichedContext, {
          conventional: mergedOptions.conventional,
          includeSections: ['what', 'why', 'impact']
        })
      );

      // Step 8: Handle dry run or create commit
      if (mergedOptions.dryRun) {
        await this.activityLogger.info('dry_run_completed', {
          messagesCount: formattedMessages.length
        });
        return formattedMessages;
      }

      // Select best message and commit
      const selectedMessage = formattedMessages[0];
      await this.gitManager.commit(selectedMessage);

      // Update statistics
      await this.statsManager.recordCommit(
        mergedOptions.provider || config.defaultProvider
      );

      // Log successful commit
      await this.activityLogger.logGitOperation('commit', {
        message: selectedMessage,
        success: true,
        duration: Date.now() - startTime
      });

      await this.activityLogger.info('commit_completed', {
        selectedMessage,
        messagesGenerated: messages.length,
        duration: Date.now() - startTime
      });

      return formattedMessages;
    } catch (error) {
      await this.activityLogger.logDetailedError(error, {
        operation: 'commit_generation',
        duration: Date.now() - startTime,
        provider: options.provider,
        diffLength: diff?.length
      });
      throw error;
    }
  }

  /**
   * Run all detectors in parallel
   * @private
   */
  async runDetectors(filePaths, diff) {
    const repoRoot = process.cwd();

    // Initialize detectors
    const componentDetector = new this.ComponentDetector(repoRoot);
    const fileTypeDetector = new this.FileTypeDetector(repoRoot);
    const dependencyMapper = new this.DependencyMapper(repoRoot);

    // Run detectors in parallel
    const [componentResults, fileTypeResults] = await Promise.all([
      componentDetector.detect(filePaths),
      fileTypeDetector.detectBatch(filePaths)
    ]);

    // For dependency mapping, we need file contents
    const filesWithContents = await this.loadFileContents(filePaths);
    const dependencyResults = dependencyMapper.mapDependencies(filesWithContents);

    return {
      components: componentResults,
      fileTypes: fileTypeResults,
      dependencies: dependencyResults
    };
  }

  /**
   * Load file contents for dependency mapping
   * @private
   */
  async loadFileContents(filePaths) {
    const fs = require('fs-extra');
    const contents = new Map();

    for (const filePath of filePaths) {
      try {
        const fullPath = path.join(process.cwd(), filePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        contents.set(filePath, content);
      } catch (error) {
        // Skip files that can't be read (binary, deleted, etc.)
      }
    }

    return contents;
  }

  /**
   * Build enriched context from detector results
   * @private
   */
  buildEnrichedContext(detectorResults, diff) {
    const components = detectorResults.components || [];
    const fileTypes = detectorResults.fileTypes || { summary: {} };
    const dependencies = detectorResults.dependencies || { imports: [], exports: [], affected: [] };

    // Extract component summary
    const componentList = components
      .filter(c => c && c.component)
      .map(c => c.component);
    const uniqueComponents = [...new Set(componentList)];

    // Extract file type summary
    const fileTypeSummary = fileTypes.summary || {};

    // Build context object
    const context = {
      components: {
        list: uniqueComponents,
        count: uniqueComponents.length,
        details: components
      },
      fileTypes: {
        summary: fileTypeSummary,
        countByType: fileTypeSummary.countByType || {},
        countByLanguage: fileTypeSummary.countByLanguage || {}
      },
      dependencies: {
        imports: dependencies.imports || [],
        exports: dependencies.exports || [],
        affected: dependencies.affected || []
      },
      hasSemanticContext: !!(
        fileTypes.files && fileTypes.files.length > 0
      )
    };

    return context;
  }

  /**
   * Extract file paths from git diff
   * @param {string} diff - Git diff string
   * @returns {string[]} Array of file paths
   */
  extractFilePathsFromDiff(diff) {
    const filePaths = [];
    const lines = diff.split('\n');

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        const match = line.match(/diff --git a\/(.+?) b\/(.+)/);
        if (match && match[2]) {
          filePaths.push(match[2]);
        }
      }
    }

    return filePaths;
  }

  /**
   * Build enriched AI prompt with detector context
   * @param {string} diff - Git diff string
   * @param {Object} detectorResults - Results from detectors
   * @returns {string} Enriched prompt
   */
  buildEnrichedPrompt(diff, detectorResults) {
    const { components, fileTypes, dependencies } = detectorResults;

    const promptParts = [diff];

    // Add component context
    const componentList = components
      .filter(c => c.component)
      .map(c => c.component);
    const uniqueComponents = [...new Set(componentList)];

    if (uniqueComponents.length > 0) {
      promptParts.push(`\n\nChanged components: ${uniqueComponents.join(', ')}`);
    }

    // Add file type context
    if (fileTypes.summary) {
      const { countByType, countByLanguage } = fileTypes.summary;
      const typeSummary = Object.entries(countByType || {})
        .map(([type, count]) => `${count} ${type}`)
        .join(', ');
      const langSummary = Object.entries(countByLanguage || {})
        .map(([lang, count]) => `${count} ${lang}`)
        .join(', ');

      if (typeSummary) {
        promptParts.push(`\nFile types: ${typeSummary}`);
      }
      if (langSummary) {
        promptParts.push(`\nLanguages: ${langSummary}`);
      }
    }

    // Add dependency context
    if (dependencies.affected && dependencies.affected.length > 0) {
      promptParts.push(
        `\nDependencies: ${dependencies.affected.length} files affected by these changes`
      );
    }

    return promptParts.join('\n');
  }
}

module.exports = CommitGenerator;
