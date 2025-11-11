/**
 * Optimized Diff Processor - High-performance diff processing with chunking
 */

const PerformanceUtils = require('./performance-utils');

class OptimizedDiffProcessor {
  constructor(options = {}) {
    this.maxTokens = options.maxTokens || 4000;
    this.chunkSize = options.chunkSize || 8000;
    this.preserveContext = options.preserveContext || true;
  }

  /**
   * Process diff with intelligent chunking
   */
  process(diff, options = {}) {
    const startTime = Date.now();
    
    // Optimize the diff first
    const optimizedDiff = PerformanceUtils.optimizeDiffProcessing(diff, {
      maxDiffSize: 100000, // 100KB
      maxLineLength: 300,
      preserveContextLines: 3
    });
    
    // Determine if we need to chunk based on token estimation
    const estimatedTokens = PerformanceUtils.estimateTokens(optimizedDiff);
    
    if (estimatedTokens <= this.maxTokens || options.forceFull) {
      return {
        strategy: 'full',
        data: optimizedDiff,  // Should be the diff string for full strategy
        chunks: null,
        info: {
          strategy: 'full',
          originalSize: diff.length,
          processedSize: optimizedDiff.length,
          estimatedTokens,
          processingTime: Date.now() - startTime,
          requiresChunking: false,
          reasoning: 'Diff size manageable, using full content'
        }
      };
    }
    
    // Use parallel chunking for better performance
    const chunks = this.chunkOptimized(optimizedDiff);
    
    return {
      strategy: 'chunked',
      data: chunks,  // Should be an array of chunks for chunked strategy
      chunks: chunks.length,
      info: {
        strategy: 'parallel_chunked',
        originalSize: diff.length,
        processedSize: optimizedDiff.length,
        estimatedTokens,
        chunks: chunks.length,
        avgChunkSize: Math.round(optimizedDiff.length / chunks.length),
        processingTime: Date.now() - startTime,
        requiresChunking: true,
        reasoning: `Diff too large (${optimizedDiff.length} chars), chunked into ${chunks.length} parts`
      }
    };
  }

  /**
   * Optimized chunking using parallel processing
   */
  chunkOptimized(diff) {
    const lines = diff.split('\n');
    const chunks = [];
    let currentChunk = [];
    let currentSize = 0;
    
    // Use a more efficient chunking algorithm
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSize = line.length;
      
      // If line is too large, split it
      if (lineSize > this.chunkSize) {
        if (currentChunk.length > 0) {
          chunks.push({
            content: currentChunk.join('\n'),
            size: currentSize,
            context: this.extractChunkContext(currentChunk.join('\n'))
          });
          currentChunk = [];
          currentSize = 0;
        }
        
        // Break large line into smaller segments
        for (let j = 0; j < line.length; j += this.chunkSize) {
          const segment = line.substring(j, Math.min(j + this.chunkSize, line.length));
          chunks.push({
            content: segment,
            size: segment.length,
            context: this.extractChunkContext(segment)
          });
        }
        continue;
      }
      
      // Check if adding this line would exceed chunk size
      if (currentSize + lineSize > this.chunkSize && currentChunk.length > 0) {
        // Find semantic boundaries for better chunking
        if (this.isSemanticBoundary(line)) {
          chunks.push({
            content: currentChunk.join('\n'),
            size: currentSize,
            context: this.extractChunkContext(currentChunk.join('\n'))
          });
          currentChunk = [line];
          currentSize = lineSize;
        } else {
          // Add to current chunk but check if it's getting too large
          if (currentChunk.length < 1000) { // Prevent infinite accumulation
            currentChunk.push(line);
            currentSize += lineSize;
          } else {
            // Force chunk if accumulating too many lines
            chunks.push({
              content: currentChunk.join('\n'),
              size: currentSize,
              context: this.extractChunkContext(currentChunk.join('\n'))
            });
            currentChunk = [line];
            currentSize = lineSize;
          }
        }
      } else {
        currentChunk.push(line);
        currentSize += lineSize;
      }
    }
    
