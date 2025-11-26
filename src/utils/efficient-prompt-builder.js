/**
 * Efficient Prompt Builder - Optimized prompt generation with semantic context
 */

class EfficientPromptBuilder {
  constructor(options = {}) {
    this.maxPromptLength = options.maxPromptLength || 8000;
    this.preserveContext = options.preserveContext || true;
  }

  /**
   * Build an optimized prompt for AI commit message generation
   */
  buildPrompt(diff, options = {}) {
    const {
      context,
      conventional,
      count = 3,
      type,
      language = 'en',
      chunkIndex,
      totalChunks,
      chunkContext,
      enhancedPrompt,
      promptInstructions,
      strictValidation
    } = options;

    // Handle null/undefined diff
    if (!diff) {
      diff = '';
    }

    // Analyze diff for change type and impact
    const changeAnalysis = this.analyzeDiffForSpecialization(diff);
    const impactAnalysis = this.analyzeChangeImpact(diff, context);

    // Detect problematic cases (large WordPress files, etc.)
    const isProblematicCase = this.detectProblematicCase(diff, context);
    const isWordPressFile = this.isWordPressFile(diff, context);

    // Build concise, focused prompt
    let prompt = `Generate ${count} precise commit messages for this git diff. OUTPUT ONLY COMMIT MESSAGES - NO INSTRUCTIONS, WARNINGS, OR EXPLANATIONS.`;

    // Add enhanced instructions for problematic cases
    if (enhancedPrompt || isProblematicCase) {
      prompt += this.buildEnhancedInstructions(isProblematicCase, isWordPressFile, promptInstructions);
    }

    // Add relevance-focused instructions
    prompt += `\n\nRELEVANCE REQUIREMENTS:
- Focus on BUSINESS VALUE and USER IMPACT
- Use functional scopes (auth, ui, api, theme) not file names
- Be specific about WHAT changed, not implementation details
- Avoid technical jargon unless necessary
- Consider: "What does this enable for users?"`;
    

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
    }

    // Add most relevant context (prioritized)
    const relevantContext = this.extractRelevantContext(context, changeAnalysis);
    if (relevantContext) {
      prompt += `\n\nContext: ${relevantContext}`;
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

REMEMBER: OUTPUT ONLY COMMIT MESSAGES. NO WARNINGS. NO INSTRUCTIONS. NO DEPLOYMENT ADVICE.

${count} messages, one per line:`;

    // Compress if still too long
    if (prompt.length > this.maxPromptLength) {
      prompt = this.compressPrompt(prompt, diff, count, conventional, isWordPressFile);
    }

    return prompt;
  }

  /**
   * Detect problematic cases that need special handling
   */
  detectProblematicCase(diff, context) {
    if (!diff) return false;

    // Large diff detection
    const isLargeDiff = diff.length > 15000;
    
    // WordPress theme file detection
    const isWordPressTheme = /functions\.php|style\.css|index\.php|header\.php|footer\.php|sidebar\.php|wp-content\/themes/.test(diff);
    
    // Mixed language detection (PHP + HTML + JS)
    const hasMixedLanguages = /<\?php/.test(diff) && /<[^>]+>/.test(diff) && /function|var|let|const/.test(diff);
    
    // Repetitive pattern detection (like banner arrays)
    const hasRepetitivePatterns = /(array|data)\s*=\s*\[.*?\]/s.test(diff) && 
                                 (diff.match(/['"][^'"]*['"]/g) || []).length > 10;

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
      /wordpress|wp_/
    ];

    return wordpressPatterns.some(pattern => pattern.test(diff)) ||
           context?.project?.primary === 'wordpress' ||
           context?.files?.wordpress?.isWordPress;
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
- Focus on the MAIN change, not every detail
- Look for the primary purpose of the changes
- Ignore repetitive HTML/template content
- Focus on functional changes, not formatting`;
      }

