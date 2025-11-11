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

    // Start with core requirements
    let prompt = `You are an expert software developer. Analyze git diff and generate exactly ${count} precise, relevant commit messages.

REQUIREMENTS:
- Be SPECIFIC about what actually changed (use exact function/class names)
- Focus on PRIMARY purpose of these changes
- Use active, imperative voice ("Add X" not "Added X")
- Maximum 72 characters for title, but be descriptive
- NO generic terms like "functionality", "features", "updates", "various"
- Each message must be UNIQUE and highlight different aspects`;

    // Add chunking context if applicable
    if (totalChunks && totalChunks > 1) {
      prompt += `\n\nCHUNKING CONTEXT:
- This is chunk ${chunkIndex + 1} of ${totalChunks} (${chunkContext} position)
- Focus only on changes in this specific chunk`;

      if (options.context?.chunkInfo) {
        const chunkInfo = options.context.chunkInfo;
        if (chunkInfo.files?.length > 0) {
          prompt += `\n- Files in this chunk: ${chunkInfo.files.slice(0, 5).join(', ')}`;
        }
        if (chunkInfo.functions?.length > 0) {
          prompt += `\n- Key functions: ${chunkInfo.functions.slice(0, 3).join(', ')}`;
        }
        if (chunkInfo.classes?.length > 0) {
          prompt += `\n- Key classes: ${chunkInfo.classes.slice(0, 3).join(', ')}`;
        }
      }
    }

    // Add conventional commit format if requested
    if (conventional) {
      prompt += `\n\nCONVENTIONAL COMMIT FORMAT:
- Use format: type(scope): description
- Types: feat (new feature), fix (bug fix), docs (documentation), style (formatting), 
  refactor (code restructuring), perf (performance), test (testing), chore (maintenance),
  ci (CI/CD), build (build system)
- Scope should be specific: api, ui, auth, db, config, utils, test, etc.
- Description should be concise and in lowercase`;
    }

    // Add repository context if available
    if (context) {
      prompt += `\n\nREPOSITORY CONTEXT:`;
      
      if (context.patterns) {
        const commonTypes = context.patterns.mostUsedTypes?.slice(0, 3).map(([type]) => type).join(', ') || 'none detected';
        const commonScopes = context.patterns.mostUsedScopes?.slice(0, 3).map(([scope]) => scope).join(', ') || 'none detected';
        
        prompt += `\n- Preferred format: ${context.patterns.preferredFormat || 'freeform'}
- Common types: ${commonTypes}
- Common scopes: ${commonScopes}`;
      }

      if (context.files) {
        const fileTypes = context.files.fileTypes || {};
        const changedTypes = Object.entries(fileTypes)
          .filter(([_, count]) => count > 0)
          .map(([type, count]) => `${type}(${count})`)
          .join(', ') || 'none';
        
        prompt += `\n- File types changed: ${changedTypes}
- Inferred scope: ${context.files.scope || 'general'}
- Changes: +${context.files.changes?.insertions || 0} -${context.files.changes?.deletions || 0}`;
      }

      // Add semantic context with better filtering
      if (context.files?.semantic) {
        const semantic = context.files.semantic;
        const semanticInfo = [];

        if (semantic.functions?.length > 0) {
          semanticInfo.push(`functions: ${semantic.functions.slice(0, 5).join(', ')}`);
        }
        if (semantic.classes?.length > 0) {
          semanticInfo.push(`classes: ${semantic.classes.slice(0, 5).join(', ')}`);
        }
        if (semantic.components?.length > 0) {
          semanticInfo.push(`components: ${semantic.components.slice(0, 5).join(', ')}`);
        }
        if (semantic.wordpress_hooks?.length > 0) {
          semanticInfo.push(`WordPress hooks: ${semantic.wordpress_hooks.slice(0, 3).join(', ')}`);
        }

        if (semanticInfo.length > 0) {
          prompt += `\n- Semantic context: ${semanticInfo.join('; ')}`;
        }
      }

      if (context.project) {
        prompt += `\n- Project type: ${context.project.primary || 'unknown'}`;
      }
    }

    // Add diff analysis insights
    if (context?.analysis) {
      const analysis = context.analysis;
      prompt += `\n\nDIFF ANALYSIS:`;

      if (analysis.keyChanges?.length > 0) {
        prompt += `\n- Key changes: ${analysis.keyChanges.slice(0, 5).join(', ')}`;
      }
      if (analysis.likelyPurpose) {
        prompt += `\n- Purpose: ${analysis.likelyPurpose}`;
      }
      if (analysis.affectedAreas?.length > 0) {
        prompt += `\n- Affected areas: ${analysis.affectedAreas.slice(0, 5).join(', ')}`;
      }
    }

    prompt += `\n\nGIT DIFF:
\`\`\`diff
${diff}
\`\`\`

EXAMPLES OF GOOD MESSAGES:
- "feat(auth): add JWT token validation middleware"
- "fix(database): resolve null pointer in User.findById"
- "refactor(utils): extract password hashing into separate function"

Generate ${count} commit messages that accurately reflect the specific changes and their purpose. Each message should be on a separate line with no numbering or bullets:`;

    // If prompt is too long, try to compress it while preserving essential information
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
   * Analyze diff content for specialized processing
   */
  analyzeDiffForSpecialization(diff) {
    const analysis = {
      type: 'chore', // default
      confidence: 0.1,
      keywords: []
    };

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