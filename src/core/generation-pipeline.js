/**
 * Generation Pipeline - deep module for AI commit message generation.
 *
 * One interface in: generate(diff, options) → messages[].
 * Owns: diff shaping, prompt assembly, provider sequencing (with fallback),
 * chunk loop, response parsing, ranking, quality gates, and activity logging.
 * Providers are thin adapters (generateResponse: text in → text out).
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
   */
  constructor({ diffShaper, promptBuilder, messageRanker, messageValidator, activityLogger, statsManager, providerFactory = AIProviderFactory }) {
    this.diffShaper = diffShaper;
    this.promptBuilder = promptBuilder;
    this.messageRanker = messageRanker;
    this.messageValidator = messageValidator;
    this.activityLogger = activityLogger;
    this.statsManager = statsManager;
    this.providerFactory = providerFactory;
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
        const provider = this.providerFactory.create(providerName);

        let messages;
        let actualPrompt;

        // Handle different diff strategies
        if (diffManagement.strategy === 'full' || diffManagement.strategy === 'smart-truncated') {
          // Simple case: diff in one prompt (full or smart-truncated)
          // Prompt is assembled ONCE here; providers are thin text-in/text-out adapters.
          actualPrompt = this.promptBuilder.buildPrompt(diffManagement.data, options);
          const raw = await provider.generateResponse(
            this.applyProviderPreamble(providerName, actualPrompt),
            COMMIT_GENERATION_OPTIONS
          );
          messages = this.parseCommitMessages(raw);
        } else {
          // Complex case: chunked processing
          console.log(
            chalk.blue(`📦 Processing ${diffManagement.chunks} chunks with ${providerName}...`)
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
                  hasSignificantChanges: chunk.context.hasSignificantChanges,
                },
              },
            };

            // Generate with this chunk
            const chunkPrompt = this.promptBuilder.buildPrompt(chunk.content, chunkOptions);
            const rawChunk = await provider.generateResponse(
              this.applyProviderPreamble(providerName, chunkPrompt),
              COMMIT_GENERATION_OPTIONS
            );
            const chunkResult = this.parseCommitMessages(rawChunk);

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

          messages = this.messageRanker.selectBestMessages(chunkMessages, options.count || 3);
          actualPrompt = `Chunked processing (${diffManagement.chunks} chunks)`;
        }

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
