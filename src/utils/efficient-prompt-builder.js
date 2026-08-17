/**
 * Efficient Prompt Builder - prompt assembly only.
 * Diff classification, truncation, and context limiting are owned by DiffShaper
 * (src/core/diff-shaper.js) per AGENTS.md: "DiffShaper owns the diff budget.
 * The prompt builder must NOT re-truncate."
 */

const DiffCategorizer = require('./diff-categorizer');
const EntityExtractor = require('./entity-extractor');
const PromptTemplates = require('./prompt-templates');
const DiffSummarizer = require('./diff-summarizer');
const DiffShaper = require('../core/diff-shaper');

class EfficientPromptBuilder {
  constructor(options = {}) {
    this.preserveContext = options.preserveContext !== false;
    this.diffCategorizer = new DiffCategorizer();
    this.entityExtractor = new EntityExtractor();
    this.diffSummarizer = new DiffSummarizer();
    this.diffShaper = options.diffShaper || new DiffShaper();
  }

  /**
   * Build an optimized prompt for AI commit message generation
   */
  buildPrompt(diff, options = {}) {
    const {
      context,
      conventional,
      count = 1,
      chunkIndex,
      totalChunks,
      enhancedPrompt,
      promptInstructions,
      strictValidation,
      diffFacts,
    } = options;

    // Handle null/undefined diff
    if (!diff) {
      diff = '';
    }

    let prompt = '';

    // Diff analysis comes from DiffShaper (pre-computed via options, or computed here)
    const changeAnalysis = options.diffAnalysis || this.diffShaper.analyzeDiffType(diff, context);
    const impactAnalysis = changeAnalysis;

    // Categorize diff by size
    const diffCategory = this.diffCategorizer.categorizeDiff(
      diff,
      options.categorizationThresholds
    );
    options.diffCategory = diffCategory;

    // Add most relevant context (prioritized) - must be before small/large diff handling
    const relevantContext = this.extractRelevantContext(context, changeAnalysis);

    // Extract entities for small diffs
    if (diffCategory.category === 'small') {
      const entities = this.entityExtractor.extractEntities(diff);
      options.extractedEntities = entities;
      options.entityList = PromptTemplates.entityListByType(entities);

      // Add entity-centric section to prompt
      const entitySection = PromptTemplates.buildSmallDiffPrompt({
        category: diffCategory.category,
        entityList: options.entityList,
        entityCount: entities.all.length,
        conventional,
        context: relevantContext,
      });
      prompt += '\n\n' + entitySection;
    }

    // Handle large diffs with hierarchical summarization
    if (diffCategory.category === 'large') {
      // Extract file chunks and summarize
      const fileChunks = this.diffSummarizer.extractFileChunks(diff);
      const summaries = fileChunks.map((chunk, index) =>
        this.diffSummarizer.summarizeChunk(chunk, index, fileChunks.length)
      );

      const combined = this.diffSummarizer.combineSummaries(summaries, conventional);

      options.chunkSummaries = summaries;
      options.combinedSummary = combined;

      const largeDiffPrompt = PromptTemplates.buildLargeDiffPrompt({
        chunkCount: fileChunks.length,
        chunkSummaries: combined.combined,
        conventional,
      });

      prompt += '\n\n' + largeDiffPrompt;
      console.log(`Processing ${fileChunks.length} chunks summary...`);
    }

    // Log category for debugging
    console.log(`Diff category: ${diffCategory.category}`);

    // Detect problematic cases (large WordPress files, etc.)
    const isProblematicCase = this.detectProblematicCase(diff, context);
    const isWordPressFile = this.isWordPressFile(diff, context);

    // Build concise, focused prompt
    let basePrompt = `Generate ${count} precise commit message for this git diff. OUTPUT ONLY COMMIT MESSAGE - NO INSTRUCTIONS, WARNINGS, OR EXPLANATIONS.`;

    // Handle binary files specially - they have no code changes
    if (changeAnalysis.type === 'binary') {
      const fileMatch = diff.match(/diff --git a\/(.+?) b\/(.+)/m);
      const fileName = fileMatch ? fileMatch[2].split('/').pop() : 'unknown';
      const isNew = changeAnalysis.keywords.includes('added');
      const isDeleted = changeAnalysis.keywords.includes('removed');

      basePrompt += `

For BINARY FILES with no code changes:
- Use format "chore: add/update/remove filename" based on file path
- ${isNew ? `NEW file: Output "chore: add ${fileName}"` : isDeleted ? `DELETED file: Output "chore: remove ${fileName}"` : `CHANGED file: Output "chore: update ${fileName}"`}
- DO NOT guess functionality - the diff contains no code changes to analyze`;
    }

    prompt = basePrompt;

    // Add enhanced instructions for problematic cases
    if (enhancedPrompt || isProblematicCase) {
      prompt += this.buildEnhancedInstructions(
        isProblematicCase,
        isWordPressFile,
        promptInstructions
      );
    }

    // Add CRITICAL instruction to focus on actual changes
    prompt += `\n\nCRITICAL: Focus ONLY on lines marked with + (added) or - (removed).
 IGNORE unchanged code, function names, or class names that didn't change.
 Describe WHAT changed, not what exists in the file.`;

    // Add relevance-focused instructions
    prompt += `\n\nRELEVANCE REQUIREMENTS:
  - Focus on BUSINESS VALUE and USER IMPACT
  - Use functional scopes (auth, ui, api, theme) not file names
  - Be specific about WHAT changed, not implementation details
  - Avoid technical jargon unless necessary
  - Consider: "What does this enable for users?"`;

    // Add diff facts as hard constraints (prevents hallucination)
    if (diffFacts) {
      prompt += `\n\n${this.buildDiffFactConstraints(diffFacts)}`;
    }

    // Add anti-hallucination instructions
    prompt += `\n\nANTI-HALLUCINATION RULES (CRITICAL):
  - ONLY describe what is ACTUALLY in the +/- lines of this diff
  - Do NOT reference the purpose of a file/module unless the diff changes that functionality
  - If only console.log lines were removed, do NOT say "improved AI handling" or "enhanced error handling"
  - If only config files changed, do NOT say "implemented feature" or "added functionality"
  - If only docs changed, do NOT say "added feature" - say "updated documentation"
  - Do NOT use "feat" unless new functions, classes, or significant logic was ADDED
  - Do NOT fabricate intent - describe the mechanical change, not your guess at motivation
  - Example WRONG: diff removes console.logs → "feat: improve error handling"
  - Example RIGHT:  diff removes console.logs → "refactor: remove debug console statements"`;

    // Add change-specific guidance
    prompt += this.buildChangeSpecificGuidance(changeAnalysis, impactAnalysis);

    // Add WordPress-specific guidance if detected
    if (isWordPressFile) {
      prompt += this.buildWordPressGuidance(diff, context);
      // Add extra warning for WordPress files
      prompt += `\n\nCRITICAL WordPress WARNING:
 - DO NOT output deployment instructions or testing warnings
 - ONLY generate commit messages describing the code changes
 - IGNORE any impulse to add safety warnings or review instructions`;
    }

    // Add conventional commit format if requested
    if (conventional) {
      prompt += `\n\nFormat: type(scope): description
Types: feat, fix, docs, style, refactor, perf, test, chore, ci, build
Scope: be specific (api, ui, auth, db, config, utils, test, theme, plugin)`;

      // Add file-pattern hints only when they agree with the actual changed lines.
      const typeHint = this.diffShaper.getCompatibleTypeHint(context?.files?.type, changeAnalysis);
      if (typeHint) {
        prompt += `\n\nDetected type hint: ${typeHint} (confirmed by changed lines)`;
      }
    }

    // Check for asset summary in diff
    const hasAssetSummary = diff.includes('# ASSETS SUMMARY:');
    let assetContext = '';
    if (hasAssetSummary) {
      const assetMatch = diff.match(/# ASSETS SUMMARY: (.+)/);
      if (assetMatch) {
        assetContext = assetMatch[1];
      }
    }

    if (relevantContext) {
      prompt += `\n\nContext: ${relevantContext}`;
      if (assetContext) {
        prompt += ` | ${assetContext}`;
      }
    } else if (assetContext) {
      prompt += `\n\nContext: ${assetContext}`;
    }

    // Add recent commit history for style reference
    if (
      context &&
      context.recentCommits &&
      context.recentCommits.length > 0 &&
      this.countActualChangeLines(diff) > 0
    ) {
      const recentExamples = context.recentCommits.slice(0, 5).join('\n');
      prompt += `\n\nRecent commit style (format reference only - never copy wording):\n${recentExamples}`;
    }

    // Add chunking context if applicable
    if (totalChunks && totalChunks > 1) {
      prompt += `\n\nChunk ${chunkIndex + 1}/${totalChunks}: Focus on this section only`;
      if (options.context?.chunkInfo?.files?.length > 0) {
        prompt += ` (${options.context.chunkInfo.files.slice(0, 3).join(', ')})`;
      }
    }

    // Add dynamic examples based on context
    prompt += `\n\nExamples: ${this.generateContextualExamples(context, changeAnalysis, conventional)}`;

    // Add strict validation warnings if enabled
    if (strictValidation) {
      prompt += `\n\n⚠️  STRICT VALIDATION ENABLED:
 - Output ONLY commit messages (no explanations)
 - No explanatory phrases like "Here's", "This is", "The following"
 - No generic descriptions like "code has been modularized"
 - Each message must be actionable and specific
 - Focus on USER VALUE, not implementation details
 - Avoid file-specific scopes like "file.js:" - use functional scopes
 - Be specific about WHAT changed, not HOW it was implemented
 - NEVER output warnings, instructions, or deployment advice`;
    }

    prompt += `\n\n\`\`\`diff
${diff}
\`\`\`

REMEMBER: OUTPUT ONLY THE COMMIT MESSAGE. NO WARNINGS. NO INSTRUCTIONS. NO DEPLOYMENT ADVICE.

Single best commit message:`;

    // Apply context line limiting for small diffs (owned by DiffShaper)
    if (options.diffCategory && options.diffCategory.category === 'small') {
      const limitedDiff = this.diffShaper.limitContextLines(diff, 3);
      options.truncatedDiff = limitedDiff;
      // Replace diff in prompt with limited version
      prompt = prompt.replace(/```diff\n[\s\S]*?```/, `\`\`\`diff\n${limitedDiff}\n\`\`\``);

      // Add single-line change highlighting
      if (this.isSingleLineChange(diff)) {
        const highlighted = this.highlightSingleLine(diff);
        const singleLinePrompt = PromptTemplates.buildSingleLineChangePrompt(highlighted);
        prompt += '\n\n' + singleLinePrompt;
      }
    }

    // Note: Diff is already budget-fitted by DiffShaper; no compression here.
    return prompt;
  }

  /**
   * Check if diff has exactly one + or - line (excluding headers)
   */
  isSingleLineChange(diff) {
    if (!diff || typeof diff !== 'string') {
      return false;
    }

    const lines = diff.split('\n');
    let changeCount = 0;

    for (const line of lines) {
      // Skip diff headers
      if (
        line.startsWith('diff --git') ||
        line.startsWith('index') ||
        line.startsWith('---') ||
        line.startsWith('+++') ||
        line.startsWith('@@')
      ) {
        continue;
      }

      // Count actual changes
      if (line.startsWith('+') || line.startsWith('-')) {
        changeCount++;
      }
    }

    return changeCount === 1;
  }

  /**
   * Count actual added/removed lines, excluding diff metadata headers.
   */
  countActualChangeLines(diff) {
    if (!diff || typeof diff !== 'string') {
      return 0;
    }

    return diff.split('\n').filter(line => {
      return (
        (line.startsWith('+') && !line.startsWith('+++')) ||
        (line.startsWith('-') && !line.startsWith('---'))
      );
    }).length;
  }

  /**
   * Wrap single line change with marker
   */
  highlightSingleLine(diff) {
    if (!diff || typeof diff !== 'string') {
      return diff;
    }

    const lines = diff.split('\n');
    const result = [];

    for (const line of lines) {
      if (line.startsWith('+') || line.startsWith('-')) {
        result.push(`⬅️ ${line}`);
      } else {
        result.push(line);
      }
    }

    return result.join('\n');
  }

  /**
   * Detect problematic cases that need special handling
   */
  detectProblematicCase(diff, _context) {
    if (!diff) return false;

    // Large diff detection
    const isLargeDiff = diff.length > 15000;

    // WordPress theme file detection
    const isWordPressTheme =
      /functions\.php|style\.css|index\.php|header\.php|footer\.php|sidebar\.php|wp-content\/themes/.test(
        diff
      );

    // Mixed language detection (PHP + HTML + JS)
    const hasMixedLanguages =
      /<\?php/.test(diff) && /<[^>]+>/.test(diff) && /function|var|let|const/.test(diff);

    // Repetitive pattern detection (like banner arrays)
    const hasRepetitivePatterns =
      /(array|data)\s*=\s*\[.*?\]/s.test(diff) && (diff.match(/['"][^'"]*['"]/g) || []).length > 10;

    return isLargeDiff || isWordPressTheme || hasMixedLanguages || hasRepetitivePatterns;
  }

  /**
   * Check if this is a WordPress file
   */
  isWordPressFile(diff, context) {
    if (!diff) return false;

    const wordpressPatterns = [
      /functions\.php/,
      /wp-content\/themes/,
      /wp-content\/plugins/,
      /add_action\s*\(/,
      /add_filter\s*\(/,
      /add_shortcode\s*\(/,
      /wp_enqueue_script\s*\(/,
      /wp_enqueue_style\s*\(/,
      /get_template_part\s*\(/,
      /the_content\s*\(/,
      /wp_head\s*\(/,
      /wp_footer\s*\(/,
      /get_option\s*\(/,
      /update_option\s*\(/,
      /wp_query/,
      /WP_Query/,
      /\$wpdb/,
      /do_action\s*\(/,
      /apply_filters\s*\(/,
      /wordpress|wp_/,
    ];

    return (
      wordpressPatterns.some(pattern => pattern.test(diff)) ||
      context?.project?.primary === 'wordpress' ||
      context?.files?.wordpress?.isWordPress
    );
  }

  /**
   * Build enhanced instructions for problematic cases
   */
  buildEnhancedInstructions(isProblematicCase, isWordPressFile, promptInstructions) {
    let instructions = '\n\nCRITICAL INSTRUCTIONS:';

    if (promptInstructions) {
      instructions += `\n${promptInstructions}`;
    } else {
      if (isProblematicCase) {
        instructions += `
 - Focus on the MAIN change (lines with +/-), not every detail
 - Look for the primary purpose of the changes
 - Ignore repetitive HTML/template content
 - Focus on functional changes, not formatting`;
      }

      if (isWordPressFile) {
        instructions += `
 - This is a WordPress file - focus on functionality changes (look for +/- lines)
 - Look for hook/filter/shortcode changes
 - Focus on PHP logic changes, not HTML output
 - Identify theme/plugin modifications`;
      }
    }

    return instructions;
  }

  /**
   * Build WordPress-specific guidance
   */
  buildWordPressGuidance(diff, _context) {
    let guidance = '\n\nWordPress-Specific Focus:';

    // Detect specific WordPress changes
    const wpChanges = [];

    if (/add_action|add_filter|add_shortcode/.test(diff)) {
      wpChanges.push('hooks/shortcodes');
    }

    if (/wp_enqueue_script|wp_enqueue_style/.test(diff)) {
      wpChanges.push('asset loading');
    }

    if (/get_template_part|get_header|get_footer|get_sidebar/.test(diff)) {
      wpChanges.push('template structure');
    }

    if (/\$wpdb|WP_Query|get_posts|wp_get_posts/.test(diff)) {
      wpChanges.push('database queries');
    }

    if (/functions\.php/.test(diff)) {
      wpChanges.push('theme functions');
    }

    if (wpChanges.length > 0) {
      guidance += ` ${wpChanges.join(', ')}`;
    } else {
      guidance += ' general WordPress functionality';
    }

    return guidance;
  }

  /**
   * Build change-specific guidance
   */
  buildChangeSpecificGuidance(changeAnalysis, impactAnalysis) {
    let guidance = '\n\nFocus: ';

    switch (changeAnalysis.type) {
      case 'fix':
        guidance += 'what was broken and how it was resolved';
        if (impactAnalysis.security) guidance += ' (security fix)';
        break;
      case 'feat':
        guidance += 'what new capability this adds';
        if (impactAnalysis.userFacing) guidance += ' (user-visible feature)';
        break;
      case 'perf':
        guidance += 'what was optimized and the expected improvement';
        break;
      case 'refactor':
        guidance += 'what was restructured and why (no behavior change)';
        break;
      case 'test':
        guidance += 'what is being tested and coverage improvements';
        break;
      case 'docs':
        guidance += 'what documentation was added or updated';
        break;
      case 'style':
        guidance += 'CSS, layout, or formatting changes without new behavior';
        break;
      case 'build':
        guidance += 'dependency, package, or build configuration changes';
        break;
      default:
        guidance += 'primary purpose and key changes';
    }

    if (impactAnalysis.breaking) {
      guidance += '\nNote: This contains breaking changes';
    }

    return guidance;
  }

  /**
   * Extract most relevant context information
   */
  extractRelevantContext(context, changeAnalysis) {
    if (!context) return null;

    const contextParts = [];

    // Project type if available
    if (context.project?.primary) {
      contextParts.push(context.project.primary);
    }

    // Most relevant file types based on change type
    if (context.files?.fileTypes) {
      const relevantTypes = this.getRelevantFileTypes(context.files.fileTypes, changeAnalysis);
      if (relevantTypes.length > 0) {
        contextParts.push(relevantTypes.join(', '));
      }
    }

    // Key semantic information (limited)
    if (context.files?.semantic) {
      const { semantic } = context.files;
      const keyInfo = [];

      if (semantic.functions?.length > 0) {
        keyInfo.push(`symbols: ${semantic.functions.slice(0, 2).join(', ')}`);
      }
      if (semantic.components?.length > 0) {
        keyInfo.push(`components: ${semantic.components.slice(0, 2).join(', ')}`);
      }
      if (semantic.wordpress_hooks?.length > 0) {
        keyInfo.push(`hooks: ${semantic.wordpress_hooks.slice(0, 2).join(', ')}`);
      }

      if (keyInfo.length > 0) {
        contextParts.push(keyInfo.join('; '));
      }
    }

    return contextParts.length > 0 ? contextParts.join(' | ') : null;
  }

  /**
   * Get relevant file types based on change analysis
   */
  getRelevantFileTypes(fileTypes, changeAnalysis) {
    const relevant = [];

    // Prioritize file types based on change type
    const typePriorities = {
      feat: ['js', 'jsx', 'ts', 'tsx', 'py', 'php', 'css'],
      fix: ['js', 'ts', 'py', 'php', 'java'],
      test: ['test.js', 'test.ts', 'spec.js', 'spec.ts'],
      docs: ['md', 'txt', 'rst'],
      style: ['css', 'scss', 'less', 'vue'],
      perf: ['js', 'ts', 'py', 'php', 'java'],
      refactor: ['js', 'ts', 'py', 'php', 'java'],
      build: ['json', 'lock', 'yaml', 'yml', 'toml', 'xml'],
    };

    const priorities = typePriorities[changeAnalysis.type] || Object.keys(fileTypes);

    for (const type of priorities) {
      if (fileTypes[type] > 0) {
        relevant.push(type);
        if (relevant.length >= 2) break; // Limit to 2 most relevant
      }
    }

    return relevant;
  }

  /**
   * Generate contextual examples based on project and change type
   */
  generateContextualExamples(context, changeAnalysis, conventional) {
    const examples = [];

    // Base examples on change type
    switch (changeAnalysis.type) {
      case 'fix':
        examples.push('fix(auth): resolve login validation error');
        if (context?.project?.primary === 'wordpress') {
          examples.push('fix(theme): change query order to custom field');
        }
        break;
      case 'feat':
        examples.push('feat(api): add user profile endpoint');
        if (context?.project?.primary === 'react') {
          examples.push('feat(components): implement dark mode toggle');
        }
        break;
      case 'perf':
        examples.push('perf(database): optimize query with index');
        if (context?.project?.primary === 'wordpress') {
          examples.push('perf(api): cache REST query results');
        }
        break;
      case 'refactor':
        examples.push('refactor(utils): extract validation logic');
        break;
      case 'test':
        examples.push('test(auth): add unit tests for login flow');
        break;
      case 'docs':
        examples.push('docs(readme): document setup options');
        break;
      case 'style':
        examples.push('style(ui): adjust responsive button spacing');
        break;
      case 'build':
        examples.push('build(deps): update package dependencies');
        break;
      default:
        examples.push('chore(config): update environment variables');
    }

    // Add conventional format examples if needed
    if (conventional && examples.length > 0 && !examples[0].includes(':')) {
      examples[0] = `chore: ${examples[0]}`;
    }

    return examples.slice(0, 2).join(', ');
  }

  /**
   * Build constraint text from diff facts analysis
   */
  buildDiffFactConstraints(diffFacts) {
    const DiffFactAnalyzer = require('./diff-fact-analyzer');
    return new DiffFactAnalyzer().buildPromptConstraints(diffFacts);
  }
}

module.exports = EfficientPromptBuilder;
