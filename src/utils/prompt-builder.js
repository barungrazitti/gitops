/**
 * Prompt Builder - Constructs AI prompts for commit message generation
 */

const PerformanceUtils = require('./performance-utils');
const InputSanitizer = require('./input-sanitizer');

class PromptBuilder {
  constructor(options = {}) {
    this.maxPromptLength = options.maxPromptLength || 8000;
    this.preserveContext = options.preserveContext !== undefined ? options.preserveContext : true;
  }

  /**
   * Build enhanced prompt for commit message generation
   */
  buildPrompt(diff, options = {}) {
    // Sanitize inputs
    const sanitizedDiff = InputSanitizer.sanitizeDiffContent(diff) || '';
    const language = options.language || 'javascript';
    const context = options.context || {};
    
    // Estimate tokens to ensure we stay within limits
    const estimatedTokens = PerformanceUtils.estimateTokens(sanitizedDiff);
    
    // Truncate if necessary
    let processedDiff = sanitizedDiff;
    if (estimatedTokens > this.maxPromptLength * 0.75) { // Leave room for prompt overhead
      processedDiff = this._smartTruncate(sanitizedDiff, this.maxPromptLength * 0.75);
    }

    // Build the prompt
    let prompt = `You are an expert software engineer tasked with generating high-quality git commit messages based on the following code changes:\n\n`;
    prompt += `## Code Changes:\n\`\`\`diff\n${processedDiff}\n\`\`\`\n\n`;
    
    // Add context if available
    if (context.files && Object.keys(context.files).length > 0) {
      prompt += `## Context:\n`;
      if (context.files.semantic && Object.keys(context.files.semantic).length > 0) {
        prompt += `- Semantic changes detected in: ${Object.keys(context.files.semantic).join(', ')}\n`;
      }
      if (context.files.modified && context.files.modified.length > 0) {
        prompt += `- Modified files: ${context.files.modified.slice(0, 5).join(', ')}${context.files.modified.length > 5 ? ' and more' : ''}\n`;
      }
      prompt += '\n';
    }
    
    // Add instructions
    prompt += `## Instructions:\n`;
    prompt += `Generate a conventional commit message that clearly explains what changed and why. Follow these guidelines:\n`;
    prompt += `1. Use the conventional commit format: <type>[optional scope]: <description>\n`;
    prompt += `2. Types: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert\n`;
    prompt += `3. Keep the description concise but descriptive (max 72 characters)\n`;
    prompt += `4. Focus on the "why" behind the changes, not just the "what"\n`;
    prompt += `5. If this is a breaking change, add "BREAKING CHANGE:" in the footer\n`;
    prompt += `6. Do not include any additional text or explanations\n\n`;
    prompt += `Commit message:`;
    
    return prompt;
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
   * Build prompt for conflict resolution
   */
  buildConflictPrompt(filePath, currentVersion, incomingVersion, baseVersion, language) {
    let prompt = `You are an expert software engineer tasked with resolving a merge conflict in the file '${filePath}'.\n\n`;
    prompt += `## Current Version (HEAD):\n\`\`\`${language}\n${currentVersion}\n\`\`\`\n\n`;
    prompt += `## Incoming Version (MERGE_HEAD):\n\`\`\`${language}\n${incomingVersion}\n\`\`\`\n\n`;
    
    if (baseVersion && baseVersion.trim() !== '') {
      prompt += `## Base Version (common ancestor):\n\`\`\`${language}\n${baseVersion}\n\`\`\`\n\n`;
    }
    
    prompt += `## Instructions:\n`;
    prompt += `Analyze both versions and generate a merged version that preserves the intent of both changes.:\n`;
    prompt += `1. Look for complementary changes that can be combined\n`;
    prompt += `2. If changes are mutually exclusive, choose the one that makes more sense in context\n`;
    prompt += `3. Ensure the resulting code is syntactically correct\n`;
    prompt += `4. Do not add conflict markers in the output\n`;
    prompt += `5. Return only the resolved file content\n\n`;
    prompt += `Resolved file content:`;
    
    return prompt;
  }
}

module.exports = PromptBuilder;