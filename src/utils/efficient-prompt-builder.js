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
      chunkContext
    } = options;

    // Handle null/undefined diff
    if (!diff) {
      diff = '';
    }

    // Analyze diff for change type and impact
    const changeAnalysis = this.analyzeDiffForSpecialization(diff);
    const impactAnalysis = this.analyzeChangeImpact(diff, context);

    // Build concise, focused prompt
    let prompt = `Generate ${count} precise commit messages for this git diff.`;

    // Add change-specific guidance
    prompt += this.buildChangeSpecificGuidance(changeAnalysis, impactAnalysis);

    // Add conventional commit format if requested
    if (conventional) {
      prompt += `\n\nFormat: type(scope): description
Types: feat, fix, docs, style, refactor, perf, test, chore, ci, build
Scope: be specific (api, ui, auth, db, config, utils, test)`;
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

    prompt += `\n\n\`\`\`diff
${diff}
\`\`\`

${count} messages, one per line:`;

    // Compress if still too long
    if (prompt.length > this.maxPromptLength) {
      prompt = this.compressPrompt(prompt, diff, count, conventional);
    }

    return prompt;
  }

  /**
   * Compress prompt while preserving essential information
   */
  compressPrompt(prompt, diff, count, conventional) {
    // Start with minimal essential requirements
    let compressed = `Generate ${count} concise commit messages for the following git diff.

REQUIREMENTS:
- Be specific about actual changes
- Use imperative voice ("Add", "Fix", "Remove")
- Max 72 characters per message
- No generic terms like "changes", "updates"`;

    if (conventional) {
      compressed += `
- Use conventional format: type(scope): description`;
    }

    compressed += `
\`\`\`diff
${diff.length > this.maxPromptLength * 0.6 ? this.truncateDiff(diff) : diff}
\`\`\`

${count} messages, each on its own line:`;

    return compressed;
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