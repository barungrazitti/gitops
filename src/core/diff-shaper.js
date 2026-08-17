const chalk = require('chalk');

/**
 * A deep module for intelligently shaping and truncating diffs for AI processing.
 * Consolidates diff filtering, chunking, scoring, summarizing, change-type
 * classification, and context-line limiting. DiffShaper owns the diff budget
 * (AGENTS.md) — no other module truncates or classifies the diff.
 */
class DiffShaper {
  /**
   * Filter out binary/media files from a diff.
   */
  filterBinaryFiles(diff) {
    if (!diff) return '';

    const BINARY_EXTENSIONS = [
      'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'woff', 'woff2', 'ttf', 'eot', 'mp4',
      'mp3', 'pdf', 'zip', 'tar', 'gz', 'log', 'lock' // Add common lock/log files
    ];

    const lines = diff.split('\n');
    const filteredLines = [];
    let skipUntilNextDiff = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('diff --git')) {
        skipUntilNextDiff = false; // Reset for new file
        const fileMatch = line.match(/diff --git a\/(.+?) b\/(.+)/);
        if (fileMatch) {
          const filePath = fileMatch[2];
          const ext = filePath.split('.').pop().toLowerCase();

          // Check for binary files by extension or explicit marker
          if (BINARY_EXTENSIONS.includes(ext) || lines[i + 1]?.startsWith('Binary files')) {
            console.log(chalk.gray(`🗑️  Skipping binary/asset file: ${filePath}`));
            skipUntilNextDiff = true;
            continue; // Skip the diff --git line itself
          }
        }
      }

      if (skipUntilNextDiff) {
        continue; // Skip all lines for the current binary file
      }