    // Add the final chunk
    if (currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join('\n'),
        size: currentChunk.join('\n').length,
        context: this.extractChunkContext(currentChunk.join('\n'))
      });
    }
    
    return chunks;
  }

  /**
   * Identify semantic boundaries for intelligent chunking
   */
  isSemanticBoundary(line) {
    return line.startsWith('diff --git') ||
           line.startsWith('index ') ||
           line.startsWith('---') ||
           line.startsWith('+++') ||
           (line.startsWith('@@') && line.includes('function')) ||
           (line.startsWith('@@') && line.includes('class')) ||
           (line.startsWith('@@') && line.includes('def '));
  }

  /**
   * Extract context from chunk for AI processing
   */
  extractChunkContext(chunkContent) {
    const context = {
      files: [],
      functions: [],
      classes: [],
      components: [],
      hasSignificantChanges: false
    };

    // Extract file names
    const fileMatches = chunkContent.match(/\+\+\+ b\/(.+)/g) || [];
    context.files = fileMatches.map(f => f.replace('+++ b/', '').trim()).slice(0, 5);

    // Extract functions
    const funcMatches = chunkContent.match(/(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>|(\w+)\s*:\s*\([^)]*\)\s*=>)/g) || [];
    context.functions = funcMatches.map(m => m.replace(/.*function\s+|const\s+|:.*/, '').trim()).slice(0, 3);

    // Extract classes
    const classMatches = chunkContent.match(/class\s+(\w+)/g) || [];
    context.classes = classMatches.map(m => m.replace('class ', '').trim()).slice(0, 3);

    // Extract components (for web frameworks)
    const componentMatches = chunkContent.match(/(?:function\s+(\w+)\s*\([^)]*\)\s*\{|const\s+(\w+)\s*=\s*(?:React\.)?(?:forwardRef\s*\()?\([^)]*\)\s*=>\s*{)/g) || [];
    context.components = componentMatches.map(m => m.replace(/.*function\s+|const\s+|.*React\.forwardRef.*\(/, '').replace(/\s*\(.*/, '').trim()).slice(0, 3);

    context.hasSignificantChanges = context.functions.length > 0 || 
                                   context.classes.length > 0 || 
                                   context.components.length > 0;

    return context;
  }

  /**
   * Process chunk in parallel
   */
  async processChunkParallel(chunk, processorFn) {
    return PerformanceUtils.withTimeout(
      processorFn(chunk),
      60000 // 1 minute timeout
    );
  }

  /**
   * Select best messages from multiple results
   */
  selectBestMessages(messages, count = 3, options = {}) {
    if (!messages || messages.length === 0) return [];

    // Remove exact duplicates while preserving order
    const uniqueMessages = [];
    const seen = new Set();
    
    for (const message of messages) {
      if (!seen.has(message)) {
        seen.add(message);
        uniqueMessages.push(message);
      }
    }

    // Score messages based on quality factors
    const scored = uniqueMessages.map((msg, index) => ({
      message: msg,
      score: this.scoreCommitMessage(msg),
      originalIndex: index // Preserve original ordering for tie-breaking
    }));

    // Sort by score (descending) and then by original index (ascending) for ties
    scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.originalIndex - b.originalIndex; // Prioritize earlier messages for ties
    });

    return scored.slice(0, count).map(item => item.message);
  }

  /**
   * Score a commit message for quality
   */
  scoreCommitMessage(message) {
    let score = 0;

    // Prefer conventional commit format
    if (/^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?:/.test(message)) {
      score += 15;
    }

    // Optimal length range
    const length = message.length;
    if (length >= 15 && length <= 72) {
      score += 10;
    } else if (length >= 10 && length <= 100) {
      score += 5;
    }

    // Prefer messages without trailing period (conventional)
    if (!message.trim().endsWith('.')) {
      score += 2;
    }

    // Prefer imperative mood indicators
    const imperativeIndicators = [
      /^Add\b/, /^Fix\b/, /^Remove\b/, /^Update\b/, /^Create\b/,
      /^Refactor\b/, /^Improve\b/, /^Change\b/, /^Modify\b/
    ];
    
    if (imperativeIndicators.some(regex => regex.test(message))) {
      score += 5;
    }

    // Penalize generic terms
    const genericTerms = [
      /\bchanges?\b/i, /\bupdates?\b/i, /\bfixes?\b/i, 
      /\bstuff\b/i, /\bthings?\b/i, /\bvarious\b/i
    ];
    
    const genericPenalty = genericTerms.filter(regex => regex.test(message)).length * 8;
    score = Math.max(0, score - genericPenalty);

    // Reward specific technical terms
    const specificIndicators = [
      /\b[A-Z][a-zA-Z]*\b/, // Class names
      /\b\w+\(\)/, // Function calls
      /\b(import|export|require|module|component|hook|middleware)\b/i
    ];
    
    specificIndicators.forEach(regex => {
      if (regex.test(message)) {
        score += 3;
      }
    });

    return score;
  }
}

module.exports = OptimizedDiffProcessor;