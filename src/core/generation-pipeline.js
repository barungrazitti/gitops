/**
 * Generation Pipeline - deep module for AI commit message generation.
 *
 * One interface in: generate(diff, options) → messages[].
 * Owns: secret redaction, diff shaping, prompt assembly, provider sequencing
 * (with fallback), response parsing, ranking, quality gates, and activity logging.
 * Providers are thin adapters (generateResponse: text in → text out).
 * Note: the DiffShaper budget contract returns 'full'/'smart-truncated' today;
 * there is no chunked strategy in production, so the pipeline is single-pass.
 */

const chalk = require('chalk');
const AIProviderFactory = require('../providers/ai-provider-factory');
const SecretScanner = require('../utils/secret-scanner');

// Commit-message generation lives here, at the pipeline layer.
const COMMIT_SYSTEM_PROMPT =
  'You are an expert software developer who writes clear, concise commit messages. CRITICAL: Output ONLY commit messages. Never include instructions, warnings, or deployment advice. Only analyze the provided diff, do not reference any previous commits or external context.';

const OLLAMA_COMMIT_PREAMBLE =
  'CRITICAL: Output ONLY commit messages. No instructions, warnings, or explanations. Only analyze the provided diff below. Do not reference any previous commits, external context, or unrelated changes.\n\n';

const COMMIT_GENERATION_OPTIONS = {
  systemPrompt: COMMIT_SYSTEM_PROMPT,
  maxTokens: 300,
  temperature: 0.3,
};

class GenerationPipeline {
  /**
   * @param {Object} deps
   * @param {Object} deps.diffShaper - Owns the diff budget and classification.
   * @param {Object} deps.promptBuilder - Assembles prompts (no size management).
   * @param {Object} deps.messageRanker - Scores and ranks candidate messages.
   * @param {Object} deps.messageValidator - QUAL-01/02 quality gates.
   * @param {Object} deps.activityLogger - Structured activity logging.
   * @param {Object} deps.statsManager - Usage statistics.
   * @param {Object} [deps.secretScanner] - Redacts secrets/PII before provider calls.
   * @param {Object} [deps.providerFactory] - Creates provider adapters (injectable for tests).
   * @param {Object} [deps.configManager] - Config store shared with provider adapters.
   */
  constructor({ diffShaper, promptBuilder, messageRanker, messageValidator, activityLogger, statsManager, secretScanner = new SecretScanner(), providerFactory = AIProviderFactory, configManager }) {
    this.diffShaper = diffShaper;
    this.promptBuilder = promptBuilder;
    this.messageRanker = messageRanker;
    this.messageValidator = messageValidator;
    this.activityLogger = activityLogger;
    this.statsManager = statsManager;
    this.secretScanner = secretScanner;
    this.providerFactory = providerFactory;
    this.configManager = configManager;
  }

  /**
   * Generate commit messages for a diff, with sequential provider fallback.
   * @param {string} diff - The diff content (redacted here if not already).
   * @param {Object} options - context, count, conventional, preferredProvider, sanitize, ...
   * @returns {Promise<string[]>} Ranked candidate commit messages.
   */
  async generate(diff, options = {}) {
    const { preferredProvider, context, ...generationOptions } = options;

    // Determine providers to use - preferred first, then fallback
    const allProviders = ['ollama', 'groq'];
    const providers = preferredProvider
      ? [preferredProvider, ...allProviders.filter(p => p !== preferredProvider)]
      : allProviders;

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

    // SECURITY: redact secrets/PII at the pipeline boundary so EVERY caller is
    // covered (interactive generate AND auto mode), not just the CLI path.
    // Idempotent: diffs already redacted upstream pass through unchanged.
    let safeDiff = diff;
    if (options.sanitize !== false) {
      const originalLength = diff.length;
      safeDiff = this.secretScanner.scanAndRedact(diff, true);
      const redactionSummary = this.secretScanner.getRedactionSummary();
      if (redactionSummary.found) {
        await this.activityLogger.warn('sensitive_data_redacted', {
          source: 'generation_pipeline',
          redacted: redactionSummary.redacted,
          byCategory: redactionSummary.byCategory,
          originalSize: originalLength,
          sanitizedSize: safeDiff.length,
        });
      }
      this.secretScanner.clearRedactionLog();
    }

    // Step 1: Intelligent diff management with semantic context
    const diffManagement = this.diffShaper.manageDiffForAI(safeDiff, enrichedOptions);
    // Single status line (details stay in the log file): strategy + size delta.
    const { strategy, size, originalSize } = diffManagement.info;
    const sizeNote =
      originalSize && originalSize !== size
        ? ` (${Math.round(originalSize / 1024)}KB→${Math.round(size / 1024)}KB)`
        : '';
    console.log(chalk.dim(`📊 Diff: ${strategy}${sizeNote}`));

    // Binary/asset-only change: nothing for the AI to analyze; synthesize locally.
    if (diffManagement.strategy === 'binary-only') {
      const messages = this.synthesizeBinaryOnlyMessages(
        diffManagement.info.binaryFiles || [],
        options.count || 3
      );
      await this.activityLogger.info('diff_management', {
        ...diffManagement.info,
        provider: 'local',
        responseTime: 0,
        success: true,
      });
      const batch = this.messageValidator.validateBatch(messages);
      const thresholds = this.messageValidator.checkQualityThresholds(batch);
      await this.activityLogger.info('quality_gates', {
        provider: 'local',
        stats: batch.stats,
        thresholds,
      });
      return messages;
    }

    // Compute diff analysis once (DiffShaper owns classification); prompt builders reuse it
    enrichedOptions.diffAnalysis = this.diffShaper.analyzeDiffType(
      diffManagement.data,
      enrichedOptions.context
    );
    enrichedOptions.typeHint = this.diffShaper.getCompatibleTypeHint(
      context?.files?.type,
      enrichedOptions.diffAnalysis
    );

    // Step 2: Use sequential fallback mode
    return await this.generateWithSequentialProviders(diffManagement, enrichedOptions, providers);
  }

