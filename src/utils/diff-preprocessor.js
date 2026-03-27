/**
 * Diff Preprocessor - Preprocesses git diffs for AI consumption
 */

const InputSanitizer = require('./input-sanitizer');
const PerformanceUtils = require('./performance-utils');
const OptimizedDiffProcessor = require('./optimized-diff-processor');

class DiffPreprocessor {
  constructor(options = {}) {
    this.maxPromptLength = options.maxPromptLength || 8000;
    this.preserveContext = options.preserveContext !== undefined ? options.preserveContext : true;
    this.optimizedDiffProcessor = new OptimizedDiffProcessor();
  }

  /**
   * Preprocess diff to make it more AI-friendly while preserving full context
   */
  preprocessDiff(diff) {
    if (!diff) return '';

    // First, sanitize the diff to remove any potential secrets
    const sanitizedDiff = InputSanitizer.sanitizeDiffContent(diff) || '';
    
    // Then, use the optimized diff processor to reduce size while keeping important changes
    const processed = this.optimizedDiffProcessor.process(sanitizedDiff);
    
    // If the processed diff is still too long, we can truncate it smartly
    const estimatedTokens = PerformanceUtils.estimateTokens(processed);
    if (estimatedTokens > this.maxPromptLength * 0.75) { // Leave room for prompt overhead
      return this._smartTruncate(processed, this.maxPromptLength * 0.75);
    }
    
    return processed;
  }

  /**
   * Smart truncation preserving important parts
   */
  _smartTruncate(content, maxLength) {
    if (content.length <= maxLength) return content;
    
    // Try to preserve beginning and end which often contain important context
    const headLength = Math.floor(maxLength * 0.6);
    const tailLength = Math.floor(maxLength * 0.4);
    
    const head = content.substring(0, headLength);
    const tail = content.substring(content.length - tailLength);
    
    return head + '\n\n... [content truncated for length] ...\n\n' + tail;
  }

  /**
   * Build enhanced prompt for commit message generation using improved approach
   * (This method is now in prompt-builder.js, kept here for backward compatibility)
   * @deprecated use PromptBuilder instead
   */
  buildPrompt(diff, options = {}) {
    const PromptBuilder = require('./prompt-builder');
    const promptBuilder = new PromptBuilder({
      maxPromptLength: this.maxPromptLength,
      preserveContext: this.preserveContext
    });
    return promptBuilder.buildPrompt(diff, options);
  }

  /**
   * Preprocess and chunk diff for large content, filtering assets
   */
  preprocessDiffWithAssets(diff, maxChunkSize = 4000) {
    if (!diff) return '';

    // First, filter assets regardless of size
    const lines = diff.split('\n');
    const filteredLines = [];
    const assetFiles = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect file headers - check for assets
      if (line.startsWith('diff --git')) {
        const fileMatch = line.match(/diff --git a\/(.+?) b\/(.+)/);
        if (fileMatch) {
          const filePath = fileMatch[2];
          const ext = filePath.split('.').pop().toLowerCase();
          const assetExtensions = ['svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'woff', 'woff2', 'ttf', 'eot', 'mp4', 'mp3', 'pdf', 'zip', 'tar', 'gz'];

          if (assetExtensions.includes(ext) || /^Binary files/.test(lines[i + 1] || '')) {
            assetFiles.push(filePath);
            filteredLines.push(`# Asset file added: ${filePath}`);

            // Skip ahead to next diff --git (don't include asset content)
            while (i + 1 < lines.length && !lines[i + 1].startsWith('diff --git')) {
              i++;
            }
            continue;
          }
        }
      }

      filteredLines.push(line);
    }

    let filtered = filteredLines.join('\n');

    // Add asset summary at the beginning if assets were filtered
    if (assetFiles.length > 0) {
      const assetSummary = this.generateAssetSummary(assetFiles);
      filtered = assetSummary + filtered;
    }

    // Then check if diff is already reasonable size
    if (filtered.length < maxChunkSize) {
      return filtered;
    }

    return filtered;
  }

  /**
   * Generate summary of asset files that were filtered
   */
  generateAssetSummary(assetFiles) {
    if (!assetFiles || assetFiles.length === 0) return '';

    const extensions = {};
    assetFiles.forEach(file => {
      const ext = file.split('.').pop().toLowerCase();
      extensions[ext] = (extensions[ext] || 0) + 1;
    });

    let summary = '# ASSET FILES (filtered for AI):\n';
    for (const [ext, count] of Object.entries(extensions)) {
      summary += `# ${ext}: ${count} file(s)\n`;
    }
    summary += '#\n';

    return summary;
  }

  /**
   * Chunk diff into smaller pieces for provider processing
   */
  chunkDiff(diff, maxTokens = 4000) {
    const lines = diff.split('\n');
    const chunks = [];
    let currentChunk = [];
    let currentSize = 0;

    for (const line of lines) {
      const lineSize = line.length;

      // If a single line is too big, try to break it down
      if (lineSize > maxTokens) {
        // For very long lines, break into smaller segments
        for (let i = 0; i < line.length; i += maxTokens) {
          const segment = line.substring(i, i + maxTokens);
          chunks.push(segment);
        }
        continue;
      }

      if (currentSize + lineSize > maxTokens && currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [line];
        currentSize = lineSize;
      } else {
        currentChunk.push(line);
        currentSize += lineSize;
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    return chunks;
  }
}

module.exports = DiffPreprocessor;