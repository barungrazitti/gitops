/**
 * Optimized Diff Processor - Efficiently processes git diffs with performance optimizations
 */

class OptimizedDiffProcessor {
  constructor() {
    // Configuration for optimization
    this.config = {
      maxTokensPerChunk: 6000,
      minChunkSize: 1000, // Minimum size before considering chunking
      tokenEstimateFactor: 4, // Characters per token estimation
      preserveContextLines: 5, // Lines of context to preserve around changes
    };
  }

  /**
   * Estimate token count for a string
   */
  estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / this.config.tokenEstimateFactor);
  }

  /**
   * Process diff with optimized chunking algorithm
   */
  processDiff(diff, options = {}) {
    const { maxChunkSize = this.config.maxTokensPerChunk, preserveContext = true } = options;
    
    if (!diff || diff.length < this.config.minChunkSize) {
      // For small diffs, return as-is with basic sanitization
      return [{
        content: diff,
        size: diff ? diff.length : 0,
        estimatedTokens: diff ? this.estimateTokens(diff) : 0,
        isSingleChunk: true
      }];
    }

    // Use streaming approach for large diffs to minimize memory usage
    return this.chunkDiffStream(diff, maxChunkSize, preserveContext);
  }

  /**
   * Streaming chunking algorithm to minimize memory usage
   */
  chunkDiffStream(diff, maxChunkSize, preserveContext = true) {
    const lines = diff.split('\n');
    const chunks = [];
    const currentChunk = [];
    
    // Define semantic boundaries that should not be split
    const isSemanticBoundary = (line) => line.startsWith('diff --git') ||
             line.startsWith('index ') ||
             line.startsWith('--- ') ||
             line.startsWith('+++ ') ||
             (line.startsWith('@@ ') && currentChunk.length > 10) || // Hunks
             this.isFunctionDeclaration(line) ||
             this.isClassDeclaration(line) ||
             this.isImportStatement(line);

    // Look ahead to find good chunk boundaries
    const findNextBoundary = (startIndex, maxSize) => {
      let size = 0;
      for (let i = startIndex; i < lines.length; i++) {
        const lineSize = lines[i].length + 1; // +1 for newline
        
        if (size + lineSize > maxSize && i > startIndex) {
          // Try to find the nearest semantic boundary before exceeding size
          for (let j = i; j > startIndex; j--) {
            if (isSemanticBoundary(lines[j])) {
              return j;
            }
          }
          // If no semantic boundary found, return current position
          return i;
        }
        
        size += lineSize;
      }
      return lines.length; // End of diff
    };

    let i = 0;
    while (i < lines.length) {
      const boundary = findNextBoundary(i, maxChunkSize);
      
      // Extract chunk
      const chunkLines = lines.slice(i, boundary);
      const chunkContent = chunkLines.join('\n');
      
      // Add context if preserving context and not at the end
      if (preserveContext && boundary < lines.length) {
        // Add context lines from the next section
        const contextEnd = Math.min(boundary + this.config.preserveContextLines, lines.length);
        const contextLines = lines.slice(boundary, contextEnd);
        const contextContent = contextLines.join('\n');
        
        chunks.push({
          content: `${chunkContent  }\n${  contextContent}`,
          size: chunkContent.length + contextContent.length,
          estimatedTokens: this.estimateTokens(chunkContent + contextContent),
          startIndex: i,
          endIndex: contextEnd,
          hasContext: true
        });
      } else {
        chunks.push({
          content: chunkContent,
          size: chunkContent.length,
          estimatedTokens: this.estimateTokens(chunkContent),
          startIndex: i,
          endIndex: boundary,
          hasContext: false
        });
      }
      
      i = boundary;
    }

    return chunks;
  }

  /**
   * Identify function declarations to preserve semantic boundaries
   */
  isFunctionDeclaration(line) {
    return /^\s*(async\s+)?(function|const|let|var)\s+\w+\s*(=|\()/.test(line) ||
           /^\s*\w+\s*:\s*(async\s+)?(function|\s*=>)/.test(line) ||
           /^\s*def\s+\w+\s*\(/.test(line) ||
           /^\s*public\s+\w+|private\s+\w+|protected\s+\w+/.test(line);
  }

  /**
   * Identify class declarations to preserve semantic boundaries
   */
  isClassDeclaration(line) {
    return /^\s*(export\s+)?class\s+\w+/.test(line) ||
           /^\s*interface\s+\w+/.test(line) ||
           /^\s*type\s+\w+/.test(line);
  }

  /**
   * Identify import statements to preserve semantic boundaries
   */
  isImportStatement(line) {
    return /^\s*(import|export|require)/.test(line);
  }

  /**
   * Analyze diff to determine optimal processing strategy
   */
  analyzeDiff(diff) {
    const stats = {
      totalSize: diff.length,
      lineCount: diff.split('\n').length,
      fileCount: (diff.match(/diff --git/g) || []).length,
      addedLines: (diff.match(/^\+/gm) || []).length,
      removedLines: (diff.match(/^-/gm) || []).length,
      modifiedFiles: [],
      hasLargeFiles: false
    };

    // Extract file information
    const fileMatches = diff.match(/diff --git a\/(.+?) b\/(.+)/g) || [];
    for (const match of fileMatches) {
      const fileMatch = match.match(/diff --git a\/(.+?) b\/(.+)/);
      if (fileMatch) {
        const filePath = fileMatch[2];
        stats.modifiedFiles.push(filePath);
        
        // Check if file is large
        const fileContent = this.extractFileContent(diff, filePath);
        if (fileContent && fileContent.length > 50000) { // 50KB
          stats.hasLargeFiles = true;
        }
      }
    }

    // Determine processing strategy based on diff characteristics
    stats.processingStrategy = this.determineProcessingStrategy(stats);

    return stats;
  }

  /**
   * Extract content for a specific file from the diff
   */
  extractFileContent(diff, filePath) {
    const regex = new RegExp(`diff --git a\/.*? b\/${this.escapeRegExp(filePath)}\\n([\\s\\S]*?)(?=\\ndiff --git|$)`, 'g');
    const matches = diff.match(regex);
    return matches ? matches[0] : null;
  }

  /**
   * Escape special regex characters
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Determine optimal processing strategy based on diff analysis
   */
  determineProcessingStrategy(stats) {
    if (stats.totalSize < 5000) {
      return 'single-chunk'; // Small diff, process as one chunk
    } if (stats.fileCount === 1 && !stats.hasLargeFiles) {
      return 'adaptive-chunking'; // Single file, adaptive chunking
    } if (stats.hasLargeFiles) {
      return 'aggressive-chunking'; // Has large files, aggressive chunking
    } 
      return 'balanced-chunking'; // Balanced approach
    
  }

  /**
   * Process diff with strategy-based optimization
   */
  processDiffWithStrategy(diff) {
    const analysis = this.analyzeDiff(diff);
    
    switch (analysis.processingStrategy) {
      case 'single-chunk':
        return this.processAsSingleChunk(diff);
      case 'adaptive-chunking':
        return this.processWithAdaptiveChunking(diff, analysis);
      case 'aggressive-chunking':
        return this.processWithAggressiveChunking(diff, analysis);
      case 'balanced-chunking':
      default:
        return this.processWithBalancedChunking(diff, analysis);
    }
  }

  /**
   * Process as single chunk (for small diffs)
   */
  processAsSingleChunk(diff) {
    return [{
      content: diff,
      size: diff.length,
      estimatedTokens: this.estimateTokens(diff),
      strategy: 'single-chunk',
      fileBoundaries: this.getFileBoundaries(diff)
    }];
  }

  /**
   * Process with adaptive chunking (for single large file)
   */
  processWithAdaptiveChunking(diff, _analysis) {
    // For single file changes, chunk by logical sections (functions, classes, etc.)
    const chunks = [];
    const lines = diff.split('\n');
    let currentChunk = [];
    let currentSize = 0;
    const maxChunkSize = Math.min(this.config.maxTokensPerChunk * 2, 15000); // Larger chunks for single file

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSize = line.length + 1;

      if (currentSize + lineSize > maxChunkSize && currentChunk.length > 0 && this.isLogicalBoundary(line)) {
        // Create chunk at logical boundary
        chunks.push({
          content: currentChunk.join('\n'),
          size: currentChunk.reduce((sum, l) => sum + l.length + 1, 0),
          estimatedTokens: this.estimateTokens(currentChunk.join('\n')),
          strategy: 'adaptive-chunking',
          logicalBoundary: true
        });

        currentChunk = [line];
        currentSize = lineSize;
      } else {
        currentChunk.push(line);
        currentSize += lineSize;
      }
    }

    // Add final chunk
    if (currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join('\n'),
        size: currentChunk.reduce((sum, l) => sum + l.length + 1, 0),
        estimatedTokens: this.estimateTokens(currentChunk.join('\n')),
        strategy: 'adaptive-chunking',
        logicalBoundary: true
      });
    }

    return chunks;
  }

  /**
   * Check if line is at a logical boundary
   */
  isLogicalBoundary(line) {
    return this.isFunctionDeclaration(line) ||
           this.isClassDeclaration(line) ||
           line.startsWith('diff --git') ||
           line.startsWith('@@ '); // Hunks
  }

  /**
   * Process with aggressive chunking (for large files)
   */
  processWithAggressiveChunking(diff, _analysis) {
    // Use smaller chunks and more aggressive splitting
    return this.chunkDiffStream(diff, this.config.maxTokensPerChunk / 2, true);
  }

  /**
   * Process with balanced chunking (default approach)
   */
  processWithBalancedChunking(diff, _analysis) {
    // Standard chunking with moderate settings
    return this.chunkDiffStream(diff, this.config.maxTokensPerChunk, true);
  }

  /**
   * Get file boundaries in the diff
   */
  getFileBoundaries(diff) {
    const boundaries = [];
    const regex = /diff --git a\/(.+?) b\/(.+?)\n/g;
    let match;

    while ((match = regex.exec(diff)) !== null) {
      boundaries.push({
        index: match.index,
        fileA: match[1],
        fileB: match[2]
      });
    }

    return boundaries;
  }

  /**
   * Merge chunked results back into coherent output
   */
  mergeChunks(chunks) {
    return chunks.map(chunk => chunk.content).join('\n--- CHUNK BREAK ---\n');
  }
}

module.exports = OptimizedDiffProcessor;