  /**
   * Try providers sequentially until one produces messages.
   */
  async generateWithSequentialProviders(diffManagement, options, providers) {
    const startTime = Date.now();

    for (const providerName of providers) {
      try {
        const startProviderTime = Date.now();
        const provider = this.providerFactory.create(providerName, {
          configManager: this.configManager,
          activityLogger: this.activityLogger,
        });

        // Single-pass generation: prompt assembled ONCE here; providers are
        // thin text-in/text-out adapters. No chunked strategy exists in the
        // DiffShaper budget contract today.
        const actualPrompt = this.promptBuilder.buildPrompt(diffManagement.data, options);
        const raw = await provider.generateResponse(
          this.applyProviderPreamble(providerName, actualPrompt),
          COMMIT_GENERATION_OPTIONS
        );
        const candidates = this.parseCommitMessages(raw);

        // Rank candidates against the actual diff (relevance scoring)
        const messages = this.messageRanker.selectBestMessages(
          candidates,
          options.count || 3,
          diffManagement.data
        );

        const responseTime = Date.now() - startProviderTime;

        if (messages && messages.length > 0) {
          await this.statsManager.recordCommit(providerName);

          const changeType = options.diffAnalysis?.type || 'change';
          console.log(
            chalk.green(
              `✅ ${providerName} generated ${messages.length} message${messages.length === 1 ? '' : 's'} (${changeType}) in ${responseTime}ms`
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
            semanticContext: !!options.context.hasSemanticContext,
          });

          // Log context usage for debugging (file log only; console stays quiet)
          if (options.context.hasSemanticContext) {
            await this.activityLogger.debug('semantic_context_used', {
              provider: providerName,
            });
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
          diffManagement.data,
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

    throw new Error(
      'All AI providers failed. Check your setup: run "aic config --list" to verify config, or "aic setup" to reconfigure. ' +
        'For Groq, ensure GROQ_API_KEY is set in .env. For Ollama, ensure it is running (ollama serve).'
    );
  }

  /**
   * Apply provider-specific prompt preamble (pipeline-owned prompt content).
   */
  applyProviderPreamble(providerName, prompt) {
    return providerName === 'ollama' ? OLLAMA_COMMIT_PREAMBLE + prompt : prompt;
  }

  /**
   * Build commit messages for binary/asset-only changes without an AI call.
   * One message per file (verb from the diff headers), plus a combined
   * message when several files changed.
   */
  synthesizeBinaryOnlyMessages(binaryFiles, count = 3) {
    if (!binaryFiles || binaryFiles.length === 0) {
      return ['chore: update binary assets'];
    }
    const verb = { added: 'add', removed: 'remove', changed: 'update' };
    const perFile = binaryFiles.map(f => {
      const base = (f.fileName || 'binary files').split('/').pop();
      return `chore: ${verb[f.change] || 'update'} ${base}`;
    });
    if (binaryFiles.length > 1) {
      perFile.push(`chore: update ${binaryFiles.length} asset files`);
    }
    const unique = [...new Set(perFile)];
    return unique.slice(0, Math.max(1, count));
  }

  /**
   * Parse a raw provider response into candidate commit messages.
   * Replaces the former provider-side parseResponse/validateMessage pair.
   */
  parseCommitMessages(content) {
    if (!content || typeof content !== 'string') {
      return [];
    }

    const blocks = content.split(/\n\s*\n/).map(block => block.trim()).filter(block => block.length > 0);
    return blocks.filter(block => {
      const firstLine = block.split('\n')[0];
      return firstLine.length >= 10 && firstLine.length <= 200;
    });
  }
}

module.exports = GenerationPipeline;
