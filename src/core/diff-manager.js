/**
 * Manages diff processing for AI commit generation
 */

class DiffManager {
  constructor() {}

  /**
   * Intelligently manage diff for optimal AI processing
   */
  manageDiffForAI(diff, options = {}) {
    const diffSize = diff.length;
    const MAX_SAFE_SIZE = 60000; // ~20K tokens, safe for modern Groq (131K context) and Ollama
    const { context } = options;

    if (diffSize <= MAX_SAFE_SIZE) {
      return {
        strategy: 'full',
        data: diff,
        chunks: null,
        info: {
          strategy: 'full',
          size: diffSize,
          chunks: 1,
          reasoning: 'Full diff sent to AI for fast processing',
          pluginUpdate: false
        }
      };
    }

    const smartTruncated = this.smartTruncateDiff(diff, MAX_SAFE_SIZE, context);
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
        skippedFiles: smartTruncated.skippedFiles
      }
    };
  }

  /**
   * Smart truncate diff to preserve most relevant content
   */
  smartTruncateDiff(diff, maxSize, semanticContext) {
    const fileChunks = this.parseDiffIntoFileChunks(diff);

    const IGNORED_PATTERNS = [
      'node_modules/', 'dist/', 'build/', 'vendor/', '.git/',
      '.lock', '.min.js', '.min.css', '.map'
    ];

    const filteredChunks = fileChunks.filter(fc => {
      return !IGNORED_PATTERNS.some(pattern => fc.fileName.includes(pattern));
    });

    const scoredChunks = filteredChunks.map(fc => {
      const score = this.scoreFileChunk(fc, semanticContext);
      return { ...fc, score };
    });

    scoredChunks.sort((a, b) => b.score - a.score);

    let selectedContent = [];
    let preservedFiles = [];
    let skippedFiles = [];
    let currentSize = 0;
    const HEADER_BUDGET = Math.min(2000, maxSize * 0.05);

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
        skippedFiles.push(chunk);
      }

      if (currentSize >= maxSize * 0.9) {
        break;
      }
    }

    let remainingHeaderSpace = Math.max(0, maxSize - currentSize);
    const skippedHeaders = [];
    // Track which files were added from skipped files to preserved files to avoid duplicates
    const additionalPreservedFiles = [];

    for (const chunk of skippedFiles) {
      if (remainingHeaderSpace <= 0) break;
      if (chunk.header.length <= remainingHeaderSpace) {
        skippedHeaders.push(chunk.header);
        remainingHeaderSpace -= chunk.header.length;
        // Only add to preservedFiles if it's not already there to avoid duplicates
        if (!preservedFiles.includes(chunk.fileName)) {
          preservedFiles.push(chunk.fileName);
        }
        additionalPreservedFiles.push(chunk.fileName);
      }
    }

    // Build summary of skipped files for context
    const trulySkipped = skippedFiles
      .filter(f => !additionalPreservedFiles.includes(f.fileName))
      .map(f => f.fileName);

    const skippedFileSummary = this.buildSkippedFileSummary(trulySkipped);

    let reasoning = `Preserved ${preservedFiles.length} files with full content, ${trulySkipped.length} skipped (node_modules ignored)`;
    if (preservedFiles.length === 0 && filteredChunks.length > 0) {
      reasoning = 'No files fit within token limits - diff too large';
    }

    return {
      data: [...selectedContent, ...skippedHeaders, skippedFileSummary].join('\n'),
      reasoning,
      preservedFiles,
      skippedFiles: trulySkipped
    };
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
      other: []
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
      const plugins = new Set(groups.plugin.map(f => {
        const match = f.match(/\/plugins\/([^\/]+)/);
        return match ? match[1] : f;
      }));
      summary.push(`# Plugins: ${Array.from(plugins).join(', ')} (${groups.plugin.length} files)`);
    }

    if (groups.theme.length) {
      const themes = new Set(groups.theme.map(f => {
        const match = f.match(/\/themes\/([^\/]+)/);
        return match ? match[1] : f;
      }));
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
      const vendorTypes = new Set(groups.vendor.map(f => {
        if (f.includes('node_modules')) return 'npm';
        if (f.includes('vendor/composer')) return 'composer';
        return 'vendor';
      }));
      summary.push(`# Dependencies: ${Array.from(vendorTypes).join(', ')} (${groups.vendor.length} files)`);
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
            changeCount: currentFile.changeCount
          });
        }

        const fileMatch = line.match(/diff --git a\/(.+?) b\/(.+)/);
        const fileName = fileMatch ? fileMatch[2] : 'unknown';
        let isNewFile = line.includes('/dev/null') || (i > 0 && lines[i - 1] && lines[i - 1].includes('new file mode'));
        if (!isNewFile && lines[i + 1] && lines[i + 1].includes('new file mode')) {
          isNewFile = true;
        }

        currentFile = {
          header: line,
          fileName,
          isNewFile,
          changeCount: 0
        };
        currentContent = [];
      } else if (currentFile && (line.startsWith('@@ ') || line.startsWith('+') || line.startsWith('-'))) {
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
        changeCount: currentFile.changeCount
      });
    }

    return fileChunks;
  }

  /**
   * Score file chunk based on semantic importance (higher = more important)
   */
  scoreFileChunk(chunk, semanticContext) {
    let score = 0;

    if (chunk.isNewFile) {
      score += 50;
      if (chunk.fileName.includes('package.json') ||
          chunk.fileName.includes('composer.json') ||
          chunk.fileName.includes('requirements.txt')) {
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

    if (chunk.fileName.includes('index.') ||
        chunk.fileName.includes('main.') ||
        chunk.fileName.includes('app.') ||
        chunk.fileName.includes('config.')) {
      score += 25;
    }

    return score;
  }

  /**
   * Chunk large diffs into smaller pieces for AI processing
   */
  chunkDiff(diff, maxTokens = 6000) {
    const lines = diff.split('\n');
    const chunks = [];
    let currentChunk = [];
    let currentTokens = 0;

    // Rough estimation: 1 token ≈ 4 characters
    const estimateTokens = (text) => Math.ceil(text.length / 4);

    // Helper to detect semantic boundaries
    const isSemanticBoundary = (line) => {
      return line.startsWith('diff --git') ||
        line.startsWith('index ') ||
        line.startsWith('---') ||
        line.startsWith('+++') ||
        (line.startsWith('@@') && currentChunk.length > 10) ||
        (/^(function|class|def|const|let|var)\s+\w+/.test(line) && currentChunk.length > 5);
    };

    // Helper to find good break point near token limit
    const findBreakPoint = (startIdx, maxTokens) => {
      let tokenCount = 0;
      let bestBreakIdx = startIdx;

      for (let i = startIdx; i < lines.length; i++) {
        tokenCount += estimateTokens(lines[i]);

        if (tokenCount > maxTokens) {
          break;
        }

        // Prefer breaking at semantic boundaries
        if (isSemanticBoundary(lines[i])) {
          bestBreakIdx = i;
        }
      }

      return bestBreakIdx;
    };

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const lineTokens = estimateTokens(line);

      // If single line is extremely large, split it
      if (lineTokens > maxTokens) {
        // Flush current chunk if it has content
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join('\n'));
          currentChunk = [];
          currentTokens = 0;
        }

        // Split large line into smaller pieces
        const chunksNeeded = Math.ceil(lineTokens / maxTokens);
        const chunkSize = Math.ceil(line.length / chunksNeeded);

        for (let j = 0; j < chunksNeeded; j++) {
          const start = j * chunkSize;
          const end = Math.min(start + chunkSize, line.length);
          chunks.push(line.substring(start, end));
        }
        i++;
        continue;
      }

      // Check if we need to start a new chunk
      if (currentTokens + lineTokens > maxTokens && currentChunk.length > 0) {
        // Find a good break point if possible
        const breakIdx = findBreakPoint(i, maxTokens - currentTokens);

        if (breakIdx > i) {
          // Add lines up to break point
          for (; i <= breakIdx && i < lines.length; i++) {
            currentChunk.push(lines[i]);
            currentTokens += estimateTokens(lines[i]);
          }
        }

        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
        currentTokens = 0;
        continue;
      }

      // Add line to current chunk
      currentChunk.push(line);
      currentTokens += lineTokens;
      i++;
    }

    // Add last chunk if it has content
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks;
  }
}

module.exports = DiffManager;