      filteredLines.push(line);
    }

    return filteredLines.join('\n');
  }

  /**
   * Intelligent diff management for optimal AI generation.
   * Smart truncation that preserves file headers and prioritizes significant changes.
   * @param {string} diff - The full git diff content.
   * @param {object} options - Options object, including context for semantic analysis.
   * @returns {object} - Shaped diff data and info about the strategy used.
   */
  manageDiffForAI(diff, options = {}) {
    // Filter out binary/media files first
    const filteredDiff = this.filterBinaryFiles(diff);
    const diffSize = filteredDiff.length;
    const MAX_SAFE_SIZE = 18000; // ~4.5K tokens, safe for Groq free-tier TPM (6K) with system prompt overhead
    const { context } = options;

    if (diffSize <= MAX_SAFE_SIZE) {
      return {
        strategy: 'full',
        data: filteredDiff,
        chunks: null,
        info: {
          strategy: 'full',
          size: diffSize,
          chunks: 1,
          reasoning: 'Full diff sent to AI for fast processing',
          pluginUpdate: false,
        },
      };
    }

    console.log(
      chalk.yellow(
        `⚠️  Very large diff (${Math.round(diffSize / 1024)}KB), applying smart truncation`
      )
    );

    const smartTruncated = this.smartTruncateDiff(filteredDiff, MAX_SAFE_SIZE, context);
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
        skippedFiles: smartTruncated.skippedFiles,
      },
    };
  }

  /**
   * Smart truncate diff to preserve most relevant content
   */
  smartTruncateDiff(diff, maxSize, semanticContext) {
    const fileChunks = this.parseDiffIntoFileChunks(diff);

    const IGNORED_PATTERNS = [
      'node_modules/',
      'dist/',
      'build/',
      'vendor/',
      '.git/',
      '.lock',
      '.min.js',
      '.min.css',
      '.map',
    ];

    const filteredChunks = fileChunks.filter(
      fc => !IGNORED_PATTERNS.some(pattern => fc.fileName.includes(pattern))
    );

    const scoredChunks = filteredChunks.map(fc => {
      const score = this.scoreFileChunk(fc, semanticContext);
      return { ...fc, score };
    });

    scoredChunks.sort((a, b) => b.score - a.score);

    const selectedContent = [];
    const preservedFiles = [];
    const truncatedFiles = [];
    const skippedFiles = [];
    let currentSize = 0;

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
        const remainingSize = Math.max(0, maxSize - currentSize);
        const excerpt = this.buildOversizedChunkExcerpt(chunk, remainingSize);

        if (excerpt) {
          selectedContent.push(excerpt);
          currentSize += excerpt.length;
          preservedFiles.push(chunk.fileName);
          truncatedFiles.push(chunk.fileName);
        } else {
          skippedFiles.push(chunk);
        }
      }

      if (currentSize >= maxSize * 0.9) {
        break;
      }
    }

    let remainingHeaderSpace = Math.max(0, maxSize - currentSize);
    const skippedHeaders = [];

    for (const chunk of skippedFiles) {
      if (remainingHeaderSpace <= 0) break;
      if (chunk.header.length <= remainingHeaderSpace) {
        skippedHeaders.push(chunk.header);
        remainingHeaderSpace -= chunk.header.length;
      }
    }

    // Build summary of skipped files for context
    const trulySkipped = skippedFiles.map(f => f.fileName);

    const skippedFileSummary = this.buildSkippedFileSummary(trulySkipped);

    let reasoning = `Preserved ${preservedFiles.length} files, ${truncatedFiles.length} truncated, ${trulySkipped.length} skipped (node_modules ignored)`;
    if (preservedFiles.length === 0 && filteredChunks.length > 0) {
      reasoning = 'No files fit within token limits - diff too large';
    }

    return {
      data: [...selectedContent, ...skippedHeaders, skippedFileSummary].join('\n'),
      reasoning,
      preservedFiles,
      skippedFiles: trulySkipped,
    };
  }

  /**
   * Build a compact excerpt for a single file that is larger than the prompt budget.
   */
  buildOversizedChunkExcerpt(chunk, maxSize) {
    const marker = `# NOTE: ${chunk.fileName} was too large; showing changed lines only`;
    const minBudget = chunk.header.length + marker.length + 300;

    if (maxSize < minBudget || !chunk.content.trim()) {
      return null;
    }

    const result = [chunk.header, marker];
    let currentSize = result.join('\n').length;
    let keptChanges = 0;

    for (const line of chunk.content.split('\n')) {
      const isActualChange =
        (line.startsWith('+') && !line.startsWith('+++')) ||
        (line.startsWith('-') && !line.startsWith('---'));
      const isDiffContext = line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++');

      if (!isActualChange && !isDiffContext) {
        continue;
      }

      const nextSize = currentSize + line.length + 1;
      if (nextSize > maxSize) {
        break;
      }

      result.push(line);
      currentSize = nextSize;
      if (isActualChange) {
        keptChanges++;
      }
    }

    if (keptChanges === 0) {
      return null;
    }

    return result.join('\n');
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
      other: [],
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
      const plugins = new Set(
        groups.plugin.map(f => {
          const match = f.match(/\/plugins\/([^\/]+)/);
          return match ? match[1] : f;
        })
      );
      summary.push(`# Plugins: ${Array.from(plugins).join(', ')} (${groups.plugin.length} files)`);
    }

    if (groups.theme.length) {
      const themes = new Set(
        groups.theme.map(f => {
          const match = f.match(/\/themes\/([^\/]+)/);
          return match ? match[1] : f;
        })
      );
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
      const vendorTypes = new Set(
        groups.vendor.map(f => {
          if (f.includes('node_modules')) return 'npm';
          if (f.includes('vendor/composer')) return 'composer';
          return 'vendor';
        })
      );
      summary.push(
        `# Dependencies: ${Array.from(vendorTypes).join(', ')} (${groups.vendor.length} files)`
      );
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
            changeCount: currentFile.changeCount,
          });
        }

        const fileMatch = line.match(/diff --git a\/(.+?) b\/(.+)/);
        const fileName = fileMatch ? fileMatch[2] : 'unknown';
        let isNewFile =
          line.includes('/dev/null') ||
          (i > 0 && lines[i - 1] && lines[i - 1].includes('new file mode'));
        if (!isNewFile && lines[i + 1] && lines[i + 1].includes('new file mode')) {
          isNewFile = true;
        }

        currentFile = {
          header: line,
          fileName,
          isNewFile,
          changeCount: 0,
        };
        currentContent = [];
      } else if (
        currentFile &&
        (line.startsWith('@@ ') || line.startsWith('+') || line.startsWith('-'))
      ) {
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
        changeCount: currentFile.changeCount,
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
      if (
        chunk.fileName.includes('package.json') ||
        chunk.fileName.includes('composer.json') ||
        chunk.fileName.includes('requirements.txt')
      ) {
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

    if (
      chunk.fileName.includes('index.') ||
      chunk.fileName.includes('main.') ||
      chunk.fileName.includes('app.') ||
      chunk.fileName.includes('config.')
    ) {
      score += 25;
    }

    return score;
  }

  /**
   * Analyze diff change type and impact.
   * Consolidates the former EfficientPromptBuilder.analyzeDiffForSpecialization()
   * and analyzeChangeImpact(). DiffShaper is the single owner of diff classification.
   * Returns { type, confidence, keywords, breaking, userFacing, performance,
   *           security, dependency, scope }.
   */
  analyzeDiffType(diff, context) {
    const analysis = {
      type: 'chore', // default
      confidence: 0.1,
      keywords: [],
      breaking: false,
      userFacing: false,
      performance: false,
      security: false,
      dependency: false,
      scope: 'internal',
    };

    // Handle null/undefined/empty diff input
    if (!diff || typeof diff !== 'string') {
      return analysis;
    }

    const actualChangeText = this.extractActualChangeText(diff);
    const lowerDiff = diff.toLowerCase();

    // --- Impact analysis (uses the full diff for context) ---
    analysis.breaking =
      /breaking|deprecat|remove|delete.*function|throw.*error|interface.*change/i.test(lowerDiff);

    analysis.userFacing =
      /ui|component|view|template|style|css|user.*interface|frontend/i.test(lowerDiff) ||
      context?.files?.fileTypes?.jsx > 0 ||
      context?.files?.fileTypes?.tsx > 0 ||
      context?.files?.fileTypes?.vue > 0 ||
      context?.files?.fileTypes?.html > 0;

    analysis.performance = /performance|optimize|cache|memo|lazy|async|await|promise/i.test(lowerDiff);
    analysis.security = /security|auth|token|password|encrypt|decrypt|hash|validation|sanitize/i.test(lowerDiff);
    analysis.dependency =
      /package\.json|requirements\.txt|composer\.json|yarn\.lock|npm install|"react":|"express":|"lodash":/i.test(lowerDiff);

    if (analysis.userFacing) analysis.scope = 'user-facing';
    else if (analysis.security) analysis.scope = 'security';
    else if (analysis.performance) analysis.scope = 'performance';
    else if (analysis.breaking) analysis.scope = 'breaking';

    // --- Change-type classification (uses actual changed lines only) ---

    // Detect binary files: file headers present but no +/- changes
    const hasFileHeaders = /^diff --git/m.test(diff);
    const hasChanges = actualChangeText.trim().length > 0;
    if (hasFileHeaders && !hasChanges) {
      const isNew =
        /new file mode|mode:/m.test(diff) && !/deleted file mode|mode: 000000/m.test(diff);
      const isDeleted = /deleted file mode|mode: 000000/m.test(diff);
      analysis.type = 'binary';
      analysis.confidence = 0.9;
      analysis.keywords = ['binary', isNew ? 'added' : isDeleted ? 'removed' : 'changed'];
      return analysis;
    }

    const filePaths = this.extractChangedFilePaths(diff);
    const fileTypeFallback = this.inferTypeFromChangedFiles(filePaths, actualChangeText);

    // Weighted pattern scoring over the actual changed lines only.
    const patterns = {
      perf: {
        keywords: ['cache', 'cached', 'transient', 'performance', 'optimize', 'memo', 'speed'],
        regex:
          /\b(perf|performance|optimi[sz]e|cache|cached|memo|speed|lazy|efficient|bottleneck|transient)\b|wp_cache_get_last_changed|get_transient|set_transient/gi,
      },
      test: {
        keywords: ['test', 'spec', 'describe', 'expect', 'assert', 'jest', 'mocha'],
        regex:
          /\b(tests?|testing|tested|spec|coverage|jest|mocha|cypress|mock|fixture)\b|describe\s*\(|\bit\s*\(|expect\s*\(|assert\s*\(/gi,
      },
      fix: {
        keywords: ['fix', 'bug', 'error', 'issue', 'problem', 'resolve', 'correct', 'security'],
        regex:
          /\b(fix|bug|error|issue|problem|resolve|correct|patch|prevent|guard|sanitize|validate|escape|hash_equals|csrf|xss|token)\b/gi,
      },
      feat: {
        keywords: ['add', 'new', 'implement', 'feature', 'create', 'introduce'],
        regex:
          /\b(add|new|implement|feature|create|introduce|enable|support)\b|^\+\s*(public|private|protected)?\s*function\s+\w+/gim,
      },
      refactor: {
        keywords: ['refactor', 'restructure', 'reorganize', 'clean', 'improve', 'move'],
        regex: /\b(refactor|restructure|reorganize|cleanup|clean|move|extract)\b/gi,
      },
      docs: {
        keywords: ['doc', 'readme', 'comment', 'documentation', 'guide'],
        regex: /\b(docs?|readme|comment|documentation|guide)\b/gi,
      },
      style: {
        keywords: ['style', 'format', 'lint', 'prettier', 'beautify'],
        regex:
          /\b(style|format|lint|prettier|beautify|indent|whitespace|css|margin|padding|color|background|font|width|height|display|flex|grid)\b/gi,
      },
      build: {
        keywords: ['dependency', 'package', 'version', 'build', 'lockfile'],
        regex:
          /\b(dependencies|devdependencies|package|version|build|lockfile|composer|npm|yarn|pnpm)\b/gi,
      },
    };

    const lowerChangeText = actualChangeText.toLowerCase();
    let maxScore = 0;

    for (const [type, pattern] of Object.entries(patterns)) {
      let score = 0;

      const matches = lowerChangeText.match(pattern.regex);
      if (matches) {
        score += matches.length * (type === 'perf' ? 4 : 2);
      }

      for (const keyword of pattern.keywords) {
        const keywordMatches = lowerChangeText.match(new RegExp(`\\b${keyword}\\b`, 'gi'));
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

    if (fileTypeFallback && (maxScore === 0 || this.shouldPreferFileTypeFallback(fileTypeFallback, analysis))) {
      analysis.type = fileTypeFallback;
      analysis.confidence = Math.max(analysis.confidence, 0.75);
      analysis.keywords = [fileTypeFallback];
    }

    return analysis;
  }

  /**
   * Limit surrounding context lines for small diffs (DiffShaper owns this, per AGENTS.md).
   * Replaces EfficientPromptBuilder.limitContextLines().
   */
  limitContextLines(diff, maxLines = 3) {
    if (!diff || typeof diff !== 'string') {
      return diff;
    }

    const lines = diff.split('\n');
    const result = [];
    let inContextBlock = false;
    let contextCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Always keep headers
      if (
        line.startsWith('diff --git') ||
        line.startsWith('index') ||
        line.startsWith('---') ||
        line.startsWith('+++') ||
        line.startsWith('@@')
      ) {
        result.push(line);
        contextCount = 0;
        inContextBlock = false;
        continue;
      }

      // Keep added/removed lines
      if (line.startsWith('+') || line.startsWith('-')) {
        result.push(line);
        contextCount = 0;
        inContextBlock = true;
        continue;
      }

      // Keep context lines within limit
      if (inContextBlock && contextCount < maxLines) {
        result.push(line);
        contextCount++;
      } else if (!inContextBlock) {
        // Keep context before first change
        result.push(line);
      }
      // Skip extra context lines beyond maxLines
    }

    return result.join('\n');
  }

  /**
   * Extract only real added/removed diff lines for change classification.
   */
  extractActualChangeText(diff) {
    if (!diff || typeof diff !== 'string') {
      return '';
    }

    return diff
      .split('\n')
      .filter(line => {
        return (
          (line.startsWith('+') && !line.startsWith('+++')) ||
          (line.startsWith('-') && !line.startsWith('---'))
        );
      })
      .join('\n');
  }

  /**
   * Keep path-derived type hints only when they support the diff-derived type.
   */
  getCompatibleTypeHint(typeHint, changeAnalysis) {
    if (!typeHint || !changeAnalysis?.type || changeAnalysis.type === 'chore') {
      return null;
    }

    return typeHint === changeAnalysis.type ? typeHint : null;
  }

  /**
   * Extract changed file paths from diff headers.
   */
  extractChangedFilePaths(diff) {
    if (!diff || typeof diff !== 'string') {
      return [];
    }

    return diff
      .split('\n')
      .map(line => line.match(/^diff --git a\/(.+?) b\/(.+)$/))
      .filter(Boolean)
      .map(match => match[2]);
  }

  /**
   * Infer a conservative type from changed file paths when content is neutral.
   */
  inferTypeFromChangedFiles(filePaths, actualChangeText = '') {
    if (!filePaths.length) {
      return null;
    }

    const normalized = filePaths.map(file => file.toLowerCase());

    if (normalized.every(file => this.isTestFile(file))) {
      return 'test';
    }

    if (normalized.every(file => this.isDocsFile(file))) {
      return 'docs';
    }

    if (normalized.every(file => this.isStyleFile(file))) {
      return 'style';
    }

    if (normalized.every(file => this.isDependencyFile(file))) {
      return 'build';
    }

    if (normalized.every(file => this.isConfigFile(file))) {
      return 'chore';
    }

    if (normalized.every(file => this.isMarkupFile(file)) && /[<>]|class=|id=|aria-|data-/.test(actualChangeText)) {
      return 'feat';
    }

    return null;
  }

  shouldPreferFileTypeFallback(fileTypeFallback, analysis) {
    const fileSpecificTypes = new Set(['test', 'docs', 'style', 'build']);
    return fileSpecificTypes.has(fileTypeFallback) && analysis.confidence < 0.75;
  }

  isTestFile(file) {
    return /(^|\/)(__tests__|tests?|specs?|mocks?|fixtures?)\//.test(file) || /\.(test|spec)\./.test(file);
  }

  isDocsFile(file) {
    return /(^|\/)(readme|changelog|license|contributing)(\.|$)/.test(file) || /\.(md|txt|rst|adoc)$/.test(file) || /(^|\/)docs?\//.test(file);
  }

  isStyleFile(file) {
    return /\.(css|scss|sass|less|styl)$/.test(file) || /(^|\/)styles?\//.test(file);
  }

  isDependencyFile(file) {
    return /(^|\/)(package-lock\.json|package\.json|yarn\.lock|pnpm-lock\.yaml|composer\.json|composer\.lock|requirements\.txt|poetry\.lock|pom\.xml|build\.gradle)$/.test(file);
  }

  isConfigFile(file) {
    return /(^|\/)(dockerfile|makefile|tsconfig.*\.json|webpack\.config\.\w+|vite\.config\.\w+|rollup\.config\.\w+|\.env|\.gitignore|\.editorconfig)$/.test(file) || /\.(json|ya?ml|toml|ini|conf|config)$/.test(file);
  }

  isMarkupFile(file) {
    return /\.(html|htm|vue|svelte|hbs|ejs|twig|blade\.php)$/.test(file) || /\/templates?\//.test(file);
  }
}

module.exports = DiffShaper;