      if (isWordPressFile) {
        instructions += `
- This is a WordPress file - focus on functionality changes
- Look for hook/filter/shortcode changes
- Focus on PHP logic, not HTML output
- Identify theme/plugin modifications`;
      }
    }

    return instructions;
  }

  /**
   * Build WordPress-specific guidance
   */
  buildWordPressGuidance(diff, context) {
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
   * Compress prompt while preserving essential information
   */
  compressPrompt(prompt, diff, count, conventional, isWordPressFile = false) {
    // Start with minimal essential requirements
    let compressed = `Generate ${count} concise commit messages for following git diff.

REQUIREMENTS:
 - Be specific about actual changes
 - Use imperative voice ("Add", "Fix", "Remove")
 - Max 72 characters per message
 - No generic terms like "changes", "updates"
 - Output ONLY commit messages, no explanations
 - NEVER output warnings, instructions, or deployment advice`;

    if (isWordPressFile) {
      compressed += `
 - Focus on WordPress functionality changes
 - Look for hook/filter/shortcode modifications
 - NEVER output warnings about WordPress theme files`;
    }

    if (conventional) {
      compressed += `
- Use conventional format: type(scope): description`;
    }

    // Smart diff truncation for WordPress files
    let processedDiff = diff;
    if (diff.length > this.maxPromptLength * 0.6) {
      if (isWordPressFile) {
        processedDiff = this.truncateWordPressDiff(diff);
      } else {
        processedDiff = this.truncateDiff(diff);
      }
    }

    compressed += `
\`\`\`diff
${processedDiff}
\`\`\`

${count} messages, each on its own line:`;

    return compressed;
  }

  /**
   * Truncate WordPress diff intelligently
   */
  truncateWordPressDiff(diff) {
    const lines = diff.split('\n');
    const result = [];
    let inImportantSection = false;
    let skipCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Always keep headers
      if (line.startsWith('diff --git') || 
          line.startsWith('index') || 
          line.startsWith('---') || 
          line.startsWith('+++') || 
          line.startsWith('@@')) {
        result.push(line);
        continue;
      }
      
      // PHP function changes are important
      if (line.startsWith('+') && /function\s+\w+|add_action|add_filter|add_shortcode/.test(line)) {
        inImportantSection = true;
        result.push(line);
        continue;
      }
      
      // Keep some context around important sections
      if (inImportantSection) {
        result.push(line);
        // Reset after a few lines of context
        if (line.startsWith(' ') && skipCount++ > 5) {
          inImportantSection = false;
          skipCount = 0;
        }
        continue;
      }
      
      // Skip repetitive HTML/template content
      if (line.startsWith('+') && /<div|<span|<p|<h[1-6]|class=|id=/.test(line)) {
        // Only keep every 3rd HTML line to reduce noise
        if (Math.random() < 0.3) {
          result.push(line);
        }
        continue;
      }
      
      // Keep other changes but limit total
      if (result.length < 300) {
        result.push(line);
      }
    }
    
    if (result.length < lines.length) {
      result.push(`... (${lines.length - result.length} lines truncated for WordPress theme file) ...`);
    }
    
    return result.join('\n');
  }

  /**
   * Truncate diff intelligently
   */
  truncateDiff(diff) {
    const lines = diff.split('\n');
    const maxLines = 500; // Limit lines to preserve space for instructions
    
    if (lines.length <= maxLines) {
      return diff;
    }
    
    // Keep headers and first/last parts of diff
    const headerLines = [];
    const contentLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('diff --git') || 
          lines[i].startsWith('index') || 
          lines[i].startsWith('---') || 
          lines[i].startsWith('+++') || 
          lines[i].startsWith('@@')) {
        headerLines.push(lines[i]);
      } else {
        contentLines.push(lines[i]);
      }
    }
    
    // Take first and last parts of content to preserve change context
    const firstPart = contentLines.slice(0, Math.floor(maxLines * 0.4));
    const lastPart = contentLines.slice(-Math.floor(maxLines * 0.4));
    
    const result = [
      ...headerLines,
      ...firstPart,
      `... (${contentLines.length - firstPart.length - lastPart.length} lines truncated) ...`,
      ...lastPart
    ];
    
    return result.join('\n');
  }

  /**
   * Build context-aware prompt for chunked processing
   */
  buildChunkPrompt(chunk, options = {}) {
    const basePrompt = this.buildPrompt(chunk.content || chunk, options);
    
    // Add chunk-specific instructions for better focus
    const chunkedPrompt = `CONTEXT FOR CHUNKED PROCESSING:
- Process only the changes in this specific chunk
- Focus on the most significant changes
- Maintain consistency with overall changes if known

${basePrompt}`;
    
    return chunkedPrompt;
  }

  /**
   * Build specialized prompts for different change types
   */
  buildSpecializedPrompt(diff, changeType, options = {}) {
    switch (changeType) {
      case 'test':
        return `Generate test-related commit message for git diff.
Focus on test additions, updates, or improvements.
Examples: "test(auth): add unit tests for login flow", "test(utils): improve test coverage"

${this.buildPrompt(diff, options)}`;
        
      case 'perf':
        return `Generate performance-related commit message for git diff.
Focus on optimization, performance improvements, or efficiency changes.
Examples: "perf(api): optimize query performance", "perf(ui): reduce render time"

${this.buildPrompt(diff, options)}`;
        
      case 'fix':
        return `Generate bug fix commit message for git diff.
Focus on issue resolution, bug fixes, or error corrections.
Examples: "fix(auth): resolve login timeout issue", "fix(api): fix null pointer error"

${this.buildPrompt(diff, options)}`;
        
      case 'feat':
        return `Generate feature addition commit message for git diff.
Focus on new functionality, capabilities, or features.
Examples: "feat(auth): add OAuth2 support", "feat(api): add user profile endpoint"

${this.buildPrompt(diff, options)}`;
        
      case 'refactor':
        return `Generate refactoring commit message for git diff.
Focus on code restructuring, improvements, or reorganization.
Examples: "refactor(utils): extract validation logic", "refactor(auth): improve module structure"

${this.buildPrompt(diff, options)}`;
        
      default:
        return this.buildPrompt(diff, options);
    }
  }

  /**
   * Analyze change impact for better commit messages
   */
  analyzeChangeImpact(diff, context) {
    const impact = {
      breaking: false,
      userFacing: false,
      performance: false,
      security: false,
      dependency: false,
      scope: 'internal'
    };

    // Handle null/undefined diff input
    if (!diff) {
      return impact;
    }

    const lowerDiff = diff.toLowerCase();

    // Breaking changes detection
    impact.breaking = /breaking|deprecat|remove|delete.*function|throw.*error|interface.*change/i.test(lowerDiff);

    // User-facing changes
    impact.userFacing = /ui|component|view|template|style|css|user.*interface|frontend/i.test(lowerDiff) ||
                        (context?.files?.fileTypes?.jsx > 0 || context?.files?.fileTypes?.tsx > 0 ||
                         context?.files?.fileTypes?.vue > 0 || context?.files?.fileTypes?.html > 0);

    // Performance changes
    impact.performance = /performance|optimize|cache|memo|lazy|async|await|promise/i.test(lowerDiff);

    // Security changes
    impact.security = /security|auth|token|password|encrypt|decrypt|hash|validation|sanitize/i.test(lowerDiff);

    // Dependency changes
    impact.dependency = /package\.json|requirements\.txt|composer\.json|yarn\.lock|npm install|"react":|"express":|"lodash":/i.test(lowerDiff);

    // Determine scope
    if (impact.userFacing) impact.scope = 'user-facing';
    else if (impact.security) impact.scope = 'security';
    else if (impact.performance) impact.scope = 'performance';
    else if (impact.breaking) impact.scope = 'breaking';

    return impact;
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
        guidance += 'formatting or linting corrections only';
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
      const semantic = context.files.semantic;
      const keyInfo = [];

      if (semantic.functions?.length > 0) {
        keyInfo.push(`new: ${semantic.functions.slice(0, 2).join(', ')}`);
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
      perf: ['js', 'ts', 'py', 'java'],
      refactor: ['js', 'ts', 'py', 'php', 'java']
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
          examples.push('fix(plugin): handle undefined post ID error');
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
        break;
      case 'refactor':
        examples.push('refactor(utils): extract validation logic');
        break;
      case 'test':
        examples.push('test(auth): add unit tests for login flow');
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
   * Analyze diff content for specialized processing
   */
  analyzeDiffForSpecialization(diff) {
    const analysis = {
      type: 'chore', // default
      confidence: 0.1,
      keywords: []
    };

    // Handle null/undefined/empty diff input
    if (!diff) {
      return analysis;
    }

    // Look for specific patterns that indicate change type
    const patterns = {
      test: {
        keywords: ['test', 'spec', 'describe', 'it', 'expect', 'assert', 'jest', 'mocha'],
        regex: /test|spec|describe|it\(|expect|assert|coverage/i
      },
      perf: {
        keywords: ['perf', 'performance', 'optimize', 'cache', 'memo', 'speed', 'fast'],
        regex: /performance|optimize|cache|lazy|memo|speed|fast|efficien|bottleneck/i
      },
      fix: {
        keywords: ['fix', 'bug', 'error', 'issue', 'problem', 'resolve', 'correct'],
        regex: /fix|bug|error|issue|problem|resolve|correct|patch|resolve/i
      },
      feat: {
        keywords: ['add', 'new', 'implement', 'feature', 'create', 'introduce'],
        regex: /add|new|implement|feature|create|introduce|enhance/i
      },
      refactor: {
        keywords: ['refactor', 'restructure', 'reorganize', 'clean', 'improve', 'move'],
        regex: /refactor|restructure|reorganize|clean|improve|reorganize|restructure/i
      },
      docs: {
        keywords: ['doc', 'readme', 'comment', 'documentation', 'guide'],
        regex: /doc|readme|comment|documentation|guide/i
      },
      style: {
        keywords: ['style', 'format', 'lint', 'prettier', 'beautify'],
        regex: /style|format|lint|prettier|beautify|indent|whitespace/i
      }
    };

    // Count occurrences of pattern keywords in the diff
    const lowerDiff = diff.toLowerCase();
    let maxScore = 0;

    for (const [type, pattern] of Object.entries(patterns)) {
      let score = 0;

      // Score based on regex matches
      const matches = lowerDiff.match(pattern.regex);
      if (matches) {
        score += matches.length * 2;
      }

      // Score based on keyword occurrences
      for (const keyword of pattern.keywords) {
        const keywordMatches = lowerDiff.match(new RegExp(`\\b${keyword}\\b`, 'gi'));
        if (keywordMatches) {
          score += keywordMatches.length;
        }
      }

      if (score > maxScore) {
        maxScore = score;
        analysis.type = type;
        analysis.confidence = Math.min(0.9, score / (score + 2)); // Normalize confidence
        analysis.keywords = pattern.keywords.slice(0, 3);
      }
    }

    return analysis;
  }
}

module.exports = EfficientPromptBuilder;