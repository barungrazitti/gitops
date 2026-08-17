/**
 * Generation Pipeline - deep module for AI commit message generation.
 *
 * One interface in: generate(diff, options) → messages[].
 * Owns: diff shaping, prompt assembly, provider sequencing (with fallback),
 * response parsing, ranking, quality gates, and activity logging.
 * Providers are thin adapters (generateResponse: text in → text out).
 * Note: the DiffShaper budget contract returns 'full'/'smart-truncated' today;
 * there is no chunked strategy in production, so the pipeline is single-pass.
 */

const chalk = require('chalk');
const AIProviderFactory = require('../providers/ai-provider-factory');

// Commit-message generation lives here, at the pipeline layer.
const COMMIT_SYSTEM_PROMPT =
  'You are an expert software developer who writes clear, concise commit messages. CRITICAL: Output ONLY commit messages. Never include instructions, warnings, or deployment advice. Only analyze the provided diff, do not reference any previous commits or external context.';

const OLLAMA_COMMIT_PREAMBLE =
  'CRITICAL: Output ONLY commit messages. No instructions, warnings, or explanations. Only analyze the provided diff below. Do not reference any previous commits, external context, or unrelated changes.\n\n';

const COMMIT_GENERATION_OPTIONS = {
  systemPrompt: COMMIT_SYSTEM_PROMPT,
  maxTokens: 150,
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
   * @param {Object} [deps.providerFactory] - Creates provider adapters (injectable for tests).
   * @param {Object} [deps.configManager] - Config store shared with provider adapters.
   */
  constructor({ diffShaper, promptBuilder, messageRanker, messageValidator, activityLogger, statsManager, providerFactory = AIProviderFactory, configManager }) {
    this.diffShaper = diffShaper;
    this.promptBuilder = promptBuilder;
    this.messageRanker = messageRanker;
    this.messageValidator = messageValidator;
    this.activityLogger = activityLogger;
    this.statsManager = statsManager;
    this.providerFactory = providerFactory;
    this.configManager = configManager;
  }

  /**
   * Generate commit messages for a diff, with sequential provider fallback.
   * @param {string} diff - The (already sanitized) diff content.
   * @param {Object} options - context, count, conventional, preferredProvider, ...
   * @returns {Promise<string[]>} Ranked candidate commit messages.
   */
  async generate(diff, options = {}) {
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
    const diffManagement = this.diffShaper.manageDiffForAI(diff, enrichedOptions);
    console.log(chalk.blue(`📊 Diff strategy: ${diffManagement.info.strategy}`));
    console.log(chalk.dim(`   Reasoning: ${diffManagement.info.reasoning}`));

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

    throw new Error('All AI providers failed to generate commit messages.');
  }

  /**
   * Apply provider-specific prompt preamble (pipeline-owned prompt content).
   */
  applyProviderPreamble(providerName, prompt) {
    return providerName === 'ollama' ? OLLAMA_COMMIT_PREAMBLE + prompt : prompt;
  }

  /**
   * Parse a raw provider response into candidate commit messages.
   * Replaces the former provider-side parseResponse/validateMessage pair.
   */
  parseCommitMessages(content) {
    if (!content || typeof content !== 'string') {
      return [];
    }

    return content
      .split('\n')
      .map(msg => msg.trim())
      .filter(msg => msg.length >= 10 && msg.length <= 200);
  }
}

module.exports = GenerationPipeline;
